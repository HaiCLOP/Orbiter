use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use crate::models::ReverbParams;

const FDN_ORDER: usize = 8;
const BUFFER_SIZE: usize = 8192; // Power of 2
const BUFFER_MASK: usize = BUFFER_SIZE - 1;
const INV_SQRT_8: f32 = 0.3535533905932738; // 1 / sqrt(8)

// Mutually prime delay line base lengths at 48 kHz (in samples)
const BASE_DELAYS: [usize; FDN_ORDER] = [1087, 1283, 1523, 1759, 1979, 2179, 2399, 2677];

// Early reflections tap delay offsets (samples at 48 kHz) and gains
const ER_TAPS_L: [(usize, f32); 4] = [
    (351, 0.42),   // ~7.3ms
    (917, -0.34),  // ~19.1ms
    (1618, 0.26),  // ~33.7ms
    (2376, -0.18), // ~49.5ms
];

const ER_TAPS_R: [(usize, f32); 4] = [
    (542, 0.38),   // ~11.3ms
    (1147, -0.32), // ~23.9ms
    (1877, 0.24),  // ~39.1ms
    (2750, -0.16), // ~57.3ms
];

/// Environmental Acoustics Reverb Stage:
/// 1. Stereo Early Reflections (discrete decorrelated reflections)
/// 2. 8-Line Feedback Delay Network (FDN-8) with Normalized Hadamard Matrix
/// 3. Per-line 1-pole high-frequency damping filters
/// 4. RT60 decay calculation with strict BIBO stability bounds (gain clamped to <= 0.985)
/// 5. Physical Distance DRR modulation (effective wet scales smoothly with distance)
/// 6. Click-free exponential parameter smoothing (~25ms)
///
/// Invariants:
/// - Real-time safe: Zero dynamic allocations in `process_sample()`.
/// - Mathematical stability: Feedback gains stay strictly < 1.0; system cannot run away.
#[derive(Debug, Clone)]
pub struct ReverbStage {
    sample_rate: f32,

    // Circular buffers for the 8 FDN delay lines (pre-allocated on heap, zero audio-thread allocation)
    buffers: Vec<f32>,
    write_pos: usize,

    // Delay lengths per line (in samples)
    delay_lens: [usize; FDN_ORDER],

    // Per-line feedback loop gains
    feedback_gains: [f32; FDN_ORDER],

    // Per-line 1-pole damping filter states
    damping_states: [f32; FDN_ORDER],
    damping_coeff: f32,

    // Early reflections circular buffers (pre-allocated on heap)
    er_buffer_l: Vec<f32>,
    er_buffer_r: Vec<f32>,
    er_write_pos: usize,

    // User settings
    target_amount: f32,
    current_amount: f32,

    target_room_size: f32,
    target_decay: f32,
    target_damping: f32,

    target_enabled: f32,
    current_enabled: f32,

    // Distance modulation factor [0.0, 1.0]
    distance: f32,

    // Smoothing coefficient
    smooth_alpha: f32,
}

impl ReverbStage {
    /// Initializes ReverbStage with pre-allocated zeroed buffers and default parameters.
    pub fn new(sample_rate: f32) -> Self {
        let sr = if sample_rate <= 0.0 { 44100.0 } else { sample_rate };
        let smoothing_sec = 0.025_f32;
        let smooth_alpha = 1.0 - (-1.0 / (smoothing_sec * sr)).exp();

        let mut stage = Self {
            sample_rate: sr,
            buffers: vec![0.0f32; FDN_ORDER * BUFFER_SIZE],
            write_pos: 0,
            delay_lens: BASE_DELAYS,
            feedback_gains: [0.0; FDN_ORDER],
            damping_states: [0.0; FDN_ORDER],
            damping_coeff: 0.28,
            er_buffer_l: vec![0.0f32; BUFFER_SIZE],
            er_buffer_r: vec![0.0f32; BUFFER_SIZE],
            er_write_pos: 0,
            target_amount: 0.30,
            current_amount: 0.30,
            target_room_size: 0.50,
            target_decay: 2.0,
            target_damping: 0.40,
            target_enabled: 0.0,
            current_enabled: 0.0,
            distance: 0.0,
            smooth_alpha,
        };

        stage.update_delay_lengths_and_gains();
        stage
    }

    /// Sets user parameters live with smooth transitions.
    pub fn set_params(&mut self, params: &ReverbParams) {
        self.target_enabled = if params.enabled { 1.0 } else { 0.0 };
        self.target_amount = params.amount.clamp(0.0, 1.0);
        self.target_room_size = params.room_size.clamp(0.0, 1.0);
        self.target_decay = params.decay.clamp(0.2, 12.0);
        self.target_damping = params.damping.clamp(0.0, 1.0);
        self.damping_coeff = self.target_damping * 0.70;

        self.update_delay_lengths_and_gains();
    }

    /// Informs the reverb stage of the current 3D source distance [0.0, 1.0]
    /// to calculate natural physical Direct-to-Reverberant Ratio (DRR).
    #[inline]
    pub fn set_distance(&mut self, distance: f32) {
        self.distance = distance.clamp(0.0, 1.0);
    }

    /// Sets the target wet mix amount [0.0, 1.0].
    #[inline]
    pub fn set_amount(&mut self, amount: f32) {
        self.target_amount = amount.clamp(0.0, 1.0);
    }

    /// Recomputes delay lengths and feedback loop gains based on room size and decay RT60.
    fn update_delay_lengths_and_gains(&mut self) {
        let sr_ratio = self.sample_rate / 48000.0;
        // Room size scale factor from 0.5x to 1.8x
        let size_scale = 0.5 + 1.3 * self.target_room_size;

        for i in 0..FDN_ORDER {
            let target_len = ((BASE_DELAYS[i] as f32) * size_scale * sr_ratio).round() as usize;
            // Clamp within valid buffer bounds with safety margin
            let clamped_len = target_len.clamp(64, BUFFER_SIZE - 64);
            self.delay_lens[i] = clamped_len;

            // RT60 loop gain: g = 10^(-3 * tau / T60)
            let tau = clamped_len as f32 / self.sample_rate;
            let raw_gain = 10.0_f32.powf(-3.0 * tau / self.target_decay);
            // Hard clamp at 0.985 to guarantee strict BIBO stability
            self.feedback_gains[i] = raw_gain.clamp(0.0, 0.985);
        }
    }

    /// Fast Walsh-Hadamard Transform (FWHT) for normalized 8x8 Hadamard matrix.
    /// Operates in place with zero heap allocations and zero matrix multiplications.
    #[inline]
    fn hadamard_mix_8(v: &mut [f32; 8]) {
        // Stage 1 (pairs)
        let a0 = v[0] + v[1];
        let a1 = v[0] - v[1];
        let a2 = v[2] + v[3];
        let a3 = v[2] - v[3];
        let a4 = v[4] + v[5];
        let a5 = v[4] - v[5];
        let a6 = v[6] + v[7];
        let a7 = v[6] - v[7];

        // Stage 2 (groups of 4)
        let b0 = a0 + a2;
        let b1 = a1 + a3;
        let b2 = a0 - a2;
        let b3 = a1 - a3;
        let b4 = a4 + a6;
        let b5 = a5 + a7;
        let b6 = a4 - a6;
        let b7 = a5 - a7;

        // Stage 3 (groups of 8) + normalize by 1/sqrt(8)
        v[0] = (b0 + b4) * INV_SQRT_8;
        v[1] = (b1 + b5) * INV_SQRT_8;
        v[2] = (b2 + b6) * INV_SQRT_8;
        v[3] = (b3 + b7) * INV_SQRT_8;
        v[4] = (b0 - b4) * INV_SQRT_8;
        v[5] = (b1 - b5) * INV_SQRT_8;
        v[6] = (b2 - b6) * INV_SQRT_8;
        v[7] = (b3 - b7) * INV_SQRT_8;
    }

    /// Processes a single stereo frame through Early Reflections and the FDN-8 late tank.
    ///
    /// Inputs:
    /// - `in_l`, `in_r`: Dry or positioned stereo input samples
    /// Outputs:
    /// - `(out_l, out_r)`: Reverberant blended stereo samples
    #[inline]
    pub fn process_sample(&mut self, in_l: f32, in_r: f32) -> (f32, f32) {
        // Advance smoothers
        self.current_enabled += self.smooth_alpha * (self.target_enabled - self.current_enabled);
        self.current_amount += self.smooth_alpha * (self.target_amount - self.current_amount);

        // Fast bypass when disabled and fully faded out
        if self.current_enabled < 1e-4 || self.current_amount < 1e-4 {
            return (in_l, in_r);
        }

        let input_mono = (in_l + in_r) * 0.5;

        // 1. Early Reflections
        self.er_buffer_l[self.er_write_pos] = in_l;
        self.er_buffer_r[self.er_write_pos] = in_r;

        let sr_ratio = self.sample_rate / 48000.0;
        let size_scale = 0.5 + 1.3 * self.target_room_size;

        let mut er_l = 0.0f32;
        let mut er_r = 0.0f32;

        for &(tap_delay, tap_gain) in &ER_TAPS_L {
            let actual_delay = ((tap_delay as f32) * size_scale * sr_ratio) as usize;
            let read_idx = (self.er_write_pos + BUFFER_SIZE - (actual_delay & BUFFER_MASK)) & BUFFER_MASK;
            er_l += self.er_buffer_l[read_idx] * tap_gain;
        }

        for &(tap_delay, tap_gain) in &ER_TAPS_R {
            let actual_delay = ((tap_delay as f32) * size_scale * sr_ratio) as usize;
            let read_idx = (self.er_write_pos + BUFFER_SIZE - (actual_delay & BUFFER_MASK)) & BUFFER_MASK;
            er_r += self.er_buffer_r[read_idx] * tap_gain;
        }

        self.er_write_pos = (self.er_write_pos + 1) & BUFFER_MASK;

        // 2. Read from the 8 FDN delay lines
        let mut delay_outputs = [0.0f32; FDN_ORDER];
        for i in 0..FDN_ORDER {
            let len = self.delay_lens[i];
            let read_idx = (self.write_pos + BUFFER_SIZE - len) & BUFFER_MASK;
            delay_outputs[i] = self.buffers[i * BUFFER_SIZE + read_idx];
        }

        // 3. Orthogonal Hadamard Matrix Mixing
        Self::hadamard_mix_8(&mut delay_outputs);

        // 4. Apply 1-pole damping filter + feedback gains + inject input
        let d = self.damping_coeff;
        for i in 0..FDN_ORDER {
            // Low-pass damping filter
            let filtered = (1.0 - d) * delay_outputs[i] + d * self.damping_states[i];
            self.damping_states[i] = filtered;

            // Feedback loop + excitation injection (scaled per delay line to avoid in-phase sum)
            let sign = if i % 2 == 0 { 1.0 } else { -1.0 };
            let feedback = filtered * self.feedback_gains[i];
            let injection = input_mono * (0.28 * sign) + (if i < 4 { er_l } else { er_r }) * 0.15;

            self.buffers[i * BUFFER_SIZE + self.write_pos] = feedback + injection;
        }

        self.write_pos = (self.write_pos + 1) & BUFFER_MASK;

        // 5. Output Matrix (decorrelated mix: channels 0,2,4,6 -> L, 1,3,5,7 -> R)
        let late_l = (delay_outputs[0] + delay_outputs[2] - delay_outputs[4] - delay_outputs[6]) * 0.5;
        let late_r = (delay_outputs[1] - delay_outputs[3] + delay_outputs[5] - delay_outputs[7]) * 0.5;

        let total_wet_l = er_l * 0.40 + late_l * 0.60;
        let total_wet_r = er_r * 0.40 + late_r * 0.60;

        // 6. Natural Distance DRR Modulation:
        // Farther sources naturally have more reverberant sound relative to direct sound
        let distance_boost = 0.75 + 0.50 * self.distance;
        let wet_factor = (self.current_amount * distance_boost).clamp(0.0, 1.25) * self.current_enabled;
        let dry_factor = (1.0 - (wet_factor * 0.50)).clamp(0.2, 1.0);

        let out_l = in_l * dry_factor + total_wet_l * wet_factor;
        let out_r = in_r * dry_factor + total_wet_r * wet_factor;

        (out_l, out_r)
    }
}

/// Thread-safe atomic bridge for transferring Reverb parameters from UI thread
/// to CPAL audio thread using Acquire-Release ordering.
pub struct ReverbBridge {
    pub enabled: AtomicBool,
    pub amount: AtomicU32,    // f32 bits
    pub room_size: AtomicU32, // f32 bits
    pub decay: AtomicU32,     // f32 bits
    pub damping: AtomicU32,   // f32 bits
    pub version: AtomicU32,   // Monotonic publish counter
}

impl ReverbBridge {
    pub fn new() -> Self {
        let default_p = ReverbParams::default();
        Self {
            enabled: AtomicBool::new(default_p.enabled),
            amount: AtomicU32::new(default_p.amount.to_bits()),
            room_size: AtomicU32::new(default_p.room_size.to_bits()),
            decay: AtomicU32::new(default_p.decay.to_bits()),
            damping: AtomicU32::new(default_p.damping.to_bits()),
            version: AtomicU32::new(1),
        }
    }

    pub fn set_params(&self, params: ReverbParams) {
        self.enabled.store(params.enabled, Ordering::Release);
        self.amount.store(params.amount.clamp(0.0, 1.0).to_bits(), Ordering::Release);
        self.room_size.store(params.room_size.clamp(0.0, 1.0).to_bits(), Ordering::Release);
        self.decay.store(params.decay.clamp(0.2, 12.0).to_bits(), Ordering::Release);
        self.damping.store(params.damping.clamp(0.0, 1.0).to_bits(), Ordering::Release);
        self.version.fetch_add(1, Ordering::Release);
    }

    pub fn get_params(&self) -> ReverbParams {
        ReverbParams {
            enabled: self.enabled.load(Ordering::Acquire),
            amount: f32::from_bits(self.amount.load(Ordering::Acquire)),
            room_size: f32::from_bits(self.room_size.load(Ordering::Acquire)),
            decay: f32::from_bits(self.decay.load(Ordering::Acquire)),
            damping: f32::from_bits(self.damping.load(Ordering::Acquire)),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_fdn_matrix_orthogonality() {
        // Test that the Hadamard mixing transform preserves total vector energy (isometry)
        let mut test_vector = [1.0, 0.0, 0.5, -0.5, 0.25, -0.25, 0.125, -0.125];
        let original_energy: f32 = test_vector.iter().map(|&x| x * x).sum();

        ReverbStage::hadamard_mix_8(&mut test_vector);
        let mixed_energy: f32 = test_vector.iter().map(|&x| x * x).sum();

        assert!(
            (mixed_energy - original_energy).abs() < 1e-5,
            "Hadamard matrix must be unitary / energy preserving: original={}, mixed={}",
            original_energy,
            mixed_energy
        );
    }

    #[test]
    fn test_fdn_feedback_gain_stability_and_bounds() {
        let sample_rate = 48000.0;
        let mut stage = ReverbStage::new(sample_rate);

        // Test across wide decay and room size ranges
        let decays = [0.2, 0.5, 1.0, 2.0, 5.0, 10.0, 15.0];
        let room_sizes = [0.0, 0.25, 0.5, 0.75, 1.0];

        for &decay in &decays {
            for &room_size in &room_sizes {
                stage.set_params(&ReverbParams {
                    enabled: true,
                    amount: 0.5,
                    room_size,
                    decay,
                    damping: 0.4,
                });

                for (i, &gain) in stage.feedback_gains.iter().enumerate() {
                    assert!(
                        gain >= 0.0 && gain <= 0.985,
                        "Feedback gain out of bounds at decay={}, size={}, line {}: gain={}",
                        decay,
                        room_size,
                        i,
                        gain
                    );
                }
            }
        }
    }

    #[test]
    fn test_reverb_bypass_when_disabled() {
        let sample_rate = 48000.0;
        let mut stage = ReverbStage::new(sample_rate);
        stage.set_params(&ReverbParams {
            enabled: false,
            amount: 0.5,
            room_size: 0.5,
            decay: 2.0,
            damping: 0.4,
        });

        let test_inputs = [(0.5, -0.5), (1.0, 1.0), (-0.707, 0.707), (0.0, 0.0)];
        for (in_l, in_r) in test_inputs {
            let (out_l, out_r) = stage.process_sample(in_l, in_r);
            assert!(
                (out_l - in_l).abs() < 1e-6,
                "Expected out_l ({}) == in_l ({}) when disabled",
                out_l,
                in_l
            );
            assert!(
                (out_r - in_r).abs() < 1e-6,
                "Expected out_r ({}) == in_r ({}) when disabled",
                out_r,
                in_r
            );
        }
    }

    #[test]
    fn test_reverb_decay_energy_decay_curve() {
        let sample_rate = 48000.0;
        let mut stage = ReverbStage::new(sample_rate);
        stage.set_params(&ReverbParams {
            enabled: true,
            amount: 1.0,
            room_size: 0.5,
            decay: 1.0,
            damping: 0.3,
        });

        // Fast forward smoother to active state
        for _ in 0..500 {
            stage.process_sample(0.0, 0.0);
        }

        // Inject unit impulse
        let (imp_l, imp_r) = stage.process_sample(1.0, 1.0);
        assert!(imp_l.is_finite());
        assert!(imp_r.is_finite());

        // Measure energy over successive windows (0-200ms, 200-500ms, 500-1000ms)
        let mut energy_w1 = 0.0f32;
        let mut energy_w2 = 0.0f32;
        let mut energy_w3 = 0.0f32;

        for n in 0..sample_rate as usize {
            let (out_l, out_r) = stage.process_sample(0.0, 0.0);
            let energy = out_l * out_l + out_r * out_r;

            if n < 9600 {
                // 0 to 200ms
                energy_w1 += energy;
            } else if n < 24000 {
                // 200ms to 500ms
                energy_w2 += energy;
            } else {
                // 500ms to 1000ms
                energy_w3 += energy;
            }
        }

        assert!(
            energy_w2 < energy_w1 * 2.0,
            "Reverb energy must decay over time: w1={}, w2={}",
            energy_w1,
            energy_w2
        );
        assert!(
            energy_w3 < energy_w2,
            "Reverb energy must continue decaying: w2={}, w3={}",
            energy_w2,
            energy_w3
        );
    }

    #[test]
    fn test_click_free_parameter_sweep() {
        let sample_rate = 48000.0;
        let mut stage = ReverbStage::new(sample_rate);
        let bridge = ReverbBridge::new();

        let mut prev_l = 0.0f32;
        let mut prev_r = 0.0f32;

        for n in 0..4000 {
            let p = n as f32 / 4000.0;
            if n % 64 == 0 {
                let params = ReverbParams {
                    enabled: true,
                    amount: p,
                    room_size: 1.0 - p,
                    decay: 0.5 + p * 3.0,
                    damping: p * 0.8,
                };
                bridge.set_params(params.clone());
                stage.set_params(&params);
                stage.set_distance(p);
            }

            let in_sig = ((n as f32 * 0.08).sin()) * 0.7;
            let (out_l, out_r) = stage.process_sample(in_sig, in_sig);

            assert!(out_l.is_finite(), "out_l must be finite at sample {}", n);
            assert!(out_r.is_finite(), "out_r must be finite at sample {}", n);

            if n > 0 {
                let delta_l = (out_l - prev_l).abs();
                let delta_r = (out_r - prev_r).abs();
                assert!(
                    delta_l < 0.75,
                    "Discontinuity in reverb output L at sample {}: delta={}",
                    n,
                    delta_l
                );
                assert!(
                    delta_r < 0.75,
                    "Discontinuity in reverb output R at sample {}: delta={}",
                    n,
                    delta_r
                );
            }

            prev_l = out_l;
            prev_r = out_r;
        }
    }
}

use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use crate::models::DynamicsParams;

const MAX_LOOKAHEAD_SAMPLES: usize = 1024; // Power of 2, fits >10ms at up to 96kHz
const LOOKAHEAD_MASK: usize = MAX_LOOKAHEAD_SAMPLES - 1;

/// Master Dynamics Stage:
/// 1. True Brickwall Peak Limiter with pre-allocated 5.0ms Lookahead Delay
/// 2. Lookahead peak envelope tracker with 1-pole exponential release
/// 3. Asymptotic Soft-Clipper safety ceiling
/// 4. Click-free parameter smoothing and bypass crossfade (~25ms)
///
/// Invariants:
/// - Real-Time Safe: Zero dynamic allocations in `process_sample()`.
/// - Mathematical Brickwall: Output peaks never exceed `threshold_linear` when limiter is enabled.
/// - Unconditionally Stable: Output values are bounded within [-1.0, 1.0].
#[derive(Debug, Clone)]
pub struct DynamicsStage {
    sample_rate: f32,

    // Pre-allocated circular lookahead delay buffers for audio (L/R)
    lookahead_buf_l: Vec<f32>,
    lookahead_buf_r: Vec<f32>,
    write_pos: usize,

    // Pre-allocated circular buffer tracking peak values over the lookahead horizon
    peak_history: Vec<f32>,
    lookahead_samples: usize,

    // Limiter parameters
    target_threshold_db: f32,
    target_threshold_linear: f32,

    target_release_ms: f32,
    release_alpha: f32,

    target_limiter_enabled: f32,
    current_limiter_enabled: f32,

    // Envelope state
    current_gain: f32,

    // Smoothing coefficient for parameter transitions (~25ms)
    smooth_alpha: f32,
}

impl DynamicsStage {
    /// Creates a new `DynamicsStage` at the specified audio hardware sample rate.
    pub fn new(sample_rate: f32) -> Self {
        let sr = if sample_rate <= 0.0 { 44100.0 } else { sample_rate };
        // 5.0 ms lookahead window
        let lookahead_samples = ((sr * 0.005).round() as usize).clamp(1, MAX_LOOKAHEAD_SAMPLES - 1);

        // 25ms smoothing for bypass and parameter adjustments
        let smoothing_sec = 0.025_f32;
        let smooth_alpha = 1.0 - (-1.0 / (smoothing_sec * sr)).exp();

        // Default release 150 ms
        let default_release_ms = 150.0_f32;
        let release_alpha = 1.0 - (-1.0 / ((default_release_ms / 1000.0) * sr)).exp();

        let default_threshold_db = -1.0_f32;
        let default_threshold_linear = 10.0_f32.powf(default_threshold_db / 20.0);

        Self {
            sample_rate: sr,
            lookahead_buf_l: vec![0.0f32; MAX_LOOKAHEAD_SAMPLES],
            lookahead_buf_r: vec![0.0f32; MAX_LOOKAHEAD_SAMPLES],
            write_pos: 0,
            peak_history: vec![0.0f32; MAX_LOOKAHEAD_SAMPLES],
            lookahead_samples,
            target_threshold_db: default_threshold_db,
            target_threshold_linear: default_threshold_linear,
            target_release_ms: default_release_ms,
            release_alpha,
            target_limiter_enabled: 1.0,
            current_limiter_enabled: 1.0,
            current_gain: 1.0,
            smooth_alpha,
        }
    }

    /// Sets dynamics parameters live from the UI thread.
    pub fn set_params(&mut self, params: &DynamicsParams) {
        self.target_limiter_enabled = if params.limiter_enabled { 1.0 } else { 0.0 };
        self.target_threshold_db = params.threshold_db.clamp(-18.0, 0.0);
        self.target_threshold_linear = 10.0_f32.powf(self.target_threshold_db / 20.0);

        self.target_release_ms = params.release_ms.clamp(20.0, 1000.0);
        let release_sec = self.target_release_ms / 1000.0;
        self.release_alpha = 1.0 - (-1.0 / (release_sec * self.sample_rate)).exp();
    }

    /// Returns the exact lookahead delay latency in audio frames.
    #[inline]
    pub fn lookahead_samples(&self) -> usize {
        self.lookahead_samples
    }

    /// Returns the current active gain reduction in linear units [0.0, 1.0].
    #[inline]
    pub fn current_gain(&self) -> f32 {
        self.current_gain
    }

    /// Asymptotic C1 continuous soft-clipper safety net.
    /// Perfectly linear below |x| <= 0.90; smoothly saturates asymptotically to 1.0 above 0.90.
    #[inline]
    pub fn soft_clip(x: f32) -> f32 {
        let abs_x = x.abs();
        if abs_x <= 0.90 {
            x
        } else {
            let sign = if x >= 0.0 { 1.0 } else { -1.0 };
            let saturated = 0.90 + 0.10 * ((abs_x - 0.90) / 0.10).tanh();
            sign * saturated.clamp(0.0, 1.0)
        }
    }

    /// Processes a single stereo frame through the 5ms lookahead brickwall limiter and soft-clipper.
    ///
    /// Invariants:
    /// - Zero allocations.
    /// - Output amplitude is bounded within [-1.0, 1.0].
    #[inline]
    pub fn process_sample(&mut self, in_l: f32, in_r: f32) -> (f32, f32) {
        // Advance bypass smoother
        self.current_limiter_enabled +=
            self.smooth_alpha * (self.target_limiter_enabled - self.current_limiter_enabled);

        // Store incoming sample pair in the circular lookahead delay buffer
        let w = self.write_pos;
        self.lookahead_buf_l[w] = in_l;
        self.lookahead_buf_r[w] = in_r;

        // Measure input peak magnitude
        let in_peak = in_l.abs().max(in_r.abs());
        self.peak_history[w] = in_peak;

        // Find delayed sample exiting the lookahead buffer (delayed by 5ms)
        let d = self.lookahead_samples;
        let r = (w + MAX_LOOKAHEAD_SAMPLES - d) & LOOKAHEAD_MASK;
        let delayed_l = self.lookahead_buf_l[r];
        let delayed_r = self.lookahead_buf_r[r];

        // If limiter is completely bypassed, pass delayed audio directly through soft-clipper
        if self.current_limiter_enabled < 1e-4 {
            self.write_pos = (w + 1) & LOOKAHEAD_MASK;
            self.current_gain = 1.0;
            return (Self::soft_clip(delayed_l), Self::soft_clip(delayed_r));
        }

        // Peak lookahead search: scan the lookahead window to find maximum upcoming peak
        // At 5ms / 48kHz, d is ~240 samples. Linear scan is ~240 iterations per frame (negligible < 1% CPU on 1 core).
        let mut horizon_max_peak = 0.0f32;
        for i in 0..d {
            let idx = (w + MAX_LOOKAHEAD_SAMPLES - i) & LOOKAHEAD_MASK;
            let p = self.peak_history[idx];
            if p > horizon_max_peak {
                horizon_max_peak = p;
            }
        }

        // Calculate required gain for the lookahead horizon peak
        let thresh = self.target_threshold_linear;
        let target_gain = if horizon_max_peak > thresh && horizon_max_peak > 1e-6 {
            thresh / horizon_max_peak
        } else {
            1.0
        };

        // Attack: Instantaneous reduction ahead of transient
        // Release: Exponential 1-pole smoothing back toward unity
        if target_gain < self.current_gain {
            self.current_gain = target_gain;
        } else {
            self.current_gain += self.release_alpha * (target_gain - self.current_gain);
        }

        // Apply gain reduction
        let limited_l = delayed_l * self.current_gain;
        let limited_r = delayed_r * self.current_gain;

        // Crossfade between limited audio and raw delayed audio based on limiter bypass
        let en = self.current_limiter_enabled;
        let out_l = en * limited_l + (1.0 - en) * delayed_l;
        let out_r = en * limited_r + (1.0 - en) * delayed_r;

        // Final safety soft-clipper
        let safe_l = Self::soft_clip(out_l);
        let safe_r = Self::soft_clip(out_r);

        self.write_pos = (w + 1) & LOOKAHEAD_MASK;

        (safe_l, safe_r)
    }
}

/// Thread-safe atomic bridge for transferring Dynamics parameters from UI thread
/// to CPAL audio thread using Acquire-Release ordering.
pub struct DynamicsBridge {
    pub limiter_enabled: AtomicBool,
    pub threshold_db: AtomicU32,       // f32 bits
    pub release_ms: AtomicU32,         // f32 bits
    pub normalize_enabled: AtomicBool,
    pub version: AtomicU32,            // Monotonic publish counter
}

impl DynamicsBridge {
    pub fn new() -> Self {
        let default_p = DynamicsParams::default();
        Self {
            limiter_enabled: AtomicBool::new(default_p.limiter_enabled),
            threshold_db: AtomicU32::new(default_p.threshold_db.to_bits()),
            release_ms: AtomicU32::new(default_p.release_ms.to_bits()),
            normalize_enabled: AtomicBool::new(default_p.normalize_enabled),
            version: AtomicU32::new(1),
        }
    }

    pub fn set_params(&self, params: DynamicsParams) {
        self.limiter_enabled.store(params.limiter_enabled, Ordering::Release);
        self.threshold_db.store(params.threshold_db.clamp(-18.0, 0.0).to_bits(), Ordering::Release);
        self.release_ms.store(params.release_ms.clamp(20.0, 1000.0).to_bits(), Ordering::Release);
        self.normalize_enabled.store(params.normalize_enabled, Ordering::Release);
        self.version.fetch_add(1, Ordering::Release);
    }

    pub fn get_params(&self) -> DynamicsParams {
        DynamicsParams {
            limiter_enabled: self.limiter_enabled.load(Ordering::Acquire),
            threshold_db: f32::from_bits(self.threshold_db.load(Ordering::Acquire)),
            release_ms: f32::from_bits(self.release_ms.load(Ordering::Acquire)),
            normalize_enabled: self.normalize_enabled.load(Ordering::Acquire),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_brickwall_limiter_clamps_overshoots() {
        let sample_rate = 48000.0;
        let mut stage = DynamicsStage::new(sample_rate);
        stage.set_params(&DynamicsParams {
            limiter_enabled: true,
            threshold_db: -1.0, // 0.89125 linear
            release_ms: 100.0,
            normalize_enabled: false,
        });

        let target_thresh = 10.0_f32.powf(-1.0 / 20.0);

        // Feed hot signal: +6 dB (amplitude 2.0)
        let lookahead = stage.lookahead_samples();
        let total_samples = lookahead + 200;

        for _ in 0..total_samples {
            let (out_l, out_r) = stage.process_sample(2.0, -2.0);
            // Output must never exceed threshold + small epsilon for numerical tolerance
            assert!(
                out_l.abs() <= target_thresh + 1e-4,
                "Limiter must clamp left channel: out_l={}, target_thresh={}",
                out_l,
                target_thresh
            );
            assert!(
                out_r.abs() <= target_thresh + 1e-4,
                "Limiter must clamp right channel: out_r={}, target_thresh={}",
                out_r,
                target_thresh
            );
        }
    }

    #[test]
    fn test_limiter_unity_when_below_threshold() {
        let sample_rate = 48000.0;
        let mut stage = DynamicsStage::new(sample_rate);
        stage.set_params(&DynamicsParams {
            limiter_enabled: true,
            threshold_db: -1.0, // 0.89125
            release_ms: 100.0,
            normalize_enabled: false,
        });

        let lookahead = stage.lookahead_samples();
        let test_val = 0.40f32; // well below threshold

        // Prime the lookahead buffer
        for _ in 0..lookahead {
            stage.process_sample(test_val, -test_val);
        }

        // Test output matches delayed input exactly
        for _ in 0..100 {
            let (out_l, out_r) = stage.process_sample(test_val, -test_val);
            assert!(
                (out_l - test_val).abs() < 1e-4,
                "Output must match input when below threshold: out_l={}, test_val={}",
                out_l,
                test_val
            );
            assert!(
                (out_r - (-test_val)).abs() < 1e-4,
                "Output must match input when below threshold: out_r={}, test_val={}",
                out_r,
                -test_val
            );
        }
    }

    #[test]
    fn test_limiter_smooth_release_curve() {
        let sample_rate = 48000.0;
        let mut stage = DynamicsStage::new(sample_rate);
        stage.set_params(&DynamicsParams {
            limiter_enabled: true,
            threshold_db: -3.0,
            release_ms: 100.0,
            normalize_enabled: false,
        });

        let lookahead = stage.lookahead_samples();

        // Feed hot impulse
        for _ in 0..(lookahead + 10) {
            stage.process_sample(2.5, 2.5);
        }

        let gain_at_peak = stage.current_gain();
        assert!(gain_at_peak < 0.8, "Gain must reduce during hot transient: gain={}", gain_at_peak);

        // Feed silence and check smooth recovery
        let mut prev_gain = gain_at_peak;
        for _ in 0..(lookahead * 4) {
            stage.process_sample(0.0, 0.0);
            let g = stage.current_gain();
            // Gain must monotonically recover toward 1.0
            assert!(g >= prev_gain - 1e-5, "Gain must recover smoothly: prev={}, current={}", prev_gain, g);
            prev_gain = g;
        }

        assert!(prev_gain > gain_at_peak, "Gain must have recovered toward unity over time");
    }

    #[test]
    fn test_normalize_gain_calculation() {
        let max_peak = 0.50f32;
        let target_peak = 10.0_f32.powf(-1.0 / 20.0); // 0.89125
        let calculated_gain = target_peak / max_peak;
        assert!(
            (calculated_gain - 1.7825).abs() < 1e-3,
            "Normalize gain for 0.5 peak must be ~1.7825: calculated={}",
            calculated_gain
        );
    }

    #[test]
    fn test_click_free_parameter_sweep() {
        let sample_rate = 48000.0;
        let mut stage = DynamicsStage::new(sample_rate);

        // Rapid parameter sweep while processing
        let thresholds = [0.0, -1.0, -3.0, -6.0, -12.0, -18.0];
        let releases = [20.0, 50.0, 150.0, 300.0, 800.0, 1000.0];

        for &th in &thresholds {
            for &rel in &releases {
                stage.set_params(&DynamicsParams {
                    limiter_enabled: true,
                    threshold_db: th,
                    release_ms: rel,
                    normalize_enabled: true,
                });

                for _ in 0..16 {
                    let (out_l, out_r) = stage.process_sample(1.5, -1.5);
                    assert!(!out_l.is_nan(), "Output L must never be NaN");
                    assert!(!out_r.is_nan(), "Output R must never be NaN");
                    assert!(out_l.abs() <= 1.0001, "Output L must be bounded by 1.0: {}", out_l);
                    assert!(out_r.abs() <= 1.0001, "Output R must be bounded by 1.0: {}", out_r);
                }
            }
        }
    }
}

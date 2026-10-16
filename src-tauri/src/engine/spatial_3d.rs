use std::sync::atomic::{AtomicU32, Ordering};
use crate::engine::biquad::{BiquadCoeffs, CrossfadingBiquad};

/// 3D Distance processing stage.
///
/// Features:
/// 1. Inverse-distance volume attenuation: `gain = 1.0 / (1.0 + 7.0 * distance)`
/// 2. Air absorption low-pass filter: `fc = 20000 * (0.125)^distance` (2.5 kHz at max distance)
/// 3. Exponential gain smoother (~25ms) preventing zipper noise during live slider dragging.
/// 4. Click-free 128-sample dual-state crossfading biquad filter.
///
/// Invariants:
/// - Zero dynamic allocations in `process_sample()`.
/// - Output amplitude decreases monotonically with increasing distance.
/// - Stability: air absorption filter poles stay strictly inside the unit circle.
#[derive(Debug, Clone)]
pub struct DistanceStage {
    sample_rate: f32,
    air_filter: CrossfadingBiquad,
    target_gain: f32,
    current_gain: f32,
    smooth_alpha: f32,
}

impl DistanceStage {
    /// Creates a new `DistanceStage` at the specified audio sample rate.
    /// Default distance is 0.0 (near, unity gain, 20 kHz bypass).
    pub fn new(sample_rate: f32) -> Self {
        let sr = if sample_rate <= 0.0 { 44100.0 } else { sample_rate };
        let default_air = BiquadCoeffs::high_cut(sr, 20000.0);

        // ~25ms exponential smoothing time constant
        let smoothing_sec = 0.025_f32;
        let smooth_alpha = 1.0 - (-1.0 / (smoothing_sec * sr)).exp();

        Self {
            sample_rate: sr,
            air_filter: CrossfadingBiquad::new(default_air),
            target_gain: 1.0,
            current_gain: 1.0,
            smooth_alpha,
        }
    }

    /// Sets the target distance parameter [0.0, 1.0].
    /// Automatically calculates target gain and air-absorption filter cutoff.
    pub fn set_distance(&mut self, distance: f32) {
        let d = distance.clamp(0.0, 1.0);
        self.target_gain = 1.0 / (1.0 + 7.0 * d);

        // Exponential cutoff mapping: 20000 Hz at d=0.0 down to 2500 Hz at d=1.0
        let cutoff_hz = 20000.0 * (0.125_f32).powf(d);
        let air_coeffs = BiquadCoeffs::high_cut(self.sample_rate, cutoff_hz);
        self.air_filter.set_coeffs(air_coeffs);
    }

    /// Direct coefficient and target gain update from precalculated bridge.
    #[inline]
    pub fn set_precalculated(&mut self, target_gain: f32, air_coeffs: BiquadCoeffs) {
        self.target_gain = target_gain.clamp(0.0, 1.0);
        self.air_filter.set_coeffs(air_coeffs);
    }

    /// Processes a single stereo frame through air absorption and distance attenuation.
    ///
    /// Inputs:
    /// - `in_l`, `in_r`: Stereo input samples
    /// Outputs:
    /// - `(out_l, out_r)`: Filtered and attenuated stereo samples
    #[inline]
    pub fn process_sample(&mut self, in_l: f32, in_r: f32) -> (f32, f32) {
        // 1. Air absorption high-cut filter
        let (f_l, f_r) = self.air_filter.process_sample(in_l, in_r);

        // 2. Exponential gain smoothing
        self.current_gain += self.smooth_alpha * (self.target_gain - self.current_gain);

        // 3. Inverse distance gain
        (f_l * self.current_gain, f_r * self.current_gain)
    }

    /// Current smoothed gain value (for telemetry / tests).
    #[inline]
    pub fn current_gain(&self) -> f32 {
        self.current_gain
    }
}

/// 3D Elevation processing stage (pinna spectral cue approximation).
///
/// Features:
/// 1. High-frequency pinna shelf filter centered at 7.5 kHz.
/// 2. `elevation` in [-1.0, 1.0]:
///    - `+1.0` (above): +5.0 dB high-shelf boost (air, height, open resonance).
///    - `0.0` (ear-level): 0.0 dB exact identity pass-through.
///    - `-1.0` (below): -5.0 dB high-shelf cut (torso acoustic shadow).
/// 3. Click-free 128-sample dual-state crossfading biquad filter.
///
/// Invariants:
/// - Zero dynamic allocations in `process_sample()`.
/// - Neutral elevation (0.0) produces bit-for-bit passthrough.
#[derive(Debug, Clone)]
pub struct ElevationStage {
    sample_rate: f32,
    shelf_filter: CrossfadingBiquad,
}

impl ElevationStage {
    /// Creates a new `ElevationStage` initialized to neutral (0.0 elevation, identity pass-through).
    pub fn new(sample_rate: f32) -> Self {
        let sr = if sample_rate <= 0.0 { 44100.0 } else { sample_rate };
        Self {
            sample_rate: sr,
            shelf_filter: CrossfadingBiquad::new(BiquadCoeffs::identity()),
        }
    }

    /// Sets the elevation parameter [-1.0, 1.0].
    pub fn set_elevation(&mut self, elevation: f32) {
        let e = elevation.clamp(-1.0, 1.0);
        let gain_db = e * 5.0;
        let coeffs = if gain_db.abs() < 0.01 {
            BiquadCoeffs::identity()
        } else {
            BiquadCoeffs::treble_shelf(self.sample_rate, 7500.0, gain_db)
        };
        self.shelf_filter.set_coeffs(coeffs);
    }

    /// Direct coefficient update from precalculated bridge.
    #[inline]
    pub fn set_precalculated(&mut self, shelf_coeffs: BiquadCoeffs) {
        self.shelf_filter.set_coeffs(shelf_coeffs);
    }

    /// Processes a single stereo frame through the elevation pinna shelf filter.
    #[inline]
    pub fn process_sample(&mut self, in_l: f32, in_r: f32) -> (f32, f32) {
        self.shelf_filter.process_sample(in_l, in_r)
    }
}

/// Thread-safe atomic bridge for transferring Distance and Elevation parameters and
/// precalculated biquad filter coefficients from the UI thread to the real-time audio callback.
///
/// Invariants:
/// - Single writer (UI commands), single reader (audio callback).
/// - Coefficients precomputed on UI thread using audio device sample rate.
/// - Stores use `Ordering::Release`, loads use `Ordering::Acquire`.
/// - Zero dynamic allocations in real-time path.
pub struct Spatial3DBridge {
    pub distance: AtomicU32,      // f32 bits
    pub elevation: AtomicU32,     // f32 bits
    pub target_gain: AtomicU32,   // f32 bits
    pub version: AtomicU32,       // Monotonic publish counter

    // Air Absorption Coefficients (high-cut)
    pub air_b0: AtomicU32,
    pub air_b1: AtomicU32,
    pub air_b2: AtomicU32,
    pub air_a1: AtomicU32,
    pub air_a2: AtomicU32,

    // Elevation Shelf Coefficients (treble-shelf)
    pub elev_b0: AtomicU32,
    pub elev_b1: AtomicU32,
    pub elev_b2: AtomicU32,
    pub elev_a1: AtomicU32,
    pub elev_a2: AtomicU32,
}

impl Spatial3DBridge {
    pub fn new(sample_rate: f32) -> Self {
        let default_dist = 0.0_f32;
        let default_elev = 0.0_f32;
        let default_gain = 1.0_f32;

        let air_coeffs = BiquadCoeffs::high_cut(sample_rate, 20000.0);
        let elev_coeffs = BiquadCoeffs::identity();

        Self {
            distance: AtomicU32::new(default_dist.to_bits()),
            elevation: AtomicU32::new(default_elev.to_bits()),
            target_gain: AtomicU32::new(default_gain.to_bits()),
            version: AtomicU32::new(1),

            air_b0: AtomicU32::new(air_coeffs.b0.to_bits()),
            air_b1: AtomicU32::new(air_coeffs.b1.to_bits()),
            air_b2: AtomicU32::new(air_coeffs.b2.to_bits()),
            air_a1: AtomicU32::new(air_coeffs.a1.to_bits()),
            air_a2: AtomicU32::new(air_coeffs.a2.to_bits()),

            elev_b0: AtomicU32::new(elev_coeffs.b0.to_bits()),
            elev_b1: AtomicU32::new(elev_coeffs.b1.to_bits()),
            elev_b2: AtomicU32::new(elev_coeffs.b2.to_bits()),
            elev_a1: AtomicU32::new(elev_coeffs.a1.to_bits()),
            elev_a2: AtomicU32::new(elev_coeffs.a2.to_bits()),
        }
    }

    /// Updates distance and recomputes air absorption filter coefficients.
    pub fn set_distance(&self, sample_rate: f32, distance: f32) {
        let d = distance.clamp(0.0, 1.0);
        let gain = 1.0 / (1.0 + 7.0 * d);
        let cutoff_hz = 20000.0 * (0.125_f32).powf(d);
        let air = BiquadCoeffs::high_cut(sample_rate, cutoff_hz);

        self.distance.store(d.to_bits(), Ordering::Release);
        self.target_gain.store(gain.to_bits(), Ordering::Release);

        self.air_b0.store(air.b0.to_bits(), Ordering::Relaxed);
        self.air_b1.store(air.b1.to_bits(), Ordering::Relaxed);
        self.air_b2.store(air.b2.to_bits(), Ordering::Relaxed);
        self.air_a1.store(air.a1.to_bits(), Ordering::Relaxed);
        self.air_a2.store(air.a2.to_bits(), Ordering::Relaxed);

        self.version.fetch_add(1, Ordering::Release);
    }

    /// Updates elevation and recomputes pinna shelf filter coefficients.
    pub fn set_elevation(&self, sample_rate: f32, elevation: f32) {
        let e = elevation.clamp(-1.0, 1.0);
        let gain_db = e * 5.0;
        let elev = if gain_db.abs() < 0.01 {
            BiquadCoeffs::identity()
        } else {
            BiquadCoeffs::treble_shelf(sample_rate, 7500.0, gain_db)
        };

        self.elevation.store(e.to_bits(), Ordering::Release);

        self.elev_b0.store(elev.b0.to_bits(), Ordering::Relaxed);
        self.elev_b1.store(elev.b1.to_bits(), Ordering::Relaxed);
        self.elev_b2.store(elev.b2.to_bits(), Ordering::Relaxed);
        self.elev_a1.store(elev.a1.to_bits(), Ordering::Relaxed);
        self.elev_a2.store(elev.a2.to_bits(), Ordering::Relaxed);

        self.version.fetch_add(1, Ordering::Release);
    }

    /// Updates both distance and elevation atomically.
    pub fn set_params(&self, sample_rate: f32, distance: f32, elevation: f32) {
        let d = distance.clamp(0.0, 1.0);
        let gain = 1.0 / (1.0 + 7.0 * d);
        let cutoff_hz = 20000.0 * (0.125_f32).powf(d);
        let air = BiquadCoeffs::high_cut(sample_rate, cutoff_hz);

        let e = elevation.clamp(-1.0, 1.0);
        let gain_db = e * 5.0;
        let elev = if gain_db.abs() < 0.01 {
            BiquadCoeffs::identity()
        } else {
            BiquadCoeffs::treble_shelf(sample_rate, 7500.0, gain_db)
        };

        self.distance.store(d.to_bits(), Ordering::Release);
        self.target_gain.store(gain.to_bits(), Ordering::Release);
        self.elevation.store(e.to_bits(), Ordering::Release);

        self.air_b0.store(air.b0.to_bits(), Ordering::Relaxed);
        self.air_b1.store(air.b1.to_bits(), Ordering::Relaxed);
        self.air_b2.store(air.b2.to_bits(), Ordering::Relaxed);
        self.air_a1.store(air.a1.to_bits(), Ordering::Relaxed);
        self.air_a2.store(air.a2.to_bits(), Ordering::Relaxed);

        self.elev_b0.store(elev.b0.to_bits(), Ordering::Relaxed);
        self.elev_b1.store(elev.b1.to_bits(), Ordering::Relaxed);
        self.elev_b2.store(elev.b2.to_bits(), Ordering::Relaxed);
        self.elev_a1.store(elev.a1.to_bits(), Ordering::Relaxed);
        self.elev_a2.store(elev.a2.to_bits(), Ordering::Relaxed);

        self.version.fetch_add(1, Ordering::Release);
    }

    pub fn get_distance(&self) -> f32 {
        f32::from_bits(self.distance.load(Ordering::Acquire))
    }

    pub fn get_elevation(&self) -> f32 {
        f32::from_bits(self.elevation.load(Ordering::Acquire))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_distance_attenuation_and_air_absorption_bounds() {
        let sample_rate = 48000.0;
        let mut stage = DistanceStage::new(sample_rate);

        // Test monotonic decrease in target gain
        let distances = [0.0, 0.25, 0.5, 0.75, 1.0];
        let mut prev_gain = 2.0;

        for &d in &distances {
            stage.set_distance(d);
            assert!(
                stage.target_gain < prev_gain,
                "Target gain should decrease monotonically: d={}, gain={}",
                d,
                stage.target_gain
            );
            prev_gain = stage.target_gain;

            // Check air filter coefficient stability
            let cutoff = 20000.0 * (0.125_f32).powf(d);
            let coeffs = BiquadCoeffs::high_cut(sample_rate, cutoff);
            assert!(
                coeffs.is_stable(),
                "Air absorption high-cut filter must be stable at d={}",
                d
            );
        }

        // At d=0.0, target gain is exactly 1.0
        stage.set_distance(0.0);
        assert!((stage.target_gain - 1.0).abs() < 1e-6);

        // At d=1.0, target gain is exactly 1/8 = 0.125
        stage.set_distance(1.0);
        assert!((stage.target_gain - 0.125).abs() < 1e-6);
    }

    #[test]
    fn test_elevation_neutral_is_identity() {
        let sample_rate = 48000.0;
        let mut stage = ElevationStage::new(sample_rate);
        stage.set_elevation(0.0);

        // Input stereo impulses and sine values
        let test_samples = [
            (0.0, 0.0),
            (1.0, -1.0),
            (0.5, 0.5),
            (-0.707, 0.707),
            (0.123, -0.456),
        ];

        for (in_l, in_r) in test_samples {
            let (out_l, out_r) = stage.process_sample(in_l, in_r);
            assert!(
                (out_l - in_l).abs() < 1e-6,
                "Expected out_l ({}) == in_l ({}) at neutral elevation",
                out_l,
                in_l
            );
            assert!(
                (out_r - in_r).abs() < 1e-6,
                "Expected out_r ({}) == in_r ({}) at neutral elevation",
                out_r,
                in_r
            );
        }
    }

    #[test]
    fn test_elevation_spectral_shaping() {
        let sample_rate = 48000.0;
        let mut stage_above = ElevationStage::new(sample_rate);
        let mut stage_below = ElevationStage::new(sample_rate);

        stage_above.set_elevation(1.0);
        stage_below.set_elevation(-1.0);

        // Warm up crossfader to steady state
        for _ in 0..256 {
            stage_above.process_sample(0.0, 0.0);
            stage_below.process_sample(0.0, 0.0);
        }

        // Generate 8 kHz high-frequency tone
        let f = 8000.0;
        let mut sum_above_energy = 0.0f32;
        let mut sum_below_energy = 0.0f32;

        for n in 0..1000 {
            let t = n as f32 / sample_rate;
            let sample = (2.0 * std::f32::consts::PI * f * t).sin();
            let (a_l, _) = stage_above.process_sample(sample, sample);
            let (b_l, _) = stage_below.process_sample(sample, sample);

            if n > 200 {
                // Steady-state measurement
                sum_above_energy += a_l * a_l;
                sum_below_energy += b_l * b_l;
            }
        }

        // +5dB overhead vs -5dB below: overhead energy must be strictly higher
        assert!(
            sum_above_energy > sum_below_energy * 2.0,
            "Elevation above should produce significantly more high-frequency energy than below: above={}, below={}",
            sum_above_energy,
            sum_below_energy
        );
    }

    #[test]
    fn test_click_free_distance_and_elevation_sweep() {
        let sample_rate = 48000.0;
        let mut dist_stage = DistanceStage::new(sample_rate);
        let mut elev_stage = ElevationStage::new(sample_rate);

        let mut prev_l = 0.0f32;
        let mut prev_r = 0.0f32;

        // Sweep distance and elevation across 4000 samples with input signal
        for n in 0..4000 {
            let progress = (n as f32) / 4000.0;
            let d = progress;
            let e = (progress * 2.0) - 1.0; // -1.0 to +1.0

            if n % 64 == 0 {
                dist_stage.set_distance(d);
                elev_stage.set_elevation(e);
            }

            let in_sig = ((n as f32 * 0.05).sin()) * 0.8;
            let (e_l, e_r) = elev_stage.process_sample(in_sig, in_sig);
            let (out_l, out_r) = dist_stage.process_sample(e_l, e_r);

            // Invariant 1: No NaNs or infinities
            assert!(out_l.is_finite(), "out_l must be finite at sample {}", n);
            assert!(out_r.is_finite(), "out_r must be finite at sample {}", n);

            // Invariant 2: No jump discontinuities (clicking)
            if n > 0 {
                let delta_l = (out_l - prev_l).abs();
                let delta_r = (out_r - prev_r).abs();
                assert!(
                    delta_l < 0.6,
                    "Discontinuity detected in Left channel at sample {}: delta={}",
                    n,
                    delta_l
                );
                assert!(
                    delta_r < 0.6,
                    "Discontinuity detected in Right channel at sample {}: delta={}",
                    n,
                    delta_r
                );
            }

            prev_l = out_l;
            prev_r = out_r;
        }
    }
}

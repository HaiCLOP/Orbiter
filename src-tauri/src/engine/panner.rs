use std::f32::consts::PI;

const TWO_PI: f32 = 2.0 * PI;
const DELAY_LINE_SIZE: usize = 128; // Power of 2, >= max ITD delay (~40 samples at 48kHz)
const DELAY_MASK: usize = DELAY_LINE_SIZE - 1;

/// Binaural 8D Panner using:
/// 1. Low-Frequency Oscillator (LFO) for continuous circular azimuth rotation.
/// 2. Equal-Power Circular Pan Law: Smooth 360-degree gain trajectory.
/// 3. Interaural Time Difference (ITD): Fractional delay line modeling head geometry (Woodworth model).
/// 4. Interaural Level Difference (ILD): 1-pole low-pass head-shadow diffraction filter on the far ear.
/// 5. Exponential Parameter Smoothing: Prevents audible clicks and zipper noise during live adjustments.
///
/// Invariants:
/// - Real-Time Safe: Zero dynamic allocations and zero locks in `process_sample()`.
/// - Delay line indices stay strictly within `[0, DELAY_LINE_SIZE - 1]`.
/// - Azimuth `phi` is kept in `[0, 2 * PI)`.
/// - Output signals stay normalized and stable across all parameter ranges.
pub struct Panner {
    sample_rate: f32,
    phase: f32, // Azimuth angle in radians [0, 2*PI)

    // Delay lines for ITD (circular buffers)
    delay_line_l: [f32; DELAY_LINE_SIZE],
    delay_line_r: [f32; DELAY_LINE_SIZE],
    write_idx: usize,

    // Head-shadow 1-pole filter states
    filter_state_l: f32,
    filter_state_r: f32,

    // Parameter Smoothers (target vs current)
    target_speed: f32,
    current_speed: f32,

    target_intensity: f32,
    current_intensity: f32,

    target_enabled: f32,
    current_enabled: f32,

    // Smoothing coefficient per sample
    smooth_alpha: f32,
}

impl Panner {
    /// Inputs: `sample_rate` in Hz
    /// Outputs: Initialized `Panner` instance with default values (0.25 Hz speed, 80% intensity, disabled)
    /// Invariants: `sample_rate` must be > 0.
    pub fn new(sample_rate: f32) -> Self {
        let sr = if sample_rate <= 0.0 { 44100.0 } else { sample_rate };
        // ~25ms exponential smoothing time constant
        let tau = 0.025f32;
        let smooth_alpha = 1.0 - (-1.0 / (tau * sr)).exp();

        Self {
            sample_rate: sr,
            phase: 0.0,
            delay_line_l: [0.0; DELAY_LINE_SIZE],
            delay_line_r: [0.0; DELAY_LINE_SIZE],
            write_idx: 0,
            filter_state_l: 0.0,
            filter_state_r: 0.0,
            target_speed: 0.25,
            current_speed: 0.25,
            target_intensity: 0.8,
            current_intensity: 0.8,
            target_enabled: 0.0,
            current_enabled: 0.0,
            smooth_alpha,
        }
    }

    /// Sets the target rotation speed in Hz (e.g. 0.25 Hz = 1 revolution per 4 seconds).
    #[inline]
    pub fn set_speed(&mut self, speed_hz: f32) {
        self.target_speed = speed_hz.clamp(0.01, 5.0);
    }

    /// Sets the target spatial intensity (0.0 to 1.0).
    #[inline]
    pub fn set_intensity(&mut self, intensity: f32) {
        self.target_intensity = intensity.clamp(0.0, 1.0);
    }

    /// Sets enabled state with smooth crossfading.
    #[inline]
    pub fn set_enabled(&mut self, enabled: bool) {
        self.target_enabled = if enabled { 1.0 } else { 0.0 };
    }

    /// Returns the current LFO azimuth angle in radians [0, 2*PI).
    #[inline]
    pub fn current_azimuth(&self) -> f32 {
        self.phase
    }

    /// Resets the LFO phase to a given angle (or 0.0).
    pub fn set_phase(&mut self, phase: f32) {
        self.phase = phase.rem_euclid(TWO_PI);
    }

    /// Processes a single stereo frame (in_l, in_r) through the 8D spatializer.
    ///
    /// Inputs:
    /// - `in_l`, `in_r`: Dry input stereo samples
    ///
    /// Outputs:
    /// - `(out_l, out_r)`: 8D spatialized stereo samples
    ///
    /// Invariants:
    /// - Zero allocations.
    /// - When `current_enabled == 0.0`, output is bit-exact to input.
    pub fn process_sample(&mut self, in_l: f32, in_r: f32) -> (f32, f32) {
        // 1. Update parameter smoothers (1-pole lowpass)
        self.current_speed += self.smooth_alpha * (self.target_speed - self.current_speed);
        self.current_intensity += self.smooth_alpha * (self.target_intensity - self.current_intensity);
        self.current_enabled += self.smooth_alpha * (self.target_enabled - self.current_enabled);

        // Fast path: if completely disabled and faded out, pass through dry signal
        if self.current_enabled < 0.0001 && self.target_enabled == 0.0 {
            return (in_l, in_r);
        }

        // 2. Advance LFO phase
        let phase_step = TWO_PI * self.current_speed / self.sample_rate;
        self.phase = (self.phase + phase_step).rem_euclid(TWO_PI);
        let theta = self.phase; // 0 = Front, PI/2 = Right, PI = Back, 3*PI/2 = Left

        // 3. Write input samples to circular delay lines
        self.delay_line_l[self.write_idx] = in_l;
        self.delay_line_r[self.write_idx] = in_r;

        // 4. Equal-Power Pan Law: Circular trajectory
        // Sound source angle theta:
        // When theta = 0 (Front): L = R = sqrt(0.5)
        // When theta = PI/2 (Right): L = 0.2, R = 1.0
        // When theta = PI (Back): L = R = sqrt(0.5) * 0.85 (slight rear attenuation)
        // When theta = 3*PI/2 (Left): L = 1.0, R = 0.2
        let sin_theta = theta.sin(); // -1 (left) to +1 (right)
        let cos_theta = theta.cos(); // +1 (front) to -1 (back)

        // Base panning gains with equal-power balance
        // sin_theta in [-1, 1] mapped to pan angle
        let pan_norm = (sin_theta + 1.0) * 0.5; // 0.0 (full left) to 1.0 (full right)
        let pan_angle = pan_norm * (PI * 0.5);
        let mut gain_l = (PI * 0.5 - pan_angle).sin();
        let mut gain_r = pan_angle.sin();

        // Rear attenuation (front-back cue: sound behind head is slightly darker and softer)
        if cos_theta < 0.0 {
            let rear_factor = 1.0 + cos_theta * 0.15; // Dips to ~0.85 at full back
            gain_l *= rear_factor;
            gain_r *= rear_factor;
        }

        // 5. Interaural Time Difference (ITD) - Woodworth Model
        // Max delay: ~0.26ms * sample_rate (approx 12-13 samples at 48kHz)
        // Head radius r = 0.0875m, speed of sound c = 343 m/s
        let max_itd_samples = (0.0875 / 343.0) * self.sample_rate;
        let abs_sin = sin_theta.abs();
        let itd_delay_samples = abs_sin * max_itd_samples;

        // If sound is to the right (sin_theta > 0), Left ear is delayed
        // If sound is to the left (sin_theta < 0), Right ear is delayed
        let delay_l = if sin_theta > 0.0 { itd_delay_samples } else { 0.0 };
        let delay_r = if sin_theta < 0.0 { itd_delay_samples } else { 0.0 };

        let sample_l = self.read_delay_interpolated(&self.delay_line_l, delay_l);
        let sample_r = self.read_delay_interpolated(&self.delay_line_r, delay_r);

        // 6. Interaural Level Difference (ILD) & Head-Shadow Filter
        // Far ear gets filtered with a 1-pole low-pass filter
        // Shadow cutoff lowers as source moves further to the opposite side
        let shadow_coef_l = if sin_theta > 0.0 { (sin_theta * 0.35).clamp(0.0, 0.6) } else { 0.0 };
        let shadow_coef_r = if sin_theta < 0.0 { (-sin_theta * 0.35).clamp(0.0, 0.6) } else { 0.0 };

        self.filter_state_l += (1.0 - shadow_coef_l) * (sample_l - self.filter_state_l);
        self.filter_state_r += (1.0 - shadow_coef_r) * (sample_r - self.filter_state_r);

        let filtered_l = self.filter_state_l * gain_l;
        let filtered_r = self.filter_state_r * gain_r;

        // 7. Advance circular write pointer
        self.write_idx = (self.write_idx + 1) & DELAY_MASK;

        // 8. Blend Wet / Dry using intensity and enabled crossfade
        let wet_factor = self.current_enabled * self.current_intensity;
        let out_l = in_l + wet_factor * (filtered_l - in_l);
        let out_r = in_r + wet_factor * (filtered_r - in_r);

        (out_l, out_r)
    }

    /// Reads from a circular delay buffer with fractional linear interpolation.
    #[inline]
    fn read_delay_interpolated(&self, buffer: &[f32; DELAY_LINE_SIZE], delay: f32) -> f32 {
        let delay_int = delay.floor() as usize;
        let frac = delay - delay.floor();

        let idx0 = (self.write_idx + DELAY_LINE_SIZE - delay_int) & DELAY_MASK;
        let idx1 = (idx0 + DELAY_LINE_SIZE - 1) & DELAY_MASK;

        let s0 = buffer[idx0];
        let s1 = buffer[idx1];

        s0 + frac * (s1 - s0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_panner_bypass_when_disabled() {
        let mut panner = Panner::new(48000.0);
        panner.set_enabled(false);

        // Advance 100 samples to settle any initial ramps
        for _ in 0..100 {
            let (l, r) = panner.process_sample(0.5, -0.5);
            assert!((l - 0.5).abs() < 1e-4);
            assert!((r - (-0.5)).abs() < 1e-4);
        }
    }

    #[test]
    fn test_panner_stability_and_bounds() {
        let mut panner = Panner::new(48000.0);
        panner.set_enabled(true);
        panner.set_speed(1.0);
        panner.set_intensity(1.0);

        // Process 48000 samples (1 full second = 1 full revolution)
        for i in 0..48000 {
            let in_val = (i as f32 * 0.01).sin();
            let (l, r) = panner.process_sample(in_val, in_val);

            // Output must remain stable, non-NaN, and within finite bounds
            assert!(!l.is_nan() && !r.is_nan());
            assert!(l.abs() <= 2.0);
            assert!(r.abs() <= 2.0);
        }
    }
}

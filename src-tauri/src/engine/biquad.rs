use std::f32::consts::PI;

/// 2nd-order IIR Biquad filter coefficients normalized by `a0`.
///
/// Transfer function:
///   H(z) = (b0 + b1*z^-1 + b2*z^-2) / (1 + a1*z^-1 + a2*z^-2)
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct BiquadCoeffs {
    pub b0: f32,
    pub b1: f32,
    pub b2: f32,
    pub a1: f32,
    pub a2: f32,
}

impl Default for BiquadCoeffs {
    fn default() -> Self {
        Self::identity()
    }
}

impl BiquadCoeffs {
    /// Returns pass-through (identity) coefficients where H(z) = 1.0.
    #[inline]
    pub const fn identity() -> Self {
        Self {
            b0: 1.0,
            b1: 0.0,
            b2: 0.0,
            a1: 0.0,
            a2: 0.0,
        }
    }

    /// Checks whether the filter is strictly stable (poles inside the unit circle).
    ///
    /// Stability condition for 2nd order polynomial 1 + a1*z^-1 + a2*z^-2:
    ///   |a2| < 1.0  and  |a1| < 1.0 + a2
    #[inline]
    pub fn is_stable(&self) -> bool {
        self.a2.abs() < 1.0 && self.a1.abs() < (1.0 + self.a2)
    }

    /// Computes Butterworth 2nd-order High-Pass Filter (Low Cut) coefficients.
    ///
    /// Inputs:
    /// - `sample_rate`: Audio hardware sample rate in Hz (> 0.0)
    /// - `freq_hz`: Cutoff frequency in Hz
    ///
    /// Outputs:
    /// - `BiquadCoeffs` normalized high-pass coefficients
    ///
    /// Invariants:
    /// - Frequency clamped between 10.0 Hz and Nyquist * 0.98.
    /// - Filter is unconditionally stable (|a2| < 1, |a1| < 1 + a2).
    pub fn low_cut(sample_rate: f32, freq_hz: f32) -> Self {
        if sample_rate <= 0.0 {
            return Self::identity();
        }

        let max_f = (sample_rate * 0.49).max(100.0);
        let f0 = freq_hz.clamp(10.0, max_f);

        // Standard Butterworth Q = 1 / sqrt(2)
        let q = std::f32::consts::FRAC_1_SQRT_2;
        let w0 = 2.0 * PI * f0 / sample_rate;
        let alpha = w0.sin() / (2.0 * q);
        let cos_w = w0.cos();

        let b0 = (1.0 + cos_w) * 0.5;
        let b1 = -(1.0 + cos_w);
        let b2 = (1.0 + cos_w) * 0.5;
        let a0 = 1.0 + alpha;
        let a1 = -2.0 * cos_w;
        let a2 = 1.0 - alpha;

        let inv_a0 = 1.0 / a0;
        Self {
            b0: b0 * inv_a0,
            b1: b1 * inv_a0,
            b2: b2 * inv_a0,
            a1: a1 * inv_a0,
            a2: a2 * inv_a0,
        }
    }

    /// Computes Butterworth 2nd-order Low-Pass Filter (High Cut) coefficients.
    ///
    /// Inputs:
    /// - `sample_rate`: Audio hardware sample rate in Hz (> 0.0)
    /// - `freq_hz`: Cutoff frequency in Hz
    ///
    /// Outputs:
    /// - `BiquadCoeffs` normalized low-pass coefficients
    ///
    /// Invariants:
    /// - If cutoff is at or above 20 kHz (or >= Nyquist * 0.95), returns identity bypass.
    /// - Filter is unconditionally stable.
    pub fn high_cut(sample_rate: f32, freq_hz: f32) -> Self {
        if sample_rate <= 0.0 {
            return Self::identity();
        }

        let max_f = sample_rate * 0.48;
        if freq_hz >= 19990.0 || freq_hz >= max_f {
            return Self::identity();
        }

        let f0 = freq_hz.clamp(200.0, max_f);
        let q = std::f32::consts::FRAC_1_SQRT_2;
        let w0 = 2.0 * PI * f0 / sample_rate;
        let alpha = w0.sin() / (2.0 * q);
        let cos_w = w0.cos();

        let b0 = (1.0 - cos_w) * 0.5;
        let b1 = 1.0 - cos_w;
        let b2 = (1.0 - cos_w) * 0.5;
        let a0 = 1.0 + alpha;
        let a1 = -2.0 * cos_w;
        let a2 = 1.0 - alpha;

        let inv_a0 = 1.0 / a0;
        Self {
            b0: b0 * inv_a0,
            b1: b1 * inv_a0,
            b2: b2 * inv_a0,
            a1: a1 * inv_a0,
            a2: a2 * inv_a0,
        }
    }

    /// Computes Low-Shelf (Bass Boost / Cut) filter coefficients.
    ///
    /// Inputs:
    /// - `sample_rate`: Sample rate in Hz (> 0.0)
    /// - `freq_hz`: Corner frequency in Hz (typically ~100 Hz)
    /// - `gain_db`: Gain in decibels (-12.0 to +12.0 dB)
    ///
    /// Outputs:
    /// - `BiquadCoeffs` normalized low-shelf coefficients
    ///
    /// Invariants:
    /// - If `gain_db` is negligible (< 0.01 dB), returns identity bypass.
    /// - Filter is unconditionally stable.
    pub fn bass_shelf(sample_rate: f32, freq_hz: f32, gain_db: f32) -> Self {
        if sample_rate <= 0.0 || gain_db.abs() < 0.01 {
            return Self::identity();
        }

        let clamped_db = gain_db.clamp(-12.0, 12.0);
        let a_amp = 10.0_f32.powf(clamped_db / 40.0);
        let f0 = freq_hz.clamp(20.0, sample_rate * 0.45);

        let w0 = 2.0 * PI * f0 / sample_rate;
        let cos_w = w0.cos();
        let sin_w = w0.sin();
        let beta = sin_w * (2.0 * a_amp).sqrt();

        let a_plus = a_amp + 1.0;
        let a_minus = a_amp - 1.0;

        let b0 = a_amp * (a_plus - a_minus * cos_w + beta);
        let b1 = 2.0 * a_amp * (a_minus - a_plus * cos_w);
        let b2 = a_amp * (a_plus - a_minus * cos_w - beta);
        let a0 = a_plus + a_minus * cos_w + beta;
        let a1 = -2.0 * (a_minus + a_plus * cos_w);
        let a2 = a_plus + a_minus * cos_w - beta;

        let inv_a0 = 1.0 / a0;
        Self {
            b0: b0 * inv_a0,
            b1: b1 * inv_a0,
            b2: b2 * inv_a0,
            a1: a1 * inv_a0,
            a2: a2 * inv_a0,
        }
    }

    /// Computes High-Shelf (Treble Boost / Cut) filter coefficients.
    ///
    /// Inputs:
    /// - `sample_rate`: Sample rate in Hz (> 0.0)
    /// - `freq_hz`: Corner frequency in Hz (typically ~10000 Hz)
    /// - `gain_db`: Gain in decibels (-12.0 to +12.0 dB)
    ///
    /// Outputs:
    /// - `BiquadCoeffs` normalized high-shelf coefficients
    ///
    /// Invariants:
    /// - If `gain_db` is negligible (< 0.01 dB), returns identity bypass.
    /// - Filter is unconditionally stable.
    pub fn treble_shelf(sample_rate: f32, freq_hz: f32, gain_db: f32) -> Self {
        if sample_rate <= 0.0 || gain_db.abs() < 0.01 {
            return Self::identity();
        }

        let clamped_db = gain_db.clamp(-12.0, 12.0);
        let a_amp = 10.0_f32.powf(clamped_db / 40.0);
        let f0 = freq_hz.clamp(1000.0, sample_rate * 0.48);

        let w0 = 2.0 * PI * f0 / sample_rate;
        let cos_w = w0.cos();
        let sin_w = w0.sin();
        let beta = sin_w * (2.0 * a_amp).sqrt();

        let a_plus = a_amp + 1.0;
        let a_minus = a_amp - 1.0;

        let b0 = a_amp * (a_plus + a_minus * cos_w + beta);
        let b1 = -2.0 * a_amp * (a_minus + a_plus * cos_w);
        let b2 = a_amp * (a_plus + a_minus * cos_w - beta);
        let a0 = a_plus - a_minus * cos_w + beta;
        let a1 = 2.0 * (a_minus - a_plus * cos_w);
        let a2 = a_plus - a_minus * cos_w - beta;

        let inv_a0 = 1.0 / a0;
        Self {
            b0: b0 * inv_a0,
            b1: b1 * inv_a0,
            b2: b2 * inv_a0,
            a1: a1 * inv_a0,
            a2: a2 * inv_a0,
        }
    }
}

/// Direct Form II Transposed Stereo Biquad Filter.
///
/// Invariants:
/// - Zero dynamic allocations.
/// - Operates on interleaved stereo samples (in_l, in_r).
#[derive(Debug, Clone)]
pub struct StereoBiquad {
    pub coeffs: BiquadCoeffs,
    // Delay states for Left channel
    s1_l: f32,
    s2_l: f32,
    // Delay states for Right channel
    s1_r: f32,
    s2_r: f32,
}

impl StereoBiquad {
    /// Creates a new `StereoBiquad` with initial coefficients and cleared delay registers.
    pub fn new(coeffs: BiquadCoeffs) -> Self {
        Self {
            coeffs,
            s1_l: 0.0,
            s2_l: 0.0,
            s1_r: 0.0,
            s2_r: 0.0,
        }
    }

    /// Resets internal delay registers to zero (clearing filter memory).
    pub fn reset_state(&mut self) {
        self.s1_l = 0.0;
        self.s2_l = 0.0;
        self.s1_r = 0.0;
        self.s2_r = 0.0;
    }

    /// Processes a single stereo frame using Direct Form II Transposed.
    ///
    /// Inputs:
    /// - `in_l`, `in_r`: Stereo input samples
    ///
    /// Outputs:
    /// - `(out_l, out_r)`: Filtered stereo output samples
    ///
    /// Invariants:
    /// - Numerical stability guaranteed when coefficients are stable.
    /// - Zero allocations.
    #[inline]
    pub fn process_sample(&mut self, in_l: f32, in_r: f32) -> (f32, f32) {
        let b0 = self.coeffs.b0;
        let b1 = self.coeffs.b1;
        let b2 = self.coeffs.b2;
        let a1 = self.coeffs.a1;
        let a2 = self.coeffs.a2;

        // Left Channel DF2T
        let out_l = b0 * in_l + self.s1_l;
        self.s1_l = b1 * in_l - a1 * out_l + self.s2_l;
        self.s2_l = b2 * in_l - a2 * out_l;

        // Right Channel DF2T
        let out_r = b0 * in_r + self.s1_r;
        self.s1_r = b1 * in_r - a1 * out_r + self.s2_r;
        self.s2_r = b2 * in_r - a2 * out_r;

        (out_l, out_r)
    }
}

/// Dual-state crossfading stereo biquad filter.
///
/// Prevents audible clicks and pops when coefficients change live during playback
/// by running the old and target filters concurrently over a 128-sample (~2.6ms) crossfade.
///
/// Invariants:
/// - Zero dynamic allocations.
/// - Constant CPU profile.
#[derive(Debug, Clone)]
pub struct CrossfadingBiquad {
    current: StereoBiquad,
    target: StereoBiquad,
    fade_pos: usize,
    fade_len: usize,
    is_fading: bool,
}

impl CrossfadingBiquad {
    /// Creates a crossfading biquad with initial coefficients and standard 128-sample fade length.
    pub fn new(coeffs: BiquadCoeffs) -> Self {
        Self {
            current: StereoBiquad::new(coeffs),
            target: StereoBiquad::new(coeffs),
            fade_pos: 0,
            fade_len: 128,
            is_fading: false,
        }
    }

    /// Sets new target coefficients. If coefficients differ from active filter, initiates a smooth crossfade.
    ///
    /// Inputs:
    /// - `new_coeffs`: New `BiquadCoeffs`
    ///
    /// Invariants:
    /// - Does not retrigger crossfade if target coefficients match.
    /// - Copies current state registers to target to prevent transient DC offset.
    pub fn set_coeffs(&mut self, new_coeffs: BiquadCoeffs) {
        if self.current.coeffs == new_coeffs && !self.is_fading {
            return;
        }

        // Setup target filter with new coefficients, initialized with current state
        self.target.coeffs = new_coeffs;
        self.target.s1_l = self.current.s1_l;
        self.target.s2_l = self.current.s2_l;
        self.target.s1_r = self.current.s1_r;
        self.target.s2_r = self.current.s2_r;

        self.fade_pos = 0;
        self.is_fading = true;
    }

    /// Processes a single stereo frame with smooth dual-state crossfade during parameter transitions.
    ///
    /// Inputs:
    /// - `in_l`, `in_r`: Input samples
    ///
    /// Outputs:
    /// - `(out_l, out_r)`: Filtered output samples
    ///
    /// Invariants:
    /// - Zero allocations.
    /// - Discontinuity-free across coefficient swaps.
    #[inline]
    pub fn process_sample(&mut self, in_l: f32, in_r: f32) -> (f32, f32) {
        if !self.is_fading {
            return self.current.process_sample(in_l, in_r);
        }

        let (cur_l, cur_r) = self.current.process_sample(in_l, in_r);
        let (tgt_l, tgt_r) = self.target.process_sample(in_l, in_r);

        self.fade_pos += 1;
        let alpha = self.fade_pos as f32 / self.fade_len as f32;

        let out_l = (1.0 - alpha) * cur_l + alpha * tgt_l;
        let out_r = (1.0 - alpha) * cur_r + alpha * tgt_r;

        if self.fade_pos >= self.fade_len {
            self.current.coeffs = self.target.coeffs;
            self.current.s1_l = self.target.s1_l;
            self.current.s2_l = self.target.s2_l;
            self.current.s1_r = self.target.s1_r;
            self.current.s2_r = self.target.s2_r;
            self.is_fading = false;
        }

        (out_l, out_r)
    }

    /// Returns current active filter coefficients.
    pub fn current_coeffs(&self) -> BiquadCoeffs {
        self.current.coeffs
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_identity_filter() {
        let mut filter = StereoBiquad::new(BiquadCoeffs::identity());
        let (out_l, out_r) = filter.process_sample(0.75, -0.25);
        assert!((out_l - 0.75).abs() < 1e-6);
        assert!((out_r - -0.25).abs() < 1e-6);
    }

    #[test]
    fn test_filter_stability_invariants() {
        let sr = 48000.0;
        // Test high-pass across ranges
        for f in [20.0, 80.0, 250.0, 500.0] {
            let coeffs = BiquadCoeffs::low_cut(sr, f);
            assert!(coeffs.is_stable(), "Low cut at {f} Hz must be stable");
        }
        // Test low-pass across ranges
        for f in [2000.0, 5000.0, 12000.0, 18000.0] {
            let coeffs = BiquadCoeffs::high_cut(sr, f);
            assert!(coeffs.is_stable(), "High cut at {f} Hz must be stable");
        }
        // Test shelves across gain ranges
        for g in [-12.0, -6.0, 0.0, 6.0, 12.0] {
            let bass = BiquadCoeffs::bass_shelf(sr, 100.0, g);
            assert!(bass.is_stable(), "Bass shelf at {g} dB must be stable");
            let treble = BiquadCoeffs::treble_shelf(sr, 10000.0, g);
            assert!(treble.is_stable(), "Treble shelf at {g} dB must be stable");
        }
    }

    #[test]
    fn test_crossfader_completes_smoothly() {
        let mut xfade = CrossfadingBiquad::new(BiquadCoeffs::identity());
        let new_coeffs = BiquadCoeffs::bass_shelf(48000.0, 100.0, 6.0);
        xfade.set_coeffs(new_coeffs);

        assert!(xfade.is_fading);

        // Process 128 samples to finish the crossfade
        for _ in 0..128 {
            let _ = xfade.process_sample(0.5, 0.5);
        }

        assert!(!xfade.is_fading);
        assert_eq!(xfade.current_coeffs(), new_coeffs);
    }
}

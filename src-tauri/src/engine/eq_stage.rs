use crate::engine::biquad::{BiquadCoeffs, CrossfadingBiquad};

/// 4-Band cascaded parametric EQ stage with smoothed master gain.
///
/// Order of processing:
///   Input -> Low Cut (HPF) -> Bass Shelf -> Treble Shelf -> High Cut (LPF) -> Smoothed Volume -> Output
///
/// Invariants:
/// - Zero dynamic allocations in `process_sample`.
/// - 100% click-free coefficient updates via dual-state crossfading (128 samples).
/// - Smoothed volume transitions via 1-pole exponential smoother (~25ms).
#[derive(Debug, Clone)]
pub struct EqStage {
    sample_rate: f32,
    low_cut: CrossfadingBiquad,
    high_cut: CrossfadingBiquad,
    bass_shelf: CrossfadingBiquad,
    treble_shelf: CrossfadingBiquad,

    // Volume smoother (1-pole lowpass)
    target_volume: f32,
    current_volume: f32,
    volume_smooth_alpha: f32,
}

impl EqStage {
    /// Creates a new `EqStage` at the specified audio hardware sample rate.
    ///
    /// Inputs:
    /// - `sample_rate`: Hardware audio sample rate in Hz (e.g. 44100.0, 48000.0)
    ///
    /// Invariants:
    /// - Starts with default bypass/neutral EQ settings and unity volume (1.0).
    pub fn new(sample_rate: f32) -> Self {
        let sr = if sample_rate <= 0.0 { 44100.0 } else { sample_rate };
        let default_low = BiquadCoeffs::low_cut(sr, 20.0);
        let default_high = BiquadCoeffs::high_cut(sr, 20000.0);
        let default_bass = BiquadCoeffs::bass_shelf(sr, 100.0, 0.0);
        let default_treble = BiquadCoeffs::treble_shelf(sr, 10000.0, 0.0);

        // 25ms smoothing time constant for volume slider
        let smoothing_sec = 0.025_f32;
        let volume_smooth_alpha = 1.0 - (-1.0 / (smoothing_sec * sr)).exp();

        Self {
            sample_rate: sr,
            low_cut: CrossfadingBiquad::new(default_low),
            high_cut: CrossfadingBiquad::new(default_high),
            bass_shelf: CrossfadingBiquad::new(default_bass),
            treble_shelf: CrossfadingBiquad::new(default_treble),
            target_volume: 1.0,
            current_volume: 1.0,
            volume_smooth_alpha,
        }
    }

    /// Sets new target coefficients for all 4 cascaded biquads with click-free crossfade.
    ///
    /// Inputs:
    /// - `low_cut`, `high_cut`, `bass`, `treble`: Computed `BiquadCoeffs`
    #[inline]
    pub fn set_coefficients(
        &mut self,
        low_cut: BiquadCoeffs,
        high_cut: BiquadCoeffs,
        bass: BiquadCoeffs,
        treble: BiquadCoeffs,
    ) {
        self.low_cut.set_coeffs(low_cut);
        self.high_cut.set_coeffs(high_cut);
        self.bass_shelf.set_coeffs(bass);
        self.treble_shelf.set_coeffs(treble);
    }

    /// Sets the target linear master volume (0.0 to 2.0 = 0% to 200%).
    #[inline]
    pub fn set_target_volume(&mut self, volume: f32) {
        self.target_volume = volume.clamp(0.0, 2.0);
    }

    /// Processes a single stereo frame through the EQ cascade and volume stage.
    ///
    /// Inputs:
    /// - `in_l`, `in_r`: Dry or panned stereo input samples
    ///
    /// Outputs:
    /// - `(out_l, out_r)`: EQ-filtered and gain-adjusted stereo samples
    ///
    /// Invariants:
    /// - Zero allocations.
    /// - Free of discontinuities and pops.
    #[inline]
    pub fn process_sample(&mut self, in_l: f32, in_r: f32) -> (f32, f32) {
        // 1. Low Cut (High Pass)
        let (l1, r1) = self.low_cut.process_sample(in_l, in_r);

        // 2. Bass Shelf
        let (l2, r2) = self.bass_shelf.process_sample(l1, r1);

        // 3. Treble Shelf
        let (l3, r3) = self.treble_shelf.process_sample(l2, r2);

        // 4. High Cut (Low Pass)
        let (l4, r4) = self.high_cut.process_sample(l3, r3);

        // 5. Smoothed Volume
        self.current_volume += self.volume_smooth_alpha * (self.target_volume - self.current_volume);

        (l4 * self.current_volume, r4 * self.current_volume)
    }

    /// Returns sample rate of this EQ stage.
    pub fn sample_rate(&self) -> f32 {
        self.sample_rate
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_eq_cascade_unity_passthrough() {
        let mut eq = EqStage::new(48000.0);
        let (out_l, out_r) = eq.process_sample(0.5, -0.5);

        // With default 20Hz HPF and 20kHz LPF, pass-through should be very close to input
        assert!((out_l - 0.5).abs() < 0.05);
        assert!((out_r - -0.5).abs() < 0.05);
    }

    #[test]
    fn test_volume_smoothing() {
        let mut eq = EqStage::new(48000.0);
        let id = BiquadCoeffs::identity();
        eq.set_coefficients(id, id, id, id);
        for _ in 0..128 {
            let _ = eq.process_sample(1.0, 1.0);
        }

        eq.set_target_volume(0.0);

        // Smoothly ramps down toward 0.0 without instantaneous jump
        // 25ms at 48kHz = 1200 samples for 1 time constant (decay to ~0.37)
        let mut prev = 1.0;
        for _ in 0..2000 {
            let (out_l, _) = eq.process_sample(1.0, 1.0);
            assert!(out_l <= prev + 1e-6);
            prev = out_l;
        }
        assert!(prev < 0.5);
    }
}

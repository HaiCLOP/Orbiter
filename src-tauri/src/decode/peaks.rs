use crate::models::WaveformPeaks;

/// Computes downsampled stereo min/max peak envelopes from interleaved audio samples.
///
/// Inputs:
/// - `samples`: Interleaved stereo f32 PCM samples (`[L0, R0, L1, R1, ...]`).
/// - `channels`: Channel count (expected 2).
/// - `num_bins`: Desired visual resolution (number of horizontal columns/bins).
///
/// Outputs:
/// - `WaveformPeaks` containing discrete L and R envelopes.
///
/// Invariants:
/// - All peak arrays (`min_peaks_l`, `max_peaks_l`, `min_peaks_r`, `max_peaks_r`) have length equal to `num_bins` (or `actual_bins`).
/// - For each bin `i`, `min_peaks_l[i] <= max_peaks_l[i]` and `min_peaks_r[i] <= max_peaks_r[i]`.
/// - Every value is bounded within `[-1.0, 1.0]`.
pub fn generate_waveform_peaks(samples: &[f32], channels: u16, num_bins: usize) -> WaveformPeaks {
    let ch = channels.max(1) as usize;
    let total_frames = samples.len() / ch;

    if total_frames == 0 || num_bins == 0 {
        return WaveformPeaks {
            min_peaks_l: Vec::new(),
            max_peaks_l: Vec::new(),
            min_peaks_r: Vec::new(),
            max_peaks_r: Vec::new(),
            num_bins: 0,
        };
    }

    let actual_bins = num_bins.min(total_frames);
    let frames_per_bin = total_frames as f64 / actual_bins as f64;

    let mut min_peaks_l = Vec::with_capacity(actual_bins);
    let mut max_peaks_l = Vec::with_capacity(actual_bins);
    let mut min_peaks_r = Vec::with_capacity(actual_bins);
    let mut max_peaks_r = Vec::with_capacity(actual_bins);

    for bin_idx in 0..actual_bins {
        let start_frame = (bin_idx as f64 * frames_per_bin) as usize;
        let end_frame = (((bin_idx + 1) as f64 * frames_per_bin) as usize).min(total_frames);

        let mut min_l = 1.0f32;
        let mut max_l = -1.0f32;
        let mut min_r = 1.0f32;
        let mut max_r = -1.0f32;

        if start_frame >= end_frame {
            let f = start_frame.min(total_frames - 1);
            let idx = f * ch;
            let l = samples[idx];
            let r = if ch > 1 { samples[idx + 1] } else { l };
            min_l = l;
            max_l = l;
            min_r = r;
            max_r = r;
        } else {
            for f in start_frame..end_frame {
                let idx = f * ch;
                let l = samples[idx];
                let r = if ch > 1 { samples[idx + 1] } else { l };

                if l < min_l { min_l = l; }
                if l > max_l { max_l = l; }
                if r < min_r { min_r = r; }
                if r > max_r { max_r = r; }
            }
        }

        min_peaks_l.push(min_l.clamp(-1.0, 1.0));
        max_peaks_l.push(max_l.clamp(-1.0, 1.0));
        min_peaks_r.push(min_r.clamp(-1.0, 1.0));
        max_peaks_r.push(max_r.clamp(-1.0, 1.0));
    }

    // Verify postconditions
    debug_assert_eq!(min_peaks_l.len(), actual_bins);
    debug_assert_eq!(max_peaks_l.len(), actual_bins);
    debug_assert_eq!(min_peaks_r.len(), actual_bins);
    debug_assert_eq!(max_peaks_r.len(), actual_bins);

    WaveformPeaks {
        min_peaks_l,
        max_peaks_l,
        min_peaks_r,
        max_peaks_r,
        num_bins: actual_bins,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_empty_interleaved_samples() {
        let peaks = generate_waveform_peaks(&[], 2, 100);
        assert_eq!(peaks.num_bins, 0);
        assert!(peaks.min_peaks_l.is_empty());
    }

    #[test]
    fn test_interleaved_peak_invariants() {
        // 4 stereo frames: [L0, R0, L1, R1, L2, R2, L3, R3]
        let samples = vec![
            -0.5, 0.2,   // Frame 0
             0.8, -0.9,  // Frame 1
             0.1, -0.4,  // Frame 2
             0.7, -0.1,  // Frame 3
        ];

        let peaks = generate_waveform_peaks(&samples, 2, 2);
        assert_eq!(peaks.num_bins, 2);
        assert_eq!(peaks.min_peaks_l.len(), 2);
        assert_eq!(peaks.max_peaks_l.len(), 2);
        assert_eq!(peaks.min_peaks_r.len(), 2);
        assert_eq!(peaks.max_peaks_r.len(), 2);

        for i in 0..2 {
            assert!(peaks.min_peaks_l[i] <= peaks.max_peaks_l[i]);
            assert!(peaks.min_peaks_r[i] <= peaks.max_peaks_r[i]);
            assert!(peaks.min_peaks_l[i] >= -1.0 && peaks.min_peaks_l[i] <= 1.0);
            assert!(peaks.max_peaks_l[i] >= -1.0 && peaks.max_peaks_l[i] <= 1.0);
        }
    }
}

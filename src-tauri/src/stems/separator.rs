use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Instant;

use hound::{SampleFormat, WavSpec, WavWriter};
use ndarray::Array3;
use ort::session::builder::GraphOptimizationLevel;
use ort::session::Session;
use ort::value::TensorRef;
use tauri::{AppHandle, Emitter};

use crate::decode::generate_waveform_peaks;
use crate::models::AudioBuffer;
use crate::stems::downloader::get_model_path;
use crate::stems::{
    SeparatedStemInfo, StemSeparationProgress, StemSeparationResult, StemSeparationSettings,
};

/// Demucs native sample rate
pub const DEMUCS_SAMPLE_RATE: u32 = 44100;
/// Demucs standard chunk segment length (~7.8s at 44.1kHz)
pub const CHUNK_LENGTH: usize = 343_980;
/// Hop size with 25% overlap
pub const HOP_SIZE: usize = 257_985;
/// Overlap length (343980 - 257985 = 85995 samples)
pub const OVERLAP_LENGTH: usize = CHUNK_LENGTH - HOP_SIZE;

/// Linear crossfade overlap-add blender.
/// Reconstructs overlapping chunk segments with continuous first derivative and unity sum.
pub fn apply_overlap_add(
    dest_l: &mut [f32],
    dest_r: &mut [f32],
    chunk_l: &[f32],
    chunk_r: &[f32],
    start_offset: usize,
    is_first_chunk: bool,
    is_last_chunk: bool,
) {
    let chunk_len = chunk_l.len();
    let overlap_len = OVERLAP_LENGTH.min(chunk_len);

    for i in 0..chunk_len {
        let dest_idx = start_offset + i;
        if dest_idx >= dest_l.len() {
            break;
        }

        let mut weight = 1.0f32;

        // Fade in on left overlap seam (if not the very first chunk)
        if !is_first_chunk && i < overlap_len {
            weight = i as f32 / overlap_len as f32;
        }

        // Fade out on right overlap seam (if not the very last chunk)
        if !is_last_chunk && i >= chunk_len - overlap_len {
            let fade_out_idx = chunk_len - i;
            let fade_weight = fade_out_idx as f32 / overlap_len as f32;
            weight = weight.min(fade_weight);
        }

        dest_l[dest_idx] += chunk_l[i] * weight;
        dest_r[dest_idx] += chunk_r[i] * weight;
    }
}

/// Linear resampler between two audio sample rates.
pub fn resample_stereo(
    input: &[f32],
    src_rate: f64,
    target_rate: f64,
) -> Vec<f32> {
    if (src_rate - target_rate).abs() < 1e-3 {
        return input.to_vec();
    }

    let src_frames = input.len() / 2;
    let target_frames = ((src_frames as f64 / src_rate) * target_rate).round() as usize;
    let rate_ratio = src_rate / target_rate;

    let mut output = Vec::with_capacity(target_frames * 2);
    for out_idx in 0..target_frames {
        let frac_src = out_idx as f64 * rate_ratio;
        let cur_idx = (frac_src.floor() as usize).min(src_frames - 1);
        let alpha = (frac_src - cur_idx as f64) as f32;
        let next_idx = (cur_idx + 1).min(src_frames - 1);

        let cur_l = input[cur_idx * 2];
        let cur_r = input[cur_idx * 2 + 1];
        let next_l = input[next_idx * 2];
        let next_r = input[next_idx * 2 + 1];

        output.push(cur_l + alpha * (next_l - cur_l));
        output.push(cur_r + alpha * (next_r - cur_r));
    }

    output
}

/// Executes Demucs v4 stem separation on an AudioBuffer in the background.
pub fn run_stem_separation(
    app: Option<&AppHandle>,
    buffer: Arc<AudioBuffer>,
    track_file_path: String,
    settings: StemSeparationSettings,
    cancel_flag: Arc<AtomicBool>,
) -> Result<StemSeparationResult, String> {
    let start_time = Instant::now();
    let model_path = get_model_path();

    if !model_path.exists() {
        return Err("Demucs model is not downloaded. Please download the model first.".to_string());
    }

    // 1. Initialize ONNX Runtime Session with multi-threaded AVX2 vectorization
    let env = ort::init()
        .with_name("orbiter")
        .build()
        .map_err(|e| format!("Failed to initialize ONNX environment: {e}"))?;

    let builder = Session::builder(&env).map_err(|e| format!("Failed to create ONNX builder: {e}"))?;
    let builder = builder
        .with_optimization_level(GraphOptimizationLevel::Level3)
        .map_err(|e| format!("Failed to set ONNX optimization: {e}"))?;

    let num_threads = std::thread::available_parallelism()
        .map(|n| n.get().min(8))
        .unwrap_or(4);
    let mut builder = builder
        .with_intra_threads(num_threads)
        .map_err(|e| format!("Failed to set ONNX threads: {e}"))?;

    let mut session = builder
        .commit_from_file(&model_path)
        .map_err(|e| format!("Failed to load ONNX model: {e}"))?;

    // 2. Resample to Demucs 44.1kHz
    if let Some(app) = app {
        let _ = app.emit(
            "stem-separation-progress",
            StemSeparationProgress {
                current_chunk: 0,
                total_chunks: 1,
                percentage: 0.05,
                elapsed_sec: start_time.elapsed().as_secs_f32(),
                eta_sec: 0.0,
                status: "resampling".into(),
                error: None,
            },
        );
    }

    let resampled_audio = resample_stereo(
        &buffer.samples,
        buffer.sample_rate as f64,
        DEMUCS_SAMPLE_RATE as f64,
    );
    let total_44k_frames = resampled_audio.len() / 2;

    // Deinterleave stereo channels
    let mut mix_l = Vec::with_capacity(total_44k_frames);
    let mut mix_r = Vec::with_capacity(total_44k_frames);
    for frame_idx in 0..total_44k_frames {
        mix_l.push(resampled_audio[frame_idx * 2]);
        mix_r.push(resampled_audio[frame_idx * 2 + 1]);
    }

    // 3. Allocate Output Buffers for the 4 Stems (Drums, Bass, Other, Vocals)
    let mut stems_l = vec![vec![0.0f32; total_44k_frames]; 4];
    let mut stems_r = vec![vec![0.0f32; total_44k_frames]; 4];

    // 4. Calculate Chunks
    let total_chunks = if total_44k_frames <= CHUNK_LENGTH {
        1
    } else {
        ((total_44k_frames - OVERLAP_LENGTH) as f64 / HOP_SIZE as f64).ceil() as usize
    };

    let mut chunk_tensor = Array3::<f32>::zeros((1, 2, CHUNK_LENGTH));

    // 5. Run Chunked Inference Loop
    for chunk_idx in 0..total_chunks {
        if cancel_flag.load(Ordering::Relaxed) {
            if let Some(app) = app {
                let _ = app.emit(
                    "stem-separation-progress",
                    StemSeparationProgress {
                        current_chunk: chunk_idx,
                        total_chunks,
                        percentage: (chunk_idx as f32 / total_chunks as f32),
                        elapsed_sec: start_time.elapsed().as_secs_f32(),
                        eta_sec: 0.0,
                        status: "cancelled".into(),
                        error: None,
                    },
                );
            }
            return Err("Stem separation cancelled by user".into());
        }

        let start_sample = chunk_idx * HOP_SIZE;
        let is_first = chunk_idx == 0;
        let is_last = chunk_idx == total_chunks - 1;

        // Fill chunk tensor with zero-padding at the tail
        chunk_tensor.fill(0.0);
        for i in 0..CHUNK_LENGTH {
            let src_idx = start_sample + i;
            if src_idx < total_44k_frames {
                chunk_tensor[[0, 0, i]] = mix_l[src_idx];
                chunk_tensor[[0, 1, i]] = mix_r[src_idx];
            }
        }

        // Run ONNX Session
        let input_tensor = TensorRef::from_array_view(chunk_tensor.view())
            .map_err(|e| format!("Failed to create ONNX tensor view: {e}"))?;

        let outputs = session
            .run(ort::inputs![input_tensor])
            .map_err(|e| format!("ONNX inference error at chunk {chunk_idx}: {e}"))?;

        // Extract output tensor [1, 4, 2, CHUNK_LENGTH]
        // 0: Drums, 1: Bass, 2: Other, 3: Vocals
        let (out_shape, out_data) = outputs[0]
            .try_extract_tensor::<f32>()
            .map_err(|e| format!("Failed to extract output tensor: {e}"))?;

        if out_shape.len() < 4 || out_shape[1] < 4 || out_shape[2] < 2 {
            return Err(format!("Unexpected Demucs output shape: {out_shape:?}"));
        }

        for stem_idx in 0..4 {
            let offset_l = (stem_idx * 2) * CHUNK_LENGTH;
            let offset_r = (stem_idx * 2 + 1) * CHUNK_LENGTH;

            let stem_slice_l = &out_data[offset_l..offset_l + CHUNK_LENGTH];
            let stem_slice_r = &out_data[offset_r..offset_r + CHUNK_LENGTH];

            apply_overlap_add(
                &mut stems_l[stem_idx],
                &mut stems_r[stem_idx],
                stem_slice_l,
                stem_slice_r,
                start_sample,
                is_first,
                is_last,
            );
        }

        // Emit Progress
        let elapsed_sec = start_time.elapsed().as_secs_f32();
        let progress = ((chunk_idx + 1) as f32 / total_chunks as f32).clamp(0.05, 0.95);
        let eta_sec = if progress > 0.05 {
            (elapsed_sec / progress) * (1.0 - progress)
        } else {
            0.0
        };

        if let Some(app) = app {
            let _ = app.emit(
                "stem-separation-progress",
                StemSeparationProgress {
                    current_chunk: chunk_idx + 1,
                    total_chunks,
                    percentage: progress,
                    elapsed_sec,
                    eta_sec,
                    status: "separating".into(),
                    error: None,
                },
            );
        }
    }

    // 6. Save Stems to Disk as 24-bit WAV files
    let track_path = Path::new(&track_file_path);
    let track_dir = track_path.parent().unwrap_or_else(|| Path::new("."));
    let track_stem_name = track_path
        .file_stem()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_else(|| "track".to_string());

    let output_dir: PathBuf = match settings.output_directory {
        Some(custom) if !custom.trim().is_empty() => PathBuf::from(custom),
        _ => track_dir.join(format!("{}_stems", track_stem_name)),
    };

    if !output_dir.exists() {
        std::fs::create_dir_all(&output_dir)
            .map_err(|e| format!("Failed to create stems folder: {e}"))?;
    }

    let stem_definitions = [
        ("drums", "Drums"),
        ("bass", "Bass"),
        ("other", "Other"),
        ("vocals", "Vocals"),
    ];

    let mut result_stems = Vec::with_capacity(4);

    for (stem_idx, (stem_id, stem_name)) in stem_definitions.iter().enumerate() {
        // Interleave stereo audio for this stem
        let mut interleaved_44k = Vec::with_capacity(total_44k_frames * 2);
        for frame_idx in 0..total_44k_frames {
            interleaved_44k.push(stems_l[stem_idx][frame_idx]);
            interleaved_44k.push(stems_r[stem_idx][frame_idx]);
        }

        // Resample back to original track sample rate
        let final_audio = resample_stereo(
            &interleaved_44k,
            DEMUCS_SAMPLE_RATE as f64,
            buffer.sample_rate as f64,
        );

        let stem_file_path = output_dir.join(format!("{}_{}.wav", track_stem_name, stem_id));
        let stem_path_str = stem_file_path.to_string_lossy().into_owned();

        // Write 24-bit PCM WAV
        let spec = WavSpec {
            channels: 2,
            sample_rate: buffer.sample_rate,
            bits_per_sample: 24,
            sample_format: SampleFormat::Int,
        };
        let mut writer = WavWriter::create(&stem_file_path, spec)
            .map_err(|e| format!("Failed to create stem WAV file: {e}"))?;

        for sample in &final_audio {
            let s_24 = (sample.clamp(-1.0, 1.0) * 8388607.0).round() as i32;
            writer
                .write_sample(s_24)
                .map_err(|e| format!("Failed to write stem sample: {e}"))?;
        }
        writer
            .finalize()
            .map_err(|e| format!("Failed to finalize stem WAV: {e}"))?;

        // Generate 500-bin waveform peaks for instant UI visualization
        let peaks_struct = generate_waveform_peaks(&final_audio, 2, 500);
        let mut combined_peaks = Vec::with_capacity(500);
        for i in 0..peaks_struct.max_peaks_l.len() {
            let max_val = peaks_struct.max_peaks_l[i].max(peaks_struct.max_peaks_r[i]);
            combined_peaks.push(max_val);
        }

        result_stems.push(SeparatedStemInfo {
            id: stem_id.to_string(),
            name: stem_name.to_string(),
            file_path: stem_path_str,
            duration: buffer.duration,
            sample_rate: buffer.sample_rate,
            peaks: combined_peaks,
        });
    }

    let elapsed_sec = start_time.elapsed().as_secs_f32();
    if let Some(app) = app {
        let _ = app.emit(
            "stem-separation-progress",
            StemSeparationProgress {
                current_chunk: total_chunks,
                total_chunks,
                percentage: 1.0,
                elapsed_sec,
                eta_sec: 0.0,
                status: "finished".into(),
                error: None,
            },
        );
    }

    log::info!(
        "Demucs stem separation finished in {:.2}s. 4 stems exported to {}",
        elapsed_sec,
        output_dir.display()
    );

    Ok(StemSeparationResult {
        stems: result_stems,
        elapsed_sec,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_demucs_overlap_add_reconstruction_click_free() {
        // Synthesize a continuous 440 Hz test tone across 3 chunks
        let total_frames = HOP_SIZE * 2 + CHUNK_LENGTH;
        let mut original_l = vec![0.0f32; total_frames];
        let mut original_r = vec![0.0f32; total_frames];

        for i in 0..total_frames {
            let t = i as f32 / DEMUCS_SAMPLE_RATE as f32;
            original_l[i] = (2.0 * std::f32::consts::PI * 440.0 * t).sin() * 0.8;
            original_r[i] = (2.0 * std::f32::consts::PI * 880.0 * t).sin() * 0.8;
        }

        let mut reconstructed_l = vec![0.0f32; total_frames];
        let mut reconstructed_r = vec![0.0f32; total_frames];

        let num_chunks = 3;
        for chunk_idx in 0..num_chunks {
            let start = chunk_idx * HOP_SIZE;
            let end = (start + CHUNK_LENGTH).min(total_frames);
            let chunk_l = &original_l[start..end];
            let chunk_r = &original_r[start..end];

            apply_overlap_add(
                &mut reconstructed_l,
                &mut reconstructed_r,
                chunk_l,
                chunk_r,
                start,
                chunk_idx == 0,
                chunk_idx == num_chunks - 1,
            );
        }

        // Verify that across all chunk overlap regions, reconstructed matches original
        let mut max_diff_l = 0.0f32;
        let mut max_diff_r = 0.0f32;

        for i in 0..total_frames {
            let diff_l = (original_l[i] - reconstructed_l[i]).abs();
            let diff_r = (original_r[i] - reconstructed_r[i]).abs();
            if diff_l > max_diff_l {
                max_diff_l = diff_l;
            }
            if diff_r > max_diff_r {
                max_diff_r = diff_r;
            }

            assert!(
                diff_l < 1e-4,
                "Seam artifact detected in Left channel at sample index {i}: original={}, reconstructed={}, diff={}",
                original_l[i],
                reconstructed_l[i],
                diff_l
            );
            assert!(
                diff_r < 1e-4,
                "Seam artifact detected in Right channel at sample index {i}: original={}, reconstructed={}, diff={}",
                original_r[i],
                reconstructed_r[i],
                diff_r
            );
        }

        assert!(
            max_diff_l < 1e-5,
            "Reconstruction must be click-free within floating point precision, got max diff {}",
            max_diff_l
        );
        assert!(
            max_diff_r < 1e-5,
            "Reconstruction must be click-free within floating point precision, got max diff {}",
            max_diff_r
        );
    }
}

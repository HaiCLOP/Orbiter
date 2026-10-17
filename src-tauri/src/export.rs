use std::fs::File;
use std::io::{BufWriter, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Instant;

use hound::{SampleFormat, WavSpec, WavWriter};
use mp3lame_encoder::{Builder, FlushNoGap, InterleavedPcm, Quality};
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

use crate::engine::SpatialDspChain;
use crate::models::{
    AudioBuffer, DspProjectState, ExportFormat, ExportProgress, ExportSettings,
    Mp3Bitrate, SampleRateOption, TimelineState, WavBitDepth,
};
use crate::timeline::PrecomputedTimeline;

/// Executes non-realtime offline export using the exact same `SpatialDspChain`
/// as live playback, writing to WAV or MP3.
pub fn run_offline_export(
    app: AppHandle,
    buffer: Arc<AudioBuffer>,
    dsp_state: DspProjectState,
    timeline: TimelineState,
    settings: ExportSettings,
    cancel_flag: Arc<AtomicBool>,
) -> Result<(), String> {
    let start_time = Instant::now();

    // 1. Resolve Target Sample Rate
    let target_sr = match settings.sample_rate_option {
        SampleRateOption::MatchSource => buffer.sample_rate as f32,
        SampleRateOption::Hz44100 => 44100.0,
        SampleRateOption::Hz48000 => 48000.0,
        SampleRateOption::Hz96000 => 96000.0,
    };

    // 2. Setup Destination and Temporary Atomic File
    let dest_path = PathBuf::from(&settings.destination_path);
    if let Some(parent) = dest_path.parent() {
        if !parent.exists() {
            std::fs::create_dir_all(parent).map_err(|e| format!("Failed to create parent folder: {e}"))?;
        }
    }

    let file_stem = dest_path
        .file_name()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_else(|| "export".to_string());
    let temp_name = format!("{}.tmp.{}", file_stem, Uuid::new_v4());
    let temp_path = dest_path.with_file_name(temp_name);

    // Helper to clean up temp file on error or cancel
    let cleanup_temp = |path: &Path| {
        let _ = std::fs::remove_file(path);
    };

    // 3. Initialize Shared DSP Chain with identical parameters
    let mut chain = SpatialDspChain::new(target_sr);
    chain.set_spatial_params(&dsp_state.spatial);
    chain.set_eq_params(target_sr, &dsp_state.eq);
    chain.set_reverb_params(&dsp_state.reverb);
    chain.set_dynamics_params(&dsp_state.dynamics);

    let target_norm_gain = if settings.normalize && dsp_state.dynamics.normalize_enabled {
        dsp_state.normalize_gain
    } else {
        1.0
    };

    let precomputed_timeline = PrecomputedTimeline::from_state(&timeline);

    // 4. Calculate Frame Counts and Lookahead Tail Padding
    let src_sr = buffer.sample_rate as f64;
    let target_sr_f64 = target_sr as f64;
    let src_frames = buffer.total_frames();
    if src_frames == 0 {
        return Err("Audio buffer is empty".to_string());
    }

    let total_out_frames = ((src_frames as f64 / src_sr) * target_sr_f64).round() as usize;
    let lookahead_samples = chain.lookahead_samples();
    let total_render_frames = total_out_frames + lookahead_samples;
    let rate_ratio = src_sr / target_sr_f64;

    // 5. Setup Encoder for chosen format
    enum OutputWriter {
        WavPcm16(WavWriter<BufWriter<File>>),
        WavPcm24(WavWriter<BufWriter<File>>),
        WavFloat32(WavWriter<BufWriter<File>>),
        Mp3 {
            encoder: mp3lame_encoder::Encoder,
            file: BufWriter<File>,
            chunk_buffer: Vec<f32>,
            mp3_out: Vec<u8>,
        },
    }

    let mut writer = match &settings.format {
        ExportFormat::Wav { bit_depth } => {
            let spec = match bit_depth {
                WavBitDepth::Pcm16 => WavSpec {
                    channels: 2,
                    sample_rate: target_sr as u32,
                    bits_per_sample: 16,
                    sample_format: SampleFormat::Int,
                },
                WavBitDepth::Pcm24 => WavSpec {
                    channels: 2,
                    sample_rate: target_sr as u32,
                    bits_per_sample: 24,
                    sample_format: SampleFormat::Int,
                },
                WavBitDepth::Float32 => WavSpec {
                    channels: 2,
                    sample_rate: target_sr as u32,
                    bits_per_sample: 32,
                    sample_format: SampleFormat::Float,
                },
            };
            let w = WavWriter::create(&temp_path, spec).map_err(|e| format!("Failed to create WAV file: {e}"))?;
            match bit_depth {
                WavBitDepth::Pcm16 => OutputWriter::WavPcm16(w),
                WavBitDepth::Pcm24 => OutputWriter::WavPcm24(w),
                WavBitDepth::Float32 => OutputWriter::WavFloat32(w),
            }
        }
        ExportFormat::Mp3 { bitrate } => {
            let lame_brate = match bitrate {
                Mp3Bitrate::Kbps128 => mp3lame_encoder::Bitrate::Kbps128,
                Mp3Bitrate::Kbps192 => mp3lame_encoder::Bitrate::Kbps192,
                Mp3Bitrate::Kbps256 => mp3lame_encoder::Bitrate::Kbps256,
                Mp3Bitrate::Kbps320 => mp3lame_encoder::Bitrate::Kbps320,
            };

            let encoder = Builder::new()
                .ok_or_else(|| "Failed to create LAME builder".to_string())?
                .with_num_channels(2)
                .map_err(|e| format!("Failed to set MP3 channels: {e:?}"))?
                .with_sample_rate(target_sr as u32)
                .map_err(|e| format!("Failed to set MP3 sample rate: {e:?}"))?
                .with_brate(lame_brate)
                .map_err(|e| format!("Failed to set MP3 bitrate: {e:?}"))?
                .with_quality(Quality::Best)
                .map_err(|e| format!("Failed to set MP3 quality: {e:?}"))?
                .build()
                .map_err(|e| format!("Failed to initialize LAME encoder: {e:?}"))?;

            let file = BufWriter::new(File::create(&temp_path).map_err(|e| format!("Failed to create MP3 file: {e}"))?);
            OutputWriter::Mp3 {
                encoder,
                file,
                chunk_buffer: Vec::with_capacity(4096),
                mp3_out: Vec::with_capacity(mp3lame_encoder::max_required_buffer_size(2048)),
            }
        }
    };

    // 6. Non-Realtime Processing Loop
    let mut frames_written = 0usize;
    let mut last_progress_emit = Instant::now();
    let manual_az = dsp_state.manual_azimuth;
    let manual_az_enabled = manual_az.is_some();
    let fallback_elev = dsp_state.spatial.elevation;
    let fallback_dist = dsp_state.spatial.distance;
    let fallback_rev = dsp_state.reverb.amount;
    let fallback_vol = dsp_state.eq.master_volume;
    let target_balance = dsp_state.balance;

    for render_idx in 0..total_render_frames {
        // Periodic cancellation check & progress update (every 4096 frames or ~50ms)
        if render_idx % 4096 == 0 {
            if cancel_flag.load(Ordering::Relaxed) {
                cleanup_temp(&temp_path);
                let _ = app.emit(
                    "export-progress",
                    ExportProgress {
                        progress: (frames_written as f32 / total_out_frames as f32).clamp(0.0, 1.0),
                        elapsed_sec: start_time.elapsed().as_secs_f32(),
                        eta_sec: 0.0,
                        current_frame: frames_written,
                        total_frames: total_out_frames,
                        status: "cancelled".into(),
                        error: None,
                    },
                );
                return Ok(());
            }

            if last_progress_emit.elapsed().as_millis() >= 50 {
                last_progress_emit = Instant::now();
                let progress = (frames_written as f32 / total_out_frames as f32).clamp(0.0, 1.0);
                let elapsed_sec = start_time.elapsed().as_secs_f32();
                let eta_sec = if progress > 0.005 {
                    (elapsed_sec / progress) * (1.0 - progress)
                } else {
                    0.0
                };

                let _ = app.emit(
                    "export-progress",
                    ExportProgress {
                        progress,
                        elapsed_sec,
                        eta_sec,
                        current_frame: frames_written,
                        total_frames: total_out_frames,
                        status: "rendering".into(),
                        error: None,
                    },
                );
            }
        }

        // Determine input sample and time coordinate
        let (in_l, in_r, t_sec) = if render_idx < total_out_frames {
            let fractional_src = render_idx as f64 * rate_ratio;
            let cur_src_idx = (fractional_src.floor() as usize).min(src_frames - 1);
            let alpha = (fractional_src - cur_src_idx as f64) as f32;
            let next_src_idx = (cur_src_idx + 1).min(src_frames - 1);

            let cur_l = buffer.samples[cur_src_idx * 2];
            let cur_r = buffer.samples[cur_src_idx * 2 + 1];
            let next_l = buffer.samples[next_src_idx * 2];
            let next_r = buffer.samples[next_src_idx * 2 + 1];

            let l = cur_l + alpha * (next_l - cur_l);
            let r = cur_r + alpha * (next_r - cur_r);
            let t = fractional_src / src_sr;
            (l, r, t)
        } else {
            // Flush tail silence through the DSP chain so the lookahead buffer fully empties
            let t = src_frames as f64 / src_sr;
            (0.0, 0.0, t)
        };

        // Run through identical DSP chain
        let (dyn_l, dyn_r) = chain.process_frame(
            in_l,
            in_r,
            t_sec,
            &precomputed_timeline,
            manual_az,
            manual_az_enabled,
            fallback_elev,
            fallback_dist,
            fallback_rev,
            fallback_vol,
            target_norm_gain,
            target_balance,
        );

        // Discard the initial lookahead buffer startup latency so exported audio
        // has 0-sample delay shift relative to the source
        if render_idx < lookahead_samples {
            continue;
        }

        // Write output frame
        match &mut writer {
            OutputWriter::WavPcm16(w) => {
                let s_l = (dyn_l.clamp(-1.0, 1.0) * 32767.0).round() as i16;
                let s_r = (dyn_r.clamp(-1.0, 1.0) * 32767.0).round() as i16;
                if let Err(e) = w.write_sample(s_l).and_then(|_| w.write_sample(s_r)) {
                    cleanup_temp(&temp_path);
                    return Err(format!("WAV 16-bit write error: {e}"));
                }
            }
            OutputWriter::WavPcm24(w) => {
                let s_l = (dyn_l.clamp(-1.0, 1.0) * 8388607.0).round() as i32;
                let s_r = (dyn_r.clamp(-1.0, 1.0) * 8388607.0).round() as i32;
                if let Err(e) = w.write_sample(s_l).and_then(|_| w.write_sample(s_r)) {
                    cleanup_temp(&temp_path);
                    return Err(format!("WAV 24-bit write error: {e}"));
                }
            }
            OutputWriter::WavFloat32(w) => {
                if let Err(e) = w.write_sample(dyn_l).and_then(|_| w.write_sample(dyn_r)) {
                    cleanup_temp(&temp_path);
                    return Err(format!("WAV 32-bit float write error: {e}"));
                }
            }
            OutputWriter::Mp3 {
                encoder,
                file,
                chunk_buffer,
                mp3_out,
            } => {
                chunk_buffer.push(dyn_l);
                chunk_buffer.push(dyn_r);

                if chunk_buffer.len() >= 4096 {
                    let input = InterleavedPcm(&chunk_buffer);
                    mp3_out.reserve(mp3lame_encoder::max_required_buffer_size(chunk_buffer.len() / 2));
                    match encoder.encode(input, mp3_out.spare_capacity_mut()) {
                        Ok(encoded_size) => {
                            unsafe {
                                mp3_out.set_len(mp3_out.len() + encoded_size);
                            }
                            if let Err(e) = file.write_all(mp3_out) {
                                cleanup_temp(&temp_path);
                                return Err(format!("MP3 write error: {e}"));
                            }
                            mp3_out.clear();
                        }
                        Err(e) => {
                            cleanup_temp(&temp_path);
                            return Err(format!("MP3 encode error: {e:?}"));
                        }
                    }
                    chunk_buffer.clear();
                }
            }
        }

        frames_written += 1;
    }

    // 7. Finalize and Flush Encoder
    match writer {
        OutputWriter::WavPcm16(w) => {
            w.finalize().map_err(|e| {
                cleanup_temp(&temp_path);
                format!("Failed to finalize WAV 16: {e}")
            })?;
        }
        OutputWriter::WavPcm24(w) => {
            w.finalize().map_err(|e| {
                cleanup_temp(&temp_path);
                format!("Failed to finalize WAV 24: {e}")
            })?;
        }
        OutputWriter::WavFloat32(w) => {
            w.finalize().map_err(|e| {
                cleanup_temp(&temp_path);
                format!("Failed to finalize WAV 32: {e}")
            })?;
        }
        OutputWriter::Mp3 {
            mut encoder,
            mut file,
            chunk_buffer,
            mut mp3_out,
        } => {
            // Encode any remaining chunk samples
            if !chunk_buffer.is_empty() {
                let input = InterleavedPcm(&chunk_buffer);
                mp3_out.reserve(mp3lame_encoder::max_required_buffer_size(chunk_buffer.len() / 2));
                if let Ok(encoded_size) = encoder.encode(input, mp3_out.spare_capacity_mut()) {
                    unsafe {
                        mp3_out.set_len(mp3_out.len() + encoded_size);
                    }
                    let _ = file.write_all(&mp3_out);
                    mp3_out.clear();
                }
            }

            // Flush LAME encoder
            mp3_out.reserve(mp3lame_encoder::max_required_buffer_size(1152));
            match encoder.flush::<FlushNoGap>(mp3_out.spare_capacity_mut()) {
                Ok(encoded_size) => {
                    unsafe {
                        mp3_out.set_len(mp3_out.len() + encoded_size);
                    }
                    if let Err(e) = file.write_all(&mp3_out).and_then(|_| file.flush()) {
                        cleanup_temp(&temp_path);
                        return Err(format!("MP3 flush write error: {e}"));
                    }
                }
                Err(e) => {
                    cleanup_temp(&temp_path);
                    return Err(format!("MP3 flush error: {e:?}"));
                }
            }
        }
    }

    // 8. Atomic Rename temp file to final destination
    if dest_path.exists() {
        let _ = std::fs::remove_file(&dest_path);
    }
    std::fs::rename(&temp_path, &dest_path).map_err(|e| {
        cleanup_temp(&temp_path);
        format!("Failed to finalize export file destination: {e}")
    })?;

    // 9. Emit Finished Progress Event
    let elapsed_sec = start_time.elapsed().as_secs_f32();
    let _ = app.emit(
        "export-progress",
        ExportProgress {
            progress: 1.0,
            elapsed_sec,
            eta_sec: 0.0,
            current_frame: frames_written,
            total_frames: total_out_frames,
            status: "finished".into(),
            error: None,
        },
    );

    log::info!(
        "Offline export completed successfully: {} frames in {:.2}s -> {}",
        frames_written,
        elapsed_sec,
        dest_path.display()
    );

    Ok(())
}

use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};
use tauri_plugin_dialog::DialogExt;

use crate::decode::{decode_audio_file, generate_waveform_peaks};
use crate::models::{
    AudioDeviceInfo, DspProjectState, DynamicsParams, EqParams, ExportProgress, ExportSettings,
    ProjectFile, ReverbParams, Spatial8DParams, TrackInfo,
};
use crate::state::AppState;
use crate::stems::{
    downloader::{check_model_status, download_model},
    separator::run_stem_separation,
    StemModelStatus, StemSeparationProgress, StemSeparationSettings,
};
use crate::timeline::{AutomationLaneId, Keyframe, TimelineState};

/// Opens a native desktop file dialog to pick an audio file.
///
/// Inputs: `app` (AppHandle)
/// Outputs: `Ok(Some(path))` or `Ok(None)` if cancelled
#[tauri::command]
pub async fn select_audio_file(app: AppHandle) -> Result<Option<String>, String> {
    let file_path = app
        .dialog()
        .file()
        .add_filter("Audio Files", &["mp3", "wav", "flac", "ogg", "m4a", "aac"])
        .blocking_pick_file();

    match file_path {
        Some(path) => Ok(Some(path.to_string())),
        None => Ok(None),
    }
}

/// Loads and decodes an audio file into the player engine.
///
/// Inputs:
/// - `path`: Absolute filesystem path to audio file
/// - `state`: Application state containing player and metadata cache
///
/// Outputs:
/// - `Ok(TrackInfo)`: Technical specs and waveform envelope
/// - `Err(String)`: Human-readable error message on failure
///
/// Invariants:
/// - Audio buffer is decoded to interleaved stereo f32.
/// - Waveform peaks are generated with 2,000 bins.
/// - Playback position is reset to 0.0.
#[tauri::command]
pub async fn load_track(
    path: String,
    state: State<'_, AppState>,
) -> Result<TrackInfo, String> {
    log::info!("Loading track: {}", path);

    let (audio_buffer, format_name) = decode_audio_file(&path)
        .map_err(|err| format!("Failed to decode audio file: {err}"))?;

    let file_name = Path::new(&path)
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| "Unknown".to_string());

    // Generate dual-channel (L/R) waveform peaks (2,000 bins)
    let peaks = generate_waveform_peaks(&audio_buffer.samples, audio_buffer.channels, 2000);

    // Compute input loudness normalize gain to target -1.0 dBFS raw peak
    let max_peak = audio_buffer.samples.iter().fold(0.0f32, |m, &s| m.max(s.abs()));
    let target_peak = 10.0_f32.powf(-1.0 / 20.0); // 0.89125 linear
    let normalize_gain = if max_peak > 1e-4 {
        target_peak / max_peak
    } else {
        1.0
    };

    let track_info = TrackInfo {
        file_name,
        file_path: path.clone(),
        duration: audio_buffer.duration,
        sample_rate: audio_buffer.sample_rate,
        channels: audio_buffer.channels,
        format_name,
        peaks,
        normalize_gain,
    };

    // Load into real-time audio playback engine
    if let Some(player) = &state.player {
        player.set_normalize_gain(normalize_gain);
        player.load_buffer(audio_buffer);
    } else {
        return Err("Audio player engine is not initialized (no audio output device available)".to_string());
    }

    // Cache metadata in state
    if let Ok(mut track_guard) = state.current_track.lock() {
        *track_guard = Some(track_info.clone());
    }

    Ok(track_info)
}

/// Resumes playback of loaded audio track.
#[tauri::command]
pub fn play(state: State<'_, AppState>) -> Result<(), String> {
    if let Some(player) = &state.player {
        player.play();
        Ok(())
    } else {
        Err("Audio player engine is unavailable".to_string())
    }
}

/// Pauses audio playback at current position.
#[tauri::command]
pub fn pause(state: State<'_, AppState>) -> Result<(), String> {
    if let Some(player) = &state.player {
        player.pause();
        Ok(())
    } else {
        Err("Audio player engine is unavailable".to_string())
    }
}

/// Stops audio playback and returns playhead to the beginning.
#[tauri::command]
pub fn stop(state: State<'_, AppState>) -> Result<(), String> {
    if let Some(player) = &state.player {
        player.stop();
        Ok(())
    } else {
        Err("Audio player engine is unavailable".to_string())
    }
}

/// Seeks playhead to the given timestamp in seconds.
///
/// Inputs:
/// - `seconds`: Target position in seconds
/// Invariants:
/// - Target is clamped to >= 0.0 and <= track duration.
#[tauri::command]
pub fn seek(seconds: f64, state: State<'_, AppState>) -> Result<(), String> {
    let max_duration = if let Ok(guard) = state.current_track.lock() {
        guard.as_ref().map(|t| t.duration).unwrap_or(0.0)
    } else {
        0.0
    };

    let clamped = seconds.clamp(0.0, max_duration);

    if let Some(player) = &state.player {
        player.seek(clamped);
        Ok(())
    } else {
        Err("Audio player engine is unavailable".to_string())
    }
}

/// Retrieves the current playback position in seconds.
#[tauri::command]
pub fn get_position(state: State<'_, AppState>) -> Result<f64, String> {
    if let Some(player) = &state.player {
        Ok(player.get_position())
    } else {
        Ok(0.0)
    }
}

/// Enables or disables 8D spatial audio processing.
///
/// Inputs: `enabled` (boolean)
/// Invariants: Crossfades smoothly over ~25ms without audio glitch or click.
#[tauri::command]
pub fn set_8d_enabled(enabled: bool, state: State<'_, AppState>) -> Result<(), String> {
    if let Some(player) = &state.player {
        player.set_8d_enabled(enabled);
        Ok(())
    } else {
        Err("Audio player engine is unavailable".to_string())
    }
}

/// Sets 8D orbital rotation speed in Hz.
///
/// Inputs: `speed` (Hz, e.g. 0.25)
/// Invariants: Value is clamped between 0.01 and 5.0 Hz; smoothed exponentially.
#[tauri::command]
pub fn set_rotation_speed(speed: f32, state: State<'_, AppState>) -> Result<(), String> {
    if let Some(player) = &state.player {
        player.set_rotation_speed(speed);
        Ok(())
    } else {
        Err("Audio player engine is unavailable".to_string())
    }
}

/// Sets 8D spatial intensity (wet/dry balance).
///
/// Inputs: `intensity` (0.0 to 1.0)
/// Invariants: Value is clamped between 0.0 and 1.0; smoothed exponentially.
#[tauri::command]
pub fn set_intensity(intensity: f32, state: State<'_, AppState>) -> Result<(), String> {
    if let Some(player) = &state.player {
        player.set_intensity(intensity);
        Ok(())
    } else {
        Err("Audio player engine is unavailable".to_string())
    }
}

/// Sets 3D spatial distance attenuation and air absorption.
///
/// Inputs: `distance` (0.0 to 1.0, where 0.0 is near and 1.0 is far)
/// Invariants: Value is clamped between 0.0 and 1.0; smoothed exponentially and crossfaded.
#[tauri::command]
pub fn set_distance(distance: f32, state: State<'_, AppState>) -> Result<(), String> {
    if let Some(player) = &state.player {
        player.set_distance(distance);
        Ok(())
    } else {
        Err("Audio player engine is unavailable".to_string())
    }
}

/// Sets 3D elevation pinna spectral cue.
///
/// Inputs: `elevation` (-1.0 to 1.0, where -1.0 is below and 1.0 is above)
/// Invariants: Value is clamped between -1.0 and 1.0; crossfaded via 128-sample biquad.
#[tauri::command]
pub fn set_elevation(elevation: f32, state: State<'_, AppState>) -> Result<(), String> {
    if let Some(player) = &state.player {
        player.set_elevation(elevation);
        Ok(())
    } else {
        Err("Audio player engine is unavailable".to_string())
    }
}

/// Sets manual 3D azimuth angle in radians [0, 2*PI).
///
/// Inputs: `azimuth` (radians, e.g. 0.0 to 6.283185)
/// Invariants: Crossfaded and applied smoothly to the 8D panner.
#[tauri::command]
pub fn set_azimuth(azimuth: f32, state: State<'_, AppState>) -> Result<(), String> {
    if let Some(player) = &state.player {
        player.set_azimuth(azimuth);
        Ok(())
    } else {
        Err("Audio player engine is unavailable".to_string())
    }
}

/// Retrieves current 8D/3D spatial parameters.
#[tauri::command]
pub fn get_8d_params(state: State<'_, AppState>) -> Result<Spatial8DParams, String> {
    if let Some(player) = &state.player {
        Ok(player.get_8d_params())
    } else {
        Ok(Spatial8DParams::default())
    }
}

/// Retrieves current 8D/3D spatial parameters (unified alias).
#[tauri::command]
pub fn get_spatial_params(state: State<'_, AppState>) -> Result<Spatial8DParams, String> {
    get_8d_params(state)
}

/// Sets real-time 4-band EQ and master volume parameters.
///
/// Inputs: `params` (EqParams)
/// Invariants:
/// - Recomputes biquad filter coefficients on the UI thread.
/// - Atomic handoff to the audio callback with zero heap allocations.
/// - Click-free dual-state crossfading (128 samples).
#[tauri::command]
pub fn set_eq_params(params: EqParams, state: State<'_, AppState>) -> Result<(), String> {
    if let Some(player) = &state.player {
        player.set_eq_params(params);
        Ok(())
    } else {
        Err("Audio player engine is unavailable".to_string())
    }
}

/// Retrieves current 4-band EQ and master volume parameters.
#[tauri::command]
pub fn get_eq_params(state: State<'_, AppState>) -> Result<EqParams, String> {
    if let Some(player) = &state.player {
        Ok(player.get_eq_params())
    } else {
        Ok(EqParams::default())
    }
}

/// Sets real-time environmental reverberation parameters.
///
/// Inputs: `params` (ReverbParams)
/// Invariants:
/// - Feedback gain calculated per RT60 decay and clamped <= 0.985 for unconditional stability.
/// - Distance auto-tie modulates wet mix naturally with virtual source distance.
/// - Atomic handoff with zero heap allocations on the audio thread.
#[tauri::command]
pub fn set_reverb_params(params: ReverbParams, state: State<'_, AppState>) -> Result<(), String> {
    if let Some(player) = &state.player {
        player.set_reverb_params(params);
        Ok(())
    } else {
        Err("Audio player engine is unavailable".to_string())
    }
}

/// Retrieves current environmental reverberation parameters.
#[tauri::command]
pub fn get_reverb_params(state: State<'_, AppState>) -> Result<ReverbParams, String> {
    if let Some(player) = &state.player {
        Ok(player.get_reverb_params())
    } else {
        Ok(ReverbParams::default())
    }
}

/// Sets real-time mastering dynamics parameters.
///
/// Inputs: `params` (DynamicsParams)
/// Invariants:
/// - Atomic handoff to the audio thread with zero dynamic allocations.
/// - Brickwall peak limiter clamps peaks <= threshold_db.
/// - Input loudness normalize scales track input to -1.0 dBFS target.
#[tauri::command]
pub fn set_dynamics_params(params: DynamicsParams, state: State<'_, AppState>) -> Result<(), String> {
    if let Some(player) = &state.player {
        player.set_dynamics_params(params);
        Ok(())
    } else {
        Err("Audio player engine is unavailable".to_string())
    }
}

/// Retrieves current mastering dynamics parameters.
#[tauri::command]
pub fn get_dynamics_params(state: State<'_, AppState>) -> Result<DynamicsParams, String> {
    if let Some(player) = &state.player {
        Ok(player.get_dynamics_params())
    } else {
        Ok(DynamicsParams::default())
    }
}

/// Retrieves the complete active timeline state with all automation lanes and keyframes.
#[tauri::command]
pub fn get_timeline(state: State<'_, AppState>) -> Result<TimelineState, String> {
    if let Some(player) = &state.player {
        Ok(player.get_timeline())
    } else {
        Ok(TimelineState::default())
    }
}

/// Publishes a full timeline state replacement.
#[tauri::command]
pub fn set_timeline(timeline: TimelineState, state: State<'_, AppState>) -> Result<(), String> {
    if let Some(player) = &state.player {
        player.set_timeline(timeline);
        Ok(())
    } else {
        Err("Audio player engine is unavailable".to_string())
    }
}

/// Adds or updates a keyframe in a specific automation lane.
#[tauri::command]
pub fn add_keyframe(
    lane: AutomationLaneId,
    keyframe: Keyframe,
    state: State<'_, AppState>,
) -> Result<TimelineState, String> {
    if let Some(player) = &state.player {
        player.add_keyframe(lane, keyframe)
    } else {
        Err("Audio player engine is unavailable".to_string())
    }
}

/// Updates an existing keyframe in a specific automation lane.
#[tauri::command]
pub fn update_keyframe(
    lane: AutomationLaneId,
    keyframe: Keyframe,
    state: State<'_, AppState>,
) -> Result<TimelineState, String> {
    if let Some(player) = &state.player {
        player.update_keyframe(lane, keyframe)
    } else {
        Err("Audio player engine is unavailable".to_string())
    }
}

/// Removes a keyframe from a lane by its unique ID.
#[tauri::command]
pub fn remove_keyframe(
    lane: AutomationLaneId,
    keyframe_id: String,
    state: State<'_, AppState>,
) -> Result<TimelineState, String> {
    if let Some(player) = &state.player {
        player.remove_keyframe(lane, &keyframe_id)
    } else {
        Err("Audio player engine is unavailable".to_string())
    }
}

/// Clears all keyframes from an automation lane.
#[tauri::command]
pub fn clear_lane(
    lane: AutomationLaneId,
    state: State<'_, AppState>,
) -> Result<TimelineState, String> {
    if let Some(player) = &state.player {
        player.clear_lane(lane)
    } else {
        Err("Audio player engine is unavailable".to_string())
    }
}

/// Toggles automation enabled/bypass state for an individual lane.
#[tauri::command]
pub fn set_lane_enabled(
    lane: AutomationLaneId,
    enabled: bool,
    state: State<'_, AppState>,
) -> Result<TimelineState, String> {
    if let Some(player) = &state.player {
        player.set_lane_enabled(lane, enabled)
    } else {
        Err("Audio player engine is unavailable".to_string())
    }
}

/// Loads a built-in orbit automation preset.
#[tauri::command]
pub fn load_timeline_preset(
    preset_name: String,
    duration: f64,
    state: State<'_, AppState>,
) -> Result<TimelineState, String> {
    if let Some(player) = &state.player {
        player.load_timeline_preset(&preset_name, duration)
    } else {
        Err("Audio player engine is unavailable".to_string())
    }
}

/// Retrieves all available audio output devices with headphone and active device markers.
#[tauri::command]
pub fn get_audio_devices(state: State<'_, AppState>) -> Result<Vec<AudioDeviceInfo>, String> {
    if let Some(player) = &state.player {
        Ok(player.get_audio_devices())
    } else {
        Err("Audio player engine is unavailable".to_string())
    }
}

/// Switches active audio output device live during playback.
#[tauri::command]
pub fn set_audio_device(
    device_name: String,
    state: State<'_, AppState>,
) -> Result<Vec<AudioDeviceInfo>, String> {
    if let Some(player) = &state.player {
        player.set_audio_device(&device_name)
    } else {
        Err("Audio player engine is unavailable".to_string())
    }
}

/// Sets stereo console output balance trim [-1.0, 1.0].
/// -1.0 = Full Left, 0.0 = Center, +1.0 = Full Right.
#[tauri::command]
pub fn set_balance(balance: f32, state: State<'_, AppState>) -> Result<(), String> {
    if let Some(player) = &state.player {
        player.set_balance(balance);
        Ok(())
    } else {
        Err("Audio player engine is unavailable".to_string())
    }
}

/// Retrieves current output balance trim [-1.0, 1.0].
#[tauri::command]
pub fn get_balance(state: State<'_, AppState>) -> Result<f32, String> {
    if let Some(player) = &state.player {
        Ok(player.get_balance())
    } else {
        Ok(0.0)
    }
}

/// Saves current project state to .orb8d file.
/// If path is None, prompts user with a native file save dialog.
#[tauri::command]
pub async fn save_project(
    path: Option<String>,
    project: ProjectFile,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<String, String> {
    let target_path = match path {
        Some(p) if !p.trim().is_empty() => p,
        _ => {
            let chosen = app
                .dialog()
                .file()
                .add_filter("Orbiter Project", &["orb8d"])
                .blocking_save_file();
            match chosen {
                Some(p) => p.to_string(),
                None => return Err("Save cancelled by user".to_string()),
            }
        }
    };

    crate::project::save_project_to_disk(&target_path, &project)?;

    if let Ok(mut lock) = state.current_project_path.write() {
        *lock = Some(target_path.clone());
    }

    Ok(target_path)
}

/// Loads an .orb8d project file.
/// If path is None, prompts user with a native file open dialog.
#[tauri::command]
pub async fn load_project(
    path: Option<String>,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<ProjectFile, String> {
    let chosen_path = match path {
        Some(p) if !p.trim().is_empty() => p,
        _ => {
            let chosen = app
                .dialog()
                .file()
                .add_filter("Orbiter Project", &["orb8d"])
                .blocking_pick_file();
            match chosen {
                Some(p) => p.to_string(),
                None => return Err("Open cancelled by user".to_string()),
            }
        }
    };

    let project = crate::project::load_project_from_disk(&chosen_path)?;

    if let Ok(mut lock) = state.current_project_path.write() {
        *lock = Some(chosen_path);
    }

    Ok(project)
}

/// Retrieves the current active project path if one is open/saved.
#[tauri::command]
pub fn get_current_project_path(state: State<'_, AppState>) -> Result<Option<String>, String> {
    if let Ok(lock) = state.current_project_path.read() {
        Ok(lock.clone())
    } else {
        Ok(None)
    }
}

/// Opens native file dialog for selecting an export destination file.
#[tauri::command]
pub async fn select_export_destination(
    format_type: String,
    app: AppHandle,
) -> Result<Option<String>, String> {
    let ext = match format_type.to_lowercase().as_str() {
        "mp3" => "mp3",
        _ => "wav",
    };

    let chosen = app
        .dialog()
        .file()
        .add_filter(if ext == "mp3" { "MP3 Audio" } else { "WAV Audio" }, &[ext])
        .blocking_save_file();

    Ok(chosen.map(|p| p.to_string()))
}

/// Starts offline non-realtime rendering to disk.
#[tauri::command]
pub async fn start_export(
    settings: ExportSettings,
    dsp_state: DspProjectState,
    timeline: TimelineState,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<(), String> {
    let player = state.player.as_ref().ok_or("Audio player engine unavailable")?;
    let buffer = player.get_buffer().ok_or("No audio file loaded to export")?;

    // Cancel any currently running export
    if let Ok(guard) = state.export_cancel_flag.read() {
        if let Some(flag) = guard.as_ref() {
            flag.store(true, Ordering::Relaxed);
        }
    }

    let cancel_flag = Arc::new(AtomicBool::new(false));
    if let Ok(mut guard) = state.export_cancel_flag.write() {
        *guard = Some(Arc::clone(&cancel_flag));
    }

    let app_handle = app.clone();
    std::thread::spawn(move || {
        if let Err(e) = crate::export::run_offline_export(
            app_handle.clone(),
            buffer,
            dsp_state,
            timeline,
            settings,
            cancel_flag,
        ) {
            log::error!("Offline export error: {e}");
            let _ = app_handle.emit(
                "export-progress",
                ExportProgress {
                    progress: 0.0,
                    elapsed_sec: 0.0,
                    eta_sec: 0.0,
                    current_frame: 0,
                    total_frames: 0,
                    status: "error".into(),
                    error: Some(e),
                },
            );
        }
    });

    Ok(())
}

/// Cancels currently running offline export.
#[tauri::command]
pub fn cancel_export(state: State<'_, AppState>) -> Result<(), String> {
    if let Ok(guard) = state.export_cancel_flag.read() {
        if let Some(flag) = guard.as_ref() {
            flag.store(true, Ordering::Relaxed);
        }
    }
    Ok(())
}

/// Returns the Demucs ONNX model status (downloaded, file size, execution provider).
#[tauri::command]
pub fn check_stem_model_status() -> Result<StemModelStatus, String> {
    Ok(check_model_status())
}

/// Initiates streaming download of Demucs v4 ONNX model (~166 MB) with SHA-256 verification.
#[tauri::command]
pub async fn download_stem_model(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    // Cancel any ongoing download
    if let Ok(guard) = state.model_download_cancel_flag.read() {
        if let Some(flag) = guard.as_ref() {
            flag.store(true, Ordering::Relaxed);
        }
    }

    let cancel_flag = Arc::new(AtomicBool::new(false));
    if let Ok(mut guard) = state.model_download_cancel_flag.write() {
        *guard = Some(Arc::clone(&cancel_flag));
    }

    download_model(app, cancel_flag).await
}

/// Cancels ongoing model download.
#[tauri::command]
pub fn cancel_stem_model_download(state: State<'_, AppState>) -> Result<(), String> {
    if let Ok(guard) = state.model_download_cancel_flag.read() {
        if let Some(flag) = guard.as_ref() {
            flag.store(true, Ordering::Relaxed);
        }
    }
    Ok(())
}

/// Starts Demucs stem separation on the currently loaded track buffer in a background thread.
#[tauri::command]
pub async fn start_stem_separation(
    settings: StemSeparationSettings,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<(), String> {
    let player = state.player.as_ref().ok_or("Audio player engine unavailable")?;
    let buffer = player.get_buffer().ok_or("No audio file loaded to separate")?;

    let track_path = {
        let guard = state.current_track.lock().map_err(|e| e.to_string())?;
        guard
            .as_ref()
            .map(|t| t.file_path.clone())
            .unwrap_or_else(|| "track.wav".to_string())
    };

    // Cancel any ongoing separation
    if let Ok(guard) = state.stem_cancel_flag.read() {
        if let Some(flag) = guard.as_ref() {
            flag.store(true, Ordering::Relaxed);
        }
    }

    let cancel_flag = Arc::new(AtomicBool::new(false));
    if let Ok(mut guard) = state.stem_cancel_flag.write() {
        *guard = Some(Arc::clone(&cancel_flag));
    }

    let app_handle = app.clone();
    std::thread::spawn(move || {
        match run_stem_separation(
            app_handle.clone(),
            buffer,
            track_path,
            settings,
            cancel_flag,
        ) {
            Ok(result) => {
                let _ = app_handle.emit("stem-separation-finished", &result);
            }
            Err(e) => {
                log::error!("Demucs stem separation error: {e}");
                let _ = app_handle.emit(
                    "stem-separation-progress",
                    StemSeparationProgress {
                        current_chunk: 0,
                        total_chunks: 0,
                        percentage: 0.0,
                        elapsed_sec: 0.0,
                        eta_sec: 0.0,
                        status: "error".into(),
                        error: Some(e),
                    },
                );
            }
        }
    });

    Ok(())
}

/// Cancels currently running stem separation.
#[tauri::command]
pub fn cancel_stem_separation(state: State<'_, AppState>) -> Result<(), String> {
    if let Ok(guard) = state.stem_cancel_flag.read() {
        if let Some(flag) = guard.as_ref() {
            flag.store(true, Ordering::Relaxed);
        }
    }
    Ok(())
}





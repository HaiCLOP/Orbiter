use std::fs::File;
use std::io::Write;
use std::path::{Path, PathBuf};
use uuid::Uuid;

use crate::models::ProjectFile;

/// Atomically saves a project file (`.orb8d`, JSON format) to disk.
///
/// Crash-proof write strategy:
/// 1. Serialize project file to formatted JSON.
/// 2. Write to `<path>.tmp.<uuid>`.
/// 3. Call `sync_all()` to ensure physical persistence on drive.
/// 4. Atomically rename temp file to `<path>`.
/// 5. On any error, clean up temp file.
pub fn save_project_to_disk(file_path: &str, project: &ProjectFile) -> Result<(), String> {
    let dest_path = PathBuf::from(file_path);
    if let Some(parent) = dest_path.parent() {
        if !parent.exists() {
            std::fs::create_dir_all(parent).map_err(|e| format!("Failed to create folder: {e}"))?;
        }
    }

    let file_stem = dest_path
        .file_name()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_else(|| "project.orb8d".to_string());
    let temp_name = format!("{}.tmp.{}", file_stem, Uuid::new_v4());
    let temp_path = dest_path.with_file_name(temp_name);

    let json_content = serde_json::to_string_pretty(project)
        .map_err(|e| format!("Failed to serialize project JSON: {e}"))?;

    // Scope file so handle closes before rename
    {
        let mut file = File::create(&temp_path)
            .map_err(|e| format!("Failed to create temporary project file: {e}"))?;
        file.write_all(json_content.as_bytes())
            .map_err(|e| {
                let _ = std::fs::remove_file(&temp_path);
                format!("Failed to write project data: {e}")
            })?;
        file.sync_all()
            .map_err(|e| {
                let _ = std::fs::remove_file(&temp_path);
                format!("Failed to sync project file to disk: {e}")
            })?;
    }

    if dest_path.exists() {
        let _ = std::fs::remove_file(&dest_path);
    }

    std::fs::rename(&temp_path, &dest_path).map_err(|e| {
        let _ = std::fs::remove_file(&temp_path);
        format!("Failed to atomically rename project file: {e}")
    })?;

    log::info!("Project saved atomically to: {}", dest_path.display());
    Ok(())
}

/// Loads a project file (`.orb8d`) with format version migration and audio relinking heuristics.
pub fn load_project_from_disk(file_path: &str) -> Result<ProjectFile, String> {
    let path = Path::new(file_path);
    if !path.exists() {
        return Err(format!("Project file does not exist: {file_path}"));
    }

    let raw_content = std::fs::read_to_string(path)
        .map_err(|e| format!("Failed to read project file: {e}"))?;

    // Parse untyped JSON first to inspect version
    let raw_val: serde_json::Value = serde_json::from_str(&raw_content)
        .map_err(|e| format!("Invalid project JSON format: {e}"))?;

    let format_version = raw_val.get("format_version")
        .and_then(|v| v.as_u64())
        .unwrap_or(1) as u32;

    let mut project: ProjectFile = match format_version {
        1 => serde_json::from_value(raw_val)
            .map_err(|e| format!("Failed to deserialize ProjectFile (v1): {e}"))?,
        future_v => {
            return Err(format!(
                "Project format version {future_v} is newer than supported version 1. Please update Orbiter."
            ));
        }
    };

    // Audio Relinking Heuristics
    let source_path = Path::new(&project.audio_source.file_path);
    if !source_path.exists() {
        // Try relative to project file directory
        if let Some(project_dir) = path.parent() {
            if let Some(ref rel) = project.audio_source.relative_path {
                let candidate = project_dir.join(rel);
                if candidate.exists() {
                    log::info!("Relinked audio source via relative path: {}", candidate.display());
                    project.audio_source.file_path = candidate.to_string_lossy().into_owned();
                }
            } else {
                // Try looking in same folder with file_name
                let candidate = project_dir.join(&project.audio_source.file_name);
                if candidate.exists() {
                    log::info!("Relinked audio source in same directory: {}", candidate.display());
                    project.audio_source.file_path = candidate.to_string_lossy().into_owned();
                }
            }
        }
    }

    Ok(project)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::*;

    #[test]
    fn test_project_save_load_roundtrip() {
        let temp_dir = std::env::temp_dir();
        let proj_path = temp_dir.join(format!("test_project_{}.orb8d", Uuid::new_v4()));
        let proj_str = proj_path.to_string_lossy().into_owned();

        let original = ProjectFile {
            format_version: 1,
            audio_source: AudioSourceRef {
                file_path: "C:/test/song.wav".into(),
                relative_path: Some("song.wav".into()),
                file_name: "song.wav".into(),
                duration: 120.5,
                channels: 2,
                sample_rate: 48000,
                file_size: 23145600,
                fingerprint_sha256: Some("abcdef123456".into()),
            },
            dsp: DspProjectState {
                spatial: Spatial8DParams {
                    enabled: true,
                    rotation_speed: 0.33,
                    intensity: 0.9,
                    distance: 0.25,
                    elevation: -0.15,
                },
                manual_azimuth: Some(1.234),
                balance: -0.2,
                eq: EqParams {
                    low_cut_hz: 35.0,
                    high_cut_hz: 17500.0,
                    bass_gain_db: 3.0,
                    treble_gain_db: -2.0,
                    master_volume: 1.1,
                },
                reverb: ReverbParams {
                    enabled: true,
                    amount: 0.45,
                    room_size: 0.7,
                    decay: 3.2,
                    damping: 0.3,
                },
                dynamics: DynamicsParams {
                    limiter_enabled: true,
                    threshold_db: -0.5,
                    release_ms: 120.0,
                    normalize_enabled: true,
                },
                normalize_gain: 1.35,
            },
            timeline: TimelineState::default(),
            ui: UiProjectState {
                active_tab: "spatial".into(),
                active_lane: "pan".into(),
                radar_view_mode: "3d".into(),
                timeline_zoom: 1.5,
                timeline_scroll: 12.0,
            },
        };

        save_project_to_disk(&proj_str, &original).expect("save must succeed");
        let loaded = load_project_from_disk(&proj_str).expect("load must succeed");

        assert_eq!(original, loaded);
        let _ = std::fs::remove_file(&proj_path);
    }
}

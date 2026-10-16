pub mod commands;
pub mod decode;
pub mod engine;
pub mod models;
pub mod state;
pub mod timeline;

use std::time::Duration;
use tauri::{Emitter, Manager};
use models::PlaybackTick;
use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let result = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState::new())
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                let state = window.state::<AppState>();
                if let Some(player) = &state.player {
                    player.stop();
                }
                std::process::exit(0);
            }
        })
        .setup(|app| {
            // Background thread to emit playback telemetry every ~100ms
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                loop {
                    std::thread::sleep(Duration::from_millis(100));
                    if handle.get_webview_window("main").is_none() {
                        break;
                    }
                    let state = handle.state::<AppState>();
                    if let Some(player) = &state.player {
                        if player.is_playing() {
                            let tick = PlaybackTick {
                                position: player.get_position(),
                                azimuth: player.get_current_azimuth(),
                                is_playing: player.is_playing(),
                            };
                            let _ = handle.emit("playback-tick", &tick);
                            let _ = handle.emit("playback-position", tick.position);
                        }
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::select_audio_file,
            commands::load_track,
            commands::play,
            commands::pause,
            commands::stop,
            commands::seek,
            commands::get_position,
            commands::set_8d_enabled,
            commands::set_rotation_speed,
            commands::set_intensity,
            commands::set_distance,
            commands::set_elevation,
            commands::set_azimuth,
            commands::get_8d_params,
            commands::get_spatial_params,
            commands::set_eq_params,
            commands::get_eq_params,
            commands::set_reverb_params,
            commands::get_reverb_params,
            commands::set_dynamics_params,
            commands::get_dynamics_params,
            commands::get_timeline,
            commands::set_timeline,
            commands::add_keyframe,
            commands::update_keyframe,
            commands::remove_keyframe,
            commands::clear_lane,
            commands::set_lane_enabled,
            commands::load_timeline_preset,
            commands::get_audio_devices,
            commands::set_audio_device,
        ])
        .run(tauri::generate_context!());

    if let Err(e) = result {
        let msg = format!("Orbiter Tauri Startup Error: {e}\n");
        eprintln!("{msg}");
        let _ = std::fs::write("panic.log", &msg);
    }
}

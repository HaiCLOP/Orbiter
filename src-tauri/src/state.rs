use std::sync::{Arc, Mutex};
use crate::engine::AudioPlayer;
use crate::models::TrackInfo;

/// Global application state managed by Tauri.
pub struct AppState {
    pub player: Option<Arc<AudioPlayer>>,
    pub current_track: Mutex<Option<TrackInfo>>,
}

impl AppState {
    pub fn new() -> Self {
        let player = match AudioPlayer::new() {
            Ok(p) => Some(Arc::new(p)),
            Err(e) => {
                log::warn!("Audio output device could not be initialized on startup: {e}");
                None
            }
        };

        Self {
            player,
            current_track: Mutex::new(None),
        }
    }
}

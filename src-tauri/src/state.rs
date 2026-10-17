use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex, RwLock};
use crate::engine::AudioPlayer;
use crate::models::TrackInfo;

/// Global application state managed by Tauri.
pub struct AppState {
    pub player: Option<Arc<AudioPlayer>>,
    pub current_track: Mutex<Option<TrackInfo>>,
    pub export_cancel_flag: Arc<RwLock<Option<Arc<AtomicBool>>>>,
    pub current_project_path: Arc<RwLock<Option<String>>>,
    pub stem_cancel_flag: Arc<RwLock<Option<Arc<AtomicBool>>>>,
    pub model_download_cancel_flag: Arc<RwLock<Option<Arc<AtomicBool>>>>,
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
            export_cancel_flag: Arc::new(RwLock::new(None)),
            current_project_path: Arc::new(RwLock::new(None)),
            stem_cancel_flag: Arc::new(RwLock::new(None)),
            model_download_cancel_flag: Arc::new(RwLock::new(None)),
        }
    }
}

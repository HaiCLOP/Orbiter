use serde::{Deserialize, Serialize};

/// Audio buffer holding decoded 32-bit floating point PCM audio samples.
///
/// Invariants:
/// - `samples` is interleaved: `[L0, R0, L1, R1, ...]`.
/// - `channels` is always 2 (stereo normalized).
/// - `samples.len() == (duration * sample_rate as f64 * channels as f64).round() as usize` approximately.
/// - `samples` values are normalized within `[-1.0, 1.0]`.
#[derive(Debug, Clone)]
pub struct AudioBuffer {
    /// Interleaved PCM samples: `[L0, R0, L1, R1, ...]`
    pub samples: Vec<f32>,
    /// Sample rate in Hz (e.g. 44100, 48000)
    pub sample_rate: u32,
    /// Channel count (guaranteed 2 for stereo)
    pub channels: u16,
    /// Track duration in seconds
    pub duration: f64,
}

impl AudioBuffer {
    /// Inputs:
    /// - `samples`: Interleaved f32 PCM samples
    /// - `sample_rate`: Sample rate in Hz
    /// - `channels`: Channel count (expected 2)
    /// - `duration`: Total duration in seconds
    ///
    /// Outputs:
    /// - Validated `AudioBuffer` instance
    ///
    /// Invariants:
    /// - `channels` must be >= 1.
    /// - `samples.len() % channels as usize == 0`.
    pub fn new(samples: Vec<f32>, sample_rate: u32, channels: u16, duration: f64) -> Self {
        debug_assert!(channels > 0, "channels must be at least 1");
        debug_assert_eq!(
            samples.len() % channels as usize,
            0,
            "samples length must be an exact multiple of channels"
        );
        Self {
            samples,
            sample_rate,
            channels,
            duration,
        }
    }

    /// Inputs: none
    /// Outputs: Total number of frames (pairs of stereo samples)
    #[inline]
    pub fn total_frames(&self) -> usize {
        if self.channels == 0 {
            0
        } else {
            self.samples.len() / self.channels as usize
        }
    }
}

/// Downsampled waveform peaks for fast rendering in the UI.
/// Provides discrete min/max envelopes for Left and Right channels for dual-track display.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WaveformPeaks {
    pub min_peaks_l: Vec<f32>,
    pub max_peaks_l: Vec<f32>,
    pub min_peaks_r: Vec<f32>,
    pub max_peaks_r: Vec<f32>,
    pub num_bins: usize,
}

/// Technical metadata and visual envelope returned to the UI when a track is loaded.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrackInfo {
    pub file_name: String,
    pub file_path: String,
    pub duration: f64,
    pub sample_rate: u32,
    pub channels: u16,
    pub format_name: String,
    pub peaks: WaveformPeaks,
    /// Pre-analyzed input gain multiplier to bring the raw track to -1.0 dBFS peak.
    /// Note: Normalize targets input loudness, setting a consistent starting level;
    /// downstream panner/elevation/distance/reverb/EQ boosts are caught by the master limiter.
    pub normalize_gain: f32,
}

/// Real-time 8D spatial parameters controlled live from the UI.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Spatial8DParams {
    pub enabled: bool,
    pub rotation_speed: f32, // Hz (e.g. 0.25 Hz = 1 revolution per 4 seconds)
    pub intensity: f32,      // 0.0 to 1.0 (0% to 100%)
    pub distance: f32,       // 0.0 (near) to 1.0 (far)
    pub elevation: f32,      // -1.0 (below) to 1.0 (above)
}

impl Default for Spatial8DParams {
    fn default() -> Self {
        Self {
            enabled: false,
            rotation_speed: 0.25,
            intensity: 0.8,
            distance: 0.0,
            elevation: 0.0,
        }
    }
}

/// Real-time 4-band EQ and master volume parameters controlled live from the UI.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct EqParams {
    pub low_cut_hz: f32,     // 20.0 to 500.0 Hz (default 20.0)
    pub high_cut_hz: f32,    // 2000.0 to 20000.0 Hz (default 20000.0)
    pub bass_gain_db: f32,   // -12.0 to +12.0 dB (default 0.0)
    pub treble_gain_db: f32, // -12.0 to +12.0 dB (default 0.0)
    pub master_volume: f32,  // 0.0 to 2.0 (default 1.0)
}

impl Default for EqParams {
    fn default() -> Self {
        Self {
            low_cut_hz: 20.0,
            high_cut_hz: 20000.0,
            bass_gain_db: 0.0,
            treble_gain_db: 0.0,
            master_volume: 1.0,
        }
    }
}

/// Real-time environmental reverberation parameters (FDN-8 Tank + Early Reflections).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ReverbParams {
    pub enabled: bool,
    pub amount: f32,    // 0.0 to 1.0 (wet mix, default 0.3)
    pub room_size: f32, // 0.0 to 1.0 (default 0.5)
    pub decay: f32,     // RT60 in seconds: 0.2 to 12.0 (default 2.0)
    pub damping: f32,   // High-frequency absorption: 0.0 to 1.0 (default 0.4)
}

impl Default for ReverbParams {
    fn default() -> Self {
        Self {
            enabled: false,
            amount: 0.30,
            room_size: 0.50,
            decay: 2.0,
            damping: 0.40,
        }
    }
}

/// Real-time mastering dynamics parameters (5ms Lookahead Brickwall Limiter + Soft Clipper + Input Normalize).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DynamicsParams {
    pub limiter_enabled: bool,
    /// Brickwall ceiling/threshold in dBFS: -18.0 to 0.0 dB (default: -1.0 dBFS)
    pub threshold_db: f32,
    /// Limiter gain recovery release time in ms: 20.0 to 1000.0 ms (default: 150.0 ms)
    pub release_ms: f32,
    /// Normalize targets input loudness (sets raw decoded track peak to -1.0 dBFS).
    /// Note: Downstream boosts from panner/elevation/distance/reverb/EQ are safely caught by the master limiter.
    pub normalize_enabled: bool,
}

impl Default for DynamicsParams {
    fn default() -> Self {
        Self {
            limiter_enabled: true,
            threshold_db: -1.0,
            release_ms: 150.0,
            normalize_enabled: false,
        }
    }
}

/// Periodic telemetry event pushed to UI for synchronized waveform/radar animation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaybackTick {
    pub position: f64,
    pub azimuth: f64, // LFO angle in radians [0, 2*PI)
    pub is_playing: bool,
}

pub use crate::timeline::{AutomationLane, AutomationLaneId, CurveType, Keyframe, TimelineState};

/// Audio hardware output device descriptor.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AudioDeviceInfo {
    pub name: String,
    pub is_default: bool,
    pub is_active: bool,
    pub is_headphone: bool,
}

/// Project file format schema (`.orb8d`, JSON-based).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ProjectFile {
    pub format_version: u32,
    pub audio_source: AudioSourceRef,
    pub dsp: DspProjectState,
    pub timeline: TimelineState,
    pub ui: UiProjectState,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AudioSourceRef {
    pub file_path: String,
    pub relative_path: Option<String>,
    pub file_name: String,
    pub duration: f64,
    pub channels: u16,
    pub sample_rate: u32,
    pub file_size: u64,
    pub fingerprint_sha256: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DspProjectState {
    pub spatial: Spatial8DParams,
    /// Manual azimuth override when Pan lane is in manual mode.
    /// None when the Pan lane is automated.
    pub manual_azimuth: Option<f32>,
    /// Stereo output balance trim [-1.0, 1.0].
    pub balance: f32,
    pub eq: EqParams,
    pub reverb: ReverbParams,
    pub dynamics: DynamicsParams,
    pub normalize_gain: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct UiProjectState {
    pub active_tab: String,
    pub active_lane: String,
    pub radar_view_mode: String,
    pub timeline_zoom: f32,
    pub timeline_scroll: f32,
}

/// Offline Export Settings from the UI.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportSettings {
    pub destination_path: String,
    pub format: ExportFormat,
    pub sample_rate_option: SampleRateOption,
    pub normalize: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ExportFormat {
    Wav { bit_depth: WavBitDepth },
    Mp3 { bitrate: Mp3Bitrate },
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum WavBitDepth {
    Pcm16,
    Pcm24,
    Float32,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum Mp3Bitrate {
    Kbps128,
    Kbps192,
    Kbps256,
    Kbps320,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum SampleRateOption {
    MatchSource,
    Hz44100,
    Hz48000,
    Hz96000,
}

/// Real-time progress event emitted during offline export.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportProgress {
    pub progress: f32, // 0.0 to 1.0
    pub elapsed_sec: f32,
    pub eta_sec: f32,
    pub current_frame: usize,
    pub total_frames: usize,
    pub status: String, // "rendering" | "encoding" | "finished" | "cancelled" | "error"
    pub error: Option<String>,
}




use std::sync::atomic::{AtomicBool, AtomicU32, AtomicU64, AtomicUsize, Ordering};
use std::sync::{Arc, RwLock};
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{Stream, StreamConfig};
use crate::engine::biquad::BiquadCoeffs;
use crate::engine::dynamics::{DynamicsBridge, DynamicsStage};
use crate::engine::eq_stage::EqStage;
use crate::engine::reverb::{ReverbBridge, ReverbStage};
use crate::engine::spatial_3d::{DistanceStage, ElevationStage, Spatial3DBridge};
use crate::engine::Panner;
use crate::models::{
    AudioBuffer, AudioDeviceInfo, DynamicsParams, EqParams, ReverbParams, Spatial8DParams,
};
use crate::timeline::{
    create_timeline_preset, AutomationLaneId, Keyframe, TimelineBridge, TimelineState,
};

const NO_SEEK: u64 = u64::MAX;

/// Wrapper around `cpal::Stream` to allow holding it across threads.
/// On Windows (WASAPI), cpal::Stream contains raw COM pointers (*mut ()),
/// preventing automatic Send/Sync inference. It is safe to mark Send + Sync
/// because the stream is solely held alive in player state and dropped on shutdown.
#[allow(dead_code)]
struct StreamHandle(Stream);
unsafe impl Send for StreamHandle {}
unsafe impl Sync for StreamHandle {}

/// Explicitly opts this application out of Windows Communications Ducking.
///
/// Under Windows, when a VoIP communications app (such as Discord, Teams, or Zoom) opens
/// an audio session, the Windows Ducking Manager automatically attenuates all non-communication
/// audio sessions by 80% (or mutes them) unless the application explicitly invokes
/// `IAudioSessionControl2::SetDuckingPreference(TRUE)` (which apps like Spotify, Chrome, and VLC do).
///
/// This function enumerates all active audio render endpoints and sets the ducking preference
/// to true, preventing Orbiter from being suppressed during Discord voice calls.
#[cfg(windows)]
pub fn opt_out_of_windows_ducking() {
    use windows::core::Interface;
    use windows::Win32::Media::Audio::{
        eRender, IAudioSessionControl2, IAudioSessionManager2,
        IMMDeviceEnumerator, MMDeviceEnumerator, DEVICE_STATE_ACTIVE,
    };
    use windows::Win32::System::Com::{
        CoCreateInstance, CoInitializeEx, CLSCTX_ALL, COINIT_MULTITHREADED,
    };

    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
        if let Ok(enumerator) = CoCreateInstance::<_, IMMDeviceEnumerator>(&MMDeviceEnumerator, None, CLSCTX_ALL) {
            if let Ok(devices) = enumerator.EnumAudioEndpoints(eRender, DEVICE_STATE_ACTIVE) {
                let count = devices.GetCount().unwrap_or(0);
                for i in 0..count {
                    if let Ok(device) = devices.Item(i) {
                        if let Ok(session_manager) = device.Activate::<IAudioSessionManager2>(CLSCTX_ALL, None) {
                            if let Ok(control) = session_manager.GetAudioSessionControl(None, 0) {
                                if let Ok(control2) = control.cast::<IAudioSessionControl2>() {
                                    let _ = control2.SetDuckingPreference(true);
                                }
                            }
                        }
                    }
                }
                log::info!("Opted out of Windows Communications Ducking across {} audio endpoints", count);
            }
        }
    }
}

#[cfg(not(windows))]
pub fn opt_out_of_windows_ducking() {}


/// Thread-safe atomic bridge for transferring EQ parameters and precalculated biquad coefficients
/// from the UI thread to the CPAL audio processing callback.
///
/// Invariants:
/// - Single writer (UI commands), single reader (audio callback).
/// - Coefficients recomputed on UI thread using audio device sample rate.
/// - Stores use `Ordering::Release`, loads use `Ordering::Acquire`.
/// - Zero dynamic allocations.
pub struct EqBridge {
    // Current user-facing settings
    pub low_cut_hz: AtomicU32,
    pub high_cut_hz: AtomicU32,
    pub bass_gain_db: AtomicU32,
    pub treble_gain_db: AtomicU32,
    pub master_volume: AtomicU32,

    // Monotonically increasing version counter
    pub version: AtomicU32,

    // Low Cut Coefficients
    pub lc_b0: AtomicU32,
    pub lc_b1: AtomicU32,
    pub lc_b2: AtomicU32,
    pub lc_a1: AtomicU32,
    pub lc_a2: AtomicU32,

    // High Cut Coefficients
    pub hc_b0: AtomicU32,
    pub hc_b1: AtomicU32,
    pub hc_b2: AtomicU32,
    pub hc_a1: AtomicU32,
    pub hc_a2: AtomicU32,

    // Bass Shelf Coefficients
    pub bs_b0: AtomicU32,
    pub bs_b1: AtomicU32,
    pub bs_b2: AtomicU32,
    pub bs_a1: AtomicU32,
    pub bs_a2: AtomicU32,

    // Treble Shelf Coefficients
    pub ts_b0: AtomicU32,
    pub ts_b1: AtomicU32,
    pub ts_b2: AtomicU32,
    pub ts_a1: AtomicU32,
    pub ts_a2: AtomicU32,
}

impl EqBridge {
    pub fn new(sample_rate: f32) -> Self {
        let default_params = EqParams::default();
        let lc = BiquadCoeffs::low_cut(sample_rate, default_params.low_cut_hz);
        let hc = BiquadCoeffs::high_cut(sample_rate, default_params.high_cut_hz);
        let bs = BiquadCoeffs::bass_shelf(sample_rate, 100.0, default_params.bass_gain_db);
        let ts = BiquadCoeffs::treble_shelf(sample_rate, 10000.0, default_params.treble_gain_db);

        Self {
            low_cut_hz: AtomicU32::new(default_params.low_cut_hz.to_bits()),
            high_cut_hz: AtomicU32::new(default_params.high_cut_hz.to_bits()),
            bass_gain_db: AtomicU32::new(default_params.bass_gain_db.to_bits()),
            treble_gain_db: AtomicU32::new(default_params.treble_gain_db.to_bits()),
            master_volume: AtomicU32::new(default_params.master_volume.to_bits()),
            version: AtomicU32::new(1),

            lc_b0: AtomicU32::new(lc.b0.to_bits()),
            lc_b1: AtomicU32::new(lc.b1.to_bits()),
            lc_b2: AtomicU32::new(lc.b2.to_bits()),
            lc_a1: AtomicU32::new(lc.a1.to_bits()),
            lc_a2: AtomicU32::new(lc.a2.to_bits()),

            hc_b0: AtomicU32::new(hc.b0.to_bits()),
            hc_b1: AtomicU32::new(hc.b1.to_bits()),
            hc_b2: AtomicU32::new(hc.b2.to_bits()),
            hc_a1: AtomicU32::new(hc.a1.to_bits()),
            hc_a2: AtomicU32::new(hc.a2.to_bits()),

            bs_b0: AtomicU32::new(bs.b0.to_bits()),
            bs_b1: AtomicU32::new(bs.b1.to_bits()),
            bs_b2: AtomicU32::new(bs.b2.to_bits()),
            bs_a1: AtomicU32::new(bs.a1.to_bits()),
            bs_a2: AtomicU32::new(bs.a2.to_bits()),

            ts_b0: AtomicU32::new(ts.b0.to_bits()),
            ts_b1: AtomicU32::new(ts.b1.to_bits()),
            ts_b2: AtomicU32::new(ts.b2.to_bits()),
            ts_a1: AtomicU32::new(ts.a1.to_bits()),
            ts_a2: AtomicU32::new(ts.a2.to_bits()),
        }
    }

    pub fn set_params(&self, sample_rate: f32, params: EqParams) {
        let lc = BiquadCoeffs::low_cut(sample_rate, params.low_cut_hz);
        let hc = BiquadCoeffs::high_cut(sample_rate, params.high_cut_hz);
        let bs = BiquadCoeffs::bass_shelf(sample_rate, 100.0, params.bass_gain_db);
        let ts = BiquadCoeffs::treble_shelf(sample_rate, 10000.0, params.treble_gain_db);

        // Store user params
        self.low_cut_hz.store(params.low_cut_hz.to_bits(), Ordering::Release);
        self.high_cut_hz.store(params.high_cut_hz.to_bits(), Ordering::Release);
        self.bass_gain_db.store(params.bass_gain_db.to_bits(), Ordering::Release);
        self.treble_gain_db.store(params.treble_gain_db.to_bits(), Ordering::Release);
        self.master_volume.store(params.master_volume.to_bits(), Ordering::Release);

        // Store coefficients
        self.lc_b0.store(lc.b0.to_bits(), Ordering::Relaxed);
        self.lc_b1.store(lc.b1.to_bits(), Ordering::Relaxed);
        self.lc_b2.store(lc.b2.to_bits(), Ordering::Relaxed);
        self.lc_a1.store(lc.a1.to_bits(), Ordering::Relaxed);
        self.lc_a2.store(lc.a2.to_bits(), Ordering::Relaxed);

        self.hc_b0.store(hc.b0.to_bits(), Ordering::Relaxed);
        self.hc_b1.store(hc.b1.to_bits(), Ordering::Relaxed);
        self.hc_b2.store(hc.b2.to_bits(), Ordering::Relaxed);
        self.hc_a1.store(hc.a1.to_bits(), Ordering::Relaxed);
        self.hc_a2.store(hc.a2.to_bits(), Ordering::Relaxed);

        self.bs_b0.store(bs.b0.to_bits(), Ordering::Relaxed);
        self.bs_b1.store(bs.b1.to_bits(), Ordering::Relaxed);
        self.bs_b2.store(bs.b2.to_bits(), Ordering::Relaxed);
        self.bs_a1.store(bs.a1.to_bits(), Ordering::Relaxed);
        self.bs_a2.store(bs.a2.to_bits(), Ordering::Relaxed);

        self.ts_b0.store(ts.b0.to_bits(), Ordering::Relaxed);
        self.ts_b1.store(ts.b1.to_bits(), Ordering::Relaxed);
        self.ts_b2.store(ts.b2.to_bits(), Ordering::Relaxed);
        self.ts_a1.store(ts.a1.to_bits(), Ordering::Relaxed);
        self.ts_a2.store(ts.a2.to_bits(), Ordering::Relaxed);

        // Release publish to notify audio thread of new version
        self.version.fetch_add(1, Ordering::Release);
    }

    pub fn get_params(&self) -> EqParams {
        EqParams {
            low_cut_hz: f32::from_bits(self.low_cut_hz.load(Ordering::Acquire)),
            high_cut_hz: f32::from_bits(self.high_cut_hz.load(Ordering::Acquire)),
            bass_gain_db: f32::from_bits(self.bass_gain_db.load(Ordering::Acquire)),
            treble_gain_db: f32::from_bits(self.treble_gain_db.load(Ordering::Acquire)),
            master_volume: f32::from_bits(self.master_volume.load(Ordering::Acquire)),
        }
    }
}

/// Audio player engine managing the real-time cpal output stream.
///
/// Architecture & Concurrency Contract:
/// 1. Zero Audio Thread Allocation: The real-time callback performs no heap allocation or OS blocking.
/// 2. Atomic Parameter Synchronization: Live 8D controls (`enabled`, `rotation_speed`, `intensity`)
///    and EQ/volume settings use `Ordering::Release` on stores (UI thread) and `Ordering::Acquire`
///    on loads (audio callback) to guarantee prompt, race-free, and untorn parameter reads without locks.
/// 3. Atomic Seek Synchronization: Seeks are communicated via `seek_target_frame` using an atomic
///    `swap(NO_SEEK, Ordering::AcqRel)`.
/// Heuristic to detect if a device name refers to headphones, earbuds, or a headset.
pub fn is_headphone_device_name(name: &str) -> bool {
    let lower = name.to_lowercase();
    lower.contains("headphone")
        || lower.contains("buds")
        || lower.contains("earphone")
        || lower.contains("airpod")
        || lower.contains("headset")
        || lower.contains("wh-") // Sony WH-1000XM
        || lower.contains("wf-") // Sony WF-1000XM
        || lower.contains("iem")
}

/// Chooses the most suitable output device:
/// 1. Auto-selects headphone/buds if present.
/// 2. Otherwise falls back to system default output device.
/// 3. Otherwise falls back to first available output device.
fn select_preferred_output_device(host: &cpal::Host) -> Result<(cpal::Device, String), String> {
    let devices: Vec<cpal::Device> = host
        .output_devices()
        .map_err(|e| format!("Failed to enumerate output audio devices: {e}"))?
        .collect();

    if devices.is_empty() {
        return Err("No audio output devices found on system".to_string());
    }

    // 1. Try to find an explicit headphone / earbuds device
    for dev in &devices {
        if let Ok(name) = dev.name() {
            if is_headphone_device_name(&name) {
                log::info!("Preferred headphone device detected: {}", name);
                return Ok((dev.clone(), name));
            }
        }
    }

    // 2. Fall back to default output device
    if let Some(def_dev) = host.default_output_device() {
        let name = def_dev.name().unwrap_or_else(|_| "Default Device".to_string());
        log::info!("Falling back to system default output device: {}", name);
        return Ok((def_dev, name));
    }

    // 3. Fall back to the first available output device
    let first = devices.into_iter().next().unwrap();
    let name = first.name().unwrap_or_else(|_| "Audio Device".to_string());
    Ok((first, name))
}

pub struct AudioPlayer {
    _stream: RwLock<Option<StreamHandle>>,
    current_device_name: RwLock<String>,
    device_sample_rate: AtomicU32,
    buffer_slot: Arc<RwLock<Option<Arc<AudioBuffer>>>>,
    is_playing: Arc<AtomicBool>,
    playhead_frame: Arc<AtomicUsize>,
    seek_target_frame: Arc<AtomicU64>,

    // 8D Spatial Parameters (Acquire-Release Atomic Synchronization)
    spatial_enabled: Arc<AtomicBool>,
    rotation_speed: Arc<AtomicU32>, // f32 bits
    intensity: Arc<AtomicU32>,      // f32 bits
    current_azimuth: Arc<AtomicU32>,// f32 bits

    // 3D Distance & Elevation Bridge
    spatial_3d_bridge: Arc<Spatial3DBridge>,

    // Environmental Reverb Bridge (FDN-8 Tank)
    reverb_bridge: Arc<ReverbBridge>,

    // EQ & Master Volume Bridge
    eq_bridge: Arc<EqBridge>,

    // Master Dynamics Bridge (Limiter + Soft Clipper + Input Normalize)
    dynamics_bridge: Arc<DynamicsBridge>,
    normalize_gain: Arc<AtomicU32>, // f32 bits

    // Multi-Lane Keyframe Automation Bridge
    timeline_bridge: Arc<TimelineBridge>,
}

impl AudioPlayer {
    /// Creates and starts an output stream on the designated CPAL device.
    fn create_stream_for_device(
        device: &cpal::Device,
        cb_buffer_slot: Arc<RwLock<Option<Arc<AudioBuffer>>>>,
        cb_is_playing: Arc<AtomicBool>,
        cb_playhead: Arc<AtomicUsize>,
        cb_seek: Arc<AtomicU64>,
        cb_spatial_enabled: Arc<AtomicBool>,
        cb_rotation_speed: Arc<AtomicU32>,
        cb_intensity: Arc<AtomicU32>,
        cb_current_azimuth: Arc<AtomicU32>,
        cb_spatial_3d_bridge: Arc<Spatial3DBridge>,
        cb_reverb_bridge: Arc<ReverbBridge>,
        cb_eq_bridge: Arc<EqBridge>,
        cb_dynamics_bridge: Arc<DynamicsBridge>,
        cb_normalize_gain: Arc<AtomicU32>,
        cb_timeline_bridge: Arc<TimelineBridge>,
    ) -> Result<(StreamHandle, u32), String> {
        let supported_config = device
            .default_output_config()
            .map_err(|e| format!("Failed to get default audio config: {e}"))?;

        let sample_rate = supported_config.sample_rate().0;
        let channels = supported_config.channels();

        log::info!(
            "Initializing audio stream: {} Hz, {} channels, format {:?}",
            sample_rate,
            channels,
            supported_config.sample_format()
        );

        let config: StreamConfig = supported_config.into();

        let dev_rate = sample_rate as f64;
        let mut fractional_playhead: f64 = cb_playhead.load(Ordering::Acquire) as f64;
        let mut panner = Panner::new(sample_rate as f32);
        let mut elevation_stage = ElevationStage::new(sample_rate as f32);
        let mut distance_stage = DistanceStage::new(sample_rate as f32);
        let mut local_spatial_3d_version: u32 = 0;
        let mut reverb_stage = ReverbStage::new(sample_rate as f32);
        let mut local_reverb_version: u32 = 0;
        let mut eq_stage = EqStage::new(sample_rate as f32);
        let mut local_eq_version: u32 = 0;
        let mut dynamics_stage = DynamicsStage::new(sample_rate as f32);
        let mut local_dynamics_version: u32 = 0;
        let mut local_timeline = {
            let g = cb_timeline_bridge.timeline.read().unwrap();
            Arc::clone(&*g)
        };
        let mut local_timeline_version: u32 = 1;
        let mut prev_pan_automated = false;
        let mut prev_elev_automated = false;
        let mut prev_dist_automated = false;
        let mut prev_rev_automated = false;
        let mut prev_vol_automated = false;
        let mut current_norm_gain: f32 = 1.0;
        let norm_smooth_alpha = 1.0 - (-1.0 / (0.025 * sample_rate as f32)).exp();

        let stream = device
            .build_output_stream(
                &config,
                move |output_data: &mut [f32], _: &cpal::OutputCallbackInfo| {
                    // Try non-blocking read lock to prevent priority inversion
                    let buffer_guard = match cb_buffer_slot.try_read() {
                        Ok(guard) => guard,
                        Err(_) => {
                            output_data.fill(0.0);
                            return;
                        }
                    };

                    let audio_buf: Arc<AudioBuffer> = match buffer_guard.as_ref() {
                        Some(buf) => Arc::clone(buf),
                        None => {
                            output_data.fill(0.0);
                            return;
                        }
                    };

                    // Check for pending seek requests via atomic swap (race-free consumption)
                    let pending_seek = cb_seek.swap(NO_SEEK, Ordering::AcqRel);
                    if pending_seek != NO_SEEK {
                        fractional_playhead = pending_seek as f64;
                    }

                    if !cb_is_playing.load(Ordering::Acquire) {
                        output_data.fill(0.0);
                        return;
                    }

                    // 1. Acquire 8D spatial parameters from UI thread
                    let enabled_8d = cb_spatial_enabled.load(Ordering::Acquire);
                    let speed = f32::from_bits(cb_rotation_speed.load(Ordering::Acquire));
                    let intens = f32::from_bits(cb_intensity.load(Ordering::Acquire));

                    panner.set_enabled(enabled_8d);
                    panner.set_speed(speed);
                    panner.set_intensity(intens);

                    // 2. Acquire 3D Distance and Elevation updates
                    let s3d_ver = cb_spatial_3d_bridge.version.load(Ordering::Acquire);
                    if s3d_ver != local_spatial_3d_version {
                        local_spatial_3d_version = s3d_ver;
                        let air = BiquadCoeffs {
                            b0: f32::from_bits(cb_spatial_3d_bridge.air_b0.load(Ordering::Relaxed)),
                            b1: f32::from_bits(cb_spatial_3d_bridge.air_b1.load(Ordering::Relaxed)),
                            b2: f32::from_bits(cb_spatial_3d_bridge.air_b2.load(Ordering::Relaxed)),
                            a1: f32::from_bits(cb_spatial_3d_bridge.air_a1.load(Ordering::Relaxed)),
                            a2: f32::from_bits(cb_spatial_3d_bridge.air_a2.load(Ordering::Relaxed)),
                        };
                        let elev = BiquadCoeffs {
                            b0: f32::from_bits(cb_spatial_3d_bridge.elev_b0.load(Ordering::Relaxed)),
                            b1: f32::from_bits(cb_spatial_3d_bridge.elev_b1.load(Ordering::Relaxed)),
                            b2: f32::from_bits(cb_spatial_3d_bridge.elev_b2.load(Ordering::Relaxed)),
                            a1: f32::from_bits(cb_spatial_3d_bridge.elev_a1.load(Ordering::Relaxed)),
                            a2: f32::from_bits(cb_spatial_3d_bridge.elev_a2.load(Ordering::Relaxed)),
                        };
                        let dist_gain = f32::from_bits(cb_spatial_3d_bridge.target_gain.load(Ordering::Relaxed));
                        distance_stage.set_precalculated(dist_gain, air);
                        elevation_stage.set_precalculated(elev);
                    }

                    // 3. Acquire Reverb parameters
                    let rev_ver = cb_reverb_bridge.version.load(Ordering::Acquire);
                    if rev_ver != local_reverb_version {
                        local_reverb_version = rev_ver;
                        let p = cb_reverb_bridge.get_params();
                        reverb_stage.set_params(&p);
                    }
                    let cur_dist = cb_spatial_3d_bridge.get_distance();
                    reverb_stage.set_distance(cur_dist);

                    // 4. Acquire EQ parameters and coefficient updates
                    let eq_ver = cb_eq_bridge.version.load(Ordering::Acquire);
                    if eq_ver != local_eq_version {
                        local_eq_version = eq_ver;
                        let lc = BiquadCoeffs {
                            b0: f32::from_bits(cb_eq_bridge.lc_b0.load(Ordering::Relaxed)),
                            b1: f32::from_bits(cb_eq_bridge.lc_b1.load(Ordering::Relaxed)),
                            b2: f32::from_bits(cb_eq_bridge.lc_b2.load(Ordering::Relaxed)),
                            a1: f32::from_bits(cb_eq_bridge.lc_a1.load(Ordering::Relaxed)),
                            a2: f32::from_bits(cb_eq_bridge.lc_a2.load(Ordering::Relaxed)),
                        };
                        let hc = BiquadCoeffs {
                            b0: f32::from_bits(cb_eq_bridge.hc_b0.load(Ordering::Relaxed)),
                            b1: f32::from_bits(cb_eq_bridge.hc_b1.load(Ordering::Relaxed)),
                            b2: f32::from_bits(cb_eq_bridge.hc_b2.load(Ordering::Relaxed)),
                            a1: f32::from_bits(cb_eq_bridge.hc_a1.load(Ordering::Relaxed)),
                            a2: f32::from_bits(cb_eq_bridge.hc_a2.load(Ordering::Relaxed)),
                        };
                        let bs = BiquadCoeffs {
                            b0: f32::from_bits(cb_eq_bridge.bs_b0.load(Ordering::Relaxed)),
                            b1: f32::from_bits(cb_eq_bridge.bs_b1.load(Ordering::Relaxed)),
                            b2: f32::from_bits(cb_eq_bridge.bs_b2.load(Ordering::Relaxed)),
                            a1: f32::from_bits(cb_eq_bridge.bs_a1.load(Ordering::Relaxed)),
                            a2: f32::from_bits(cb_eq_bridge.bs_a2.load(Ordering::Relaxed)),
                        };
                        let ts = BiquadCoeffs {
                            b0: f32::from_bits(cb_eq_bridge.ts_b0.load(Ordering::Relaxed)),
                            b1: f32::from_bits(cb_eq_bridge.ts_b1.load(Ordering::Relaxed)),
                            b2: f32::from_bits(cb_eq_bridge.ts_b2.load(Ordering::Relaxed)),
                            a1: f32::from_bits(cb_eq_bridge.ts_a1.load(Ordering::Relaxed)),
                            a2: f32::from_bits(cb_eq_bridge.ts_a2.load(Ordering::Relaxed)),
                        };
                        eq_stage.set_coefficients(lc, hc, bs, ts);
                    }

                    let vol = f32::from_bits(cb_eq_bridge.master_volume.load(Ordering::Acquire));
                    eq_stage.set_target_volume(vol);

                    // 5. Acquire Dynamics parameters and normalize updates
                    let dyn_ver = cb_dynamics_bridge.version.load(Ordering::Acquire);
                    if dyn_ver != local_dynamics_version {
                        local_dynamics_version = dyn_ver;
                        let dp = cb_dynamics_bridge.get_params();
                        dynamics_stage.set_params(&dp);
                    }
                    let norm_enabled = cb_dynamics_bridge.normalize_enabled.load(Ordering::Acquire);
                    let target_norm_gain = if norm_enabled {
                        f32::from_bits(cb_normalize_gain.load(Ordering::Acquire))
                    } else {
                        1.0
                    };

                    // 6. Check for timeline automation updates
                    let cur_tl_ver = cb_timeline_bridge.version.load(Ordering::Acquire);
                    if cur_tl_ver != local_timeline_version {
                        if let Ok(guard) = cb_timeline_bridge.timeline.try_read() {
                            local_timeline = Arc::clone(&*guard);
                            local_timeline_version = cur_tl_ver;
                        }
                    }

                    let src_samples = &audio_buf.samples;
                    let src_rate = audio_buf.sample_rate as f64;
                    let total_src_frames = audio_buf.total_frames();
                    let rate_ratio = src_rate / dev_rate;
                    let out_channels = channels as usize;

                    // 7. Fill hardware output buffer
                    for frame_chunk in output_data.chunks_mut(out_channels) {
                        let cur_frame_idx = fractional_playhead.floor() as usize;

                        if cur_frame_idx >= total_src_frames {
                            // Reached end of track -> auto-stop
                            cb_is_playing.store(false, Ordering::Release);
                            fractional_playhead = 0.0;
                            frame_chunk.fill(0.0);
                            break;
                        }

                        // Resample interleaved source stereo
                        let alpha = (fractional_playhead - cur_frame_idx as f64) as f32;
                        let next_frame_idx = (cur_frame_idx + 1).min(total_src_frames - 1);

                        let cur_l = src_samples[cur_frame_idx * 2];
                        let cur_r = src_samples[cur_frame_idx * 2 + 1];
                        let next_l = src_samples[next_frame_idx * 2];
                        let next_r = src_samples[next_frame_idx * 2 + 1];

                        let out_l = cur_l + alpha * (next_l - cur_l);
                        let out_r = cur_r + alpha * (next_r - cur_r);

                        // Automation lane evaluations with click-free fallback to manual controls
                        let t_sec = fractional_playhead / src_rate;

                        if let Some(pan_val) = local_timeline.pan.evaluate(t_sec) {
                            panner.set_azimuth_override(Some(pan_val * std::f32::consts::PI));
                            prev_pan_automated = true;
                        } else if prev_pan_automated {
                            panner.set_azimuth_override(None);
                            prev_pan_automated = false;
                        }

                        if let Some(elev_val) = local_timeline.elevation.evaluate(t_sec) {
                            elevation_stage.set_elevation(elev_val);
                            prev_elev_automated = true;
                        } else if prev_elev_automated {
                            elevation_stage.set_elevation(cb_spatial_3d_bridge.get_elevation());
                            prev_elev_automated = false;
                        }

                        if let Some(dist_val) = local_timeline.distance.evaluate(t_sec) {
                            distance_stage.set_distance(dist_val);
                            prev_dist_automated = true;
                        } else if prev_dist_automated {
                            distance_stage.set_distance(cb_spatial_3d_bridge.get_distance());
                            prev_dist_automated = false;
                        }

                        if let Some(rev_amount) = local_timeline.reverb.evaluate(t_sec) {
                            reverb_stage.set_amount(rev_amount);
                            prev_rev_automated = true;
                        } else if prev_rev_automated {
                            reverb_stage.set_amount(cb_reverb_bridge.get_params().amount);
                            prev_rev_automated = false;
                        }

                        if let Some(vol_val) = local_timeline.volume.evaluate(t_sec) {
                            eq_stage.set_target_volume(vol_val);
                            prev_vol_automated = true;
                        } else if prev_vol_automated {
                            eq_stage.set_target_volume(f32::from_bits(cb_eq_bridge.master_volume.load(Ordering::Acquire)));
                            prev_vol_automated = false;
                        }

                        // Click-free exponential smoothing for normalize gain switch (~25ms)
                        current_norm_gain += norm_smooth_alpha * (target_norm_gain - current_norm_gain);

                        // 0. Auto-Normalize input loudness (targets raw input track peak to -1.0 dBFS)
                        let norm_l = out_l * current_norm_gain;
                        let norm_r = out_r * current_norm_gain;

                        // 1. 8D Binaural Panner DSP (horizontal azimuth)
                        let (pan_l, pan_r) = panner.process_sample(norm_l, norm_r);

                        // 2. 3D Elevation DSP (vertical pinna cue) - Before distance per Step 4 physics
                        let (elev_l, elev_r) = elevation_stage.process_sample(pan_l, pan_r);

                        // 3. 3D Distance DSP (air absorption high cut + inverse-distance volume attenuation)
                        let (dist_l, dist_r) = distance_stage.process_sample(elev_l, elev_r);

                        // 4. Environmental Reverb DSP (FDN-8 Tank with distance auto-tie)
                        let (rev_l, rev_r) = reverb_stage.process_sample(dist_l, dist_r);

                        // 5. 4-Band Cascaded EQ + Smoothed Volume DSP
                        let (eq_l, eq_r) = eq_stage.process_sample(rev_l, rev_r);

                        // 6. Master Dynamics Stage (5ms lookahead brickwall peak limiter + soft clipper)
                        let (dyn_l, dyn_r) = dynamics_stage.process_sample(eq_l, eq_r);

                        if out_channels == 1 {
                            frame_chunk[0] = (dyn_l + dyn_r) * 0.5;
                        } else if out_channels >= 2 {
                            frame_chunk[0] = dyn_l;
                            frame_chunk[1] = dyn_r;
                            for extra in &mut frame_chunk[2..] {
                                *extra = 0.0;
                            }
                        }

                        fractional_playhead += rate_ratio;
                    }

                    // Compensate playhead telemetry for master limiter's lookahead delay
                    let lookahead_src = dynamics_stage.lookahead_samples() as f64 * rate_ratio;
                    let audible_playhead = (fractional_playhead - lookahead_src).max(0.0);
                    cb_playhead.store(audible_playhead as usize, Ordering::Release);
                    cb_current_azimuth.store(panner.current_azimuth().to_bits(), Ordering::Release);
                },
                move |err| {
                    log::error!("Audio stream playback error: {err}");
                },
                None,
            )
            .map_err(|e| format!("Failed to build audio output stream: {e}"))?;

        stream
            .play()
            .map_err(|e| format!("Failed to start output stream: {e}"))?;

        Ok((StreamHandle(stream), sample_rate))
    }

    /// Initializes the CPAL output stream on the preferred system audio device (headphones prioritized).
    pub fn new() -> Result<Self, String> {
        let host = cpal::default_host();
        let (device, device_name) = select_preferred_output_device(&host)?;

        let supported_config = device
            .default_output_config()
            .map_err(|e| format!("Failed to get default audio config: {e}"))?;

        let sample_rate = supported_config.sample_rate().0;

        let buffer_slot = Arc::new(RwLock::new(None));
        let is_playing = Arc::new(AtomicBool::new(false));
        let playhead_frame = Arc::new(AtomicUsize::new(0));
        let seek_target_frame = Arc::new(AtomicU64::new(NO_SEEK));

        let spatial_enabled = Arc::new(AtomicBool::new(false));
        let rotation_speed = Arc::new(AtomicU32::new(0.25f32.to_bits()));
        let intensity = Arc::new(AtomicU32::new(0.8f32.to_bits()));
        let current_azimuth = Arc::new(AtomicU32::new(0.0f32.to_bits()));

        let spatial_3d_bridge = Arc::new(Spatial3DBridge::new(sample_rate as f32));
        let reverb_bridge = Arc::new(ReverbBridge::new());
        let eq_bridge = Arc::new(EqBridge::new(sample_rate as f32));
        let dynamics_bridge = Arc::new(DynamicsBridge::new());
        let normalize_gain = Arc::new(AtomicU32::new(1.0f32.to_bits()));
        let timeline_bridge = Arc::new(TimelineBridge::new());

        let (stream_handle, stream_rate) = Self::create_stream_for_device(
            &device,
            Arc::clone(&buffer_slot),
            Arc::clone(&is_playing),
            Arc::clone(&playhead_frame),
            Arc::clone(&seek_target_frame),
            Arc::clone(&spatial_enabled),
            Arc::clone(&rotation_speed),
            Arc::clone(&intensity),
            Arc::clone(&current_azimuth),
            Arc::clone(&spatial_3d_bridge),
            Arc::clone(&reverb_bridge),
            Arc::clone(&eq_bridge),
            Arc::clone(&dynamics_bridge),
            Arc::clone(&normalize_gain),
            Arc::clone(&timeline_bridge),
        )?;

        log::info!(
            "Initialized AudioPlayer on '{}' ({} Hz)",
            device_name,
            stream_rate
        );

        opt_out_of_windows_ducking();

        Ok(Self {
            _stream: RwLock::new(Some(stream_handle)),
            current_device_name: RwLock::new(device_name),
            device_sample_rate: AtomicU32::new(stream_rate),
            buffer_slot,
            is_playing,
            playhead_frame,
            seek_target_frame,
            spatial_enabled,
            rotation_speed,
            intensity,
            current_azimuth,
            spatial_3d_bridge,
            reverb_bridge,
            eq_bridge,
            dynamics_bridge,
            normalize_gain,
            timeline_bridge,
        })
    }

    /// Returns the list of available audio output devices with active/headphone flags.
    pub fn get_audio_devices(&self) -> Vec<AudioDeviceInfo> {
        let host = cpal::default_host();
        let current_name = self.current_device_name.read().unwrap().clone();
        let default_name = host.default_output_device().and_then(|d| d.name().ok());

        let mut result = Vec::new();
        if let Ok(devices) = host.output_devices() {
            for dev in devices {
                if let Ok(name) = dev.name() {
                    let is_default = default_name.as_ref().map(|d| d == &name).unwrap_or(false);
                    let is_active = name == current_name;
                    let is_headphone = is_headphone_device_name(&name);
                    result.push(AudioDeviceInfo {
                        name,
                        is_default,
                        is_active,
                        is_headphone,
                    });
                }
            }
        }
        result
    }

    /// Switches the active audio output device live during playback without losing position or state.
    pub fn set_audio_device(&self, device_name: &str) -> Result<Vec<AudioDeviceInfo>, String> {
        let host = cpal::default_host();
        let devices: Vec<cpal::Device> = host
            .output_devices()
            .map_err(|e| format!("Failed to enumerate output devices: {e}"))?
            .collect();

        let target_device = devices
            .into_iter()
            .find(|d| d.name().map(|n| n == device_name).unwrap_or(false))
            .ok_or_else(|| format!("Device '{device_name}' not found"))?;

        let (new_stream, new_sample_rate) = Self::create_stream_for_device(
            &target_device,
            Arc::clone(&self.buffer_slot),
            Arc::clone(&self.is_playing),
            Arc::clone(&self.playhead_frame),
            Arc::clone(&self.seek_target_frame),
            Arc::clone(&self.spatial_enabled),
            Arc::clone(&self.rotation_speed),
            Arc::clone(&self.intensity),
            Arc::clone(&self.current_azimuth),
            Arc::clone(&self.spatial_3d_bridge),
            Arc::clone(&self.reverb_bridge),
            Arc::clone(&self.eq_bridge),
            Arc::clone(&self.dynamics_bridge),
            Arc::clone(&self.normalize_gain),
            Arc::clone(&self.timeline_bridge),
        )?;

        // Swap active stream
        {
            let mut stream_lock = self._stream.write().unwrap();
            *stream_lock = Some(new_stream);
        }

        // Update active device name & sample rate
        {
            let mut name_lock = self.current_device_name.write().unwrap();
            *name_lock = device_name.to_string();
        }
        self.device_sample_rate.store(new_sample_rate, Ordering::Release);

        // Refresh sample-rate-dependent filter coefficients
        self.eq_bridge.set_params(new_sample_rate as f32, self.eq_bridge.get_params());
        self.spatial_3d_bridge.set_distance(new_sample_rate as f32, self.spatial_3d_bridge.get_distance());
        self.spatial_3d_bridge.set_elevation(new_sample_rate as f32, self.spatial_3d_bridge.get_elevation());

        log::info!("Switched audio device to '{}' ({} Hz)", device_name, new_sample_rate);
        opt_out_of_windows_ducking();
        Ok(self.get_audio_devices())
    }

    /// Loads an AudioBuffer for playback and resets playhead to 0.
    pub fn load_buffer(&self, buffer: AudioBuffer) {
        self.pause();
        self.seek(0.0);
        if let Ok(mut slot) = self.buffer_slot.write() {
            *slot = Some(Arc::new(buffer));
        }
    }

    /// Resumes audio playback.
    pub fn play(&self) {
        self.is_playing.store(true, Ordering::Release);
    }

    /// Pauses audio playback at current position.
    pub fn pause(&self) {
        self.is_playing.store(false, Ordering::Release);
    }

    /// Returns whether the player is currently playing.
    pub fn is_playing(&self) -> bool {
        self.is_playing.load(Ordering::Acquire)
    }

    /// Stops playback and resets position to the beginning.
    pub fn stop(&self) {
        self.pause();
        self.seek(0.0);
    }

    /// Seeks to a specific timestamp in seconds.
    pub fn seek(&self, seconds: f64) {
        let sample_rate = if let Ok(guard) = self.buffer_slot.read() {
            guard.as_ref().map(|b| b.sample_rate).unwrap_or(44100)
        } else {
            44100
        };

        let target_frame = (seconds * sample_rate as f64).round() as u64;
        self.seek_target_frame.store(target_frame, Ordering::Release);
        self.playhead_frame.store(target_frame as usize, Ordering::Release);
    }

    /// Returns the current playback position in seconds.
    pub fn get_position(&self) -> f64 {
        let sample_rate = if let Ok(guard) = self.buffer_slot.read() {
            guard.as_ref().map(|b| b.sample_rate).unwrap_or(44100)
        } else {
            44100
        };

        let frame = self.playhead_frame.load(Ordering::Acquire);
        // Lookahead latency compensation (5.0 ms = ~240 samples @ 48kHz)
        // Keeps waveform playhead and 3D radar dot sample-accurate with acoustic ear arrival
        let lookahead_latency = if self.dynamics_bridge.limiter_enabled.load(Ordering::Acquire) {
            (sample_rate as f32 * 0.005).round() as usize
        } else {
            0
        };
        let compensated_frame = frame.saturating_sub(lookahead_latency);
        compensated_frame as f64 / sample_rate as f64
    }

    /// Returns current LFO azimuth angle in radians [0, 2*PI).
    pub fn get_current_azimuth(&self) -> f64 {
        f32::from_bits(self.current_azimuth.load(Ordering::Acquire)) as f64
    }

    /// Sets 8D spatial processing enabled state with Ordering::Release.
    pub fn set_8d_enabled(&self, enabled: bool) {
        self.spatial_enabled.store(enabled, Ordering::Release);
    }

    /// Sets 8D rotation speed in Hz with Ordering::Release.
    pub fn set_rotation_speed(&self, speed: f32) {
        self.rotation_speed.store(speed.to_bits(), Ordering::Release);
    }

    /// Sets 8D spatial intensity (0.0 to 1.0) with Ordering::Release.
    pub fn set_intensity(&self, intensity: f32) {
        self.intensity.store(intensity.to_bits(), Ordering::Release);
    }

    /// Sets 3D distance parameter [0.0, 1.0] with UI-thread coefficient precalculation.
    pub fn set_distance(&self, distance: f32) {
        self.spatial_3d_bridge.set_distance(self.device_sample_rate.load(Ordering::Acquire) as f32, distance);
    }

    /// Sets 3D elevation parameter [-1.0, 1.0] with UI-thread coefficient precalculation.
    pub fn set_elevation(&self, elevation: f32) {
        self.spatial_3d_bridge.set_elevation(self.device_sample_rate.load(Ordering::Acquire) as f32, elevation);
    }

    /// Retrieves current 8D/3D spatial parameters with Ordering::Acquire.
    pub fn get_8d_params(&self) -> Spatial8DParams {
        Spatial8DParams {
            enabled: self.spatial_enabled.load(Ordering::Acquire),
            rotation_speed: f32::from_bits(self.rotation_speed.load(Ordering::Acquire)),
            intensity: f32::from_bits(self.intensity.load(Ordering::Acquire)),
            distance: self.spatial_3d_bridge.get_distance(),
            elevation: self.spatial_3d_bridge.get_elevation(),
        }
    }

    /// Alias for get_8d_params providing unified 3D spatial parameters.
    pub fn get_spatial_params(&self) -> Spatial8DParams {
        self.get_8d_params()
    }

    /// Sets real-time EQ and master volume parameters with coefficient precalculation on the UI thread.
    pub fn set_eq_params(&self, params: EqParams) {
        self.eq_bridge.set_params(self.device_sample_rate.load(Ordering::Acquire) as f32, params);
    }

    /// Retrieves current EQ and master volume parameters with Ordering::Acquire.
    pub fn get_eq_params(&self) -> EqParams {
        self.eq_bridge.get_params()
    }

    /// Sets real-time environmental reverberation parameters.
    pub fn set_reverb_params(&self, params: ReverbParams) {
        self.reverb_bridge.set_params(params);
    }

    /// Retrieves current environmental reverberation parameters with Ordering::Acquire.
    pub fn get_reverb_params(&self) -> ReverbParams {
        self.reverb_bridge.get_params()
    }

    /// Sets real-time mastering dynamics parameters.
    pub fn set_dynamics_params(&self, params: DynamicsParams) {
        self.dynamics_bridge.set_params(params);
    }

    /// Retrieves current mastering dynamics parameters with Ordering::Acquire.
    pub fn get_dynamics_params(&self) -> DynamicsParams {
        self.dynamics_bridge.get_params()
    }

    /// Sets the target input normalize gain multiplier.
    pub fn set_normalize_gain(&self, gain: f32) {
        self.normalize_gain.store(gain.to_bits(), Ordering::Release);
    }

    /// Retrieves the target input normalize gain multiplier.
    pub fn get_normalize_gain(&self) -> f32 {
        f32::from_bits(self.normalize_gain.load(Ordering::Acquire))
    }

    /// Device hardware sample rate.
    pub fn device_sample_rate(&self) -> u32 {
        self.device_sample_rate.load(Ordering::Acquire)
    }

    /// Returns the active timeline state.
    pub fn get_timeline(&self) -> TimelineState {
        self.timeline_bridge.get_state()
    }

    /// Publishes a complete timeline state update.
    pub fn set_timeline(&self, state: TimelineState) {
        self.timeline_bridge.publish(state);
    }

    /// Adds or replaces a keyframe in a specific lane.
    pub fn add_keyframe(&self, lane_id: AutomationLaneId, keyframe: Keyframe) -> Result<TimelineState, String> {
        let mut state = self.timeline_bridge.get_state();
        let lane = state.lanes.iter_mut().find(|l| l.id == lane_id)
            .ok_or_else(|| format!("Lane {:?} not found", lane_id))?;
        lane.keyframes.retain(|k| (k.time - keyframe.time).abs() > 0.001 && k.id != keyframe.id);
        lane.keyframes.push(keyframe);
        lane.keyframes.sort_by(|a, b| a.time.partial_cmp(&b.time).unwrap_or(std::cmp::Ordering::Equal));
        self.timeline_bridge.publish(state.clone());
        Ok(state)
    }

    /// Updates an existing keyframe in a specific lane.
    pub fn update_keyframe(&self, lane_id: AutomationLaneId, keyframe: Keyframe) -> Result<TimelineState, String> {
        let mut state = self.timeline_bridge.get_state();
        let lane = state.lanes.iter_mut().find(|l| l.id == lane_id)
            .ok_or_else(|| format!("Lane {:?} not found", lane_id))?;
        if let Some(kf) = lane.keyframes.iter_mut().find(|k| k.id == keyframe.id) {
            *kf = keyframe;
        } else {
            return Err(format!("Keyframe {} not found in lane {:?}", keyframe.id, lane_id));
        }
        lane.keyframes.sort_by(|a, b| a.time.partial_cmp(&b.time).unwrap_or(std::cmp::Ordering::Equal));
        self.timeline_bridge.publish(state.clone());
        Ok(state)
    }

    /// Removes a keyframe by ID from a specific lane.
    pub fn remove_keyframe(&self, lane_id: AutomationLaneId, keyframe_id: &str) -> Result<TimelineState, String> {
        let mut state = self.timeline_bridge.get_state();
        let lane = state.lanes.iter_mut().find(|l| l.id == lane_id)
            .ok_or_else(|| format!("Lane {:?} not found", lane_id))?;
        lane.keyframes.retain(|k| k.id != keyframe_id);
        self.timeline_bridge.publish(state.clone());
        Ok(state)
    }

    /// Clears all keyframes from a specific lane.
    pub fn clear_lane(&self, lane_id: AutomationLaneId) -> Result<TimelineState, String> {
        let mut state = self.timeline_bridge.get_state();
        let lane = state.lanes.iter_mut().find(|l| l.id == lane_id)
            .ok_or_else(|| format!("Lane {:?} not found", lane_id))?;
        lane.keyframes.clear();
        self.timeline_bridge.publish(state.clone());
        Ok(state)
    }

    /// Toggles automation enabled state for a specific lane.
    pub fn set_lane_enabled(&self, lane_id: AutomationLaneId, enabled: bool) -> Result<TimelineState, String> {
        let mut state = self.timeline_bridge.get_state();
        let lane = state.lanes.iter_mut().find(|l| l.id == lane_id)
            .ok_or_else(|| format!("Lane {:?} not found", lane_id))?;
        lane.enabled = enabled;
        self.timeline_bridge.publish(state.clone());
        Ok(state)
    }

    /// Generates and loads a built-in timeline preset.
    pub fn load_timeline_preset(&self, preset_name: &str, duration: f64) -> Result<TimelineState, String> {
        let preset = create_timeline_preset(preset_name, duration)
            .ok_or_else(|| format!("Unknown preset '{preset_name}'"))?;
        self.timeline_bridge.publish(preset.clone());
        Ok(preset)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::timeline::CurveType;

    #[test]
    fn test_eq_bridge_initialization_and_update() {
        let bridge = EqBridge::new(48000.0);
        let default_p = bridge.get_params();
        assert_eq!(default_p.low_cut_hz, 20.0);
        assert_eq!(default_p.master_volume, 1.0);

        let new_params = EqParams {
            low_cut_hz: 80.0,
            high_cut_hz: 16000.0,
            bass_gain_db: 4.5,
            treble_gain_db: -2.0,
            master_volume: 1.25,
        };
        bridge.set_params(48000.0, new_params.clone());

        let retrieved = bridge.get_params();
        assert_eq!(retrieved, new_params);
        assert!(bridge.version.load(Ordering::Acquire) > 1);
    }

    #[test]
    fn test_spatial_3d_bridge_initialization_and_update() {
        let bridge = Spatial3DBridge::new(48000.0);
        assert_eq!(bridge.get_distance(), 0.0);
        assert_eq!(bridge.get_elevation(), 0.0);

        bridge.set_distance(48000.0, 0.75);
        assert!((bridge.get_distance() - 0.75).abs() < 1e-6);

        bridge.set_elevation(48000.0, -0.5);
        assert!((bridge.get_elevation() - (-0.5)).abs() < 1e-6);

        assert!(bridge.version.load(Ordering::Acquire) > 1);
    }

    #[test]
    fn test_reverb_bridge_initialization_and_update() {
        let bridge = ReverbBridge::new();
        let default_p = bridge.get_params();
        assert_eq!(default_p.enabled, false);
        assert_eq!(default_p.amount, 0.30);
        assert_eq!(default_p.decay, 2.0);

        let new_params = ReverbParams {
            enabled: true,
            amount: 0.65,
            room_size: 0.8,
            decay: 4.5,
            damping: 0.25,
        };
        bridge.set_params(new_params.clone());

        let retrieved = bridge.get_params();
        assert_eq!(retrieved, new_params);
        assert!(bridge.version.load(Ordering::Acquire) > 1);
    }

    #[test]
    fn test_dynamics_bridge_initialization_and_update() {
        let bridge = DynamicsBridge::new();
        let default_p = bridge.get_params();
        assert_eq!(default_p.limiter_enabled, true);
        assert_eq!(default_p.threshold_db, -1.0);
        assert_eq!(default_p.release_ms, 150.0);
        assert_eq!(default_p.normalize_enabled, false);

        let new_params = DynamicsParams {
            limiter_enabled: true,
            threshold_db: -3.5,
            release_ms: 220.0,
            normalize_enabled: true,
        };
        bridge.set_params(new_params.clone());

        let retrieved = bridge.get_params();
        assert_eq!(retrieved, new_params);
        assert!(bridge.version.load(Ordering::Acquire) > 1);
    }

    #[test]
    fn test_timeline_bridge_integration() {
        let bridge = Arc::new(TimelineBridge::new());
        assert_eq!(bridge.version.load(Ordering::Acquire), 1);
        let mut state = bridge.get_state();
        assert_eq!(state.lanes.len(), 5);

        // Add a keyframe to Pan lane
        let pan_lane = state.lanes.iter_mut().find(|l| l.id == AutomationLaneId::Pan).unwrap();
        pan_lane.keyframes.push(Keyframe {
            id: "kf1".into(),
            time: 1.0,
            value: 0.5,
            curve: CurveType::Linear,
        });
        bridge.publish(state);
        assert_eq!(bridge.version.load(Ordering::Acquire), 2);

        let active = bridge.timeline.read().unwrap();
        assert_eq!(active.pan.evaluate(1.0), Some(0.5));
    }

    #[test]
    fn test_headphone_detection_heuristic() {
        assert!(is_headphone_device_name("Headphones (CMF Buds 2 Plus)"));
        assert!(is_headphone_device_name("AirPods Pro"));
        assert!(is_headphone_device_name("Sony WH-1000XM4"));
        assert!(is_headphone_device_name("Gaming Headset Audio"));
        assert!(is_headphone_device_name("In-Ear Monitor (IEM)"));
        assert!(!is_headphone_device_name("Speakers (Realtek(R) Audio)"));
        assert!(!is_headphone_device_name("AI Noise-cancelling Output (ASUS Utility)"));
    }
}

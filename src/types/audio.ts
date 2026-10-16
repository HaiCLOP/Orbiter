/**
 * Mirrored TypeScript types matching Rust models in `src-tauri/src/models.rs`.
 */

export interface WaveformPeaks {
  min_peaks_l: number[];
  max_peaks_l: number[];
  min_peaks_r: number[];
  max_peaks_r: number[];
  num_bins: number;
}

export interface TrackInfo {
  file_name: string;
  file_path: string;
  duration: number;
  sample_rate: number;
  channels: number;
  format_name: string;
  peaks: WaveformPeaks;
  normalize_gain: number;
}

export interface Spatial8DParams {
  enabled: boolean;
  rotation_speed: number; // in Hz (e.g. 0.25 Hz)
  intensity: number;      // 0.0 to 1.0
  distance: number;       // 0.0 (near) to 1.0 (far)
  elevation: number;      // -1.0 (below) to 1.0 (above)
}

export interface EqParams {
  low_cut_hz: number;     // 20.0 to 500.0 Hz
  high_cut_hz: number;    // 2000.0 to 20000.0 Hz
  bass_gain_db: number;   // -12.0 to +12.0 dB
  treble_gain_db: number; // -12.0 to +12.0 dB
  master_volume: number;  // 0.0 to 2.0 (0% to 200%)
}

export interface ReverbParams {
  enabled: boolean;
  amount: number;    // 0.0 to 1.0 (wet mix)
  room_size: number; // 0.0 to 1.0
  decay: number;     // RT60 in seconds: 0.2 to 12.0s
  damping: number;   // 0.0 to 1.0 (HF absorption)
}

export interface DynamicsParams {
  limiter_enabled: boolean;
  threshold_db: number;       // -18.0 to 0.0 dB
  release_ms: number;         // 20.0 to 1000.0 ms
  normalize_enabled: boolean; // target raw track peak to -1.0 dBFS
}

export interface AudioDeviceInfo {
  name: string;
  is_default: boolean;
  is_active: boolean;
  is_headphone: boolean;
}

export interface PlaybackTick {
  position: number;
  azimuth: number; // in radians [0, 2*PI)
  is_playing: boolean;
}

export interface TrackState {
  loaded: boolean;
  track: TrackInfo | null;
  duration: number;
  position: number;
  isPlaying: boolean;
  isLoading: boolean;
  error: string | null;

  // 8D/3D Spatial State
  spatialParams: Spatial8DParams;
  azimuth: number; // latest ground truth LFO angle in radians

  // EQ & Volume State
  eqParams: EqParams;
  balance: number; // -1.0 (Full L) to +1.0 (Full R), 0.0 Center

  // Environmental Reverb State
  reverbParams: ReverbParams;

  // Mastering Dynamics State
  dynamicsParams: DynamicsParams;

  // Actions
  openAndLoadTrack: () => Promise<void>;
  loadTrackFromPath: (path: string) => Promise<void>;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  stop: () => Promise<void>;
  seek: (seconds: number) => Promise<void>;
  updatePosition: (seconds: number) => void;
  updateTick: (tick: PlaybackTick) => void;
  clearError: () => void;

  // 8D/3D Spatial Actions
  set8DEnabled: (enabled: boolean) => Promise<void>;
  setRotationSpeed: (speed: number) => Promise<void>;
  setIntensity: (intensity: number) => Promise<void>;
  setDistance: (distance: number) => Promise<void>;
  setElevation: (elevation: number) => Promise<void>;
  setAzimuth: (azimuth: number) => Promise<void>;
  setBalance: (balance: number) => Promise<void>;

  // EQ Actions
  setEqParams: (params: Partial<EqParams>) => Promise<void>;
  fetchEqParams: () => Promise<void>;

  // Reverb Actions
  setReverbParams: (params: Partial<ReverbParams>) => Promise<void>;
  fetchReverbParams: () => Promise<void>;

  // Dynamics Actions
  setDynamicsParams: (params: Partial<DynamicsParams>) => Promise<void>;
  fetchDynamicsParams: () => Promise<void>;

  // Audio Output Devices
  audioDevices: AudioDeviceInfo[];
  activeAudioDevice: string | null;
  fetchAudioDevices: () => Promise<void>;
  setAudioDevice: (deviceName: string) => Promise<void>;
}


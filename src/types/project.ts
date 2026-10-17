import type { Spatial8DParams, EqParams, ReverbParams, DynamicsParams } from './audio';
import type { TimelineState } from './automation';

export interface AudioSourceRef {
  file_path: string;
  relative_path: string | null;
  file_name: string;
  duration: number;
  channels: number;
  sample_rate: number;
  file_size: number;
  fingerprint_sha256: string | null;
}

export interface DspProjectState {
  spatial: Spatial8DParams;
  manual_azimuth: number | null;
  balance: number;
  eq: EqParams;
  reverb: ReverbParams;
  dynamics: DynamicsParams;
  normalize_gain: number;
}

export interface UiProjectState {
  active_tab: string;
  active_lane: string;
  radar_view_mode: string;
  timeline_zoom: number;
  timeline_scroll: number;
}

export interface ProjectFile {
  format_version: number;
  audio_source: AudioSourceRef;
  dsp: DspProjectState;
  timeline: TimelineState;
  ui: UiProjectState;
}

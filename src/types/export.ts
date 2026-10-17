export type WavBitDepth = 'pcm16' | 'pcm24' | 'float32';
export type Mp3Bitrate = 'kbps128' | 'kbps192' | 'kbps256' | 'kbps320';
export type SampleRateOption = 'match_source' | 'hz44100' | 'hz48000' | 'hz96000';

export type ExportFormat =
  | { type: 'wav'; bit_depth: WavBitDepth }
  | { type: 'mp3'; bitrate: Mp3Bitrate };

export interface ExportSettings {
  destination_path: string;
  format: ExportFormat;
  sample_rate_option: SampleRateOption;
  normalize: boolean;
}

export interface ExportProgress {
  progress: number; // 0.0 to 1.0
  elapsed_sec: number;
  eta_sec: number;
  current_frame: number;
  total_frames: number;
  status: 'rendering' | 'encoding' | 'finished' | 'cancelled' | 'error';
  error: string | null;
}

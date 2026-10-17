export interface StemModelStatus {
  is_downloaded: boolean;
  model_path: string;
  file_size_bytes: number;
  execution_provider: string;
  error?: string | null;
}

export interface ModelDownloadProgress {
  downloaded_bytes: number;
  total_bytes: number;
  percentage: number;
  status: 'downloading' | 'verifying' | 'finished' | 'error';
  error?: string | null;
}

export interface StemSeparationProgress {
  current_chunk: number;
  total_chunks: number;
  percentage: number;
  elapsed_sec: number;
  eta_sec: number;
  status: 'resampling' | 'separating' | 'reconstructing' | 'saving' | 'finished' | 'cancelled' | 'error';
  error?: string | null;
}

export interface SeparatedStemInfo {
  id: 'vocals' | 'drums' | 'bass' | 'other' | string;
  name: string;
  file_path: string;
  duration: number;
  sample_rate: number;
  peaks: number[];
}

export interface StemSeparationResult {
  stems: SeparatedStemInfo[];
  elapsed_sec: number;
}

export interface StemSeparationSettings {
  output_directory?: string | null;
}

import { create } from 'zustand';
import { invoke, isTauri, convertFileSrc } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type {
  StemModelStatus,
  ModelDownloadProgress,
  StemSeparationProgress,
  SeparatedStemInfo,
  StemSeparationResult,
  StemSeparationSettings,
} from '../types/stems';
import { useTrackStore } from './trackStore';
import { useWorkspaceStore } from './workspaceStore';

interface StemsState {
  modelStatus: StemModelStatus | null;
  isCheckingModel: boolean;
  isDownloadingModel: boolean;
  downloadProgress: ModelDownloadProgress | null;
  isSeparating: boolean;
  separationProgress: StemSeparationProgress | null;
  separatedStems: SeparatedStemInfo[];
  elapsedSec: number;
  auditionStemId: string | null;
  auditionIsPlaying: boolean;
  error: string | null;

  // Actions
  checkModelStatus: () => Promise<void>;
  downloadModel: () => Promise<void>;
  cancelModelDownload: () => Promise<void>;
  startSeparation: (outputDirectory?: string) => Promise<void>;
  cancelSeparation: () => Promise<void>;
  toggleAudition: (stem: SeparatedStemInfo) => void;
  stopAudition: () => void;
  loadStemIntoStudio: (stem: SeparatedStemInfo) => Promise<void>;
  clearError: () => void;
  resetSeparation: () => void;
}

let auditionAudio: HTMLAudioElement | null = null;
let unlistenDownload: UnlistenFn | null = null;
let unlistenSeparationProgress: UnlistenFn | null = null;
let unlistenSeparationFinished: UnlistenFn | null = null;

export const useStemsStore = create<StemsState>((set, get) => ({
  modelStatus: null,
  isCheckingModel: false,
  isDownloadingModel: false,
  downloadProgress: null,
  isSeparating: false,
  separationProgress: null,
  separatedStems: [],
  elapsedSec: 0,
  auditionStemId: null,
  auditionIsPlaying: false,
  error: null,

  checkModelStatus: async () => {
    if (!isTauri()) {
      set({
        modelStatus: {
          is_downloaded: false,
          model_path: 'mock/htdemucs.onnx',
          file_size_bytes: 165612636,
          execution_provider: 'DirectML (DirectX 12 GPU)',
          error: null,
        },
      });
      return;
    }

    set({ isCheckingModel: true, error: null });
    try {
      const status = await invoke<StemModelStatus>('check_stem_model_status');
      set({ modelStatus: status, isCheckingModel: false });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg, isCheckingModel: false });
    }
  },

  downloadModel: async () => {
    if (!isTauri()) {
      set({ error: 'Desktop runtime required to download models.' });
      return;
    }

    set({
      isDownloadingModel: true,
      error: null,
      downloadProgress: {
        downloaded_bytes: 0,
        total_bytes: 165612636,
        percentage: 0,
        status: 'downloading',
        error: null,
      },
    });

    try {
      if (unlistenDownload) {
        unlistenDownload();
      }
      unlistenDownload = await listen<ModelDownloadProgress>(
        'stem-model-download-progress',
        (event) => {
          const prog = event.payload;
          set({ downloadProgress: prog });

          if (prog.status === 'finished') {
            set({ isDownloadingModel: false });
            get().checkModelStatus();
          } else if (prog.status === 'error') {
            set({
              isDownloadingModel: false,
              error: prog.error || 'Model download failed',
            });
          }
        }
      );

      await invoke('download_stem_model');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg, isDownloadingModel: false });
    }
  },

  cancelModelDownload: async () => {
    if (!isTauri()) return;
    try {
      await invoke('cancel_stem_model_download');
      set({ isDownloadingModel: false, downloadProgress: null });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg });
    }
  },

  startSeparation: async (outputDirectory?: string) => {
    const track = useTrackStore.getState().track;
    if (!track) {
      set({ error: 'Please open an audio track before running stem separation.' });
      return;
    }

    if (!isTauri()) {
      set({ error: 'Desktop runtime required to run Demucs stem separation.' });
      return;
    }

    get().stopAudition();

    set({
      isSeparating: true,
      error: null,
      separatedStems: [],
      separationProgress: {
        current_chunk: 0,
        total_chunks: 1,
        percentage: 0.02,
        elapsed_sec: 0,
        eta_sec: 0,
        status: 'resampling',
        error: null,
      },
    });

    try {
      if (unlistenSeparationProgress) unlistenSeparationProgress();
      if (unlistenSeparationFinished) unlistenSeparationFinished();

      unlistenSeparationProgress = await listen<StemSeparationProgress>(
        'stem-separation-progress',
        (event) => {
          const prog = event.payload;
          set({ separationProgress: prog });

          if (prog.status === 'error') {
            set({
              isSeparating: false,
              error: prog.error || 'Stem separation failed',
            });
          } else if (prog.status === 'cancelled') {
            set({ isSeparating: false });
          }
        }
      );

      unlistenSeparationFinished = await listen<StemSeparationResult>(
        'stem-separation-finished',
        (event) => {
          const res = event.payload;
          set({
            isSeparating: false,
            separatedStems: res.stems,
            elapsedSec: res.elapsed_sec,
          });
        }
      );

      const settings: StemSeparationSettings = {
        output_directory: outputDirectory || null,
      };

      await invoke('start_stem_separation', { settings });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg, isSeparating: false });
    }
  },

  cancelSeparation: async () => {
    if (!isTauri()) return;
    try {
      await invoke('cancel_stem_separation');
      set({ isSeparating: false });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg });
    }
  },

  toggleAudition: (stem: SeparatedStemInfo) => {
    const { auditionStemId, auditionIsPlaying } = get();

    if (auditionStemId === stem.id && auditionIsPlaying) {
      get().stopAudition();
      return;
    }

    get().stopAudition();

    // If main track is playing, pause it so they don't clash
    if (useTrackStore.getState().isPlaying) {
      useTrackStore.getState().pause();
    }

    try {
      const audioUrl = convertFileSrc(stem.file_path);
      auditionAudio = new Audio(audioUrl);
      auditionAudio.onended = () => {
        set({ auditionStemId: null, auditionIsPlaying: false });
      };
      auditionAudio.onerror = (e) => {
        console.error('Stem audition error', e);
        set({
          auditionStemId: null,
          auditionIsPlaying: false,
          error: 'Failed to audition stem audio file.',
        });
      };

      auditionAudio.play().then(() => {
        set({ auditionStemId: stem.id, auditionIsPlaying: true });
      }).catch((err) => {
        console.error('Audition playback failed', err);
        set({ auditionStemId: null, auditionIsPlaying: false });
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg });
    }
  },

  stopAudition: () => {
    if (auditionAudio) {
      auditionAudio.pause();
      auditionAudio.currentTime = 0;
      auditionAudio = null;
    }
    set({ auditionStemId: null, auditionIsPlaying: false });
  },

  loadStemIntoStudio: async (stem: SeparatedStemInfo) => {
    get().stopAudition();
    try {
      await useTrackStore.getState().loadTrackFromPath(stem.file_path);
      useWorkspaceStore.getState().setActiveTab('Spatial');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg });
    }
  },

  clearError: () => set({ error: null }),
  resetSeparation: () => {
    get().stopAudition();
    set({
      separatedStems: [],
      separationProgress: null,
      isSeparating: false,
      error: null,
    });
  },
}));

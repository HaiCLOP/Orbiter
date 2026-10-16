import { create } from 'zustand';
import { invoke, isTauri } from '@tauri-apps/api/core';
import type { TrackInfo, TrackState, Spatial8DParams, EqParams, ReverbParams, DynamicsParams, PlaybackTick } from '../types/audio';

/**
 * Zustand store managing audio track loading, transport state, playback clock,
 * live 8D spatial parameters, 4-band EQ rack, and environmental reverb settings.
 *
 * All audio processing and playback is handled exclusively by the native Rust CPAL/Symphonia engine.
 */
export const useTrackStore = create<TrackState>((set, get) => ({
  loaded: false,
  track: null,
  duration: 0,
  position: 0,
  isPlaying: false,
  isLoading: false,
  error: null,

  spatialParams: {
    enabled: false,
    rotation_speed: 0.25,
    intensity: 0.8,
    distance: 0.0,
    elevation: 0.0,
  },
  azimuth: 0,

  eqParams: {
    low_cut_hz: 20,
    high_cut_hz: 20000,
    bass_gain_db: 0,
    treble_gain_db: 0,
    master_volume: 1.0,
  },

  reverbParams: {
    enabled: false,
    amount: 0.30,
    room_size: 0.50,
    decay: 2.0,
    damping: 0.40,
  },

  dynamicsParams: {
    limiter_enabled: true,
    threshold_db: -1.0,
    release_ms: 150.0,
    normalize_enabled: false,
  },

  openAndLoadTrack: async () => {
    set({ error: null });

    if (!isTauri()) {
      set({
        error: 'Orbiter requires the desktop application to access hardware audio and DSP engine.',
      });
      return;
    }

    try {
      const selectedPath = await invoke<string | null>('select_audio_file');
      if (selectedPath) {
        await get().loadTrackFromPath(selectedPath);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg, isLoading: false });
    }
  },

  loadTrackFromPath: async (filePath: string) => {
    set({ isLoading: true, error: null });
    try {
      const track = await invoke<TrackInfo>('load_track', { path: filePath });
      let currentSpatial = get().spatialParams;
      let currentEq = get().eqParams;
      let currentReverb = get().reverbParams;
      let currentDynamics = get().dynamicsParams;

      try {
        const fetchedSpatial = await invoke<Spatial8DParams>('get_8d_params');
        if (fetchedSpatial) currentSpatial = fetchedSpatial;
        const fetchedEq = await invoke<EqParams>('get_eq_params');
        if (fetchedEq) currentEq = fetchedEq;
        const fetchedReverb = await invoke<ReverbParams>('get_reverb_params');
        if (fetchedReverb) currentReverb = fetchedReverb;
        const fetchedDynamics = await invoke<DynamicsParams>('get_dynamics_params');
        if (fetchedDynamics) currentDynamics = fetchedDynamics;
      } catch {
        // Keep defaults if not yet initialized
      }

      set({
        loaded: true,
        track,
        duration: track.duration,
        position: 0,
        azimuth: 0,
        isPlaying: false,
        isLoading: false,
        spatialParams: currentSpatial,
        eqParams: currentEq,
        reverbParams: currentReverb,
        dynamicsParams: currentDynamics,
        error: null,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg, isLoading: false });
    }
  },

  play: async () => {
    const { loaded } = get();
    if (!loaded) return;

    if (!isTauri()) {
      set({ error: 'Desktop application required for audio playback.' });
      return;
    }

    try {
      await invoke('play');
      set({ isPlaying: true, error: null });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg });
    }
  },

  pause: async () => {
    if (!isTauri()) {
      set({ isPlaying: false });
      return;
    }

    try {
      await invoke('pause');
      set({ isPlaying: false });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg });
    }
  },

  stop: async () => {
    if (!isTauri()) {
      set({ isPlaying: false, position: 0, azimuth: 0 });
      return;
    }

    try {
      await invoke('stop');
      set({ isPlaying: false, position: 0, azimuth: 0 });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg });
    }
  },

  seek: async (seconds: number) => {
    const { duration } = get();
    const clamped = Math.max(0, Math.min(seconds, duration));

    if (!isTauri()) {
      set({ position: clamped });
      return;
    }

    try {
      await invoke('seek', { seconds: clamped });
      set({ position: clamped });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg });
    }
  },

  updatePosition: (seconds: number) => {
    const { duration } = get();
    if (seconds >= duration && duration > 0) {
      set({ position: 0, azimuth: 0, isPlaying: false });
    } else {
      set({ position: seconds });
    }
  },

  updateTick: (tick: PlaybackTick) => {
    const { duration } = get();
    if (tick.position >= duration && duration > 0) {
      set({ position: 0, azimuth: 0, isPlaying: false });
    } else {
      set({ position: tick.position, azimuth: tick.azimuth });
    }
  },

  clearError: () => {
    set({ error: null });
  },

  // 8D Spatial parameter controls
  set8DEnabled: async (enabled: boolean) => {
    set((state) => ({
      spatialParams: { ...state.spatialParams, enabled },
    }));

    if (isTauri()) {
      try {
        await invoke('set_8d_enabled', { enabled });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        set({ error: msg });
      }
    }
  },

  setRotationSpeed: async (speed: number) => {
    set((state) => ({
      spatialParams: { ...state.spatialParams, rotation_speed: speed },
    }));

    if (isTauri()) {
      try {
        await invoke('set_rotation_speed', { speed });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        set({ error: msg });
      }
    }
  },

  setIntensity: async (intensity: number) => {
    set((state) => ({
      spatialParams: { ...state.spatialParams, intensity },
    }));

    if (isTauri()) {
      try {
        await invoke('set_intensity', { intensity });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        set({ error: msg });
      }
    }
  },

  setDistance: async (distance: number) => {
    const clamped = Math.max(0, Math.min(1, distance));
    set((state) => ({
      spatialParams: { ...state.spatialParams, distance: clamped },
    }));

    if (isTauri()) {
      try {
        await invoke('set_distance', { distance: clamped });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        set({ error: msg });
      }
    }
  },

  setElevation: async (elevation: number) => {
    const clamped = Math.max(-1, Math.min(1, elevation));
    set((state) => ({
      spatialParams: { ...state.spatialParams, elevation: clamped },
    }));

    if (isTauri()) {
      try {
        await invoke('set_elevation', { elevation: clamped });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        set({ error: msg });
      }
    }
  },

  // 4-Band EQ & Master Volume Controls
  setEqParams: async (partialParams: Partial<EqParams>) => {
    const current = get().eqParams;
    const updated: EqParams = { ...current, ...partialParams };
    set({ eqParams: updated });

    if (isTauri()) {
      try {
        await invoke('set_eq_params', { params: updated });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        set({ error: msg });
      }
    }
  },

  fetchEqParams: async () => {
    if (isTauri()) {
      try {
        const params = await invoke<EqParams>('get_eq_params');
        if (params) {
          set({ eqParams: params });
        }
      } catch (err: unknown) {
        console.error('Failed to fetch EQ params', err);
      }
    }
  },

  // Environmental Reverb Controls
  setReverbParams: async (partialParams: Partial<ReverbParams>) => {
    const current = get().reverbParams;
    const updated: ReverbParams = { ...current, ...partialParams };
    set({ reverbParams: updated });

    if (isTauri()) {
      try {
        await invoke('set_reverb_params', { params: updated });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        set({ error: msg });
      }
    }
  },

  fetchReverbParams: async () => {
    if (isTauri()) {
      try {
        const params = await invoke<ReverbParams>('get_reverb_params');
        if (params) {
          set({ reverbParams: params });
        }
      } catch (err: unknown) {
        console.error('Failed to fetch Reverb params', err);
      }
    }
  },

  // Mastering Dynamics Controls
  setDynamicsParams: async (partialParams: Partial<DynamicsParams>) => {
    const current = get().dynamicsParams;
    const updated: DynamicsParams = { ...current, ...partialParams };
    set({ dynamicsParams: updated });

    if (isTauri()) {
      try {
        await invoke('set_dynamics_params', { params: updated });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        set({ error: msg });
      }
    }
  },

  fetchDynamicsParams: async () => {
    if (isTauri()) {
      try {
        const params = await invoke<DynamicsParams>('get_dynamics_params');
        if (params) {
          set({ dynamicsParams: params });
        }
      } catch (err: unknown) {
        console.error('Failed to fetch Dynamics params', err);
      }
    }
  },
}));

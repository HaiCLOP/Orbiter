import { create } from 'zustand';
import { invoke, isTauri } from '@tauri-apps/api/core';
import type {
  AutomationLaneId,
  CurveType,
  Keyframe,
  TimelineState,
} from '../types/automation';
import { useTrackStore } from './trackStore';

interface TimelineStoreState {
  timeline: TimelineState | null;
  activeLaneId: AutomationLaneId;
  selectedKeyframeId: string | null;
  zoom: number; // pixels per second (e.g. 100px/s)
  scrollLeft: number;
  snapEnabled: boolean;
  gridInterval: number; // in seconds (e.g. 0.25s)
  isLoading: boolean;
  error: string | null;

  initTimeline: () => Promise<void>;
  setActiveLane: (id: AutomationLaneId) => void;
  selectKeyframe: (id: string | null) => void;
  addKeyframe: (laneId: AutomationLaneId, time: number, value: number, curve?: CurveType) => Promise<void>;
  updateKeyframe: (laneId: AutomationLaneId, keyframe: Keyframe) => Promise<void>;
  removeKeyframe: (laneId: AutomationLaneId, keyframeId: string) => Promise<void>;
  clearLane: (laneId: AutomationLaneId) => Promise<void>;
  toggleLane: (laneId: AutomationLaneId) => Promise<void>;
  loadPreset: (presetName: string) => Promise<void>;
  setZoom: (zoom: number) => void;
  setSnapEnabled: (snap: boolean) => void;
  setGridInterval: (interval: number) => void;
  setScrollLeft: (scrollLeft: number) => void;
}

export const useTimelineStore = create<TimelineStoreState>((set, get) => ({
  timeline: null,
  activeLaneId: 'pan',
  selectedKeyframeId: null,
  zoom: 100, // 100px = 1 second
  scrollLeft: 0,
  snapEnabled: true,
  gridInterval: 0.25,
  isLoading: false,
  error: null,

  initTimeline: async () => {
    if (!isTauri()) {
      return;
    }
    set({ isLoading: true });
    try {
      const state = await invoke<TimelineState>('get_timeline');
      set({ timeline: state, isLoading: false });
    } catch (err) {
      console.error('Failed to get timeline:', err);
      set({ error: String(err), isLoading: false });
    }
  },

  setActiveLane: (id: AutomationLaneId) => {
    set({ activeLaneId: id, selectedKeyframeId: null });
  },

  selectKeyframe: (id: string | null) => {
    set({ selectedKeyframeId: id });
  },

  addKeyframe: async (laneId: AutomationLaneId, time: number, value: number, curve?: CurveType) => {
    const kf: Keyframe = {
      id: `kf_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      time: Math.max(0, time),
      value,
      curve: curve || { type: 'linear' },
    };

    if (isTauri()) {
      try {
        const updated = await invoke<TimelineState>('add_keyframe', {
          lane: laneId,
          keyframe: kf,
        });
        set({ timeline: updated, selectedKeyframeId: kf.id });
      } catch (err) {
        console.error('Failed to add keyframe:', err);
        set({ error: String(err) });
      }
    } else {
      // Offline fallback
      const prev = get().timeline;
      if (!prev) return;
      const nextLanes = prev.lanes.map((l) => {
        if (l.id !== laneId) return l;
        const filtered = l.keyframes.filter((k) => Math.abs(k.time - kf.time) > 0.001);
        const sorted = [...filtered, kf].sort((a, b) => a.time - b.time);
        return { ...l, keyframes: sorted };
      });
      set({ timeline: { ...prev, lanes: nextLanes }, selectedKeyframeId: kf.id });
    }
  },

  updateKeyframe: async (laneId: AutomationLaneId, keyframe: Keyframe) => {
    // Optimistic UI update
    const prev = get().timeline;
    if (prev) {
      const nextLanes = prev.lanes.map((l) => {
        if (l.id !== laneId) return l;
        const nextKf = l.keyframes
          .map((k) => (k.id === keyframe.id ? keyframe : k))
          .sort((a, b) => a.time - b.time);
        return { ...l, keyframes: nextKf };
      });
      set({ timeline: { ...prev, lanes: nextLanes } });
    }

    if (isTauri()) {
      try {
        const updated = await invoke<TimelineState>('update_keyframe', {
          lane: laneId,
          keyframe,
        });
        set({ timeline: updated });
      } catch (err) {
        console.error('Failed to update keyframe:', err);
      }
    }
  },

  removeKeyframe: async (laneId: AutomationLaneId, keyframeId: string) => {
    // Optimistic update
    const prev = get().timeline;
    if (prev) {
      const nextLanes = prev.lanes.map((l) => {
        if (l.id !== laneId) return l;
        return { ...l, keyframes: l.keyframes.filter((k) => k.id !== keyframeId) };
      });
      set({
        timeline: { ...prev, lanes: nextLanes },
        selectedKeyframeId: get().selectedKeyframeId === keyframeId ? null : get().selectedKeyframeId,
      });
    }

    if (isTauri()) {
      try {
        const updated = await invoke<TimelineState>('remove_keyframe', {
          lane: laneId,
          keyframeId,
        });
        set({ timeline: updated });
      } catch (err) {
        console.error('Failed to remove keyframe:', err);
      }
    }
  },

  clearLane: async (laneId: AutomationLaneId) => {
    // Optimistic update
    const prev = get().timeline;
    if (prev) {
      const nextLanes = prev.lanes.map((l) => {
        if (l.id !== laneId) return l;
        return { ...l, keyframes: [] };
      });
      set({ timeline: { ...prev, lanes: nextLanes }, selectedKeyframeId: null });
    }

    if (isTauri()) {
      try {
        const updated = await invoke<TimelineState>('clear_lane', {
          lane: laneId,
        });
        set({ timeline: updated, selectedKeyframeId: null });
      } catch (err) {
        console.error('Failed to clear lane:', err);
      }
    }
  },

  toggleLane: async (laneId: AutomationLaneId) => {
    const prev = get().timeline;
    if (!prev) return;
    const lane = prev.lanes.find((l) => l.id === laneId);
    if (!lane) return;

    const nextEnabled = !lane.enabled;

    // Optimistic update
    const nextLanes = prev.lanes.map((l) =>
      l.id === laneId ? { ...l, enabled: nextEnabled } : l
    );
    set({ timeline: { ...prev, lanes: nextLanes } });

    if (isTauri()) {
      try {
        const updated = await invoke<TimelineState>('set_lane_enabled', {
          lane: laneId,
          enabled: nextEnabled,
        });
        set({ timeline: updated });
      } catch (err) {
        console.error('Failed to toggle lane:', err);
      }
    }
  },

  loadPreset: async (presetName: string) => {
    const trackDuration = useTrackStore.getState().duration || 16.0;

    if (isTauri()) {
      try {
        const updated = await invoke<TimelineState>('load_timeline_preset', {
          presetName,
          duration: trackDuration,
        });
        set({ timeline: updated, selectedKeyframeId: null });
      } catch (err) {
        console.error('Failed to load preset:', err);
        set({ error: String(err) });
      }
    }
  },

  setZoom: (zoom: number) => {
    set({ zoom: Math.min(500, Math.max(20, zoom)) });
  },

  setSnapEnabled: (snap: boolean) => {
    set({ snapEnabled: snap });
  },

  setGridInterval: (interval: number) => {
    set({ gridInterval: Math.max(0.01, interval) });
  },

  setScrollLeft: (scrollLeft: number) => {
    set({ scrollLeft: Math.max(0, scrollLeft) });
  },
}));

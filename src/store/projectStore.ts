import { create } from 'zustand';
import { invoke, isTauri } from '@tauri-apps/api/core';
import type { ProjectFile } from '../types/project';
import { useTrackStore } from './trackStore';
import { useTimelineStore } from './timelineStore';
import { useWorkspaceStore, type WorkspaceTab } from './workspaceStore';
import type { AutomationLaneId } from '../types/automation';

interface ProjectStoreState {
  currentFilePath: string | null;
  isDirty: boolean;
  isSaving: boolean;
  isLoadingProject: boolean;
  relinkModalOpen: boolean;
  pendingRelinkProject: ProjectFile | null;
  error: string | null;

  markDirty: () => void;
  clearDirty: () => void;
  newProject: () => void;
  saveProject: (saveAs?: boolean) => Promise<boolean>;
  openProject: (path?: string) => Promise<boolean>;
  relinkAudioSource: (newPath: string) => Promise<boolean>;
  cancelRelink: () => void;
  applyLoadedProject: (project: ProjectFile) => Promise<void>;
}

export const useProjectStore = create<ProjectStoreState>((set, get) => ({
  currentFilePath: null,
  isDirty: false,
  isSaving: false,
  isLoadingProject: false,
  relinkModalOpen: false,
  pendingRelinkProject: null,
  error: null,

  markDirty: () => {
    if (!get().isDirty) {
      set({ isDirty: true });
    }
  },

  clearDirty: () => set({ isDirty: false }),

  newProject: () => {
    const trackStore = useTrackStore.getState();
    trackStore.stop();
    trackStore.set8DEnabled(false);
    trackStore.setRotationSpeed(0.25);
    trackStore.setIntensity(0.8);
    trackStore.setDistance(0.0);
    trackStore.setElevation(0.0);
    trackStore.setBalance(0.0);
    trackStore.setEqParams({
      low_cut_hz: 20,
      high_cut_hz: 20000,
      bass_gain_db: 0,
      treble_gain_db: 0,
      master_volume: 1.0,
    });
    trackStore.setReverbParams({
      enabled: false,
      amount: 0.3,
      room_size: 0.5,
      decay: 2.0,
      damping: 0.4,
    });
    trackStore.setDynamicsParams({
      limiter_enabled: true,
      threshold_db: -1.0,
      release_ms: 150.0,
      normalize_enabled: false,
    });

    const timelineStore = useTimelineStore.getState();
    if (timelineStore.timeline) {
      for (const lane of timelineStore.timeline.lanes) {
        timelineStore.clearLane(lane.id);
      }
    }

    set({
      currentFilePath: null,
      isDirty: false,
      error: null,
      pendingRelinkProject: null,
      relinkModalOpen: false,
    });
  },

  saveProject: async (saveAs = false) => {
    if (!isTauri()) {
      set({ error: 'Desktop application required for project persistence.' });
      return false;
    }

    const trackStore = useTrackStore.getState();
    const track = trackStore.track;
    if (!track) {
      set({ error: 'No audio track is currently loaded to save.' });
      return false;
    }

    const timelineStore = useTimelineStore.getState();
    const panLane = timelineStore.timeline?.lanes.find((l) => l.id === 'pan');
    const isPanAutomated = Boolean(panLane && panLane.enabled && panLane.keyframes.length > 0);

    const project: ProjectFile = {
      format_version: 1,
      audio_source: {
        file_path: track.file_path,
        relative_path: track.file_name,
        file_name: track.file_name,
        duration: track.duration,
        channels: track.channels,
        sample_rate: track.sample_rate,
        file_size: 0,
        fingerprint_sha256: null,
      },
      dsp: {
        spatial: trackStore.spatialParams,
        manual_azimuth: isPanAutomated ? null : trackStore.azimuth,
        balance: trackStore.balance,
        eq: trackStore.eqParams,
        reverb: trackStore.reverbParams,
        dynamics: trackStore.dynamicsParams,
        normalize_gain: track.normalize_gain ?? 1.0,
      },
      timeline: timelineStore.timeline ?? {
        lanes: [],
        loop_enabled: false,
        snap_to_grid: true,
        grid_interval: 0.25,
      },
      ui: {
        active_tab: useWorkspaceStore.getState().activeTab,
        active_lane: timelineStore.activeLaneId,
        radar_view_mode: '3d',
        timeline_zoom: timelineStore.zoom,
        timeline_scroll: timelineStore.scrollLeft,
      },
    };

    set({ isSaving: true, error: null });
    try {
      const savedPath = await invoke<string>('save_project', {
        path: saveAs ? null : get().currentFilePath,
        project,
      });

      set({
        currentFilePath: savedPath,
        isDirty: false,
        isSaving: false,
      });
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('cancelled')) {
        set({ isSaving: false });
        return false;
      }
      set({ error: msg, isSaving: false });
      return false;
    }
  },

  openProject: async (path?: string) => {
    if (!isTauri()) {
      set({ error: 'Desktop application required for project persistence.' });
      return false;
    }

    set({ isLoadingProject: true, error: null });
    try {
      const project = await invoke<ProjectFile>('load_project', { path: path || null });

      // Try loading audio track
      const trackStore = useTrackStore.getState();
      try {
        await trackStore.loadTrackFromPath(project.audio_source.file_path);
        await get().applyLoadedProject(project);
        set({
          currentFilePath: path || project.audio_source.file_path,
          isDirty: false,
          isLoadingProject: false,
        });
        return true;
      } catch {
        // Audio file missing -> prompt relink modal non-destructively
        set({
          pendingRelinkProject: project,
          relinkModalOpen: true,
          isLoadingProject: false,
        });
        return false;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('cancelled')) {
        set({ isLoadingProject: false });
        return false;
      }
      set({ error: msg, isLoadingProject: false });
      return false;
    }
  },

  relinkAudioSource: async (newPath: string) => {
    const project = get().pendingRelinkProject;
    if (!project) return false;

    const trackStore = useTrackStore.getState();
    set({ isLoadingProject: true, error: null });
    try {
      await trackStore.loadTrackFromPath(newPath);
      project.audio_source.file_path = newPath;
      await get().applyLoadedProject(project);
      set({
        pendingRelinkProject: null,
        relinkModalOpen: false,
        isDirty: true, // Relinked path is modified
        isLoadingProject: false,
      });
      return true;
    } catch (err) {
      set({ error: `Failed to load relinked audio: ${String(err)}`, isLoadingProject: false });
      return false;
    }
  },

  cancelRelink: () => {
    set({ relinkModalOpen: false, pendingRelinkProject: null });
  },

  applyLoadedProject: async (project: ProjectFile) => {
    const trackStore = useTrackStore.getState();
    const dsp = project.dsp;

    // 1. Spatial 8D & Balance
    await trackStore.set8DEnabled(dsp.spatial.enabled);
    await trackStore.setRotationSpeed(dsp.spatial.rotation_speed);
    await trackStore.setIntensity(dsp.spatial.intensity);
    await trackStore.setDistance(dsp.spatial.distance);
    await trackStore.setElevation(dsp.spatial.elevation);
    await trackStore.setBalance(dsp.balance);

    if (dsp.manual_azimuth !== null && dsp.manual_azimuth !== undefined) {
      await trackStore.setAzimuth(dsp.manual_azimuth);
    }

    // 2. EQ rack
    await trackStore.setEqParams(dsp.eq);

    // 3. Reverb
    await trackStore.setReverbParams(dsp.reverb);

    // 4. Dynamics & Limiter
    await trackStore.setDynamicsParams(dsp.dynamics);

    // 5. Timeline Automation
    const timelineStore = useTimelineStore.getState();
    if (project.timeline) {
      await invoke('set_timeline', { timeline: project.timeline });
      timelineStore.initTimeline();
    }

    // 6. UI Navigation
    if (project.ui) {
      if (project.ui.active_tab) {
        useWorkspaceStore.getState().setActiveTab(project.ui.active_tab as WorkspaceTab);
      }
      if (project.ui.active_lane) {
        timelineStore.setActiveLane(project.ui.active_lane as AutomationLaneId);
      }
      if (project.ui.timeline_zoom) {
        timelineStore.setZoom(project.ui.timeline_zoom);
      }
      if (project.ui.timeline_scroll !== undefined) {
        timelineStore.setScrollLeft(project.ui.timeline_scroll);
      }
    }
  },
}));

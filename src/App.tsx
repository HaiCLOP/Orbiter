import React, { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { TopNav } from './components/TopNav';
import { ProjectBrowser } from './components/ProjectBrowser';
import { TransportControls } from './components/TransportControls';
import { PropertiesPanel } from './components/PropertiesPanel';
import { useTrackStore } from './store/trackStore';
import { useWorkspaceStore } from './store/workspaceStore';
import { SpatialView } from './components/views/SpatialView';
import { EffectsView } from './components/views/EffectsView';
import { EditView } from './components/views/EditView';
import { GraphView } from './components/views/GraphView';
import { RenderView } from './components/views/RenderView';
import { AlertTriangle, X } from 'lucide-react';
import { isTauri } from '@tauri-apps/api/core';
import type { PlaybackTick } from './types/audio';

export const App: React.FC = () => {
  const { error, clearError, updateTick } = useTrackStore();
  const { activeTab } = useWorkspaceStore();

  // Subscribe to Tauri real-time playback telemetry (position and azimuth) (~100ms)
  useEffect(() => {
    if (!isTauri()) {
      return;
    }

    let unlistenFn: (() => void) | null = null;

    listen<PlaybackTick>('playback-tick', (event) => {
      updateTick(event.payload);
    }).then((unlisten) => {
      unlistenFn = unlisten;
    });

    return () => {
      if (unlistenFn) {
        unlistenFn();
      }
    };
  }, [updateTick]);

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0e1117] text-zinc-100 overflow-hidden font-sans select-none">
      {/* Top Application Bar with Tab Navigation */}
      <TopNav />

      {/* Global Error Banner */}
      {error && (
        <div className="bg-rose-950/80 border-b border-rose-800 px-4 py-2 flex items-center justify-between text-xs text-rose-200 z-50">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={clearError}
            className="p-1 hover:bg-rose-900 rounded text-rose-300 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 3-Column DAW Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Project & Effects Browser */}
        <ProjectBrowser />

        {/* Center Workspace */}
        <main className="flex-1 flex flex-col bg-[#0c0e14] overflow-hidden">
          {/* Active Workspace View Switch */}
          {activeTab === 'Spatial' && <SpatialView />}
          {activeTab === 'Effects' && <EffectsView />}
          {activeTab === 'Edit' && <EditView />}
          {activeTab === 'Graph' && <GraphView />}
          {activeTab === 'Render' && <RenderView />}

          {/* Persistent Global Transport Bar */}
          <TransportControls />
        </main>

        {/* Right Inspector: Audio Clip Properties & Contextual Tab Controls */}
        <PropertiesPanel />
      </div>
    </div>
  );
};

export default App;

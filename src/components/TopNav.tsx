import React from 'react';
import { Disc, FolderOpen, Loader2 } from 'lucide-react';
import { useTrackStore } from '../store/trackStore';
import { useWorkspaceStore, type WorkspaceTab } from '../store/workspaceStore';
import { AudioDeviceSelector } from './AudioDeviceSelector';

export const TopNav: React.FC = () => {
  const { openAndLoadTrack, isLoading } = useTrackStore();
  const { activeTab, setActiveTab } = useWorkspaceStore();

  const menuItems = ['File', 'Edit', 'Audio', 'Graph', 'Effects', 'View', 'Window', 'Help'];
  const viewTabs: WorkspaceTab[] = ['Spatial', 'Effects', 'Graph', 'Edit', 'Render'];

  return (
    <nav className="h-11 glass-panel border-x-0 border-t-0 border-b border-white/[0.08] px-4 flex items-center justify-between text-xs select-none relative z-30">
      {/* Left: App Identity & Menu */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <div className="w-5 h-5 rounded-md glass-card flex items-center justify-center text-zinc-300">
            <Disc className="w-3.5 h-3.5" />
          </div>
          <span className="text-zinc-100 font-semibold text-[13px] tracking-tight">Orbiter</span>
          <span className="glass-pill text-[9px] text-zinc-400 px-1.5 py-0.2 rounded font-mono font-medium">
            8D Spatial
          </span>
        </div>

        <div className="hidden lg:flex items-center space-x-0.5 text-zinc-400 text-[11px]">
          {menuItems.map((item) => (
            <button
              key={item}
              className="px-2 py-1 rounded hover:bg-white/[0.06] hover:text-zinc-200 transition-colors cursor-pointer"
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {/* Center: Apple Segmented Workspace Controller */}
      <div className="flex items-center space-x-0.5 glass-card p-0.5 rounded-lg border border-white/[0.08]">
        {viewTabs.map((tab) => {
          const isActive = tab === activeTab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer relative ${
                isActive
                  ? 'bg-white/15 text-white shadow-xs font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {tab}
            </button>
          );
        })}
      </div>

      {/* Right: Audio Device & Open Action */}
      <div className="flex items-center space-x-2.5">
        <AudioDeviceSelector />

        <button
          onClick={openAndLoadTrack}
          disabled={isLoading}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 active:bg-white/10 border border-white/[0.12] disabled:opacity-50 text-white text-[11px] font-medium transition-all cursor-pointer shadow-xs active:scale-95"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-300" />
              <span>Loading...</span>
            </>
          ) : (
            <>
              <FolderOpen className="w-3.5 h-3.5 text-zinc-300" />
              <span>Open Track</span>
            </>
          )}
        </button>
      </div>
    </nav>
  );
};

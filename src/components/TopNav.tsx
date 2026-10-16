import React from 'react';
import { Disc3, FolderOpen, Loader2 } from 'lucide-react';
import { useTrackStore } from '../store/trackStore';
import { useWorkspaceStore, type WorkspaceTab } from '../store/workspaceStore';
import { AudioDeviceSelector } from './AudioDeviceSelector';

export const TopNav: React.FC = () => {
  const { openAndLoadTrack, isLoading } = useTrackStore();
  const { activeTab, setActiveTab } = useWorkspaceStore();

  const menuItems = ['File', 'Edit', 'Clip', 'Audio', 'Graph', 'Effects', 'View', 'Window', 'Help'];
  const viewTabs: WorkspaceTab[] = ['Edit', 'Graph', 'Spatial', 'Effects', 'Render'];

  return (
    <nav className="h-11 glass-panel border-x-0 border-t-0 border-b border-white/[0.08] px-3.5 flex items-center justify-between text-xs select-none relative z-30 shadow-md">
      {/* Left: App Logo & Menu Bar */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2 text-indigo-400 font-bold tracking-wider">
          <div className="w-6 h-6 rounded-lg glass-card flex items-center justify-center border-indigo-500/30 shadow-[0_0_12px_rgba(99,102,241,0.25)]">
            <Disc3 className="w-3.5 h-3.5 text-indigo-300 animate-[spin_8s_linear_infinite]" />
          </div>
          <span className="text-slate-100 font-semibold text-[13px] tracking-tight">Orbiter</span>
          <span className="glass-pill text-[9px] text-cyan-300 border-cyan-500/30 px-1.5 py-0.2 rounded-full font-mono font-bold shadow-[0_0_8px_rgba(6,182,212,0.2)]">
            8D
          </span>
        </div>

        <div className="hidden lg:flex items-center space-x-1 text-slate-400 text-[11px]">
          {menuItems.map((item) => (
            <button
              key={item}
              className="px-2 py-1 rounded-md hover:bg-white/[0.06] hover:text-slate-200 transition-colors cursor-pointer"
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {/* Center: Stage Tabs as Floating iOS 26 Segmented Control */}
      <div className="flex items-center space-x-1 glass-card p-0.5 rounded-xl border border-white/[0.08] shadow-inner">
        {viewTabs.map((tab) => {
          const isActive = tab === activeTab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer relative ${
                isActive
                  ? 'bg-indigo-600/40 text-white border border-indigo-400/40 shadow-[0_2px_12px_rgba(99,102,241,0.35)]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
              }`}
            >
              {tab}
            </button>
          );
        })}
      </div>

      {/* Right: Audio Device Selector & Load Action */}
      <div className="flex items-center space-x-2.5">
        <AudioDeviceSelector />

        <button
          onClick={openAndLoadTrack}
          disabled={isLoading}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-indigo-600/80 hover:bg-indigo-500 active:bg-indigo-600 border border-indigo-400/30 disabled:opacity-50 text-white text-[11px] font-semibold transition-all cursor-pointer shadow-[0_2px_12px_rgba(99,102,241,0.35)] hover:shadow-[0_4px_16px_rgba(99,102,241,0.5)] active:scale-95"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
              <span>Decoding...</span>
            </>
          ) : (
            <>
              <FolderOpen className="w-3.5 h-3.5 text-indigo-200" />
              <span>Open File</span>
            </>
          )}
        </button>
      </div>
    </nav>
  );
};

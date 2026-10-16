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
    <nav className="h-10 bg-[#12151c] border-b border-[#222734] px-3 flex items-center justify-between text-xs select-none">
      {/* Left: App Logo & Menu Bar */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-1.5 text-indigo-400 font-bold tracking-wider">
          <Disc3 className="w-4 h-4 animate-[spin_8s_linear_infinite]" />
          <span className="text-zinc-100 text-[13px]">Orbiter</span>
          <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-1 py-0.2 rounded font-mono">
            8D
          </span>
        </div>

        <div className="hidden lg:flex items-center space-x-1 text-zinc-400">
          {menuItems.map((item) => (
            <button
              key={item}
              className="px-2 py-1 rounded hover:bg-[#1e2330] hover:text-zinc-200 transition-colors"
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {/* Center: Stage Tabs */}
      <div className="flex items-center space-x-1 bg-[#181d28] p-0.5 rounded-md border border-[#262c3a]">
        {viewTabs.map((tab) => {
          const isActive = tab === activeTab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                isActive
                  ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#202636]'
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
          className="flex items-center space-x-1.5 px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 text-white text-[11px] font-medium transition-colors cursor-pointer shadow-sm shadow-indigo-950"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Decoding...</span>
            </>
          ) : (
            <>
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Open File</span>
            </>
          )}
        </button>
      </div>
    </nav>
  );
};

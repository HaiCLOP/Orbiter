import React from 'react';
import { Folder, FolderOpen, Music2, Sliders, ChevronRight, ChevronDown, Sparkles } from 'lucide-react';
import { useTrackStore } from '../store/trackStore';

export const ProjectBrowser: React.FC = () => {
  const { track } = useTrackStore();

  return (
    <aside className="w-56 bg-[#12151c] border-r border-[#222734] flex flex-col text-xs text-zinc-300 select-none overflow-hidden">
      {/* Top Project Tabs */}
      <div className="flex items-center border-b border-[#222734] px-2 text-[11px]">
        <button className="px-2.5 py-2 border-b-2 border-indigo-500 font-medium text-zinc-100">
          Project
        </button>
        <button className="px-2.5 py-2 text-zinc-500 hover:text-zinc-300 transition-colors">
          Media
        </button>
        <button className="px-2.5 py-2 text-zinc-500 hover:text-zinc-300 transition-colors">
          Presets
        </button>
      </div>

      {/* File Tree */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        <div className="flex items-center space-x-1.5 text-zinc-400 font-semibold text-[10px] uppercase tracking-wider px-1 py-1">
          <FolderOpen className="w-3.5 h-3.5 text-indigo-400" />
          <span>Orbit8D Project</span>
        </div>

        {/* Music Folder */}
        <div className="pl-2 space-y-0.5">
          <div className="flex items-center space-x-1 py-1 px-1.5 rounded text-zinc-300 font-medium">
            <ChevronDown className="w-3 h-3 text-zinc-500" />
            <Folder className="w-3.5 h-3.5 text-amber-400" />
            <span>Music</span>
          </div>

          <div className="pl-4 space-y-0.5">
            {track ? (
              <div className="flex items-center space-x-1.5 py-1 px-2 rounded bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 font-mono text-[11px]">
                <Music2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span className="truncate" title={track.file_name}>
                  {track.file_name}
                </span>
              </div>
            ) : (
              <span className="text-[10px] text-zinc-500 italic pl-2">No audio loaded</span>
            )}
          </div>
        </div>

        {/* 8D Presets Folder */}
        <div className="pl-2 space-y-0.5 pt-1">
          <div className="flex items-center space-x-1 py-1 px-1.5 rounded text-zinc-400">
            <ChevronRight className="w-3 h-3 text-zinc-500" />
            <Folder className="w-3.5 h-3.5 text-zinc-500" />
            <span>8D Presets</span>
          </div>
        </div>

        {/* Renders Folder */}
        <div className="pl-2 space-y-0.5">
          <div className="flex items-center space-x-1 py-1 px-1.5 rounded text-zinc-400">
            <ChevronRight className="w-3 h-3 text-zinc-500" />
            <Folder className="w-3.5 h-3.5 text-zinc-500" />
            <span>Renders</span>
          </div>
        </div>
      </div>

      {/* Bottom Effects Library Tree */}
      <div className="h-44 border-t border-[#222734] bg-[#0f1218] p-2 flex flex-col overflow-y-auto">
        <div className="flex items-center space-x-1.5 text-zinc-400 font-semibold text-[10px] uppercase tracking-wider mb-1">
          <Sliders className="w-3.5 h-3.5 text-indigo-400" />
          <span>Effects Library</span>
        </div>

        <div className="space-y-1 text-[11px] text-zinc-400">
          <div className="flex items-center space-x-1 px-1 py-0.5 rounded hover:bg-[#181d28] hover:text-zinc-200 cursor-pointer">
            <ChevronDown className="w-3 h-3 text-zinc-500" />
            <Sparkles className="w-3 h-3 text-cyan-400" />
            <span className="font-medium text-zinc-200">Spatial</span>
          </div>
          <div className="pl-5 space-y-0.5 text-[10px] text-zinc-500">
            <div>• 8D Orbit Panner</div>
            <div>• Binaural HRTF</div>
            <div>• Distance Attenuation</div>
          </div>
        </div>
      </div>
    </aside>
  );
};

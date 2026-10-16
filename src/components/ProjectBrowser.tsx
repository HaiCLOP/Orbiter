import React from 'react';
import { Folder, FolderOpen, Music2, Sliders, ChevronRight, ChevronDown, Sparkles, Waves, Disc } from 'lucide-react';
import { useTrackStore } from '../store/trackStore';

export const ProjectBrowser: React.FC = () => {
  const { track } = useTrackStore();

  return (
    <aside className="w-56 glass-panel border-y-0 border-l-0 border-r border-white/[0.08] flex flex-col text-xs text-slate-300 select-none overflow-hidden relative shadow-xl">
      {/* Top Segmented Tab Controls */}
      <div className="flex items-center p-2 border-b border-white/[0.06]">
        <div className="grid grid-cols-3 gap-1 w-full glass-card p-0.5 rounded-xl border border-white/[0.06] text-[10px] font-semibold text-center">
          <button className="py-1 rounded-lg bg-indigo-600/35 text-white border border-indigo-400/30 shadow-xs cursor-pointer">
            Project
          </button>
          <button className="py-1 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer">
            Media
          </button>
          <button className="py-1 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer">
            Presets
          </button>
        </div>
      </div>

      {/* File Tree */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
        <div className="flex items-center space-x-1.5 text-slate-400 font-bold text-[10px] uppercase tracking-wider px-1 py-1">
          <FolderOpen className="w-3.5 h-3.5 text-indigo-400" />
          <span>Orbit8D Workspace</span>
        </div>

        {/* Music Folder */}
        <div className="pl-1.5 space-y-1">
          <div className="flex items-center space-x-1.5 py-1 px-2 rounded-lg text-slate-200 font-semibold text-[11px] hover:bg-white/[0.04] transition-colors cursor-pointer">
            <ChevronDown className="w-3 h-3 text-slate-400" />
            <Folder className="w-3.5 h-3.5 text-amber-400" />
            <span>Audio Stems</span>
          </div>

          <div className="pl-4 space-y-1">
            {track ? (
              <div className="flex items-center space-x-2 py-1.5 px-2.5 rounded-xl glass-card border border-indigo-500/40 bg-indigo-950/20 text-indigo-200 font-mono text-[11px] shadow-[0_0_12px_rgba(99,102,241,0.2)]">
                <Music2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span className="truncate font-medium" title={track.file_name}>
                  {track.file_name}
                </span>
              </div>
            ) : (
              <span className="text-[10px] text-slate-500 italic pl-2">No audio loaded</span>
            )}
          </div>
        </div>

        {/* 8D Presets Folder */}
        <div className="pl-1.5 space-y-1 pt-1">
          <div className="flex items-center space-x-1.5 py-1 px-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] transition-colors cursor-pointer">
            <ChevronRight className="w-3 h-3 text-slate-500" />
            <Folder className="w-3.5 h-3.5 text-slate-500" />
            <span>8D Presets</span>
          </div>
        </div>

        {/* Renders Folder */}
        <div className="pl-1.5 space-y-1">
          <div className="flex items-center space-x-1.5 py-1 px-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] transition-colors cursor-pointer">
            <ChevronRight className="w-3 h-3 text-slate-500" />
            <Folder className="w-3.5 h-3.5 text-slate-500" />
            <span>Export Renders</span>
          </div>
        </div>
      </div>

      {/* Bottom Effects Rack Tree */}
      <div className="h-48 border-t border-white/[0.06] p-2.5 flex flex-col overflow-y-auto glass-card rounded-t-2xl m-1">
        <div className="flex items-center space-x-1.5 text-slate-300 font-bold text-[10px] uppercase tracking-wider mb-2">
          <Sliders className="w-3.5 h-3.5 text-cyan-400" />
          <span>DSP Modules</span>
        </div>

        <div className="space-y-1.5 text-[11px] text-slate-300">
          <div className="flex items-center space-x-1.5 px-2 py-1 rounded-lg glass-pill cursor-pointer border-cyan-500/20">
            <Sparkles className="w-3 h-3 text-cyan-400" />
            <span className="font-semibold text-slate-200">8D Spatial Panner</span>
          </div>

          <div className="flex items-center space-x-1.5 px-2 py-1 rounded-lg glass-pill cursor-pointer border-purple-500/20">
            <Waves className="w-3 h-3 text-purple-400" />
            <span className="font-semibold text-slate-200">FDN-8 Reverb Tank</span>
          </div>

          <div className="flex items-center space-x-1.5 px-2 py-1 rounded-lg glass-pill cursor-pointer border-emerald-500/20">
            <Disc className="w-3 h-3 text-emerald-400" />
            <span className="font-semibold text-slate-200">4-Band Parametric EQ</span>
          </div>
        </div>
      </div>
    </aside>
  );
};

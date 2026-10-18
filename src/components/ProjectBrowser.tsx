import { Folder, Music2, Sliders, ChevronRight, ChevronDown, Info } from 'lucide-react';
import { useTrackStore } from '../store/trackStore';
import { useWorkspaceStore } from '../store/workspaceStore';

export const ProjectBrowser: React.FC = () => {
  const { track } = useTrackStore();
  const { setAboutModalOpen } = useWorkspaceStore();

  return (
    <aside className="w-52 glass-panel border-y-0 border-l-0 border-r border-white/[0.08] flex flex-col text-xs text-zinc-300 select-none overflow-hidden relative">
      {/* Top Segmented Tab Controls */}
      <div className="flex items-center p-2 border-b border-white/[0.06]">
        <div className="grid grid-cols-3 gap-0.5 w-full glass-card p-0.5 rounded-lg border border-white/[0.06] text-[10px] font-medium text-center">
          <button className="py-1 rounded-md bg-white/15 text-white font-semibold cursor-pointer">
            Project
          </button>
          <button className="py-1 rounded-md text-zinc-400 hover:text-white transition-colors cursor-pointer">
            Media
          </button>
          <button className="py-1 rounded-md text-zinc-400 hover:text-white transition-colors cursor-pointer">
            Presets
          </button>
        </div>
      </div>

      {/* File Tree */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-1">
        <div className="flex items-center space-x-1.5 text-zinc-400 font-semibold text-[10px] uppercase tracking-wider px-1 py-1">
          <span>Orbiter Library</span>
        </div>

        {/* Music Folder */}
        <div className="pl-1 space-y-1">
          <div className="flex items-center space-x-1.5 py-1 px-2 rounded-md text-zinc-200 font-medium text-[11px] hover:bg-white/[0.04] transition-colors cursor-pointer">
            <ChevronDown className="w-3 h-3 text-zinc-500" />
            <Folder className="w-3.5 h-3.5 text-amber-400/80" />
            <span>Audio Stems</span>
          </div>

          <div className="pl-4 space-y-1">
            {track ? (
              <div className="flex items-center space-x-2 py-1 px-2 rounded-lg glass-card border border-white/[0.1] text-zinc-200 font-mono text-[11px]">
                <Music2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span className="truncate font-normal" title={track.file_name}>
                  {track.file_name}
                </span>
              </div>
            ) : (
              <span className="text-[10px] text-zinc-500 italic pl-2">No audio loaded</span>
            )}
          </div>
        </div>

        {/* 8D Presets Folder */}
        <div className="pl-1 space-y-1 pt-1">
          <div className="flex items-center space-x-1.5 py-1 px-2 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] transition-colors cursor-pointer">
            <ChevronRight className="w-3 h-3 text-zinc-600" />
            <Folder className="w-3.5 h-3.5 text-zinc-600" />
            <span>Trajectories</span>
          </div>
        </div>

        {/* Renders Folder */}
        <div className="pl-1 space-y-1">
          <div className="flex items-center space-x-1.5 py-1 px-2 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] transition-colors cursor-pointer">
            <ChevronRight className="w-3 h-3 text-zinc-600" />
            <Folder className="w-3.5 h-3.5 text-zinc-600" />
            <span>Masters</span>
          </div>
        </div>
      </div>

      {/* Bottom Effects Rack Tree */}
      <div className="h-44 border-t border-white/[0.06] p-2.5 flex flex-col overflow-y-auto glass-card rounded-t-xl m-1">
        <div className="flex items-center space-x-1.5 text-zinc-400 font-semibold text-[10px] uppercase tracking-wider mb-2">
          <Sliders className="w-3 h-3 text-zinc-400" />
          <span>DSP Signal Chain</span>
        </div>

        <div className="space-y-1 text-[11px] text-zinc-300">
          <div className="flex items-center space-x-2 px-2 py-1 rounded-md glass-pill cursor-pointer">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
            <span className="font-medium text-zinc-200">8D Spatial Panner</span>
          </div>

          <div className="flex items-center space-x-2 px-2 py-1 rounded-md glass-pill cursor-pointer">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
            <span className="font-medium text-zinc-200">FDN-8 Reverb Tank</span>
          </div>

          <div className="flex items-center space-x-2 px-2 py-1 rounded-md glass-pill cursor-pointer">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="font-medium text-zinc-200">4-Band Cascaded EQ</span>
          </div>
        </div>
      </div>

      {/* HaiCLOP Labs Attribution & About Link */}
      <div className="px-3 py-2 border-t border-white/[0.06] flex items-center justify-between text-[10px] text-zinc-500 font-medium">
        <span className="text-zinc-400 font-semibold tracking-wide">HaiCLOP Labs</span>
        <button
          onClick={() => setAboutModalOpen(true)}
          className="flex items-center space-x-1 text-sky-400/90 hover:text-sky-300 transition-colors cursor-pointer"
        >
          <Info className="w-2.5 h-2.5" />
          <span>About</span>
        </button>
      </div>
    </aside>
  );
};

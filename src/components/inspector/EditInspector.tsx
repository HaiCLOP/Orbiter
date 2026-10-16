import React from 'react';
import { Scissors, SplitSquareVertical, ZoomIn, ZoomOut, RotateCcw, Clock } from 'lucide-react';
import { useTrackStore } from '../../store/trackStore';

export const EditInspector: React.FC = () => {
  const { track, position, duration, seek } = useTrackStore();

  const posSec = position.toFixed(3);
  const durSec = duration.toFixed(3);

  return (
    <div className="space-y-4 select-none">
      <section className="space-y-2.5">
        <div className="flex items-center justify-between text-zinc-400 font-semibold text-[11px] uppercase tracking-wider">
          <div className="flex items-center space-x-1.5">
            <Scissors className="w-3.5 h-3.5 text-indigo-400" />
            <span>Clip & Timeline Tools</span>
          </div>
        </div>

        <div className="bg-[#181d28] rounded-md p-2.5 border border-[#262c3a] space-y-3">
          {/* Playhead Position */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px]">
              <span className="text-zinc-400">Playhead Cursor</span>
              <span className="font-mono text-indigo-300 text-[10px]">
                {posSec}s / {durSec}s
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => seek(0)}
                className="flex-1 py-1 rounded bg-[#202636] hover:bg-[#283042] text-[10px] font-mono text-zinc-300 flex items-center justify-center space-x-1 cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>To Start</span>
              </button>
              <button
                onClick={() => seek(duration * 0.5)}
                className="flex-1 py-1 rounded bg-[#202636] hover:bg-[#283042] text-[10px] font-mono text-zinc-300 flex items-center justify-center space-x-1 cursor-pointer transition-colors"
              >
                <Clock className="w-3 h-3" />
                <span>To Mid (50%)</span>
              </button>
            </div>
          </div>

          {/* Quick Trimming & Split (Staged) */}
          <div className="pt-2 border-t border-[#232938] space-y-2">
            <div className="flex items-center justify-between text-[11px] text-zinc-300">
              <span>Edit Operations</span>
              <span className="text-[9px] font-mono text-zinc-500 bg-[#202636] px-1 rounded">Non-destructive</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                disabled={!track}
                className="p-1.5 rounded bg-[#202636] hover:bg-[#283042] disabled:opacity-40 text-[10px] text-zinc-300 flex items-center justify-center space-x-1 cursor-pointer transition-colors"
              >
                <SplitSquareVertical className="w-3 h-3 text-cyan-400" />
                <span>Split at Cursor</span>
              </button>
              <button
                disabled={!track}
                className="p-1.5 rounded bg-[#202636] hover:bg-[#283042] disabled:opacity-40 text-[10px] text-zinc-300 flex items-center justify-center space-x-1 cursor-pointer transition-colors"
              >
                <Scissors className="w-3 h-3 text-amber-400" />
                <span>Trim Silence</span>
              </button>
            </div>
          </div>

          {/* Zoom Level */}
          <div className="pt-2 border-t border-[#232938] space-y-1">
            <div className="flex justify-between text-[11px] text-zinc-300">
              <span>Waveform Zoom</span>
              <span className="font-mono text-zinc-400 text-[10px]">100%</span>
            </div>
            <div className="flex items-center space-x-2">
              <button className="p-1 rounded bg-[#202636] hover:bg-[#283042] text-zinc-300 cursor-pointer">
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <div className="flex-1 h-1.5 bg-[#262c3a] rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 w-1/3" />
              </div>
              <button className="p-1 rounded bg-[#202636] hover:bg-[#283042] text-zinc-300 cursor-pointer">
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

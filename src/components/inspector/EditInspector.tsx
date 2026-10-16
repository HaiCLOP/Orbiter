import React from 'react';
import { Scissors, SplitSquareVertical, ZoomIn, ZoomOut, RotateCcw, Clock } from 'lucide-react';
import { useTrackStore } from '../../store/trackStore';

export const EditInspector: React.FC = () => {
  const { track, position, duration, seek } = useTrackStore();

  const posSec = position.toFixed(3);
  const durSec = duration.toFixed(3);

  return (
    <div className="space-y-4 select-none">
      <section className="space-y-2">
        <div className="flex items-center justify-between text-slate-400 font-bold text-[10px] uppercase tracking-wider px-1">
          <div className="flex items-center space-x-1.5">
            <Scissors className="w-3.5 h-3.5 text-indigo-400" />
            <span>Clip & Timeline Tools</span>
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-3.5 space-y-3.5 shadow-md">
          {/* Playhead Position */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-400 font-medium">Playhead Position</span>
              <span className="font-mono tabular-nums text-cyan-300 text-[10px] font-bold">
                {posSec}s / {durSec}s
              </span>
            </div>
            <div className="flex items-center space-x-2 pt-0.5">
              <button
                onClick={() => seek(0)}
                className="flex-1 py-1.5 rounded-xl glass-card hover:bg-white/[0.08] text-[10px] font-mono text-slate-200 flex items-center justify-center space-x-1.5 cursor-pointer transition-all active:scale-95"
              >
                <RotateCcw className="w-3 h-3 text-cyan-400" />
                <span>To Start</span>
              </button>
              <button
                onClick={() => seek(duration * 0.5)}
                className="flex-1 py-1.5 rounded-xl glass-card hover:bg-white/[0.08] text-[10px] font-mono text-slate-200 flex items-center justify-center space-x-1.5 cursor-pointer transition-all active:scale-95"
              >
                <Clock className="w-3 h-3 text-indigo-400" />
                <span>Midpoint</span>
              </button>
            </div>
          </div>

          {/* Quick Trimming & Split */}
          <div className="pt-2 border-t border-white/[0.06] space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-300 font-medium">
              <span>Non-Destructive Edits</span>
              <span className="glass-pill px-2 py-0.2 rounded-full text-[9px] font-mono text-slate-400">RAM buffer</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                disabled={!track}
                className="p-2 rounded-xl glass-card hover:bg-white/[0.08] disabled:opacity-30 text-[10px] text-slate-200 flex items-center justify-center space-x-1.5 cursor-pointer transition-all active:scale-95 font-semibold"
              >
                <SplitSquareVertical className="w-3 h-3 text-cyan-400" />
                <span>Split at Cursor</span>
              </button>
              <button
                disabled={!track}
                className="p-2 rounded-xl glass-card hover:bg-white/[0.08] disabled:opacity-30 text-[10px] text-slate-200 flex items-center justify-center space-x-1.5 cursor-pointer transition-all active:scale-95 font-semibold"
              >
                <Scissors className="w-3 h-3 text-amber-400" />
                <span>Trim Silence</span>
              </button>
            </div>
          </div>

          {/* Zoom Level */}
          <div className="pt-2 border-t border-white/[0.06] space-y-1.5">
            <div className="flex justify-between text-[11px] text-slate-300 font-medium">
              <span>Waveform Display Zoom</span>
              <span className="font-mono tabular-nums text-slate-400 text-[10px] font-bold">100%</span>
            </div>
            <div className="flex items-center space-x-2">
              <button className="p-1.5 rounded-lg glass-pill text-slate-300 hover:text-white cursor-pointer">
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <div className="flex-1 h-2 bg-white/[0.08] rounded-full overflow-hidden p-0.5 shadow-inner">
                <div className="h-full bg-indigo-500 rounded-full w-1/3 shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
              </div>
              <button className="p-1.5 rounded-lg glass-pill text-slate-300 hover:text-white cursor-pointer">
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

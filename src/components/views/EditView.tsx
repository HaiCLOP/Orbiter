import React from 'react';
import { WaveformPreview } from '../WaveformPreview';
import { useTrackStore } from '../../store/trackStore';
import { Scissors, Music, Sparkles } from 'lucide-react';

export const EditView: React.FC = () => {
  const { loaded, openAndLoadTrack, duration, position } = useTrackStore();

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-transparent select-none">
      {/* Edit Header Bar */}
      <div className="h-10 glass-panel mx-3 mt-3 px-4 rounded-xl flex items-center justify-between text-xs shadow-md">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 text-slate-100 font-bold text-[11px] tracking-tight">
            <Scissors className="w-3.5 h-3.5 text-indigo-400" />
            <span>Audio Waveform Timeline</span>
          </div>

          <div className="flex items-center space-x-2 text-[10px] font-mono tabular-nums text-slate-400">
            <span className="glass-pill px-2.5 py-0.5 rounded-full text-slate-300">
              Cursor: <span className="text-cyan-300 font-bold">{position.toFixed(3)}s</span>
            </span>
            <span className="glass-pill px-2.5 py-0.5 rounded-full text-slate-300">
              Duration: <span className="text-slate-100 font-semibold">{duration.toFixed(3)}s</span>
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-[10px] text-slate-400 font-mono">
          <span className="glass-pill px-2 py-0.5 rounded-full text-indigo-300 border-indigo-500/30 font-bold">
            Non-Destructive Slices
          </span>
        </div>
      </div>

      {/* Main Waveform Display Area */}
      <div className="flex-1 flex flex-col relative overflow-hidden m-3 mt-2 rounded-2xl glass-panel shadow-lg">
        {!loaded ? (
          <div
            onClick={openAndLoadTrack}
            className="flex-1 flex flex-col items-center justify-center p-8 text-center cursor-pointer hover:bg-white/[0.02] transition-colors group relative overflow-hidden"
          >
            <div className="w-16 h-16 rounded-3xl glass-card flex items-center justify-center text-slate-400 group-hover:text-indigo-400 group-hover:border-indigo-500/40 group-hover:scale-105 transition-all mb-3.5 shadow-2xl relative z-10">
              <Music className="w-7 h-7" />
            </div>
            <h3 className="text-sm font-bold text-slate-100 mb-1 relative z-10 tracking-tight">
              No audio track loaded
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mb-4 relative z-10">
              Click anywhere or press "Open File" in the toolbar to import a track.
            </p>
            <div className="glass-pill px-3 py-1 rounded-full text-[11px] text-indigo-300 border-indigo-500/30 font-semibold shadow-xs flex items-center space-x-1.5 relative z-10">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Import Audio Track</span>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col p-3 overflow-hidden">
            <div className="flex-1 rounded-xl glass-card border border-white/[0.08] overflow-hidden flex flex-col shadow-inner">
              <div className="h-7 border-b border-white/[0.06] px-3.5 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                <span>Stereo 2.0 Dual-Channel Waveform Invariant</span>
                <span>100% Fit Window</span>
              </div>
              <div className="flex-1 relative overflow-hidden">
                <WaveformPreview />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

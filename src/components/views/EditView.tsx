import React from 'react';
import { WaveformPreview } from '../WaveformPreview';
import { useTrackStore } from '../../store/trackStore';
import { Scissors, Music, FolderOpen } from 'lucide-react';

export const EditView: React.FC = () => {
  const { loaded, openAndLoadTrack, duration, position } = useTrackStore();

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-transparent select-none">
      {/* Edit Header Bar */}
      <div className="h-9 glass-panel mx-3 mt-3 px-3.5 rounded-xl flex items-center justify-between text-xs">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 text-zinc-100 font-medium text-[11px] tracking-tight">
            <Scissors className="w-3.5 h-3.5 text-zinc-400" />
            <span>Waveform Timeline</span>
          </div>

          <div className="flex items-center space-x-2 text-[10px] font-mono tabular-nums text-zinc-400">
            <span className="glass-pill px-2 py-0.5 rounded-md text-zinc-300">
              Position: <span className="text-zinc-100 font-medium">{position.toFixed(3)}s</span>
            </span>
            <span className="glass-pill px-2 py-0.5 rounded-md text-zinc-300">
              Duration: <span className="text-zinc-100 font-medium">{duration.toFixed(3)}s</span>
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-[10px] text-zinc-500 font-mono">
          <span className="glass-pill px-2 py-0.5 rounded-md text-zinc-400 font-medium">
            Non-Destructive Scrubbing
          </span>
        </div>
      </div>

      {/* Main Waveform Display Area */}
      <div className="flex-1 flex flex-col relative overflow-hidden m-3 mt-2 rounded-2xl glass-panel">
        {!loaded ? (
          <div
            onClick={openAndLoadTrack}
            className="flex-1 flex flex-col items-center justify-center p-8 text-center cursor-pointer hover:bg-white/[0.02] transition-colors group relative overflow-hidden"
          >
            <div className="w-14 h-14 rounded-2xl glass-card flex items-center justify-center text-zinc-400 group-hover:text-white transition-all mb-3 shadow-xs">
              <Music className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-zinc-100 mb-1 tracking-tight">
              No Audio Track Loaded
            </h3>
            <p className="text-xs text-zinc-400 max-w-sm mb-3">
              Open an audio file in the toolbar to inspect samples and slices.
            </p>
            <div className="glass-pill px-3 py-1 rounded-md text-[11px] text-zinc-300 font-medium shadow-xs flex items-center space-x-1.5">
              <FolderOpen className="w-3.5 h-3.5 text-zinc-400" />
              <span>Import Audio Track</span>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col p-3 overflow-hidden">
            <div className="flex-1 rounded-xl glass-card border border-white/[0.08] overflow-hidden flex flex-col">
              <div className="h-7 border-b border-white/[0.06] px-3.5 flex items-center justify-between text-[10px] text-zinc-400 font-mono">
                <span>Stereo 2.0 Dual-Channel Waveform</span>
                <span>Fit Window</span>
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

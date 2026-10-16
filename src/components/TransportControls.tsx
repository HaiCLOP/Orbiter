import React from 'react';
import { Play, Pause, Square, SkipBack, Camera, Settings2 } from 'lucide-react';
import { useTrackStore } from '../store/trackStore';

/**
 * Inputs: `seconds`
 * Outputs: `HH:MM:SS:MS` string (e.g. 00:00:32:417)
 */
function formatTimecode(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00:00:000';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.floor((seconds % 1) * 1000);

  return `${hrs.toString().padStart(2, '0')}:${mins
    .toString()
    .padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${millis
    .toString()
    .padStart(3, '0')}`;
}

export const TransportControls: React.FC = () => {
  const { loaded, isPlaying, position, duration, play, pause, stop, seek } = useTrackStore();

  const handleTogglePlay = () => {
    if (!loaded) return;
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  };

  const handleRewind = () => {
    seek(0);
  };

  return (
    <div className="h-12 glass-panel border-x-0 border-b-0 border-t border-white/[0.08] px-4 flex items-center justify-between select-none relative z-20">
      {/* Left: Quick In/Out Tools */}
      <div className="flex items-center space-x-2 text-slate-400">
        <button
          title="Rewind to start"
          onClick={handleRewind}
          disabled={!loaded}
          className="glass-pill p-1.5 rounded-lg hover:text-white disabled:opacity-30 transition-all cursor-pointer active:scale-95"
        >
          <SkipBack className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Center: Precision Timecode Display & Transport Controls */}
      <div className="flex items-center space-x-4">
        {/* Glowing Timecode Display */}
        <div className="flex items-center space-x-2 glass-card px-3.5 py-1 rounded-xl border border-white/[0.1] font-mono tabular-nums shadow-inner">
          <span className="text-[12px] font-bold text-cyan-400 tracking-wider drop-shadow-[0_0_8px_rgba(6,182,212,0.4)]">
            {formatTimecode(position)}
          </span>
          <span className="text-[11px] text-white/20">/</span>
          <span className="text-[11px] text-slate-400 font-medium">
            {formatTimecode(duration)}
          </span>
        </div>

        {/* Transport Buttons */}
        <div className="flex items-center space-x-2">
          {/* Play/Pause */}
          <button
            onClick={handleTogglePlay}
            disabled={!loaded}
            title={isPlaying ? 'Pause' : 'Play'}
            className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all cursor-pointer border ${
              isPlaying
                ? 'bg-amber-500/90 hover:bg-amber-400 text-slate-950 border-amber-300/40 shadow-[0_0_16px_rgba(245,158,11,0.5)] active:scale-95'
                : 'bg-indigo-600/90 hover:bg-indigo-500 text-white border-indigo-400/30 shadow-[0_0_16px_rgba(99,102,241,0.4)] disabled:opacity-30 active:scale-95'
            }`}
          >
            {isPlaying ? (
              <Pause className="w-3.5 h-3.5 fill-current" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
            )}
          </button>

          {/* Stop */}
          <button
            onClick={stop}
            disabled={!loaded}
            title="Stop"
            className="w-8 h-8 rounded-xl glass-card hover:bg-white/[0.1] text-slate-300 hover:text-white flex items-center justify-center transition-all disabled:opacity-30 cursor-pointer active:scale-95"
          >
            <Square className="w-3 h-3 fill-current" />
          </button>
        </div>
      </div>

      {/* Right: Quality & Settings Status */}
      <div className="flex items-center space-x-2.5 text-slate-400 text-xs">
        <div className="flex items-center space-x-1.5 glass-pill px-2.5 py-1 rounded-lg text-[10px] font-mono">
          <span className="text-slate-400">Quality:</span>
          <span className="font-bold text-slate-200">Full 32-Bit</span>
        </div>

        <button
          title="Snapshot"
          className="glass-pill p-1.5 rounded-lg hover:text-white transition-all cursor-pointer"
        >
          <Camera className="w-3.5 h-3.5" />
        </button>

        <button
          title="Audio Settings"
          className="glass-pill p-1.5 rounded-lg hover:text-white transition-all cursor-pointer"
        >
          <Settings2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

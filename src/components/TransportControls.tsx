import React from 'react';
import { Play, Pause, Square, SkipBack, Volume2 } from 'lucide-react';
import { useTrackStore } from '../store/trackStore';

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
      <div className="flex items-center space-x-2 text-zinc-400">
        <button
          title="Rewind to start"
          onClick={handleRewind}
          disabled={!loaded}
          className="glass-pill p-1.5 rounded-md hover:text-white disabled:opacity-30 transition-all cursor-pointer active:scale-95"
        >
          <SkipBack className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Center: Precision Timecode & Apple Transport Buttons */}
      <div className="flex items-center space-x-4">
        {/* Timecode Display */}
        <div className="flex items-center space-x-2 glass-card px-3 py-1 rounded-lg border border-white/[0.08] font-mono tabular-nums">
          <span className="text-[12px] font-semibold text-zinc-100 tracking-wider">
            {formatTimecode(position)}
          </span>
          <span className="text-[11px] text-zinc-500">/</span>
          <span className="text-[11px] text-zinc-400 font-normal">
            {formatTimecode(duration)}
          </span>
        </div>

        {/* Transport Buttons */}
        <div className="flex items-center space-x-1.5">
          {/* Play/Pause */}
          <button
            onClick={handleTogglePlay}
            disabled={!loaded}
            title={isPlaying ? 'Pause' : 'Play'}
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              isPlaying
                ? 'bg-white text-zinc-950 hover:bg-zinc-200 shadow-sm active:scale-95'
                : 'bg-white/15 hover:bg-white/25 text-white border border-white/20 disabled:opacity-30 active:scale-95'
            }`}
          >
            {isPlaying ? (
              <Pause className="w-3 h-3 fill-current" />
            ) : (
              <Play className="w-3 h-3 fill-current ml-0.5" />
            )}
          </button>

          {/* Stop */}
          <button
            onClick={stop}
            disabled={!loaded}
            title="Stop"
            className="w-7 h-7 rounded-full glass-card hover:bg-white/[0.1] text-zinc-400 hover:text-white flex items-center justify-center transition-all disabled:opacity-30 cursor-pointer active:scale-95"
          >
            <Square className="w-2.5 h-2.5 fill-current" />
          </button>
        </div>
      </div>

      {/* Right: Quality & Status */}
      <div className="flex items-center space-x-2 text-zinc-400 text-xs">
        <div className="flex items-center space-x-1.5 glass-pill px-2.5 py-1 rounded-md text-[10px] font-mono">
          <Volume2 className="w-3 h-3 text-zinc-400" />
          <span className="text-zinc-300 font-medium">Binaural 3D</span>
        </div>
        <span className="text-[10px] font-mono text-zinc-500 tabular-nums">
          48 kHz / 32-bit
        </span>
      </div>
    </div>
  );
};

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
    <div className="h-11 bg-[#141822] border-y border-[#222734] px-4 flex items-center justify-between select-none">
      {/* Left: Quick In/Out Tools */}
      <div className="flex items-center space-x-2 text-zinc-400">
        <button
          title="Rewind to start"
          onClick={handleRewind}
          disabled={!loaded}
          className="p-1 rounded hover:bg-[#202534] hover:text-zinc-200 disabled:opacity-40 transition-colors"
        >
          <SkipBack className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Center: Precision Timecode Display & Transport Controls */}
      <div className="flex items-center space-x-5">
        {/* Glowing Timecode Display */}
        <div className="flex items-center space-x-2 bg-[#0c0e14] px-3 py-1 rounded-md border border-[#232938] font-mono shadow-inner">
          <span className="text-[13px] font-bold text-cyan-400 tracking-wider">
            {formatTimecode(position)}
          </span>
          <span className="text-[11px] text-zinc-600">/</span>
          <span className="text-[11px] text-zinc-400">{formatTimecode(duration)}</span>
        </div>

        {/* Transport Buttons */}
        <div className="flex items-center space-x-2">
          {/* Play/Pause */}
          <button
            onClick={handleTogglePlay}
            disabled={!loaded}
            title={isPlaying ? 'Pause' : 'Play'}
            className={`w-7 h-7 rounded-md flex items-center justify-center transition-all cursor-pointer ${
              isPlaying
                ? 'bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-sm shadow-amber-950'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-950 disabled:opacity-40'
            }`}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
          </button>

          {/* Stop */}
          <button
            onClick={stop}
            disabled={!loaded}
            title="Stop"
            className="w-7 h-7 rounded-md bg-[#202534] hover:bg-[#282f42] text-zinc-300 flex items-center justify-center transition-colors disabled:opacity-40 cursor-pointer"
          >
            <Square className="w-3 h-3 fill-current" />
          </button>
        </div>
      </div>

      {/* Right: Quality & Snapshot Status */}
      <div className="flex items-center space-x-3 text-zinc-400 text-xs">
        <div className="flex items-center space-x-1.5 bg-[#181d28] px-2 py-0.5 rounded border border-[#262c3a] text-[11px]">
          <span className="text-zinc-500">Quality:</span>
          <span className="font-semibold text-zinc-200">Full</span>
        </div>

        <button
          title="Snapshot"
          className="p-1 rounded hover:bg-[#202534] hover:text-zinc-200 transition-colors"
        >
          <Camera className="w-3.5 h-3.5" />
        </button>

        <button
          title="Audio Settings"
          className="p-1 rounded hover:bg-[#202534] hover:text-zinc-200 transition-colors"
        >
          <Settings2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

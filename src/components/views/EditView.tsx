import React from 'react';
import { WaveformPreview } from '../WaveformPreview';
import { useTrackStore } from '../../store/trackStore';
import { Scissors } from 'lucide-react';

export const EditView: React.FC = () => {
  const { loaded, openAndLoadTrack, duration, position } = useTrackStore();

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Edit Header Bar */}
      <div className="h-10 bg-[#12151c] border-b border-[#222734] px-4 flex items-center justify-between text-xs select-none">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1.5 text-zinc-300 font-semibold text-[11px]">
            <Scissors className="w-3.5 h-3.5 text-indigo-400" />
            <span>Track Timeline & Editor</span>
          </div>

          <div className="flex items-center space-x-2 text-[10px] font-mono text-zinc-400">
            <span className="bg-[#181d28] px-2 py-0.5 rounded border border-[#262c3a]">
              Cursor: {position.toFixed(3)}s
            </span>
            <span className="bg-[#181d28] px-2 py-0.5 rounded border border-[#262c3a]">
              Total: {duration.toFixed(3)}s
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-[11px] text-zinc-400 font-mono">
          <span>Non-destructive Edit Buffer</span>
        </div>
      </div>

      {/* Main Waveform Display Area */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        {!loaded ? (
          <div
            onClick={openAndLoadTrack}
            className="flex-1 flex flex-col items-center justify-center p-8 text-center cursor-pointer hover:bg-[#141824]/40 transition-colors group"
          >
            <div className="w-14 h-14 rounded-2xl bg-[#181d28] border border-[#262c3a] group-hover:border-indigo-500/50 flex items-center justify-center text-zinc-400 group-hover:text-indigo-400 group-hover:scale-105 transition-all mb-3 shadow-lg">
              <span className="text-2xl">🎵</span>
            </div>
            <h3 className="text-sm font-semibold text-zinc-200 mb-1">
              No audio track loaded
            </h3>
            <p className="text-xs text-zinc-500 max-w-sm mb-4">
              Click anywhere or press "Open File" in the toolbar to import a track.
            </p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col p-4 bg-[#0c0e14] overflow-hidden">
            <div className="flex-1 bg-[#12151c] rounded-lg border border-[#222734] overflow-hidden flex flex-col">
              <div className="h-7 bg-[#161a24] border-b border-[#222734] px-3 flex items-center justify-between text-[10px] text-zinc-400 font-mono">
                <span>Channel 1 (Left) & Channel 2 (Right) Waveform Envelopes</span>
                <span>Zoom: 100% (Fit to Window)</span>
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

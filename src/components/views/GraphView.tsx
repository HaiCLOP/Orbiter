import React from 'react';
import { WaveformPreview } from '../WaveformPreview';
import { useTrackStore } from '../../store/trackStore';
import { Network, Lock } from 'lucide-react';

export const GraphView: React.FC = () => {
  const { loaded, openAndLoadTrack } = useTrackStore();

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Graph Automation Canvas */}
      <div className="h-64 bg-[#141822] border-b border-[#232938] p-4 flex flex-col justify-between relative overflow-hidden select-none">
        <div className="flex items-center justify-between pb-2 border-b border-[#232938]">
          <div className="flex items-center space-x-2">
            <Network className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-semibold text-zinc-200">
              Multi-Lane Automation Graph Editor
            </span>
            <span className="text-[10px] text-zinc-500 font-mono bg-[#1a202c] px-2 py-0.5 rounded border border-[#232938] flex items-center gap-1">
              <Lock className="w-2.5 h-2.5" />
              Full Automation Engine Staged for Step 7
            </span>
          </div>

          <div className="flex items-center space-x-4 text-[11px] font-mono">
            <span className="flex items-center gap-1.5 text-cyan-400">
              <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" /> Azimuth (L↔R)
            </span>
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> Distance Falloff
            </span>
            <span className="flex items-center gap-1.5 text-amber-400">
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Elevation Shelf
            </span>
            <span className="flex items-center gap-1.5 text-purple-400">
              <span className="w-2 h-2 rounded-full bg-purple-400 inline-block" /> Reverb Wet Send
            </span>
          </div>
        </div>

        {/* Automation Curve Area */}
        <div className="relative flex-1 my-2 bg-[#0c0e14] rounded-lg border border-[#1e2330] overflow-hidden flex items-center">
          <div className="absolute inset-0 flex justify-between px-8 pointer-events-none opacity-20">
            {['00:00', '00:30', '01:00', '01:30', '02:00', '02:30', '03:00'].map((tc) => (
              <div key={tc} className="flex flex-col items-center">
                <span className="text-[9px] text-zinc-500 font-mono">{tc}</span>
                <div className="w-[1px] h-full bg-zinc-700" />
              </div>
            ))}
          </div>

          <svg className="w-full h-full p-2" viewBox="0 0 600 120" preserveAspectRatio="none">
            {/* Azimuth LFO */}
            <path
              d="M 0 60 Q 75 15 150 60 T 300 60 T 450 60 T 600 60"
              fill="none"
              stroke="#22d3ee"
              strokeWidth="2.5"
            />
            {/* Distance falloff */}
            <path
              d="M 0 40 Q 150 85 300 35 T 600 50"
              fill="none"
              stroke="#34d399"
              strokeWidth="2"
            />
            {/* Elevation */}
            <path
              d="M 0 80 Q 200 30 400 90 T 600 70"
              fill="none"
              stroke="#fbbf24"
              strokeWidth="2"
            />
            {/* Reverb Send */}
            <path
              d="M 0 95 Q 250 70 450 100 T 600 80"
              fill="none"
              stroke="#c084fc"
              strokeWidth="2"
            />
          </svg>
        </div>

        <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
          <span>Interpolation: Cubic Hermite / Bezier with Velocity Handles</span>
          <span>4 Active Automation Lanes</span>
        </div>
      </div>

      {/* Waveform Tab Header */}
      <div className="h-7 bg-[#12151c] border-b border-[#222734] px-4 flex items-center justify-between text-[11px] text-zinc-400">
        <span className="text-cyan-400 font-semibold border-b border-cyan-400 pb-0.5 cursor-pointer">
          Timeline Alignment
        </span>
        <div className="text-[10px] text-zinc-500 font-mono">
          {loaded ? 'Synchronized to Master Clock' : 'No track loaded'}
        </div>
      </div>

      {/* Waveform Display Area */}
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
              Click anywhere or press "Open File" to load audio.
            </p>
          </div>
        ) : (
          <WaveformPreview />
        )}
      </div>
    </div>
  );
};

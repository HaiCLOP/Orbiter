import React from 'react';
import { WaveformPreview } from '../WaveformPreview';
import { useTrackStore } from '../../store/trackStore';
import { Download, Lock } from 'lucide-react';

export const RenderView: React.FC = () => {
  const { loaded, track, openAndLoadTrack, duration } = useTrackStore();

  const estimatedWavSizeMb = ((duration * 48000 * 2 * 3) / (1024 * 1024)).toFixed(1);
  const estimatedMp3SizeMb = ((duration * 320 * 1000) / (8 * 1024 * 1024)).toFixed(1);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Mastering & Render Overview */}
      <div className="bg-[#141822] border-b border-[#232938] p-4 select-none">
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#232938]/60">
          <div className="flex items-center space-x-2">
            <Download className="w-4 h-4 text-indigo-400" />
            <h2 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider">
              Offline Mastering & Render Studio
            </h2>
            <span className="text-[10px] text-zinc-500 font-mono bg-[#1a202c] px-2 py-0.5 rounded border border-[#232938] flex items-center gap-1">
              <Lock className="w-2.5 h-2.5" />
              High-Precision Offline Exporter Staged for Step 10
            </span>
          </div>

          <div className="flex items-center space-x-3 text-[10px] font-mono text-zinc-400">
            <span>64-bit Floating Point Internal Busses</span>
          </div>
        </div>

        {/* Render Specs Grid */}
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-[#181d28] p-3 rounded-lg border border-[#283042]">
            <span className="text-[10px] text-zinc-400 font-medium block">Target Loudness</span>
            <span className="text-sm font-semibold text-emerald-400 font-mono mt-1 block">-14.0 LUFS</span>
            <span className="text-[9px] text-zinc-500">True Peak Clamped to -1.0 dBFS</span>
          </div>

          <div className="bg-[#181d28] p-3 rounded-lg border border-[#283042]">
            <span className="text-[10px] text-zinc-400 font-medium block">Audio Encoding</span>
            <span className="text-sm font-semibold text-zinc-200 font-mono mt-1 block">WAV / MP3 320k</span>
            <span className="text-[9px] text-zinc-500">Dual Stereo Spatial Master</span>
          </div>

          <div className="bg-[#181d28] p-3 rounded-lg border border-[#283042]">
            <span className="text-[10px] text-zinc-400 font-medium block">Estimated File Size</span>
            <span className="text-sm font-semibold text-cyan-400 font-mono mt-1 block">
              {loaded ? `~${estimatedWavSizeMb} MB (WAV)` : '—'}
            </span>
            <span className="text-[9px] text-zinc-500">{loaded ? `~${estimatedMp3SizeMb} MB (MP3)` : 'Awaiting audio track'}</span>
          </div>

          <div className="bg-[#181d28] p-3 rounded-lg border border-[#283042] flex flex-col justify-between">
            <span className="text-[10px] text-zinc-400 font-medium block">Master DSP Chain</span>
            <span className="text-xs font-semibold text-indigo-300 font-mono block">8D + 3D + FDN8 + EQ</span>
            <span className="text-[9px] text-emerald-400 font-mono">100% Parameter Sync</span>
          </div>
        </div>
      </div>

      {/* Waveform Tab Header */}
      <div className="h-7 bg-[#12151c] border-b border-[#222734] px-4 flex items-center justify-between text-[11px] text-zinc-400">
        <span className="text-indigo-400 font-semibold border-b border-indigo-400 pb-0.5 cursor-pointer">
          Source Render Scope
        </span>
        <div className="text-[10px] text-zinc-500 font-mono">
          {loaded ? track?.file_name : 'No track loaded'}
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

import React from 'react';
import { WaveformPreview } from '../WaveformPreview';
import { useTrackStore } from '../../store/trackStore';
import { Download, Lock, Music, FolderOpen } from 'lucide-react';

export const RenderView: React.FC = () => {
  const { loaded, track, openAndLoadTrack, duration } = useTrackStore();

  const estimatedWavSizeMb = ((duration * 48000 * 2 * 3) / (1024 * 1024)).toFixed(1);
  const estimatedMp3SizeMb = ((duration * 320 * 1000) / (8 * 1024 * 1024)).toFixed(1);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-transparent select-none">
      {/* Mastering & Render Overview */}
      <div className="glass-panel m-3 mb-2 p-4 rounded-2xl select-none relative overflow-hidden">
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/[0.06] relative z-10">
          <div className="flex items-center space-x-2">
            <Download className="w-4 h-4 text-zinc-300" />
            <h2 className="text-xs font-semibold text-zinc-100 uppercase tracking-wider">
              Offline 8D Mastering Console
            </h2>
            <span className="glass-pill px-2.5 py-0.5 rounded-md text-[9px] text-zinc-400 font-mono flex items-center gap-1">
              <Lock className="w-2.5 h-2.5" />
              Step 10 Offline Exporter Staged
            </span>
          </div>

          <div className="flex items-center space-x-3 text-[10px] font-mono text-zinc-500">
            <span className="glass-pill px-2 py-0.5 rounded-md text-zinc-400">
              64-bit Floating Point Internal Buses
            </span>
          </div>
        </div>

        {/* Render Specs Grid */}
        <div className="grid grid-cols-4 gap-3 relative z-10">
          <div className="glass-card p-3 rounded-xl border border-white/[0.08]">
            <span className="text-[10px] text-zinc-400 font-medium block uppercase tracking-wider">Target Loudness</span>
            <span className="text-sm font-semibold text-emerald-400 font-mono tabular-nums mt-1 block">-14.0 LUFS</span>
            <span className="text-[9px] text-zinc-500 font-mono">True Peak -1.0 dBFS</span>
          </div>

          <div className="glass-card p-3 rounded-xl border border-white/[0.08]">
            <span className="text-[10px] text-zinc-400 font-medium block uppercase tracking-wider">Audio Encoding</span>
            <span className="text-sm font-semibold text-zinc-100 font-mono mt-1 block">WAV / MP3 320k</span>
            <span className="text-[9px] text-zinc-500 font-mono">Dual Stereo Spatial Master</span>
          </div>

          <div className="glass-card p-3 rounded-xl border border-white/[0.08]">
            <span className="text-[10px] text-zinc-400 font-medium block uppercase tracking-wider">Estimated Size</span>
            <span className="text-sm font-semibold text-sky-400 font-mono tabular-nums mt-1 block">
              {loaded ? `~${estimatedWavSizeMb} MB (WAV)` : '—'}
            </span>
            <span className="text-[9px] text-zinc-500 font-mono">{loaded ? `~${estimatedMp3SizeMb} MB (MP3)` : 'Awaiting audio track'}</span>
          </div>

          <div className="glass-card p-3 rounded-xl border border-white/[0.08] flex flex-col justify-between">
            <span className="text-[10px] text-zinc-400 font-medium block uppercase tracking-wider">Master DSP Chain</span>
            <span className="text-xs font-semibold text-zinc-200 font-mono block">8D + 3D + FDN8 + EQ</span>
            <span className="text-[9px] text-emerald-400 font-mono font-medium">100% Parameter Sync</span>
          </div>
        </div>
      </div>

      {/* Waveform Tab Header */}
      <div className="h-8 glass-panel mx-3 px-3.5 rounded-xl flex items-center justify-between text-[11px] text-zinc-400 select-none">
        <div className="flex items-center space-x-2">
          <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
          <span className="text-zinc-200 font-semibold uppercase tracking-wider text-[10px]">
            Master Source Scope
          </span>
        </div>
        <div className="text-[10px] text-zinc-500 font-mono">
          {loaded ? track?.file_name : 'No track loaded'}
        </div>
      </div>

      {/* Waveform Display Area */}
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
              Open an audio file in the toolbar to inspect mastering outputs.
            </p>
            <div className="glass-pill px-3 py-1 rounded-md text-[11px] text-zinc-300 font-medium shadow-xs flex items-center space-x-1.5">
              <FolderOpen className="w-3.5 h-3.5 text-zinc-400" />
              <span>Import Audio Track</span>
            </div>
          </div>
        ) : (
          <WaveformPreview />
        )}
      </div>
    </div>
  );
};

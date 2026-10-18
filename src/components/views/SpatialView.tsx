import React from 'react';
import { UpperStage } from '../UpperStage';
import { PresetsRibbon } from '../PresetsRibbon';
import { WaveformPreview } from '../WaveformPreview';
import { useTrackStore } from '../../store/trackStore';
import { Music, FolderOpen } from 'lucide-react';

export const SpatialView: React.FC = () => {
  const { loaded, openAndLoadTrack } = useTrackStore();

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-transparent select-none">
      {/* Upper Stage: 3D Holographic Spatial Radar & Automation Curve Monitor */}
      <UpperStage />

      {/* Trajectory Presets Ribbon */}
      <PresetsRibbon />

      {/* Waveform Tab Header */}
      <div className="h-8 glass-panel mx-3 px-3.5 rounded-xl flex items-center justify-between text-[11px] text-zinc-400 select-none">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 text-zinc-200 font-semibold tracking-tight">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
            <span className="text-[10px] uppercase tracking-wider">
              Waveform Timeline
            </span>
          </div>
          <span className="text-white/10">•</span>
          <span className="text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer text-[10px] font-medium">
            Dual L/R Channels
          </span>
          <span className="text-white/10">•</span>
          <span className="text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer text-[10px] font-medium">
            Interpolated Scrubbing
          </span>
        </div>

        <div className="flex items-center space-x-2 text-[10px] font-mono tabular-nums text-zinc-500">
          <span className="glass-pill px-2 py-0.5 rounded-md text-zinc-400">
            {loaded ? 'Dual Buffer (Stereo 2.0)' : 'Click "Open Track" to load audio'}
          </span>
        </div>
      </div>

      {/* Waveform Display Stage */}
      <div className="flex-1 flex flex-col relative overflow-hidden m-3 mt-2 rounded-2xl glass-panel">
        {!loaded ? (
          <div
            onClick={openAndLoadTrack}
            className="flex-1 flex flex-col items-center justify-center p-8 text-center cursor-pointer hover:bg-white/[0.02] transition-colors group select-none relative overflow-hidden"
          >
            <div className="w-14 h-14 rounded-2xl glass-card flex items-center justify-center text-zinc-400 group-hover:text-white transition-all mb-3 shadow-xs">
              <Music className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-zinc-100 mb-1 tracking-tight">
              No Audio Track Loaded
            </h3>
            <p className="text-xs text-zinc-400 max-w-sm mb-3">
              Open an MP3, WAV, FLAC, or AAC track to begin binaural spatial positioning.
            </p>
            <div className="glass-pill px-3 py-1 rounded-md text-[11px] text-zinc-300 font-medium shadow-xs flex items-center space-x-1.5">
              <FolderOpen className="w-3.5 h-3.5 text-zinc-400" />
              <span>Select Audio File</span>
            </div>
            <div className="mt-4 flex items-center space-x-2 text-[10px] text-zinc-500 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
              <span>Orbiter by HaiCLOP Labs</span>
              <span>•</span>
              <span>Architect: Arnav Srivastava</span>
            </div>
          </div>
        ) : (
          <WaveformPreview />
        )}
      </div>
    </div>
  );
};

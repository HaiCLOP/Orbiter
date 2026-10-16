import React from 'react';
import { UpperStage } from '../UpperStage';
import { PresetsRibbon } from '../PresetsRibbon';
import { WaveformPreview } from '../WaveformPreview';
import { useTrackStore } from '../../store/trackStore';
import { Music, Sparkles } from 'lucide-react';

export const SpatialView: React.FC = () => {
  const { loaded, openAndLoadTrack } = useTrackStore();

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-transparent select-none">
      {/* Upper Stage: 3D Holographic Spatial Radar & Automation Curve Monitor */}
      <UpperStage />

      {/* Trajectory Presets Ribbon */}
      <PresetsRibbon />

      {/* Waveform Tab Header: Frosted Glass Ribbon */}
      <div className="h-8 glass-panel mx-3 px-4 rounded-xl flex items-center justify-between text-[11px] text-slate-400 select-none shadow-sm">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1.5 text-cyan-300 font-bold tracking-tight">
            <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)] animate-pulse" />
            <span className="text-[10px] uppercase tracking-wider">
              Waveform Timeline
            </span>
          </div>
          <span className="text-white/20">•</span>
          <span className="text-slate-400 hover:text-slate-200 transition-colors cursor-pointer text-[10px] font-medium">
            3D Spectrogram
          </span>
          <span className="text-white/20">•</span>
          <span className="text-slate-400 hover:text-slate-200 transition-colors cursor-pointer text-[10px] font-medium">
            Phase Lissajous
          </span>
        </div>

        <div className="flex items-center space-x-2 text-[10px] font-mono tabular-nums text-slate-400">
          <span className="glass-pill px-2 py-0.5 rounded-full text-slate-300">
            {loaded ? 'Dual L/R Audio Buffer (Stereo 2.0)' : 'Click "Open File" to load audio'}
          </span>
        </div>
      </div>

      {/* Waveform Display Stage */}
      <div className="flex-1 flex flex-col relative overflow-hidden m-3 mt-2 rounded-2xl glass-panel shadow-lg">
        {!loaded ? (
          <div
            onClick={openAndLoadTrack}
            className="flex-1 flex flex-col items-center justify-center p-8 text-center cursor-pointer hover:bg-white/[0.02] transition-colors group select-none relative overflow-hidden"
          >
            {/* Ambient Background Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="w-16 h-16 rounded-3xl glass-card flex items-center justify-center text-slate-400 group-hover:text-cyan-400 group-hover:border-cyan-500/40 group-hover:scale-105 transition-all mb-3.5 shadow-2xl relative z-10">
              <Music className="w-7 h-7" />
            </div>
            <h3 className="text-sm font-bold text-slate-100 mb-1 relative z-10 tracking-tight">
              No audio track loaded
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mb-4 relative z-10">
              Click anywhere or press "Open File" to import an MP3, WAV, FLAC, or AAC track into the 3D panner.
            </p>
            <div className="glass-pill px-3 py-1 rounded-full text-[11px] text-cyan-300 border-cyan-500/30 font-semibold shadow-xs flex items-center space-x-1.5 relative z-10">
              <Sparkles className="w-3.5 h-3.5" />
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

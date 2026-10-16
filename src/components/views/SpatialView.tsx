import React from 'react';
import { UpperStage } from '../UpperStage';
import { PresetsRibbon } from '../PresetsRibbon';
import { WaveformPreview } from '../WaveformPreview';
import { useTrackStore } from '../../store/trackStore';

export const SpatialView: React.FC = () => {
  const { loaded, openAndLoadTrack } = useTrackStore();

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Upper Stage: 3D Spatial Radar & Curve Monitor */}
      <UpperStage />

      {/* Trajectory Presets Ribbon */}
      <PresetsRibbon />

      {/* Waveform Tab Header */}
      <div className="h-7 bg-[#12151c] border-b border-[#222734] px-4 flex items-center justify-between text-[11px] text-zinc-400">
        <div className="flex items-center space-x-4">
          <span className="text-indigo-400 font-semibold border-b border-indigo-400 pb-0.5 cursor-pointer">
            Waveform
          </span>
          <span className="text-zinc-500 hover:text-zinc-300 cursor-pointer">Timeline</span>
          <span className="text-zinc-500 hover:text-zinc-300 cursor-pointer">Spectrogram</span>
        </div>

        <div className="text-[10px] text-zinc-500 font-mono">
          {loaded ? 'Dual L/R Envelope (Stereo 2.0)' : 'Click "Open File" to load audio'}
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
              Click anywhere or press "Open File" in the toolbar to import an MP3, WAV, FLAC, or AAC track.
            </p>
          </div>
        ) : (
          <WaveformPreview />
        )}
      </div>
    </div>
  );
};

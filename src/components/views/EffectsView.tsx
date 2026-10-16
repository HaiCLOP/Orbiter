import React from 'react';
import {
  Sparkles,
  Waves,
  Sliders,
  Compass,
  ArrowRight,
  Volume2,
  Zap,
  Gauge,
  Music,
} from 'lucide-react';
import { useTrackStore } from '../../store/trackStore';
import { WaveformPreview } from '../WaveformPreview';

export const EffectsView: React.FC = () => {
  const {
    loaded,
    openAndLoadTrack,
    spatialParams,
    set8DEnabled,
    reverbParams,
    setReverbParams,
    eqParams,
    dynamicsParams,
    setDynamicsParams,
  } = useTrackStore();

  const currentDistance = spatialParams.distance ?? 0;
  const effectiveWetPct = Math.round(
    reverbParams.amount * (0.75 + 0.5 * currentDistance) * 100
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-transparent select-none">
      {/* DSP Signal Architecture: Apple Pro Audio Unit Panel */}
      <div className="glass-panel m-3 mb-2 p-4 rounded-2xl select-none relative overflow-hidden">
        {/* Header Bar */}
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/[0.07] relative z-10">
          <div className="flex items-center space-x-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <h2 className="text-[11px] font-semibold text-zinc-200 uppercase tracking-wider">
              Native DSP Signal Architecture
            </h2>
          </div>
          <div className="flex items-center space-x-2 text-[10px] font-mono tabular-nums text-zinc-400">
            <span className="glass-pill px-2 py-0.5 rounded-md text-zinc-300">
              48,000 Hz
            </span>
            <span className="text-white/10">•</span>
            <span className="glass-pill px-2 py-0.5 rounded-md text-zinc-300">
              Zero-Alloc Processing
            </span>
            <span className="text-white/10">•</span>
            <span className="glass-pill px-2 py-0.5 rounded-md text-emerald-400 font-medium">
              Latency: {dynamicsParams.limiter_enabled ? '5.0 ms' : '0.3 ms'}
            </span>
          </div>
        </div>

        {/* Signal Flow Chain - Row 1 */}
        <div className="grid grid-cols-7 gap-2.5 items-center relative z-10">
          {/* Stage 1: Audio Input */}
          <div className="glass-card p-3 rounded-xl flex flex-col items-center text-center">
            <span className="text-[10px] text-zinc-400 font-medium">Input Source</span>
            <span className="text-xs font-semibold text-zinc-100 mt-0.5">Stereo 2.0</span>
            <span className="text-[9px] text-zinc-400 font-mono tabular-nums mt-1 glass-pill px-1.5 py-0.2 rounded">
              {dynamicsParams.normalize_enabled ? 'Norm (-1dBFS)' : 'Raw Input'}
            </span>
          </div>

          <div className="flex justify-center text-white/20">
            <ArrowRight className="w-3.5 h-3.5" />
          </div>

          {/* Stage 2: 8D Binaural Panner */}
          <div
            onClick={() => set8DEnabled(!spatialParams.enabled)}
            className={`glass-card p-3 rounded-xl cursor-pointer flex flex-col items-center text-center transition-all ${
              spatialParams.enabled
                ? 'border-sky-500/40 bg-sky-950/20 shadow-xs'
                : 'opacity-50 hover:opacity-80'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-sky-400" />
              <span className="text-[10px] font-semibold text-sky-300">8D Panner</span>
            </div>
            <span className="text-xs font-semibold text-zinc-100 mt-0.5 font-mono tabular-nums">
              {spatialParams.rotation_speed} Hz
            </span>
            <span className="text-[9px] text-sky-300 font-mono mt-1 glass-pill px-1.5 py-0.2 rounded border-sky-500/30">
              {spatialParams.enabled ? 'Active (ITD+ILD)' : 'Bypassed'}
            </span>
          </div>

          <div className="flex justify-center text-white/20">
            <ArrowRight className="w-3.5 h-3.5" />
          </div>

          {/* Stage 3: 3D Acoustics */}
          <div className="glass-card p-3 rounded-xl flex flex-col items-center text-center">
            <div className="flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[10px] font-semibold text-amber-300">3D Cues</span>
            </div>
            <span className="text-xs font-semibold text-zinc-100 mt-0.5 font-mono tabular-nums">
              d:{Math.round(currentDistance * 100)}% | el:{Math.round((spatialParams.elevation ?? 0) * 100)}%
            </span>
            <span className="text-[9px] text-amber-300/80 font-mono mt-1 glass-pill px-1.5 py-0.2 rounded">
              Pinna + Distance LPF
            </span>
          </div>

          <div className="flex justify-center text-white/20">
            <ArrowRight className="w-3.5 h-3.5" />
          </div>

          {/* Stage 4: FDN-8 Reverb Tank */}
          <div
            onClick={() => setReverbParams({ enabled: !reverbParams.enabled })}
            className={`glass-card p-3 rounded-xl cursor-pointer flex flex-col items-center text-center transition-all ${
              reverbParams.enabled
                ? 'border-purple-500/40 bg-purple-950/20 shadow-xs'
                : 'opacity-50 hover:opacity-80'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Waves className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-[10px] font-semibold text-purple-300">FDN-8 Tank</span>
            </div>
            <span className="text-xs font-semibold text-zinc-100 mt-0.5 font-mono tabular-nums">
              RT60 {reverbParams.decay.toFixed(1)}s
            </span>
            <span className="text-[9px] text-purple-300 font-mono mt-1 glass-pill px-1.5 py-0.2 rounded border-purple-500/30">
              {reverbParams.enabled ? `${effectiveWetPct}% Wet` : 'Bypassed'}
            </span>
          </div>
        </div>

        {/* Signal Flow Chain - Row 2 */}
        <div className="grid grid-cols-7 gap-2.5 items-center mt-3 pt-3 border-t border-white/[0.06] relative z-10">
          {/* Stage 5: 4-Band EQ */}
          <div className="glass-card p-3 rounded-xl flex flex-col items-center text-center">
            <div className="flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[10px] font-semibold text-emerald-300">4-Band EQ</span>
            </div>
            <span className="text-xs font-semibold text-zinc-100 mt-0.5 font-mono tabular-nums">
              {eqParams.bass_gain_db >= 0 ? `+${eqParams.bass_gain_db}` : eqParams.bass_gain_db} / {eqParams.treble_gain_db >= 0 ? `+${eqParams.treble_gain_db}` : eqParams.treble_gain_db} dB
            </span>
            <span className="text-[9px] text-emerald-300/80 font-mono mt-1 glass-pill px-1.5 py-0.2 rounded">
              {Math.round(eqParams.low_cut_hz)}Hz - {(eqParams.high_cut_hz / 1000).toFixed(1)}k
            </span>
          </div>

          <div className="flex justify-center text-white/20">
            <ArrowRight className="w-3.5 h-3.5" />
          </div>

          {/* Stage 6: Master Volume */}
          <div className="glass-card p-3 rounded-xl flex flex-col items-center text-center">
            <div className="flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 text-sky-400" />
              <span className="text-[10px] font-semibold text-sky-300">Master Gain</span>
            </div>
            <span className="text-xs font-semibold font-mono tabular-nums text-zinc-100 mt-0.5">
              {Math.round(eqParams.master_volume * 100)}%
            </span>
            <span className="text-[9px] text-zinc-400 font-mono mt-1 glass-pill px-1.5 py-0.2 rounded">
              25ms Smooth
            </span>
          </div>

          <div className="flex justify-center text-white/20">
            <ArrowRight className="w-3.5 h-3.5" />
          </div>

          {/* Stage 7: Master Limiter */}
          <div
            onClick={() =>
              setDynamicsParams({ limiter_enabled: !dynamicsParams.limiter_enabled })
            }
            className={`glass-card p-3 rounded-xl cursor-pointer flex flex-col items-center text-center transition-all ${
              dynamicsParams.limiter_enabled
                ? 'border-rose-500/40 bg-rose-950/20 shadow-xs'
                : 'opacity-50 hover:opacity-80'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5 text-rose-400" />
              <span className="text-[10px] font-semibold text-rose-300">Limiter</span>
            </div>
            <span className="text-xs font-semibold font-mono tabular-nums text-zinc-100 mt-0.5">
              {dynamicsParams.threshold_db.toFixed(1)} dBFS
            </span>
            <span className="text-[9px] text-rose-300 font-mono mt-1 glass-pill px-1.5 py-0.2 rounded border-rose-500/30">
              {dynamicsParams.limiter_enabled ? '5ms Lookahead' : 'Bypassed'}
            </span>
          </div>

          <div className="flex justify-center text-white/20">
            <ArrowRight className="w-3.5 h-3.5" />
          </div>

          {/* Stage 8: Hardware Output */}
          <div className="glass-card p-3 rounded-xl flex flex-col items-center text-center border-white/[0.1]">
            <div className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[10px] font-semibold text-zinc-300">CPAL Out</span>
            </div>
            <span className="text-xs font-semibold font-mono tabular-nums text-zinc-100 mt-0.5">
              DAC 2.0
            </span>
            <span className="text-[9px] text-emerald-400 font-mono font-medium mt-1 glass-pill px-1.5 py-0.2 rounded">
              Active Stream
            </span>
          </div>
        </div>
      </div>

      {/* Waveform Output Monitor Header */}
      <div className="h-8 glass-panel mx-3 px-3.5 rounded-xl flex items-center justify-between text-[11px] text-zinc-400 select-none">
        <div className="flex items-center space-x-2">
          <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
          <span className="text-zinc-200 font-semibold uppercase tracking-wider text-[10px]">
            Acoustic Signal Monitor
          </span>
        </div>
        <div className="text-[10px] text-zinc-500 font-mono">
          {loaded ? 'Dual L/R Real-Time Acoustic Monitor' : 'Click "Open Track" to load audio'}
        </div>
      </div>

      {/* Waveform Display Stage */}
      <div className="flex-1 flex flex-col relative overflow-hidden m-3 mt-2 rounded-2xl glass-panel">
        {!loaded ? (
          <div
            onClick={openAndLoadTrack}
            className="flex-1 flex flex-col items-center justify-center p-8 text-center cursor-pointer hover:bg-white/[0.02] transition-colors group select-none"
          >
            <div className="w-14 h-14 rounded-2xl glass-card flex items-center justify-center text-zinc-400 group-hover:text-white transition-all mb-3 shadow-xs">
              <Music className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-zinc-100 mb-1">
              No Audio Track Loaded
            </h3>
            <p className="text-xs text-zinc-400 max-w-sm mb-3">
              Open an audio file to inspect real-time DSP stages and dynamics.
            </p>
          </div>
        ) : (
          <WaveformPreview />
        )}
      </div>
    </div>
  );
};

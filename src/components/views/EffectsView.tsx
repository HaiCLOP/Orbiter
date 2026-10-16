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
    <div className="flex-1 flex flex-col overflow-hidden bg-transparent">
      {/* DSP Signal Flow Diagram: Frosted Liquid Glass Panel */}
      <div className="glass-panel m-3 mb-2 p-4 rounded-2xl select-none relative overflow-hidden">
        {/* Subtle Ambient Lens Flare */}
        <div className="absolute -top-24 left-1/3 w-96 h-32 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header Bar */}
        <div className="flex items-center justify-between pb-3 mb-3.5 border-b border-white/[0.07] relative z-10">
          <div className="flex items-center space-x-2.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse" />
            <h2 className="text-[11px] font-bold text-slate-100 uppercase tracking-widest">
              Real-Time Native DSP Signal Architecture
            </h2>
          </div>
          <div className="flex items-center space-x-2.5 text-[10px] font-mono tabular-nums text-slate-400">
            <span className="glass-pill px-2 py-0.5 rounded-full text-slate-300">
              48,000 Hz
            </span>
            <span className="text-white/20">•</span>
            <span className="glass-pill px-2 py-0.5 rounded-full text-slate-300">
              Zero-Alloc Thread
            </span>
            <span className="text-white/20">•</span>
            <span className="glass-pill px-2 py-0.5 rounded-full text-emerald-400 border-emerald-500/30 font-semibold shadow-[0_0_12px_rgba(16,185,129,0.15)]">
              Latency: {dynamicsParams.limiter_enabled ? '5.0 ms (Lookahead)' : '0.3 ms'}
            </span>
          </div>
        </div>

        {/* Signal Flow Chain - Row 1 */}
        <div className="grid grid-cols-7 gap-2.5 items-center relative z-10">
          {/* Stage 1: Audio Input */}
          <div className="glass-card p-3 rounded-xl flex flex-col items-center text-center">
            <span className="text-[10px] text-slate-400 font-medium">Input Source</span>
            <span className="text-xs font-bold text-slate-100 mt-0.5">Stereo 2.0</span>
            <span className="text-[9px] text-slate-400 font-mono tabular-nums mt-1 glass-pill px-1.5 py-0.2 rounded">
              {dynamicsParams.normalize_enabled ? 'Norm (-1dBFS)' : 'Raw Input'}
            </span>
          </div>

          <div className="flex justify-center text-white/20">
            <ArrowRight className="w-4 h-4" />
          </div>

          {/* Stage 2: 8D Binaural Panner */}
          <div
            onClick={() => set8DEnabled(!spatialParams.enabled)}
            className={`glass-card p-3 rounded-xl cursor-pointer flex flex-col items-center text-center transition-all ${
              spatialParams.enabled
                ? 'border-cyan-500/40 bg-cyan-950/20 shadow-[0_0_24px_rgba(6,182,212,0.18)]'
                : 'opacity-60 hover:opacity-90'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-[10px] font-bold text-cyan-300 tracking-wide">8D Panner</span>
            </div>
            <span className="text-xs font-bold text-slate-100 mt-0.5 font-mono tabular-nums">
              {spatialParams.rotation_speed} Hz
            </span>
            <span className="text-[9px] text-cyan-300 font-mono mt-1 glass-pill px-1.5 py-0.2 rounded border-cyan-500/30">
              {spatialParams.enabled ? 'Active (ITD+ILD)' : 'Bypassed'}
            </span>
          </div>

          <div className="flex justify-center text-white/20">
            <ArrowRight className="w-4 h-4" />
          </div>

          {/* Stage 3: 3D Acoustics */}
          <div className="glass-card p-3 rounded-xl flex flex-col items-center text-center">
            <div className="flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[10px] font-bold text-amber-300 tracking-wide">3D Cues</span>
            </div>
            <span className="text-xs font-bold text-slate-100 mt-0.5 font-mono tabular-nums">
              d:{Math.round(currentDistance * 100)}% | el:{Math.round((spatialParams.elevation ?? 0) * 100)}%
            </span>
            <span className="text-[9px] text-amber-300/80 font-mono mt-1 glass-pill px-1.5 py-0.2 rounded border-amber-500/20">
              Pinna + Air LPF
            </span>
          </div>

          <div className="flex justify-center text-white/20">
            <ArrowRight className="w-4 h-4" />
          </div>

          {/* Stage 4: FDN-8 Reverb Tank */}
          <div
            onClick={() => setReverbParams({ enabled: !reverbParams.enabled })}
            className={`glass-card p-3 rounded-xl cursor-pointer flex flex-col items-center text-center transition-all ${
              reverbParams.enabled
                ? 'border-purple-500/40 bg-purple-950/20 shadow-[0_0_24px_rgba(168,85,247,0.18)]'
                : 'opacity-60 hover:opacity-90'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Waves className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-[10px] font-bold text-purple-300 tracking-wide">FDN-8 Tank</span>
            </div>
            <span className="text-xs font-bold text-slate-100 mt-0.5 font-mono tabular-nums">
              RT60 {reverbParams.decay.toFixed(1)}s
            </span>
            <span className="text-[9px] text-purple-300 font-mono mt-1 glass-pill px-1.5 py-0.2 rounded border-purple-500/30">
              {reverbParams.enabled ? `${effectiveWetPct}% Wet (Auto-Tie)` : 'Bypassed'}
            </span>
          </div>
        </div>

        {/* Signal Flow Chain - Row 2 */}
        <div className="grid grid-cols-7 gap-2.5 items-center mt-3 pt-3 border-t border-white/[0.06] relative z-10">
          {/* Stage 5: 4-Band Cascaded EQ */}
          <div className="glass-card p-3 rounded-xl flex flex-col items-center text-center">
            <div className="flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[10px] font-bold text-emerald-300 tracking-wide">4-Band EQ</span>
            </div>
            <span className="text-xs font-bold text-slate-100 mt-0.5 font-mono tabular-nums">
              {eqParams.bass_gain_db >= 0 ? `+${eqParams.bass_gain_db}` : eqParams.bass_gain_db} / {eqParams.treble_gain_db >= 0 ? `+${eqParams.treble_gain_db}` : eqParams.treble_gain_db} dB
            </span>
            <span className="text-[9px] text-emerald-300/80 font-mono mt-1 glass-pill px-1.5 py-0.2 rounded border-emerald-500/20">
              {Math.round(eqParams.low_cut_hz)}Hz - {(eqParams.high_cut_hz / 1000).toFixed(1)}k
            </span>
          </div>

          <div className="flex justify-center text-white/20">
            <ArrowRight className="w-4 h-4" />
          </div>

          {/* Stage 6: Master Volume */}
          <div className="glass-card p-3 rounded-xl flex flex-col items-center text-center">
            <div className="flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-[10px] font-bold text-indigo-300 tracking-wide">Master Gain</span>
            </div>
            <span className="text-xs font-bold font-mono tabular-nums text-indigo-200 mt-0.5">
              {Math.round(eqParams.master_volume * 100)}%
            </span>
            <span className="text-[9px] text-slate-400 font-mono mt-1 glass-pill px-1.5 py-0.2 rounded">
              25ms Slew
            </span>
          </div>

          <div className="flex justify-center text-white/20">
            <ArrowRight className="w-4 h-4" />
          </div>

          {/* Stage 7: Master Limiter */}
          <div
            onClick={() =>
              setDynamicsParams({ limiter_enabled: !dynamicsParams.limiter_enabled })
            }
            className={`glass-card p-3 rounded-xl cursor-pointer flex flex-col items-center text-center transition-all ${
              dynamicsParams.limiter_enabled
                ? 'border-rose-500/40 bg-rose-950/20 shadow-[0_0_24px_rgba(244,63,94,0.18)]'
                : 'opacity-60 hover:opacity-90'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5 text-rose-400" />
              <span className="text-[10px] font-bold text-rose-300 tracking-wide">Limiter</span>
            </div>
            <span className="text-xs font-bold font-mono tabular-nums text-slate-100 mt-0.5">
              {dynamicsParams.threshold_db.toFixed(1)} dBFS
            </span>
            <span className="text-[9px] text-rose-300 font-mono mt-1 glass-pill px-1.5 py-0.2 rounded border-rose-500/30">
              {dynamicsParams.limiter_enabled ? '5ms Lookahead' : 'Bypassed'}
            </span>
          </div>

          <div className="flex justify-center text-white/20">
            <ArrowRight className="w-4 h-4" />
          </div>

          {/* Stage 8: Hardware Output */}
          <div className="glass-card p-3 rounded-xl flex flex-col items-center text-center border-emerald-500/30 bg-emerald-950/10">
            <div className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[10px] font-bold text-slate-200 tracking-wide">CPAL Out</span>
            </div>
            <span className="text-xs font-bold font-mono tabular-nums text-slate-100 mt-0.5">
              DAC 2.0
            </span>
            <span className="text-[9px] text-emerald-400 font-mono font-bold mt-1 glass-pill px-1.5 py-0.2 rounded border-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.2)]">
              ACTIVE
            </span>
          </div>
        </div>
      </div>

      {/* Waveform Tab Header: Liquid Glass Ribbon */}
      <div className="h-8 glass-panel mx-3 px-4 rounded-xl flex items-center justify-between text-[11px] text-slate-400 select-none">
        <div className="flex items-center space-x-2">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shadow-[0_0_6px_rgba(99,102,241,0.8)]" />
          <span className="text-indigo-300 font-bold uppercase tracking-wider text-[10px]">
            Waveform Output Monitor
          </span>
        </div>
        <div className="text-[10px] text-slate-500 font-mono">
          {loaded ? 'Dual L/R Real-Time Acoustic Monitor' : 'Click "Open File" to load audio'}
        </div>
      </div>

      {/* Waveform Display Stage */}
      <div className="flex-1 flex flex-col relative overflow-hidden m-3 mt-2 rounded-2xl glass-panel">
        {!loaded ? (
          <div
            onClick={openAndLoadTrack}
            className="flex-1 flex flex-col items-center justify-center p-8 text-center cursor-pointer hover:bg-white/[0.02] transition-colors group select-none"
          >
            <div className="w-16 h-16 rounded-3xl glass-card flex items-center justify-center text-slate-400 group-hover:text-indigo-400 group-hover:border-indigo-500/40 group-hover:scale-105 transition-all mb-3.5 shadow-2xl">
              <Music className="w-7 h-7" />
            </div>
            <h3 className="text-sm font-bold text-slate-100 mb-1">
              No audio track loaded
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mb-4">
              Click anywhere or press "Open File" to load audio into the DSP rack.
            </p>
          </div>
        ) : (
          <WaveformPreview />
        )}
      </div>
    </div>
  );
};

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
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* DSP Signal Flow Diagram */}
      <div className="bg-[#141822] border-b border-[#232938] p-4 select-none">
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#232938]/60">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <h2 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider">
              Real-Time Native DSP Signal Architecture
            </h2>
          </div>
          <div className="flex items-center space-x-3 text-[10px] font-mono text-zinc-400">
            <span>Sample Rate: 48,000 Hz</span>
            <span>•</span>
            <span>Zero-Allocation Audio Thread</span>
            <span>•</span>
            <span className="text-emerald-400 font-semibold">
              Latency: {dynamicsParams.limiter_enabled ? '5.0 ms (Lookahead)' : '0.3 ms'}
            </span>
          </div>
        </div>

        {/* Signal Flow Chain Blocks */}
        <div className="grid grid-cols-7 gap-2 items-center">
          {/* Stage 1: Audio Input */}
          <div className="bg-[#181d28] p-2.5 rounded-lg border border-[#283042] flex flex-col items-center text-center">
            <span className="text-[10px] text-zinc-400 font-medium">Input Source</span>
            <span className="text-xs font-semibold text-zinc-200 mt-0.5">Stereo 2.0</span>
            <span className="text-[9px] text-zinc-500 font-mono mt-1">
              {dynamicsParams.normalize_enabled ? 'Norm (-1dBFS)' : 'Raw Input'}
            </span>
          </div>

          <div className="flex justify-center text-zinc-600">
            <ArrowRight className="w-4 h-4" />
          </div>

          {/* Stage 2: 8D Binaural Panner */}
          <div
            onClick={() => set8DEnabled(!spatialParams.enabled)}
            className={`p-2.5 rounded-lg border transition-all cursor-pointer flex flex-col items-center text-center ${
              spatialParams.enabled
                ? 'bg-cyan-950/40 border-cyan-700/60 shadow-sm shadow-cyan-950'
                : 'bg-[#181d28]/60 border-[#283042] opacity-60'
            }`}
          >
            <div className="flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-cyan-400" />
              <span className="text-[10px] font-medium text-cyan-300">8D Panner</span>
            </div>
            <span className="text-xs font-semibold text-zinc-200 mt-0.5">
              {spatialParams.rotation_speed} Hz
            </span>
            <span className="text-[9px] text-cyan-400/80 font-mono mt-1">
              {spatialParams.enabled ? 'Active (ITD+ILD)' : 'Bypassed'}
            </span>
          </div>

          <div className="flex justify-center text-zinc-600">
            <ArrowRight className="w-4 h-4" />
          </div>

          {/* Stage 3: 3D Acoustics */}
          <div className="bg-[#181d28] p-2.5 rounded-lg border border-[#283042] flex flex-col items-center text-center">
            <div className="flex items-center gap-1">
              <Compass className="w-3 h-3 text-amber-400" />
              <span className="text-[10px] font-medium text-amber-300">3D Cues</span>
            </div>
            <span className="text-xs font-semibold text-zinc-200 mt-0.5">
              d:{Math.round(currentDistance * 100)}% | el:{Math.round((spatialParams.elevation ?? 0) * 100)}%
            </span>
            <span className="text-[9px] text-zinc-500 font-mono mt-1">Pinna + Air LPF</span>
          </div>

          <div className="flex justify-center text-zinc-600">
            <ArrowRight className="w-4 h-4" />
          </div>

          {/* Stage 4: FDN-8 Reverb Tank */}
          <div
            onClick={() => setReverbParams({ enabled: !reverbParams.enabled })}
            className={`p-2.5 rounded-lg border transition-all cursor-pointer flex flex-col items-center text-center ${
              reverbParams.enabled
                ? 'bg-purple-950/40 border-purple-700/60 shadow-sm shadow-purple-950'
                : 'bg-[#181d28]/60 border-[#283042] opacity-60'
            }`}
          >
            <div className="flex items-center gap-1">
              <Waves className="w-3 h-3 text-purple-400" />
              <span className="text-[10px] font-medium text-purple-300">FDN-8 Tank</span>
            </div>
            <span className="text-xs font-semibold text-zinc-200 mt-0.5">
              RT60 {reverbParams.decay.toFixed(1)}s
            </span>
            <span className="text-[9px] text-purple-400/80 font-mono mt-1">
              {reverbParams.enabled ? `${effectiveWetPct}% Wet (Auto-Tie)` : 'Bypassed'}
            </span>
          </div>
        </div>

        {/* Second Row: EQ -> Master Volume -> Master Limiter -> Hardware Out */}
        <div className="grid grid-cols-7 gap-2 items-center mt-3 pt-3 border-t border-[#232938]/40">
          {/* Stage 5: 4-Band Cascaded EQ */}
          <div className="bg-[#181d28] p-2.5 rounded-lg border border-emerald-900/40 flex flex-col items-center text-center">
            <div className="flex items-center gap-1">
              <Sliders className="w-3 h-3 text-emerald-400" />
              <span className="text-[10px] font-medium text-emerald-300">4-Band EQ</span>
            </div>
            <span className="text-xs font-semibold text-zinc-200 mt-0.5">
              {eqParams.bass_gain_db >= 0 ? `+${eqParams.bass_gain_db}` : eqParams.bass_gain_db} / {eqParams.treble_gain_db >= 0 ? `+${eqParams.treble_gain_db}` : eqParams.treble_gain_db} dB
            </span>
            <span className="text-[9px] text-zinc-400 font-mono mt-1">
              {Math.round(eqParams.low_cut_hz)}Hz - {(eqParams.high_cut_hz / 1000).toFixed(1)}k
            </span>
          </div>

          <div className="flex justify-center text-zinc-600">
            <ArrowRight className="w-4 h-4" />
          </div>

          {/* Stage 6: Master Volume */}
          <div className="bg-[#181d28] p-2.5 rounded-lg border border-indigo-900/40 flex flex-col items-center text-center">
            <div className="flex items-center gap-1">
              <Volume2 className="w-3 h-3 text-indigo-400" />
              <span className="text-[10px] font-medium text-indigo-300">Master Gain</span>
            </div>
            <span className="text-xs font-semibold font-mono text-indigo-200 mt-0.5">
              {Math.round(eqParams.master_volume * 100)}%
            </span>
            <span className="text-[9px] text-zinc-400 font-mono mt-1">
              25ms Slew
            </span>
          </div>

          <div className="flex justify-center text-zinc-600">
            <ArrowRight className="w-4 h-4" />
          </div>

          {/* Stage 7: Master Limiter */}
          <div
            onClick={() =>
              setDynamicsParams({ limiter_enabled: !dynamicsParams.limiter_enabled })
            }
            className={`p-2.5 rounded-lg border transition-all cursor-pointer flex flex-col items-center text-center ${
              dynamicsParams.limiter_enabled
                ? 'bg-rose-950/40 border-rose-700/60 shadow-sm shadow-rose-950'
                : 'bg-[#181d28]/60 border-[#283042] opacity-60'
            }`}
          >
            <div className="flex items-center gap-1">
              <Gauge className="w-3 h-3 text-rose-400" />
              <span className="text-[10px] font-medium text-rose-300">Limiter</span>
            </div>
            <span className="text-xs font-semibold font-mono text-zinc-200 mt-0.5">
              {dynamicsParams.threshold_db.toFixed(1)} dBFS
            </span>
            <span className="text-[9px] text-rose-400/80 font-mono mt-1">
              {dynamicsParams.limiter_enabled ? '5ms Lookahead' : 'Bypassed'}
            </span>
          </div>

          <div className="flex justify-center text-zinc-600">
            <ArrowRight className="w-4 h-4" />
          </div>

          {/* Stage 8: Hardware Output */}
          <div className="bg-[#181d28] p-2.5 rounded-lg border border-zinc-700/50 flex flex-col items-center text-center">
            <div className="flex items-center gap-1">
              <Zap className="w-3 h-3 text-yellow-400" />
              <span className="text-[10px] font-medium text-zinc-300">CPAL Out</span>
            </div>
            <span className="text-xs font-semibold font-mono text-zinc-200 mt-0.5">
              DAC 2.0
            </span>
            <span className="text-[9px] text-emerald-400 font-mono mt-1">
              ACTIVE
            </span>
          </div>
        </div>
      </div>

      {/* Waveform Tab Header */}
      <div className="h-7 bg-[#12151c] border-b border-[#222734] px-4 flex items-center justify-between text-[11px] text-zinc-400">
        <span className="text-indigo-400 font-semibold border-b border-indigo-400 pb-0.5 cursor-pointer">
          Waveform Output Monitor
        </span>
        <div className="text-[10px] text-zinc-500 font-mono">
          {loaded ? 'Dual L/R Real-Time Monitor' : 'Click "Open File" to load audio'}
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

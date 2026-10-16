import React, { useState } from 'react';
import {
  Sliders,
  Waves,
  Compass,
  Volume2,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Gauge,
  ShieldCheck,
} from 'lucide-react';
import { useTrackStore } from '../../store/trackStore';

export const EffectsInspector: React.FC = () => {
  const {
    track,
    eqParams,
    setEqParams,
    reverbParams,
    setReverbParams,
    spatialParams,
    setDistance,
    setElevation,
    dynamicsParams,
    setDynamicsParams,
  } = useTrackStore();

  // Collapsible rack states
  const [eqOpen, setEqOpen] = useState(true);
  const [reverbOpen, setReverbOpen] = useState(true);
  const [spatial3dOpen, setSpatial3dOpen] = useState(true);
  const [dynamicsOpen, setDynamicsOpen] = useState(true);

  // Live calculation of effective wet amount based on distance auto-tie formula:
  // effective_wet = amount * (0.75 + 0.50 * distance)
  const currentDistance = spatialParams.distance ?? 0;
  const effectiveWetPct = Math.round(
    reverbParams.amount * (0.75 + 0.5 * currentDistance) * 100
  );

  return (
    <div className="space-y-3.5 select-none pb-8">
      {/* 1. 4-Band Cascaded EQ Rack */}
      <section className="glass-panel rounded-2xl overflow-hidden transition-all duration-300">
        {/* Accordion Header */}
        <div
          onClick={() => setEqOpen(!eqOpen)}
          className="p-3 px-3.5 flex items-center justify-between cursor-pointer hover:bg-white/[0.04] transition-colors"
        >
          <div className="flex items-center space-x-2.5">
            {eqOpen ? (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 transition-transform" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 transition-transform" />
            )}
            <Sliders className="w-4 h-4 text-emerald-400" />
            <span className="font-bold text-[11px] uppercase tracking-wider text-slate-100">
              Parametric EQ Rack
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setEqParams({
                  low_cut_hz: 20,
                  high_cut_hz: 20000,
                  bass_gain_db: 0,
                  treble_gain_db: 0,
                  master_volume: 1.0,
                });
              }}
              className="glass-pill text-[10px] text-slate-300 hover:text-white px-2 py-0.5 rounded-full flex items-center space-x-1 cursor-pointer"
              title="Reset EQ to flat"
            >
              <RotateCcw className="w-2.5 h-2.5" />
              <span>Flat</span>
            </button>
          </div>
        </div>

        {/* Collapsible Content */}
        {eqOpen && (
          <div className="p-3.5 pt-1 border-t border-white/[0.06] space-y-3.5 animate-in fade-in duration-200">
            {/* Low Cut */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400 font-medium">Low Cut (HPF)</span>
                <span className="font-mono tabular-nums text-emerald-400 text-[10px] font-bold">
                  {Math.round(eqParams.low_cut_hz)} Hz
                </span>
              </div>
              <input
                type="range"
                min="20"
                max="500"
                step="1"
                value={eqParams.low_cut_hz}
                onChange={(e) => setEqParams({ low_cut_hz: parseFloat(e.target.value) })}
                className="glass-slider w-full cursor-pointer accent-emerald-400"
              />
              <div className="flex justify-between text-[9px] text-slate-500 font-mono tabular-nums">
                <span>20 Hz (Off)</span>
                <span>500 Hz</span>
              </div>
            </div>

            {/* High Cut */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400 font-medium">High Cut (LPF)</span>
                <span className="font-mono tabular-nums text-emerald-400 text-[10px] font-bold">
                  {(eqParams.high_cut_hz / 1000).toFixed(1)} kHz
                </span>
              </div>
              <input
                type="range"
                min="2000"
                max="20000"
                step="100"
                value={eqParams.high_cut_hz}
                onChange={(e) => setEqParams({ high_cut_hz: parseFloat(e.target.value) })}
                className="glass-slider w-full cursor-pointer accent-emerald-400"
              />
              <div className="flex justify-between text-[9px] text-slate-500 font-mono tabular-nums">
                <span>2.0 kHz</span>
                <span>20.0 kHz (Air)</span>
              </div>
            </div>

            {/* Bass Boost */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400 font-medium">Bass Shelf (100 Hz)</span>
                <span className="font-mono tabular-nums text-[10px] font-bold">
                  {eqParams.bass_gain_db > 0 ? (
                    <span className="text-cyan-400">+{eqParams.bass_gain_db.toFixed(1)} dB</span>
                  ) : eqParams.bass_gain_db < 0 ? (
                    <span className="text-rose-400">{eqParams.bass_gain_db.toFixed(1)} dB</span>
                  ) : (
                    <span className="text-slate-400">0.0 dB</span>
                  )}
                </span>
              </div>
              <input
                type="range"
                min="-12.0"
                max="12.0"
                step="0.5"
                value={eqParams.bass_gain_db}
                onChange={(e) => setEqParams({ bass_gain_db: parseFloat(e.target.value) })}
                className="glass-slider w-full cursor-pointer accent-cyan-400"
              />
              <div className="flex justify-between text-[9px] text-slate-500 font-mono tabular-nums">
                <span>-12 dB</span>
                <span>0 dB</span>
                <span>+12 dB</span>
              </div>
            </div>

            {/* Treble Boost */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400 font-medium">Treble Shelf (10 kHz)</span>
                <span className="font-mono tabular-nums text-[10px] font-bold">
                  {eqParams.treble_gain_db > 0 ? (
                    <span className="text-amber-400">+{eqParams.treble_gain_db.toFixed(1)} dB</span>
                  ) : eqParams.treble_gain_db < 0 ? (
                    <span className="text-rose-400">{eqParams.treble_gain_db.toFixed(1)} dB</span>
                  ) : (
                    <span className="text-slate-400">0.0 dB</span>
                  )}
                </span>
              </div>
              <input
                type="range"
                min="-12.0"
                max="12.0"
                step="0.5"
                value={eqParams.treble_gain_db}
                onChange={(e) => setEqParams({ treble_gain_db: parseFloat(e.target.value) })}
                className="glass-slider w-full cursor-pointer accent-amber-400"
              />
              <div className="flex justify-between text-[9px] text-slate-500 font-mono tabular-nums">
                <span>-12 dB</span>
                <span>0 dB</span>
                <span>+12 dB</span>
              </div>
            </div>

            {/* Master Volume */}
            <div className="space-y-1.5 pt-2.5 border-t border-white/[0.06]">
              <div className="flex justify-between text-[11px]">
                <div className="flex items-center space-x-1.5 text-slate-200 font-semibold">
                  <Volume2 className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Master Volume</span>
                </div>
                <span className="font-mono tabular-nums text-indigo-300 text-[10px] font-bold">
                  {Math.round(eqParams.master_volume * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.0"
                max="2.0"
                step="0.02"
                value={eqParams.master_volume}
                onChange={(e) => setEqParams({ master_volume: parseFloat(e.target.value) })}
                className="glass-slider w-full cursor-pointer accent-indigo-400"
              />
              <div className="flex justify-between text-[9px] text-slate-500 font-mono tabular-nums">
                <span>0% (Mute)</span>
                <span>100% (Unity)</span>
                <span>200% (+6dB)</span>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 2. Environmental Reverb Rack (FDN-8 Tank) */}
      <section className="glass-panel rounded-2xl overflow-hidden transition-all duration-300">
        {/* Accordion Header */}
        <div
          onClick={() => setReverbOpen(!reverbOpen)}
          className="p-3 px-3.5 flex items-center justify-between cursor-pointer hover:bg-white/[0.04] transition-colors"
        >
          <div className="flex items-center space-x-2.5">
            {reverbOpen ? (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 transition-transform" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 transition-transform" />
            )}
            <Waves className="w-4 h-4 text-purple-400" />
            <span className="font-bold text-[11px] uppercase tracking-wider text-slate-100">
              Reverb Rack (FDN-8)
            </span>
          </div>

          <div className="flex items-center space-x-2">
            {/* Enable Pill Toggle */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setReverbParams({ enabled: !reverbParams.enabled });
              }}
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold transition-all cursor-pointer glass-pill ${
                reverbParams.enabled
                  ? 'bg-purple-600/40 text-purple-200 border-purple-500/50 shadow-[0_0_12px_rgba(168,85,247,0.3)]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {reverbParams.enabled ? 'ACTIVE' : 'BYPASS'}
            </button>

            {/* Default Reset Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setReverbParams({
                  amount: 0.30,
                  room_size: 0.50,
                  decay: 2.0,
                  damping: 0.40,
                });
              }}
              className="glass-pill text-[10px] text-slate-300 hover:text-white px-2 py-0.5 rounded-full flex items-center space-x-1 cursor-pointer"
              title="Reset Reverb to studio defaults"
            >
              <RotateCcw className="w-2.5 h-2.5" />
              <span>Default</span>
            </button>
          </div>
        </div>

        {/* Collapsible Content */}
        {reverbOpen && (
          <div className="p-3.5 pt-1 border-t border-white/[0.06] space-y-3.5 animate-in fade-in duration-200">
            {/* Reverb Amount (Wet/Dry Mix) */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400 font-medium">Reverb Amount (Wet Mix)</span>
                <span className="font-mono tabular-nums text-purple-300 text-[10px] font-bold">
                  {Math.round(reverbParams.amount * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.01"
                value={reverbParams.amount}
                onChange={(e) => setReverbParams({ amount: parseFloat(e.target.value) })}
                className="glass-slider w-full cursor-pointer accent-purple-400"
              />
              <div className="flex justify-between text-[9px] text-slate-500 font-mono tabular-nums">
                <span>0% (Dry)</span>
                <span>Effective: {effectiveWetPct}%</span>
                <span>100% (Wet)</span>
              </div>
            </div>

            {/* Room Size */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400 font-medium">Room Size</span>
                <span className="font-mono tabular-nums text-purple-300 text-[10px] font-bold">
                  {Math.round(reverbParams.room_size * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.01"
                value={reverbParams.room_size}
                onChange={(e) => setReverbParams({ room_size: parseFloat(e.target.value) })}
                className="glass-slider w-full cursor-pointer accent-purple-400"
              />
              <div className="flex justify-between text-[9px] text-slate-500 font-mono tabular-nums">
                <span>Intimate Studio</span>
                <span>Auditorium</span>
                <span>Cathedral</span>
              </div>
            </div>

            {/* Decay Time (RT60) */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400 font-medium">Decay Time (RT60)</span>
                <span className="font-mono tabular-nums text-purple-300 text-[10px] font-bold">
                  {reverbParams.decay.toFixed(1)}s
                </span>
              </div>
              <input
                type="range"
                min="0.2"
                max="12.0"
                step="0.1"
                value={reverbParams.decay}
                onChange={(e) => setReverbParams({ decay: parseFloat(e.target.value) })}
                className="glass-slider w-full cursor-pointer accent-purple-400"
              />
              <div className="flex justify-between text-[9px] text-slate-500 font-mono tabular-nums">
                <span>0.2s</span>
                <span>2.0s</span>
                <span>12.0s</span>
              </div>
            </div>

            {/* HF Damping (High Frequency Absorption) */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400 font-medium">HF Damping (Air Absorption)</span>
                <span className="font-mono tabular-nums text-purple-300 text-[10px] font-bold">
                  {Math.round(reverbParams.damping * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.01"
                value={reverbParams.damping}
                onChange={(e) => setReverbParams({ damping: parseFloat(e.target.value) })}
                className="glass-slider w-full cursor-pointer accent-purple-400"
              />
              <div className="flex justify-between text-[9px] text-slate-500 font-mono tabular-nums">
                <span>Bright (Reflective)</span>
                <span>Warm / Absorptive</span>
              </div>
            </div>

            {/* Distance Auto-Tie Info Badge */}
            <div className="glass-card p-2.5 rounded-xl flex items-center justify-between text-[10px]">
              <div className="flex items-center space-x-1.5 text-purple-300">
                <Sparkles className="w-3.5 h-3.5" />
                <span className="font-medium">Distance Auto-Tie</span>
              </div>
              <span className="font-mono tabular-nums text-slate-300">
                Distance: {Math.round(currentDistance * 100)}% → Scaled Wet: {effectiveWetPct}%
              </span>
            </div>
          </div>
        )}
      </section>

      {/* 3. 3D Distance & Elevation Acoustics */}
      <section className="glass-panel rounded-2xl overflow-hidden transition-all duration-300">
        {/* Accordion Header */}
        <div
          onClick={() => setSpatial3dOpen(!spatial3dOpen)}
          className="p-3 px-3.5 flex items-center justify-between cursor-pointer hover:bg-white/[0.04] transition-colors"
        >
          <div className="flex items-center space-x-2.5">
            {spatial3dOpen ? (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 transition-transform" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 transition-transform" />
            )}
            <Compass className="w-4 h-4 text-amber-400" />
            <span className="font-bold text-[11px] uppercase tracking-wider text-slate-100">
              3D Spatial Cues (Elevation & Distance)
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setDistance(0.0);
                setElevation(0.0);
              }}
              className="glass-pill text-[10px] text-slate-300 hover:text-white px-2 py-0.5 rounded-full flex items-center space-x-1 cursor-pointer"
              title="Reset 3D to head center"
            >
              <RotateCcw className="w-2.5 h-2.5" />
              <span>Center</span>
            </button>
          </div>
        </div>

        {/* Collapsible Content */}
        {spatial3dOpen && (
          <div className="p-3.5 pt-1 border-t border-white/[0.06] space-y-3.5 animate-in fade-in duration-200">
            {/* Distance */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400 font-medium">Source Distance</span>
                <span className="font-mono tabular-nums text-amber-300 text-[10px] font-bold">
                  {Math.round((spatialParams.distance ?? 0) * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.01"
                value={spatialParams.distance ?? 0}
                onChange={(e) => setDistance(parseFloat(e.target.value))}
                className="glass-slider w-full cursor-pointer accent-amber-400"
              />
              <div className="flex justify-between text-[9px] text-slate-500 font-mono tabular-nums">
                <span>Near Head (0m)</span>
                <span>Medium (10m)</span>
                <span>Far Field (30m)</span>
              </div>
            </div>

            {/* Elevation */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400 font-medium">Vertical Elevation</span>
                <span className="font-mono tabular-nums text-[10px] font-bold">
                  {(spatialParams.elevation ?? 0) > 0 ? (
                    <span className="text-purple-400">+{Math.round((spatialParams.elevation ?? 0) * 100)}% (Above)</span>
                  ) : (spatialParams.elevation ?? 0) < 0 ? (
                    <span className="text-blue-400">{Math.round((spatialParams.elevation ?? 0) * 100)}% (Below)</span>
                  ) : (
                    <span className="text-slate-400">0% (Eye Level)</span>
                  )}
                </span>
              </div>
              <input
                type="range"
                min="-1.0"
                max="1.0"
                step="0.02"
                value={spatialParams.elevation ?? 0}
                onChange={(e) => setElevation(parseFloat(e.target.value))}
                className="glass-slider w-full cursor-pointer accent-purple-400"
              />
              <div className="flex justify-between text-[9px] text-slate-500 font-mono tabular-nums">
                <span>-100% (Below)</span>
                <span>0% (Neutral)</span>
                <span>+100% (Above)</span>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 4. Master Dynamics Rack (Peak Limiter + Normalize) */}
      <section className="glass-panel rounded-2xl overflow-hidden transition-all duration-300">
        {/* Accordion Header */}
        <div
          onClick={() => setDynamicsOpen(!dynamicsOpen)}
          className="p-3 px-3.5 flex items-center justify-between cursor-pointer hover:bg-white/[0.04] transition-colors"
        >
          <div className="flex items-center space-x-2.5">
            {dynamicsOpen ? (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 transition-transform" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 transition-transform" />
            )}
            <Gauge className="w-4 h-4 text-rose-400" />
            <span className="font-bold text-[11px] uppercase tracking-wider text-slate-100">
              Master Dynamics Rack
            </span>
          </div>

          <div className="flex items-center space-x-2">
            {/* Limiter Active/Bypass Capsule */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setDynamicsParams({ limiter_enabled: !dynamicsParams.limiter_enabled });
              }}
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold transition-all cursor-pointer glass-pill ${
                dynamicsParams.limiter_enabled
                  ? 'bg-rose-600/40 text-rose-200 border-rose-500/50 shadow-[0_0_12px_rgba(244,63,94,0.3)]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {dynamicsParams.limiter_enabled ? 'LIMITER ON' : 'BYPASS'}
            </button>

            {/* Reset Dynamics */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setDynamicsParams({
                  limiter_enabled: true,
                  threshold_db: -1.0,
                  release_ms: 150.0,
                  normalize_enabled: false,
                });
              }}
              className="glass-pill text-[10px] text-slate-300 hover:text-white px-2 py-0.5 rounded-full flex items-center space-x-1 cursor-pointer"
              title="Reset Dynamics to safe studio defaults"
            >
              <RotateCcw className="w-2.5 h-2.5" />
              <span>Default</span>
            </button>
          </div>
        </div>

        {/* Collapsible Content */}
        {dynamicsOpen && (
          <div className="p-3.5 pt-1 border-t border-white/[0.06] space-y-3.5 animate-in fade-in duration-200">
            {/* Input Normalize Switch */}
            <div className="glass-card p-3 rounded-xl flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center space-x-1.5 text-slate-100 font-semibold text-xs">
                  <span>Input Loudness Normalize</span>
                  <span className="text-[10px] glass-pill px-1.5 py-0.2 rounded font-mono text-slate-300">
                    -1.0 dBFS Target
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 font-mono tabular-nums">
                  {track ? `Track Peak Gain: ${(track.normalize_gain ?? 1.0).toFixed(2)}x` : 'Analyzed at track load'}
                </div>
              </div>

              <button
                onClick={() =>
                  setDynamicsParams({ normalize_enabled: !dynamicsParams.normalize_enabled })
                }
                className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all cursor-pointer glass-pill ${
                  dynamicsParams.normalize_enabled
                    ? 'bg-emerald-600/40 text-emerald-200 border-emerald-500/50 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {dynamicsParams.normalize_enabled ? 'ENABLED' : 'OFF'}
              </button>
            </div>

            {/* Brickwall Limiter Threshold */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400 font-medium">Peak Limiter Threshold</span>
                <span className="font-mono tabular-nums text-rose-300 text-[10px] font-bold">
                  {dynamicsParams.threshold_db.toFixed(1)} dBFS
                </span>
              </div>
              <input
                type="range"
                min="-18.0"
                max="0.0"
                step="0.5"
                value={dynamicsParams.threshold_db}
                onChange={(e) => setDynamicsParams({ threshold_db: parseFloat(e.target.value) })}
                className="glass-slider w-full cursor-pointer accent-rose-400"
              />
              <div className="flex justify-between text-[9px] text-slate-500 font-mono tabular-nums">
                <span>-18.0 dBFS</span>
                <span>-1.0 dBFS (Master Target)</span>
                <span>0.0 dBFS (Ceiling)</span>
              </div>
            </div>

            {/* Limiter Release Time */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400 font-medium">Limiter Release Time</span>
                <span className="font-mono tabular-nums text-rose-300 text-[10px] font-bold">
                  {Math.round(dynamicsParams.release_ms)} ms
                </span>
              </div>
              <input
                type="range"
                min="20"
                max="1000"
                step="10"
                value={dynamicsParams.release_ms}
                onChange={(e) => setDynamicsParams({ release_ms: parseFloat(e.target.value) })}
                className="glass-slider w-full cursor-pointer accent-rose-400"
              />
              <div className="flex justify-between text-[9px] text-slate-500 font-mono tabular-nums">
                <span>20 ms (Fast/Aggressive)</span>
                <span>150 ms (Transparent)</span>
                <span>1000 ms (Slow/Pump-Free)</span>
              </div>
            </div>

            {/* Safety Soft-Clipper Status */}
            <div className="glass-card p-2.5 rounded-xl flex items-center justify-between text-[10px]">
              <div className="flex items-center space-x-1.5 text-rose-300">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span className="font-medium">Continuous Soft-Clipper Net</span>
              </div>
              <span className="font-mono tabular-nums text-slate-300">
                C¹ Asymptotic Ceiling (Prevents DAC Wrap)
              </span>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

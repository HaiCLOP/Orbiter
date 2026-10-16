import React, { useState } from 'react';
import {
  Sliders,
  Waves,
  Compass,
  Volume2,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  CheckSquare2,
  Square,
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
    <div className="space-y-3 select-none pb-6">
      {/* 1. 4-Band Cascaded EQ Rack */}
      <section className="bg-[#181d28] rounded-md border border-[#262c3a] overflow-hidden">
        {/* Accordion Header */}
        <div
          onClick={() => setEqOpen(!eqOpen)}
          className="p-2.5 flex items-center justify-between cursor-pointer hover:bg-[#202636] transition-colors"
        >
          <div className="flex items-center space-x-2">
            {eqOpen ? (
              <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
            )}
            <Sliders className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-semibold text-[11px] uppercase tracking-wider text-zinc-200">
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
              className="text-[10px] text-zinc-500 hover:text-zinc-300 flex items-center space-x-1"
              title="Reset EQ to flat"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Flat</span>
            </button>
          </div>
        </div>

        {/* Collapsible Content */}
        {eqOpen && (
          <div className="p-3 pt-1 border-t border-[#232938] space-y-3">
            {/* Low Cut */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-zinc-400">Low Cut (HPF)</span>
                <span className="font-mono text-emerald-400 text-[10px]">
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
                className="w-full h-1.5 bg-[#262c3a] rounded-lg appearance-none cursor-pointer accent-emerald-400"
              />
              <div className="flex justify-between text-[9px] text-zinc-500 font-mono">
                <span>20 Hz (Off)</span>
                <span>500 Hz</span>
              </div>
            </div>

            {/* High Cut */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-zinc-400">High Cut (LPF)</span>
                <span className="font-mono text-emerald-400 text-[10px]">
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
                className="w-full h-1.5 bg-[#262c3a] rounded-lg appearance-none cursor-pointer accent-emerald-400"
              />
              <div className="flex justify-between text-[9px] text-zinc-500 font-mono">
                <span>2.0 kHz</span>
                <span>20.0 kHz (Air)</span>
              </div>
            </div>

            {/* Bass Boost */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-zinc-400">Bass Shelf (100 Hz)</span>
                <span className="font-mono text-[10px]">
                  {eqParams.bass_gain_db > 0 ? (
                    <span className="text-cyan-400">+{eqParams.bass_gain_db.toFixed(1)} dB</span>
                  ) : eqParams.bass_gain_db < 0 ? (
                    <span className="text-rose-400">{eqParams.bass_gain_db.toFixed(1)} dB</span>
                  ) : (
                    <span className="text-zinc-400">0.0 dB</span>
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
                className="w-full h-1.5 bg-[#262c3a] rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
              <div className="flex justify-between text-[9px] text-zinc-500 font-mono">
                <span>-12 dB</span>
                <span>0 dB</span>
                <span>+12 dB</span>
              </div>
            </div>

            {/* Treble Boost */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-zinc-400">Treble Shelf (10 kHz)</span>
                <span className="font-mono text-[10px]">
                  {eqParams.treble_gain_db > 0 ? (
                    <span className="text-amber-400">+{eqParams.treble_gain_db.toFixed(1)} dB</span>
                  ) : eqParams.treble_gain_db < 0 ? (
                    <span className="text-rose-400">{eqParams.treble_gain_db.toFixed(1)} dB</span>
                  ) : (
                    <span className="text-zinc-400">0.0 dB</span>
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
                className="w-full h-1.5 bg-[#262c3a] rounded-lg appearance-none cursor-pointer accent-amber-400"
              />
              <div className="flex justify-between text-[9px] text-zinc-500 font-mono">
                <span>-12 dB</span>
                <span>0 dB</span>
                <span>+12 dB</span>
              </div>
            </div>

            {/* Master Volume */}
            <div className="space-y-1 pt-2 border-t border-[#232938]">
              <div className="flex justify-between text-[11px]">
                <div className="flex items-center space-x-1.5 text-zinc-300 font-medium">
                  <Volume2 className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Master Volume</span>
                </div>
                <span className="font-mono text-indigo-400 text-[10px]">
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
                className="w-full h-1.5 bg-[#262c3a] rounded-lg appearance-none cursor-pointer accent-indigo-400"
              />
              <div className="flex justify-between text-[9px] text-zinc-500 font-mono">
                <span>0% (Mute)</span>
                <span>100% (Unity)</span>
                <span>200% (+6dB)</span>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 2. Environmental Reverb Rack (Step 5) */}
      <section className="bg-[#181d28] rounded-md border border-[#262c3a] overflow-hidden">
        {/* Accordion Header */}
        <div
          onClick={() => setReverbOpen(!reverbOpen)}
          className="p-2.5 flex items-center justify-between cursor-pointer hover:bg-[#202636] transition-colors"
        >
          <div className="flex items-center space-x-2">
            {reverbOpen ? (
              <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
            )}
            <Waves className="w-3.5 h-3.5 text-purple-400" />
            <span className="font-semibold text-[11px] uppercase tracking-wider text-zinc-200">
              FDN-8 Reverb Tank
            </span>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              setReverbParams({ enabled: !reverbParams.enabled });
            }}
            className={`flex items-center space-x-1 text-[10px] px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
              reverbParams.enabled
                ? 'text-purple-400 bg-purple-950/60 border border-purple-800/40 font-semibold'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {reverbParams.enabled ? (
              <CheckSquare2 className="w-3.5 h-3.5" />
            ) : (
              <Square className="w-3.5 h-3.5" />
            )}
            <span>{reverbParams.enabled ? 'Active' : 'Bypassed'}</span>
          </button>
        </div>

        {/* Reverb Controls Content */}
        {reverbOpen && (
          <div
            className={`p-3 pt-1 border-t border-[#232938] space-y-3 transition-opacity ${
              reverbParams.enabled ? 'opacity-100' : 'opacity-60'
            }`}
          >
            {/* Distance Auto-Tie Live Formula Badge */}
            <div className="bg-[#131720] rounded p-2 border border-[#232938] text-[10px] space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-zinc-400 flex items-center gap-1 font-medium">
                  <Sparkles className="w-3 h-3 text-purple-400" />
                  Distance DRR Auto-Tie:
                </span>
                <span className="font-mono text-purple-300 font-semibold">
                  {effectiveWetPct}% Wet
                </span>
              </div>
              <p className="text-[9px] text-zinc-500 leading-tight">
                Wet level scales naturally with virtual distance ({Math.round(currentDistance * 100)}%). Farther sources excite more room reflection.
              </p>
            </div>

            {/* Reverb Amount / Wet Mix */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-zinc-400">Reverb Base Amount</span>
                <span className="font-mono text-purple-400 text-[10px]">
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
                disabled={!reverbParams.enabled}
                className="w-full h-1.5 bg-[#262c3a] rounded-lg appearance-none cursor-pointer accent-purple-400 disabled:opacity-40"
              />
              <div className="flex justify-between text-[9px] text-zinc-500 font-mono">
                <span>Dry (0%)</span>
                <span>Wet (100%)</span>
              </div>
            </div>

            {/* Room Size */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-zinc-400">Room Size</span>
                <span className="font-mono text-purple-400 text-[10px]">
                  {Math.round(reverbParams.room_size * 100)}%{' '}
                  <span className="text-zinc-500">
                    ({reverbParams.room_size < 0.3 ? 'Studio' : reverbParams.room_size < 0.7 ? 'Chamber' : 'Cathedral'})
                  </span>
                </span>
              </div>
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.01"
                value={reverbParams.room_size}
                onChange={(e) => setReverbParams({ room_size: parseFloat(e.target.value) })}
                disabled={!reverbParams.enabled}
                className="w-full h-1.5 bg-[#262c3a] rounded-lg appearance-none cursor-pointer accent-purple-400 disabled:opacity-40"
              />
              <div className="flex justify-between text-[9px] text-zinc-500 font-mono">
                <span>Small Room</span>
                <span>Cathedral</span>
              </div>
            </div>

            {/* Decay RT60 */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-zinc-400">Decay Time (RT60)</span>
                <span className="font-mono text-purple-400 text-[10px]">
                  {reverbParams.decay.toFixed(1)} s
                </span>
              </div>
              <input
                type="range"
                min="0.2"
                max="10.0"
                step="0.1"
                value={reverbParams.decay}
                onChange={(e) => setReverbParams({ decay: parseFloat(e.target.value) })}
                disabled={!reverbParams.enabled}
                className="w-full h-1.5 bg-[#262c3a] rounded-lg appearance-none cursor-pointer accent-purple-400 disabled:opacity-40"
              />
              <div className="flex justify-between text-[9px] text-zinc-500 font-mono">
                <span>0.2 s (Tight)</span>
                <span>10.0 s (Vast)</span>
              </div>
            </div>

            {/* Damping / HF Absorption */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-zinc-400">High-Freq Damping</span>
                <span className="font-mono text-purple-400 text-[10px]">
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
                disabled={!reverbParams.enabled}
                className="w-full h-1.5 bg-[#262c3a] rounded-lg appearance-none cursor-pointer accent-purple-400 disabled:opacity-40"
              />
              <div className="flex justify-between text-[9px] text-zinc-500 font-mono">
                <span>Bright (Stone)</span>
                <span>Damped (Velvet)</span>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 3. 3D Acoustic Cues (Distance & Elevation) */}
      <section className="bg-[#181d28] rounded-md border border-[#262c3a] overflow-hidden">
        {/* Accordion Header */}
        <div
          onClick={() => setSpatial3dOpen(!spatial3dOpen)}
          className="p-2.5 flex items-center justify-between cursor-pointer hover:bg-[#202636] transition-colors"
        >
          <div className="flex items-center space-x-2">
            {spatial3dOpen ? (
              <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
            )}
            <Compass className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-semibold text-[11px] uppercase tracking-wider text-zinc-200">
              3D Acoustic Cues
            </span>
          </div>
        </div>

        {spatial3dOpen && (
          <div className="p-3 pt-1 border-t border-[#232938] space-y-3">
            {/* Distance */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-zinc-400">Distance Falloff & Air Absorption</span>
                <span className="font-mono text-amber-400 text-[10px]">
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
                className="w-full h-1.5 bg-[#262c3a] rounded-lg appearance-none cursor-pointer accent-amber-400"
              />
            </div>

            {/* Elevation */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-zinc-400">Elevation Pinna Cue</span>
                <span className="font-mono text-[10px]">
                  {(spatialParams.elevation ?? 0) > 0.05 ? (
                    <span className="text-emerald-400">+{Math.round(spatialParams.elevation * 100)}% (Above)</span>
                  ) : (spatialParams.elevation ?? 0) < -0.05 ? (
                    <span className="text-sky-400">{Math.round(spatialParams.elevation * 100)}% (Below)</span>
                  ) : (
                    <span className="text-zinc-400">0% (Ear-level)</span>
                  )}
                </span>
              </div>
              <input
                type="range"
                min="-1.0"
                max="1.0"
                step="0.01"
                value={spatialParams.elevation ?? 0}
                onChange={(e) => setElevation(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-[#262c3a] rounded-lg appearance-none cursor-pointer accent-emerald-400"
              />
            </div>
          </div>
        )}
      </section>

      {/* 4. Dynamics & Master Limiter Rack */}
      <section className="bg-[#181d28] rounded-md border border-[#262c3a] overflow-hidden">
        {/* Accordion Header */}
        <div
          onClick={() => setDynamicsOpen(!dynamicsOpen)}
          className="p-2.5 flex items-center justify-between cursor-pointer hover:bg-[#202636] transition-colors"
        >
          <div className="flex items-center space-x-2">
            {dynamicsOpen ? (
              <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
            )}
            <Gauge className="w-3.5 h-3.5 text-rose-400" />
            <span className="font-semibold text-[11px] uppercase tracking-wider text-zinc-200">
              Dynamics & Master Limiter
            </span>
          </div>

          <div className="flex items-center space-x-2">
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
              className="text-[10px] text-zinc-500 hover:text-zinc-300 flex items-center space-x-1"
              title="Reset Dynamics to default (-1.0 dBFS ceiling)"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {dynamicsOpen && (
          <div className="p-3 pt-1 border-t border-[#232938] space-y-3.5">
            {/* Limiter Main Enable Toggle & Status */}
            <div className="flex items-center justify-between bg-[#121620] p-2 rounded border border-[#222836]">
              <div className="flex items-center space-x-2">
                <ShieldCheck
                  className={`w-4 h-4 ${
                    dynamicsParams.limiter_enabled ? 'text-rose-400' : 'text-zinc-500'
                  }`}
                />
                <div>
                  <span className="text-[11px] font-semibold text-zinc-200 block">
                    Brickwall Peak Limiter
                  </span>
                  <span className="text-[9px] text-zinc-400 font-mono">
                    5.0ms Lookahead • Zero Overshoots
                  </span>
                </div>
              </div>

              <button
                onClick={() =>
                  setDynamicsParams({ limiter_enabled: !dynamicsParams.limiter_enabled })
                }
                className="flex items-center space-x-1.5 text-zinc-200 hover:text-white transition-colors"
              >
                {dynamicsParams.limiter_enabled ? (
                  <CheckSquare2 className="w-4 h-4 text-rose-400" />
                ) : (
                  <Square className="w-4 h-4 text-zinc-500" />
                )}
                <span className="text-[11px] font-mono">
                  {dynamicsParams.limiter_enabled ? 'Active' : 'Bypassed'}
                </span>
              </button>
            </div>

            {/* Limiter Ceiling (Threshold) */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-zinc-400">Ceiling Threshold</span>
                <span className="font-mono text-rose-400 text-[10px]">
                  {dynamicsParams.threshold_db.toFixed(1)} dBFS
                </span>
              </div>
              <input
                type="range"
                min="-18.0"
                max="0.0"
                step="0.1"
                disabled={!dynamicsParams.limiter_enabled}
                value={dynamicsParams.threshold_db}
                onChange={(e) =>
                  setDynamicsParams({ threshold_db: parseFloat(e.target.value) })
                }
                className={`w-full h-1.5 bg-[#262c3a] rounded-lg appearance-none cursor-pointer accent-rose-400 ${
                  !dynamicsParams.limiter_enabled ? 'opacity-40 cursor-not-allowed' : ''
                }`}
              />
              <div className="flex justify-between text-[9px] text-zinc-500 font-mono">
                <span>-18.0 dB (Aggressive)</span>
                <span>-1.0 dB (Standard)</span>
                <span>0.0 dB (Max)</span>
              </div>
            </div>

            {/* Limiter Release Time */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-zinc-400">Release Time</span>
                <span className="font-mono text-zinc-200 text-[10px]">
                  {Math.round(dynamicsParams.release_ms)} ms
                </span>
              </div>
              <input
                type="range"
                min="20"
                max="1000"
                step="5"
                disabled={!dynamicsParams.limiter_enabled}
                value={dynamicsParams.release_ms}
                onChange={(e) =>
                  setDynamicsParams({ release_ms: parseFloat(e.target.value) })
                }
                className={`w-full h-1.5 bg-[#262c3a] rounded-lg appearance-none cursor-pointer accent-rose-400 ${
                  !dynamicsParams.limiter_enabled ? 'opacity-40 cursor-not-allowed' : ''
                }`}
              />
              <div className="flex justify-between text-[9px] text-zinc-500 font-mono">
                <span>20 ms (Fast)</span>
                <span>150 ms (Transparent)</span>
                <span>1000 ms (Slow)</span>
              </div>
            </div>

            {/* Input Loudness Normalization */}
            <div className="pt-2 border-t border-[#232938]/70 space-y-2">
              <div className="flex items-center justify-between bg-[#121620] p-2 rounded border border-[#222836]">
                <div>
                  <span className="text-[11px] font-semibold text-zinc-200 block">
                    Auto-Normalize Input
                  </span>
                  <span className="text-[9px] text-zinc-400 font-mono">
                    Target: -1.0 dBFS Raw Peak
                  </span>
                </div>

                <button
                  onClick={() =>
                    setDynamicsParams({
                      normalize_enabled: !dynamicsParams.normalize_enabled,
                    })
                  }
                  className="flex items-center space-x-1.5 text-zinc-200 hover:text-white transition-colors"
                >
                  {dynamicsParams.normalize_enabled ? (
                    <CheckSquare2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Square className="w-4 h-4 text-zinc-500" />
                  )}
                  <span className="text-[11px] font-mono">
                    {dynamicsParams.normalize_enabled ? 'Active' : 'Off'}
                  </span>
                </button>
              </div>

              {/* Readout of track normalize statistics */}
              {track ? (
                <div className="bg-[#141824] p-2 rounded text-[10px] space-y-1 font-mono border border-[#1f2535]">
                  <div className="flex justify-between text-zinc-400">
                    <span>Raw Track Peak:</span>
                    <span className="text-zinc-200">
                      {(20 * Math.log10(0.89125 / Math.max(1e-4, track.normalize_gain))).toFixed(1)} dBFS
                    </span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>Applied Input Gain:</span>
                    <span
                      className={
                        track.normalize_gain >= 1.0 ? 'text-emerald-400' : 'text-amber-400'
                      }
                    >
                      {track.normalize_gain >= 1.0 ? '+' : ''}
                      {(20 * Math.log10(Math.max(1e-4, track.normalize_gain))).toFixed(1)} dB (
                      {(track.normalize_gain * 100).toFixed(0)}%)
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-[10px] text-zinc-500 italic">
                  Load an audio file to view analyzed peak loudness.
                </div>
              )}

              <p className="text-[9px] text-zinc-500 leading-tight">
                * Note: Normalize sets consistent input headroom before spatial/EQ stages; downstream boosts are caught by the Brickwall Limiter.
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

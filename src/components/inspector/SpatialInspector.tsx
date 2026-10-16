import React from 'react';
import { Sparkles, CheckSquare2, Square, RotateCcw, Compass, ArrowUpDown, MoveHorizontal, Infinity as InfinityIcon, Circle, Disc, Orbit } from 'lucide-react';
import { useTrackStore } from '../../store/trackStore';

export const SpatialInspector: React.FC = () => {
  const {
    spatialParams,
    set8DEnabled,
    setRotationSpeed,
    setIntensity,
    setDistance,
    setElevation,
  } = useTrackStore();

  const speedPresets = [
    { label: '0.10 Hz', value: 0.1 },
    { label: '0.25 Hz', value: 0.25 },
    { label: '0.50 Hz', value: 0.5 },
    { label: '1.00 Hz', value: 1.0 },
  ];

  const orbitPresets = [
    { name: 'Classic Orbit', speed: 0.25, intensity: 0.85, distance: 0.35, elevation: 0.0, icon: <InfinityIcon className="w-3.5 h-3.5 text-cyan-400" /> },
    { name: 'Slow Spin', speed: 0.1, intensity: 0.75, distance: 0.2, elevation: 0.1, icon: <Circle className="w-3.5 h-3.5 text-purple-400" /> },
    { name: 'Front to Back', speed: 0.18, intensity: 0.9, distance: 0.6, elevation: -0.2, icon: <Disc className="w-3.5 h-3.5 text-rose-400" /> },
    { name: 'Head Circle', speed: 0.4, intensity: 0.95, distance: 0.1, elevation: 0.3, icon: <Orbit className="w-3.5 h-3.5 text-emerald-400" /> },
    { name: 'Deep Space', speed: 0.15, intensity: 0.8, distance: 0.85, elevation: 0.4, icon: <Compass className="w-3.5 h-3.5 text-amber-400" /> },
  ];

  return (
    <div className="space-y-4 select-none">
      {/* 8D Master Section */}
      <section className="space-y-2">
        <div className="flex items-center justify-between text-slate-400 font-bold text-[10px] uppercase tracking-wider px-1">
          <div className="flex items-center space-x-1.5">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>8D Panning Core</span>
          </div>
          <button
            onClick={() => set8DEnabled(!spatialParams.enabled)}
            className={`glass-pill px-2.5 py-0.5 rounded-full flex items-center space-x-1.5 transition-all cursor-pointer font-bold ${
              spatialParams.enabled
                ? 'text-cyan-300 border-cyan-500/40 shadow-[0_0_10px_rgba(6,182,212,0.25)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {spatialParams.enabled ? (
              <CheckSquare2 className="w-3 h-3 text-cyan-400" />
            ) : (
              <Square className="w-3 h-3 text-slate-500" />
            )}
            <span>{spatialParams.enabled ? 'ACTIVE' : 'BYPASSED'}</span>
          </button>
        </div>

        <div
          className={`glass-panel rounded-2xl p-3.5 space-y-3.5 transition-all ${
            spatialParams.enabled
              ? 'border-cyan-500/30 shadow-[0_4px_20px_rgba(6,182,212,0.1)]'
              : 'opacity-60'
          }`}
        >
          {/* Rotation Speed Control */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-200 font-medium">Rotation Speed</span>
              <span className="font-mono tabular-nums text-cyan-400 text-[10px] font-bold">
                {spatialParams.rotation_speed.toFixed(2)} Hz{' '}
                <span className="text-slate-500 font-normal">
                  (~{(1 / Math.max(0.01, spatialParams.rotation_speed)).toFixed(1)}s / rev)
                </span>
              </span>
            </div>
            <input
              type="range"
              min="0.05"
              max="2.0"
              step="0.01"
              value={spatialParams.rotation_speed}
              onChange={(e) => setRotationSpeed(parseFloat(e.target.value))}
              disabled={!spatialParams.enabled}
              className="glass-slider w-full cursor-pointer accent-cyan-400 disabled:opacity-40"
            />
            {/* Quick Speed Presets */}
            <div className="flex items-center justify-between pt-1">
              {speedPresets.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => setRotationSpeed(preset.value)}
                  disabled={!spatialParams.enabled}
                  className={`text-[9px] font-mono tabular-nums px-2 py-0.5 rounded-lg transition-all cursor-pointer ${
                    Math.abs(spatialParams.rotation_speed - preset.value) < 0.02
                      ? 'glass-pill text-cyan-300 border-cyan-400/40 font-bold shadow-[0_0_8px_rgba(6,182,212,0.2)]'
                      : 'glass-card text-slate-400 hover:text-white'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Spatial Intensity Control */}
          <div className="space-y-2 pt-1 border-t border-white/[0.06]">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-200 font-medium">Binaural Depth (Intensity)</span>
              <span className="font-mono tabular-nums text-indigo-400 text-[10px] font-bold">
                {Math.round(spatialParams.intensity * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0.0"
              max="1.0"
              step="0.01"
              value={spatialParams.intensity}
              onChange={(e) => setIntensity(parseFloat(e.target.value))}
              disabled={!spatialParams.enabled}
              className="glass-slider w-full cursor-pointer accent-indigo-400 disabled:opacity-40"
            />
          </div>
        </div>
      </section>

      {/* 3D Acoustic Position (Distance & Elevation) */}
      <section className="space-y-2">
        <div className="flex items-center justify-between text-slate-400 font-bold text-[10px] uppercase tracking-wider px-1">
          <div className="flex items-center space-x-1.5">
            <Compass className="w-3.5 h-3.5 text-amber-400" />
            <span>3D Spatial Coordinates</span>
          </div>
          <button
            onClick={() => {
              setDistance(0.0);
              setElevation(0.0);
            }}
            className="glass-pill px-2 py-0.5 rounded-full flex items-center space-x-1 text-[9px] text-slate-300 hover:text-white cursor-pointer"
            title="Reset Distance and Elevation to center"
          >
            <RotateCcw className="w-2.5 h-2.5" />
            <span>Center</span>
          </button>
        </div>

        <div className="glass-panel rounded-2xl p-3.5 space-y-3.5 border-amber-500/20">
          {/* Distance Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <div className="flex items-center space-x-1.5 text-slate-200 font-medium">
                <MoveHorizontal className="w-3.5 h-3.5 text-amber-400" />
                <span>Distance Falloff</span>
              </div>
              <span className="font-mono tabular-nums text-amber-400 text-[10px] font-bold">
                {Math.round((spatialParams.distance ?? 0) * 100)}%{' '}
                <span className="text-slate-500 font-normal">
                  ({(spatialParams.distance ?? 0) < 0.25 ? 'Near' : (spatialParams.distance ?? 0) < 0.7 ? 'Mid' : 'Far'})
                </span>
              </span>
            </div>
            <input
              type="range"
              min="0.0"
              max="1.0"
              step="0.01"
              value={spatialParams.distance ?? 0.0}
              onChange={(e) => setDistance(parseFloat(e.target.value))}
              className="glass-slider w-full cursor-pointer accent-amber-400"
            />
            <div className="flex justify-between text-[9px] text-slate-500 font-mono tabular-nums">
              <span>0% (Intimate)</span>
              <span>100% (Distant Air)</span>
            </div>
          </div>

          {/* Elevation Slider */}
          <div className="space-y-2 pt-1 border-t border-white/[0.06]">
            <div className="flex items-center justify-between text-[11px]">
              <div className="flex items-center space-x-1.5 text-slate-200 font-medium">
                <ArrowUpDown className="w-3.5 h-3.5 text-purple-400" />
                <span>Elevation Pinna Cue</span>
              </div>
              <span className="font-mono tabular-nums text-purple-400 text-[10px] font-bold">
                {(spatialParams.elevation ?? 0) > 0 ? `+${Math.round(spatialParams.elevation * 100)}%` : `${Math.round((spatialParams.elevation ?? 0) * 100)}%`}{' '}
                <span className="text-slate-500 font-normal">
                  {(spatialParams.elevation ?? 0) > 0.05 ? '(Above)' : (spatialParams.elevation ?? 0) < -0.05 ? '(Below)' : '(Ear Level)'}
                </span>
              </span>
            </div>
            <input
              type="range"
              min="-1.0"
              max="1.0"
              step="0.01"
              value={spatialParams.elevation ?? 0.0}
              onChange={(e) => setElevation(parseFloat(e.target.value))}
              className="glass-slider w-full cursor-pointer accent-purple-400"
            />
            <div className="flex justify-between text-[9px] text-slate-500 font-mono tabular-nums">
              <span>-100% (Feet)</span>
              <span>0% (Neutral)</span>
              <span>+100% (Overhead)</span>
            </div>
          </div>
        </div>
      </section>

      {/* Trajectory Presets List */}
      <section className="space-y-2">
        <div className="text-slate-400 font-bold text-[10px] uppercase tracking-wider px-1">
          Trajectory Presets
        </div>
        <div className="space-y-1.5">
          {orbitPresets.map((preset) => (
            <div
              key={preset.name}
              onClick={() => {
                setRotationSpeed(preset.speed);
                setIntensity(preset.intensity);
                setDistance(preset.distance);
                setElevation(preset.elevation);
              }}
              className="glass-card hover:bg-white/[0.08] p-2.5 rounded-xl border border-white/[0.06] hover:border-white/[0.18] flex items-center justify-between cursor-pointer transition-all hover:scale-[1.02] active:scale-95"
            >
              <div className="flex items-center space-x-2.5">
                {preset.icon}
                <div>
                  <div className="text-[11px] font-semibold text-slate-200">{preset.name}</div>
                  <div className="text-[9px] text-slate-400 font-mono tabular-nums">
                    Dist: {Math.round(preset.distance * 100)}% • Elev: {preset.elevation > 0 ? `+${Math.round(preset.elevation * 100)}%` : `${Math.round(preset.elevation * 100)}%`}
                  </div>
                </div>
              </div>
              <span className="font-mono text-[10px] text-cyan-400 font-bold glass-pill px-2 py-0.5 rounded-lg">
                {preset.speed} Hz
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

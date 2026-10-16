import React from 'react';
import { Sparkles, CheckSquare2, Square, RotateCcw, Compass, ArrowUpDown, MoveHorizontal } from 'lucide-react';
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
    { name: 'Classic Orbit', speed: 0.25, intensity: 0.85, distance: 0.35, elevation: 0.0 },
    { name: 'Slow Spin', speed: 0.1, intensity: 0.75, distance: 0.2, elevation: 0.1 },
    { name: 'Front to Back', speed: 0.18, intensity: 0.9, distance: 0.6, elevation: -0.2 },
    { name: 'Head Circle', speed: 0.4, intensity: 0.95, distance: 0.1, elevation: 0.3 },
    { name: 'Deep Space', speed: 0.15, intensity: 0.8, distance: 0.85, elevation: 0.4 },
  ];

  return (
    <div className="space-y-4">
      {/* 8D Master Section */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between text-zinc-400 font-semibold text-[11px] uppercase tracking-wider">
          <div className="flex items-center space-x-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>8D Panning Core</span>
          </div>
          <button
            onClick={() => set8DEnabled(!spatialParams.enabled)}
            className={`flex items-center space-x-1 text-[10px] px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
              spatialParams.enabled
                ? 'text-cyan-400 bg-cyan-950/60 border border-cyan-800/40 font-semibold'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {spatialParams.enabled ? (
              <CheckSquare2 className="w-3.5 h-3.5" />
            ) : (
              <Square className="w-3.5 h-3.5" />
            )}
            <span>{spatialParams.enabled ? 'Active' : 'Bypassed'}</span>
          </button>
        </div>

        <div
          className={`rounded-md p-2.5 border transition-all space-y-3 ${
            spatialParams.enabled
              ? 'bg-[#181d28] border-indigo-500/40 shadow-sm shadow-indigo-950'
              : 'bg-[#181d28]/50 border-[#262c3a] opacity-70'
          }`}
        >
          {/* Rotation Speed Control */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-300 font-medium">Rotation Speed</span>
              <span className="font-mono text-cyan-400 text-[10px]">
                {spatialParams.rotation_speed.toFixed(2)} Hz{' '}
                <span className="text-zinc-500">
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
              className="w-full h-1.5 bg-[#262c3a] rounded-lg appearance-none cursor-pointer accent-cyan-400 disabled:opacity-40"
            />
            {/* Quick Speed Presets */}
            <div className="flex items-center justify-between pt-1">
              {speedPresets.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => setRotationSpeed(preset.value)}
                  disabled={!spatialParams.enabled}
                  className={`text-[9px] font-mono px-1.5 py-0.5 rounded transition-colors ${
                    Math.abs(spatialParams.rotation_speed - preset.value) < 0.02
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      : 'text-zinc-500 hover:text-zinc-300 bg-[#202636]'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Spatial Intensity Control */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-300 font-medium">Binaural Depth (Intensity)</span>
              <span className="font-mono text-indigo-400 text-[10px]">
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
              className="w-full h-1.5 bg-[#262c3a] rounded-lg appearance-none cursor-pointer accent-indigo-400 disabled:opacity-40"
            />
          </div>
        </div>
      </section>

      {/* 3D Acoustic Position (Distance & Elevation) */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between text-zinc-400 font-semibold text-[11px] uppercase tracking-wider">
          <div className="flex items-center space-x-1.5">
            <Compass className="w-3.5 h-3.5 text-amber-400" />
            <span>3D Spatial Coordinates</span>
          </div>
          <button
            onClick={() => {
              setDistance(0.0);
              setElevation(0.0);
            }}
            className="flex items-center space-x-1 text-[10px] text-zinc-500 hover:text-zinc-300 cursor-pointer"
            title="Reset Distance and Elevation to center"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Center</span>
          </button>
        </div>

        <div className="bg-[#181d28] rounded-md p-2.5 border border-[#262c3a] space-y-3">
          {/* Distance Slider */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <div className="flex items-center space-x-1 text-zinc-300 font-medium">
                <MoveHorizontal className="w-3 h-3 text-amber-400" />
                <span>Distance Falloff</span>
              </div>
              <span className="font-mono text-amber-400 text-[10px]">
                {Math.round((spatialParams.distance ?? 0) * 100)}%{' '}
                <span className="text-zinc-500">
                  ({(spatialParams.distance ?? 0) < 0.25 ? 'Near' : (spatialParams.distance ?? 0) < 0.7 ? 'Mid' : 'Far'})
                </span>
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
            <div className="flex justify-between text-[9px] text-zinc-500 font-mono">
              <span>0% (Intimate)</span>
              <span>100% (Distant Air)</span>
            </div>
          </div>

          {/* Elevation Slider */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <div className="flex items-center space-x-1 text-zinc-300 font-medium">
                <ArrowUpDown className="w-3 h-3 text-emerald-400" />
                <span>Elevation Pinna Cue</span>
              </div>
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
            <div className="flex justify-between text-[9px] text-zinc-500 font-mono">
              <span>-100% (Feet)</span>
              <span>0% (Neutral)</span>
              <span>+100% (Overhead)</span>
            </div>
          </div>
        </div>
      </section>

      {/* Orbit Trajectory Presets */}
      <section className="space-y-2">
        <div className="flex items-center justify-between text-zinc-400 font-semibold text-[11px] uppercase tracking-wider">
          <span>Trajectory Presets</span>
        </div>
        <div className="grid grid-cols-1 gap-1.5">
          {orbitPresets.map((preset) => (
            <button
              key={preset.name}
              onClick={() => {
                set8DEnabled(true);
                setRotationSpeed(preset.speed);
                setIntensity(preset.intensity);
                setDistance(preset.distance);
                setElevation(preset.elevation);
              }}
              className="w-full text-left p-2 rounded bg-[#181d28] hover:bg-[#202636] border border-[#262c3a] hover:border-indigo-500/40 text-[11px] transition-colors cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-zinc-200 group-hover:text-indigo-300">
                  {preset.name}
                </span>
                <span className="text-[10px] font-mono text-zinc-500">
                  {preset.speed} Hz
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1 text-[9px] font-mono text-zinc-500">
                <span>Dist: {Math.round(preset.distance * 100)}%</span>
                <span>•</span>
                <span>Elev: {preset.elevation > 0 ? `+${Math.round(preset.elevation * 100)}%` : `${Math.round(preset.elevation * 100)}%`}</span>
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};

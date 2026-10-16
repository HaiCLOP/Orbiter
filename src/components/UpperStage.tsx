import React, { useState, useRef, useEffect } from 'react';
import { Orbit, ExternalLink } from 'lucide-react';
import { useTrackStore } from '../store/trackStore';
import { useWorkspaceStore } from '../store/workspaceStore';
import { useTimelineStore } from '../store/timelineStore';
import { SpatialRadar3D } from './SpatialRadar3D';
import type { AutomationLaneId } from '../types/automation';

export const UpperStage: React.FC = () => {
  const { isPlaying, azimuth, spatialParams, reverbParams, duration, position } = useTrackStore();
  const { timeline, setActiveLane } = useTimelineStore();
  const { setActiveTab } = useWorkspaceStore();
  const [viewMode, setViewMode] = useState<'3D' | 'Top' | 'Front' | 'Side'>('3D');

  // Visual angle for telemetry readout
  const visualAngleRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(performance.now());

  useEffect(() => {
    visualAngleRef.current = azimuth;
  }, [azimuth]);

  useEffect(() => {
    let animId: number;
    const update = (now: number) => {
      const dt = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;

      if (isPlaying && spatialParams.enabled) {
        const delta = 2 * Math.PI * spatialParams.rotation_speed * dt;
        visualAngleRef.current = (visualAngleRef.current + delta) % (2 * Math.PI);
      } else if (!isPlaying) {
        visualAngleRef.current = azimuth;
      }
      animId = requestAnimationFrame(update);
    };
    animId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, spatialParams, azimuth]);

  const degrees = Math.round((visualAngleRef.current * 180) / Math.PI) % 360;

  return (
    <div className="h-68 grid grid-cols-12 gap-3 p-3 bg-transparent select-none">
      {/* Left: 3D Holographic Spatial Radar */}
      <div className="col-span-5 glass-panel rounded-2xl p-3.5 flex flex-col justify-between relative overflow-hidden shadow-xl">
        {/* Ambient Optics Glow */}
        <div className="absolute -top-16 -left-16 w-56 h-56 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Header & View Mode Switcher */}
        <div className="flex items-center justify-between z-10 relative">
          <div className="flex items-center space-x-2 text-slate-100 font-bold text-xs tracking-tight">
            <div className="w-5 h-5 rounded-lg glass-card flex items-center justify-center border-cyan-500/40 shadow-[0_0_10px_rgba(6,182,212,0.3)]">
              <Orbit className="w-3.5 h-3.5 text-cyan-400 animate-[spin_12s_linear_infinite]" />
            </div>
            <span className="text-[12px] bg-gradient-to-r from-cyan-300 to-indigo-200 bg-clip-text text-transparent">
              3D Spatial Hologram
            </span>
          </div>

          {/* Segmented View Mode Controller */}
          <div className="flex items-center space-x-1 glass-card p-0.5 rounded-xl border border-white/[0.08] text-[10px] font-mono">
            {(['3D', 'Top', 'Front', 'Side'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-2.5 py-0.5 rounded-lg font-semibold transition-all cursor-pointer ${
                  viewMode === mode
                    ? 'bg-cyan-500/30 text-cyan-200 border border-cyan-400/40 shadow-[0_0_10px_rgba(6,182,212,0.25)]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        {/* 3D WebGL Canvas Container */}
        <div className="relative flex-1 w-full my-1.5 rounded-xl overflow-hidden glass-card border-white/[0.06] shadow-inner">
          <SpatialRadar3D viewMode={viewMode} />
        </div>

        {/* Telemetry Readout Footer */}
        <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1.5 border-t border-white/[0.06] z-10 font-mono tabular-nums">
          <div className="flex items-center space-x-2">
            <span className={spatialParams.enabled ? 'text-cyan-400 font-bold' : 'text-slate-500'}>
              {spatialParams.enabled ? `Az: ${degrees}°` : '8D Bypassed'}
            </span>
            <span className="text-white/20">•</span>
            <span className="text-amber-400 font-semibold">
              Dist: {Math.round((spatialParams.distance ?? 0) * 100)}%
            </span>
            <span className="text-white/20">•</span>
            <span
              className={
                (spatialParams.elevation ?? 0) > 0.05
                  ? 'text-emerald-400 font-semibold'
                  : (spatialParams.elevation ?? 0) < -0.05
                  ? 'text-purple-400 font-semibold'
                  : 'text-slate-400'
              }
            >
              Elev: {(spatialParams.elevation ?? 0) > 0.05 ? `+${Math.round(spatialParams.elevation * 100)}%` : (spatialParams.elevation ?? 0) < -0.05 ? `${Math.round(spatialParams.elevation * 100)}%` : '0%'}
            </span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="glass-pill px-2 py-0.5 rounded-full text-[9px] text-indigo-300 border-indigo-500/30 font-bold">
              AirPods Max Mode
            </span>
          </div>
        </div>
      </div>

      {/* Right: Live Graph Editor Curves & Automation Monitor */}
      <div className="col-span-7 glass-panel rounded-2xl p-3.5 flex flex-col justify-between relative overflow-hidden shadow-xl">
        {/* Ambient Optics Glow */}
        <div className="absolute -top-16 -right-16 w-64 h-64 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Header Tools */}
        <div className="flex items-center justify-between pb-2.5 border-b border-white/[0.06] relative z-10">
          <div className="flex items-center space-x-2.5">
            <span
              onClick={() => setActiveTab('Graph')}
              className="text-xs font-bold text-slate-100 hover:text-cyan-300 cursor-pointer flex items-center gap-1.5 transition-colors tracking-tight"
            >
              Automation Curves
              <ExternalLink className="w-3 h-3 text-slate-500 hover:text-cyan-400" />
            </span>
            <span
              onClick={() => setActiveTab('Graph')}
              className="glass-pill text-[9px] text-cyan-300 font-mono px-2 py-0.5 rounded-full border-cyan-500/30 cursor-pointer hover:bg-cyan-950/40 transition-colors shadow-[0_0_8px_rgba(6,182,212,0.15)] font-bold"
            >
              Real-Time Sync
            </span>
          </div>

          <div className="flex items-center space-x-1.5 text-[11px] font-mono">
            <button
              type="button"
              onClick={() => {
                setActiveLane('pan');
                setActiveTab('Graph');
              }}
              className="glass-pill px-2.5 py-0.5 rounded-lg flex items-center gap-1.5 text-cyan-300 hover:text-white cursor-pointer active:scale-95"
            >
              <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_6px_#06b6d4]" /> Pan
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveLane('distance');
                setActiveTab('Graph');
              }}
              className="glass-pill px-2.5 py-0.5 rounded-lg flex items-center gap-1.5 text-amber-300 hover:text-white cursor-pointer active:scale-95"
            >
              <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_6px_#f59e0b]" /> Distance
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveLane('elevation');
                setActiveTab('Graph');
              }}
              className="glass-pill px-2.5 py-0.5 rounded-lg flex items-center gap-1.5 text-purple-300 hover:text-white cursor-pointer active:scale-95"
            >
              <span className="w-2 h-2 rounded-full bg-purple-400 shadow-[0_0_6px_#a855f7]" /> Elev
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveLane('reverb');
                setActiveTab('Graph');
              }}
              className="glass-pill px-2.5 py-0.5 rounded-lg flex items-center gap-1.5 text-emerald-300 hover:text-white cursor-pointer active:scale-95"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#10b981]" /> Reverb
            </button>
          </div>
        </div>

        {/* Dynamic Multi-Lane SVG Curve Highway */}
        {(() => {
          const totalDur = duration > 0 ? duration : 180.0;
          const numPoints = 90;

          const getLaneCurve = (
            laneId: AutomationLaneId,
            min: number,
            max: number,
            defaultVal: number,
            fallbackLfo?: boolean
          ) => {
            const lane = timeline?.lanes.find((l) => l.id === laneId);
            const hasKeyframes = lane && lane.enabled && lane.keyframes.length > 0;
            const points: string[] = [];

            for (let i = 0; i <= numPoints; i++) {
              const frac = i / numPoints;
              const x = frac * 600;
              const t = frac * totalDur;
              let val = defaultVal;

              if (hasKeyframes) {
                const kfs = lane.keyframes;
                if (t <= kfs[0].time) {
                  val = kfs[0].value;
                } else if (t >= kfs[kfs.length - 1].time) {
                  val = kfs[kfs.length - 1].value;
                } else {
                  for (let s = 0; s < kfs.length - 1; s++) {
                    if (t >= kfs[s].time && t <= kfs[s + 1].time) {
                      const p = (t - kfs[s].time) / (kfs[s + 1].time - kfs[s].time);
                      const curve = kfs[s].curve;
                      if (curve.type === 'bezier') {
                        const oneMinusP = 1 - p;
                        const normY =
                          3 * oneMinusP * oneMinusP * p * curve.c1_y +
                          3 * oneMinusP * p * p * curve.c2_y +
                          p * p * p;
                        val = kfs[s].value + normY * (kfs[s + 1].value - kfs[s].value);
                      } else if (curve.type === 'hold') {
                        val = kfs[s].value;
                      } else {
                        val = kfs[s].value + p * (kfs[s + 1].value - kfs[s].value);
                      }
                      break;
                    }
                  }
                }
              } else if (fallbackLfo) {
                val = Math.sin(2 * Math.PI * (spatialParams.rotation_speed || 0.25) * t);
              }

              const norm = (val - min) / (max - min);
              const clampedNorm = Math.min(1, Math.max(0, norm));
              const y = 10 + (1 - clampedNorm) * 100;
              points.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`);
            }

            return points.join(' ');
          };

          const panPath = getLaneCurve('pan', -1.0, 1.0, 0.0, true);
          const distPath = getLaneCurve('distance', 0.0, 1.0, spatialParams.distance ?? 0.0);
          const elevPath = getLaneCurve('elevation', -1.0, 1.0, spatialParams.elevation ?? 0.0);
          const revPath = getLaneCurve('reverb', 0.0, 1.0, reverbParams.amount ?? 0.30);
          const panLaneHasKf = timeline?.lanes.find((l) => l.id === 'pan')?.keyframes?.length;
          const playheadX = totalDur > 0 ? (position / totalDur) * 600 : 0;

          return (
            <>
              <div
                onClick={() => setActiveTab('Graph')}
                title="Click to open interactive Graph Editor"
                className="relative flex-1 my-2 glass-card rounded-xl border border-white/[0.08] hover:border-cyan-500/40 overflow-hidden flex items-center cursor-pointer transition-all shadow-inner group"
              >
                <div className="absolute inset-0 flex justify-between px-6 pointer-events-none opacity-20">
                  {['00:00', '00:30', '01:00', '01:30', '02:00', '02:30', '03:00'].map((tc) => (
                    <div key={tc} className="flex flex-col items-center">
                      <span className="text-[9px] text-slate-400 font-mono">{tc}</span>
                      <div className="w-[1px] h-full bg-white/10" />
                    </div>
                  ))}
                </div>

                <svg className="w-full h-full p-2" viewBox="0 0 600 120" preserveAspectRatio="none">
                  {/* Dynamic Pan curve */}
                  <path d={panPath} fill="none" stroke="#06b6d4" strokeWidth="2.5" className="drop-shadow-[0_0_8px_rgba(6,182,212,0.4)]" />
                  {/* Dynamic Distance curve */}
                  <path d={distPath} fill="none" stroke="#f59e0b" strokeWidth="2" className="drop-shadow-[0_0_6px_rgba(245,158,11,0.3)]" />
                  {/* Dynamic Elevation curve */}
                  <path d={elevPath} fill="none" stroke="#a855f7" strokeWidth="2" className="drop-shadow-[0_0_6px_rgba(168,85,247,0.3)]" />
                  {/* Dynamic Reverb curve */}
                  <path d={revPath} fill="none" stroke="#10b981" strokeWidth="2" className="drop-shadow-[0_0_6px_rgba(16,185,129,0.3)]" />

                  {/* Synchronized Playhead Marker with Glowing Cap */}
                  {playheadX >= 0 && playheadX <= 600 && (
                    <g>
                      <line
                        x1={playheadX}
                        y1={0}
                        x2={playheadX}
                        y2={120}
                        stroke="#f43f5e"
                        strokeWidth="2"
                        strokeDasharray="4 2"
                      />
                      <circle cx={playheadX} cy={60} r={4} fill="#f43f5e" className="animate-pulse" />
                    </g>
                  )}
                </svg>
              </div>

              {/* Footer info */}
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono tabular-nums">
                <span>
                  {panLaneHasKf ? (
                    <span className="text-cyan-400 font-bold">Azimuth: Keyframe Driven (Manual Orbit)</span>
                  ) : (
                    <span>Continuous LFO: {spatialParams.rotation_speed} Hz</span>
                  )}
                </span>
                <span
                  onClick={() => setActiveTab('Graph')}
                  className="hover:text-cyan-300 cursor-pointer transition-colors text-slate-400 font-medium"
                >
                  Woodworth Binaural DSP • Click to Edit Graph
                </span>
              </div>
            </>
          );
        })()}
      </div>
    </div>
  );
};

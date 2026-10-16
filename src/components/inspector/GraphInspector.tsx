import React from 'react';
import {
  Plus,
  Trash2,
  Sparkles,
  Info,
  Sliders,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useTrackStore } from '../../store/trackStore';
import { useTimelineStore } from '../../store/timelineStore';
import {
  LANE_CONFIG,
  TIMELINE_PRESETS,
} from '../../types/automation';

export const GraphInspector: React.FC = () => {
  const { position } = useTrackStore();
  const {
    timeline,
    activeLaneId,
    selectedKeyframeId,
    addKeyframe,
    updateKeyframe,
    removeKeyframe,
    toggleLane,
    loadPreset,
  } = useTimelineStore();

  const activeLane = timeline?.lanes.find((l) => l.id === activeLaneId);
  const laneConfig = LANE_CONFIG[activeLaneId];
  const activeKeyframes = activeLane?.keyframes || [];
  const selectedKf = activeKeyframes.find((k) => k.id === selectedKeyframeId);

  return (
    <div className="space-y-4 select-none text-slate-200">
      {/* 1. Active Lane Overview */}
      <section className="glass-panel rounded-2xl p-3.5 space-y-3 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span
              className="w-3 h-3 rounded-full"
              style={{
                backgroundColor: activeLane?.enabled ? laneConfig.color : '#64748b',
                boxShadow: activeLane?.enabled ? `0 0 10px ${laneConfig.color}` : 'none',
              }}
            />
            <span className="text-xs font-bold text-slate-100">{laneConfig.name}</span>
          </div>

          <button
            type="button"
            onClick={() => toggleLane(activeLaneId)}
            className={`glass-pill px-2.5 py-0.5 rounded-full text-[10px] font-mono flex items-center gap-1.5 transition-all cursor-pointer font-bold ${
              activeLane?.enabled
                ? 'text-emerald-300 border-emerald-500/40 shadow-[0_0_8px_rgba(16,185,129,0.2)]'
                : 'text-slate-400'
            }`}
          >
            {activeLane?.enabled ? (
              <>
                <Eye className="w-3 h-3 text-emerald-400" />
                <span>Active</span>
              </>
            ) : (
              <>
                <EyeOff className="w-3 h-3 text-slate-500" />
                <span>Bypassed</span>
              </>
            )}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[10px] font-mono tabular-nums glass-card p-2.5 rounded-xl border border-white/[0.06]">
          <div>
            <span className="text-slate-500 block text-[9px] font-sans font-semibold">RANGE</span>
            <span className="text-slate-200 font-bold">
              {activeLaneId === 'pan'
                ? '-180° to +180°'
                : activeLaneId === 'volume'
                ? '0% to 200%'
                : `${laneConfig.min} to ${laneConfig.max}`}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block text-[9px] font-sans font-semibold">KEYFRAMES</span>
            <span className="text-cyan-400 font-bold">{activeKeyframes.length} points</span>
          </div>
        </div>

        {/* Quick Add at Playhead */}
        <button
          type="button"
          onClick={() => {
            const defaultVal =
              selectedKf ? selectedKf.value : laneConfig.default;
            addKeyframe(activeLaneId, position, defaultVal);
          }}
          className="w-full py-2 rounded-xl glass-card hover:bg-white/[0.1] border border-cyan-500/30 text-cyan-300 hover:text-white text-[11px] font-semibold flex items-center justify-center space-x-1.5 transition-all cursor-pointer shadow-xs active:scale-95"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Keyframe at ({position.toFixed(2)}s)</span>
        </button>
      </section>

      {/* 2. Selected Keyframe Inspector */}
      {selectedKf ? (
        <section className="glass-panel rounded-2xl p-3.5 border-cyan-500/40 space-y-3 shadow-md">
          <div className="flex items-center justify-between text-xs font-bold text-slate-100">
            <div className="flex items-center space-x-1.5 text-cyan-400">
              <Sliders className="w-3.5 h-3.5" />
              <span>Selected Keyframe</span>
            </div>
            <button
              type="button"
              onClick={() => removeKeyframe(activeLaneId, selectedKf.id)}
              className="glass-pill text-rose-400 hover:text-rose-200 p-1.5 rounded-xl transition-all cursor-pointer active:scale-95 border-rose-500/30"
              title="Delete Keyframe"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3 text-[11px]">
            {/* Time Editor */}
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-medium">Time (seconds):</span>
              <input
                type="number"
                step="0.05"
                min="0"
                value={selectedKf.time.toFixed(2)}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val)) {
                    updateKeyframe(activeLaneId, {
                      ...selectedKf,
                      time: Math.max(0, val),
                    });
                  }
                }}
                className="w-24 glass-card border border-white/[0.1] rounded-xl px-2.5 py-1 text-right font-mono tabular-nums text-slate-100 focus:outline-none focus:border-cyan-400"
              />
            </div>

            {/* Value Slider & Numeric Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-slate-400 font-medium">Target Value:</span>
                <span className="font-mono tabular-nums text-cyan-300 font-bold">
                  {activeLaneId === 'pan'
                    ? `${(selectedKf.value * 180).toFixed(0)}°`
                    : activeLaneId === 'volume'
                    ? `${(selectedKf.value * 100).toFixed(0)}%`
                    : selectedKf.value.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min={laneConfig.min}
                max={laneConfig.max}
                step={(laneConfig.max - laneConfig.min) / 100}
                value={selectedKf.value}
                onChange={(e) => {
                  updateKeyframe(activeLaneId, {
                    ...selectedKf,
                    value: parseFloat(e.target.value),
                  });
                }}
                className="glass-slider w-full accent-cyan-400 cursor-pointer"
              />
            </div>

            {/* Interpolation Curve Mode */}
            <div className="space-y-1.5 pt-1 border-t border-white/[0.06]">
              <span className="text-slate-400 font-medium block">Interpolation Curve:</span>
              <div className="grid grid-cols-3 gap-1.5">
                {(['linear', 'bezier', 'hold'] as const).map((type) => {
                  const isCurrent = selectedKf.curve.type === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() =>
                        updateKeyframe(activeLaneId, {
                          ...selectedKf,
                          curve:
                            type === 'bezier'
                              ? { type: 'bezier', c1_x: 0.35, c1_y: 0.15, c2_x: 0.65, c2_y: 0.85 }
                              : type === 'hold'
                              ? { type: 'hold' }
                              : { type: 'linear' },
                        })
                      }
                      className={`py-1.5 rounded-xl text-[10px] font-mono capitalize transition-all cursor-pointer font-bold ${
                        isCurrent
                          ? 'glass-pill text-cyan-300 border-cyan-400/40 shadow-[0_0_8px_rgba(6,182,212,0.2)]'
                          : 'glass-card text-slate-400 hover:text-white'
                      }`}
                    >
                      {type}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tangent Handle Controls for Bezier */}
            {selectedKf.curve.type === 'bezier' && (
              <div className="glass-card p-3 rounded-2xl border border-white/[0.08] space-y-2 text-[10px]">
                <div className="text-slate-400 font-mono text-[9px] uppercase font-bold tracking-wider">
                  Bézier Tangents (Canvas Draggable)
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span>Handle 1 (C1):</span>
                  <span className="font-mono tabular-nums text-cyan-400 font-bold">
                    X:{selectedKf.curve.c1_x.toFixed(2)} Y:{selectedKf.curve.c1_y.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={selectedKf.curve.c1_x}
                  onChange={(e) => {
                    if (selectedKf.curve.type === 'bezier') {
                      updateKeyframe(activeLaneId, {
                        ...selectedKf,
                        curve: {
                          ...selectedKf.curve,
                          c1_x: parseFloat(e.target.value),
                        },
                      });
                    }
                  }}
                  className="glass-slider w-full accent-cyan-400"
                />

                <div className="flex items-center justify-between text-slate-300 pt-1">
                  <span>Handle 2 (C2):</span>
                  <span className="font-mono tabular-nums text-purple-400 font-bold">
                    X:{selectedKf.curve.c2_x.toFixed(2)} Y:{selectedKf.curve.c2_y.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={selectedKf.curve.c2_x}
                  onChange={(e) => {
                    if (selectedKf.curve.type === 'bezier') {
                      updateKeyframe(activeLaneId, {
                        ...selectedKf,
                        curve: {
                          ...selectedKf.curve,
                          c2_x: parseFloat(e.target.value),
                        },
                      });
                    }
                  }}
                  className="glass-slider w-full accent-purple-400"
                />
              </div>
            )}
          </div>
        </section>
      ) : (
        <div className="glass-panel rounded-2xl p-4 text-center text-slate-500 text-[11px] border-dashed border-white/[0.1]">
          Click any keyframe point on the canvas to inspect its tangent handles and curve formulas.
        </div>
      )}

      {/* 3. Orbit Automation Presets */}
      <section className="glass-panel rounded-2xl p-3.5 space-y-2.5 shadow-md">
        <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-100">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Built-in Orbit Presets</span>
        </div>

        <div className="space-y-1.5">
          {TIMELINE_PRESETS.map((p) => (
            <div
              key={p.id}
              className="glass-card hover:bg-white/[0.08] p-2.5 rounded-xl border border-white/[0.06] hover:border-white/[0.16] transition-all flex items-center justify-between cursor-pointer group"
            >
              <div className="min-w-0 pr-2">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-semibold text-slate-200">{p.name}</span>
                  <span className="text-[9px] font-mono text-cyan-300 glass-pill px-1.5 py-0.2 rounded-full border-cyan-500/30">
                    {p.badge}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 truncate mt-0.5">{p.description}</p>
              </div>

              <button
                type="button"
                onClick={() => loadPreset(p.id)}
                className="px-3 py-1 rounded-xl glass-pill hover:border-cyan-400/40 text-cyan-300 hover:text-white text-[10px] font-mono whitespace-nowrap transition-all cursor-pointer font-bold shadow-xs active:scale-95"
              >
                Load
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* 4. In-Memory Persistence Warning Notice */}
      <div className="glass-card rounded-2xl p-3 border border-amber-500/20 text-[10px] text-amber-300/90 flex items-start space-x-2 shadow-xs">
        <Info className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <strong className="block text-amber-300 mb-0.5 font-bold">Step 7 Notice: Live RAM Automation</strong>
          Keyframe automation drives DSP in real time with the C-ABI lock-free ring. Project disk save will be added in Step 11.
        </div>
      </div>
    </div>
  );
};

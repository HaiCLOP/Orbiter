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
    <div className="space-y-4 select-none text-zinc-300">
      {/* 1. Active Lane Overview */}
      <section className="bg-[#181d28] rounded-lg p-3 border border-[#242b3b] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span
              className="w-3 h-3 rounded-full"
              style={{
                backgroundColor: activeLane?.enabled ? laneConfig.color : '#64748b',
                boxShadow: activeLane?.enabled ? `0 0 10px ${laneConfig.color}` : 'none',
              }}
            />
            <span className="text-xs font-bold text-zinc-100">{laneConfig.name}</span>
          </div>

          <button
            type="button"
            onClick={() => toggleLane(activeLaneId)}
            className={`px-2 py-0.5 rounded text-[10px] font-mono flex items-center gap-1 border ${
              activeLane?.enabled
                ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/30'
                : 'bg-zinc-800 text-zinc-400 border-zinc-700'
            }`}
          >
            {activeLane?.enabled ? (
              <>
                <Eye className="w-2.5 h-2.5" />
                <span>Active</span>
              </>
            ) : (
              <>
                <EyeOff className="w-2.5 h-2.5 text-zinc-500" />
                <span>Bypassed</span>
              </>
            )}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-zinc-400 bg-[#12151c] p-2 rounded border border-[#1e2330]">
          <div>
            <span className="text-zinc-500 block text-[9px]">RANGE</span>
            <span className="text-zinc-200">
              {activeLaneId === 'pan'
                ? '-180° to +180°'
                : activeLaneId === 'volume'
                ? '0% to 200%'
                : `${laneConfig.min} to ${laneConfig.max}`}
            </span>
          </div>
          <div>
            <span className="text-zinc-500 block text-[9px]">KEYFRAMES</span>
            <span className="text-zinc-200">{activeKeyframes.length} points</span>
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
          className="w-full py-1.5 rounded bg-[#1e2535] hover:bg-[#252f44] border border-[#2e374c] text-cyan-300 hover:text-cyan-200 text-[11px] font-medium flex items-center justify-center space-x-1.5 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Keyframe at Playhead ({position.toFixed(2)}s)</span>
        </button>
      </section>

      {/* 2. Selected Keyframe Inspector */}
      {selectedKf ? (
        <section className="bg-[#181d28] rounded-lg p-3 border border-cyan-500/40 space-y-3 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-zinc-200">
            <div className="flex items-center space-x-1.5 text-cyan-400">
              <Sliders className="w-3.5 h-3.5" />
              <span>Selected Keyframe</span>
            </div>
            <button
              type="button"
              onClick={() => removeKeyframe(activeLaneId, selectedKf.id)}
              className="text-rose-400 hover:text-rose-300 p-1 hover:bg-rose-950/40 rounded transition-colors"
              title="Delete Keyframe"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2 text-[11px]">
            {/* Time Editor */}
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Time (seconds):</span>
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
                className="w-20 bg-[#12151c] border border-[#242b3b] rounded px-1.5 py-0.5 text-right font-mono text-zinc-200 focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Value Slider & Numeric Input */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-zinc-400">Value:</span>
                <span className="font-mono text-cyan-300 font-semibold">
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
                className="w-full accent-cyan-400 h-1 bg-[#12151c] rounded appearance-none cursor-pointer"
              />
            </div>

            {/* Interpolation Curve Mode */}
            <div>
              <span className="text-zinc-400 block mb-1.5">Interpolation Curve:</span>
              <div className="grid grid-cols-3 gap-1">
                <button
                  type="button"
                  onClick={() =>
                    updateKeyframe(activeLaneId, {
                      ...selectedKf,
                      curve: { type: 'linear' },
                    })
                  }
                  className={`py-1 rounded text-[10px] font-mono border ${
                    selectedKf.curve.type === 'linear'
                      ? 'bg-cyan-950/50 text-cyan-300 border-cyan-500/50'
                      : 'bg-[#12151c] text-zinc-400 border-[#222734] hover:bg-[#1a202c]'
                  }`}
                >
                  Linear
                </button>

                <button
                  type="button"
                  onClick={() =>
                    updateKeyframe(activeLaneId, {
                      ...selectedKf,
                      curve: {
                        type: 'bezier',
                        c1_x: 0.35,
                        c1_y: 0.15,
                        c2_x: 0.65,
                        c2_y: 0.85,
                      },
                    })
                  }
                  className={`py-1 rounded text-[10px] font-mono border ${
                    selectedKf.curve.type === 'bezier'
                      ? 'bg-cyan-950/50 text-cyan-300 border-cyan-500/50'
                      : 'bg-[#12151c] text-zinc-400 border-[#222734] hover:bg-[#1a202c]'
                  }`}
                >
                  Bézier
                </button>

                <button
                  type="button"
                  onClick={() =>
                    updateKeyframe(activeLaneId, {
                      ...selectedKf,
                      curve: { type: 'hold' },
                    })
                  }
                  className={`py-1 rounded text-[10px] font-mono border ${
                    selectedKf.curve.type === 'hold'
                      ? 'bg-cyan-950/50 text-cyan-300 border-cyan-500/50'
                      : 'bg-[#12151c] text-zinc-400 border-[#222734] hover:bg-[#1a202c]'
                  }`}
                >
                  Hold
                </button>
              </div>
            </div>

            {/* Tangent Handle Controls for Bezier */}
            {selectedKf.curve.type === 'bezier' && (
              <div className="bg-[#12151c] p-2 rounded border border-[#222734] space-y-1.5 text-[10px]">
                <div className="text-zinc-500 font-mono text-[9px] uppercase">
                  Bézier Tangent Sliders (or Drag Canvas Handles)
                </div>
                <div className="flex items-center justify-between text-zinc-400">
                  <span>Handle 1 (C1):</span>
                  <span className="font-mono text-sky-400">
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
                  className="w-full accent-sky-400 h-1 bg-[#1e2535] rounded appearance-none"
                />

                <div className="flex items-center justify-between text-zinc-400 pt-1">
                  <span>Handle 2 (C2):</span>
                  <span className="font-mono text-pink-400">
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
                  className="w-full accent-pink-400 h-1 bg-[#1e2535] rounded appearance-none"
                />
              </div>
            )}
          </div>
        </section>
      ) : (
        <div className="bg-[#181d28]/60 rounded-lg p-3 border border-dashed border-[#242b3b] text-center text-zinc-500 text-[11px]">
          No keyframe selected. Click any point on the canvas to inspect and edit its curve.
        </div>
      )}

      {/* 3. Orbit Automation Presets */}
      <section className="bg-[#181d28] rounded-lg p-3 border border-[#242b3b] space-y-2.5">
        <div className="flex items-center space-x-1.5 text-xs font-semibold text-zinc-200">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Built-in Orbit Presets</span>
        </div>

        <div className="space-y-1.5">
          {TIMELINE_PRESETS.map((p) => (
            <div
              key={p.id}
              className="bg-[#12151c] p-2 rounded border border-[#222734] hover:border-[#333a4c] transition-colors flex items-center justify-between"
            >
              <div className="min-w-0 pr-2">
                <div className="flex items-center space-x-1.5">
                  <span className="text-xs font-medium text-zinc-200">{p.name}</span>
                  <span className="text-[9px] font-mono text-cyan-400 bg-cyan-950/40 px-1.5 py-0.2 rounded border border-cyan-800/30">
                    {p.badge}
                  </span>
                </div>
                <p className="text-[10px] text-zinc-500 truncate mt-0.5">{p.description}</p>
              </div>

              <button
                type="button"
                onClick={() => loadPreset(p.id)}
                className="px-2.5 py-1 rounded bg-[#1e2535] hover:bg-cyan-950/50 text-cyan-300 hover:text-cyan-200 border border-[#2e374c] hover:border-cyan-500/50 text-[10px] font-mono whitespace-nowrap transition-all"
              >
                Apply
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* 4. In-Memory Persistence Warning Notice */}
      <div className="bg-[#141822] rounded-lg p-2.5 border border-amber-500/20 text-[10px] text-amber-400/90 flex items-start space-x-2">
        <Info className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <strong className="block text-amber-300 mb-0.5">Step 7 Notice: In-Memory Keyframes</strong>
          Automation lanes run live with DSP, but are stored in RAM for this session. Full project file persistence (.orbiter files) will be added in Step 11.
        </div>
      </div>
    </div>
  );
};

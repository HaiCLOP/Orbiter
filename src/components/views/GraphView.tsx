import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Magnet,
  ZoomIn,
  ZoomOut,
  Trash2,
  Layers,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useTrackStore } from '../../store/trackStore';
import { useTimelineStore } from '../../store/timelineStore';
import {
  LANE_CONFIG,
} from '../../types/automation';
import type {
  AutomationLaneId,
  CurveType,
} from '../../types/automation';

export const GraphView: React.FC = () => {
  const { position, seek } = useTrackStore();
  const {
    timeline,
    activeLaneId,
    selectedKeyframeId,
    zoom,
    scrollLeft,
    snapEnabled,
    gridInterval,
    initTimeline,
    setActiveLane,
    selectKeyframe,
    addKeyframe,
    updateKeyframe,
    removeKeyframe,
    clearLane,
    toggleLane,
    setZoom,
    setSnapEnabled,
    setGridInterval,
    setScrollLeft,
  } = useTimelineStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Interaction dragging states
  const [dragState, setDragState] = useState<{
    type: 'point' | 'handle1' | 'handle2' | 'scrub';
    keyframeId?: string;
    laneId?: AutomationLaneId;
    initialMouseX: number;
    initialMouseY: number;
    initialTime: number;
    initialValue: number;
  } | null>(null);

  const [mouseCoord, setMouseCoord] = useState<{ time: number; value: number } | null>(null);

  const laneConfig = LANE_CONFIG[activeLaneId];

  // Initialize timeline from backend on mount
  useEffect(() => {
    initTimeline();
  }, [initTimeline]);

  // Coordinate transforms
  const timeToX = useCallback(
    (t: number) => {
      return t * zoom;
    },
    [zoom]
  );

  const xToTime = useCallback(
    (x: number) => {
      const raw = x / zoom;
      if (!snapEnabled) return Math.max(0, raw);
      const snapped = Math.round(raw / gridInterval) * gridInterval;
      return Math.max(0, snapped);
    },
    [zoom, snapEnabled, gridInterval]
  );

  const valueToY = useCallback(
    (val: number, h: number) => {
      const topPadding = 30; // Ruler height
      const bottomPadding = 20;
      const plotHeight = h - topPadding - bottomPadding;
      const norm = (val - laneConfig.min) / (laneConfig.max - laneConfig.min);
      return topPadding + (1 - norm) * plotHeight;
    },
    [laneConfig]
  );

  const yToValue = useCallback(
    (y: number, h: number) => {
      const topPadding = 30;
      const bottomPadding = 20;
      const plotHeight = h - topPadding - bottomPadding;
      const norm = 1 - (y - topPadding) / plotHeight;
      const val = laneConfig.min + norm * (laneConfig.max - laneConfig.min);
      return Math.min(laneConfig.max, Math.max(laneConfig.min, val));
    },
    [laneConfig]
  );

  // Active lane data
  const activeLane = timeline?.lanes.find((l) => l.id === activeLaneId);
  const activeKeyframes = activeLane?.keyframes || [];

  // Canvas drawing loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    // Background
    ctx.fillStyle = '#07080b';
    ctx.fillRect(0, 0, w, h);

    const topPadding = 30;
    const bottomPadding = 20;
    const plotHeight = h - topPadding - bottomPadding;

    // 1. Grid vertical lines (Time intervals)
    const startSec = Math.floor(scrollLeft / zoom);
    const endSec = Math.ceil((scrollLeft + w) / zoom);
    const step = gridInterval >= 0.5 ? gridInterval : gridInterval >= 0.25 ? 0.25 : 0.1;

    for (let t = Math.max(0, startSec - 1); t <= endSec + 1; t += step) {
      const x = timeToX(t) - scrollLeft;
      if (x < 0 || x > w) continue;

      const isWholeSecond = Math.abs(t - Math.round(t)) < 1e-4;
      ctx.strokeStyle = isWholeSecond ? '#232938' : '#171c26';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, topPadding);
      ctx.lineTo(x, h - bottomPadding);
      ctx.stroke();
    }

    // 2. Horizontal guide lines
    const hLevels = [0.0, 0.25, 0.5, 0.75, 1.0];
    for (const lvl of hLevels) {
      const val = laneConfig.min + lvl * (laneConfig.max - laneConfig.min);
      const y = valueToY(val, h);

      // Highlight center line (0.0 for pan/elev, 1.0 for volume)
      const isCenter = Math.abs(val) < 1e-4 || (activeLaneId === 'volume' && Math.abs(val - 1.0) < 1e-4);
      ctx.strokeStyle = isCenter ? '#334155' : '#1e2430';
      ctx.lineWidth = isCenter ? 1.5 : 1;
      ctx.setLineDash(isCenter ? [] : [4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Value label
      ctx.fillStyle = isCenter ? '#94a3b8' : '#475569';
      ctx.font = '9px monospace';
      ctx.textAlign = 'right';
      const labelText =
        activeLaneId === 'pan'
          ? `${(val * 180).toFixed(0)}°`
          : activeLaneId === 'volume'
          ? `${(val * 100).toFixed(0)}%`
          : val.toFixed(2);
      ctx.fillText(labelText, w - 8, y - 3);
    }

    // 3. Draw Inactive / Ghost Lanes
    if (timeline) {
      for (const lane of timeline.lanes) {
        if (lane.id === activeLaneId || !lane.enabled || lane.keyframes.length === 0) continue;
        const cfg = LANE_CONFIG[lane.id];
        ctx.strokeStyle = `${cfg.color}33`; // 20% opacity
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);

        ctx.beginPath();
        for (let i = 0; i < lane.keyframes.length; i++) {
          const kf = lane.keyframes[i];
          const kfNorm = (kf.value - cfg.min) / (cfg.max - cfg.min);
          const kfY = topPadding + (1 - kfNorm) * plotHeight;
          const kfX = timeToX(kf.time) - scrollLeft;

          if (i === 0) {
            ctx.moveTo(kfX, kfY);
          } else {
            ctx.lineTo(kfX, kfY);
          }
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // 4. Draw Active Lane Curves
    if (activeKeyframes.length > 0) {
      const mainColor = laneConfig.color;

      // Area fill under curve
      const firstX = timeToX(activeKeyframes[0].time) - scrollLeft;
      const lastX = timeToX(activeKeyframes[activeKeyframes.length - 1].time) - scrollLeft;
      const zeroY = valueToY(laneConfig.min, h);

      ctx.beginPath();
      ctx.moveTo(firstX, zeroY);

      // Curve path
      for (let i = 0; i < activeKeyframes.length; i++) {
        const kf = activeKeyframes[i];
        const x = timeToX(kf.time) - scrollLeft;
        const y = valueToY(kf.value, h);

        if (i === 0) {
          ctx.lineTo(x, y);
        } else {
          const prev = activeKeyframes[i - 1];
          const prevX = timeToX(prev.time) - scrollLeft;
          const prevY = valueToY(prev.value, h);

          if (prev.curve.type === 'bezier') {
            const c1x = prevX + prev.curve.c1_x * (x - prevX);
            const c1y = prevY + prev.curve.c1_y * (y - prevY);
            const c2x = prevX + prev.curve.c2_x * (x - prevX);
            const c2y = prevY + prev.curve.c2_y * (y - prevY);
            ctx.bezierCurveTo(c1x, c1y, c2x, c2y, x, y);
          } else if (prev.curve.type === 'hold') {
            ctx.lineTo(x, prevY);
            ctx.lineTo(x, y);
          } else {
            // Linear
            ctx.lineTo(x, y);
          }
        }
      }

      ctx.lineTo(lastX, zeroY);
      ctx.closePath();

      const gradient = ctx.createLinearGradient(0, topPadding, 0, h - bottomPadding);
      gradient.addColorStop(0, `${mainColor}26`); // 15% opacity
      gradient.addColorStop(1, `${mainColor}00`); // 0% opacity
      ctx.fillStyle = gradient;
      ctx.fill();

      // Stroke line
      ctx.beginPath();
      for (let i = 0; i < activeKeyframes.length; i++) {
        const kf = activeKeyframes[i];
        const x = timeToX(kf.time) - scrollLeft;
        const y = valueToY(kf.value, h);

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          const prev = activeKeyframes[i - 1];
          const prevX = timeToX(prev.time) - scrollLeft;
          const prevY = valueToY(prev.value, h);

          if (prev.curve.type === 'bezier') {
            const c1x = prevX + prev.curve.c1_x * (x - prevX);
            const c1y = prevY + prev.curve.c1_y * (y - prevY);
            const c2x = prevX + prev.curve.c2_x * (x - prevX);
            const c2y = prevY + prev.curve.c2_y * (y - prevY);
            ctx.bezierCurveTo(c1x, c1y, c2x, c2y, x, y);
          } else if (prev.curve.type === 'hold') {
            ctx.lineTo(x, prevY);
            ctx.lineTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
      }

      ctx.strokeStyle = mainColor;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = `${mainColor}80`;
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // 5. Draw Keyframe Diamonds & Bezier Handles
      for (let i = 0; i < activeKeyframes.length; i++) {
        const kf = activeKeyframes[i];
        const x = timeToX(kf.time) - scrollLeft;
        const y = valueToY(kf.value, h);
        const isSelected = selectedKeyframeId === kf.id;

        // If selected keyframe has Bezier curve to next point, draw outgoing handles
        if (isSelected && kf.curve.type === 'bezier' && i < activeKeyframes.length - 1) {
          const next = activeKeyframes[i + 1];
          const nextX = timeToX(next.time) - scrollLeft;
          const nextY = valueToY(next.value, h);

          const h1x = x + kf.curve.c1_x * (nextX - x);
          const h1y = y + kf.curve.c1_y * (nextY - y);
          const h2x = x + kf.curve.c2_x * (nextX - x);
          const h2y = y + kf.curve.c2_y * (nextY - y);

          // Lines to handles
          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 2]);

          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(h1x, h1y);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(nextX, nextY);
          ctx.lineTo(h2x, h2y);
          ctx.stroke();
          ctx.setLineDash([]);

          // Handle 1 (C1) Circle
          ctx.fillStyle = '#38bdf8';
          ctx.beginPath();
          ctx.arc(h1x, h1y, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Handle 2 (C2) Circle
          ctx.fillStyle = '#f472b6';
          ctx.beginPath();
          ctx.arc(h2x, h2y, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }

        // Diamond point (rotated square)
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.PI / 4);

        const size = isSelected ? 8 : 6;
        ctx.fillStyle = isSelected ? '#ffffff' : '#0f172a';
        ctx.strokeStyle = isSelected ? '#38bdf8' : mainColor;
        ctx.lineWidth = isSelected ? 2.5 : 2;

        ctx.fillRect(-size / 2, -size / 2, size, size);
        ctx.strokeRect(-size / 2, -size / 2, size, size);
        ctx.restore();
      }
    }

    // 6. Time Ruler at Top
    ctx.fillStyle = '#11141c';
    ctx.fillRect(0, 0, w, topPadding);
    ctx.strokeStyle = '#222734';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, topPadding);
    ctx.lineTo(w, topPadding);
    ctx.stroke();

    for (let t = Math.max(0, startSec - 1); t <= endSec + 1; t += 1.0) {
      const x = timeToX(t) - scrollLeft;
      if (x < 0 || x > w) continue;

      ctx.strokeStyle = '#475569';
      ctx.beginPath();
      ctx.moveTo(x, topPadding - 8);
      ctx.lineTo(x, topPadding);
      ctx.stroke();

      const mins = Math.floor(t / 60);
      const secs = Math.floor(t % 60);
      const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

      ctx.fillStyle = '#94a3b8';
      ctx.font = '9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(timeStr, x, topPadding - 12);
    }

    // 7. Red Playhead Line
    const playheadX = timeToX(position) - scrollLeft;
    if (playheadX >= 0 && playheadX <= w) {
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1.5;
      ctx.shadowColor = '#ef444480';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, h - bottomPadding);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Playhead top triangle handle
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.moveTo(playheadX - 6, 0);
      ctx.lineTo(playheadX + 6, 0);
      ctx.lineTo(playheadX, 10);
      ctx.closePath();
      ctx.fill();
    }
  }, [
    activeLaneId,
    activeKeyframes,
    timeline,
    zoom,
    scrollLeft,
    gridInterval,
    snapEnabled,
    selectedKeyframeId,
    position,
    timeToX,
    valueToY,
    laneConfig,
  ]);

  // Mouse event handling
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // 1. Check if clicking on the ruler to scrub
    if (clickY <= 30) {
      const clickTime = Math.max(0, (clickX + scrollLeft) / zoom);
      seek(clickTime);
      setDragState({
        type: 'scrub',
        initialMouseX: e.clientX,
        initialMouseY: e.clientY,
        initialTime: clickTime,
        initialValue: 0,
      });
      return;
    }

    // 2. Check if hitting an existing keyframe point (radius 10px)
    const hitRadius = 10;
    const h = rect.height;

    for (const kf of activeKeyframes) {
      const kfX = timeToX(kf.time) - scrollLeft;
      const kfY = valueToY(kf.value, h);
      const dist = Math.hypot(clickX - kfX, clickY - kfY);

      if (dist <= hitRadius) {
        selectKeyframe(kf.id);
        setDragState({
          type: 'point',
          keyframeId: kf.id,
          laneId: activeLaneId,
          initialMouseX: e.clientX,
          initialMouseY: e.clientY,
          initialTime: kf.time,
          initialValue: kf.value,
        });
        return;
      }
    }

    // 3. Check if hitting a Bezier handle on the selected keyframe
    if (selectedKeyframeId) {
      const selIdx = activeKeyframes.findIndex((k) => k.id === selectedKeyframeId);
      if (selIdx >= 0 && selIdx < activeKeyframes.length - 1) {
        const cur = activeKeyframes[selIdx];
        if (cur.curve.type === 'bezier') {
          const next = activeKeyframes[selIdx + 1];
          const curX = timeToX(cur.time) - scrollLeft;
          const curY = valueToY(cur.value, h);
          const nextX = timeToX(next.time) - scrollLeft;
          const nextY = valueToY(next.value, h);

          const h1x = curX + cur.curve.c1_x * (nextX - curX);
          const h1y = curY + cur.curve.c1_y * (nextY - curY);
          const h2x = curX + cur.curve.c2_x * (nextX - curX);
          const h2y = curY + cur.curve.c2_y * (nextY - curY);

          if (Math.hypot(clickX - h1x, clickY - h1y) <= 8) {
            setDragState({
              type: 'handle1',
              keyframeId: cur.id,
              laneId: activeLaneId,
              initialMouseX: e.clientX,
              initialMouseY: e.clientY,
              initialTime: cur.time,
              initialValue: cur.value,
            });
            return;
          }

          if (Math.hypot(clickX - h2x, clickY - h2y) <= 8) {
            setDragState({
              type: 'handle2',
              keyframeId: cur.id,
              laneId: activeLaneId,
              initialMouseX: e.clientX,
              initialMouseY: e.clientY,
              initialTime: cur.time,
              initialValue: cur.value,
            });
            return;
          }
        }
      }
    }

    // 4. Clicked on empty canvas space -> deselect
    selectKeyframe(null);
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    if (clickY <= 30) return; // Ruler ignore double click

    const time = xToTime(clickX + scrollLeft);
    const value = yToValue(clickY, rect.height);
    addKeyframe(activeLaneId, time, value);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Track mouse coordinates for footer tooltip
    const curTime = Math.max(0, (mouseX + scrollLeft) / zoom);
    const curVal = yToValue(mouseY, rect.height);
    setMouseCoord({ time: curTime, value: curVal });

    if (!dragState) return;

    if (dragState.type === 'scrub') {
      const scrubTime = Math.max(0, (mouseX + scrollLeft) / zoom);
      seek(scrubTime);
      return;
    }

    if (dragState.type === 'point' && dragState.keyframeId) {
      const curKf = activeKeyframes.find((k) => k.id === dragState.keyframeId);
      if (!curKf) return;

      const newTime = xToTime(mouseX + scrollLeft);
      const newVal = yToValue(mouseY, rect.height);

      updateKeyframe(activeLaneId, {
        ...curKf,
        time: newTime,
        value: newVal,
      });
      return;
    }

    if ((dragState.type === 'handle1' || dragState.type === 'handle2') && dragState.keyframeId) {
      const selIdx = activeKeyframes.findIndex((k) => k.id === dragState.keyframeId);
      if (selIdx < 0 || selIdx >= activeKeyframes.length - 1) return;

      const cur = activeKeyframes[selIdx];
      const next = activeKeyframes[selIdx + 1];
      if (cur.curve.type !== 'bezier') return;

      const curX = timeToX(cur.time) - scrollLeft;
      const curY = valueToY(cur.value, rect.height);
      const nextX = timeToX(next.time) - scrollLeft;
      const nextY = valueToY(next.value, rect.height);

      const dx = nextX - curX;
      const dy = nextY - curY;
      if (Math.abs(dx) < 1) return;

      const normX = Math.min(1.0, Math.max(0.0, (mouseX - curX) / dx));
      const normY = dy !== 0 ? (mouseY - curY) / dy : 0.5;

      const updatedCurve: CurveType =
        dragState.type === 'handle1'
          ? {
              type: 'bezier',
              c1_x: normX,
              c1_y: normY,
              c2_x: cur.curve.c2_x,
              c2_y: cur.curve.c2_y,
            }
          : {
              type: 'bezier',
              c1_x: cur.curve.c1_x,
              c1_y: cur.curve.c1_y,
              c2_x: normX,
              c2_y: normY,
            };

      updateKeyframe(activeLaneId, {
        ...cur,
        curve: updatedCurve,
      });
    }
  };

  const handleMouseUp = () => {
    setDragState(null);
  };

  // Keyboard shortcut listener for deleting keyframes
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedKeyframeId) {
        removeKeyframe(activeLaneId, selectedKeyframeId);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedKeyframeId, activeLaneId, removeKeyframe]);

  // Horizontal wheel zoom / pan
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
      setZoom(zoom * zoomFactor);
    } else {
      setScrollLeft(scrollLeft + e.deltaX + (e.shiftKey ? e.deltaY : 0));
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-transparent select-none text-zinc-200">
      {/* 1. Header Toolbar */}
      <div className="glass-panel mx-3 mt-3 px-3 py-1.5 rounded-xl flex items-center justify-between">
        {/* Lane Selector Pills */}
        <div className="flex items-center space-x-1">
          {(Object.keys(LANE_CONFIG) as AutomationLaneId[]).map((laneId) => {
            const cfg = LANE_CONFIG[laneId];
            const laneObj = timeline?.lanes.find((l) => l.id === laneId);
            const isSelected = activeLaneId === laneId;
            const isMuted = laneObj ? !laneObj.enabled : false;
            const ptCount = laneObj?.keyframes.length || 0;

            return (
              <div
                key={laneId}
                onClick={() => setActiveLane(laneId)}
                className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium cursor-pointer transition-all border ${
                  isSelected
                    ? 'bg-white/15 text-white border-white/20 shadow-xs'
                    : 'glass-card text-zinc-400 hover:text-white border-white/[0.06]'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: isMuted ? '#64748b' : cfg.color,
                  }}
                />
                <span className="tracking-tight">{cfg.name}</span>
                <span className="text-[10px] text-zinc-500 font-mono tabular-nums">({ptCount})</span>

                {/* Quick Toggle Mute/Bypass */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleLane(laneId);
                  }}
                  title={isMuted ? 'Lane Bypassed (Click to Enable)' : 'Lane Active (Click to Bypass)'}
                  className="text-zinc-500 hover:text-white ml-0.5 cursor-pointer"
                >
                  {isMuted ? <EyeOff className="w-3 h-3 text-zinc-600" /> : <Eye className="w-3 h-3" />}
                </button>
              </div>
            );
          })}
        </div>

        {/* Tools: Snap, Grid, Zoom, Clear */}
        <div className="flex items-center space-x-1.5">
          {/* Snap toggle */}
          <button
            type="button"
            onClick={() => setSnapEnabled(!snapEnabled)}
            title={`Snap to Grid (${snapEnabled ? 'Enabled' : 'Disabled'})`}
            className={`glass-pill px-2.5 py-1 rounded-lg text-[11px] font-medium flex items-center space-x-1.5 transition-all cursor-pointer ${
              snapEnabled
                ? 'bg-white/15 text-white border-white/20'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Magnet className="w-3.5 h-3.5" />
            <span className="text-[10px] font-mono">Snap</span>
          </button>

          {/* Grid Interval Selector */}
          <select
            value={gridInterval}
            onChange={(e) => setGridInterval(parseFloat(e.target.value))}
            className="glass-card border border-white/[0.1] text-zinc-200 text-[10px] font-mono rounded-lg px-2 py-1 focus:outline-none cursor-pointer"
          >
            <option value={0.1} className="bg-[#12141a]">1/10s (0.10s)</option>
            <option value={0.25} className="bg-[#12141a]">1/4s (0.25s)</option>
            <option value={0.5} className="bg-[#12141a]">1/2s (0.50s)</option>
            <option value={1.0} className="bg-[#12141a]">1s (1.00s)</option>
            <option value={2.0} className="bg-[#12141a]">2s (2.00s)</option>
          </select>

          {/* Zoom In/Out */}
          <div className="flex items-center glass-card border border-white/[0.1] rounded-lg px-1">
            <button
              type="button"
              onClick={() => setZoom(zoom * 0.8)}
              title="Zoom Out (Ctrl -)"
              className="p-1 hover:text-white cursor-pointer"
            >
              <ZoomOut className="w-3.5 h-3.5 text-zinc-400" />
            </button>
            <span className="text-[10px] font-mono tabular-nums px-1.5 text-zinc-300 min-w-[48px] text-center font-medium">
              {Math.round(zoom)}px/s
            </span>
            <button
              type="button"
              onClick={() => setZoom(zoom * 1.25)}
              title="Zoom In (Ctrl +)"
              className="p-1 hover:text-white cursor-pointer"
            >
              <ZoomIn className="w-3.5 h-3.5 text-zinc-400" />
            </button>
          </div>

          {/* Clear Lane */}
          <button
            type="button"
            onClick={() => {
              if (activeKeyframes.length === 0) return;
              if (window.confirm(`Clear all ${activeKeyframes.length} keyframes on ${laneConfig.name}?`)) {
                clearLane(activeLaneId);
              }
            }}
            disabled={activeKeyframes.length === 0}
            title={`Clear ${laneConfig.name} keyframes`}
            className="glass-pill p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 disabled:opacity-30 cursor-pointer active:scale-95"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. Main Interactive Graph Canvas */}
      <div
        ref={containerRef}
        onWheel={handleWheel}
        className="flex-1 relative overflow-hidden m-3 my-2 rounded-2xl glass-panel cursor-crosshair"
      >
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onDoubleClick={handleDoubleClick}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          className="w-full h-full block"
        />

        {/* Empty state hint overlay */}
        {activeKeyframes.length === 0 && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="glass-card rounded-2xl p-6 text-center max-w-sm border border-white/[0.08] shadow-lg relative overflow-hidden">
              <div className="w-12 h-12 rounded-xl glass-card mx-auto mb-3 flex items-center justify-center text-zinc-400">
                <Layers className="w-6 h-6" />
              </div>
              <div className="text-xs font-semibold text-zinc-100 tracking-tight">No Keyframes on {laneConfig.name}</div>
              <div className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                Double-click anywhere on the graph to place a keyframe, or select an Orbit Trajectory Preset from the top ribbon.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Footer Bar: Status & Key Hints */}
      <div className="h-7 glass-panel mx-3 mb-2 px-3.5 rounded-xl flex items-center justify-between text-[10px] font-mono tabular-nums text-zinc-400">
        <div className="flex items-center space-x-3">
          <span>Lane: <strong className="text-zinc-200">{laneConfig.name}</strong></span>
          <span className="text-white/10">•</span>
          <span>Keyframes: <strong className="text-zinc-200 font-medium">{activeKeyframes.length}</strong></span>
          {mouseCoord && (
            <>
              <span className="text-white/10">•</span>
              <span>
                Cursor: <span className="text-zinc-200 font-medium">{mouseCoord.time.toFixed(2)}s</span> /{' '}
                <span className="text-zinc-200 font-medium">
                  {activeLaneId === 'pan'
                    ? `${(mouseCoord.value * 180).toFixed(0)}°`
                    : mouseCoord.value.toFixed(2)}
                </span>
              </span>
            </>
          )}
        </div>

        <div className="flex items-center space-x-2.5 text-zinc-500">
          <span>Double-click: Add</span>
          <span>•</span>
          <span>Click: Select</span>
          <span>•</span>
          <span>Drag: Move</span>
          <span>•</span>
          <span>Del: Delete</span>
          <span>•</span>
          <span>Ctrl+Scroll: Zoom</span>
        </div>
      </div>
    </div>
  );
};

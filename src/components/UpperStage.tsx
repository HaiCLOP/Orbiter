import React, { useRef, useEffect } from 'react';
import { Compass, Eye, AlertCircle } from 'lucide-react';
import { useTrackStore } from '../store/trackStore';

export const UpperStage: React.FC = () => {
  const { isPlaying, azimuth, spatialParams } = useTrackStore();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Store live visual angle for requestAnimationFrame interpolation
  const visualAngleRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(performance.now());

  // Anchor visual angle to Rust telemetry updates
  useEffect(() => {
    visualAngleRef.current = azimuth;
  }, [azimuth]);

  // 60/120 FPS render loop for the Spatial View Radar
  useEffect(() => {
    let animId: number;

    const render = (now: number) => {
      const dt = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;

      // Advance visual angle smoothly while playing if 8D is enabled
      if (isPlaying && spatialParams.enabled) {
        const delta = 2 * Math.PI * spatialParams.rotation_speed * dt;
        visualAngleRef.current = (visualAngleRef.current + delta) % (2 * Math.PI);
      } else if (!isPlaying) {
        visualAngleRef.current = azimuth;
      }

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const w = canvas.width;
          const h = canvas.height;
          const cx = w / 2;
          const cy = h / 2;
          const radius = Math.min(cx, cy) * 0.72;

          // Clear background
          ctx.fillStyle = '#10141d';
          ctx.fillRect(0, 0, w, h);

          // Grid: Concentric distance circles
          ctx.strokeStyle = '#1e2535';
          ctx.lineWidth = 1;

          // Outer ring
          ctx.beginPath();
          ctx.arc(cx, cy, radius, 0, Math.PI * 2);
          ctx.stroke();

          // Mid ring (dashed)
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.arc(cx, cy, radius * 0.6, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);

          // Cardinal Axes
          ctx.strokeStyle = '#161c29';
          ctx.beginPath();
          ctx.moveTo(cx, cy - radius - 8);
          ctx.lineTo(cx, cy + radius + 8);
          ctx.moveTo(cx - radius - 8, cy);
          ctx.lineTo(cx + radius + 8, cy);
          ctx.stroke();

          // Cardinal Direction Labels
          ctx.fillStyle = '#475569';
          ctx.font = 'bold 9px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('FRONT', cx, cy - radius - 14);
          ctx.fillText('BACK', cx, cy + radius + 14);
          ctx.fillText('L', cx - radius - 14, cy);
          ctx.fillText('R', cx + radius + 14, cy);

          // Center Listener Head Icon
          ctx.save();
          ctx.translate(cx, cy);

          // Head Base
          ctx.fillStyle = '#1e293b';
          ctx.strokeStyle = '#6366f1';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(0, 0, 15, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Left Ear
          ctx.fillStyle = '#4f46e5';
          ctx.beginPath();
          ctx.ellipse(-16, 0, 3, 6, 0, 0, Math.PI * 2);
          ctx.fill();

          // Right Ear
          ctx.beginPath();
          ctx.ellipse(16, 0, 3, 6, 0, 0, Math.PI * 2);
          ctx.fill();

          // Nose (facing front / up)
          ctx.fillStyle = '#818cf8';
          ctx.beginPath();
          ctx.moveTo(-3, -13);
          ctx.lineTo(3, -13);
          ctx.lineTo(0, -20);
          ctx.closePath();
          ctx.fill();

          ctx.restore();

          // 3D Spatial Parameters
          const dist = Math.max(0, Math.min(1, spatialParams.distance ?? 0));
          const elev = Math.max(-1, Math.min(1, spatialParams.elevation ?? 0));

          // Dynamic orbit radius: closer to head at dist=0, expanding to boundary at dist=1
          const effectiveRadius = radius * (0.38 + 0.62 * dist);

          // Dot size and halo scaling based on distance (closer = larger / brighter)
          const dotRadius = Math.max(3.5, 8.5 - 4.5 * dist);
          const haloRadius = Math.max(12, 26 - 14 * dist);
          const haloAlpha = Math.max(0.18, 0.55 - 0.35 * dist);

          // Dot and halo tint based on elevation (Above = emerald/bright, Below = violet/deep, Neutral = cyan)
          let dotColor = '#22d3ee';
          let haloColorStart = `rgba(34, 211, 238, ${haloAlpha})`;
          if (elev > 0.05) {
            dotColor = '#34d399';
            haloColorStart = `rgba(52, 211, 153, ${haloAlpha})`;
          } else if (elev < -0.05) {
            dotColor = '#a78bfa';
            haloColorStart = `rgba(167, 139, 250, ${haloAlpha})`;
          }

          // 8D Orbital Path & Moving Satellite Dot
          const currentAngle = visualAngleRef.current;
          // Coordinates: angle 0 is Front (up), PI/2 is Right
          const dotX = cx + effectiveRadius * Math.sin(currentAngle);
          const dotY = cy - effectiveRadius * Math.cos(currentAngle);

          // Orbital Trail (subtle glow along effective distance radius)
          ctx.strokeStyle = spatialParams.enabled
            ? (elev > 0.05 ? 'rgba(52, 211, 153, 0.30)' : elev < -0.05 ? 'rgba(167, 139, 250, 0.30)' : 'rgba(34, 211, 238, 0.25)')
            : 'rgba(99, 102, 241, 0.15)';
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.arc(cx, cy, effectiveRadius, 0, Math.PI * 2);
          ctx.stroke();

          if (spatialParams.enabled) {
            // Trailing halo around active sound source (scaled by distance)
            const grad = ctx.createRadialGradient(dotX, dotY, 2, dotX, dotY, haloRadius);
            grad.addColorStop(0, haloColorStart);
            grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(dotX, dotY, haloRadius, 0, Math.PI * 2);
            ctx.fill();

            // Sound Source Satellite Dot (scaled by distance & colored by elevation)
            ctx.fillStyle = dotColor;
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(dotX, dotY, dotRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // Secondary Contralateral Reflection Point (Pink)
            const oppRadius = effectiveRadius * 0.6;
            const oppX = cx - oppRadius * Math.sin(currentAngle);
            const oppY = cy + oppRadius * Math.cos(currentAngle);
            ctx.fillStyle = '#ec4899';
            ctx.beginPath();
            ctx.arc(oppX, oppY, Math.max(2.5, dotRadius * 0.6), 0, Math.PI * 2);
            ctx.fill();
          } else {
            // Idle sound source dot at front (scaled by distance)
            const idleX = cx;
            const idleY = cy - effectiveRadius;
            ctx.fillStyle = '#64748b';
            ctx.beginPath();
            ctx.arc(idleX, idleY, Math.max(3.5, dotRadius * 0.8), 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, spatialParams, azimuth]);

  // Auto-resize canvas to match container
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current && canvasRef.current) {
        canvasRef.current.width = containerRef.current.clientWidth;
        canvasRef.current.height = containerRef.current.clientHeight;
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const degrees = Math.round((visualAngleRef.current * 180) / Math.PI) % 360;

  return (
    <div className="h-64 grid grid-cols-12 gap-1.5 p-1.5 bg-[#0e1117] border-b border-[#222734]">
      {/* Left: Real-Time Spatial View Radar */}
      <div className="col-span-4 bg-[#141822] rounded-lg border border-[#232938] p-3 flex flex-col justify-between relative overflow-hidden">
        {/* Header & Tabs */}
        <div className="flex items-center justify-between z-10">
          <div className="flex items-center space-x-1.5 text-zinc-300 font-semibold text-xs">
            <Compass className="w-3.5 h-3.5 text-indigo-400" />
            <span>Spatial View</span>
          </div>
          <div className="flex items-center space-x-1 bg-[#1a202c] p-0.5 rounded text-[10px]">
            <span className="px-2 py-0.5 rounded bg-indigo-600/30 text-indigo-300 font-semibold border border-indigo-500/40">
              Top
            </span>
            <span className="px-2 py-0.5 text-zinc-500">Front</span>
            <span className="px-2 py-0.5 text-zinc-500">Side</span>
          </div>
        </div>

        {/* Radar Canvas Container */}
        <div ref={containerRef} className="relative flex-1 w-full my-1 rounded overflow-hidden">
          <canvas ref={canvasRef} className="w-full h-full block" />
        </div>

        {/* Footer info: Telemetry Readout */}
        <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-1 border-t border-[#232938] z-10 font-mono">
          <div className="flex items-center space-x-2 text-zinc-400">
            <span className={spatialParams.enabled ? 'text-cyan-400 font-semibold' : 'text-zinc-500'}>
              {spatialParams.enabled ? `Az: ${degrees}°` : '8D Off'}
            </span>
            <span className="text-zinc-600">|</span>
            <span className="text-amber-400">
              d: {Math.round((spatialParams.distance ?? 0) * 100)}%
            </span>
            <span className="text-zinc-600">|</span>
            <span
              className={
                (spatialParams.elevation ?? 0) > 0.05
                  ? 'text-emerald-400'
                  : (spatialParams.elevation ?? 0) < -0.05
                  ? 'text-sky-400'
                  : 'text-zinc-400'
              }
            >
              el: {(spatialParams.elevation ?? 0) > 0.05 ? `+${Math.round(spatialParams.elevation * 100)}%` : (spatialParams.elevation ?? 0) < -0.05 ? `${Math.round(spatialParams.elevation * 100)}%` : '0%'}
            </span>
          </div>
          <div className="flex items-center space-x-1.5">
            <Eye className="w-3 h-3 text-zinc-400" />
            <AlertCircle className="w-3 h-3 text-zinc-500" />
          </div>
        </div>
      </div>

      {/* Right: Graph Editor Curves (Staged for Step 6) */}
      <div className="col-span-8 bg-[#141822] rounded-lg border border-[#232938] p-3 flex flex-col justify-between relative overflow-hidden">
        {/* Header Tools */}
        <div className="flex items-center justify-between pb-2 border-b border-[#232938]">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold text-zinc-300">Graph Editor</span>
            <span className="text-[10px] text-zinc-500 font-mono bg-[#1a202c] px-1.5 py-0.5 rounded border border-[#232938]">
              Keyframes (Step 6)
            </span>
          </div>

          <div className="flex items-center space-x-3 text-[11px] font-mono">
            <span className="flex items-center gap-1 text-cyan-400">
              <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" /> Pan (L ↔ R)
            </span>
            <span className="flex items-center gap-1 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> Distance
            </span>
            <span className="flex items-center gap-1 text-amber-400">
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Elevation
            </span>
            <span className="flex items-center gap-1 text-purple-400">
              <span className="w-2 h-2 rounded-full bg-purple-400 inline-block" /> Reverb
            </span>
          </div>
        </div>

        {/* Canvas Curve Preview */}
        <div className="relative flex-1 my-2 bg-[#0c0e14] rounded border border-[#1e2330] overflow-hidden flex items-center">
          <div className="absolute inset-0 flex justify-between px-6 pointer-events-none opacity-20">
            {['00:00', '00:30', '01:00', '01:30', '02:00', '02:30', '03:00'].map((tc) => (
              <div key={tc} className="flex flex-col items-center">
                <span className="text-[9px] text-zinc-500">{tc}</span>
                <div className="w-[1px] h-full bg-zinc-700" />
              </div>
            ))}
          </div>

          <svg className="w-full h-full p-2" viewBox="0 0 600 120" preserveAspectRatio="none">
            <path
              d="M 0 60 Q 150 10 300 60 T 600 60"
              fill="none"
              stroke="#22d3ee"
              strokeWidth="2"
            />
            <path
              d="M 0 40 Q 150 70 300 30 T 600 50"
              fill="none"
              stroke="#34d399"
              strokeWidth="2"
            />
            <path
              d="M 0 80 Q 200 40 400 90 T 600 70"
              fill="none"
              stroke="#fbbf24"
              strokeWidth="2"
            />
            <path
              d="M 0 95 Q 250 80 450 100 T 600 85"
              fill="none"
              stroke="#c084fc"
              strokeWidth="2"
            />
          </svg>
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
          <span>Continuous Azimuth LFO: {spatialParams.rotation_speed} Hz</span>
          <span>Binaural Woodworth Model Active</span>
        </div>
      </div>
    </div>
  );
};

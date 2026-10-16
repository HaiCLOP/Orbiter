import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useTrackStore } from '../store/trackStore';

/**
 * Dual-channel (L/R) horizontal waveform preview canvas.
 *
 * Invariants:
 * - Left channel renders in upper half; Right channel renders in lower half.
 * - Min/max peaks are drawn as vertical column lines matching canvas resolution.
 * - Clicking or dragging across the canvas seeks the playhead cleanly.
 * - Playhead position is drawn synchronously with `position / duration`.
 */
export const WaveformPreview: React.FC = () => {
  const { track, duration, position, seek, isPlaying } = useTrackStore();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);

  // Seek helper
  const handleSeekFromEvent = useCallback(
    (e: React.MouseEvent<HTMLDivElement> | MouseEvent) => {
      if (!canvasRef.current || duration <= 0) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const clickX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      const targetTime = (clickX / rect.width) * duration;
      seek(targetTime);
    },
    [duration, seek]
  );

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsScrubbing(true);
    handleSeekFromEvent(e);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isScrubbing) {
        handleSeekFromEvent(e);
      }
    };

    const handleMouseUp = () => {
      setIsScrubbing(false);
    };

    if (isScrubbing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isScrubbing, handleSeekFromEvent]);

  // Canvas render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const halfH = height / 2;

    // Background
    ctx.fillStyle = '#0a0c10';
    ctx.fillRect(0, 0, width, height);

    // Grid lines & dB markers
    ctx.strokeStyle = '#181d28';
    ctx.lineWidth = 1;

    // Horizontal center separator (between L and R)
    ctx.beginPath();
    ctx.moveTo(0, halfH);
    ctx.lineTo(width, halfH);
    ctx.stroke();

    // Channel baseline centerlines
    ctx.strokeStyle = '#141822';
    ctx.beginPath();
    ctx.moveTo(0, halfH / 2);
    ctx.lineTo(width, halfH / 2);
    ctx.moveTo(0, halfH + halfH / 2);
    ctx.lineTo(width, halfH + halfH / 2);
    ctx.stroke();

    // Render Waveform Peaks
    const peaks = track?.peaks;
    if (peaks && peaks.num_bins > 0) {
      const numBins = peaks.num_bins;
      const colWidth = width / numBins;

      // Color scheme matching pro DAW aesthetic: vibrant indigo/purple
      ctx.fillStyle = '#6366f1'; // Indigo

      // Left Channel (Top Half: center at halfH / 2)
      const centerYLeft = halfH / 2;
      const maxAmpL = halfH / 2 * 0.9;

      for (let i = 0; i < numBins; i++) {
        const x = i * colWidth;
        const minVal = peaks.min_peaks_l[i] ?? 0;
        const maxVal = peaks.max_peaks_l[i] ?? 0;

        const yTop = centerYLeft - maxVal * maxAmpL;
        const yBottom = centerYLeft - minVal * maxAmpL;
        const barHeight = Math.max(1, yBottom - yTop);

        ctx.fillRect(x, yTop, Math.max(1, colWidth), barHeight);
      }

      // Right Channel (Bottom Half: center at halfH + halfH / 2)
      const centerYRight = halfH + halfH / 2;
      const maxAmpR = halfH / 2 * 0.9;

      for (let i = 0; i < numBins; i++) {
        const x = i * colWidth;
        const minVal = peaks.min_peaks_r[i] ?? 0;
        const maxVal = peaks.max_peaks_r[i] ?? 0;

        const yTop = centerYRight - maxVal * maxAmpR;
        const yBottom = centerYRight - minVal * maxAmpR;
        const barHeight = Math.max(1, yBottom - yTop);

        ctx.fillRect(x, yTop, Math.max(1, colWidth), barHeight);
      }
    }

    // Channel Labels (L & R)
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 10px monospace';
    ctx.fillText('L', 8, halfH / 2 + 3);
    ctx.fillText('R', 8, halfH + halfH / 2 + 3);

    // Playhead line & glowing cursor
    if (duration > 0) {
      const playheadX = (position / duration) * width;

      // Vertical cursor line
      ctx.strokeStyle = '#22d3ee'; // Cyan
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();

      // Top playhead triangle badge
      ctx.fillStyle = '#22d3ee';
      ctx.beginPath();
      ctx.moveTo(playheadX - 5, 0);
      ctx.lineTo(playheadX + 5, 0);
      ctx.lineTo(playheadX, 7);
      ctx.closePath();
      ctx.fill();
    }
  }, [track, position, duration, isPlaying]);

  // Resize canvas to match container width
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

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      className="relative w-full h-full flex-1 bg-[#0a0c10] cursor-crosshair overflow-hidden select-none"
    >
      <canvas ref={canvasRef} className="w-full h-full block" />

      {/* Right dB scale markers */}
      <div className="absolute right-2 inset-y-0 flex flex-col justify-between py-2 text-[9px] font-mono text-zinc-600 pointer-events-none select-none">
        <span>0 dB</span>
        <span>-6 dB</span>
        <span>-12 dB</span>
        <span>-∞ dB</span>
      </div>
    </div>
  );
};

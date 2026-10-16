import React from 'react';
import { Music, Radio } from 'lucide-react';
import { useTrackStore } from '../../store/trackStore';

function formatDuration(seconds: number): string {
  if (isNaN(seconds) || seconds <= 0) return '00:00.000';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.floor((seconds % 1) * 1000);
  return `${mins.toString().padStart(2, '0')}:${secs
    .toString()
    .padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
}

export const AudioClipCard: React.FC = () => {
  const { track, isPlaying } = useTrackStore();

  return (
    <section className="space-y-1.5 select-none">
      <div className="flex items-center justify-between text-zinc-400 font-semibold text-[10px] uppercase tracking-wider px-1">
        <div className="flex items-center space-x-1.5">
          <Music className="w-3 h-3 text-zinc-400" />
          <span>Source File</span>
        </div>
        {track && (
          <div className="flex items-center space-x-1 text-[10px] font-mono">
            {isPlaying && <Radio className="w-3 h-3 text-emerald-400" />}
            <span className={isPlaying ? 'text-emerald-400 font-medium' : 'text-zinc-500'}>
              {isPlaying ? 'ACTIVE' : 'READY'}
            </span>
          </div>
        )}
      </div>

      <div className="glass-panel rounded-xl p-3 border border-white/[0.08] space-y-2 font-mono tabular-nums text-[11px]">
        <div className="flex items-center justify-between text-zinc-100 font-medium pb-2 border-b border-white/[0.06]">
          <span className="truncate max-w-[170px] text-xs font-sans font-medium" title={track?.file_name ?? 'No track loaded'}>
            {track?.file_name ?? 'No track loaded'}
          </span>
          <span className="glass-pill text-[9px] text-zinc-300 px-2 py-0.5 rounded-md">
            {track ? 'Stereo 2.0' : '—'}
          </span>
        </div>

        <div className="flex items-center justify-between text-zinc-400">
          <span>Duration</span>
          <span className="text-zinc-200 font-normal">
            {track ? formatDuration(track.duration) : '00:00.000'}
          </span>
        </div>

        <div className="flex items-center justify-between text-zinc-400">
          <span>Sample Rate</span>
          <span className="text-zinc-200 font-normal">
            {track ? `${track.sample_rate.toLocaleString()} Hz` : '—'}
          </span>
        </div>

        <div className="flex items-center justify-between text-zinc-400">
          <span>Channels</span>
          <span className="text-zinc-200 font-normal">
            {track ? (track.channels === 2 ? 'Stereo (2.0)' : track.channels) : '—'}
          </span>
        </div>

        <div className="flex items-center justify-between text-zinc-400">
          <span>Format</span>
          <span className="text-zinc-200 uppercase font-normal">
            {track ? track.file_name.split('.').pop() : '—'}
          </span>
        </div>
      </div>
    </section>
  );
};

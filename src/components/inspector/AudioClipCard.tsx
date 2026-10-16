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
    <section className="space-y-2">
      <div className="flex items-center justify-between text-zinc-400 font-semibold text-[11px] uppercase tracking-wider">
        <div className="flex items-center space-x-1.5">
          <Music className="w-3.5 h-3.5 text-indigo-400" />
          <span>Audio Clip</span>
        </div>
        {track && (
          <div className="flex items-center space-x-1 text-[10px] text-emerald-400 font-mono">
            {isPlaying && <Radio className="w-3 h-3 animate-pulse text-emerald-400" />}
            <span>{isPlaying ? 'PLAYING' : 'READY'}</span>
          </div>
        )}
      </div>

      <div className="bg-[#181d28] rounded-md p-2.5 border border-[#262c3a] space-y-1.5 font-mono text-[11px]">
        <div className="flex items-center justify-between text-zinc-100 font-semibold pb-1 border-b border-[#262c3a]">
          <span className="truncate max-w-[170px]" title={track?.file_name ?? 'No track loaded'}>
            {track?.file_name ?? 'No track loaded'}
          </span>
          <span className="text-[10px] text-zinc-400 font-normal px-1 rounded bg-[#202636]">
            {track ? 'Stereo' : '—'}
          </span>
        </div>

        <div className="flex items-center justify-between text-zinc-400">
          <span>Duration</span>
          <span className="text-zinc-200">
            {track ? formatDuration(track.duration) : '00:00.000'}
          </span>
        </div>

        <div className="flex items-center justify-between text-zinc-400">
          <span>Sample Rate</span>
          <span className="text-zinc-200">
            {track ? `${track.sample_rate.toLocaleString()} Hz` : '—'}
          </span>
        </div>

        <div className="flex items-center justify-between text-zinc-400">
          <span>Channels</span>
          <span className="text-zinc-200">
            {track ? (track.channels === 2 ? 'Stereo (2.0)' : track.channels) : '—'}
          </span>
        </div>

        <div className="flex items-center justify-between text-zinc-400">
          <span>Format</span>
          <span className="text-zinc-200 uppercase">
            {track ? track.file_name.split('.').pop() : '—'}
          </span>
        </div>
      </div>
    </section>
  );
};

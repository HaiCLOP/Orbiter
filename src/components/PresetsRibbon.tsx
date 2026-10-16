import React from 'react';
import { Infinity as InfinityIcon, Circle, Disc, Orbit, Compass, Sliders } from 'lucide-react';
import { useTimelineStore } from '../store/timelineStore';

export const PresetsRibbon: React.FC = () => {
  const { loadPreset } = useTimelineStore();

  const presets = [
    {
      id: 'classic_orbit',
      name: 'Classic Orbit',
      icon: <InfinityIcon className="w-3.5 h-3.5 text-sky-400" />,
      desc: '360° circular horizontal trajectory',
    },
    {
      id: 'slow_spin',
      name: 'Slow Spin',
      icon: <Circle className="w-3.5 h-3.5 text-purple-400" />,
      desc: '12s panoramic slow rotation',
    },
    {
      id: 'front_to_back',
      name: 'Front to Back',
      icon: <Disc className="w-3.5 h-3.5 text-rose-400" />,
      desc: 'Overhead dive and elevation sweep',
    },
    {
      id: 'head_circle',
      name: 'Head Circle',
      icon: <Orbit className="w-3.5 h-3.5 text-emerald-400" />,
      desc: 'Intimate binaural corkscrew',
    },
    {
      id: 'deep_space',
      name: 'Deep Space',
      icon: <Compass className="w-3.5 h-3.5 text-amber-400" />,
      desc: 'Expanding reverb and distance departure',
    },
  ];

  return (
    <div className="h-10 glass-panel mx-3 mb-2 px-3.5 rounded-xl flex items-center justify-between select-none">
      <div className="flex items-center space-x-2 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
        <Sliders className="w-3 h-3 text-zinc-400" />
        <span>Trajectories</span>
      </div>

      <div className="flex items-center space-x-1.5">
        {presets.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => loadPreset(p.id)}
            title={`${p.name}: ${p.desc}`}
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md glass-card hover:bg-white/[0.08] cursor-pointer transition-all border border-white/[0.08] text-zinc-300 hover:text-white"
          >
            {p.icon}
            <span className="text-[11px] font-medium tracking-tight">
              {p.name}
            </span>
          </button>
        ))}
      </div>

      <div className="text-[10px] text-zinc-500 font-mono tabular-nums">
        <span className="glass-pill px-2 py-0.5 rounded-md text-[9px] text-zinc-400">
          5 Presets
        </span>
      </div>
    </div>
  );
};

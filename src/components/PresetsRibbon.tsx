import React from 'react';
import { Infinity as InfinityIcon, Circle, Disc, Orbit, Compass, Sparkles } from 'lucide-react';
import { useTimelineStore } from '../store/timelineStore';

export const PresetsRibbon: React.FC = () => {
  const { loadPreset } = useTimelineStore();

  const presets = [
    {
      id: 'classic_orbit',
      name: 'Classic Orbit',
      color: '#06b6d4',
      glow: 'rgba(6,182,212,0.4)',
      icon: <InfinityIcon className="w-3.5 h-3.5 text-cyan-400" />,
      desc: '360° circular trajectory',
    },
    {
      id: 'slow_spin',
      name: 'Slow Spin',
      color: '#a855f7',
      glow: 'rgba(168,85,247,0.4)',
      icon: <Circle className="w-3.5 h-3.5 text-purple-400" />,
      desc: '12s panoramic rotation',
    },
    {
      id: 'front_to_back',
      name: 'Front to Back',
      color: '#f43f5e',
      glow: 'rgba(244,63,94,0.4)',
      icon: <Disc className="w-3.5 h-3.5 text-rose-400" />,
      desc: 'Overhead dive & shadow',
    },
    {
      id: 'head_circle',
      name: 'Head Circle',
      color: '#10b981',
      glow: 'rgba(16,185,129,0.4)',
      icon: <Orbit className="w-3.5 h-3.5 text-emerald-400" />,
      desc: 'Close binaural corkscrew',
    },
    {
      id: 'deep_space',
      name: 'Deep Space',
      color: '#f59e0b',
      glow: 'rgba(245,158,11,0.4)',
      icon: <Compass className="w-3.5 h-3.5 text-amber-400" />,
      desc: 'Expanding reverb departure',
    },
  ];

  return (
    <div className="h-12 glass-panel mx-3 mb-2 px-4 rounded-xl flex items-center justify-between select-none shadow-md">
      <div className="flex items-center space-x-2 text-[10px] font-bold text-slate-300 uppercase tracking-wider">
        <Sparkles className="w-3 h-3 text-cyan-400" />
        <span>Orbit Trajectories</span>
      </div>

      <div className="flex items-center space-x-2.5">
        {presets.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => loadPreset(p.id)}
            title={`${p.name}: ${p.desc}`}
            className="flex items-center space-x-2 px-3 py-1.5 rounded-xl glass-card hover:bg-white/[0.08] cursor-pointer transition-all border border-white/[0.08] hover:border-white/[0.2] shadow-xs hover:scale-105 active:scale-95 group"
          >
            <div className="group-hover:scale-110 transition-transform">
              {p.icon}
            </div>
            <span className="text-[11px] text-slate-200 font-medium tracking-tight">
              {p.name}
            </span>
          </button>
        ))}
      </div>

      <div className="text-[10px] text-slate-400 font-mono tabular-nums">
        <span className="glass-pill px-2 py-0.5 rounded-full text-[9px] text-cyan-300 border-cyan-500/30">
          Instant Handoff
        </span>
      </div>
    </div>
  );
};

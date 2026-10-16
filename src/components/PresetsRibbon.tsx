import React from 'react';
import { Infinity as InfinityIcon, Circle, Disc, Orbit, Compass, Plus } from 'lucide-react';

export const PresetsRibbon: React.FC = () => {
  const presets = [
    { name: 'Classic Orbit', icon: <InfinityIcon className="w-4 h-4 text-cyan-400" /> },
    { name: 'Slow Spin', icon: <Circle className="w-4 h-4 text-purple-400" /> },
    { name: 'Front to Back', icon: <Disc className="w-4 h-4 text-rose-400" /> },
    { name: 'Head Circle', icon: <Orbit className="w-4 h-4 text-emerald-400" /> },
    { name: 'Deep Space', icon: <Compass className="w-4 h-4 text-pink-400" /> },
  ];

  return (
    <div className="h-14 bg-[#10131a] border-t border-[#222734] px-4 flex items-center justify-between select-none">
      <div className="flex items-center space-x-2 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
        <span>Presets</span>
        <button
          title="Add Custom Preset"
          className="p-0.5 rounded hover:bg-[#1e2330] text-zinc-500 hover:text-zinc-300"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex items-center space-x-3">
        {presets.map((p) => (
          <div
            key={p.name}
            className="flex items-center space-x-2 px-3 py-1.5 rounded-md bg-[#161a24] hover:bg-[#1e2330] border border-[#252b3a] cursor-pointer transition-colors"
          >
            {p.icon}
            <span className="text-xs text-zinc-300 font-medium">{p.name}</span>
          </div>
        ))}
      </div>

      <div className="text-[10px] text-zinc-500 font-mono">Step 9 Preset Engine</div>
    </div>
  );
};

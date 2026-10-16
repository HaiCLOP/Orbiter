import React from 'react';
import { Network, Plus, Eye, Lock } from 'lucide-react';

export const GraphInspector: React.FC = () => {
  const lanes = [
    { id: 'azimuth', name: 'Azimuth (Pan L↔R)', color: 'bg-cyan-400', active: true, points: 16 },
    { id: 'distance', name: 'Distance Falloff', color: 'bg-emerald-400', active: true, points: 8 },
    { id: 'elevation', name: 'Elevation (Up/Down)', color: 'bg-amber-400', active: true, points: 12 },
    { id: 'reverb', name: 'Reverb Wet Send', color: 'bg-purple-400', active: true, points: 6 },
    { id: 'volume', name: 'Master Volume', color: 'bg-indigo-400', active: false, points: 0 },
  ];

  return (
    <div className="space-y-4 select-none">
      <section className="space-y-2.5">
        <div className="flex items-center justify-between text-zinc-400 font-semibold text-[11px] uppercase tracking-wider">
          <div className="flex items-center space-x-1.5">
            <Network className="w-3.5 h-3.5 text-indigo-400" />
            <span>Automation Lanes</span>
          </div>
          <span className="text-[9px] bg-[#222734] text-zinc-400 px-1.5 py-0.5 rounded font-mono flex items-center gap-1">
            <Lock className="w-2.5 h-2.5" />
            Step 7
          </span>
        </div>

        <div className="space-y-1.5">
          {lanes.map((lane) => (
            <div
              key={lane.id}
              className="bg-[#181d28] p-2 rounded border border-[#262c3a] flex items-center justify-between text-[11px]"
            >
              <div className="flex items-center space-x-2">
                <span className={`w-2.5 h-2.5 rounded-full ${lane.color}`} />
                <span className="text-zinc-200 font-medium">{lane.name}</span>
              </div>
              <div className="flex items-center space-x-2 text-[10px] text-zinc-500 font-mono">
                <span>{lane.points} pts</span>
                <Eye className="w-3 h-3 text-zinc-400" />
              </div>
            </div>
          ))}
        </div>

        <button className="w-full py-1.5 rounded bg-[#181d28] hover:bg-[#202636] border border-dashed border-[#262c3a] text-zinc-400 hover:text-zinc-200 text-[10px] flex items-center justify-center space-x-1 transition-colors">
          <Plus className="w-3 h-3" />
          <span>Add Custom Automation Parameter</span>
        </button>
      </section>

      <section className="bg-[#181d28] rounded-md p-2.5 border border-[#262c3a] space-y-2 text-[11px]">
        <div className="font-semibold text-zinc-300">Interpolation Mode</div>
        <div className="grid grid-cols-3 gap-1 text-[10px] font-mono">
          <span className="p-1 rounded bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 text-center">
            Bezier
          </span>
          <span className="p-1 rounded bg-[#202636] text-zinc-400 text-center">
            Linear
          </span>
          <span className="p-1 rounded bg-[#202636] text-zinc-400 text-center">
            Hold/Step
          </span>
        </div>
      </section>
    </div>
  );
};

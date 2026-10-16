import React from 'react';
import { useWorkspaceStore } from '../store/workspaceStore';
import { AudioClipCard } from './inspector/AudioClipCard';
import { SpatialInspector } from './inspector/SpatialInspector';
import { EffectsInspector } from './inspector/EffectsInspector';
import { EditInspector } from './inspector/EditInspector';
import { GraphInspector } from './inspector/GraphInspector';
import { RenderInspector } from './inspector/RenderInspector';

export const PropertiesPanel: React.FC = () => {
  const { activeTab } = useWorkspaceStore();

  return (
    <aside className="w-80 glass-panel border-y-0 border-r-0 border-l border-white/[0.08] flex flex-col text-xs text-slate-300 select-none overflow-y-auto relative shadow-2xl">
      {/* Top Inspector Header */}
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5 text-[11px]">
        <div className="flex items-center space-x-2 font-bold text-slate-100">
          <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
          <span className="uppercase tracking-wider text-[10px] text-slate-400">Inspector:</span>
          <span className="glass-pill px-2 py-0.5 rounded-full text-cyan-300 font-semibold border-cyan-500/30">
            {activeTab} Mode
          </span>
        </div>
        <span className="text-[10px] text-slate-500 font-mono">
          Contextual
        </span>
      </div>

      <div className="p-3.5 space-y-4 flex-1">
        {/* Permanent Audio Clip Metadata */}
        <AudioClipCard />

        {/* Dynamic Contextual Inspector Controls Based on Active Workspace Tab */}
        <div className="pt-2 border-t border-white/[0.06]">
          {activeTab === 'Spatial' && <SpatialInspector />}
          {activeTab === 'Effects' && <EffectsInspector />}
          {activeTab === 'Edit' && <EditInspector />}
          {activeTab === 'Graph' && <GraphInspector />}
          {activeTab === 'Render' && <RenderInspector />}
        </div>
      </div>
    </aside>
  );
};

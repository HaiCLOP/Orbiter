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
    <aside className="w-80 glass-panel border-y-0 border-r-0 border-l border-white/[0.08] flex flex-col text-xs text-zinc-300 select-none overflow-y-auto relative">
      {/* Top Inspector Header */}
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2 text-[11px]">
        <div className="flex items-center space-x-2 font-medium text-zinc-100">
          <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
          <span className="uppercase tracking-wider text-[10px] text-zinc-400">Inspector</span>
          <span className="glass-pill px-2 py-0.5 rounded-md text-zinc-200 font-medium">
            {activeTab}
          </span>
        </div>
        <span className="text-[10px] text-zinc-500 font-mono">
          Properties
        </span>
      </div>

      <div className="p-3.5 space-y-3.5 flex-1">
        {/* Audio Clip Metadata */}
        <AudioClipCard />

        {/* Dynamic Contextual Inspector Controls */}
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

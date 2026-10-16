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
    <aside className="w-72 bg-[#12151c] border-l border-[#222734] flex flex-col text-xs text-zinc-300 select-none overflow-y-auto">
      {/* Top Inspector Header */}
      <div className="flex items-center justify-between border-b border-[#222734] px-3 py-2 text-[11px]">
        <div className="flex items-center space-x-1.5 font-semibold text-zinc-100">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
          <span>Inspector:</span>
          <span className="text-indigo-400 capitalize">{activeTab}</span>
        </div>
        <span className="text-[10px] text-zinc-500 font-mono">
          Contextual
        </span>
      </div>

      <div className="p-3 space-y-4 flex-1">
        {/* Permanent Audio Clip Metadata (Always Visible Across All Tabs) */}
        <AudioClipCard />

        {/* Dynamic Contextual Inspector Controls Based on Active Workspace Tab */}
        <div className="pt-2 border-t border-[#232938]">
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

import { create } from 'zustand';

export type WorkspaceTab = 'Edit' | 'Graph' | 'Spatial' | 'Effects' | 'Stems' | 'Render';

interface WorkspaceState {
  activeTab: WorkspaceTab;
  setActiveTab: (tab: WorkspaceTab) => void;
  aboutModalOpen: boolean;
  setAboutModalOpen: (open: boolean) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  activeTab: 'Spatial',
  setActiveTab: (tab: WorkspaceTab) => set({ activeTab: tab }),
  aboutModalOpen: false,
  setAboutModalOpen: (open: boolean) => set({ aboutModalOpen: open }),
}));

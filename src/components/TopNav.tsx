import React, { useState, useEffect, useRef } from 'react';
import {
  Disc,
  FolderOpen,
  Loader2,
  Save,
  FilePlus,
  FileDown,
  ChevronDown,
  Info,
} from 'lucide-react';
import { useTrackStore } from '../store/trackStore';
import { useWorkspaceStore, type WorkspaceTab } from '../store/workspaceStore';
import { useProjectStore } from '../store/projectStore';
import { AudioDeviceSelector } from './AudioDeviceSelector';

export const TopNav: React.FC = () => {
  const { openAndLoadTrack, isLoading } = useTrackStore();
  const { activeTab, setActiveTab, setAboutModalOpen } = useWorkspaceStore();
  const { currentFilePath, isDirty, isSaving, saveProject, openProject, newProject } =
    useProjectStore();

  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const fileMenuRef = useRef<HTMLDivElement>(null);

  const viewTabs: WorkspaceTab[] = ['Spatial', 'Effects', 'Graph', 'Edit', 'Stems', 'Render'];

  // Project title display (e.g. "my_song.orb8d" or "Untitled Project")
  const projectTitle = currentFilePath
    ? currentFilePath.split(/[/\\]/).pop()?.replace('.orb8d', '') || 'Project'
    : 'Untitled Project';

  // Close file menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (fileMenuRef.current && !fileMenuRef.current.contains(e.target as Node)) {
        setFileMenuOpen(false);
      }
    };
    if (fileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [fileMenuOpen]);

  // Global Keyboard Shortcuts (Ctrl+S, Ctrl+Shift+S, Ctrl+O, Ctrl+N, Ctrl+E)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.ctrlKey || e.metaKey;
      if (!isMod) return;

      if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        saveProject(e.shiftKey);
      } else if (e.key === 'o' || e.key === 'O') {
        e.preventDefault();
        openProject();
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        newProject();
      } else if (e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        setActiveTab('Render');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saveProject, openProject, newProject, setActiveTab]);

  return (
    <nav className="h-11 glass-panel border-x-0 border-t-0 border-b border-white/[0.08] px-4 flex items-center justify-between text-xs select-none relative z-40">
      {/* Left: App Identity, Project Name & File Menu */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2">
          <div className="w-5 h-5 rounded-md glass-card flex items-center justify-center text-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.35)]">
            <Disc className="w-3.5 h-3.5" />
          </div>
          <div className="flex items-baseline space-x-1.5">
            <span className="text-zinc-100 font-bold text-[13px] tracking-tight">Orbiter</span>
            <span className="text-[10px] font-medium text-sky-400/90 tracking-wide">by HaiCLOP Labs</span>
          </div>
          <span className="glass-pill text-[9px] text-zinc-400 px-1.5 py-0.2 rounded font-mono font-medium border border-white/10">
            8D Spatial
          </span>
        </div>

        {/* Project Name + Dirty Indicator Pill */}
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.06] font-mono text-[11px]">
          <span className="text-white/80 max-w-[140px] truncate">{projectTitle}</span>
          {isDirty && (
            <span
              className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shadow-[0_0_8px_rgba(251,191,36,0.8)]"
              title="Modified since last save"
            />
          )}
        </div>

        {/* File Dropdown Menu */}
        <div className="relative" ref={fileMenuRef}>
          <button
            onClick={() => setFileMenuOpen(!fileMenuOpen)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
              fileMenuOpen
                ? 'bg-white/15 text-white'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06]'
            }`}
          >
            <span>File</span>
            <ChevronDown className="w-3 h-3 text-white/50" />
          </button>

          {fileMenuOpen && (
            <div className="absolute left-0 mt-1.5 w-52 rounded-xl bg-neutral-900/90 border border-white/15 shadow-2xl backdrop-blur-2xl py-1 text-white text-[11px] z-50 animate-in fade-in zoom-in-95 duration-100">
              <button
                onClick={() => {
                  setFileMenuOpen(false);
                  newProject();
                }}
                className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-white/10 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <FilePlus className="w-3.5 h-3.5 text-white/60" />
                  <span>New Project</span>
                </div>
                <span className="text-[10px] text-white/40 font-mono">Ctrl+N</span>
              </button>

              <button
                onClick={() => {
                  setFileMenuOpen(false);
                  openProject();
                }}
                className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-white/10 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <FolderOpen className="w-3.5 h-3.5 text-white/60" />
                  <span>Open Project...</span>
                </div>
                <span className="text-[10px] text-white/40 font-mono">Ctrl+O</span>
              </button>

              <div className="my-1 border-t border-white/[0.08]" />

              <button
                onClick={() => {
                  setFileMenuOpen(false);
                  saveProject(false);
                }}
                disabled={isSaving}
                className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-50"
              >
                <div className="flex items-center gap-2">
                  <Save className="w-3.5 h-3.5 text-white/60" />
                  <span>Save Project</span>
                </div>
                <span className="text-[10px] text-white/40 font-mono">Ctrl+S</span>
              </button>

              <button
                onClick={() => {
                  setFileMenuOpen(false);
                  saveProject(true);
                }}
                disabled={isSaving}
                className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-50"
              >
                <div className="flex items-center gap-2">
                  <Save className="w-3.5 h-3.5 text-white/60" />
                  <span>Save Project As...</span>
                </div>
                <span className="text-[10px] text-white/40 font-mono">Ctrl+Shift+S</span>
              </button>

              <div className="my-1 border-t border-white/[0.08]" />

              <button
                onClick={() => {
                  setFileMenuOpen(false);
                  openAndLoadTrack();
                }}
                className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-white/10 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Disc className="w-3.5 h-3.5 text-sky-400" />
                  <span>Open Audio Track...</span>
                </div>
              </button>

              <button
                onClick={() => {
                  setFileMenuOpen(false);
                  setActiveTab('Render');
                }}
                className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-white/10 transition-colors cursor-pointer text-sky-300"
              >
                <div className="flex items-center gap-2">
                  <FileDown className="w-3.5 h-3.5 text-sky-400" />
                  <span>Export Master Audio...</span>
                </div>
                <span className="text-[10px] text-sky-400/50 font-mono">Ctrl+E</span>
              </button>

              <div className="my-1 border-t border-white/[0.08]" />

              <button
                onClick={() => {
                  setFileMenuOpen(false);
                  setAboutModalOpen(true);
                }}
                className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-white/10 transition-colors cursor-pointer text-zinc-300 hover:text-white"
              >
                <div className="flex items-center gap-2">
                  <Info className="w-3.5 h-3.5 text-sky-400" />
                  <span>About Orbiter & HaiCLOP Labs...</span>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Center: Apple Segmented Workspace Controller */}
      <div className="flex items-center space-x-0.5 glass-card p-0.5 rounded-lg border border-white/[0.08]">
        {viewTabs.map((tab) => {
          const isActive = tab === activeTab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer relative ${
                isActive
                  ? 'bg-white/15 text-white shadow-xs font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {tab}
            </button>
          );
        })}
      </div>

      {/* Right: Audio Device & Open Action */}
      <div className="flex items-center space-x-2.5">
        <AudioDeviceSelector />

        <button
          onClick={openAndLoadTrack}
          disabled={isLoading}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 active:bg-white/10 border border-white/[0.12] disabled:opacity-50 text-white text-[11px] font-medium transition-all cursor-pointer shadow-xs active:scale-95"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-300" />
              <span>Loading...</span>
            </>
          ) : (
            <>
              <FolderOpen className="w-3.5 h-3.5 text-zinc-300" />
              <span>Open Track</span>
            </>
          )}
        </button>
      </div>
    </nav>
  );
};

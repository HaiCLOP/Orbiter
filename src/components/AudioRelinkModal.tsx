import React from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useProjectStore } from '../store/projectStore';

export const AudioRelinkModal: React.FC = () => {
  const { relinkModalOpen, pendingRelinkProject, cancelRelink, relinkAudioSource } =
    useProjectStore();

  if (!relinkModalOpen || !pendingRelinkProject) return null;

  const handleLocateFile = async () => {
    try {
      const selected = await invoke<string | null>('select_audio_file');
      if (selected) {
        await relinkAudioSource(selected);
      }
    } catch (err) {
      console.error('Failed to locate audio file:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg p-6 rounded-2xl bg-gradient-to-b from-white/10 to-white/[0.03] border border-white/20 shadow-2xl backdrop-blur-2xl text-white">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold tracking-tight text-white/95">
              Relink Missing Audio
            </h3>
            <p className="text-xs text-white/50">
              The referenced audio file could not be located at its original path.
            </p>
          </div>
        </div>

        <div className="p-3.5 mb-5 rounded-xl bg-black/40 border border-white/10 text-xs font-mono space-y-1.5">
          <div className="text-white/40">Expected File:</div>
          <div className="text-amber-300 font-medium truncate">
            {pendingRelinkProject.audio_source.file_name}
          </div>
          <div className="text-white/30 text-[10px] break-all">
            {pendingRelinkProject.audio_source.file_path}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5">
          <button
            onClick={cancelRelink}
            className="px-4 py-2 text-xs font-medium text-white/70 hover:text-white rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleLocateFile}
            className="px-4 py-2 text-xs font-semibold text-black rounded-lg bg-gradient-to-r from-amber-400 to-amber-300 hover:brightness-110 shadow-lg shadow-amber-500/20 transition-all flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
              />
            </svg>
            Locate File...
          </button>
        </div>
      </div>
    </div>
  );
};

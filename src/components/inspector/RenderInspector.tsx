import React from 'react';
import { Download, Lock } from 'lucide-react';
import { useTrackStore } from '../../store/trackStore';

export const RenderInspector: React.FC = () => {
  const { track } = useTrackStore();

  return (
    <div className="space-y-4 select-none">
      <section className="space-y-2.5">
        <div className="flex items-center justify-between text-zinc-400 font-semibold text-[11px] uppercase tracking-wider">
          <div className="flex items-center space-x-1.5">
            <Download className="w-3.5 h-3.5 text-indigo-400" />
            <span>Master Export Settings</span>
          </div>
          <span className="text-[9px] bg-[#222734] text-zinc-400 px-1.5 py-0.5 rounded font-mono flex items-center gap-1">
            <Lock className="w-2.5 h-2.5" />
            Step 10
          </span>
        </div>

        <div className="bg-[#181d28] rounded-md p-2.5 border border-[#262c3a] space-y-3 text-[11px]">
          {/* Format Selection */}
          <div className="space-y-1">
            <span className="text-zinc-400">Audio Format</span>
            <div className="grid grid-cols-3 gap-1 text-[10px] font-mono">
              <span className="p-1 rounded bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 text-center font-medium">
                WAV (24-bit)
              </span>
              <span className="p-1 rounded bg-[#202636] text-zinc-400 text-center">
                MP3 (320k)
              </span>
              <span className="p-1 rounded bg-[#202636] text-zinc-400 text-center">
                FLAC
              </span>
            </div>
          </div>

          {/* Sample Rate */}
          <div className="space-y-1">
            <span className="text-zinc-400">Sample Rate</span>
            <div className="grid grid-cols-2 gap-1 text-[10px] font-mono">
              <span className="p-1 rounded bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 text-center">
                48,000 Hz (Pro)
              </span>
              <span className="p-1 rounded bg-[#202636] text-zinc-400 text-center">
                44,100 Hz (CD)
              </span>
            </div>
          </div>

          {/* Normalization */}
          <div className="pt-2 border-t border-[#232938] space-y-1">
            <div className="flex items-center justify-between text-zinc-300">
              <span>Loudness Target</span>
              <span className="font-mono text-emerald-400 text-[10px]">-14.0 LUFS</span>
            </div>
            <p className="text-[9px] text-zinc-500">
              Compliant with streaming standards (Spotify, YouTube, Apple Music).
            </p>
          </div>

          {/* Render Action Button */}
          <button
            disabled={!track}
            className="w-full mt-2 py-2 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-medium text-xs flex items-center justify-center space-x-1.5 transition-colors shadow-sm shadow-indigo-950 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Render Spatial Audio</span>
          </button>
        </div>
      </section>
    </div>
  );
};

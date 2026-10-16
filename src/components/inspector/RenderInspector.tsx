import React from 'react';
import { Download, Lock, Sparkles } from 'lucide-react';
import { useTrackStore } from '../../store/trackStore';

export const RenderInspector: React.FC = () => {
  const { track } = useTrackStore();

  return (
    <div className="space-y-4 select-none">
      <section className="space-y-2">
        <div className="flex items-center justify-between text-slate-400 font-bold text-[10px] uppercase tracking-wider px-1">
          <div className="flex items-center space-x-1.5">
            <Download className="w-3.5 h-3.5 text-indigo-400" />
            <span>Master Export Engine</span>
          </div>
          <span className="glass-pill px-2 py-0.5 rounded-full text-[9px] text-slate-400 font-mono flex items-center gap-1">
            <Lock className="w-2.5 h-2.5 text-amber-400" />
            Step 10
          </span>
        </div>

        <div className="glass-panel rounded-2xl p-3.5 space-y-3.5 text-[11px] shadow-md">
          {/* Format Selection */}
          <div className="space-y-1.5">
            <span className="text-slate-300 font-medium">Binaural Format</span>
            <div className="grid grid-cols-3 gap-1.5 text-[10px] font-mono">
              <span className="py-1.5 rounded-xl glass-pill text-cyan-300 border-cyan-400/40 text-center font-bold shadow-[0_0_8px_rgba(6,182,212,0.2)]">
                WAV 24-bit
              </span>
              <span className="py-1.5 rounded-xl glass-card text-slate-400 text-center">
                MP3 320k
              </span>
              <span className="py-1.5 rounded-xl glass-card text-slate-400 text-center">
                FLAC Lossless
              </span>
            </div>
          </div>

          {/* Sample Rate */}
          <div className="space-y-1.5">
            <span className="text-slate-300 font-medium">Output Sample Rate</span>
            <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
              <span className="py-1.5 rounded-xl glass-pill text-indigo-300 border-indigo-400/40 text-center font-bold">
                48,000 Hz (Pro)
              </span>
              <span className="py-1.5 rounded-xl glass-card text-slate-400 text-center">
                44,100 Hz (CD)
              </span>
            </div>
          </div>

          {/* Normalization */}
          <div className="pt-2 border-t border-white/[0.06] space-y-1.5">
            <div className="flex items-center justify-between text-slate-200 font-medium">
              <span>Integrated Loudness</span>
              <span className="font-mono tabular-nums text-emerald-400 text-[10px] font-bold">-14.0 LUFS</span>
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              Compliant with Apple Music Spatial Audio, YouTube, and Spotify standards.
            </p>
          </div>

          {/* Render Action Button */}
          <button
            disabled={!track}
            className="w-full mt-2 py-2.5 rounded-xl bg-indigo-600/90 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold text-xs flex items-center justify-center space-x-2 transition-all shadow-[0_4px_16px_rgba(99,102,241,0.4)] hover:shadow-[0_6px_20px_rgba(99,102,241,0.6)] cursor-pointer active:scale-95"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
            <span>Render Offline 8D Master</span>
          </button>
        </div>
      </section>
    </div>
  );
};

import React, { useEffect } from 'react';
import { Disc, X, Mail, Globe, Cpu, Radio, Sparkles, Layers, ShieldCheck, Heart } from 'lucide-react';
import { useWorkspaceStore } from '../store/workspaceStore';

export const AboutModal: React.FC = () => {
  const { aboutModalOpen, setAboutModalOpen } = useWorkspaceStore();

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && aboutModalOpen) {
        setAboutModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [aboutModalOpen, setAboutModalOpen]);

  if (!aboutModalOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-150"
      onClick={() => setAboutModalOpen(false)}
    >
      <div
        className="w-full max-w-lg glass-panel rounded-2xl border border-white/20 shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col relative text-zinc-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow decorative background elements */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-sky-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-white/[0.08] relative z-10">
          <div className="flex items-center space-x-2.5">
            <span className="glass-pill text-[10px] font-semibold text-sky-400 border border-sky-400/30 px-2 py-0.5 rounded-full uppercase tracking-wider">
              HaiCLOP Labs
            </span>
            <span className="text-[11px] text-zinc-400">System Information</span>
          </div>
          <button
            onClick={() => setAboutModalOpen(false)}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="px-6 py-5 space-y-5 overflow-y-auto max-h-[75vh] relative z-10">
          {/* Hero Branding */}
          <div className="flex items-center space-x-4">
            <div className="relative flex items-center justify-center">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-400/20 via-neutral-800 to-purple-500/20 border border-white/20 flex items-center justify-center shadow-lg shadow-sky-500/10">
                <Disc className="w-8 h-8 text-sky-400 animate-spin [animation-duration:12s]" />
              </div>
              <div className="absolute inset-0 rounded-2xl border border-sky-400/40 animate-pulse" />
            </div>
            <div>
              <div className="flex items-baseline space-x-2">
                <h2 className="text-xl font-bold tracking-tight text-white">Orbiter</h2>
                <span className="text-xs font-mono text-sky-400/90 font-medium">v0.1.0</span>
              </div>
              <p className="text-xs text-zinc-400 font-medium">
                8D Spatial Audio Digital Audio Workstation
              </p>
              <p className="text-[11px] text-zinc-500 font-medium">
                Engineered by <span className="text-zinc-300 font-semibold">HaiCLOP Labs</span>
              </p>
            </div>
          </div>

          {/* Creator & Lead Architect Card */}
          <div className="glass-card rounded-xl p-3.5 border border-white/10 space-y-2 bg-white/[0.02]">
            <div className="text-[10px] uppercase font-semibold tracking-wider text-sky-400 flex items-center space-x-1.5">
              <Sparkles className="w-3 h-3" />
              <span>Architect & Creator</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <div>
                <p className="text-sm font-semibold text-white">Arnav Srivastava</p>
                <p className="text-[11px] text-zinc-400">Lead Architect & Systems Engineer</p>
              </div>
              <div className="text-right">
                <span className="glass-pill text-[10px] text-purple-300 px-2 py-0.5 rounded-md font-medium border border-purple-400/30">
                  HaiCLOP Labs
                </span>
              </div>
            </div>
            <div className="pt-1 flex items-center space-x-4 text-[11px] text-zinc-300">
              <a
                href="mailto:haiclop6@gmail.com"
                className="flex items-center space-x-1.5 hover:text-sky-400 transition-colors"
                title="Send Email"
              >
                <Mail className="w-3.5 h-3.5 text-zinc-400" />
                <span className="font-mono">haiclop6@gmail.com</span>
              </a>
              <span className="text-zinc-600">•</span>
              <span className="flex items-center space-x-1 text-zinc-400">
                <Globe className="w-3.5 h-3.5" />
                <span>HaiCLOP Labs Research</span>
              </span>
            </div>
          </div>

          {/* Engine Highlights */}
          <div className="space-y-2">
            <span className="text-[10px] uppercase font-semibold tracking-wider text-zinc-400">
              Audio Engine & Architecture
            </span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="glass-card p-2.5 rounded-lg border border-white/[0.06] space-y-1">
                <div className="flex items-center space-x-1.5 text-sky-400 font-medium text-[11px]">
                  <Cpu className="w-3.5 h-3.5" />
                  <span>DSP Core</span>
                </div>
                <p className="text-[10.5px] text-zinc-400 leading-relaxed">
                  Real-time zero-allocation Rust engine (CPAL, Symphonia, Hound, mp3lame).
                </p>
              </div>

              <div className="glass-card p-2.5 rounded-lg border border-white/[0.06] space-y-1">
                <div className="flex items-center space-x-1.5 text-purple-400 font-medium text-[11px]">
                  <Radio className="w-3.5 h-3.5" />
                  <span>3D Psychoacoustics</span>
                </div>
                <p className="text-[10.5px] text-zinc-400 leading-relaxed">
                  Woodworth spherical ITD, pinna elevation biquad, and FDN-8 reverb tank.
                </p>
              </div>

              <div className="glass-card p-2.5 rounded-lg border border-white/[0.06] space-y-1">
                <div className="flex items-center space-x-1.5 text-emerald-400 font-medium text-[11px]">
                  <Layers className="w-3.5 h-3.5" />
                  <span>Neural Stems</span>
                </div>
                <p className="text-[10.5px] text-zinc-400 leading-relaxed">
                  Meta HT-Demucs v4 ONNX inference (DirectML / CoreML / CPU AVX2).
                </p>
              </div>

              <div className="glass-card p-2.5 rounded-lg border border-white/[0.06] space-y-1">
                <div className="flex items-center space-x-1.5 text-amber-400 font-medium text-[11px]">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Zero Telemetry</span>
                </div>
                <p className="text-[10.5px] text-zinc-400 leading-relaxed">
                  100% on-device processing. No analytics, tracking, or remote calls.
                </p>
              </div>
            </div>
          </div>

          {/* Open Source / MIT Notice */}
          <div className="text-[11px] text-zinc-500 pt-1 border-t border-white/[0.06] flex items-center justify-between">
            <span className="flex items-center space-x-1">
              <span>Released under the MIT License</span>
              <span>•</span>
              <span>Open Source</span>
            </span>
            <span className="flex items-center space-x-1 text-zinc-400">
              <span>Made with</span>
              <Heart className="w-3 h-3 text-rose-500 fill-rose-500 inline" />
              <span>at HaiCLOP Labs</span>
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-white/[0.08] bg-black/30 flex items-center justify-between text-xs relative z-10">
          <span className="text-[11px] font-mono text-zinc-500">
            © {new Date().getFullYear()} HaiCLOP Labs. All rights reserved.
          </span>
          <button
            onClick={() => setAboutModalOpen(false)}
            className="px-4 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 active:bg-white/10 border border-white/15 text-white text-[11px] font-medium transition-all cursor-pointer shadow-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

import React, { useEffect, useRef } from 'react';
import {
  Layers,
  Download,
  Play,
  Pause,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Cpu,
  FolderOpen,
  Music2,
  Radio,
  FileCheck,
} from 'lucide-react';
import { useStemsStore } from '../../store/stemsStore';
import { useTrackStore } from '../../store/trackStore';
import type { SeparatedStemInfo } from '../../types/stems';

const STEM_CONFIGS: Record<
  string,
  { label: string; color: string; bgGlow: string; border: string; barColor: string }
> = {
  vocals: {
    label: 'Vocals',
    color: 'text-purple-400',
    bgGlow: 'rgba(168, 85, 247, 0.12)',
    border: 'border-purple-500/30 hover:border-purple-500/60',
    barColor: '#a855f7',
  },
  drums: {
    label: 'Drums',
    color: 'text-amber-400',
    bgGlow: 'rgba(245, 158, 11, 0.12)',
    border: 'border-amber-500/30 hover:border-amber-500/60',
    barColor: '#f59e0b',
  },
  bass: {
    label: 'Bass',
    color: 'text-emerald-400',
    bgGlow: 'rgba(16, 185, 129, 0.12)',
    border: 'border-emerald-500/30 hover:border-emerald-500/60',
    barColor: '#10b981',
  },
  other: {
    label: 'Other / Instruments',
    color: 'text-cyan-400',
    bgGlow: 'rgba(6, 182, 212, 0.12)',
    border: 'border-cyan-500/30 hover:border-cyan-500/60',
    barColor: '#06b6d4',
  },
};

interface StemCardProps {
  stem: SeparatedStemInfo;
  isAuditioning: boolean;
  onToggleAudition: () => void;
  onSendToStudio: () => void;
}

const StemCard: React.FC<StemCardProps> = ({
  stem,
  isAuditioning,
  onToggleAudition,
  onSendToStudio,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const config = STEM_CONFIGS[stem.id] || {
    label: stem.name,
    color: 'text-indigo-400',
    bgGlow: 'rgba(99, 102, 241, 0.12)',
    border: 'border-indigo-500/30',
    barColor: '#6366f1',
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const peaks = stem.peaks;
    if (!peaks || peaks.length === 0) return;

    const numBars = Math.min(peaks.length, 120);
    const step = peaks.length / numBars;
    const barWidth = Math.max(1.5, width / numBars - 1.5);

    ctx.fillStyle = config.barColor;

    for (let i = 0; i < numBars; i++) {
      const idx = Math.floor(i * step);
      const val = Math.min(1.0, peaks[idx] || 0.0);
      const barHeight = Math.max(2, val * (height * 0.85));
      const x = i * (barWidth + 1.5);
      const y = (height - barHeight) / 2;

      ctx.globalAlpha = isAuditioning ? 0.95 : 0.6;
      ctx.fillRect(x, y, barWidth, barHeight);
    }
  }, [stem.peaks, config.barColor, isAuditioning]);

  return (
    <div
      className={`glass-card rounded-2xl p-5 border transition-all duration-300 flex flex-col justify-between relative overflow-hidden group ${config.border}`}
      style={{
        boxShadow: isAuditioning ? `0 0 30px ${config.bgGlow}` : undefined,
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2.5">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: config.barColor }}
          />
          <span className="font-semibold text-sm tracking-wide text-slate-100">
            {config.label}
          </span>
        </div>
        <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/5 border border-white/5">
          24-bit WAV
        </span>
      </div>

      {/* Mini Waveform Display */}
      <div className="my-2 py-2 px-3 rounded-xl bg-black/40 border border-white/5 relative flex items-center justify-center">
        <canvas
          ref={canvasRef}
          width={320}
          height={60}
          className="w-full h-14 block"
        />
        {isAuditioning && (
          <div className="absolute top-2 right-2 flex items-center space-x-1 px-1.5 py-0.5 rounded bg-black/70 text-[9px] font-mono text-emerald-400 border border-emerald-500/30">
            <Radio className="w-2.5 h-2.5 animate-pulse" />
            <span>PLAYING</span>
          </div>
        )}
      </div>

      <div className="text-[11px] font-mono text-slate-400 truncate mb-4" title={stem.file_path}>
        {stem.file_path.split(/[/\\]/).pop()}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center space-x-2.5">
        <button
          onClick={onToggleAudition}
          className={`flex-1 py-2 px-3 rounded-xl font-medium text-xs flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
            isAuditioning
              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30'
              : 'glass-button text-slate-200 hover:text-white border-white/10'
          }`}
        >
          {isAuditioning ? (
            <>
              <Pause className="w-3.5 h-3.5 fill-current" />
              <span>Pause</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Audition</span>
            </>
          )}
        </button>

        <button
          onClick={onSendToStudio}
          className="flex-1 py-2 px-3 rounded-xl font-medium text-xs flex items-center justify-center space-x-1.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white shadow-md shadow-indigo-500/20 hover:shadow-indigo-500/40 transition-all cursor-pointer"
        >
          <span>Send to 8D</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export const StemsView: React.FC = () => {
  const { track, loaded, openAndLoadTrack } = useTrackStore();
  const {
    modelStatus,
    isCheckingModel,
    isDownloadingModel,
    downloadProgress,
    isSeparating,
    separationProgress,
    separatedStems,
    elapsedSec,
    auditionStemId,
    auditionIsPlaying,
    error,
    checkModelStatus,
    downloadModel,
    cancelModelDownload,
    startSeparation,
    cancelSeparation,
    toggleAudition,
    loadStemIntoStudio,
    clearError,
  } = useStemsStore();

  useEffect(() => {
    checkModelStatus();
  }, [checkModelStatus]);

  const isModelReady = modelStatus?.is_downloaded === true;

  return (
    <div className="flex-1 flex flex-col p-6 overflow-y-auto space-y-6">
      {/* Header with Title and Hardware Provider Badge */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/5">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-white flex items-center space-x-2">
                <span>Demucs v4 Stem Separation</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-mono font-normal border border-purple-500/30">
                  HT-Demucs FP16
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 font-mono font-normal border border-sky-500/30">
                  HaiCLOP Neural Audio
                </span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Decompose mix into Vocals, Drums, Bass, and Other with 25% overlap-add reconstruction.
              </p>
            </div>
          </div>
        </div>

        {/* Hardware Execution Provider Badge */}
        <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl glass-card border-white/10 text-xs">
          <Cpu className="w-3.5 h-3.5 text-indigo-400" />
          <span className="text-slate-400">Execution Backend:</span>
          <span className="font-mono text-indigo-300 font-medium">
            {modelStatus?.execution_provider || 'Detecting...'}
          </span>
        </div>
      </div>

      {/* Global Error Banner */}
      {error && (
        <div className="px-4 py-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs flex items-center justify-between shadow-lg shadow-rose-950/20">
          <div className="flex items-center space-x-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={clearError}
            className="text-rose-400 hover:text-rose-200 text-xs font-mono underline ml-4 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Model Download Banner (First-time setup) */}
      {!isModelReady && (
        <div className="glass-card rounded-2xl p-6 border border-indigo-500/30 bg-gradient-to-br from-indigo-950/30 via-slate-900/60 to-purple-950/30 relative overflow-hidden">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center space-x-2 text-indigo-300 text-sm font-semibold">
                <Download className="w-4 h-4" />
                <span>Demucs v4 Neural Weights Required</span>
              </div>
              <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
                To isolate stems on device, download Meta's HT-Demucs v4 model (~166 MB).
                Downloaded directly from Hugging Face with SHA-256 verification and cached locally.
              </p>
            </div>

            <div>
              {isDownloadingModel ? (
                <button
                  onClick={cancelModelDownload}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-rose-300 bg-rose-500/20 border border-rose-500/30 hover:bg-rose-500/30 transition-all cursor-pointer"
                >
                  Cancel Download
                </button>
              ) : (
                <button
                  onClick={downloadModel}
                  disabled={isCheckingModel}
                  className="px-5 py-2.5 rounded-xl text-xs font-medium bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/25 transition-all flex items-center space-x-2 cursor-pointer disabled:opacity-50"
                >
                  {isCheckingModel ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  <span>Download Model (166 MB)</span>
                </button>
              )}
            </div>
          </div>

          {/* Download Progress Bar */}
          {isDownloadingModel && downloadProgress && (
            <div className="mt-5 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono text-slate-300">
                <span className="capitalize">{downloadProgress.status}...</span>
                <span>
                  {Math.round(downloadProgress.percentage * 100)}% (
                  {(downloadProgress.downloaded_bytes / (1024 * 1024)).toFixed(1)} /{' '}
                  {(downloadProgress.total_bytes / (1024 * 1024)).toFixed(1)} MB)
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-black/50 overflow-hidden border border-white/5">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-150 ease-out"
                  style={{ width: `${Math.round(downloadProgress.percentage * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Model Ready Status Indicator */}
      {isModelReady && (
        <div className="flex items-center justify-between px-4 py-2.5 rounded-xl glass-card border-emerald-500/30 bg-emerald-950/20 text-xs">
          <div className="flex items-center space-x-2 text-emerald-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="font-medium">HT-Demucs v4 Neural Model Verified & Ready</span>
          </div>
          <span className="text-[11px] font-mono text-slate-400 truncate max-w-sm" title={modelStatus.model_path}>
            {modelStatus.model_path}
          </span>
        </div>
      )}

      {/* Source Track & Separation Trigger Section */}
      <div className="glass-card rounded-2xl p-6 border-white/10 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
              Active Audio Source
            </span>
            {loaded && track ? (
              <div className="flex items-center space-x-3 mt-1">
                <Music2 className="w-5 h-5 text-indigo-400" />
                <div>
                  <div className="font-semibold text-sm text-slate-100">{track.file_name}</div>
                  <div className="text-[11px] font-mono text-slate-400">
                    {track.sample_rate} Hz • {track.channels} ch • {track.duration.toFixed(1)}s •{' '}
                    {track.format_name}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-slate-400 italic mt-1">
                No audio track loaded. Open a file to begin separation.
              </div>
            )}
          </div>

          <div className="flex items-center space-x-3">
            {!loaded ? (
              <button
                onClick={openAndLoadTrack}
                className="px-4 py-2 rounded-xl text-xs font-medium glass-button text-slate-200 hover:text-white flex items-center space-x-2 cursor-pointer"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>Open Audio File</span>
              </button>
            ) : isSeparating ? (
              <button
                onClick={cancelSeparation}
                className="px-5 py-2.5 rounded-xl text-xs font-medium text-rose-300 bg-rose-500/20 border border-rose-500/30 hover:bg-rose-500/30 transition-all cursor-pointer"
              >
                Cancel Separation
              </button>
            ) : (
              <button
                onClick={() => startSeparation()}
                disabled={!isModelReady}
                className="px-6 py-2.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white shadow-lg shadow-purple-500/25 transition-all flex items-center space-x-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Layers className="w-4 h-4" />
                <span>Separate into 4 Stems</span>
              </button>
            )}
          </div>
        </div>

        {/* Live Separation Progress Bar */}
        {isSeparating && separationProgress && (
          <div className="pt-4 border-t border-white/5 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2">
                <Loader2 className="w-3.5 h-3.5 text-purple-400 animate-spin" />
                <span className="font-medium text-purple-300 uppercase tracking-wide">
                  {separationProgress.status}
                </span>
                <span className="text-slate-400 font-mono">
                  (Chunk {separationProgress.current_chunk} of {separationProgress.total_chunks})
                </span>
              </div>
              <div className="font-mono text-slate-300 space-x-3">
                <span>{Math.round(separationProgress.percentage * 100)}%</span>
                <span>Elapsed: {separationProgress.elapsed_sec.toFixed(1)}s</span>
                {separationProgress.eta_sec > 0 && (
                  <span className="text-indigo-400">
                    ETA: {separationProgress.eta_sec.toFixed(0)}s
                  </span>
                )}
              </div>
            </div>

            <div className="w-full h-2 rounded-full bg-black/60 overflow-hidden border border-white/5">
              <div
                className="h-full bg-gradient-to-r from-purple-500 via-indigo-500 to-cyan-400 transition-all duration-200"
                style={{ width: `${Math.round(separationProgress.percentage * 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* 4 Stem Result Cards */}
      {separatedStems.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white tracking-wide flex items-center space-x-2">
              <FileCheck className="w-4 h-4 text-emerald-400" />
              <span>Isolated Stems ({separatedStems.length})</span>
            </h2>
            <span className="text-xs font-mono text-slate-400">
              Completed in {elapsedSec.toFixed(1)}s • 24-bit 44.1kHz Lossless
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {separatedStems.map((stem) => (
              <StemCard
                key={stem.id}
                stem={stem}
                isAuditioning={auditionStemId === stem.id && auditionIsPlaying}
                onToggleAudition={() => toggleAudition(stem)}
                onSendToStudio={() => loadStemIntoStudio(stem)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

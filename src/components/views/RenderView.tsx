import React, { useState, useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke, isTauri } from '@tauri-apps/api/core';
import {
  Download,
  FolderOpen,
  CheckCircle2,
  AlertTriangle,
  StopCircle,
  Sparkles,
  ShieldCheck,
  Music,
} from 'lucide-react';
import { useTrackStore } from '../../store/trackStore';
import { useTimelineStore } from '../../store/timelineStore';
import type {
  ExportFormat,
  ExportProgress,
  ExportSettings,
  Mp3Bitrate,
  SampleRateOption,
  WavBitDepth,
} from '../../types/export';

export const RenderView: React.FC = () => {
  const { loaded, track, duration, spatialParams, azimuth, balance, eqParams, reverbParams, dynamicsParams } =
    useTrackStore();
  const { timeline } = useTimelineStore();

  // Export Configuration State
  const [formatType, setFormatType] = useState<'wav' | 'mp3'>('wav');
  const [wavBitDepth, setWavBitDepth] = useState<WavBitDepth>('pcm24');
  const [mp3Bitrate, setMp3Bitrate] = useState<Mp3Bitrate>('kbps320');
  const [sampleRateOption, setSampleRateOption] = useState<SampleRateOption>('match_source');
  const [normalize, setNormalize] = useState<boolean>(true);
  const [destinationPath, setDestinationPath] = useState<string>('');

  // Live Export Progress State
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportFinished, setExportFinished] = useState<boolean>(false);

  // Set default destination path when track loads or format changes
  useEffect(() => {
    if (track?.file_path) {
      const ext = formatType === 'mp3' ? 'mp3' : 'wav';
      const lastDotIdx = track.file_path.lastIndexOf('.');
      const base = lastDotIdx !== -1 ? track.file_path.substring(0, lastDotIdx) : track.file_path;
      setDestinationPath(`${base}_8d.${ext}`);
    }
  }, [track, formatType]);

  // Listen to Tauri offline export progress events
  useEffect(() => {
    if (!isTauri()) return;

    let unlistenFn: (() => void) | null = null;

    listen<ExportProgress>('export-progress', (event) => {
      const p = event.payload;
      setProgress(p);

      if (p.status === 'rendering' || p.status === 'encoding') {
        setIsExporting(true);
        setExportError(null);
      } else if (p.status === 'finished') {
        setIsExporting(false);
        setExportFinished(true);
        setExportError(null);
      } else if (p.status === 'cancelled') {
        setIsExporting(false);
      } else if (p.status === 'error') {
        setIsExporting(false);
        setExportError(p.error || 'Unknown offline export error');
      }
    }).then((unlisten) => {
      unlistenFn = unlisten;
    });

    return () => {
      if (unlistenFn) unlistenFn();
    };
  }, []);

  const handleSelectDestination = async () => {
    if (!isTauri()) return;
    try {
      const chosen = await invoke<string | null>('select_export_destination', {
        formatType,
      });
      if (chosen) {
        setDestinationPath(chosen);
      }
    } catch (err) {
      console.error('Failed to pick destination path:', err);
    }
  };

  const handleStartExport = async () => {
    if (!loaded || !track) {
      setExportError('Please load an audio track first.');
      return;
    }
    if (!destinationPath.trim()) {
      setExportError('Please specify a destination file path.');
      return;
    }

    setExportError(null);
    setExportFinished(false);
    setIsExporting(true);
    setProgress({
      progress: 0,
      elapsed_sec: 0,
      eta_sec: 0,
      current_frame: 0,
      total_frames: 0,
      status: 'rendering',
      error: null,
    });

    const format: ExportFormat =
      formatType === 'wav'
        ? { type: 'wav', bit_depth: wavBitDepth }
        : { type: 'mp3', bitrate: mp3Bitrate };

    const settings: ExportSettings = {
      destination_path: destinationPath,
      format,
      sample_rate_option: sampleRateOption,
      normalize,
    };

    const panLane = timeline?.lanes.find((l) => l.id === 'pan');
    const isPanAutomated = Boolean(panLane && panLane.enabled && panLane.keyframes.length > 0);

    const dspState = {
      spatial: spatialParams,
      manual_azimuth: isPanAutomated ? null : azimuth,
      balance,
      eq: eqParams,
      reverb: reverbParams,
      dynamics: dynamicsParams,
      normalize_gain: track.normalize_gain ?? 1.0,
    };

    const timelineState = timeline ?? {
      lanes: [],
      loop_enabled: false,
      snap_to_grid: true,
      grid_interval: 0.25,
    };

    try {
      await invoke('start_export', {
        settings,
        dspState,
        timeline: timelineState,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setIsExporting(false);
      setExportError(msg);
    }
  };

  const handleCancelExport = async () => {
    try {
      await invoke('cancel_export');
      setIsExporting(false);
    } catch (err) {
      console.error('Failed to cancel export:', err);
    }
  };

  // Calculations for size estimate
  const estimatedWavBytesPerSample = wavBitDepth === 'pcm16' ? 2 : wavBitDepth === 'pcm24' ? 3 : 4;
  const estimatedWavSizeMb = (
    (duration * (track?.sample_rate || 48000) * 2 * estimatedWavBytesPerSample) /
    (1024 * 1024)
  ).toFixed(1);

  const mp3Kbps =
    mp3Bitrate === 'kbps128' ? 128 : mp3Bitrate === 'kbps192' ? 192 : mp3Bitrate === 'kbps256' ? 256 : 320;
  const estimatedMp3SizeMb = ((duration * mp3Kbps * 1000) / (8 * 1024 * 1024)).toFixed(1);

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = (sec % 60).toFixed(1);
    return `${mins}:${Number(secs) < 10 ? '0' : ''}${secs}s`;
  };

  return (
    <div className="flex-1 flex flex-col overflow-y-auto bg-transparent select-none p-4 space-y-4">
      {/* Header Bar */}
      <div className="glass-panel p-4 rounded-2xl flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500/20 to-indigo-500/30 border border-sky-400/30 flex items-center justify-center text-sky-400">
            <Download className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-white tracking-tight">Offline Master Exporter</h2>
              <span className="glass-pill px-2 py-0.5 rounded text-[10px] text-emerald-400 border border-emerald-500/30 flex items-center gap-1 font-mono">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                Bit-Exact DSP Parity
              </span>
            </div>
            <p className="text-xs text-white/50">
              Zero-drift offline rendering evaluated per-sample through the unified SpatialDspChain.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="glass-pill px-2.5 py-1 rounded-md text-white/60">5ms Limiter Tail Flush</span>
          <span className="glass-pill px-2.5 py-1 rounded-md text-white/60">64-bit Internal Buses</span>
        </div>
      </div>

      {!loaded ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12 glass-panel rounded-2xl text-center">
          <div className="w-14 h-14 rounded-2xl glass-card flex items-center justify-center text-white/40 mb-3">
            <Music className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-white mb-1">No Audio Track Loaded</h3>
          <p className="text-xs text-white/50 max-w-sm mb-4">
            Load an audio track into Orbiter before configuring offline export.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left Column: Format, Quality & DSP Options (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            {/* Format Selection Card */}
            <div className="glass-panel p-4 rounded-2xl space-y-3.5">
              <span className="text-[11px] font-semibold text-white/80 uppercase tracking-wider block">
                Encoding Container & Codec
              </span>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setFormatType('wav')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    formatType === 'wav'
                      ? 'bg-white/15 border-sky-400/50 shadow-lg shadow-sky-500/10'
                      : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.06]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-xs text-white">WAV Uncompressed</span>
                    {formatType === 'wav' && <span className="w-2 h-2 rounded-full bg-sky-400" />}
                  </div>
                  <span className="text-[10px] text-white/50 block">Linear PCM lossless master (via Hound)</span>
                </button>

                <button
                  onClick={() => setFormatType('mp3')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    formatType === 'mp3'
                      ? 'bg-white/15 border-sky-400/50 shadow-lg shadow-sky-500/10'
                      : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.06]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-xs text-white">MP3 Compressed</span>
                    {formatType === 'mp3' && <span className="w-2 h-2 rounded-full bg-sky-400" />}
                  </div>
                  <span className="text-[10px] text-white/50 block">LAME CBR joint-stereo audio file</span>
                </button>
              </div>

              {/* Bit Depth / Bitrate Selectors */}
              {formatType === 'wav' ? (
                <div className="space-y-1.5 pt-1">
                  <span className="text-[10px] font-medium text-white/60">WAV Bit Depth Resolution:</span>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        { id: 'pcm16', label: '16-bit PCM', sub: 'CD Standard' },
                        { id: 'pcm24', label: '24-bit PCM', sub: 'Studio Master' },
                        { id: 'float32', label: '32-bit Float', sub: 'True Archival' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => setWavBitDepth(opt.id)}
                        className={`p-2 rounded-lg border text-center transition-all cursor-pointer ${
                          wavBitDepth === opt.id
                            ? 'bg-sky-500/20 border-sky-400/50 text-white font-medium'
                            : 'bg-white/[0.02] border-white/10 text-white/60 hover:text-white hover:bg-white/[0.05]'
                        }`}
                      >
                        <div className="text-xs">{opt.label}</div>
                        <div className="text-[9px] text-white/40">{opt.sub}</div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5 pt-1">
                  <span className="text-[10px] font-medium text-white/60">MP3 Bitrate (CBR):</span>
                  <div className="grid grid-cols-4 gap-2">
                    {(
                      [
                        { id: 'kbps128', label: '128k' },
                        { id: 'kbps192', label: '192k' },
                        { id: 'kbps256', label: '256k' },
                        { id: 'kbps320', label: '320k (Max)' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => setMp3Bitrate(opt.id)}
                        className={`py-2 rounded-lg border text-center transition-all cursor-pointer ${
                          mp3Bitrate === opt.id
                            ? 'bg-sky-500/20 border-sky-400/50 text-white font-medium'
                            : 'bg-white/[0.02] border-white/10 text-white/60 hover:text-white hover:bg-white/[0.05]'
                        }`}
                      >
                        <div className="text-xs">{opt.label}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Sample Rate & Audio Conditioning Card */}
            <div className="glass-panel p-4 rounded-2xl space-y-3.5">
              <span className="text-[11px] font-semibold text-white/80 uppercase tracking-wider block">
                Sample Rate & Mastering Options
              </span>

              <div className="grid grid-cols-4 gap-2">
                {(
                  [
                    { id: 'match_source', label: 'Match Source', sub: `${track ? track.sample_rate / 1000 : 48} kHz` },
                    { id: 'hz44100', label: '44.1 kHz', sub: 'CD Audio' },
                    { id: 'hz48000', label: '48.0 kHz', sub: 'Video / Broadcast' },
                    { id: 'hz96000', label: '96.0 kHz', sub: 'Hi-Res' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setSampleRateOption(opt.id)}
                    className={`p-2 rounded-lg border text-center transition-all cursor-pointer ${
                      sampleRateOption === opt.id
                        ? 'bg-sky-500/20 border-sky-400/50 text-white font-medium'
                        : 'bg-white/[0.02] border-white/10 text-white/60 hover:text-white hover:bg-white/[0.05]'
                    }`}
                  >
                    <div className="text-xs">{opt.label}</div>
                    <div className="text-[9px] text-white/40">{opt.sub}</div>
                  </button>
                ))}
              </div>

              {/* Toggles */}
              <div className="pt-2 border-t border-white/[0.06] space-y-2">
                <label className="flex items-center justify-between p-2 rounded-lg hover:bg-white/[0.04] transition-colors cursor-pointer">
                  <div>
                    <span className="text-xs text-white/90 font-medium block">
                      Master Loudness Normalization
                    </span>
                    <span className="text-[10px] text-white/50 block">
                      Target decoded track loudness to -1.0 dBFS before panner/EQ cascade
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={normalize}
                    onChange={(e) => setNormalize(e.target.checked)}
                    className="w-4 h-4 rounded border-white/30 bg-black/40 text-sky-500 focus:ring-0"
                  />
                </label>

                <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    <div>
                      <span className="text-xs text-emerald-300 font-medium block">
                        Brickwall Limiter 5ms Lookahead Flush
                      </span>
                      <span className="text-[10px] text-emerald-200/60 block">
                        Zero latency shift; audio tail fully flushed with silence padding
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400 font-semibold uppercase">Active</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Destination, Telemetry & Export Console (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            {/* Destination Picker */}
            <div className="glass-panel p-4 rounded-2xl space-y-2.5">
              <span className="text-[11px] font-semibold text-white/80 uppercase tracking-wider block">
                Destination File
              </span>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={destinationPath}
                  onChange={(e) => setDestinationPath(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs font-mono text-white/90 focus:outline-none focus:border-sky-400/50"
                  placeholder="C:/Music/output.wav"
                />
                <button
                  onClick={handleSelectDestination}
                  disabled={isExporting}
                  className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-xs font-medium text-white transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>Browse...</span>
                </button>
              </div>
            </div>

            {/* File Telemetry Card */}
            <div className="glass-panel p-4 rounded-2xl space-y-2">
              <span className="text-[11px] font-semibold text-white/80 uppercase tracking-wider block">
                Output Specs
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                  <span className="text-white/40 block text-[10px]">Estimated Size</span>
                  <span className="text-sky-400 font-semibold">
                    ~{formatType === 'wav' ? estimatedWavSizeMb : estimatedMp3SizeMb} MB
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                  <span className="text-white/40 block text-[10px]">Track Duration</span>
                  <span className="text-white/90 font-semibold">{formatSeconds(duration)}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                  <span className="text-white/40 block text-[10px]">Channels</span>
                  <span className="text-white/90 font-semibold">2 (Binaural Stereo)</span>
                </div>
                <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                  <span className="text-white/40 block text-[10px]">DSP Engine Mode</span>
                  <span className="text-emerald-400 font-semibold">Max CPU Non-Realtime</span>
                </div>
              </div>
            </div>

            {/* Render Trigger & Live Progress Card */}
            <div className="glass-panel p-5 rounded-2xl space-y-4">
              {exportError && (
                <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{exportError}</span>
                </div>
              )}

              {exportFinished && !isExporting && (
                <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Master audio file exported successfully!</span>
                  </div>
                </div>
              )}

              {isExporting ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-sky-400 font-semibold animate-pulse">Rendering 8D Audio...</span>
                    <span className="text-white font-bold">{((progress?.progress || 0) * 100).toFixed(1)}%</span>
                  </div>

                  {/* Liquid Glass Progress Bar */}
                  <div className="relative h-3 w-full bg-black/60 rounded-full overflow-hidden p-0.5 border border-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-sky-500 via-indigo-500 to-emerald-400 transition-all duration-100 relative shadow-[0_0_12px_rgba(56,189,248,0.5)]"
                      style={{ width: `${Math.max(2, (progress?.progress || 0) * 100)}%` }}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-[10px] font-mono text-white/50 pt-1">
                    <div>
                      <span>Elapsed: </span>
                      <span className="text-white">{progress ? formatSeconds(progress.elapsed_sec) : '0:00'}</span>
                    </div>
                    <div className="text-center">
                      <span>ETA: </span>
                      <span className="text-amber-300">
                        {progress && progress.eta_sec > 0 ? formatSeconds(progress.eta_sec) : 'Calculating...'}
                      </span>
                    </div>
                    <div className="text-right">
                      <span>Frames: </span>
                      <span className="text-white">
                        {progress ? `${Math.floor(progress.current_frame / 1000)}k` : '0k'}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={handleCancelExport}
                    className="w-full mt-2 py-2.5 rounded-xl border border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <StopCircle className="w-4 h-4" />
                    Cancel Render
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleStartExport}
                  disabled={!loaded}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-500 hover:brightness-110 active:scale-[0.98] disabled:opacity-40 disabled:hover:brightness-100 disabled:active:scale-100 text-white font-semibold text-xs tracking-wide shadow-xl shadow-sky-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  Render Master Audio ({formatType.toUpperCase()})
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

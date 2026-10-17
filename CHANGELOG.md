# Changelog

All notable changes to the Orbiter project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.0] - 2026-10-17

### Initial Open-Source Release

Orbiter v0.1.0 represents the complete culmination of an 11-step plan-first development lifecycle, creating an open-source, zero-latency 8D and 3D spatial audio workstation with neural stem decomposition.

### ✨ Added
- **Core Decoding & Peak Engine (Step 1)**:
  - Multi-format audio decoding via `symphonia` (MP3, WAV, FLAC, OGG, M4A, AAC) directly into interleaved 32-bit floating-point buffers.
  - Dual-channel (L/R) waveform peak extraction with 2,000 bins for responsive UI visualization.
- **Real-Time 8D Binaural Panner (Step 2)**:
  - Continuous spherical orbital trajectory simulation using Woodworth interaural time delay ($\pm 650\,\mu\text{s}$ ITD) and frequency-dependent head shadow attenuation (ILD).
  - Lock-free, zero-allocation audio callback powered by `cpal` with real-time atomic parameter publishing.
  - Intelligent audio device selector prioritizing connected headphones/IEMs over laptop speakers.
- **4-Band Studio Parametric EQ Rack (Step 3)**:
  - Cascaded Robert Bristow-Johnson biquad filters: Low-Cut HPF (20–500 Hz), High-Cut LPF (2–20 kHz), Low-Shelf Bass ($\pm 12\text{ dB}$ at 100 Hz), High-Shelf Treble ($\pm 12\text{ dB}$ at 10 kHz), and master volume.
  - 128-sample dual-state crossfading ensuring click-free filter coefficient updates.
- **3D Spatial Acoustic Cues (Step 4)**:
  - Vertical pinna elevation filter ($\pm 4.0\text{ dB}$ at 8 kHz) modeling vertical human spectral perception.
  - Inverse-square distance attenuation coupled with atmospheric air absorption 1-pole high-cut filter.
- **Physical FDN-8 Environmental Reverb (Step 5)**:
  - 8-delay-line Feedback Delay Network using mutually prime delay lengths and an orthogonal Hadamard mixing matrix.
  - High-frequency absorption per line and automatic distance-to-wet tie scaling.
  - 5-tab modular workspace UI: **Edit**, **Graph**, **Spatial**, **Effects**, and **Render**.
- **Master Dynamics Rack & Limiter (Step 6)**:
  - 5.0ms lookahead brickwall peak limiter with zero overshoots and 1-pole exponential release ($150\text{ ms}$).
  - $C^1$ continuous soft-clipper safety ceiling at 0.0 dBFS.
  - Input loudness auto-normalization targeting $-1.0\text{ dBFS}$ peak headroom.
- **Timeline & Bézier Automation Engine (Step 7)**:
  - Multi-lane automation engine driving Azimuth, Elevation, Distance, Reverb Amount, and Volume per audio sample.
  - 256-entry Newton-Raphson cubic Bézier LUTs evaluated in $O(1)$ time in the native audio thread.
  - High-DPI interactive graph editor with draggable keyframes, tangent handles, magnetic snapping, and 5 built-in orbit presets (Circle, Ellipse, Figure-8, Spiral In/Out, Vertical Pendulum).
- **True 3D Spatial Hologram & Hardware Knob Dials (Step 8)**:
  - Interactive Three.js / React Three Fiber 3D soundstage with camera presets (3D, Top, Front, Side).
  - Raycasted spherical draggable source dot with continuous atomic parameter updates.
  - Custom Blender-modeled 3D hardware knobs for Azimuth/Pan and L/R Master Balance with brushed metal texture and dynamic LED indicator rings.
- **Project Persistence & Bit-Exact Offline Export (Steps 9 & 10)**:
  - Complete session persistence using `.orb8d` JSON schema capturing file references, all DSP states, keyframe curves, and UI view state.
  - Non-destructive relink modal for missing or moved audio assets.
  - Offline rendering engine (`SpatialDspChain`) guaranteeing bit-exact mathematical parity between live audio playback and non-realtime file export.
  - Multi-format rendering to 16/24-bit PCM WAV and 128–320 kbps MP3 with live progress, elapsed time, and ETA.
- **Demucs v4 Neural Stem Separation (Step 11)**:
  - Integrated Meta HT-Demucs v4 FP16 ONNX model execution for extracting Vocals, Drums, Bass, and Other.
  - On-first-use model download from Hugging Face with streaming SHA-256 integrity validation.
  - 25% overlap-add (OLA) chunked inference with linear crossfade proven click-free ($<10^{-5}$ error).
  - Per-stem audition mini-player and 1-click "Send to 8D" studio handoff hot-swapping into the 3D spatial editor.
- **Open-Source Release Readiness (Step 12)**:
  - Cross-platform CI matrix across Windows, macOS, and Linux running all 38 automated unit tests.
  - Automated tag-based release packaging generating `.msi`, `.dmg`, and `.AppImage` installers with Tauri updater support.
  - CONTRIBUTING guide emphasizing the plan-first engineering methodology.
  - Zero-telemetry and local processing privacy commitment.

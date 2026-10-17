# Privacy & Zero-Telemetry Disclosure

**Orbiter** is designed and built on a strict privacy-first foundation. We believe creative audio tools should operate exclusively on your machine without monitoring your activity, listening to your audio, or phoning home.

---

## 🛡️ Core Principles

### 1. Zero Tracking & Zero Analytics
- **No Analytics SDKs**: Orbiter contains **no** tracking libraries, analytics scripts, crash report uploaders, or telemetry SDKs (e.g., Google Analytics, Sentry, Mixpanel, Segment).
- **No Fingerprinting**: Orbiter does not generate or transmit user IDs, device fingerprints, or usage metrics.

### 2. 100% Local On-Device Processing
- **Audio Processing**: Every DSP stage (Binaural Panner, 3D Elevation, Distance Attenuation, FDN Reverb, 4-Band EQ, Lookahead Limiter) executes strictly in local CPU memory on the native real-time audio thread.
- **Project Files**: Your `.orb8d` project files and offline rendered WAV/MP3 files are stored solely on your local filesystem.
- **Neural Inference**: Demucs stem separation runs 100% locally on your device via ONNX Runtime (using multi-threaded AVX2 and hardware acceleration where available). No audio samples or spectrograms are ever transmitted to any remote server or cloud service.

### 3. Network Boundaries
Orbiter makes **zero background network calls**, with exactly **one transparent exception**:
- **Demucs Model Download (Optional, User-Triggered)**:
  - If you choose to use the Stem Separation feature in the **Stems** tab, Orbiter prompts you to download Meta's open-source `htdemucs_fp16weights.onnx` neural model (~166 MB) from the public Hugging Face CDN (`https://huggingface.co/StemSplitio/htdemucs-onnx`).
  - This download occurs **only** when you explicitly click the "Download Model" button.
  - The downloaded weights are cryptographically verified against a strict SHA-256 hash (`d05c269d0178d2a72ad484b10b11dd370193fc923201c3b27a99f848745db70a`) before being committed to your local cache (`%LOCALAPPDATA%\orbiter\models` on Windows, `~/.local/share/orbiter/models` on Linux, `~/Library/Application Support/orbiter/models` on macOS).
  - No personal data or user credentials are sent with this request.

### 4. Open-Source Verification
Because Orbiter is fully open source under the MIT License, our complete source code (both the Tauri/Rust backend and the React/TypeScript frontend) is publicly auditable at [github.com/HaiCLOP/Orbiter](https://github.com/HaiCLOP/Orbiter).

If you have any questions regarding privacy or network security, please open a public discussion on GitHub.

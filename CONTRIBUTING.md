# Contributing to Orbiter

Thank you for your interest in contributing to **Orbiter**! 

Orbiter is a high-performance, real-time 8D and 3D spatial audio workstation built with **Rust**, **Tauri 2**, and **React 19**. Because audio software requires sub-millisecond precision, real-time thread safety, and bit-exact reproducibility, this project adheres to a strict engineering discipline.

---

## 🏛️ The Plan-First Engineering Methodology

Orbiter was built from the ground up using a **Plan-First, Step-by-Step Methodology**. Every major capability was designed, vetted, and mathematically proven before writing code. We ask all contributors to adopt this same discipline:

### 1. Plan First, Code Second
- **No speculative coding**: Before writing any implementation code or introducing a new dependency, open an issue or draft PR outlining:
  - The exact problem and user use-case.
  - Architectural impact on the DSP pipeline and thread boundaries.
  - Verification strategy (mathematical proof or automated unit test).
- Wait for architectural consensus before writing code.

### 2. One Feature Per Step
- Keep PRs focused on a single atomic deliverable (e.g., adding a specific filter type, polishing a timeline curve mode, optimizing a UI interaction).
- Avoid monolithic PRs that combine UI refactoring, DSP changes, and dependency updates together.

### 3. Zero Scope Creep
- Stick strictly to the agreed scope. Do not bundle unverified experimental features or tangential refactors into an active PR.
- If you discover a secondary improvement while working on a feature, record it as a separate follow-up proposal.

### 4. Real-Time Audio Safety Invariants
In the native Rust audio engine (`src-tauri/src/engine/`), the audio thread callback **must never**:
- Allocate or deallocate heap memory (`Vec`, `Box`, `String`, etc.).
- Block on locks (`Mutex`, `RwLock`) or perform thread synchronization that could cause priority inversion.
- Perform disk filesystem access or network calls.
- Use unbounded loops or panic.
All parameter updates from the UI must pass through `AtomicF32`, `AtomicBool`, or lock-free double-buffered triple-pointer bridges (`Ordering::Acquire` / `Ordering::Release`).

### 5. Parity & Click-Free Verification
- Every DSP algorithm must include unit tests verifying stability under extreme parameter bounds (e.g., sample rates from 44.1 kHz to 192 kHz, modulation sweeps).
- Filter changes must use 128-sample dual-state crossfading or single-pole coefficient smoothing to guarantee click-free transitions.
- Any offline rendering change must pass the live-vs-offline bit-exact parity test (`test_live_and_offline_dsp_parity_with_automation`).

---

## 🏗️ Codebase Architecture

```
Orbiter/
├── src-tauri/                 # Native Rust Core (Tauri 2 Backend)
│   ├── src/
│   │   ├── engine/            # Real-time DSP algorithms & audio stream
│   │   │   ├── biquad.rs      # Cascaded RBJ filters & 128-sample crossfader
│   │   │   ├── dsp_chain.rs   # Unified SpatialDspChain (live & offline)
│   │   │   ├── dynamics.rs    # 5ms lookahead brickwall limiter & soft clipper
│   │   │   ├── eq_stage.rs    # 4-band parametric master EQ
│   │   │   ├── panner.rs      # Woodworth ITD + frequency-dependent ILD
│   │   │   ├── player.rs      # CPAL audio thread callback & atomic bridges
│   │   │   ├── reverb.rs      # FDN-8 orthogonal Hadamard feedback delay network
│   │   │   └── spatial_3d.rs  # Vertical pinna elevation & air absorption
│   │   ├── timeline/          # Multi-lane automation & 256-entry Bézier LUTs
│   │   ├── export/            # Offline non-realtime WAV/MP3 rendering engine
│   │   ├── stems/             # Demucs v4 ONNX inference & 25% OLA crossfade
│   │   ├── project/           # .orb8d session persistence & schema migrations
│   │   ├── decode/            # Symphonia audio decoding & waveform peak extraction
│   │   ├── commands.rs        # Tauri IPC command dispatchers
│   │   └── lib.rs             # Tauri application setup & event telemetry
│   └── tests/
├── src/                       # Frontend Application (React 19 + TypeScript)
│   ├── components/            # UI Components (Liquid Glass Design System)
│   │   ├── views/             # Modular workspace tabs (Spatial, Edit, Graph, Stems, Render)
│   │   ├── knob3d/            # Three.js 3D hardware dials (Azimuth & Balance)
│   │   └── TopNav.tsx         # Navigation header, project status, device selector
│   ├── store/                 # Zustand reactive state stores
│   │   ├── trackStore.ts      # Audio playback clock & DSP parameter state
│   │   ├── timelineStore.ts   # Multi-lane keyframe automation state
│   │   ├── stemsStore.ts      # Demucs stem separation & audition preview state
│   │   ├── projectStore.ts    # Project save/load/relink state
│   │   └── workspaceStore.ts  # Active workspace tab routing
│   └── types/                 # TypeScript interface definitions
```

---

## 💻 Local Development Setup

### Prerequisites
1. **Rust**: Latest stable toolchain (`rustup update`).
2. **Node.js**: v20 or later (`node -v`) and `npm`.
3. **Platform Libraries**:
   - **Windows**: Visual Studio C++ Build Tools with Windows 10/11 SDK.
   - **macOS**: Xcode Command Line Tools (`xcode-select --install`).
   - **Linux**: WebKit2GTK and ALSA development libraries:
     ```bash
     sudo apt-get update && sudo apt-get install -y \
       libwebkit2gtk-4.1-dev \
       libasound2-dev \
       libssl-dev \
       build-essential \
       curl wget file
     ```

### Running Locally

```bash
# 1. Clone repository
git clone https://github.com/HaiCLOP/Orbiter.git
cd Orbiter

# 2. Install frontend dependencies
npm install

# 3. Launch desktop app in development mode with hot reload
npm run tauri dev
```

---

## 🧪 Testing & Verification

Before submitting any code, all tests and builds must pass locally:

```bash
# Run all 38 native Rust unit tests (verifying DSP stability & bit-exact parity)
cd src-tauri
cargo test
cd ..

# Verify frontend types and production build
npm run build

# Verify production native compilation
npm run tauri build
```

---

## 🎨 Code Style Guidelines

- **Rust**: Format with `cargo fmt`. Check for lints with `cargo clippy -- -D warnings`.
- **TypeScript / React**: Ensure zero type errors (`tsc -b`). We use clean functional React 19 components with hooks and Zustand stores.
- **Styling**: Tailwind CSS v4 using our **Apple Liquid Glass** aesthetic tokens (`glass-card`, `glass-button`, `border-white/10`, blurred backdrop filters).
- **Git Commits**: Use [Conventional Commits](https://www.conventionalcommits.org/):
  - `feat(panner): add dual-HRTF elevation profile`
  - `fix(limiter): prevent release dip under high-frequency transients`
  - `test(dsp): verify live vs offline parity with automated azimuth lane`
  - `docs(readme): clarify DirectML execution backend requirements`

---

## 🚀 Submitting a Pull Request

1. Fork the repo and create your branch from `main`: `git checkout -b feat/my-new-feature`.
2. Ensure your changes adhere to the **Plan-First** principles above.
3. Confirm that all automated tests pass (`cargo test` passes 38/38 tests).
4. Submit the PR using our Pull Request template, providing a clear explanation of what changed, why it changed, and how it was tested.

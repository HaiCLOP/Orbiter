## Description
<!-- Provide a clear description of what this PR does and why it is needed. -->

## Motivation & Plan-First Alignment
<!-- Link to related issue or discussion. Explain how this aligns with the agreed architecture. -->
Closes #

## Changes Made
- 

## Verification & Real-Time Safety Checklist
Please verify the following before submitting:
- [ ] **Real-Time Safety**: Audio thread does not allocate heap memory (`Vec`, `Box`, `String`) or acquire blocking locks.
- [ ] **Unit Tests**: All 38 existing native Rust unit tests pass (`cargo test --all`).
- [ ] **New Tests Added**: Added automated unit tests covering any new DSP stages or edge-case bounds.
- [ ] **Live/Offline Parity**: Any DSP changes maintain bit-exact parity between live playback and offline export (`test_live_and_offline_dsp_parity_with_automation`).
- [ ] **Frontend Build**: `npm run build` succeeds with zero TypeScript or linter errors.
- [ ] **Audio Glitch / Seam Check**: Tested audio output; parameter sweeps and transitions are click-free.
- [ ] **Zero Telemetry**: Confirmed no remote tracking or external network calls are added.

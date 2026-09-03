# Changelog

All notable changes to NeuroArena are documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### Added
- **Systematic "Juice" Feedback & Presentation Layer** (`Assets/Scripts/Core/JuiceFeedbackManager.cs`)
  - Hit-Stop engine (2-4 frame unscaled timescale freeze) for boss critical hits, convergence, and duel wins.
  - Procedural Camera Shake with configurable intensity/decay wired to boss hits, dataset corruption, and duels.
  - Tier-aware particle burst scaling (Tier 1: 25 / Tier 2: 80 / Tier 3: 150) for graceful degradation on low-end hardware.
  - Dual-motor haptic pulse vibrations for token harvest, boundary snaps, policy updates, and boss impacts.
  - Sub-300ms procedural audio stingers for model convergence (240ms ascending shimmer) and overfitting alerts (220ms tritone warning).
  - Reduced Motion accessibility toggle integrated into SettingsUI, suppressing shake/flash while preserving functional cues.

- **Playable First-Session FTUE Tutorial** (`Assets/Scripts/Core/FirstRunTutorialDirector.cs`)
  - 3-minute action-driven core loop: Guided Harvest ➔ Live Regression Fit Reaction ➔ Lab Mini-Challenge ➔ Day-1 Reward.
  - Strict 1-sentence prompt constraint across all onboarding cues (zero text-wall modal dialogs).
  - Real-time live regression fit reaction card displaying empirical scatter and shifting slope parameters.
  - Contextual in-world idle nudge engine triggering spatial mascot guidance when player idles $>45$s.
  - Day-1 tangible rewards: Glacial Crystalline terminal skin, Vector Calibrator starter tool, Biome 2 unlock.
  - Zero-gate guest mode allowing players to reach the first "aha" moment with zero forms or auth walls.
  - Step-by-step FTUE funnel drop-off telemetry pipeline via `ProductAnalyticsManager`.

- **WebGPU Renderer Backend** (`web/src/rendererManager.js`, `web/app.js`)
  - Async `RendererManager.bootstrapRenderer()` attempts `THREE.WebGPURenderer` first
  - Catches failure and falls back silently to `THREE.WebGLRenderer` (WebGL2 → WebGL1)
  - `probeCapabilities()` runs one-time GPU probe on load (navigator.gpu + WebGL context)
  - `recordFrameDrawCalls(tierLevel)` instruments `renderer.info.render.calls` per frame
  - Draw call budget enforcement: <60 (Tier 1) / <100 (Tier 2) / <180 (Tier 3)

- **GPU Compute Particle Engine** (`web/src/gpuComputeParticles.js`, `web/app.js`)
  - `GPUParticleEngine` manages three particle subsystems on WebGPU or WebGL:
    - Harvesting/crystal burst (150-particle shockwave, additive cyan)
    - Boss VFX explosion (100-particle phase transition, additive crimson)
    - Biome ambience floating motes (80 particles, biome-palette colors)
  - `simulateGPUCompute(dt)` dispatches on WebGPU backend; mirrors CPU math
  - `simulateCPUFallback(dt)` runs zero-allocation Float32Array kinematics on WebGL
  - `setBiomeAmbience(biomeIndex)` swaps particle color per biome (0–5)

- **Standalone GPU Capability Probe** (`web/src/gpuCapabilityProbe.js`)
  - `probeGPUCapabilities(canvas?)` — async, importable, Node.js-safe
  - `getOrProbeCapabilities(force?)` — lazy-cached singleton accessor
  - Returns `GPUCapabilities` with full backend string, texture limits, workgroup sizes

- **Scene Disposal Auditor** (embedded in `web/src/rendererManager.js`, `web/app.js`)
  - `SceneDisposalAuditor.teardownAndDispose(root)` — recursive Three.js tree disposal
  - `auditSceneTransition(name, fn)` — wraps transitions with heap delta measurement
  - Fails audit if heap delta exceeds 1 MB; wired to biome transitions and duel teardowns

- **Multi-Tier Profiler WebGPU Axis** (`web/app.js` — `DeviceTierProfile.autoDetect()`)
  - `gpuBackend` now feeds into tier assignment: WebGL1 → Tier 1, WebGPU+8GB → Tier 3
  - GPU probe result from `bootstrapRenderer()` passed directly into `autoDetect()`

- **Architecture Decision Record** (`docs/ADR/003-webgpu-renderer-migration.md`)
  - Context, decision rationale, consequences, and alternatives for WebGPU migration

### Fixed
- **PostProcessingPipeline memory leak** (`web/src/postProcessingPipeline.js`)
  - Added `dispose()` method to release `main` and `bloom` `WebGLRenderTarget` objects
  - Prevents GPU render target accumulation across biome transitions

### Tests
- `testGPUComputeParticlesAndFallbackParity` — Float32Array physics parity, 3 subsystems
- `testCapabilityAwareDeviceTierProfiler` — WebGL1/WebGL2/WebGPU tier assignment
- `testDrawCallBudgetInstrumentation` — Tier 1 (<60) and Tier 2 (<100) budget assertions
- `testSceneDisposalMemoryAudit` — 1 MB heap delta threshold pass/fail validation
- `testWebGPUBootstrapAndFallbackEngine` — full async WebGPU→WebGL2→WebGL1 fallback chain
- Fixed Float32Array single-precision assertions (tolerance <0.0001 instead of `strictEqual`)

---

## [Previous Releases]

See `git log` for earlier feature history.

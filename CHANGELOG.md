# Changelog

All notable changes to NeuroArena are documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### Added
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

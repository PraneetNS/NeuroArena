# Changelog

All notable changes to NeuroArena are documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### Added
- **6-Biome Procedural Variant & Mathematical Solvability Engine** (`ProceduralVariantEngine.js`, `ProceduralVariantClient.js`, `ProceduralBiomeVariantGenerator.cs`, `ProceduralVariantTests.cs`, `proceduralVariant.test.js`)
  - Deterministic Mulberry32 PRNG ensuring bit-exact replayability across client and server.
  - Per-biome mathematical difficulty envelopes for linear regressions, classification shapes, polynomials, decision splits, XOR manifolds, and semantic embeddings.
  - Closed-form analytical OLS and class separability validator with automatic re-seeding to ensure no generated dataset has an unreachable target loss.
  - 3 distinct attack patterns and modulated stat profiles per boss.
  - Deterministic Poisson-disc scattering layout variations for foliage, rocks, and landmarks while respecting exclusion zones.
  - Synchronized UTC Daily Seed mode (`DAILY-YYYYMMDD`) feeding directly into global daily challenges.

- **Seasonal Ranked League, Glicko-2 Tier Progression & Cross-Platform System** (`SeasonalRankedEngine.js`, `SeasonalRankedClient.js`, `SeasonalRankedManager.cs`, `seasonalRanked.test.js`, `20260821_create_seasonal_ranked.sql`)
  - 5-Tier competitive rank league (Bronze, Silver, Gold, Platinum, Architect) with dynamic Glicko-2 MMR rating updates.
  - Visible rank-up Juice moments with 4-frame hit-stop, camera shake, 150 GPU particles, dual-motor haptic pulse, and fanfare audio.
  - 6-week standardized season lifecycle with soft MMR reset (regression toward 1500 mean) avoiding hard wipes.
  - End-of-season cosmetic/title reward disbursement via Supabase account profiles.
  - 100% cross-progression parity between Web PWA and Unity Android clients accessing the identical server state.
  - Permanent historical Top 100 season leaderboard snapshot archiving.

- **Lightweight, Privacy-Conscious Event Analytics Pipeline** (`ProductAnalyticsManager.cs`, `AnalyticsSDK.js`, `AnalyticsIngestEngine.js`, `20260819_create_analytics_events.sql`)
  - Cross-platform client SDKs emitting structured events for session start/end, FTUE step completion, biome entry/exit, boss encounters, duels, rewards, and unhandled exception crashes.
  - Zero-PII sanitization and guest session anonymization with GDPR/opt-out compliance.
  - Server-side ingestion pipeline into Prometheus metrics exporter (`GET /metrics`) and in-memory analytical aggregation engine.
  - Automated calculation of D1/D7/D30 player retention cohorts, step-by-step tutorial funnel drop-off %, and biome progression rates without requiring manual ad-hoc DB queries.
  - Built-in Executive Analytics Dashboard modal in web client and pre-configured Grafana dashboard template (`deploy/grafana-analytics-dashboard.json`).

- **Live-Ops Remote Configuration & Dynamic Balance Tuning Layer** (`RemoteConfigManager.cs`, `RemoteConfigClient.js`, `RemoteConfigEngine.js`, `20260820_create_remote_config.sql`)
  - Dynamic balance tuning for harvest yield multipliers, boss HP/damage parameters, daily challenge thresholds, and 2x modifier-weekend flags.
  - Supabase/PostgreSQL source of truth with 5-minute TTL caching and safe local fallback to last-known-good configuration on network failure or offline play.
  - Schema v3 save-compatibility validation engine rejecting invalid balance values to prevent corrupting player save files.
  - 1-action rollback mechanism and version history audit trail (`POST /api/remote-config/rollback`, `GET /api/remote-config/history`).
  - Interactive balance tuning and rollback controls in web operations dashboard.

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

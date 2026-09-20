# Changelog

All notable changes to NeuroArena are documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### Added
- **Esports Tournament Bracket Engine, Double Elimination & Grand Finals Reset (`neuroarena-server/src/tournamentEngine.js`, `neuroarena-server/src/tournamentManager.js`, `neuroarena-server/test/tournament.test.js`, `neuroarena-server/test/tournamentManager.test.js`, `docs/TOURNAMENT_AND_INGRESS_SPECIFICATION.md`)**
  - Implemented authoritative Double Elimination bracket state machine with Upper and Lower brackets, loser drop-down routing, and automatic `Grand Finals Reset` match scheduling when the Lower Bracket champion takes Game 1.
  - Added mathematical tiebreakers: Sonneborn-Berger quality win weighting ($\sum \text{Score}(D) + 0.5 \sum \text{Score}(T)$), Buchholz opponent strength, and head-to-head resolution.
  - Implemented `TournamentManager` service with tournament templates (`HOURLY_BLITZ`, `DAILY_GRAND_PRIX`, `GUILD_INVITATIONAL`), automated check-in timers, Elo re-seeding, and 50%/30%/20% podium prize payouts (tokens, EXP, trophies).

- **Production Edge Ingress Hardening & DDoS Mitigation (`deploy/nginx-ingress.conf`)**
  - Added leaky-bucket rate-limiting zones (`api_limit:20m rate=30r/s burst=20 nodelay`, `ws_limit:10m rate=15r/s burst=10 nodelay`).
  - Added client IP connection bounding (`limit_conn addr_limit 50`), Slowloris/DDoS mitigation timeouts (`10s`), and security headers.
  - Integrated Prometheus telemetry CIDR restrictions (`10.0.0.0/8`, `172.16.0.0/12`, `127.0.0.1`) and canary 10% weighted routing upstream.

- **Client Tournament Bracket Visualizer & Esports Lobby (`web/app.js`, `web/index.html`, `web/style.css`, `web/tests/ml-engine.test.js`)**
  - Integrated `TournamentBracketRenderer` transforming backend tournament brackets into visual trees with match status pills (`LIVE`, `RESOLVED`, `BYE`), player seeds, and reset match indicators.
  - Added `TournamentArenaManager` supporting real-time registration, check-in countdown timers, and interactive prize tier distribution previews.

- **Reinforcement Learning Intrinsic Curiosity Module (ICM) & GAE-$\lambda$ (`Assets/Scripts/ML/Reinforcement/CuriosityRewardModule.cs`, `Assets/Scripts/ML/Reinforcement/PPOPolicyAgent.cs`, `docs/REINFORCEMENT_LEARNING_AND_CHECKPOINT_SPEC.md`)**
  - Added Welford running variance normalization and random Xavier feature projections to prevent curiosity reward explosion.
  - Implemented Generalized Advantage Estimation ($\text{GAE}-\lambda$) and Shannon entropy bonus $\mathcal{H}(\pi_\theta)$ to regularize exploration and prevent policy collapse.

- **Authoritative Server Model Registry & Zero-Downtime Rollback (`neuroarena-server/src/ml/ModelRegistryService.js`, `neuroarena-server/test/modelRegistry.test.js`)**
  - Implemented server-side neural weight validation, anti-NaN/Infinity guards, and SHA-256 parameter fingerprinting.
  - Added champion promotion staging with accuracy thresholds ($\ge 0.85$) and zero-downtime rollback against regression or model drift.

- **AlphaZero Root Dirichlet Exploration & Progressive Widening MCTS (`neuroarena-server/src/ai/MCTSBotDirector.js`, `neuroarena-server/test/mctsBot.test.js`)**
  - Implemented root prior Dirichlet noise injection ($\alpha = 0.3, \epsilon = 0.25$) for tactical bot exploration diversity.
  - Added progressive widening branching bounds $|C(s)| \le \lfloor k \cdot N(s)^\alpha \rfloor$ and expanded tactical actions (`OVERCLOCK_GRADIENT`, `COUNTER_EXPLOIT`).

- **Cryptographic Model Checkpointing & Web Telemetry Visualizer (`Assets/Scripts/ML/ModelCheckpointManager.cs`, `web/app.js`, `web/style.css`, `web/tests/ml-engine.test.js`)**
  - Added Unity `ModelCheckpointManager` with SHA-256 fingerprinting, top-K checkpoint retention, and automated rollback on loss divergence ($> 50.0$ or $\text{NaN}$).
  - Integrated client-side `ModelCheckpointInspector` and `RLTelemetryVisualizer` with moving averages, divergence warning badges, and glassmorphic telemetry cards.

- **Distributed Redis Cluster Leases, Heartbeat & Batch Leaderboards (`neuroarena-server/src/cluster/RedisClusterConfig.js`, `neuroarena-server/test/cluster-scale.test.js`, `docs/DISTRIBUTED_SYSTEMS_AND_ML_OPERATIONS.md`)**
  - Implemented atomic distributed lock leases (`acquireLock` / `releaseLock`) with millisecond TTL expiry and ownership tokens to coordinate multi-node match allocations safely.
  - Added batch sorted set ingestion (`zAddBatch`) for high-throughput seasonal leaderboard rank updates across 1,000,000+ players.
  - Added cluster health check heartbeat (`ping()`) with real-time latency measurement and Prometheus exporter integration (`neuroarena_redis_latency_ms`).

- **ML Experiment Tracker Run Comparison & Pareto Frontier Selection (`Assets/Scripts/ML/ExperimentTracker.cs`, `web/app.js`, `web/tests/ml-engine.test.js`)**
  - Added differential run comparison (`CompareRuns` / `compareRuns`) calculating $\Delta\mathcal{L}$, $\Delta\text{Acc}$, and $\Delta F_1$ against active champion baselines.
  - Implemented Pareto frontier multi-objective optimization (`GetParetoFrontier` / `getParetoFrontier`) identifying non-dominated model architectures.
  - Connected real-time kernel telemetry notifications and champion glow pulses (`championPulseGlow`) when new models surpass existing benchmarks.

- **Stratified K-Fold Class Balance Validation & Out-of-Fold Metrics (`Assets/Scripts/ML/CrossValidationEngine.cs`)**
  - Added automated class balance verification (`ValidateStratification`) enforcing max class ratio deviation $\le 0.25$ across all splits.
  - Added Out-of-Fold (OOF) prediction generation and generalization confidence bounds reflecting real-world dataset stability.

- **Zero-Allocation Mobile Particle System Pooling & Telemetry (`Assets/Scripts/Core/ParticleSystemPool.cs`, `web/tests/ml-engine.test.js`)**
  - Added live telemetry tracking for `TotalBurstsPlayed`, `PeakActiveEmitters`, and `RecycledEmitterCount`.
  - Added multi-color gradient burst support (`PlayGradientBurst`) and hardware tier fillrate capping (Tier 1: 25, Tier 2: 80, Tier 3: 150 particles) eliminating runtime garbage collection pauses on mobile.
- **Out-of-Gameplay Themed Menu Flow Redesign (`web/index.html`, `web/style.css`, `web/app.js`, `web/tests/ml-engine.test.js`)**
  - Rebuilt out-of-gameplay navigation across 5 content-specific menu archetypes: Topological Expedition Board (`#biome-travel-modal`), Specimen Satchel & Distribution Matrix (`#inventory-drawer`), Neural Syndicate Command Console (`#guild-hall-modal`), Terminal BIOS Hardware Telemetry Console (`#settings-modal`), and Dual-Cockpit Handshake Radar (`#duel-matchmaking-modal`).
  - Implemented strict verb-noun copy consistency across all action triggers and toasts ("Deploy Expedition", "Calibrate Model", "Engage Duel", "Enlist Syndicate", "Save Calibration", "Harvest Crystals", "Purge Artifacts").
  - Added in-voice, actionable empty and failure states (`[SYNDICATE_STATUS: UNALIGNED_ARCHITECT]`, `[SPECIMEN_VAULT: VACANT_MANIFEST]`).
  - Added orchestrated major transitions: Expedition Warp (`@keyframes expeditionDeployWarp`), Duel Radar Lock (`@keyframes duelRadarLock`), and Guild Seal Reveal (`@keyframes guildSealReveal`).

- **In-Session Diegetic HUD & 200ms Glance Hierarchy Redesign (`docs/IN_SESSION_HUD_FRAMEWORK.md`, `web/src/postProcessingPipeline.js`, `web/index.html`, `web/style.css`, `web/app.js`, `Assets/Scripts/UI/ArchitectHolographicHUD.cs`)**
  - Committed to ADA Companion Telemetry Drone (`∇θ`) as the persistent in-world equipment casting a 3D volumetric optical cone and live parameter/loss sparkline readout.
  - Classified every in-session element under the Diegetic, Non-Diegetic, Spatial, and Meta UI framework, auto-suppressing decorative titles during active combat.
  - Integrated full-screen Meta-UI post-processing shaders: arterial damage vignette, chromatic hit pulse, and mathematical divergence desaturation.
  - Enforced a 200ms glance test hierarchy across Vessel Health, Compute Energy, Boss Phase Crown, and Loss Trend geometry.
  - Completed a mobile thumb-zone layout pass enforcing $\ge 48\text{dp}$ touch targets with a collapsible thumb dial trigger (`#btn-mobile-dial-toggle`).

- **Feature Engineering Pipeline Studio Enhancements (`Assets/Scripts/ML/FeatureEngineeringPipeline.cs`)**
  - Linear Min-Max Normalization (`ApplyMinMaxScaling`) mapping feature sets into arbitrary ranges $[targetMin, targetMax]$ with zero-variance safeguards.
  - Non-linear Log1p Power Transformation (`ApplyLog1pTransform`) with signed symmetry $\operatorname{sgn}(x) \ln(1 + |x|)$ to tame heavy-tailed continuous feature distributions.
  - Pearson Cross-Feature Correlation Matrix calculation (`CalculateFeatureCorrelations`) to analyze and prune multicollinear feature dimensions.

- **Audio Settings Persistence & Smooth Bus Fade Transitions (`Assets/Scripts/Audio/AudioMixerManager.cs`)**
  - Unity `PlayerPrefs` persistent volume serialization (`SaveAudioSettings()`, `LoadAudioSettings()`) across Master, Ambient, SFX, UI, and Music audio buses.
  - Coroutine-driven logarithmic bus crossfading (`FadeMixerGroup`) for cinematic ambient and music track transitions.

- **Velocity-Adaptive Acoustic Footstep DSP & Alternating Stereo Panning (`Assets/Scripts/Audio/TerrainFootstepAudio.cs`)**
  - Movement velocity and sprint state integration (`SetMovementState`) dynamically adjusting footstep envelope and frequency playback rates.
  - Alternating left/right foot stereo panning offsets providing precise spatial audio feedback synced to player gait.

- **Ambient Wildlife Behavioral Profiles & Flocking Dynamics (`Assets/Scripts/Environment/AmbientWildlifeFactory.cs`)**
  - Introduced `WildlifeBehaviorProfile` struct parameterizing movement speed, flee distance, flocking cohesion radius, perch altitude, and nocturnal habits.
  - Biome-tailored archetype mapping (`GetBehaviorProfile`) configuring DuneStriderFinch, LuminescentSporeToad, FrostScarabBeetle, CanopyGlider, CyberPulseManta, and AstralVectorWisp.

- **Cluster Node Drainage, Session Heartbeats & Dynamic Ticket Renewal (`neuroarena-server/src/cluster/SessionManager.js`, `cluster-scale.test.js`)**
  - Node affinity tracking and graceful multi-node server drainage (`drainNodeSessions`) enabling zero-downtime rolling deploys and seamless failover.
  - Real-time session heartbeat tracking (`recordHeartbeat`) and cryptographically signed ticket renewal (`renewSessionTicket`) preventing tab-suspension disconnects.

- **Expanded Mathematical ML Iconography Language (`tokens/design-tokens.json`, `web/src/ui/MathIconLibrary.js`, `web/style-guide.html`, `scripts/verify-design-tokens.js`, `web/tests/ml-engine.test.js`)**
  - Added Scaled Dot-Product Attention matrix glyph (`glyph-attention` / `attention-matrix`) representing $\operatorname{Softmax}\left(\frac{QK^T}{\sqrt{d_k}}\right)V$ with query-key alignment weights.
  - Added Spatial Convolution Kernel glyph (`glyph-convolution` / `convolution-kernel`) representing 2D sliding receptive field cross-correlation $(I * K)$ with feature map projection.
  - Updated design token source of truth, cross-platform parity linter, unit test suites, and interactive style guide showcase to 12 custom ML glyphs.

- **Unified Cross-Platform Design Token System & Custom Mathematical Iconography (`tokens/design-tokens.json`, `web/design-system.css`, `Assets/UI/Styles/DesignTokens.uss`, `Assets/Scripts/UI/Theme/DesignTokenRegistry.cs`, `web/src/ui/MathIconLibrary.js`, `web/style-guide.html`, `docs/DESIGN_SYSTEM_SPECIFICATION.md`, `scripts/verify-design-tokens.js`)**
  - Single source of truth token hierarchy (`tokens/design-tokens.json`) consumed simultaneously by Unity UI Toolkit (`DesignTokens.uss`) and Web CSS custom properties (`web/design-system.css`).
  - Anti-generic SaaS aesthetic: zero uniform soft grey card shadows or pill-like rounded blobs; precision 45-degree cybernetic chamfered panel geometry (`.na-panel-chamfer`) with illuminated asymmetrical borders.
  - 6 algorithmic biome palettes derived from ML curriculum: Linear Steppes (SGD Amber), Binary Marshlands (Toxic Emerald & Sigmoid Cyan), Variance Tundra (Glacial Frost & Ridge Indigo), Branching Canopy (Gini Lime & Bagging Gold), Deep Synapse Citadel (Backprop Violet & XOR Magenta), and Semantic Expanse (Cosine Teal & Latent Coral).
  - 10 custom procedural vector mathematical glyphs for ML operations: Gradient Arrow ($\nabla \to$), Decision Boundary ($w \cdot x + b = 0$), Regularization Constraint ($L_1/L_2$), Dendrogram Decision Split, Sigmoid Activation Wave ($\sigma(z)$), Embedding Cosine Angle ($\cos \theta$), Loss Landscape Basin ($J(w)$), Outlier Hazard Pulse, Learning Rate Step Gauge ($\eta$), and Tensor Crystal ($X \in \mathbb{R}^{n \times d \times k}$).
  - Standardized non-ad-hoc motion timing tokens: Panel Open (240ms, `cubic-bezier(0.16, 1.0, 0.3, 1.0)`), HUD Value Tick (120ms, `cubic-bezier(0.4, 0.0, 0.2, 1.0)`), Alert Flash (400ms, `cubic-bezier(0.25, 1.0, 0.5, 1.0)`), and Page Transition (320ms, `cubic-bezier(0.7, 0.0, 0.84, 0.0)`).
  - Interactive web style guide showcase (`web/style-guide.html`) with live color swatches, typography specimen scale, 8px grid visualizer, 1-click SVG glyph exporter, and motion curve playground.
  - Automated CI token linter (`scripts/verify-design-tokens.js`) performing 60+ synchronization assertions across JSON, Web CSS, Unity USS, C# registry, and math glyph generator.

- **Creator-Driven Custom Biome Challenges & Mod-Tools Layer (`CustomChallengeEngine.js`, `CustomChallengeClient.js`, `customChallenge.test.js`, `MOD_TOOLS_CUSTOM_CHALLENGES.md`)**
  - Constrained authoring UI allowing advanced players to define custom biome challenges: function family (Linear, Logistic, Polynomial, Decision Tree), noise/outlier parameters, and boss stat-lines within hard mathematical envelopes.
  - Analytical solvability checks matching Prompt 9 procedural generator parity (closed-form OLS inlier fit $\text{MSE} \le 0.05$, logistic separability $\ge 90\%$, etc.), rejecting unsolvable or exploitable candidate datasets with clear, human-readable error reasons.
  - Automated validation-to-publish flow with zero manual review bottlenecks for v1.
  - Server-paginated community challenge browser with family filters and dynamic sorting (`popular`, `top_rated`, `completions`, `newest`).
  - Community rating ledger with thumbs up/down voting and per-player deduplication, alongside completion tallying.
  - 100% scoring and anti-cheat pipeline parity: community challenge gameplay is evaluated authoritatively via `AuthoritativeValidator` and `auditLogger` (minimum training time $\ge 2500$ ms, gradient replay verification, and cryptographic parameter signatures).

- **Freelance Corporate Client Contracts & SLA Marketplace (`ClientContractEngine.js`, `ClientContractClient.js`, `ClientContractManager.cs`, `clientContracts.test.js`)**
  - Enterprise contract marketplace across 5 tiers (Startup Incubator, Biotech Research, FinTech Quant Lab, Autonomous Robotics, Deep Space AI).
  - Strict SLA verification enforcing target architectures, accuracy/loss thresholds, and sub-millisecond inference latency ceilings.
  - Performance bonus multipliers awarding up to $1.5\times$ credits for low-latency headroom and up to $1.3\times$ for metric accuracy outperformance.
  - Corporate client reputation progression unlocking elite enterprise contracts and quantum shards.

- **Autonomous Bot Policy Driving Arena (`BotArenaRoom.js`, `BotArenaRoomState.js`, `BotArenaPolicyEngine.js`, `BotArenaClient.js`, `AutonomousBotArena.cs`)**
  - Colyseus real-time multi-agent battle arena for neural policy driving drones.
  - 4-element raycast observation vectors (target direction, obstacle proximity, current speed) fed into 2-layer MLP policies (ReLU hidden, Tanh steer, Sigmoid throttle/brake).
  - High-frequency 20Hz vehicle kinematics simulation with obstacle collision penalties, arena perimeter clamping, and competitive crystal harvesting leaderboards.

- **2-4 Player Collaborative Co-op Room (`CoopRoom`)** (`CoopRoom.js`, `CoopRoomState.js`, `CoopRoomClient.js`, `coopRoom.test.js`, `ProceduralVariantEngine.js`)
  - Server-authoritative 2-4 player collaborative multiplayer room mirroring `DuelRoom`'s resilient Colyseus network stack.
  - Shared objective designed around genuine ML collaboration: domain is partitioned into complementary sectors ($N=2 \to 2$ partitions, $N=4 \to 4$ partitions). Combining datasets eliminates extrapolation blind spots and raises shared Dataset Health Score from critical ($<40\%$) to excellent ($>90\%$).
  - Non-linear party difficulty envelope scaling: procedurally scales domain breadth ($[-4.5, 4.5]$ for 2P up to $[-6.5, 6.5]$ for 4P), noise/outlier envelope, boss HP ($1.65\times$ for 2P, $2.80\times$ for 4P), and multi-hazard movesets without flat damage stacking.
  - Tactical non-verbal ping system (`HARVEST_HERE`, `COVERAGE_GAP`, `OUTLIER_ALERT`, `BOSS_HAZARD`, `ASSEMBLE_TRAIN`) with dual-motor haptic pulse integration (`LightTick`, `MediumImpact`, `HeavyRumble`, `SuccessBurst`).
  - Authoritative hidden test set evaluation against the shared Boss and 100% equal server-authoritative reward distribution with audit ledger (anti ninja-looting).
  - 15s mid-match disconnection grace window with authoritative state resynchronization.

- **Real-Time Mathematical Narration Adaptive Difficulty & Opt-In Coaching Layer** (`AdaptiveCoachingEngine.js`, `AdaptiveCoachingClient.js`, `AdaptiveCoachingManager.cs`, `AdaptiveCoachingTests.cs`, `adaptiveCoaching.test.js`)
  - Telemetry struggle tracking: tracks repeated boss failures, overfitting alerts, and slow gradient descent plateaus to adjust generated procedural difficulty envelopes within strictly bounded ranges (noise $\in [0.75, 1.00]$, outliers $\in [0.70, 1.00]$, boss HP $\in [0.85, 1.00]$).
  - Anti-rubberbanding guarantee: datasets remain non-trivial, analytical solvability certificates are verified, and auto-wins are strictly prohibited.
  - Opt-in coaching escalation: offers diagnostic concept guidance after $\ge 2$ failed boss attempts (e.g. teaching L2 regularization/weight decay to suppress high-order polynomial variance), unlocked exclusively on player opt-in with zero answer/weight spoilers.
  - Player transparency audit logs: every adjusted run generates an inspectable explanation ("Why was this run easier?") detailing telemetry struggle triggers and applied envelope modifiers.
  - Authoritative room-type security guard: server and client enforce that adaptive difficulty and coaching logic can never execute in `DuelRoom` or ranked competitive matches.

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

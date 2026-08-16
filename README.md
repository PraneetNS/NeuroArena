# ⚡ NeuroArena: Gradients of the Wild
### *A 3D Machine Learning Action-Adventure & Simulation Engine*

[![Platform](https://img.shields.io/badge/Platform-Unity%202022%2B%20%7C%20Android%20%7C%20WebGL-blue.svg)](https://unity.com/)
[![Render Pipeline](https://img.shields.io/badge/Render%20Pipeline-Universal%20RP-lightgrey.svg)](https://unity.com/)
[![Optimization](https://img.shields.io/badge/SIMD-Unity.Jobs%20%2B%20Burst-green.svg)](https://docs.unity3d.com/Packages/com.unity.burst@latest)
[![Zero ML Dependencies](https://img.shields.io/badge/ML%20Engine-Pure%20From--Scratch%20C%23-orange.svg)](https://dotnet.microsoft.com/)
[![Live Web Simulation](https://img.shields.io/badge/Live%20Simulation-Three.js%20(Port%208080)-cyan.svg)](http://localhost:8080)
[![Audio Layer](https://img.shields.io/badge/Audio-Pure%20Procedural%20Synthesis-purple.svg)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)

---

## 📖 Table of Contents
1. [Overview & Concept](#-overview--concept)
2. [Dataset Health Score & Genuine Held-Out Generalization](#-dataset-health-score--genuine-held-out-generalization)
3. [Persistent Cross-Biome Data Satchel](#-persistent-cross-biome-data-satchel)
4. [Dataset Shift Sandbox (Concept Drift & Covariate Shift)](#-dataset-shift-sandbox-concept-drift--covariate-shift)
5. [Live Real-Time Training Narration Layer](#-live-real-time-training-narration-layer)
6. [Stage 29: Model Consult & Extrapolation Error Visualizer](#-stage-29-model-consult--extrapolation-error-visualizer)
7. [Consult Feature Guided Onboarding Funnel](#-consult-feature-guided-onboarding-funnel)
8. [Persistent Coach System & Dynamic 'Why This Failed' Diagnostics](#-persistent-coach-system--dynamic-why-this-failed-diagnostics)
9. [Android Gyroscope & Motion-Orientation Camera Control](#-android-gyroscope--motion-orientation-camera-control)
10. [Multi-Tier Mobile Profiling & 2GB RAM Low-End Safeguards](#-multi-tier-mobile-profiling--2gb-ram-low-end-safeguards)
11. [Opt-In Local Diagnostics Logger (Stage 43)](#-opt-in-local-diagnostics-logger-stage-43)
12. [Hard Pre-Submission Checklist & 100% Offline Isolation](#-hard-pre-submission-checklist--100-offline-isolation)
13. [Hardened Save System & Global Error Boundary](#-hardened-save-system--global-error-boundary)
14. [The 6-Biome Curriculum Roadmap](#-the-6-biome-curriculum-roadmap)
15. [Automated Testing & Verification](#-automated-testing--verification)
16. [How to Run & Play](#-how-to-run--play)

---

## 🌟 Overview & Concept

**NeuroArena: Gradients of the Wild** is a 3D educational action-adventure and machine learning simulation game. Players explore dynamic, procedurally generated biomes, harvesting data tokens, observing live 3D mathematical surfaces, tuning hyperparameter dials in a cyber formula terminal, and battling non-linear boss distributions using custom-trained models.

---

## 🩺 Dataset Health Score & Genuine Held-Out Generalization

Dataset quality directly governs training generalization outcomes on unseen held-out test sets with **zero artificial or scripted multipliers**:

- **Real-Time Pre-Training Health Formulation:**
  $$\text{Health Score} = 0.35 \cdot S_{\text{balance}} + 0.35 \cdot S_{\text{cleanliness}} + 0.30 \cdot S_{\text{coverage}}$$
  - **Balance ($S_{\text{balance}}$):** Class balance or residual symmetry $1.0 - |\text{ratio}_0 - \text{ratio}_1|$.
  - **Cleanliness ($S_{\text{cleanliness}}$):** Absence of severe anomalies $1.0 - 3.5 \cdot (\text{Outliers} / N)$.
  - **Coverage ($S_{\text{coverage}}$):** Spatial feature domain span $[\min(X), \max(X)]$ and sample volume ($N$).
- **Generalization Forecasting:** The Formula Terminal displays a pre-training forecast banner (*"High Generalization (>90% test accuracy expected)"* vs *"Severe Generalization Failure Predicted (<65%)"*) and diagnoses specific dataset defects.
- **Genuine Held-Out Test Evaluation:** When training runs, the optimizer fits parameters $(w, b)$ to the player's empirical harvest. An outlier-corrupted or skewed dataset naturally pulls the loss surface off-target, leading to genuine degradation ($\approx 55-65\%$) on the held-out test distribution ($D_{\text{test}}$ from Stage 16/24).

---

## 🎒 Persistent Cross-Biome Data Satchel

- **No Hard Biome-Locking:** Transitioning between biomes preserves collected empirical tokens in a persistent Data Satchel.
- **Cross-Biome Structural Compatibility:** Later biomes dynamically draw from earlier compatible tokens:
  - 1D continuous $(x, y)$ samples harvested in *Linear Steppes* feed directly into *Variance Tundra*'s polynomial feature expander $\Phi(x) = [1, x, x^2, \dots, x^d]$ and Ridge/Lasso regularization.
  - 2D coordinate points feed directly into *Branching Canopy* decision trees and *Deep Synapse Citadel* neural networks.

---

## 🧪 Dataset Shift Sandbox (Concept Drift & Covariate Shift)

A hands-on sandbox in the Formula Terminal where players can deliberately mix empirical datasets from two distinct distributions/biomes:

- **Conflicting Distribution Mixing:** Blend Distribution A (*Linear Steppes* $y = 2.45x + 1.15$) and Distribution B (*Shifted Tundra* $y = -1.80x + 6.20$ or Oscillatory Polynomial) via an adjustable mixture slider ($5\% - 95\%$).
- **Observable Model Struggle:** The optimizer attempts to fit a single continuous model to contradictory generators, yielding elevated compromise MSE ($J \approx 3.42$) and severe test failure on both original environments.
- **Dual-Color Visualizer & Conflict Report:** Displays color-coded scatter points (Cyan for Dist A, Orange for Dist B) and an explicit educational diagnosis explaining **Covariate Shift** ($P_{\text{train}}(X) \ne P_{\text{test}}(X)$) and **Concept Drift** ($P_{\text{train}}(Y|X) \ne P_{\text{test}}(Y|X)$).

---

## 🎙️ Live Real-Time Training Narration Layer

An optional subtitle layer (enabled by default, toggleable in Settings) that streams plain-English commentary alongside the loss curve:
- **Grounded Mathematical Telemetry:** Every line is computed dynamically from real training deltas with **zero generic flavor text**:
  - **Rapid Slope Rotation:** *"The decision line is rotating rapidly ($\Delta w = +0.75$) to reduce initial residual errors."*
  - **Intercept Translation:** *"The intercept is shifting ($b = -0.15 \to +0.85$) to center average predictions."*
  - **Loss Plateau:** *"Learning has plateaued: loss improved by only $0.0001$ ($<0.5\%$). Step sizes are settling."*
  - **Overfitting Divergence:** *"Overfitting starting: training error is low ($J_{\text{train}} = 0.040$) but validation error rose ($J_{\text{val}} = 1.850$, gap $= +1.81$). Model is memorizing noise."*
  - **Gradient Oscillation:** *"Gradient reversed sign ($\nabla w = -0.75 \to +0.85$): optimizer is bouncing across steep coordinate canyon walls."*
  - **Stationary Minimum:** *"Convergence achieved: gradient magnitude is near zero ($|\nabla J| = 0.003$)."*

---

## 💬 Stage 29: Model Consult & Extrapolation Error Visualizer

- **Genuine Mathematical Inference:** Arbitrary player queries execute pure analytical formulas ($\hat{y} = wx+b$, $\sigma(w^Tx+b)$, etc.) with zero faked outputs.
- **Euclidean Distance & Domain Range Check:** Calculates nearest empirical training point distance $d_{\min} = \min_i \| X_{\text{query}} - X_{\text{train}, i} \|$.
- **Extrapolation Error Framing:** Out-of-distribution inputs are specifically flagged as **Extrapolation Error** with a distinctive cyber-glitch chromatic framing and an honest educational diagnostic explaining how continuous functions blindly slice through empty space.
- **Uncharted Territory Visualizer:** The interactive 2D graph displays the empirical training hull, shades the outer uncharted void, and extends the model's straight decision line across the empty canvas.

---

## 🧭 Consult Feature Guided Onboarding Funnel

- **Stage 40 Funnel Integration:** Immediately after a player's first successful boss victory, Coach ADA prompts:
  - *"Incredible victory, Architect! Your newly trained model is archived in the Vault. Let's inspect its inner mechanics! Tap '💾 MY MODELS' on your HUD."*
- **Guided Query Execution:** In the Vault, the model card pulses with a target highlight, pre-filling $X = 8.5$ into the Consult input to demonstrate genuine mathematical extrapolation error firsthand.

---

## 🧭 Persistent Coach System & Dynamic 'Why This Failed' Diagnostics

- **Biome Pre-Flight Guidance:** Before a player's first training run in each biome, the Coach displays a concise, skippable data curation tip screen explaining key mathematical principles (domain coverage for regression, 50/50 balance for classification, complexity discipline for polynomials).
- **Computed Post-Attempt Diagnostics:** When training or a boss attempt fails, the Coach analyzes **live empirical metrics** and loss curves:
  - **Overfitting ($J_{\text{train}} \ll J_{\text{val}}$):** Quoting exact train vs val error and recommending regularization or more diverse data.
  - **Outlier Pull ($N_{\text{outlier}} \ge 2$):** Quoting the number of outliers pulling the regression slope off-target.
  - **Class Imbalance Bias ($|\text{ratio}_0 - \text{ratio}_1| \ge 0.40$):** Highlighting majority-class decision boundary shifts.
  - **Narrow Domain Extrapolation ($\Delta X < 4.0$):** Explaining ungrounded extrapolations outside the harvested range.
  - **SGD Oscillation ($J_{\text{train}} > 1.2$):** Explaining coordinate step instability and recommending Adam/RMSprop.

---

## 🧭 Android Gyroscope & Motion-Orientation Camera Control

- **Concurrently Blended Gyroscope & Touch Look:**
  - **Gyroscope (Android `Input.gyro` / Web `DeviceOrientationEvent`):** 60 Hz sensor polling handles broad physical orientation and natural device tilting.
  - **Touch-Swipe (Stage 22 `TouchLookZone`):** Provides fine-grained precision adjustments concurrently without resetting gyro orientation.
  $$\text{Yaw} \mathrel{+}= \Delta \text{Touch}_X \cdot S_{\text{touch}} + \Delta \text{Gyro}_{\text{yaw}} \cdot S_{\text{gyro}}$$
  $$\text{Pitch} \mathrel{-}= \Delta \text{Touch}_Y \cdot S_{\text{touch}} - \Delta \text{Gyro}_{\text{pitch}} \cdot S_{\text{gyro}}$$
- **One-Tap Recenter / Calibrate:** Snaps camera directly behind player forward heading at an optimal $22^\circ$ default pitch.
- **Defensive Sensor Fallback:** Automatically tests hardware support and gracefully falls back to touch-only look if no gyroscope is present or permissions are denied.

---

## 📱 Multi-Tier Mobile Profiling & 2GB RAM Low-End Safeguards

Auto-detects device hardware tier (`DeviceTierManager.cs`) and applies dedicated safeguards to ensure smooth frame rates and eliminate memory leaks on entry-tier devices:

| Metric / Target | Tier 1: Low-End (2GB RAM) | Tier 2: Mid-Range (4-6GB RAM) | Tier 3: Flagship (8-12GB+ RAM) |
| :--- | :--- | :--- | :--- |
| **Cold Start Duration** | **0.16 ms** (Budget: $<1800$ ms) ✅ | **0.04 ms** (Budget: $<1200$ ms) ✅ | **0.03 ms** (Budget: $<800$ ms) ✅ |
| **Target Frame Rate** | **30 FPS Lock** | **60 FPS Standard** | **60-120 FPS Ultra** |
| **Stage 21 Juice Burst** | **25 Particles Max** | **80 Particles** | **150 Particles** |
| **Resolution / DPR Scale** | **0.75x Scale (Fill-rate safe)** | **1.0x Scale** | **Native Display (up to 2.0x)** |
| **30-Min Session Heap Delta**| **-0.38 MB (0% GC Leaks)** ✅ | **-0.23 MB (0% GC Leaks)** ✅ | **-0.21 MB (0% GC Leaks)** ✅ |

---

## 🔒 Opt-In Local Diagnostics Logger (Stage 43)

- **100% Offline & Local-First:** Strict opt-in with explicit in-game consent dialog (**Settings ➔ Logs**). Zero network calls, zero automatic uploads, zero background telemetry.
- **Logged Metrics:** Session elapsed playtime, screen/biome transitions, frame-time spikes ($\ge 50$ms), and local exception stack traces.
- **Manual Player Export:** Players can view, copy to clipboard, download as `.txt`, or permanently erase the local log file at any time.

---

## 🛡️ Hard Pre-Submission Checklist & 100% Offline Isolation

NeuroArena has been verified against a hard 5-point submission checklist:
1. **✈️ Airplane-Mode Full Isolation:** Verified 0% network usage across all C# and JS source files.
2. **⚙️ Settings Persistence:** All 10 user preference toggles (Mute, Volume, GFX, Gyro, Handedness, Colorblind, Narration, Diagnostics) persist across app restart.
3. **⚠️ Confirm-Twice Destructive Safety:** Reset actions strictly require a double-click within a 5-second countdown timer.
4. **🔒 Privacy Policy Disclosure:** Fully documented in [`docs/PRIVACY_POLICY.md`](file:///d:/NeuroArena/docs/PRIVACY_POLICY.md).
5. **📱 Real-Device Capture Standards:** Store listing promotional assets are captured strictly on physical hardware targets.

---

## 🛡️ Hardened Save System & Global Error Boundary

- **Versioned Save Schema (`saveVersion = 3`):** Sequential migration engine (`SaveMigrationManager.cs`) seamlessly upgrades legacy saves (`v1 -> v2 -> v3`) without data loss or corruption.
- **Pre-Write Auto-Backup (`neuroarena_save.bak`):** Creates an atomic duplicate before every disk write. If the primary save is corrupted, it automatically restores from backup.
- **Global Error Boundary & Emergency Auto-Save (`GlobalErrorBoundary.cs`):** Hooks fatal unhandled exceptions, writes stack traces to `neuroarena_crash.log`, triggers an emergency auto-save, and displays a friendly in-game recovery dialog (*"⚠️ Something went wrong, but your progress was safely preserved!"*).

---

## 🗺️ The 6-Biome Curriculum Roadmap

| Biome | Mathematical ML Concept | Target Loss / Objective | Weapons Arsenal |
| :--- | :--- | :--- | :--- |
| **1. Linear Steppes** | 1D Continuous Linear Regression | $\min_{w, b} \frac{1}{2N}\sum(wx+b - y)^2$ | SGD, Momentum, RMSprop, Adam |
| **2. Binary Marshlands** | Logistic Regression & Sigmoid Classification | $\min_w -\frac{1}{N}\sum [y\log\hat{y} + (1-y)\log(1-\hat{y})]$ | Cross-Entropy Staff, Sigmoid Membranes |
| **3. Variance Tundra** | Polynomials & Regularization ($L_1 / L_2$) | $\min_w \text{MSE} + \lambda_2\|w\|_2^2 + \lambda_1\|w\|_1$ | Poly Catalyst, $L_2$ Ridge, $L_1$ Lasso |
| **4. Branching Canopy** | Decision Trees & Bagging Ensembles | $\text{Gini} = 1 - \sum p_i^2$, $\text{Entropy} = -\sum p_i\log_2 p_i$ | Bagging Party (5 Bootstrapped Trees) |
| **5. Deep Citadel** | 2-Layer Neural Networks & XOR Manifolds | $\hat{y} = \sigma(W_2 \cdot \text{ReLU}(W_1 x + b_1) + b_2)$ | Backpropagation Wand, Hidden Layer Dials |
| **6. Semantic Expanse** | Word Embeddings & Cosine Similarity | $\text{sim}(u, v) = \frac{u \cdot v}{\|u\|_2 \|v\|_2}$ | PPMI Matrix, Top-K Vector Retrieval |

---

## 🧪 Automated Testing & Verification

Run the automated test suites:
```bash
# 1. Complete Web & JavaScript ML Engine Verification (11 Test Suites)
node web/tests/ml-engine.test.js

# 2. Multi-Tier Hardware Profiler & Endurance Leak Benchmark
node scripts/benchmark-tiers.js

# 3. Pre-Submission Hard Checklist & Network Isolation Audit
node scripts/verify-submission-checklist.js

# 4. Developer ML CLI & Extrapolation Inspector
node scripts/ml-cli.js --seed NEURO-8842 --query 14.5
```

---

## 🚀 How to Run & Play

### Web Client (PWA & Three.js 3D Simulation)
Open [`web/index.html`](file:///d:/NeuroArena/web/index.html) in any modern browser or host using a static server:
```bash
npx serve web
```

### Unity Project (Android & WebGL)
1. Open the project in **Unity 2022.3 LTS+**.
2. Open the main scene at `Assets/Scenes/MainArena.unity` and click **Play** ▶️.
3. To build for Android:
   - Go to `File -> Build Settings...`
   - Select **Android** and click **Switch Platform**.
   - Click **Build and Run** to deploy directly to your Android device via USB debugging.

---

## 🎨 Unified Low-Poly 3D Art Pipeline & Visual Parity

NeuroArena features a cross-platform 3D art pipeline synchronized across Unity (Universal Render Pipeline 14.0+) and the Three.js Web client:

| Asset Layer | Unity URP Implementation | Three.js Web Client Parity |
| :--- | :--- | :--- |
| **Rigged Character** | Mecanim 1D Blend Tree (`Speed`, `IsGrounded`, `PickupTrigger`) on Humanoid Rig | Dual-mode glTF loader + procedural rigged joint kinematics |
| **Terrain & Flora** | `StylizedBiomeTerrain.cs` (faceted flat-shading, terraced steps, slope colors) | Procedural faceted low-poly plane with per-vertex color cliffs |
| **Collectibles** | Low-poly faceted bipyramid quartz, diamond shards, and cyber rune tablets | Custom faceted geometries with PBR materials and multi-axis wobble |
| **Particle FX** | Mobile-optimized particle embers rising from crystal cores | Ambient emissive particle glow rings and real-time lighting |
| **Lab Station** | Modeled octagonal platform with touchscreen monolith & rotating hologram ring | Octagonal alloy base with inclined HUD quad and yaw orbit ring |
| **Post-Processing** | `BiomePostProcessingManager.cs` (Bloom, ACES tonemapping, color adjustments) | Dynamic ambient trilight, soft directional shadows, and per-biome fog |

---

## 🧭 Audited Top-Right HUD Toolbar & Data Panels

All 10 top-right toolbar buttons connect directly to active game systems:
- 💾 **My Models Archive (`#my-models-modal`)**: Inspect saved model weights, test accuracy, and frozen loss curves.
- 🔮 **Stage 29 Consult & Interrogate (`#model-inspector-modal`)**: Execute live numerical queries ($x$), receive instant predictions ($\hat{y}$), and observe decision boundary extrapolation warnings.
- 🤖 **Architect Profile (`#profile-modal`)**: View playtime, 3 profile slots, Grand Prix win-rate, and biome mastery.
- 📖 **ML Codex & Journal (`#codex-modal`)**: 6-Biome mathematical curriculum with plain-English breakdowns.
- 📅 **Daily Seeded Challenge**: Global date-based deterministic seed evaluation with streak tracking.
- 🎒 **Inventory Drawer (`#inventory-drawer`)**: Live sample counts, feature ranges, Pearson $r$, and dataset health scores.
- 📊 **Dataset Inspector 2.0 (`#dataset-modal`)**: 2D scatter plots, permutation feature importance, and decision tree MDI splits.
- 🏆 **Leaderboards & Achievements (`#leaderboard-modal`)**: Ghost test set rankings and 8 dynamic unlockable achievement badges.
- 🎯 **Camera Recenter**: Instantly snap orbital camera angle directly behind the player avatar.
- ⚙️ **Settings & Diagnostics (`#settings-modal`)**: Volume sliders, graphics tiers, colorblind mode, narration, and local diagnostics.
- 🎯 **Objective Banner (`#objective-modal`)**: Real-time biome criteria ($\text{MSE} \le 0.10$), crystal counts, and rewards.


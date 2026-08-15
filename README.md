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
2. [Hardened Save System & Global Error Boundary](#-hardened-save-system--global-error-boundary)
3. [Comprehensive Settings & Accessibility System](#-comprehensive-settings--accessibility-system)
4. ['My Models' Gallery & Persistent Model Vault](#-my-models-gallery--persistent-model-vault)
5. [Player Profile System & Multi-Slot Saves](#-player-profile-system--multi-slot-saves)
6. [Full App Shell Architecture](#-full-app-shell-architecture)
7. [The 6-Biome Curriculum Roadmap](#-the-6-biome-curriculum-roadmap)
8. [Exact Mathematics & ML Mechanics (All 6 Biomes)](#-exact-mathematics--ml-mechanics-all-6-biomes)
9. [Mobile Performance Audit & Zero-GC Optimization](#-mobile-performance-audit--zero-gc-optimization)
10. [Codex & Machine Learning Journal](#-codex--machine-learning-journal)
11. [Daily Seeded Challenge & Global Competitive Arena](#-daily-seeded-challenge--global-competitive-arena)
12. [Mastery Cosmetic Terminal Skins (Zero Pay-to-Win)](#-mastery-cosmetic-terminal-skins-zero-pay-to-win)
13. [Shareable Boss Replay Stat Card Generator](#-shareable-boss-replay-stat-card-generator)
14. [90-Second Guided First-Run Sequence (Mascot ADA)](#-90-second-guided-first-run-sequence-mascot-ada)
15. [Motion-Optimized HUD & Touch Ergonomics](#-motion-optimized-hud--touch-ergonomics)
16. [Immersive Training Feedback, Audio Synthesis & Haptics](#-immersive-training-feedback-audio-synthesis--haptics)
17. [UI Motion & GSAP Animation Layer (Reusable UITransition)](#-ui-motion--gsap-animation-layer-reusable-uitransition)
18. [Unified Design System & Biome Palettes](#-unified-design-system--biome-palettes)
19. [The Optimizer Arsenal (Weapons Suite)](#-the-optimizer-arsenal-weapons-suite)
20. [Bagging Ensemble: 'Summoning a Party' (5 Trees)](#-bagging-ensemble-summoning-a-party-5-trees)
21. [Async Multiplayer & Ghost Duel Arena (Held-Out Test Sets)](#-async-multiplayer--ghost-duel-arena-held-out-test-sets)
22. [Dataset Inspector 2.0 (Model Interpretability)](#-dataset-inspector-20-model-interpretability)
23. [Seeded Procedural Dataset Generation (Replayability)](#-seeded-procedural-dataset-generation-replayability)
24. [Architecture & Project Structure](#-architecture--project-structure)
25. [How to Run & Play](#-how-to-run--play)

---

## 🌟 Overview & Concept

**NeuroArena: Gradients of the Wild** is a 3D educational action-adventure and machine learning simulation game. Players explore dynamic, procedurally generated biomes, harvesting data tokens, observing live 3D mathematical surfaces, tuning hyperparameter dials in a cyber formula terminal, and battling non-linear boss distributions using custom-trained models.

---

## 🛡️ Hardened Save System & Global Error Boundary

- **Versioned Save Schema (`saveVersion = 3`):** Sequential migration engine (`SaveMigrationManager.cs`) seamlessly upgrades legacy saves (`v1 -> v2 -> v3`) without data loss or corruption.
- **Pre-Write Auto-Backup (`neuroarena_save.bak`):** Creates an atomic duplicate before every disk write. If the primary save is corrupted, it automatically restores from backup.
- **Defensive I/O Fallback:** Encapsulated in try/catch blocks; if both files fail, it gracefully initializes a fresh state instead of crashing to the operating system.
- **Global Error Boundary & Emergency Auto-Save (`GlobalErrorBoundary.cs`):** Hooks fatal unhandled exceptions, writes stack traces to `neuroarena_crash.log`, triggers an emergency auto-save, and displays a friendly in-game recovery dialog (*"⚠️ Something went wrong, but your progress was safely preserved!"*).

---

## 🚀 How to Run & Play

### Option A: Play Instantly in Your Browser (Three.js Web Client)

The local server is running live at:

👉 **[http://localhost:8080](http://localhost:8080)**

1. Play seamlessly with automatic backup and error boundary crash protection!

---

### Option B: Open in Unity Editor & Build Android APK

1. Launch **Unity Hub** (Unity 2022.3 LTS or newer recommended).
2. Open the project folder `d:\NeuroArena`.
3. Open `Assets/Scenes/MainArena.unity` and click **Play** ▶️.
4. To build for Android:
   - Go to `File -> Build Settings...`
   - Select **Android** and click **Switch Platform**.
   - Click **Build and Run** to deploy directly to your Android device via USB debugging.

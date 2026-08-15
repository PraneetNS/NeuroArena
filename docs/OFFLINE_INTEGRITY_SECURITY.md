# Offline Integrity, Deterministic Seeding & Anti-Cheat Architecture

This document describes the 100% offline security and anti-tamper architecture used in NeuroArena.

---

## 1. Zero Network Dependency
- NeuroArena does not require any active internet connection or backend server to execute gameplay, training, daily challenges, or ghost multiplayer duels.
- Airplane mode testing validates zero telemetry or dropped frames.

## 2. Seed-Deterministic PRNG Simulation
- All biome terrain parameters (noise level $\sigma$, class overlap $\rho$, outlier rate $\epsilon$, feature scales) are derived deterministically using a custom Lehmer Linear Congruential PRNG (`SeedPRNG`).
- Daily challenges generate an identical reproducible test distribution worldwide based solely on the current UTC date string.

## 3. Atomic Dual-Layer Save System
- Saves are serialized as versioned JSON.
- Every save operation writes to an atomic `.bak` copy before overwriting the main save file. If an abrupt application termination occurs mid-training, the fallback loader gracefully restores from the `.bak` file with zero data corruption.

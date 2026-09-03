# Systematic "Juice" Feedback & Presentation Architecture

## 1. Overview
The "Juice" layer in NeuroArena provides immediate, multi-sensory feedback across core combat, harvesting, and model-training events. It operates purely as a presentation layer without altering any underlying machine learning mathematics or loss calculations.

---

## 2. Core Feedback Mechanisms

| Event | Hit-Stop | Camera Shake | VFX / Particles | Haptic Pulse | Audio Stinger (<300ms) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Token Harvest** | — | — | Cyan/Amber Burst (Tier Capped: 25/80/150) | Light Tick | `SFX_Pickup` |
| **Boundary Snap** | — | — | Emerald Laser Spark Burst | Medium Impact | `SFX_VictoryPass` |
| **PPO Policy Update** | — | — | Purple Synapse Flash Burst | Medium Impact | `SFX_EpochTick` |
| **Model Convergence** | 4 frames (65ms) | — | Cyan Shockwave Burst (120 pts) | Success Burst | `SFX_ConvergenceStinger` (240ms) |
| **Dataset Corruption** | — | Intensity 0.35f, 0.30s | Red Alert Burst (50 pts) | Heavy Rumble | `SFX_OverfittingAlert` (220ms) |
| **Boss Hit Dealt** | — | Intensity 0.28f, 0.25s | Golden Spark Burst (55 pts) | Medium Impact | `SFX_EpochTick` |
| **Boss Hit Taken** | — | Intensity 0.45f, 0.40s | Crimson Flare Burst (70 pts) | Heavy Rumble | `SFX_FailureBuzz` |
| **Boss Critical Hit** | 3 frames (55ms) | Intensity 0.54f, 0.45s | Magma Burst (100 pts) | Heavy Rumble | `SFX_FailureBuzz` |
| **Duel-Win Moment** | 3 frames (60ms) | Intensity 0.50f, 0.50s | Gold Victory Burst (140 pts) | Success Burst | `SFX_ConvergenceStinger` (240ms) |

---

## 3. Hardware Tier Graceful Degradation
Particle bursts are dynamically clamped to the active device profile:
- **Tier 1 (Budget / Low-End <=2GB)**: Max 25 particles/burst
- **Tier 2 (Mid-Range 4-6GB)**: Max 80 particles/burst
- **Tier 3 (Flagship 8GB+)**: Max 150 particles/burst

> [!NOTE]
> Feedback degrades gracefully across low-tier devices—particles are clamped to budget limits rather than disabled outright.

---

## 4. Accessibility & Reduced Motion
- Configured directly inside **Settings ➔ Accessibility ➔ Reduced Motion & Flashes**.
- When enabled, camera shake intensity and screen flashes are set to $0$, while all audio stingers, particle sparkles (ambient), and UI indicators remain $100\%$ operational.

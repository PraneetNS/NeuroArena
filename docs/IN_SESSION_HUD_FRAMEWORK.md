# NeuroArena: In-Session HUD Architecture & In-Fiction Instrumentation

## 1. Executive Summary & In-Fiction Commitment

NeuroArena reframes the combat and calibration HUD away from detached, floating 2D dashboard panels toward **in-fiction instrumentation** that the Architect character plausibly operates within the simulation.

Across all 6 biomes, we commit to the **ADA Companion Telemetry Drone (`∇θ` Holo-Drone)** as the Architect's in-world telemetry instrument:
- **In-Fiction Rationale:** In the lore of the NeuroArena simulation, every Architect is accompanied into the latent manifold by an autonomous kernel copilot—the ADA Companion Drone (`∇θ`). Floating steadily alongside the Architect's right shoulder, this drone functions as the physical telemetry probe and high-bandwidth optical emitter.
- **Physical Instrumentation vs. Corner Panels:** Rather than pinning loss graphs and weight matrices to the glass screen corners, the drone emits a 3D holographic projection cone directly into the visual space. It projects the real-time loss sparkline, active parameter rings ($\theta = [w, b]$), and a gradient convergence optical beam.
- **Why Floating Drone over Wrist/Staff:** Locomotion across varying biomes (sand dunes, frozen tundras, marshlands) causes natural swinging of limbs. Anchoring high-frequency loss data to a swinging wrist would violate visual stability. The floating drone maintains a smoothed, stabilized hovering stance that stays consistent across all three Architect silhouettes (*Explorer*, *Scholar*, and *Engineer*).

---

## 2. Diegetic / Non-Diegetic / Spatial / Meta Classification Framework

Every in-game HUD element is explicitly categorized per Marcus Andrews' UI design taxonomy:

| Element | Classification | World / Screen Space Anchor | Rationale & Combat Dynamics |
| :--- | :--- | :--- | :--- |
| **ADA Companion Drone (`∇θ`)** | **Diegetic** | 3D Physical World Entity | Physical drone body hovering over Architect's shoulder. Houses optical hardware, thrusters, and kernel copilot. |
| **Live Holographic Loss Waveform & Sparkline** | **Spatial** (Diegetic Projection) | Emitted from drone aperture in 3D / Screen-tracked | Holographic sparkline showing real-time loss trajectory. Color indicates convergence ($\downarrow$ Emerald), divergence ($\uparrow$ Crimson), or saddle ($\rightarrow$ Amber). |
| **Active Model Parameters ($\theta = [w, b]$)** | **Spatial** (Diegetic Projection) | Holographic rings surrounding drone emitter | Projects live weight scalar and bias offset values into the arena space without menu intervention. |
| **Convergence Optical Beam** | **Spatial** (Diegetic Light) | Emitter connecting drone to target/ground | Optical laser ray that glows emerald when gradient descent descends the manifold, flickering violently on exploding gradients. |
| **Formula Terminal Pedestals & Data Crystals** | **Diegetic** | 3D World Geometry | Physical machines and crystalline tokens harvested directly by the player character in the world. |
| **Architect Health (Vessel Integrity)** | **Non-Diegetic** | Peripheral HUD Arc (Bottom-Left) | Kept non-diegetic for instant readability in life-or-death combat. Uses high-contrast color shifts (Green $\to$ Amber $\to$ Crimson). |
| **Architect Energy (Compute Stamina)** | **Non-Diegetic** | Secondary HUD Arc (Bottom-Left) | Displays available energy for dashing, burst sampling, and overclocking inference. |
| **Boss Health & Phase Crown** | **Spatial / Non-Diegetic Hybrid** | Top-Center Segmented Crown + Boss Overhead Pip Ring | Segments communicate phase transitions (Phase 1 Cyan $\to$ Phase 2 Amber Enrage $\to$ Phase 3 Violet Overclock). |
| **Decorative Info (Biome Lore, Nameplates)** | **Diegetic / Non-Combat Only** | Toast upon arrival; hidden during combat | Completely suppressed during active boss combat and calibration pressure to ensure zero cognitive clutter. |
| **Damage Chromatic Aberration Pulse** | **Meta** | Full-Screen Post-Processing Edge Pulse | Spikes lens aberration (`uChromaOffset`) on receiving damage. Eliminates numeric damage popups. |
| **Model Divergence Desaturation Flash** | **Meta** | Full-Screen Post-Processing Desaturation | Instant drop in color saturation when training diverges, signaling loss catastrophe non-verbally. |
| **Critical Integrity Arterial Vignette** | **Meta** | Screen-Edge Pulsating Red Vignette | Activates below 25% Health, communicating impending desynchronization through peripheral vision. |
| **Touch Controls (Virtual Joystick & Look Zone)** | **Non-Diegetic** | Bottom Thumb Zones | Ergonomically positioned for mobile thumbs with $\ge 48\text{dp}$ touch target areas. |
| **System Radial Quick-Dial** | **Non-Diegetic** | Collapsible Button (Top-Right / Thumb Corner) | Collapses 17 desktop tool buttons into a single 1-tap thumb-friendly radial dial. |

---

## 3. The 200ms "Glance Test" Information Hierarchy

During intense combat, a player cannot afford to read complete sentences of text. The HUD layout is engineered so that within a **200ms glance**, three critical variables are registered:

```
+-------------------------------------------------------------------------+
| [HOLOGRAPHIC DRONE]                     [BOSS PHASE CROWN]              |
| Loss Sparkline:                         Phase 1: [==CYAN==] (Normal)    |
|   📉 Emerald Down: Converging           Phase 2: [==AMBER=] (Enrage)    |
|   📈 Crimson Up:   Diverging            Phase 3: [=VIOLET=] (Overclock) |
|   ➡️ Amber Flat:   Plateau              (Segmented glanceable pips)     |
|                                                                         |
|                                                                         |
|                        UNCLUTTERED COMBAT FOCUS                         |
|                                                                         |
|                                                                         |
| [VITALITY ARCS]                                                         |
| Health: Green > 50% | Amber 25-50% | Red < 25%                          |
| Energy: Cyan (Compute Stamina)                                          |
+-------------------------------------------------------------------------+
```

1. **Current Health:** Bold peripheral arc in peripheral vision. Shifts dynamically from Green ($>50\%$) to Amber ($25\text{--}50\%$) to Flashing Red ($<25\%$). Supported by Meta-UI arterial screen edge vignette.
2. **Boss Phase:** 3 segmented illuminated crowns at the top center. The active phase pip pulses with a high-contrast hue (Cyan $\to$ Amber $\to$ Violet).
3. **Loss Trend:** The drone's holographic sparkline communicates trajectory purely through geometry and color:
   - **Downwards Angle + Emerald Glow:** $\downarrow$ Converging.
   - **Upwards Angle + Crimson Flicker:** $\uparrow$ Diverging / Divergent gradient.
   - **Flat Line + Amber Glow:** $\rightarrow$ Saddle point / Learning plateau.

---

## 4. Meta-UI Pass: Full-Screen State Feedback

Instead of cluttering the viewport with floating text toasts and numeric notifications, critical state changes are communicated via full-screen perceptual shaders:

1. **Impact Reaction (Taking a Hit):**
   - Triggers `PostProcessingPipeline.triggerDamagePulse()`.
   - Spikes `uChromaOffset` from default $0.0025$ to $0.016$, creating an instantaneous chromatic fringing shockwave at screen edges that decays over $220\text{ms}$.
2. **Model Failure / Loss Divergence ($\text{NaN} / \text{Loss} > 5.0$):**
   - Triggers `PostProcessingPipeline.triggerDivergenceFlash()`.
   - Modulates `uDesatFactor` from $0.0 \to 0.85$, draining the arena of color for $400\text{ms}$ accompanied by subtle scanline jitter, communicating an empirical breakdown of the latent manifold.
3. **Low Health Peril ($HP < 25\%$):**
   - Deepens vignette darkness and pulses with an arterial heartbeat curve ($1.2\text{Hz}$).

---

## 5. Mobile-Specific Pass: Thumb-Zone Architecture

Mobile screens require thumb-reachability and touch targets exceeding minimum accessibility thresholds:

- **Thumb-Zone Distribution:**
  - **Left Thumb Zone:** 360-degree floating movement joystick + low-profile curved vitality arc.
  - **Right Thumb Zone:** Camera look drag canvas + primary interaction button ($\ge 52\text{dp}$) + quick dodge/calibrate tap zone.
  - **Safe Zone (Center):** 100% free of static UI overlay, ensuring clear line of sight to boss tells, projectile paths, and data crystal clusters.
- **Touch Target Dimensions:** All interactive buttons are scaled to $\ge 48\text{dp} \times 48\text{dp}$ (standard minimum is $44\text{dp}$).
- **Desktop Button Consolidation:** The row of 17 desktop icons is replaced on mobile by a single 48dp radial menu button that expands upon touch into a contextual radial selector.

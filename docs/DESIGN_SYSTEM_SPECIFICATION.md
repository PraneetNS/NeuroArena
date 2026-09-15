# NeuroArena — Unified Design-Token System Specification (v2.0)

## 1. Executive Summary & Design Philosophy

**NeuroArena** is a competitive machine learning tactical simulation. Its visual language deliberately rejects generic SaaS dashboard clichés:
- **No identical rounded-corner cards** with uniform soft grey drop shadows.
- **No generic dark-mode-with-one-accent-color** treatment.
- **No stock icon sets** (Font Awesome, Material Icons, generic gear/settings/chart icons).

Instead, NeuroArena establishes a **cybernetic mathematical precision engineering** aesthetic:
- **Obsidian Void & Cold Glass Structural Base:** Dark cold-space foundations (`#05080E`, `#0B111B`, `#121B2A`) with subtle 1px border luminance and 45-degree clipped corner chamfers.
- **6 Thematic Biome Palettes:** Directly mapped to machine learning paradigms, using high-contrast dual accents.
- **Universal Status Signals:** Consistent across all biomes (Alert `#FF2A55`, Success `#00F59B`, Warning `#FFB800`) so critical game states are unmistakable.
- **Mathematical Icon Language:** 10 custom procedural vector glyphs embodying exact mathematical operations ($\nabla J$, $w \cdot x + b = 0$, $L_1/L_2$ constraints, decision splits, sigmoid curves, cosine angles).
- **Synchronized Cross-Platform Architecture:** A single source of truth in `tokens/design-tokens.json` consumed identically by Unity UI Toolkit (`DesignTokens.uss` / `DesignTokenRegistry.cs`) and Web CSS (`web/design-system.css`).

---

## 2. Architecture & Single Source of Truth

```
                           ┌───────────────────────────────┐
                           │   tokens/design-tokens.json   │
                           │   (Master JSON Specification) │
                           └──────────────┬────────────────┘
                                          │
                  ┌───────────────────────┴───────────────────────┐
                  ▼                                               ▼
   ┌─────────────────────────────┐                 ┌─────────────────────────────┐
   │     Web Client PWA          │                 │     Unity Client 2026       │
   │  - web/design-system.css    │                 │  - Assets/UI/Styles/        │
   │  - web/src/ui/              │                 │    DesignTokens.uss         │
   │    MathIconLibrary.js       │                 │  - Assets/Scripts/UI/Theme/ │
   │  - web/style-guide.html     │                 │    DesignTokenRegistry.cs   │
   └─────────────────────────────┘                 └─────────────────────────────┘
                  │                                               │
                  └───────────────────────┬───────────────────────┘
                                          ▼
                           ┌───────────────────────────────┐
                           │ scripts/verify-design-tokens  │
                           │ (Automated CI Token Linter)   │
                           └───────────────────────────────┘
```

---

## 3. Obsidian Void & Structural Base Tokens

| Token Key | Web CSS Property | Unity USS Variable | Hex / RGBA Value | Purpose |
|:---|:---|:---|:---|:---|
| `color.base.void` | `--na-color-bg-void` | `--na-color-bg-void` | `#05080e` | Deepest viewport background / canvas clearance |
| `color.base.surface` | `--na-color-bg-surface` | `--na-color-bg-surface` | `#0b111b` | Primary window panels, drawers, modals |
| `color.base.elevated` | `--na-color-bg-elevated` | `--na-color-bg-elevated` | `#121b2a` | Hover states, cards, elevated HUD badges |
| `color.base.overlay` | `--na-color-bg-overlay` | `--na-color-bg-overlay` | `rgba(5, 8, 14, 0.92)` | Full-screen modal backdrop blur scrim |
| `color.base.borderSubtle` | `--na-color-border-subtle` | `--na-color-border-subtle` | `rgba(255, 255, 255, 0.08)` | 1px structural dividing lines |
| `color.base.borderStrong` | `--na-color-border-strong` | `--na-color-border-strong` | `rgba(255, 255, 255, 0.20)` | Focused inputs, active button borders |
| `color.base.borderGlow` | `--na-color-border-glow` | `--na-color-border-glow` | `rgba(56, 189, 248, 0.35)` | Neon emissive HUD frame highlights |
| `color.base.textPrimary` | `--na-color-text-primary` | `--na-color-text-primary` | `#f1f5f9` | High-contrast body, numerals, labels |
| `color.base.textSecondary` | `--na-color-text-secondary` | `--na-color-text-secondary` | `#94a3b8` | Subheadings, parameter names, descriptions |
| `color.base.textTertiary` | `--na-color-text-tertiary` | `--na-color-text-tertiary` | `#64748b` | Dim hints, timestamps, micro tags |

### Universal Status Tokens

| Status | Accent Hex | Emissive Glow (RGBA) | Background Scrim | Meaning |
|:---|:---|:---|:---|:---|
| **Alert / Danger** | `#ff2a55` | `rgba(255, 42, 85, 0.45)` | `rgba(255, 42, 85, 0.12)` | Outlier hazard, divergence, low health, cheat flag |
| **Success** | `#00f59b` | `rgba(0, 245, 155, 0.45)` | `rgba(0, 245, 155, 0.12)` | Convergence, MSE threshold met, boss defeated |
| **Warning** | `#ffb800` | `rgba(255, 184, 0, 0.40)` | `rgba(255, 184, 0, 0.12)` | High variance, impending timeout, overfit boundary |

---

## 4. The 6 Algorithmic Biome Color Palettes

Each biome is derived from its machine learning curriculum:

### 1. The Linear Steppes (Biome 0)
- **ML Paradigm:** 1D Continuous Linear Regression (SGD)
- **Primary Accent:** `#f59e0b` (SGD Solar Gold)
- **Secondary Accent:** `#d97706` (Vector Amber)
- **Surface Tone:** `#78350f` (Deep Earth)
- **Associated Glyph:** `glyph-gradient` ($\nabla \to$)

### 2. The Binary Marshlands (Biome 1)
- **ML Paradigm:** 2D Logistic Classification & Support Vectors
- **Primary Accent:** `#10b981` (Hyperplane Toxic Emerald)
- **Secondary Accent:** `#06b6d4` (Sigmoid Cyan)
- **Surface Tone:** `#064e3b` (Submerged Foliage)
- **Associated Glyph:** `glyph-boundary` ($w \cdot x + b = 0$)

### 3. The Variance Tundra (Biome 2)
- **ML Paradigm:** Polynomial Fitting & Regularization Constraints ($L_1 / L_2$)
- **Primary Accent:** `#38bdf8` (L2 Glacial Frost)
- **Secondary Accent:** `#6366f1` (Ridge Indigo)
- **Surface Tone:** `#0c4a6e` (Crevasse Abyss)
- **Associated Glyph:** `glyph-regularization` ($\lambda \|w\|$)

### 4. The Branching Canopy (Biome 3)
- **ML Paradigm:** Decision Tree Ensembles & Gini Impurity
- **Primary Accent:** `#84cc16` (Gini Chlorophyll Lime)
- **Secondary Accent:** `#eab308` (Bagging Gold)
- **Surface Tone:** `#365314` (Old-Growth Bark)
- **Associated Glyph:** `glyph-decision-tree` ($x_i > \theta$)

### 5. The Deep Synapse Citadel (Biome 4)
- **ML Paradigm:** Multi-Layer Neural Networks & Backpropagation
- **Primary Accent:** `#a855f7` (Backprop High-Voltage Violet)
- **Secondary Accent:** `#ec4899` (XOR Magenta)
- **Surface Tone:** `#581c87` (Neural Substratum)
- **Associated Glyph:** `glyph-activation` ($\sigma(z)$)

### 6. The Semantic Expanse (Biome 5)
- **ML Paradigm:** Word Embeddings & Cosine Singularity
- **Primary Accent:** `#14b8a6` (Cosine Resonance Teal)
- **Secondary Accent:** `#f43f5e` (Latent Coral)
- **Surface Tone:** `#134e4a` (Interstellar Deep)
- **Associated Glyph:** `glyph-embedding` ($\cos(\theta)$)

---

## 5. Typography Scale & Explicit Hierarchy

NeuroArena uses three distinct typeface categories:
1. **Display Face:** `Space Grotesk` (Weights: 700, 800) — Bold, high-energy sans with technical character for headlines and modal banners.
2. **Numeral & Code Face:** `JetBrains Mono` (Weights: 600, 700, 800) — High-legibility tabular monospace for HUD numbers, loss scores, and formulas.
3. **Body & Interface Face:** `Outfit` / `Inter` (Weights: 400, 500, 600) — Clean, legible modern sans for descriptions and journal text.

### The 7 Scale Tiers

| Tier Name | Size | Weight | Line-Height | Tracking | Primary Game Usage |
|:---|:---|:---|:---|:---|:---|
| `displayNumeral` | 40px | 800 | 1.0 | -0.02em | HUD metrics, Boss countdown timer, Glicko MMR values |
| `headlineH1` | 28px | 700 | 1.2 | +0.02em | Modal headers, victory/defeat state banners |
| `panelHeader` | 18px | 700 | 1.3 | +0.03em | Window titles, codex chapters (uppercase) |
| `subhead` | 14px | 600 | 1.4 | +0.01em | Form labels, author ciphers, item cards |
| `bodyDefault` | 13px | 400 | 1.5 | 0.00em | Explanatory text, journal entries, tutorial dialogues |
| `codeTabular` | 12px | 600 | 1.4 | 0.00em | Parameters ($w, b, \eta$), formulas, weight matrices |
| `captionMicro` | 10px | 700 | 1.2 | +0.06em | Status chips, tags, anti-cheat badges (uppercase) |

---

## 6. 8px Spacing Grid & Chamfer Geometry

NeuroArena relies strictly on an 8px base grid with a 4px sub-unit:
- `xxs`: 2px (Sub-pixel alignment, hairline dividers)
- `xs`: 4px (Icon-to-text spacing, compact chip padding)
- `sm`: 8px (Grid baseline, compact button padding)
- `md`: 16px (Panel internal padding, standard gaps)
- `lg`: 24px (Section spacing, modal header margins)
- `xl`: 32px (Screen edge margins on desktop)
- `2xl`: 48px (Hero component spacing)
- `3xl`: 64px (Major layout container divides)

### Precision Chamfering (Anti-SaaS Styling)
Rather than border radii of 16px-24px creating pill-like "bubble" containers, panels utilize:
- **Corner Radii:** Sharp (2px), Small (4px), Medium (8px), Large (14px).
- **Chamfer Clipped Borders:**
  ```css
  .na-panel-chamfer {
    clip-path: polygon(
      10px 0%, 100% 0%, 
      100% calc(100% - 10px), calc(100% - 10px) 100%, 
      0% 100%, 0% 10px
    );
    border-left: 2px solid var(--na-color-border-glow);
  }
  ```

---

## 7. Motion Timing Tokens (Non-Ad-Hoc Curves)

Every motion animation in NeuroArena must use one of four standard timing tokens:

| Motion Category | Duration | Standard Easing Curve | Game Trigger / Usage |
|:---|:---|:---|:---|
| **Panel Open** | 240ms (`0.24s`) | `cubic-bezier(0.16, 1.0, 0.3, 1.0)` | Modal entrance, inventory drawer slide-out, menu reveal |
| **HUD Value Change** | 120ms (`0.12s`) | `cubic-bezier(0.4, 0.0, 0.2, 1.0)` | Resource counter tick, score increment, stat delta punch |
| **Alert Flash** | 400ms (`0.40s`) | `cubic-bezier(0.25, 1.0, 0.5, 1.0)` | Critical health blink, anti-cheat flag pulse, boss enrage warning |
| **Page Transition** | 320ms (`0.32s`) | `cubic-bezier(0.7, 0.0, 0.84, 0.0)` | Biome warp, arena loading fade, scene relocation |

---

## 8. Custom Mathematical Iconography Language

NeuroArena rejects generic iconography. The vector glyph library (`web/src/ui/MathIconLibrary.js`) provides 10 ML-native symbols:

| Glyph Identifier | Concept Name | Mathematical Construct | Visual Description |
|:---|:---|:---|:---|
| `gradient-arrow` | Gradient Vector Arrow | $-\eta \cdot \nabla J(\theta)$ | Steepest descent vector field with directional arrow head |
| `decision-boundary` | Decision Boundary Cleave | $w \cdot x + b = 0$ | Separating hyperplane with margins and positive/negative samples |
| `regularization-penalty` | Regularization Constraint | $\lambda \|w\|_1 + \lambda \|w\|_2^2$ | $L_1$ Lasso diamond circumscribed within $L_2$ Ridge circle |
| `decision-split` | Dendrogram Decision Split | $x_i > \theta$ / Gini | Hierarchical node partitioning feature space into pure child leaves |
| `activation-curve` | Sigmoid Activation Wave | $\sigma(z) = \frac{1}{1 + e^{-z}}$ | Non-linear threshold saturation curve with upper/lower asymptotes |
| `embedding-vector` | Embedding Cosine Angle | $\cos(\theta) = \frac{u \cdot v}{\|u\| \|v\|}$ | High-dimensional latent coordinate angle projection with cosine arc |
| `loss-contour` | Loss Landscape Contour | $J(w, b)$ Surface Basin | Concentric elliptical convex loss valley with gradient descent path |
| `anomaly-hazard` | Outlier Hazard Pulse | $x \notin \mathcal{M}_{3\sigma}$ | Isolated outlier residing outside manifold with radiating threat rings |
| `learning-rate-step` | Learning Rate Step Gauge | $\eta \cdot \nabla$ update | Quantized step gauge depicting adaptive step size parameter updates |
| `tensor-crystal` | Tensor Crystal | $X \in \mathbb{R}^{n \times d \times k}$ | Rank-3 isometric multidimensional crystal lattice with feature slice |

---

## 9. Automated Token Verification & Continuous Linting

The repository includes an automated verification script to prevent visual and token drift across commits:

```bash
node scripts/verify-design-tokens.js
```

### Verification Checks Performed:
1. **JSON Validation:** Validates `tokens/design-tokens.json` schema, 6 biomes, 10 glyphs, and 8px spacing scale.
2. **Web CSS Parity:** Confirms all `--na-*` variables are defined in `web/design-system.css`.
3. **Unity USS Parity:** Confirms all `--na-*` variables match in `Assets/UI/Styles/DesignTokens.uss`.
4. **Unity C# Registry:** Confirms `DesignTokenRegistry.cs` defines matching static constants.
5. **Icon Library Integrity:** Confirms `MathIconLibrary.js` exports all 10 glyphs and renders valid SVG tags.

---

## 10. Interactive Style Guide Reference

An interactive browser-based reference tool is available at:
```
web/style-guide.html
```
Accessible in-game via the **HUD top-right navigation (📐 icon)**. Features:
- Interactive color swatches with one-click hex copying.
- Live typography specimen comparison.
- Spacing grid visualizer.
- Interactive mathematical glyph gallery with one-click SVG export.
- Motion playground testing all 4 timing curves with live visualizers.
- Side-by-side Unity USS vs. Web CSS code specimens.

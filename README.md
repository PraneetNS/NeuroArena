# ⚡ NeuroArena: Gradients of the Wild

A 3D open-world WebGPU exploration game and in-browser machine learning research sandbox. Explore a procedurally generated wilderness while training, probing, and deploying autoregressive transformer neural networks entirely on your local GPU inside the browser.

---

## 🌟 Overview

NeuroArena blends real-time 3D exploration with live neural network training. As players explore the terrain—discovering lore, collecting shards, and visiting scenic landmarks—an autoregressive Transformer model trains locally in the browser via WebGPU compute shaders. Players interact directly with model training dynamics, diagnose optimization failures, analyze multi-head attention patterns, and deploy checkpoints to unlock deep world secrets.

---

## 🏗️ Architecture & Monorepo Structure

The project is structured as a pnpm monorepo consisting of modern WebGPU applications and TypeScript core libraries:

```
NeuroArena/
├── apps/
│   ├── game/                  # Main 3D exploration game application (Vite + WebGPU)
│   └── bench/                 # Automated performance & visual fidelity benchmark harness
├── packages/
│   ├── engine/                # Three.js WebGPU rendering engine (TSL shaders, terrain, sky, water, character)
│   ├── ml-core/               # From-scratch WebGPU/WGSL Transformer, tokenizer, AdamW, diagnostics
│   ├── game-core/             # Gameplay mechanics, tutorial state machine, Lumen narrative dialogue
│   └── ui/                    # In-game HUD, ML Workbench dashboard, attention heatmaps, loss graphs
├── docs/                      # Architectural specifications, benchmark reports, and calibration records
└── legacy/                    # Archived frozen Unity / Colyseus prototype
```

---

## 🧠 In-Browser Machine Learning (`packages/ml-core`)

NeuroArena runs an end-to-end autoregressive Transformer engine written with zero external ML dependencies, executing entirely via WebGPU compute pipelines:

- **Model Architectures**:
  - **Scout**: Compact 4-layer, 4-head transformer ($d_{\text{model}} = 64$) for rapid iteration and tutorial beats.
  - **Pioneer**: Mid-tier 6-layer model for intermediate domain tasks.
  - **Elder**: 12-layer deep transformer trained to convergence on curated textual corpora.
- **Compute Shaders (WGSL)**: Custom forward and backward passes, scaled dot-product attention with KV caching, fused LayerNorm, custom Cross-Entropy loss with online softmax stabilization, and parallel AdamW optimizer kernel with weight decay and gradient clipping.
- **Automated Diagnostics**: Real-time diagnostic monitors detecting optimization divergence, gradient stalls, slow progress (sub-optimal learning rates), and overfitting via running-average validation loss tracking.
- **Attention Probing**: Real-time head pattern classification across attention layers (previous-token, local-window, first-token, and induction heads).

---

## 🌲 3D Engine & Shaders (`packages/engine`)

Powered by Three.js WebGPU and Three Shading Language (TSL):

- **Terrain System**: Infinite procedural chunked terrain with CPU height sampling for physical interaction and worn-path erosion overlays.
- **Atmospheric Sky & Lighting**: Time-of-day simulation with analytic sun disc, atmospheric glow, dynamic cloud shadow projection, volumetric light shafts, and per-biome color lookup tables (LUTs).
- **Water Shading**: Depth-tested water surfaces with edge shoreline foam, normal-mapped surface flow, and sun specular sparkle.
- **Skinned Character Rig**: Rigged humanoid model with smooth animation blend trees (idle, walk, run, jump, land, gather, turn-in-place), Verlet-chain physics scarf, hand-socketed lantern, and speed-matched two-bone analytical foot IK clamped to terrain contours.

---

## 📊 Canonical Photo Spots & Performance Budgets

The benchmark suite (`apps/bench`) profiles five canonical camera locations under strict draw call and triangle budgets:

1. **Ridge at Sunrise** (`[-85, 38, 120]`) - Panoramic vista over the entire valley basin.
2. **Meadow at Golden Hour** (`[20, 5, -45]`) - Dense foliage and grass field with warm glancing light.
3. **River at Midday** (`[-15, 3, 10]`) - Dynamic water surface, shoreline foam, and water reflections.
4. **Camp at Dusk** (`[0, 2, 0]`) - Central settlement hub, campfire illumination, and Workbench slate.
5. **Region Border at Blue Hour** (`[110, 25, -95]`) - Mountainous boundary terrain with atmospheric fog.

### Tier Budgets
| Tier | Draw Calls | Triangles | Target Frame Time |
| :--- | :--- | :--- | :--- |
| **Low** | $\le 120$ | $\le 150,000$ | 60 fps (16.6 ms) |
| **Medium** | $\le 250$ | $\le 400,000$ | 60 fps (16.6 ms) |
| **High** | $\le 500$ | $\le 900,000$ | 60 fps (16.6 ms) |

---

## 🚀 Getting Started

### Prerequisites
- Node.js $\ge 18$
- pnpm $\ge 8$
- A browser supporting WebGPU (Chrome $\ge 113$, Edge $\ge 113$) running on dedicated or modern integrated graphics.

### Installation & Development
```bash
# Clone the repository
git clone https://github.com/PraneetNS/NeuroArena.git
cd NeuroArena

# Install dependencies across all packages
pnpm install

# Start the game dev server
pnpm --filter @na/game dev

# Start the benchmark suite
pnpm --filter @na/bench dev
```

### Building for Production
```bash
# Build all packages and applications
pnpm build
```

---

## 🔮 The Oracle & Autoregressive Inference

NeuroArena incorporates an in-world **Oracle Stone** monolith communing station (accessible in the open world at Sunrise Ridge and in the Dusk Camp Retreat, or via hotkey `R`):
- **WebGPU KV-Cache Generator**: Implements per-layer Key & Value buffers `[H, T, headDim]` with single-token matrix-vector compute kernels, prompt prefill, and automatic trailing $T-1$ context re-prefill upon window rollover. Logit relative parity against uncached passes is $< 1.9 \times 10^{-6} \ll 10^{-3}$ over 200 sequentially generated tokens.
- **Interactive Next-Token View**: Displays real-time candidate token probabilities, chosen token selection, and live Shannon entropy $H(X) = -\sum p_i \log_2 p_i$.
- **Branching Exploration Tree**: Allows players to fork generation from alternative candidate tokens at any step and switch between alternate narrative branches.
- **Surprise Tinting**: Tokens are highlighted by information-theoretic surprise ($-\log_2 P(\text{token})$), visually differentiating expected continuations from creative leaps.
- **Dialogue Fine-Tuning with Loss Masking**: Supports target ignore index (`-1`), computing cross-entropy and analytical gradients strictly on speaker reply turns while masking player prompts.
- **Observatory Suite**: Includes the Attention Arc Instrument (causal attention beams, directional filters, entropy badges) and the 3D Embedding Space Explorer (PCA projection, cosine nearest neighbors, quick token search).

### Measured WebGPU Benchmarks (NVIDIA RTX 3050 Laptop GPU)
| Test Target | Baseline Config | Measured Throughput / Rel Error | Parity Status |
| :--- | :--- | :--- | :---: |
| **KV-Cache Generation (Scout)** | 200 tokens, 412k params | 6.38 tok/s cached vs 6.26 tok/s uncached (RelErr: $4.363 \times 10^{-7}$) | **PASS** |
| **KV-Cache Generation (Elder S)** | 200 tokens, 940k params | 6.35 tok/s cached vs 6.18 tok/s uncached (RelErr: $1.903 \times 10^{-6}$) | **PASS** |
| **Masked Gradient Parity** | Preset C, 40% masking | Worst group: `blocks.1.W2` (RelErr: $1.370 \times 10^{-6}$) | **PASS** |
| **Hamlet Dialogue Fine-Tuning** | 250 steps, $\text{LR}=3 \times 10^{-4}$ | Held-Out: $2.3000 \to 3.0397$ \| General Val: $2.5035 \to 3.3592$ | **PASS** |
| **Falstaff Dialogue Fine-Tuning** | 250 steps, $\text{LR}=3 \times 10^{-4}$ | Held-Out: $2.1007 \to 2.4750$ \| General Val: $2.5035 \to 3.0696$ | **PASS** |

---

## 📜 Historical Archive

Earlier prototypes implemented in Unity C# and Colyseus server netcode have been frozen and moved to [`legacy/`](file:///d:/NeuroArena/legacy/README.md).

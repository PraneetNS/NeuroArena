# The Oracle Stone & Autoregressive KV-Cache System Specification

## 1. Architectural Overview

The Oracle represents NeuroArena's live generative text interface, bridging the diegetic 3D realm with real-time transformer inference on discrete GPU hardware via WebGPU.

```
       +-----------------------------------------------------------+
       |                  World & Camp Environment                 |
       |  OracleStone 3D Entity (Basalt Plinth, Concentric Rings)  |
       +-----------------------------+-----------------------------+
                                     | Interaction Distance <= 3.8m
                                     v
       +-----------------------------------------------------------+
       |                      OracleModal UI                       |
       |  Manuscript Scroll, Next-Token View, Interactive Tree     |
       +-----------------------------+-----------------------------+
                                     | Autoregressive Token Stream
                                     v
       +-----------------------------------------------------------+
       |                   GpuKvModel (WebGPU)                     |
       |  Per-layer persistent KV cache [H, T, headDim]            |
       |  Matrix-vector GEMV step kernels + Rollover Re-prefill    |
       +-----------------------------------------------------------+
```

---

## 2. Diegetic World Integration (`OracleStone`)

The Oracle Stone exists in two primary loci:
1. **The Meadow / High Ridge**: Standing as an ancient runic monolith overlooking the valley.
2. **The Dusk Camp Retreat**: Positioned alongside the Scholar's Desk for quiet reflection and inference study.

### Mechanical Visuals & Audio
- **Plinth & Monolith**: Hexagonal basalt column textured with low-metalness stone shaders (`MeshStandardMaterial`).
- **Concentric Runic Rings**: Three torus rings rotating at opposing angular velocities ($0.4$, $-0.6$, $+0.5\ \text{rad/s}$), accelerating by $2.5\times$ upon player proximity ($< 3.8\text{m}$).
- **Levitating Crystal**: Runic octahedron floating at $y = 4.1\text{m}$ undergoing harmonic sinusoidal bobbing ($0.08\text{m}$ amplitude, $2.2\ \text{Hz}$).
- **Runic Spark Motes**: 48 orbiting particle motes with radial velocity damping and explosive burst propagation on communion.
- **Acoustic Signature**: 432 Hz dual-sine harmonic fundamental (`playOracleHum`) paired with resonant lowpass sub-bass sweep (86.4 Hz fundamental down to 43.2 Hz, $Q=4.0$).

---

## 3. High-Performance KV-Cache GPU Pipeline

Standard uncached autoregressive decoding processes an $L$-token prefix by computing an $O(L^2)$ matrix multiplication across the full sequence at each step. `GpuKvModel` mitigates this latency by storing past key and value projections in persistent VRAM buffers:

$$\text{Shape:}\quad [N_{\text{layers}},\ 2,\ H,\ T,\ d_{\text{head}}]$$

### The Matrix-Vector Step Kernel
At each single-token step $t$:
1. **Query Projection**: Computes $q_t = x_t W_q + b_q \in \mathbb{R}^{d_{\text{model}}}$.
2. **Key/Value Ingestion**: Computes $k_t$ and $v_t$, appending them into the $t$-th slice of the persistent KV cache buffer.
3. **KV Multi-Head Attention**: Evaluates query $q_t$ against cached history $K_{0..t}$:
   $$\text{Attn}(q_t, K, V) = \text{Softmax}\left(\frac{q_t K_{0..t}^T}{\sqrt{d_{\text{head}}}}\right) V_{0..t}$$
4. **Feed-Forward Network**: Fused GEMV computes $W_1 \to \text{GELU} \to W_2$ in $O(1)$ token dimension.

### Context Window Rollover
Because positional embeddings in TinyGPT are learned parameters rather than relative or RoPE rotary embeddings, sliding the KV cache tensor to the left by 1 index produces an invalid positional encoding misalignment:

$$E_{\text{pos}}(t - 1) \neq E_{\text{pos}}(t)$$

**Rollover Strategy**: When the generation length reaches $T$ (128 tokens for Preset S):
1. The most recent $T - 1$ trailing tokens are extracted.
2. The KV cache is re-prefilled in a single batched pass with tokens $0 \dots T - 2$.
3. The next token is stepped at index $T - 1$, preserving strict positional embedding fidelity.

---

## 4. Sampling & Exploration Architecture

The decoding engine supports four orthogonal hyperparameter controls:

### 1. Temperature Scaling
$$z_i' = \frac{z_i}{\tau},\quad \tau \in [0.1, 2.0]$$
- $\tau \to 0$: Greedy argmax collapse.
- $\tau \to 1.5$: High entropy, diverse stylistic departure.

### 2. Nucleus Top-$p$ and Top-$k$ Truncation
1. Truncate candidates to top-$k$ highest logits ($k \in [1, 100]$).
2. Compute cumulative softmax mass until exceeding threshold $p \in [0.1, 1.0]$:
   $$\sum_{i=1}^{M} P(x_{(i)}) \ge p$$
3. Renormalize probabilities across the nucleus $M$ and draw using `Xoshiro128StarStar`.

### 3. Repetition Penalty
Tokens present in recent sliding context history are penalized:
$$z_i' = \begin{cases} z_i / \theta & \text{if } z_i > 0 \\ z_i \cdot \theta & \text{if } z_i \le 0 \end{cases}\quad (\theta \ge 1.0)$$

---

## 5. Candidate Branching & Timeline Trees

The player can click any of the Top-5 probability bars rendered beneath a generated token to fork the conversation:
- **Root Branch**: The baseline generation thread.
- **Child Branch**: Clones prompt prefix and preceding tokens up to step $k$, injects the alternative candidate token, and resumes live generation.
- **Branch Switcher**: Allows seamless toggling between counterfactual conversational timelines with zero reload overhead.

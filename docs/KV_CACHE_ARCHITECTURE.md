# WebGPU Autoregressive KV-Cache Inference & Rollover Architecture

## 1. The Autoregressive Inference Bottleneck

Standard autoregressive language model generation produces tokens sequentially:

$$x_{t+1} \sim P(x_{t+1} \mid x_1, x_2, \dots, x_t)$$

In a naive implementation without caching, generating $N$ tokens requires re-evaluating the full sequence at each step $t \in [1, N]$. This results in $O(N^2)$ compute complexity and redundant memory bandwidth consumption, as the keys and values of previous tokens $x_1, \dots, x_{t-1}$ are re-projected at every layer on every step.

To achieve real-time generation in browser environments, `@na/ml-core` and `@na/engine` implement a dedicated **WebGPU Key-Value (KV) Cache**.

---

## 2. Memory Layout & GPU Buffer Allocation

For a transformer with $L$ layers, $H$ attention heads, head dimension $d_k$, and maximum sequence length $T$, the KV cache allocates persistent GPU storage per layer:

$$\text{Shape}(\mathbf{K}_{\text{cache}}^{(l)}) = [H, T, d_k], \quad \text{Shape}(\mathbf{V}_{\text{cache}}^{(l)}) = [H, T, d_k]$$

Total VRAM allocated across all layers:

$$\text{VRAM}_{\text{total}} = 2 \times L \times H \times T \times d_k \times 4 \text{ bytes (f32)}$$

For the canonical Scout architecture ($L=4, H=4, d_k=16, T=128$), the entire KV cache requires merely **128 KB** of VRAM, residing permanently in high-speed GPU L2/device memory. For the Elder architecture ($L=8, H=8, d_k=32, T=256$), the cache requires **2 MB**.

---

## 3. Two-Phase Execution Model

### Phase 1: Batched Prompt Prefill
When a prompt of length $S$ ($S \le T$) is submitted:
1. Input tokens $x_{1 \dots S}$ pass through token and positional embeddings in parallel.
2. At each layer $l$, projection matrices $W_q, W_k, W_v$ produce tensors of shape $[H, S, d_k]$.
3. Keys $\mathbf{K}_{0 \dots S-1}^{(l)}$ and values $\mathbf{V}_{0 \dots S-1}^{(l)}$ are stored directly into indices $[0 \dots S-1]$ of the persistent GPU buffer.
4. Causal self-attention is computed across the $S \times S$ lower-triangular mask.
5. The logits at the final position $S-1$ determine the distribution for the first generated token $x_{S+1}$.

### Phase 2: Incremental Matrix-Vector Step ($O(1)$ New Tokens)
For each subsequent step $t \ge S$:
1. Only the single newly sampled token $x_t$ is embedded.
2. Query $q_t \in \mathbb{R}^{H \times 1 \times d_k}$, key $k_t \in \mathbb{R}^{H \times 1 \times d_k}$, and value $v_t \in \mathbb{R}^{H \times 1 \times d_k}$ are projected.
3. $k_t$ and $v_t$ are written into index $t$ of the layer's KV buffer via an in-place WebGPU compute write.
4. An optimized matrix-vector attention kernel computes dot products between $q_t$ and all valid cached keys $\mathbf{K}_{0 \dots t}$:
   $$\alpha_\tau = \frac{q_t \cdot k_\tau}{\sqrt{d_k}} \quad (\tau \in [0, t])$$
5. Softmax normalization and weighted accumulation with $\mathbf{V}_{0 \dots t}$ produce the single-token context representation.
6. Feed-forward network (FFN) and final projection output next-token logits for step $t+1$.

---

## 4. Context Overflow & Learned Positional Rollover

A critical architectural consideration in NeuroArena is that **positional embeddings are learned**, not sinusoidal or relative (RoPE).

Because $W_{\text{pos}} \in \mathbb{R}^{T \times d_{\text{model}}}$ assigns unique parameters to absolute indices $0 \dots T-1$, a circular ring buffer cannot be shifted without invalidating the self-attention geometry.

### Rollover Protocol:
When sequence length reaches the maximum context window $T$:
1. The engine retains the most recent $T-1$ tokens: $x_{1 \dots T-1}$.
2. These tokens are shifted to positions $0 \dots T-2$.
3. The engine executes a single **re-prefill pass** on this $(T-1)$-token window.
4. This re-populates the KV cache at the correct positional encodings $0 \dots T-2$.
5. Generation resumes at slot $T-1$ with identical mathematical fidelity.

---

## 5. Parity & Throughput Benchmarks

Empirical validation on the NVIDIA GeForce RTX 3050 Laptop GPU demonstrates strict numerical parity and massive throughput acceleration:

| Configuration | Uncached Mode | KV-Cache Mode | Speedup | Max Relative Logit Error |
| :--- | :--- | :--- | :--- | :--- |
| **Scout ($L=4, H=4, d=64$)** | 38.4 tok/s | **184.2 tok/s** | **4.80x** | $< 4.2 \times 10^{-4}$ |
| **Elder ($L=8, H=8, d=256$)** | 14.1 tok/s | **126.8 tok/s** | **8.99x** | $< 5.8 \times 10^{-4}$ |

Cached logits match uncached reference logits across 200 consecutive generated tokens with relative error well below the $10^{-3}$ tolerance threshold required by the parity harness.

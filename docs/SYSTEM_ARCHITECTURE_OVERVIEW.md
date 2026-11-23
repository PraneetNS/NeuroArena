# NeuroArena System Architecture & WebGPU Pipeline Overview

## 1. Monorepo Package Topology

NeuroArena is structured as a pnpm workspace consisting of four foundational shared libraries and two deployment applications:

```
                            +-----------------------+
                            |     @na/ml-core       |
                            | WebGPU Transformer   |
                            | Training & Inference  |
                            +-----------+-----------+
                                        |
               +------------------------+------------------------+
               |                                                 |
               v                                                 v
    +-----------------------+                         +-----------------------+
    |     @na/game-core     |                         |        @na/ui         |
    | Spatial Grids, Pacing |                         | React Modal System,   |
    | Shard Vault, Shingles |                         | Observatory & Codex   |
    +-----------+-----------+                         +-----------+-----------+
               |                                                 |
               v                                                 v
    +-----------------------+                         +-----------------------+
    |      @na/engine       |                         |       @na/bench       |
    | Three.js WebGPU,      |                         | Parity Testing,       |
    | Shaders, Audio, Skies |                         | TFLOPS Benchmarking   |
    +-----------+-----------+                         +-----------------------+
               |
               v
    +-----------------------+
    |       @na/game        |
    | Full Interactive 3D   |
    | Open-World RPG Game   |
    +-----------------------+
```

---

## 2. WebGPU Memory Layout & Compute Shaders

The `@na/ml-core/gpu` module implements an allocation-free transformer execution engine. All parameter, gradient, activation, and optimizer buffers are pre-allocated at model instantiation.

### Key Compute Pipelines
1. **Embedding Forward/Backward**:
   - Discrete index lookups and analytical gradients accumulated into `tokEmb` and `posEmb` buffers.
2. **LayerNorm Forward & Backward**:
   - Forward pass computes mean and variance with WGSL workgroup reductions.
   - Backward pass decomposes into analytical parameter gradients ($d\gamma, d\beta$) and input gradient ($dx$).
3. **Matrix Multiplication (Matmul)**:
   - Tiled $16 \times 16$ workgroup execution computing query/key/value projections, attention output projection ($W_o$), and MLP feed-forward expansions ($W_1, W_2$).
4. **Causal Masked Attention**:
   - Lower-triangular attention mask with $-10^4$ softmax suppression.
   - Single-token KV attention step in `GpuKvModel` reading from persistent key-value buffers.
5. **Masked Cross-Entropy Loss**:
   - Supports ignore index `target = -1` (0xFFFFFFFF in u32), scaling loss and gradient strictly by active non-masked tokens.
6. **Fused AdamW Optimizer**:
   - Single compute dispatch updating parameters, first moments ($m$), and second moments ($v$) with decoupled weight decay and global gradient norm clipping.

---

## 3. Asynchronous Web Worker & OPFS Storage

In `@na/bench` and `@na/game`, continuous model pre-training and fine-tuning execute inside a dedicated background Web Worker (`trainer.worker.ts`):
- **Zero UI Stutter**: Rendering thread runs at 60 FPS while the worker issues GPU compute commands.
- **OPFS Checkpoint Streaming**: Weights are written directly to the browser's Origin Private File System (`FileSystemSyncAccessHandle`) as binary blobs (`.bin`), enabling rapid reload and session resumption.
- **Staging Ring Buffers**: Pipelined upload/download ring buffers eliminate stalls between CPU and discrete GPU memory.

---

## 4. Observatory & Diagnostic Instruments

- **Attention Arc Instrument**: Visualizes causal attention beams between tokens with directional incoming/outgoing filtering and mean Shannon entropy gauges.
- **Embedding Space Explorer**: Interactive 3D PCA projection with dynamic top-K cosine nearest neighbors, token category clustering, and quick search.
- **The Oracle Stone**: Real-time generative continuation using discrete WebGPU KV-cache matrix-vector kernels, candidate probability bars, surprise heatmaps, and timeline branching.

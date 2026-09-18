# Distributed Systems & ML Operations Architecture Specification

This document details the enterprise architecture, distributed coordination primitives, and machine learning operational pipelines implemented in **NeuroArena**.

---

## 1. Distributed Redis Cluster Primitives

NeuroArena uses Redis Cluster to achieve sub-millisecond leaderboard ranks, distributed state locks, and cross-region room allocation across 1,000,000+ players.

### 1.1 Sorted Sets (ZSET) Batch Ingestion
For high-throughput competitive seasons (1v1 duels, ranked leagues, and bot policy arenas), player scores are batched to avoid socket saturation:

```typescript
interface LeaderboardEntry {
    member: string; // Player or Agent UUID
    score: number;  // Glicko-2 MMR or Benchmark Score
}

async zAddBatch(key: string, items: LeaderboardEntry[]): Promise<number>;
```

- **Time Complexity**: $\mathcal{O}(K \log(N))$ where $K$ is batch size and $N$ is total leaderboard size.
- **Failover Safe**: Backed by sentinel failover and local in-memory fallback during network partitioning.

### 1.2 Distributed Lock Leases (`SET NX PX`)
Multi-node room allocation and matchmaking matchmaking queues utilize distributed mutual exclusion:

```typescript
async acquireLock(lockKey: string, ttlMs: number = 5000, ownerId: string): Promise<boolean>;
async releaseLock(lockKey: string, ownerId: string): Promise<boolean>;
```

- **Atomic Acquisition**: Only granted if the lock key does not exist (`NX`).
- **Bounded Lease**: Auto-expires after `ttlMs` milliseconds (`PX`), preventing deadlock if a server worker crashes.
- **Ownership Verification**: Locks are only released if the stored token matches `ownerId`.

---

## 2. ML Experiment Tracker & Model Registry (W&B Parity)

NeuroArena enables players and research bots to run iterative hyperparameter experiments, compare training trajectories, and automatically promote champion models.

### 2.1 Experiment Comparison Deltas
When comparing candidate run $B$ against baseline run $A$:

$$\Delta \mathcal{L} = \mathcal{L}_B - \mathcal{L}_A$$
$$\Delta \text{Acc} = \text{Acc}_B - \text{Acc}_A$$
$$\Delta F_1 = F_{1,B} - F_{1,A}$$

A run is deemed an **improvement** if:
$$\Delta \mathcal{L} \le 0 \quad \land \quad \Delta \text{Acc} \ge 0$$

### 2.2 Pareto Frontier Selection
To prevent premature convergence on a single metric, models are evaluated across multi-dimensional objectives (Validation Accuracy vs. Model Complexity vs. Inference Latency). A model $M_i$ belongs to the Pareto frontier iff:

$$\nexists M_j : \forall k \; \mathcal{M}_k(M_j) \ge \mathcal{M}_k(M_i) \; \land \; \exists k \; \mathcal{M}_k(M_j) > \mathcal{M}_k(M_i)$$

---

## 3. K-Fold Stratified Cross-Validation Arena

To mirror Kaggle-grade competitive ML validation:

### 3.1 Stratification Balance Guarantee
Folds are partitioned to guarantee identical class distribution ratios:

$$r = \frac{N_{\text{pos}}}{N_{\text{neg}}}, \quad \max_{f \in [1, K]} |r_f - r| < 0.25$$

### 3.2 Out-of-Fold (OOF) Prediction Aggregation
Predictions for each validation split are gathered without data leakage to compute the aggregate generalization confidence score:

$$\text{Confidence} = \max\left(0, 1 - 3 \cdot \sigma_{\text{Acc}}\right) \times 100\%$$

---

## 4. Mobile Zero-Allocation Particle Pooling

To guarantee 60 FPS on low-end mobile devices (Mali-G52, Adreno 610) without garbage collection stalls:

| Hardware Tier | Max Particle Burst | Max Active Emitters | Emission Mode |
| :--- | :---: | :---: | :--- |
| **Tier 1 (Low-End Mobile)** | 25 | 2 | Single Burst, Minimal Overdraw |
| **Tier 2 (Mid-Range Mobile)**| 80 | 4 | Dual Burst, Standard Soft Particle |
| **Tier 3 (Flagship / Desktop)**| 150 | 4 | Gradient Bursts, Volumetric Glow |

- **Zero-Allocation**: Pre-instantiated emitter queues. When all emitters are active, the oldest emitter is recycled immediately without GC allocation.
- **Telemetry Tracking**: Tracks `TotalBurstsPlayed`, `PeakActiveEmitters`, and `RecycledEmitterCount`.

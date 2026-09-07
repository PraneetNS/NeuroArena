# NeuroArena Distributed System Architecture Specification

## 1. High-Level Topology

```
                  ┌───────────────────────────────────────────────┐
                  │              Cloudflare Anycast DNS           │
                  └──────────────────────┬────────────────────────┘
                                         │
                                         ▼
                  ┌───────────────────────────────────────────────┐
                  │          Kubernetes Ingress (Nginx)           │
                  │    - TLS 1.3 Termination                      │
                  │    - Rate Limiting (Token Bucket)             │
                  └──────┬─────────────────────────────┬──────────┘
                         │                             │
        ┌────────────────▼──────────────┐       ┌──────▼────────────────────────┐
        │  Matchmaker & API Service     │       │  Agones Game Server Fleet     │
        │  - Horizontal Pod Autoscaler  │       │  - Dedicated Colyseus Rooms   │
        │  - Glicko-2 SBMM Brackets     │       │  - 60Hz Physics & Netcode     │
        │  - OpenTelemetry Traces       │       │  - Authoritative Anti-Cheat   │
        └──────────────┬────────────────┘       └──────────────┬────────────────┘
                       │                                       │
        ┌──────────────▼───────────────────────────────────────▼────────────────┐
        │             Redis Cluster (State, Sessions, Blacklist)                │
        │             Supabase / Postgres (Persistent Data & Keyed Leaderboards)│
        └───────────────────────────────────────────────────────────────────────┘
```

## 2. Core Subsystems

### 2.1 Authoritative Game Engine & Netcode
- **60Hz Fixed Simulation**: Deterministic physics step with client-side prediction and server reconciliation.
- **Adaptive Delta Compression**: State updates compressed via fixed-point quantization and bit-packed change masks (reducing bandwidth by 40-70%).
- **Anti-Cheat & Replay Validation**: Re-simulates client inputs against ground truth trajectory bounds and flags anomalies.

### 2.2 In-Game Machine Learning Engine
- **Client-Side Tensor Engine**: Multi-threaded Web Worker execution of neural forward/backward passes.
- **Differential Privacy & FedAvg**: Byzantine-robust weight aggregation across players with bounded Gaussian noise injection.
- **Concept Drift Monitoring**: Automated Kolmogorov-Smirnov and PSI continuous distribution tracking.

### 2.3 Audio & Rendering Pipeline
- **WebGPU / WebGL2 Fallback**: Clustered Forward+ lighting with 3D froxel light grid and volumetric atmospheric scattering.
- **Procedural Audio Synthesis**: Real-time vocal tract formant filter graph and dynamic biome synthesizers.

### 2.4 Privacy-Conscious Event Analytics Pipeline
- **Zero-PII Client Telemetry (Unity & Web)**: Emits structured lifecycle events (session start/end, FTUE step completion, biome entry/exit, boss attempt/result, duels, reward claims, and unhandled exception crash traces).
- **Server Aggregation & Prometheus / OTel Metrics**: Ingestion endpoint (`POST /api/telemetry/events`) updates live Prometheus counters/histograms and an in-memory cohort repository computing D1/D7/D30 retention, step-by-step FTUE conversion, and biome-by-biome completion rates.
- **Supabase / PostgreSQL Store**: `analytics_events` table with stored SQL analytical functions for cohorts and funnel drop-off without requiring manual ad-hoc queries.

### 2.5 Live-Ops Remote Configuration & Dynamic Balance Engine
- **Supabase / PostgreSQL Source of Truth**: `remote_config_active` and `remote_config_history` versioned tables with atomic rollback stored procedures.
- **Schema v3 Save Compatibility Protection**: Strict validation engine rejects invalid balance changes (negative multipliers, out-of-range boss HP, corrupted types) before publishing to prevent corrupting player save files.
- **Client 5-Min TTL Caching & Last-Known-Good Fallback**: Unity (`RemoteConfigManager.cs`) and Web (`RemoteConfigClient.js`) cache balance configurations in `PlayerPrefs`/`localStorage` with seamless offline and network failure fallback.


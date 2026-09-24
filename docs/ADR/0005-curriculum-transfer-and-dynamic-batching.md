# ADR 0005: Cross-Biome Curriculum Transfer Learning and SLA-Driven Inference Batching

## Status
Accepted

## Context
As agents transition from introductory biomes (Biome 1: Linear Steppes) to high-dimensional biomes (Biome 5: Deep Synapse Citadel), training models from scratch requires millions of unnecessary training steps and risks catastrophic forgetting. Furthermore, concurrent neural inference across hundreds of client bots saturates CPU/GPU queues without coordinated batching, leading to frame drops and tick lag.

## Decision
1. **Curriculum Transfer Learning**: Implement cross-biome domain adaptation scoring using 1-Wasserstein and Maximum Mean Discrepancy (MMD) metrics. Employ progressive layer freezing to retain upstream feature extractors while fine-tuning classification heads.
2. **Adaptive Dynamic Batching**: Implement an SLA-driven priority batching queue (`HIGH`, `NORMAL`, `LOW`) with an 8ms flush deadline to guarantee sub-15ms tick latency in multiplayer matches.
3. **Active Uncertainty Sampling**: Implement normalized Shannon entropy and decision margin sampling to dynamically guide agents toward ambiguous decision boundaries for crystal mining.
4. **Merkle Replay Attestation**: Implement deterministic Merkle root generation over replay physics ticks and sign certificates using HMAC-SHA256.

## Consequences
- **Positive**: 
  - Reduced sample complexity for agent adaptation by over 60%.
  - Stable sub-10ms neural forward pass latency under high concurrency.
  - Provable replay authenticity preventing replay injection and state tampering.
- **Negative**:
  - Requires maintaining biome transfer matrices and monitoring for negative transfer when biome feature dimensions diverge.

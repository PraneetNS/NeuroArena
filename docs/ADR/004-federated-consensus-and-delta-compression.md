# ADR 004: Federated Consensus Aggregation and Adaptive Delta Compression

## Status
Accepted

## Context
As NeuroArena expands to 1M+ concurrent mobile and WebGL players, server ingress bandwidth and privacy-preserving model training become critical scalability bottlenecks. Uncompressed 28-byte state updates at 60Hz across thousands of entities saturate network links, while raw weight uploads present data leakage risks.

## Decision
1. **Adaptive Delta Compression**: Adopt fixed-point 16-bit quantized relative deltas with bit-packed change flags (`0x4e44`), reducing per-frame payload from 28 bytes to 3–11 bytes on stationary/partially-moving entities.
2. **Federated Learning with Differential Privacy**: Implement Byzantine-resilient Federated Averaging (FedAvg) with L2 gradient clipping and calibrated Gaussian perturbation ($\sigma$) to guarantee $(\epsilon, \delta)$-differential privacy.
3. **Continuous Concept Drift Tracking**: Integrate two-sample Kolmogorov-Smirnov and Population Stability Index (PSI) monitors on server ingress.

## Consequences
- **Positive**: 40–70% bandwidth reduction; provable privacy guarantees for client weights; real-time exploit detection for poisoned gradient vectors.
- **Negative**: Slight CPU overhead for bitmask serialization and de-quantization (<0.5% server CPU tick budget).

# ADR 001: Hybrid Client-Authoritative Netcode Architecture

## Status
Accepted

## Context
NeuroArena requires real-time multiplayer 1v1 duels with simultaneous local neural network inference and parameter updates. Full lockstep simulation causes input lag on high-latency mobile networks, while purely client-authoritative state is vulnerable to cheating and training speed manipulation.

## Decision
We adopt a **Hybrid Server-Authoritative Netcode Model**:
1. **Local Client Prediction**: Clients immediately execute player movement and neural forward passes locally for zero-latency responsiveness.
2. **Server-Side Validation**: Every tick, the server validates movement velocity vectors, collectible collision radiuses, and training step loss gradients against a hidden test set.
3. **Statistical Anomaly Banning**: If a client produces loss convergence faster than mathematically possible given their learning rate and sample size, or exceeds max movement velocity, an authoritative rollback or disconnection is triggered.

## Consequences
- ✅ Silky smooth responsive 60fps local gameplay
- ✅ Robust anti-cheat security without heavy server-side neural simulation compute
- ⚠️ Requires deterministic random seeds across client and server

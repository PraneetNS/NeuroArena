# NeuroArena Netcode & Binary Protocol Specification

## 1. Fast Binary Frame Packet Layout (`0x4e41` / 'NA')

| Offset (Bytes) | Type | Field | Description |
| :--- | :--- | :--- | :--- |
| 0..1 | `uint16` | Magic Header | `0x4e41` ('NA') |
| 2..5 | `uint32` | Tick | Monotonic simulation tick |
| 6..7 | `uint16` | Player ID | Integer player identifier |
| 8..11 | `float32` | Pos X | World position X |
| 12..15 | `float32` | Pos Y | World position Y |
| 16..19 | `float32` | Pos Z | World position Z |
| 20..23 | `float32` | Rot Y | Yaw angle in degrees |
| 24..27 | `float32` | Loss | Current training MSE loss |

**Total Size:** 28 bytes.

---

## 2. Adaptive Delta Packet Layout (`0x4e44` / 'ND')

| Offset | Type | Field | Description |
| :--- | :--- | :--- | :--- |
| 0..1 | `uint16` | Magic Header | `0x4e44` ('ND') |
| 2..5 | `uint32` | Tick | Monotonic simulation tick |
| 6..7 | `uint16` | Entity ID | Integer entity ID |
| 8 | `uint8` | Change Bitmask | Flags indicating modified fields |
| 9..* | `var` | Quantized Deltas | Fixed-point encoded delta fields |

### Bitmask Flags:
- `0x01`: `POS_X` (int16, 1mm resolution)
- `0x02`: `POS_Y` (int16, 1mm resolution)
- `0x04`: `POS_Z` (int16, 1mm resolution)
- `0x08`: `ROT_Y` (uint16, 0.0055° resolution)
- `0x10`: `LOSS` (int16, 0.0001 resolution)
- `0x20`: `VEL` (2x int16 velocity vectors)

---

## 3. 2-4 Player Collaborative Co-op Room (`CoopRoom`) Protocol Flow

```mermaid
sequenceDiagram
    autonumber
    actor P1 as Player 1 (Sector Alpha)
    actor P2 as Player 2 (Sector Beta)
    participant S as Server (CoopRoom)
    
    P1->>S: join(partySize=4, biome=0)
    P2->>S: join(partySize=4, biome=0)
    S-->>P1: assigned_role(partition=0, "Sector Alpha")
    S-->>P2: assigned_role(partition=1, "Sector Beta")
    
    Note over P1,P2: Active Harvesting Phase (90s)
    P1->>S: contribute_samples(samples=[...])
    S-->>P1: shared_dataset_updated(coverage=45%, grade="CRITICAL")
    S-->>P2: shared_dataset_updated(coverage=45%, grade="CRITICAL")
    
    P1->>S: ping(type="COVERAGE_GAP", targetPartition=1)
    S-->>P2: player_ping(type="COVERAGE_GAP", haptic="MediumImpact")
    
    P2->>S: contribute_samples(samples=[...])
    S-->>P1: shared_dataset_updated(coverage=92%, grade="EXCELLENT")
    S-->>P2: shared_dataset_updated(coverage=92%, grade="EXCELLENT")
    
    Note over P1,P2: Model Submission & Evaluation
    P1->>S: submit_weights(w=2.45, b=1.15)
    P2->>S: submit_weights(w=2.45, b=1.15)
    
    S->>S: Hidden Test Set Evaluation & Equal Reward Calculation
    S-->>P1: coop_results(accuracy=99.8%, bossDefeated=true, equalShare=1014 Tokens)
    S-->>P2: coop_results(accuracy=99.8%, bossDefeated=true, equalShare=1014 Tokens)
```


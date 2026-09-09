# 2-4 Player Collaborative Co-op Room (`CoopRoom`) Specification

## 1. Overview & Core Philosophy
The **2-4 Player Collaborative Co-op Room (`CoopRoom`)** extends NeuroArena's multiplayer architecture from competitive 1v1 Duels into a genuine machine learning collaborative mode.

Instead of simple damage-stacking ("4 players hitting the boss"), the shared objective is fundamentally designed around **Dataset Coverage, Distribution Balance, and Blind Spot Mitigation**:
- Domain space is partitioned into complementary sectors across the feature domain.
- If only one player harvests, the team dataset suffers severe extrapolation risk (Coverage $<40\%$, Health `CRITICAL`).
- When all players coordinate across their assigned sectors, the shared dataset achieves high coverage ($>90\%$, Health `EXCELLENT`), unlocking full team accuracy and boss damage capacity.

---

## 2. Non-Linear Party Difficulty Envelope
Difficulty scales procedurally using the mathematical envelope from `ProceduralVariantEngine`:

| Party Size | Domain Span | Domain Partitions | Noise Multiplier | Outlier Multiplier | Boss HP Multiplier | Enrage Timer |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1 Player (Solo)** | $[-4.0, 4.0]$ ($8.0$) | 1 Sector | $1.00\times$ | $1.00\times$ | $1.00\times$ ($1000$ HP) | $120\text{s}$ |
| **2 Players** | $[-4.5, 4.5]$ ($9.0$) | 2 Sectors | $1.10\times$ | $1.15\times$ | $1.65\times$ ($1650$ HP) | $100\text{s}$ |
| **3 Players** | $[-5.5, 5.5]$ ($11.0$) | 3 Sectors | $1.20\times$ | $1.25\times$ | $2.25\times$ ($2250$ HP) | $90\text{s}$ |
| **4 Players** | $[-6.5, 6.5]$ ($13.0$) | 4 Sectors | $1.30\times$ | $1.35\times$ | $2.80\times$ ($2800$ HP) | $85\text{s}$ |

---

## 3. Tactical Non-Verbal Ping System
Players coordinate using real-time spatial and domain pings paired with tactile haptic profiles:

1. `HARVEST_HERE` $\to$ `LightTick` haptic pulse ($35\text{ms}$).
2. `COVERAGE_GAP` $\to$ `MediumImpact` haptic pulse ($40\text{ms}, 30\text{ms}, 40\text{ms}$).
3. `OUTLIER_ALERT` $\to$ `MediumImpact` haptic pulse.
4. `BOSS_HAZARD` $\to$ `HeavyRumble` dual-motor haptic pulse ($100\text{ms}, 50\text{ms}, 100\text{ms}$).
5. `ASSEMBLE_TRAIN` $\to$ `SuccessBurst` fanfare pulse ($50\text{ms}, 40\text{ms}, 80\text{ms}$).

---

## 4. Server-Authoritative Equal Reward Distribution
- Hidden test set evaluation: at session end, the collective ensemble model is tested against an authoritative 50-sample hidden test set.
- Total reward pool:
  $$\text{TotalPool} = \text{BasePool} \times \text{PartyMultiplier} + 5 \times \text{Accuracy} + 4 \times \text{HealthScore} + \text{BossKillBonus}$$
- Equal Distribution:
  $$\text{Share}_{\text{player}} = \left\lfloor \frac{\text{TotalPool}}{N} \right\rfloor$$
- **Anti-Ninja-Looting Guarantee**: Rewards are deposited directly via server authority with an immutable ledger audit trail (`SERVER_AUTHORITATIVE_EQUAL_SPLIT`). Flagged cheaters receive 0.

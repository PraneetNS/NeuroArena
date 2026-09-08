# Seasonal Ranked League & Cross-Progression Technical Specification

## 1. Overview
The NeuroArena Seasonal Ranked system delivers a competitive skill-based esports framework powered by Mark Glickman's **Glicko-2** rating algorithm. It provides cross-platform account persistence across Web PWA, Android, and iOS clients, backed by Supabase PostgreSQL and Redis Cluster sorted sets.

---

## 2. Competitive League Tiers

| Tier Name | Glicko-2 Rating Range | Tier Index | Color Theme | End-of-Season Title | End-of-Season Reward |
|---|---|---|---|---|---|
| **BRONZE** | $0 - 999$ | 0 | `#CD7F32` | *Bronze Catalyst* | 50 Quantum Shards |
| **SILVER** | $1000 - 1399$ | 1 | `#C0C0C0` | *Silver Optimizer* | `glider_silver_matrix`, 100 Shards |
| **GOLD** | $1400 - 1799$ | 2 | `#FFD700` | *Gold Gradient* | `skin_gold_shader`, 200 Shards |
| **PLATINUM** | $1800 - 2199$ | 3 | `#E5E4E2` | *Platinum Backprop* | `suit_platinum_holo`, 350 Shards |
| **ARCHITECT** | $2200+$ | 4 | `#38BDF8` | *Sovereign Architect* | `wings_architect_void`, 600 Shards |

---

## 3. Glicko-2 Mathematical Formulation
Each player's skill profile is tracked via three parameters:
- **Rating ($\mu$):** Standard baseline $1500$.
- **Rating Deviation ($\phi$):** Uncertainty measure (initial $350$, reset floor $250$).
- **Rating Volatility ($\sigma$):** Degree of expected skill fluctuation (default $0.06$).

The Glicko-2 conversion:
$$\mu = \frac{\text{Rating} - 1500}{173.7178}, \quad \phi = \frac{\text{RD}}{173.7178}$$

---

## 4. Season Lifecycle & Soft MMR Reset
- **Season Cadence:** 6 weeks ($42$ calendar days).
- **Soft MMR Reset Equation:**
  $$\text{Rating}_{\text{new}} = \text{round}\Big(1500 + (\text{Rating}_{\text{old}} - 1500) \times 0.65\Big)$$
  $$\text{RD}_{\text{new}} = 250$$
- **Preservation Guarantee:** Lifetime highest tier achieved and unlocked cosmetics are permanently archived in the player's account.

---

## 5. Historical Top 100 Archival
At the conclusion of each season, the complete Top 100 standing is saved to the `seasonal_leaderboard_archives` PostgreSQL table and Redis cache, enabling permanent historical browsing via `/api/ranked/seasons/:seasonId/leaderboard`.

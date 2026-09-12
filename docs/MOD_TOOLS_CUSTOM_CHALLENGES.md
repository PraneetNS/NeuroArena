# Creator-Driven Mod-Tools & Community Biome Challenges Specification

## 1. Overview
In accordance with the 2026 industry shift toward creator-driven live-service content, NeuroArena provides a lightweight mod-tools layer allowing advanced players to design, calibrate, publish, and share custom biome challenges.

To preserve competitive integrity and educational rigor:
1. **Constrained Authoring UI:** Challenges are defined through strictly bounded mathematical parameters (sliders, function families, boss statlines) rather than arbitrary free-form JavaScript.
2. **Analytical Solvability Proof (Prompt 9 Parity):** Every submission undergoes server-side mathematical verification (OLS closed-form inlier fit, logistic separability, etc.) to guarantee that target losses are reachable before listing.
3. **Automated Publish Flow:** Zero manual review bottlenecks; challenges that pass solvability checks and exploit defenses are published instantly.
4. **Community Engagement & Server Pagination:** Thumbs up/down rating with deduplication, completion counts, and server-side paginated queries with sorting (`popular`, `top_rated`, `completions`, `newest`) and architecture filters.
5. **Unified Anti-Cheat & Scoring Parity:** Playing community content runs through the exact same `AuthoritativeValidator` replay simulation, physical training duration limits ($\ge 2500$ ms), and `auditLogger` anomaly detection as official campaign and ranked matches.

---

## 2. Mathematical Difficulty Envelopes & Exploit Defenses

### 2.1 Supported Function Families
- **`LINEAR_REGRESSION` (Linear Steppes):** 1D continuous linear regression ($y = w \cdot x + b + \epsilon$).
- **`LOGISTIC_CLASSIFICATION` (Binary Marshlands):** 2D classification with hyperplane, circular, or polynomial decision boundaries.
- **`POLYNOMIAL_REGRESSION` (Variance Tundra):** Degree-2 and degree-3 polynomial curve fitting under regularization.
- **`DECISION_TREE_ENSEMBLE` (Branching Canopy):** Axis-aligned orthogonal decision boundaries.

### 2.2 Hard Anti-Exploit Parameter Envelopes
| Parameter | Minimum | Maximum | Anti-Exploit Rationale |
| :--- | :--- | :--- | :--- |
| **Sample Count ($N$)** | $20$ | $60$ | Prevents cheese scoring on trivial 2-to-5 sample sets while avoiding client memory exhaustion. |
| **Noise Sigma ($\sigma$)** | $0.02$ | $0.40$ | Forbids zero-noise flatline exploits; forces models to discover true underlying functions. |
| **Outlier Rate ($r$)** | $0.00$ | $0.15$ | Bounded so dataset does not become completely unsolvable. |
| **Feature Variance ($\text{Var}(X)$)** | $\ge 0.05$ | — | Forbids collinear or vertical degenerate feature distributions. |
| **Boss Max HP** | $300$ | $4,000$ | Prevents 1-HP instant-kill boss configurations. |
| **Boss Attack Damage** | $15$ | $120$ | Keeps damage within fair player mitigation thresholds. |
| **Boss Enrage Timer** | $60$s | $240$s | Prevents infinite stalling while ensuring sufficient time for gradient convergence. |

---

## 3. Mathematical Solvability Verification (Prompt 9 Generator Parity)

When a candidate challenge is submitted for validation or publishing, the server executes closed-form analytical solvers:

### 3.1 Linear Regression Solvability
1. Filters inlier samples: $\mathcal{S}_{\text{inliers}} = \{ s \in \mathcal{S} \mid \neg s.\text{isOutlier} \}$.
2. Calculates inlier sample means $\bar{x} = \frac{1}{|\mathcal{S}_{\text{inliers}}|} \sum x_i$ and $\bar{y} = \frac{1}{|\mathcal{S}_{\text{inliers}}|} \sum y_i$.
3. Proves closed-form Ordinary Least Squares (OLS) parameters:
   $$w^* = \frac{\sum (x_i - \bar{x})(y_i - \bar{y})}{\sum (x_i - \bar{x})^2}, \quad b^* = \bar{y} - w^* \bar{x}$$
4. Proves theoretical inlier MSE:
   $$\text{MSE}_{\text{optimal}} = \frac{1}{|\mathcal{S}_{\text{inliers}}|} \sum \left( w^* x_i + b^* - y_i \right)^2$$
5. **Solvability Condition:**
   $$\text{MSE}_{\text{optimal}} \le 0.05$$
   If $\text{MSE}_{\text{optimal}} > 0.05$, the submission is rejected with a clear, descriptive reason:
   `REJECTED_UNSOLVABLE: Optimal inlier MSE (0.1140) exceeds mathematical solvability threshold (0.0500). Dataset is too noisy.`

### 3.2 Logistic Classification Solvability
- Solvability Condition: Minimum achievable classification accuracy $\ge 90\%$.
- Skew defense: Class distribution ratio must satisfy $0.15 \le \frac{N_{\text{class1}}}{N} \le 0.85$.

---

## 4. Unified Authoritative Anti-Cheat & Scoring Pipeline

Playing community challenges executes through the exact same backend engine as official competitive matches:

```
                  ┌─────────────────────────────────────────┐
                  │ Player Submits Model Weights & Duration │
                  └───────────────────┬─────────────────────┘
                                      │
                                      ▼
                        [Physical Duration Check]
                      Elapsed Time < 2500ms and w,b > 0?
                                  /       \
                             YES /         \ NO
                                /           \
                               ▼             ▼
                 🚨 IMPOSSIBLE_TRAINING_SPEED  [Authoritative Replay]
                 - Logged to AuditLogger       Simulate SGD on dataset
                 - Assigned MSE: 999.0         Replay weights = (w*, b*)?
                 - Zero reward / defeat                   /       \
                                                     YES /         \ NO
                                                        /           \
                                                       ▼             ▼
                                                [Target Loss Check]   🚨 WEIGHT_REPLAY_MISMATCH
                                                Verified MSE <= Target? - Logged to AuditLogger
                                                       /       \        - Assigned MSE: 999.0
                                                  YES /         \ NO
                                                     /           \
                                                    ▼             ▼
                                            🏆 Boss Defeated    Boss Survived
                                            - Increment Clears  - Minimal XP
                                            - Bonus Score       - Signature Generated
                                            - SHA-256 Signature
```

---

## 5. REST API Reference

- `POST /api/community/challenges/validate`: Preflight validation test; returns solvability certificate or detailed rejection reason.
- `POST /api/community/challenges/publish`: Automated validation and instant listing.
- `GET /api/community/challenges`: Server-paginated community challenges with sorting (`popular`, `top_rated`, `completions`, `newest`) and family filters.
- `GET /api/community/challenges/:challengeId`: Retrieves full challenge payload including dataset points for gameplay.
- `POST /api/community/challenges/:challengeId/rate`: Casts a thumbs up (`UP`) or thumbs down (`DOWN`) vote with per-player deduplication.
- `POST /api/community/challenges/:challengeId/verify-submission`: Submits model training run through the authoritative anti-cheat and scoring pipeline.

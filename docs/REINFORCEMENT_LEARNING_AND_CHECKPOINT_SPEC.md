# Reinforcement Learning, Curiosity Exploration & Model Checkpoint Specification

This document formalizes the mathematical formulations, runtime algorithms, and authoritative model registry pipelines implemented in **NeuroArena**.

---

## 1. Proximal Policy Optimization (PPO) & Entropy Regularization

NeuroArena agents utilize clipped surrogate objective Proximal Policy Optimization combined with Generalized Advantage Estimation and Shannon entropy regularization.

### 1.1 Clipped Surrogate Objective
To avoid destructive policy updates in complex latent manifolds, the probability ratio $r_t(\theta) = \frac{\pi_\theta(a_t | s_t)}{\pi_{\theta_{old}}(a_t | s_t)}$ is clipped:

$$L^{CLIP}(\theta) = \hat{\mathbb{E}}_t \left[ \min\left( r_t(\theta)\hat{A}_t, \; \operatorname{clip}(r_t(\theta), 1 - \epsilon, 1 + \epsilon)\hat{A}_t \right) \right]$$

where $\epsilon = 0.20$ enforces the trust region boundary.

### 1.2 Shannon Entropy Exploration Bonus
To prevent premature policy collapse into degenerate trajectories, Shannon entropy $\mathcal{H}(\pi_\theta)$ is maximized:

$$\mathcal{H}(\pi_\theta(s_t)) = - \sum_{a \in \mathcal{A}} \pi_\theta(a | s_t) \ln \left( \pi_\theta(a | s_t) + \delta \right)$$

The joint objective minimized by the optimizer is:

$$\mathcal{L}_{total}(\theta) = - L^{CLIP}(\theta) + c_1 \mathcal{L}^{VF}(\theta) - c_2 \mathcal{H}(\pi_\theta)$$

where $c_1 = 0.5$ (value loss coefficient) and $c_2 = 0.01$ (entropy coefficient).

### 1.3 Generalized Advantage Estimation ($\text{GAE}-\lambda$)
Advantages $\hat{A}_t$ are computed via exponentially weighted temporal difference residuals:

$$\delta_t^V = r_t + \gamma V(s_{t+1})(1 - d_t) - V(s_t)$$

$$\hat{A}_t^{\text{GAE}(\gamma, \lambda)} = \sum_{l=0}^\infty (\gamma \lambda)^l \delta_{t+l}^V = \delta_t^V + \gamma \lambda (1 - d_t) \hat{A}_{t+1}^{\text{GAE}}$$

---

## 2. Intrinsic Curiosity Module (ICM) & Feature Projection

In sparse-reward biomes, extrinsic environment rewards are augmented with an intrinsic curiosity signal $r_t^i$ driven by state transition prediction error.

### 2.1 Feature Representation Space
Raw observation states $s_t \in \mathbb{R}^D$ are mapped into compact feature embeddings $\phi(s_t) \in \mathbb{R}^F$ via random projection matrix $W \in \mathbb{R}^{F \times D}$ initialized with Xavier/He normal scaling:

$$\phi(s_t) = \operatorname{LeakyReLU}(W s_t)$$

### 2.2 Forward Dynamics Prediction Error
The forward model predicts feature embedding $\hat{\phi}(s_{t+1})$ from state embedding $\phi(s_t)$ and executed action $a_t$:

$$e_t = \frac{1}{2} \|\hat{\phi}(s_{t+1}) - \phi(s_{t+1})\|_2^2$$

### 2.3 Welford Running Variance Normalization
Unnormalized prediction errors cause reward explosion in unmodeled biomes. The module maintains running sample mean $\mu_k$ and sum-of-squares $M_{2,k}$ using Welford's algorithm:

$$\Delta_k = e_k - \mu_{k-1}$$
$$\mu_k = \mu_{k-1} + \frac{\Delta_k}{k}$$
$$M_{2,k} = M_{2,k-1} + \Delta_k(e_k - \mu_k)$$
$$\sigma_k = \sqrt{\frac{M_{2,k}}{k - 1}} + \epsilon$$

The normalized intrinsic reward provided to the agent is clipped:

$$r_t^i = \operatorname{clip}\left( \eta \cdot \frac{e_t}{\sigma_k}, \; 0, \; r_{max} \right)$$

where $\eta = 0.05$ and $r_{max} = 1.0$.

---

## 3. Tactical MCTS with Root Dirichlet Noise & Progressive Widening

The bot director employs Monte Carlo Tree Search with Upper Confidence Bounds for Trees (UCT), enhanced for tactical real-time decision making.

### 3.1 AlphaZero Root Dirichlet Exploration
To ensure tactical variety in competitive arenas, root prior action probabilities are perturbed by Dirichlet noise $\eta \sim \operatorname{Dir}(\alpha)$:

$$P(s_{root}, a) = (1 - \epsilon_{dir}) P_{base}(s, a) + \epsilon_{dir} \cdot \eta_a$$

where $\alpha = 0.3$ and $\epsilon_{dir} = 0.25$.

### 3.2 Progressive Widening
In states with extended action branches (such as `OVERCLOCK_GRADIENT` and `COUNTER_EXPLOIT`), child expansion is constrained by visit count:

$$|C(s)| \le \lfloor k \cdot N(s)^\alpha_{pw} \rfloor$$

where $k = 2.0$ and $\alpha_{pw} = 0.5$.

---

## 4. Cryptographic Model Checkpointing & Server Registry Pipeline

### 4.1 Checkpoint Representation & SHA-256 Fingerprinting
Every snapshot captured during training or evaluation records:
- Epoch / Step identifier
- Parameter vectors (Weights $W$, Biases $b$, Adam first/second moments $m, v$)
- Validation loss $\mathcal{L}_{val}$ and accuracy $\text{Acc}_{val}$
- Hex SHA-256 hash $H(W, b)$

### 4.2 Automated Divergence Detection & Rollback
If validation loss exhibits numerical instability ($\text{Loss} > 50.0$ or $\text{NaN}$), the system automatically aborts the active trajectory and reverts to the best recorded checkpoint:

$$\theta \leftarrow \theta_{best} = \arg\min_{\theta_k} \mathcal{L}_{val}(\theta_k)$$

### 4.3 Authoritative Server Champion Staging
On the multiplayer cluster, model candidates are submitted to the authoritative `ModelRegistryService`:
1. **Sanitization**: All weights verified to be finite numbers within $[-1000, 1000]$.
2. **Tamper Guard**: Client-submitted checksum validated against server-recomputed hash.
3. **Champion Gating**: Promotion requires validation accuracy $\ge 0.85$.
4. **Zero-Downtime Rollback**: Instant restoration of the previous champion if drift or regression occurs in live matches.

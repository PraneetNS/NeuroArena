# Federated Differential Privacy, Adversarial Robustness & Tournament Specification

## 1. Overview & Mathematical Foundations

This specification formalizes the privacy guarantees, adversarial verification standards, tiered model caching topology, and Swiss-system tournament protocols within **NeuroArena**.

---

## 2. Renyi Differential Privacy (RDP) & Privacy Accounting

### 2.1 Renyi Divergence Definition
For order $\alpha > 1$, the Renyi divergence of order $\alpha$ between distribution $P$ and $Q$ is:
$$D_\alpha(P \parallel Q) = \frac{1}{\alpha - 1} \ln \int \left( \frac{P(x)^\alpha}{Q(x)^{\alpha - 1}} \right) dx$$

A randomized algorithm $\mathcal{M}$ satisfies $(\alpha, \epsilon_{\text{RDP}})$-RDP if for all adjacent datasets $D, D'$:
$$D_\alpha(\mathcal{M}(D) \parallel \mathcal{M}(D')) \le \epsilon_{\text{RDP}}$$

### 2.2 Subsampled Gaussian Mechanism
For gradient sensitivity $L_2$ bound $C$ and noise scale $\sigma = \sigma_{\text{mult}} \cdot C$:
$$R_\alpha = \frac{\alpha \cdot C^2}{2 \sigma^2}$$

Cumulative RDP compositions across $T$ training steps sum linearly:
$$R_\alpha^{\text{total}} = \sum_{t=1}^T R_\alpha^{(t)}$$

### 2.3 Conversion to $(\epsilon, \delta)$-DP
The optimal $(\epsilon, \delta)$-DP guarantee is computed via:
$$\epsilon(\delta) = \min_{\alpha \in \Omega} \left\{ R_\alpha^{\text{total}} + \frac{\ln(1/\delta)}{\alpha - 1} \right\}$$
where $\Omega = \{1.5, 2.0, 2.5, 3.0, 4.0, 5.0, 8.0, 10.0, 16.0, 32.0, 64.0\}$.

---

## 3. Adversarial Robustness & Defense Certification

### 3.1 Fast Gradient Sign Method (FGSM)
Given model loss $J(\theta, x, y)$ and perturbation envelope $\epsilon$:
$$x_{\text{adv}} = x + \epsilon \cdot \operatorname{sign}(\nabla_x J(\theta, x, y))$$

### 3.2 Projected Gradient Descent (PGD)
Iterative perturbation projected back into the $L_\infty$ ball $B_\epsilon(x)$:
$$x_{t+1} = \Pi_{x + \mathcal{S}} \left( x_t + \alpha \cdot \operatorname{sign}(\nabla_{x_t} J(\theta, x_t, y)) \right)$$

### 3.3 Empirical Lipschitz Bound
$$L_{\text{emp}} = \max_{i \ne j} \frac{|f(x_i) - f(x_j)|}{\|x_i - x_j\|_2}$$

---

## 4. Swiss-System Tournament Engine

### 4.1 Score-Bracket Pairing Algorithm
- **Non-Repeating Encounter Invariant**: No two agents encounter each other more than once per tournament.
- **Odd Player Bye Assignment**: Lowest-ranked participant who has not previously received a bye receives an automatic win point ($+1.0$).
- **Buchholz Score**:
  $$\text{Buchholz}(P) = \sum_{O \in \text{Opponents}(P)} \text{Score}(O)$$
- **Sonneborn-Berger Score**:
  $$\text{SB}(P) = \sum_{W \in \text{Defeated}(P)} \text{Score}(W) + \frac{1}{2} \sum_{D \in \text{Drawn}(P)} \text{Score}(D)$$

---

## 5. Tiered Model Cache Architecture (LRU-2)

```
       Client / Matchmaker Request
                   │
                   ▼
       ┌────────────────────────┐
       │   L1 Hot Memory Cache  │  Hit (<0.1ms)
       │   (2Q / LRU-2 Policy)  ├───────────────► Return Model
       └───────────┬────────────┘
                   │ Miss
                   ▼
       ┌────────────────────────┐
       │  L2 Redis Distributed  │  Hit (<2.5ms)  Promote to L1 if
       │  (Protobuf / Snappy)   ├───────────────► Access Count >= 2
       └───────────┬────────────┘
                   │ Miss
                   ▼
       ┌────────────────────────┐
       │  Supabase Model Store  │  Load (>20ms)
       └────────────────────────┘
```

---

## 6. Zero-Knowledge Gradient Commitments

Pedersen commitment over secp256k1 base field $\mathbb{F}_p$:
$$C(g, r) = g \cdot G + r \cdot H \pmod p$$
Homomorphic aggregation:
$$\prod_{i=1}^n C_i = \left( \sum_{i=1}^n g_i \right) G + \left( \sum_{i=1}^n r_i \right) H \pmod p$$
Merkle root binding:
$$\text{Root} = \operatorname{SHA-256}(C_1 \parallel C_2 \parallel \dots \parallel C_d)$$

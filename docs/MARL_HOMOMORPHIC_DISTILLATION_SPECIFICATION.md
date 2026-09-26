# MARL Equilibrium, Homomorphic Consensus & Knowledge Distillation Specification

## 1. Overview & Mathematical Foundations

This specification formalizes the Multi-Agent Reinforcement Learning (MARL) game-theoretic equilibrium solver, confidential additive homomorphic weight consensus, asynchronous federated staleness compensation, student-teacher curriculum knowledge distillation, procedural Voronoi biome fracture dynamics, and streaming delta binary replay compression within **NeuroArena**.

---

## 2. MARL Counterfactual Regret Minimization (CFR+)

### 2.1 Information Sets and Regret-Matching
In extensive and normal-form biome games, let $I \in \mathcal{I}_i$ denote an information set for player $i$, and $A(I)$ denote the legal tactical actions (`Harvester`, `Flanker`, `Defender`, `Disruptor`).

Cumulative counterfactual regret for action $a \in A(I)$ at iteration $T$ is floored at zero according to CFR+ dynamics:
$$R_i^{T,+}(I, a) = \max\left(0, \sum_{t=1}^T r_i^t(I, a)\right)$$

The regret-matching strategy $\sigma^{T+1}(I, a)$ is given by Hart & Mas-Colell formulation with $\epsilon$-exploration smoothing:
$$\sigma^{T+1}(I, a) = (1 - \epsilon) \frac{R_i^{T,+}(I, a)}{\sum_{a' \in A(I)} R_i^{T,+}(I, a')} + \frac{\epsilon}{|A(I)|}$$

### 2.2 Nash Convergence & Exploitability
The time-averaged strategy profile $\bar{\sigma}^T$ converges to a Nash equilibrium in two-player zero-sum games at rate $\mathcal{O}(1 / \sqrt{T})$.

Exploitability $\delta(\bar{\sigma})$ measures the distance to Nash equilibrium:
$$\delta(\bar{\sigma}) = \frac{1}{2} \left[ \max_{a_1} u_1(a_1, \bar{\sigma}_2) - u_1(\bar{\sigma}_1, \bar{\sigma}_2) + \max_{a_2} u_2(\bar{\sigma}_1, a_2) - u_2(\bar{\sigma}_1, \bar{\sigma}_2) \right]$$

---

## 3. Additive Homomorphic Encryption & Confidential Consensus

### 3.1 Paillier Cryptosystem Semantics
For RSA modulus $n = p \cdot q$ and generator $g = n + 1$:
$$\lambda = \operatorname{lcm}(p - 1, q - 1) = \frac{(p - 1)(q - 1)}{\gcd(p - 1, q - 1)}$$
$$\mu = \left( L(g^\lambda \bmod n^2) \right)^{-1} \bmod n \equiv \lambda^{-1} \bmod n$$

where the discrete logarithm function is $L(u) = \frac{u - 1}{n}$.

### 3.2 Ciphertext Addition & Federated Consensus
Each edge client quantizes weights $\theta \in \mathbb{R}^d$ into scaled integers $m = \lfloor \theta \cdot S \rceil \bmod n$.
Encryption:
$$c_i = g^{m_i} \cdot r_i^n \bmod n^2 = (1 + m_i n) \cdot r_i^n \bmod n^2$$

The untrusted central aggregator sums client updates directly in ciphertext space without decrypting individual vectors:
$$c_{\text{agg}} = \prod_{i=1}^K c_i \bmod n^2 = g^{\sum_{i=1}^K m_i} \cdot \left(\prod_{i=1}^K r_i\right)^n \bmod n^2$$

The global decrypted federated average is obtained by authorized keyholders:
$$\bar{\theta} = \frac{L(c_{\text{agg}}^\lambda \bmod n^2) \cdot \mu \bmod n}{K \cdot S}$$

---

## 4. Asynchronous Federated Staleness Compensation

### 4.1 Polynomial Delay Attenuation
When an edge client submits a gradient $g_\tau$ computed against an older model version $t - \tau$:
$$\lambda(\tau) = (1 + \tau)^{-\alpha}, \quad \alpha \in [0.5, 1.0]$$

### 4.2 Directional Consistency & Momentum Verification
To prevent gradient poisoning and catastrophic forgetting caused by stale orthogonal or inverted updates, cosine similarity against running server momentum $m_t$ is enforced:
$$\cos \theta = \frac{\langle g_\tau, m_t \rangle}{\|g_\tau\|_2 \cdot \|m_t\|_2} \ge \tau_{\text{thresh}}$$

If $\cos \theta < -0.2$, the update is quarantined.

### 4.3 Polyak-Ruppert Parameter Averaging
Server maintains an exponentially smoothed parameter trajectory for stable inference:
$$\bar{\theta}_t = (1 - \beta)\bar{\theta}_{t-1} + \beta \theta_t, \quad \beta = 0.85$$

---

## 5. Curriculum Knowledge Distillation Engine

### 5.1 Temperature-Scaled Soft Cross-Entropy
Given teacher logits $z^T$ and student logits $z^S$ with temperature $T$:
$$p_i(T) = \frac{\exp(z_i / T)}{\sum_j \exp(z_j / T)}$$

Distillation loss balances soft teacher alignment and hard ground-truth labels:
$$\mathcal{L}_{\text{total}} = \alpha \cdot T^2 \cdot \mathcal{D}_{\text{KL}}(p^T(T) \parallel p^S(T)) + (1 - \alpha) \cdot \mathcal{L}_{\text{CE}}(y, p^S(1)) + \lambda_{\text{hint}} \cdot \mathcal{L}_{\text{hint}}$$

### 5.2 Dynamic Curriculum Annealing
$$\mathcal{T}(k) = \max\left(1.2, T_{\text{base}} - 0.3 \cdot k\right), \quad k \in [0, 5] \text{ (Biome Tier)}$$

---

## 6. Procedural Voronoi Biome Fracture Dynamics

### 6.1 Lloyd Relaxation & Cell Partitioning
Arena bounds are partitioned into $N$ Voronoi cells $\mathcal{V}_i = \{x \in \mathbb{R}^2 \mid \|x - s_i\| \le \|x - s_j\| \, \forall j \ne i\}$.
Sites $s_i$ are iteratively relaxed towards cell centroids:
$$s_i^{(k+1)} = \frac{1}{|\mathcal{V}_i|} \int_{\mathcal{V}_i} x \, dx$$

### 6.2 Fault Displacements & Dynamic Hazard Zones
Energy destabilization triggers tectonic faulting along cell boundaries:
$$h(x) = \Delta z_{\text{fault}} \cdot \max(0, 1 - \|x - s_i\| / R_{\text{cell}})$$
Hazard zones activate Magma Fissures (thermal damage over time) and Cryo Chasms (traction loss).

---

## 7. Streaming Delta-Encoded Binary Replay Compression

1. **Keyframe vs Delta Flags**: Bit-level flag indicating absolute keyframe or relative delta frame $\Delta x_t = x_t - x_{t-1}$.
2. **Fixed-Point Quantization**: Continuous coordinates $x \in \mathbb{R}$ mapped to $\hat{x} = \operatorname{round}(x \cdot 100)$.
3. **Zig-Zag Mapping**: Signed integers transformed into unsigned domains:
   $$\operatorname{ZigZag}(n) = (n \ll 1) \oplus (n \gg 31)$$
4. **Variable-Length LEB128 Encoding**: Efficient 7-bit variable-length byte serialization.
5. **Observed Performance**: Compresses raw telemetry streams by 13.7x (92.7% bandwidth reduction).

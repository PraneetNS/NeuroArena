# 🌌 Generative Flow Matching, Riemannian Lie Groups & Neuromorphic Dynamics Specification

## 1. Executive Summary

This architecture specification formalizes seven next-generation foundational capabilities implemented in NeuroArena:

1. **Conditional Flow Matching (CFM):** Continuous generative trajectory synthesis via optimal transport vector field regression and numerical quadrature (Euler and RK4) avoiding diffusion stochastic noise degradation.
2. **Conformal Prediction & Finite-Sample Risk Guarantees:** Distribution-free, non-parametric $(1 - \alpha)$ statistical coverage sets for damage anticipation and tactical risk containment.
3. **Riemannian Manifold Optimization on Lie Groups $\mathrm{SE}(3)$ / $\mathrm{SO}(3)$:** Singularity-free 6-DOF attitude and position planning utilizing exponential and logarithmic maps on Lie algebras $\mathfrak{so}(3)$ and $\mathfrak{se}(3)$.
4. **Neuromorphic Spiking Actor-Critic Policy:** Ultra-sparse, event-driven Leaky Integrate-and-Fire (LIF) neurons, surrogate gradient backpropagation, and Spike-Timing-Dependent Plasticity (STDP) for microsecond decision latency.
5. **Continuum Mean Field Games (MFG):** Coupled Hamilton-Jacobi-Bellman (backward) and Fokker-Planck (forward) partial differential equations for $100+$ agent swarm coordination without exponential combinatorial explosion.
6. **Self-Supervised Trajectory Representation Learning:** InfoNCE mutual information maximization and VICReg (Variance-Invariance-Covariance) regularization over temporally-augmented state-action buffers.
7. **Continuous-Time Temporal Graph Networks (TGN) with Hawkes Processes:** Node memory tracking and self-exciting point process cascade forecasting for team-fight detection.

---

## 2. Mathematical Formulations & Derivations

### 2.1 Conditional Flow Matching (CFM)
Given prior distribution $p_0(x) = \mathcal{N}(x; 0, I)$ and target trajectory distribution $p_1(x)$, define the probability path via the displacement interpolant:
$$\psi_t(x_0, x_1) = (1 - t) x_0 + t x_1, \quad t \in [0, 1]$$

The conditional target velocity field is constant in time along optimal transport paths:
$$u_t(x \mid x_0, x_1) = \frac{d}{dt} \psi_t(x_0, x_1) = x_1 - x_0$$

The neural vector field $v_\theta(x, t)$ is trained via the regression objective:
$$\mathcal{L}_{\mathrm{CFM}}(\theta) = \mathbb{E}_{t \sim \mathcal{U}(0,1), \, x_0 \sim p_0, \, x_1 \sim p_1} \left[ \| v_\theta(\psi_t(x_0, x_1), t) - (x_1 - x_0) \|^2 \right]$$

Sampling is achieved by solving the deterministic initial value problem from $t = 0$ to $t = 1$:
$$\frac{dx(t)}{dt} = v_\theta(x(t), t), \quad x(0) \sim \mathcal{N}(0, I)$$

### 2.2 Conformal Prediction Coverage Guarantee
Let $(X_1, Y_1), \dots, (X_n, Y_n)$ be exchangeable calibration pairs. For point predictor $\hat{\mu}(X)$ and local variance estimate $\hat{\sigma}(X)$, define the normalized non-conformity score:
$$S_i = \frac{|Y_i - \hat{\mu}(X_i)|}{\hat{\sigma}(X_i) + \epsilon}$$

For desired significance level $\alpha \in (0, 1)$, compute the empirical $(1 - \alpha)$-quantile with finite-sample correction:
$$\hat{q} = \mathrm{Quantile}\left(\{S_1, \dots, S_n\}, \frac{\lceil (n + 1)(1 - \alpha) \rceil}{n}\right)$$

For a test query $X_{n+1}$, the prediction set $C(X_{n+1})$ is constructed as:
$$C(X_{n+1}) = \left[ \hat{\mu}(X_{n+1}) - \hat{q} (\hat{\sigma}(X_{n+1}) + \epsilon), \; \hat{\mu}(X_{n+1}) + \hat{q} (\hat{\sigma}(X_{n+1}) + \epsilon) \right]$$

**Theorem (Finite-Sample Validity):** If $(X_1, Y_1), \dots, (X_{n+1}, Y_{n+1})$ are exchangeable, then:
$$\mathbb{P}\left(Y_{n+1} \in C(X_{n+1})\right) \ge 1 - \alpha$$
identically holding across any arbitrary continuous, multimodal, or heavy-tailed distribution.

### 2.3 Lie Groups and Riemannian Optimization on $\mathrm{SE}(3)$
The Lie group $\mathrm{SE}(3) = \mathrm{SO}(3) \ltimes \mathbb{R}^3$ represents 3D rigid body transformations:
$$T = \begin{bmatrix} R & p \\ 0 & 1 \end{bmatrix} \in \mathrm{SE}(3), \quad R \in \mathrm{SO}(3), \; p \in \mathbb{R}^3$$

The Lie algebra $\mathfrak{se}(3)$ is parameterized by twists $\xi = (u, \omega) \in \mathbb{R}^6$:
$$\xi^\wedge = \begin{bmatrix} \omega^\wedge & u \\ 0 & 0 \end{bmatrix}, \quad \text{where } \omega^\wedge = \begin{bmatrix} 0 & -\omega_3 & \omega_2 \\ \omega_3 & 0 & -\omega_1 \\ -\omega_2 & \omega_1 & 0 \end{bmatrix}$$

- **Exponential Map ($\exp: \mathfrak{so}(3) \to \mathrm{SO}(3)$):**
  $$\exp(\omega^\wedge) = I + \frac{\sin \theta}{\theta} \omega^\wedge + \frac{1 - \cos \theta}{\theta^2} (\omega^\wedge)^2, \quad \theta = \|\omega\|$$
- **Logarithmic Map ($\log: \mathrm{SO}(3) \to \mathfrak{so}(3)$):**
  $$\theta = \arccos\left(\frac{\mathrm{tr}(R) - 1}{2}\right), \quad \omega^\vee = \frac{\theta}{2 \sin \theta} (R - R^\top)^\vee$$
- **Geodesic Interpolation:**
  $$T(t) = T_0 \exp\left(t \log(T_0^{-1} T_1)\right)$$

### 2.4 Neuromorphic Leaky Integrate-and-Fire (LIF) Dynamics
Membrane potential $V_i(t)$ obeys the sub-threshold continuous differential equation:
$$\tau_m \frac{dV_i(t)}{dt} = -(V_i(t) - V_{\mathrm{rest}}) + R I_i(t)$$

Discretized with decay factor $\beta = \exp(-\Delta t / \tau_m)$:
$$V_i[t] = \beta V_i[t-1] (1 - S_i[t-1]) + \sum_j W_{ij} S_j[t] + I_{\mathrm{ext}}[t]$$

Spike output $S_i[t] = \Theta(V_i[t] - V_{\mathrm{th}})$. To backpropagate through non-differentiable step $\Theta$, the Fast Sigmoid surrogate gradient is employed:
$$\frac{\partial S}{\partial V} \approx \frac{1}{\pi (1 + (\pi (V - V_{\mathrm{th}}))^2)}$$

Synaptic plasticity follows the asymmetric STDP rule for spike timing difference $\Delta t = t_{\mathrm{post}} - t_{\mathrm{pre}}$:
$$\Delta W_{ij} = \begin{cases} A_+ \exp(-\Delta t / \tau_+), & \Delta t > 0 \text{ (Long-Term Potentiation)} \\ -A_- \exp(\Delta t / \tau_-), & \Delta t < 0 \text{ (Long-Term Depression)} \end{cases}$$

### 2.5 Continuum Mean Field Games (Coupled HJB-FP System)
For continuum density $m(t, x)$ and value potential $u(t, x)$ over domain $\Omega \times [0, T]$:

1. **Hamilton-Jacobi-Bellman (HJB) Equation (Backward in time):**
   $$-\partial_t u - \frac{\sigma^2}{2} \Delta u + \frac{1}{2} \|\nabla u\|^2 = F(x, m(t)), \quad u(T, x) = g(x, m(T))$$
2. **Fokker-Planck (FP) Equation (Forward in time):**
   $$\partial_t m - \frac{\sigma^2}{2} \Delta m - \operatorname{div}\left(m \nabla u\right) = 0, \quad m(0, x) = m_0(x)$$

The equilibrium provides the optimal decentralized velocity field $v^*(t, x) = -\nabla u(t, x)$.

---

## 3. Architecture & Interface Matrix

| Module | Location | Primary Interface | Algorithmic Complexity |
| :--- | :--- | :--- | :--- |
| **FlowMatchingMotionPlanner** | `src/ml/FlowMatchingMotionPlanner.js` | `generateTrajectory(x0, 'rk4')` | $O(K \cdot D_{\mathrm{state}})$ |
| **ConformalPredictionEngine** | `src/ml/ConformalPredictionEngine.js` | `predictInterval(yPred, scale, \alpha)` | $O(N \log N)$ calibration, $O(1)$ query |
| **RiemannianManifoldOptimizer**| `src/ml/RiemannianManifoldOptimizer.js` | `expSE3(twist)`, `slerpSO3(R1, R2, t)` | $O(1)$ analytic closed-form |
| **SpikingNeuralPolicyEngine** | `src/ml/SpikingNeuralPolicyEngine.js` | `forward(inputs)`, `applySTDP(...)` | $O(T \cdot N_{\mathrm{synapses}})$ |
| **MeanFieldGameEngine** | `src/ml/MeanFieldGameEngine.js` | `solveEquilibriumStep()`, `getOptimalDrift()`| $O(T \cdot K \cdot G^2)$ grid operations |
| **ContrastiveTrajectoryEncoder**| `src/ml/ContrastiveTrajectoryEncoder.js`| `computeInfoNCELoss()`, `encode()` | $O(B^2 \cdot D_{\mathrm{emb}})$ batch contrast |
| **TemporalInteractionGraphEngine**| `src/ml/TemporalInteractionGraphEngine.js`| `predictCombatIntensity(t)` | $O(E_{\mathrm{window}})$ event lookback |

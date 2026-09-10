# Corporate Client Contracts & Autonomous Bot Policy Arena Specification

## 1. Corporate Client Freelance Contracts (while True: learn() Paradigm)

NeuroArena enables players to accept freelance machine learning engineering contracts from enterprise corporate clients. Contracts impose strict Service Level Agreements (SLAs) on model accuracy, convergence loss, and edge inference latency.

### 1.1 Corporate Client Tiers & Progression

| Tier ID | Client Faction | Min Reputation | Target Architecture | Max Latency | Baseline Reward |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Tier 1: Startup** | Nexus BioHealth | 0 Rep | LogisticClassifier | $18.0\text{ ms}$ | $300\text{ Credits}, 2\text{ Shards}$ |
| **Tier 1: Agritech** | EcoHarvest | 0 Rep | LinearRegression | $15.0\text{ ms}$ | $350\text{ Credits}, 2\text{ Shards}$ |
| **Tier 2: Biotech** | BioGen Cellular | 100 Rep | NeuralNetwork | $12.0\text{ ms}$ | $750\text{ Credits}, 5\text{ Shards}$ |
| **Tier 3: FinTech** | QuantEdge Global | 350 Rep | NeuralNetwork | $7.5\text{ ms}$ | $1,600\text{ Credits}, 12\text{ Shards}$ |
| **Tier 4: AutoDrive** | NeuroDrive Systems | 900 Rep | NeuralNetwork | $4.8\text{ ms}$ | $3,200\text{ Credits}, 25\text{ Shards}$ |
| **Tier 5: DeepSpace** | AstroSynthetics Corp | 2,200 Rep | NeuralNetwork | $3.0\text{ ms}$ | $6,500\text{ Credits}, 50\text{ Shards}$ |

---

### 1.2 Mathematical SLA Bonus Multipliers

Submissions that significantly outperform the latency SLA ceiling or achieve superior metric margins receive scaled reward bonuses:

#### Latency Headroom Bonus Multiplier:
$$\text{Headroom} = \max\left(0, \frac{\text{SLA}_{\text{max}} - t_{\text{measured}}}{\text{SLA}_{\text{max}}}\right)$$
$$M_{\text{latency}} = 1.0 + \min(0.5, 0.5 \times \text{Headroom})$$

#### Quality Bonus Multiplier:
- **Accuracy Metric:**
  $$M_{\text{quality}} = 1.0 + \min(0.3, 2.0 \times \max(0, \text{Acc}_{\text{achieved}} - \text{Acc}_{\text{required}}))$$
- **Loss Metric:**
  $$M_{\text{quality}} = 1.0 + \min(0.3, 5.0 \times \max(0, \text{Loss}_{\text{required}} - \text{Loss}_{\text{achieved}}))$$

$$\text{Credits}_{\text{total}} = \text{round}\left(\text{Credits}_{\text{base}} \times M_{\text{latency}} \times M_{\text{quality}}\right)$$

---

## 2. Autonomous Bot Policy Arena (Screeps & Gladiabots Paradigm)

Players can mount trained neural network weight matrices onto autonomous field drones that navigate arenas, avoid dynamic hazards, and collect feature crystals in real-time head-to-head simulations.

### 2.1 Neural Observation & Policy Forward Pass

The sensory array extracts a 4-dimensional observation vector:
$$\mathbf{x} = \begin{bmatrix} \Delta x_{\text{target}}, & \Delta z_{\text{target}}, & d_{\text{obstacle}}, & v_{\text{current}} \end{bmatrix}^T$$

#### Layer 1 (Feature Extraction with ReLU):
$$\mathbf{h} = \max\left(\mathbf{0}, \mathbf{W}_1 \mathbf{x} + \mathbf{b}_1\right), \quad \mathbf{W}_1 \in \mathbb{R}^{8 \times 4}, \; \mathbf{b}_1 \in \mathbb{R}^8$$

#### Layer 2 (Action Heads):
$$\mathbf{z} = \mathbf{W}_2 \mathbf{h} + \mathbf{b}_2, \quad \mathbf{W}_2 \in \mathbb{R}^{3 \times 8}, \; \mathbf{b}_2 \in \mathbb{R}^3$$

$$\theta_{\text{steer}} = \tanh(z_0) \times 45.0^\circ$$
$$u_{\text{throttle}} = \sigma(z_1) = \frac{1}{1 + e^{-z_1}}$$
$$b_{\text{brake}} = \mathbb{I}\left(\sigma(z_2) > 0.55\right)$$

---

### 2.2 Vehicle Kinematic Simulation Equations

The physics loop advances at $20\text{ Hz}$ ($\Delta t = 50\text{ ms}$):

$$\psi(t + \Delta t) = \left(\psi(t) + \theta_{\text{steer}} \cdot \Delta t\right) \pmod{360^\circ}$$

$$v(t + \Delta t) = \begin{cases}
\max\left(0, v(t) - k_{\text{brake}} \cdot \Delta t\right) & \text{if } b_{\text{brake}} \\
\min\left(v_{\text{max}}, \max\left(0, v(t) + (u_{\text{throttle}} \cdot a_{\text{accel}} - d_{\text{drag}}) \cdot \Delta t\right)\right) & \text{otherwise}
\end{cases}$$

$$x(t + \Delta t) = x(t) + \sin(\psi) \cdot v \cdot \Delta t$$
$$z(t + \Delta t) = z(t) + \cos(\psi) \cdot v \cdot \Delta t$$

#### Boundary Clamping:
$$\text{If } \sqrt{x^2 + z^2} > R_{\text{arena}} \implies \mathbf{p} \gets \frac{\mathbf{p}}{\|\mathbf{p}\|} \cdot R_{\text{arena}}, \quad v \gets 0.5 \cdot v$$

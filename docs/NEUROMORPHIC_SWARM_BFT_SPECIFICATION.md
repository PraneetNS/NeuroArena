# Neuromorphic Spiking Dynamics, GNN Swarms & Byzantine Fault-Tolerant Consensus Specification

## 1. Overview & Mathematical Foundations

This specification details the mathematical models, algorithmic guarantees, and architectural integration for:
1. **Neuromorphic Spiking Neural Networks (SNN)** driven by Leaky Integrate-and-Fire (LIF) dynamics and Spike-Timing-Dependent Plasticity (STDP).
2. **Graph Neural Network (GNN)** Permutation-Equivariant message passing for autonomous drone swarm coordination.
3. **Byzantine Fault-Tolerant (BFT)** Raft consensus with Multi-Krum geometric distance filtering.
4. **Continual Lifelong Learning** via Elastic Weight Consolidation (EWC) and empirical Fisher Information Matrix (FIM) regularizers.
5. **Acoustic Doppler Sonar DSP** and **WebTransport QUIC** multiplexed network streaming in **NeuroArena**.

---

## 2. Neuromorphic Leaky Integrate-and-Fire (LIF) & STDP

### 2.1 Membrane Potential Differential Dynamics
Each neuron $i$ maintains a membrane potential $V_m(t)$ governed by the continuous-time RC circuit differential equation:
$$\tau_m \frac{d V_m(t)}{dt} = -(V_m(t) - V_{\text{rest}}) + R_m \left( I_{\text{sensory}}(t) + \sum_{j} w_{ji} S_j(t) \right)$$

where:
- $\tau_m = R_m C_m$ is the membrane time constant (typically $20\text{ ms}$).
- $V_{\text{rest}} = -70\text{ mV}$, $V_{\text{th}} = -55\text{ mV}$, and $V_{\text{reset}} = -75\text{ mV}$.
- $S_j(t) = \sum_{k} \delta(t - t_j^k)$ represents incoming Dirac action potential spikes.

When $V_m(t) \ge V_{\text{th}}$, an action potential is emitted:
$$S_i(t) = 1, \quad V_m(t^+) = V_{\text{reset}}$$

An absolute refractory period $\tau_{\text{ref}} = 3\text{ ms}$ locks $V_m$ to $V_{\text{reset}}$ immediately following any spike.

### 2.2 Spike-Timing-Dependent Plasticity (STDP)
Synaptic weights $w_{ij}$ between pre-synaptic neuron $i$ and post-synaptic neuron $j$ update according to relative spike timing $\Delta t = t_{\text{post}} - t_{\text{pre}}$:
$$\Delta w_{ij} = \begin{cases} 
A_+ \exp\left(-\frac{\Delta t}{\tau_+}\right), & \Delta t > 0 \quad (\text{Long-Term Potentiation / LTP}) \\
-A_- \exp\left(\frac{\Delta t}{\tau_-}\right), & \Delta t < 0 \quad (\text{Long-Term Depression / LTD})
\end{cases}$$

with learning rates $A_+ = 0.005$, $A_- = 0.00525$, and time window $\tau_+ = \tau_- = 20\text{ ms}$.

---

## 3. Graph Neural Network (GNN) Swarm Topology

### 3.1 Proximity Graph Construction
For a swarm of $N$ agents with spatial positions $x_i \in \mathbb{R}^3$, the dynamic communication adjacency matrix $\tilde{A}$ with self-loops is constructed via Gaussian RBF kernels:
$$\tilde{A}_{ij} = \begin{cases} 
1.0, & i = j \\
\exp\left(-\frac{\|x_i - x_j\|_2^2}{2 \sigma_{\text{comm}}^2}\right), & 0 < \|x_i - x_j\|_2 \le R_{\text{comm}} \text{ and } j \in \mathcal{N}_k(i) \\
0, & \text{otherwise}
\end{cases}$$

### 3.2 Spectral Graph Convolution (GCN)
Message passing evaluates symmetric normalized Laplacians:
$$\tilde{D}_{ii} = \sum_j \tilde{A}_{ij}, \quad S = \tilde{D}^{-1/2} \tilde{A} \tilde{D}^{-1/2}$$

Two-layer GCN feedforward dynamics:
$$H^{(1)} = \text{LeakyReLU}\left( S H^{(0)} W^{(0)} + b^{(0)} \right)$$
$$U_{\text{action}} = \tanh\left( S H^{(1)} W^{(1)} + b^{(1)} \right) \cdot a_{\max}$$

where $H^{(0)} \in \mathbb{R}^{N \times 6}$ encodes $[x, y, z, v_x, v_y, v_z]$, and $U_{\text{action}} \in \mathbb{R}^{N \times 3}$ outputs 3D steering forces.

---

## 4. Byzantine Fault-Tolerant (BFT) Raft Gradient Consensus

### 4.1 Threat Model
In an edge cluster of $n$ nodes where up to $f$ nodes are Byzantine adversaries ($n \ge 3f + 1$), malicious nodes may submit arbitrary or poisoned gradient updates $g_j \in \mathbb{R}^d$ attempting model divergence or backdoor insertion.

### 4.2 Multi-Krum Aggregation Rule
For each proposed gradient vector $g_i$, the Krum score $S(i)$ measures the cumulative squared Euclidean distance to its $n - f - 2$ nearest neighbors:
$$S(i) = \sum_{j \in \mathcal{N}_{n-f-2}(i)} \|g_i - g_j\|_2^2$$

The algorithm selects the $m$ candidates with lowest scores $S(i)$ and averages them:
$$\bar{g}_{\text{BFT}} = \frac{1}{m} \sum_{k=1}^m g_{(k)}$$

Poisoned gradients outside the dense benign cluster produce large Euclidean distances and are strictly excluded from the consensus average.

### 4.3 Raft Quorum & Cryptographic Seals
- Quorum requirement: $\ge \lceil 2/3 \cdot n \rceil$ active ballots.
- Each ballot is sealed via HMAC-SHA256 over candidate parameters and round sequence.
- Consensus commit records are chained into an immutable SHA-256 ledger.

---

## 5. Continual Lifelong Learning with Elastic Weight Consolidation (EWC)

### 5.1 Catastrophic Forgetting Mitigation
When transitioning from task $A$ (e.g., Linear Plains) to task $B$ (e.g., Overfitting Mire), parameters are optimized subject to a quadratic penalty weighted by the diagonal of the empirical Fisher Information Matrix $F_A$:
$$\mathcal{L}(\theta) = \mathcal{L}_B(\theta) + \sum_i \frac{\lambda_{\text{EWC}}}{2} F_{A, i} (\theta_i - \theta_{A, i}^*)^2$$

### 5.2 Diagonal Empirical Fisher Information Matrix
Given $N_{\text{val}}$ validation trajectories for task $A$:
$$F_{A, i} = \frac{1}{N_{\text{val}}} \sum_{k=1}^{N_{\text{val}}} \left( \frac{\partial \log p(y_k | x_k, \theta)}{\partial \theta_i} \right)^2 + \epsilon_{\text{damp}}$$

Analytic regularization gradient:
$$\nabla_{\theta} \mathcal{L}_{\text{EWC}} = \lambda_{\text{EWC}} \cdot F_A \odot (\theta - \theta_A^*)$$

Parameters critical to Task $A$ exhibit large $F_i$ values and are elastically anchored, preventing performance degradation on previously mastered biomes.

---

## 6. Real-Time Doppler Sonar DSP & WebTransport QUIC Netcode

### 6.1 Doppler Ultrasonic Radar Synthesis
Active sonar pings emit linear frequency modulated (FM) chirps over duration $T_{\text{pulse}}$:
$$f(t) = f_0 + \left(\frac{\Delta f}{T_{\text{pulse}}}\right) t, \quad t \in [0, T_{\text{pulse}}]$$

Echo returns undergo Doppler frequency scaling according to relative velocity $v_r$:
$$f_{\text{echo}} = f_0 \left( \frac{c + v_{\text{observer}}}{c + v_{\text{target}}} \right)$$

Two-way propagation delay $\tau = \frac{2d}{c}$ and atmospheric absorption $A(d) = 10^{-\alpha \cdot 2d / 20}$ govern echo timing and amplitude.

### 6.2 WebTransport Multiplexed Sessions
- **Unreliable Datagrams (QUIC UDP):** 60-120 Hz kinematic telemetry ($x, y, z, v_x, v_y, v_z$) and binary spike events, bypassing head-of-line blocking.
- **Reliable Unidirectional Streams:** Telemetry logging, audit trails, and sonar echo diagnostics.
- **Reliable Bidirectional Streams:** BFT Raft voting ballots, EWC Fisher parameter checkpoints, and cryptographic certificates.
- **Connection Migration:** Seamless IP/port rebinding upon client Wi-Fi/5G transitions without resetting session state.

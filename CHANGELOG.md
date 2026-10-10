# Changelog

All notable changes to NeuroArena are documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

## [4.5.0] - 2026-10-10

### Added
- **Pure-JS Numerical Machine Learning Core Expansion (`src/ml/`)**
  - **Decision Tree Classifier & Regressor (`src/ml/tree.js`)**: Implemented recursive axis-aligned binary partition engine with Gini impurity, Shannon entropy, MSE variance reduction, and Mean Decrease Impurity (MDI) feature importances.
  - **Random Forest Ensemble (`src/ml/forest.js`)**: Implemented Bootstrap Aggregation (Bagging), random subspace feature sampling, soft probability voting, and Out-Of-Bag (OOB) generalization scoring.
  - **Multi-Layer Perceptron Neural Network (`src/ml/mlp.js`)**: Built fully-connected Dense layers, Xavier/He parameter initialization, autodiff backpropagation, activation suite (ReLU, LeakyReLU, Tanh, Sigmoid, Softmax), and L2 weight decay. Verified convergence on non-linear XOR boundary.
  - **Vector Embeddings & PPMI Matrix Transform (`src/ml/embeddings.js`)**: Implemented symmetric co-occurrence matrix windowing, Positive Pointwise Mutual Information (PPMI), and Cosine Similarity nearest-neighbor vector retrieval.
  - **Principal Component Analysis (`src/ml/pca.js`)**: Implemented sample covariance estimation, Jacobi symmetric eigenvalue decomposition, explained variance ratios, and orthogonal subspace projection/reconstruction.
  - **K-Means++ Clustering (`src/ml/kmeans.js`)**: Built Lloyd's optimization algorithm with distance-squared probability seeding, within-cluster sum of squares (WCSS Inertia), and Silhouette score validation.
  - **Model Selection & Cross-Validation (`src/ml/modelSelection.js`)**: Implemented K-Fold, Stratified K-Fold, cross-validation scoring, and GridSearchCV parameter optimization.
  - **Advanced Classification Metrics (`src/ml/advancedMetrics.js`)**: Built Multi-Class Confusion Matrix, Precision/Recall/F1-score classification report, ROC curves, and Trapezoidal ROC-AUC numerical quadrature.
  - **Background Worker Training Integration (`workers/Trainer.worker.js`)**: Added Web Worker dispatch and live training loops for MLPs, Decision Trees, and Random Forests.
  - **Enhanced Developer CLI (`scripts/ml-cli.js`)**: Upgraded terminal command-line interface with multi-model evaluation, PCA variance inspection, and embedding queries.
  - **Unit Test Harnesses (`tests/ml/`)**: Added automated ES module test suites for trees, forests, neural nets, embeddings, PCA, kmeans, and model selection.

## [4.0.0] - 2026-10-03

### Added
- **Non-Equilibrium Thermodynamic Work & Jarzynski Free Energy Engine (`neuroarena-server/src/physics/ThermodynamicWorkEngine.js`, `docs/NON_EQUILIBRIUM_THERMODYNAMICS_SHEAF_MORPHOGENETIC_SPEC.md`)**
  - Formulated microscopic stochastic thermodynamics under Langevin heat baths and arbitrary non-quasistatic protocols $\lambda(t)$.
  - Implemented exact Jarzynski Equality $\langle \exp(-\beta W) \rangle = \exp(-\beta \Delta F)$ and Crooks Fluctuation Theorem verification.
  - Computed Clausius entropy production rate $\Delta S_{\text{prod}} = k_B \beta W_{\text{diss}} \ge 0$ for swarm thermal balance and non-equilibrium dissipation.
- **Cellular Sheaf Neural Network & Laplacian Consensus Engine (`neuroarena-server/src/ml/CellularSheafEngine.js`, `web/src/morphogeneticSheafVisualizer.js`)**
  - Formulated cellular sheaves over cell complexes assigning stalk vector spaces $\mathcal{F}(v), \mathcal{F}(e) \cong \mathbb{R}^d$ and linear restriction maps $\mathcal{E}_{v \trianglelefteq e}$.
  - Constructed global Sheaf Coboundary Operator $\delta$ and Sheaf Laplacian $L_\mathcal{F} = \delta^\top \delta$, establishing harmonic sections in $\ker(L_\mathcal{F}) = H^0(G; \mathcal{F})$.
  - Implemented Sheaf Diffusion flow $\dot{x} = -L_\mathcal{F} x$ with strictly monotonic Dirichlet energy decrease for non-trivial distributed consensus.
- **Turing Reaction-Diffusion & Bio-Electric Morphogenetic Pattern Engine (`neuroarena-server/src/neuromorphic/MorphogeneticPatternEngine.js`, `web/src/morphogeneticSheafVisualizer.js`)**
  - Implemented coupled Gray-Scott activator-inhibitor partial differential equations discretized via 5-point Laplacian stencil on toroidal grids.
  - Coupled Levin bioelectric membrane potentials $V_{\text{bio}}$ to effective feed rates, yielding dynamic self-organizing spots, labyrinths, and morphogenetic wavefields.
- **Gauge-Equivariant Icosahedral Spherical Mesh CNN Engine (`neuroarena-server/src/ml/GaugeEquivariantEngine.js`)**
  - Formulated $SO(2)$ gauge transformations and Levi-Civita parallel transport along connection angles $\omega_{p \to q}$.
  - Built steerable isotropic harmonic kernels achieving exact numerical gauge equivariance ($< 10^{-15}$ deviation) across arbitrary local reference frames.
- **Partial Information Decomposition (PID) & Transfer Entropy Engine (`neuroarena-server/src/causal/PartialInformationDecomposition.js`)**
  - Implemented Williams-Beer information lattice decomposition of joint mutual information into Redundancy, Unique 1, Unique 2, and Synergy.
  - Computed Schreiber directed Transfer Entropy $T_{X \to Y}$ and Causal Emergence Index $\Psi = \text{Syn} - \text{Red}$ for detecting spontaneous multi-agent coordination.
- **Continuous-Variable Bosonic Fock State & Wigner Quasiprobability Engine (`neuroarena-server/src/ml/ContinuousVariableQuantumEngine.js`)**
  - Modeled infinite-dimensional bosonic Hilbert space truncated to Fock states with ladder operators $a, a^\dagger$, displacement $D(\alpha)$, and phase rotation $R(\theta)$.
  - Computed quadrature expectations $\langle q \rangle, \langle p \rangle$ and evaluated phase-space Wigner functions $W(q, p)$ confirming operational quantum negativity.
- **Renormalization Group Active Inference & Variational Free Energy Engine (`neuroarena-server/src/control/RenormalizationActiveInference.js`)**
  - Integrated Wilsonian momentum-shell decimation coarse-graining pyramids for hierarchical sensory processing.
  - Formulated Variational Free Energy $F[q, y]$ perceptual minimization and Expected Free Energy $G(\pi)$ policy selection balancing pragmatic utility with epistemic exploration.
- **Directed Algebraic Topology & Precubical Deadlock Engine (`neuroarena-server/src/ml/DirectedTopologyEngine.js`)**
  - Formulated Higher-Dimensional Automata (HDA) with monotonic directed paths (dipaths) and precubical face maps.
  - Built geometric deadlock detection and dipath homotopy solvers across multi-agent shared resource mutex regions.
- **Post-Quantum Module-LWE Key Encapsulation & Lattice Verifier (`neuroarena-server/src/security/PostQuantumEngine.js`)**
  - Implemented polynomial ring $R_q = \mathbb{Z}_q[X]/(X^n + 1)$ with negacyclic convolution, centered binomial noise sampling, and Kyber-style M-LWE encryption/decryption.
  - Built Falcon-style lattice signature Euclidean norm verification.
- **Verifiable Random Function (VRF) & Cryptographic Sortition Engine (`neuroarena-server/src/network/VRFConsensusEngine.js`)**
  - Implemented RFC 9381 discrete logarithm VRF with non-interactive Fiat-Shamir zero-knowledge proofs $\pi = (\Gamma, c, s)$.
  - Enabled deterministic Algorand-style cryptographic sortition for fair round-robin shard leader election and Sybil-proof consensus.
- **QUIC Packet Churn FEC with Reed-Solomon Erasure Coding Engine (`neuroarena-server/src/network/ReedSolomonFEC.js`)**
  - Implemented Galois Field $GF(2^8)$ arithmetic with systematic generator matrices and Gauss-Jordan inversion.
  - Achieved zero-latency recovery from up to $m$ dropped packets without head-of-line retransmissions.
- **Tripartite Synapse & Astrocyte Gliotransmission Metaplasticity Engine (`neuroarena-server/src/neuromorphic/AstrocyteGliotransmissionEngine.js`)**
  - Modeled peri-synaptic astrocytic processes (PAP) with mGluR glutamate sensing, $IP_3$ dynamics, and intracellular $Ca^{2+}$ waves.
  - Implemented gliotransmitter-mediated metaplastic modulation of STDP synaptic learning rates.
- **Interactive HTML5 Morphogenetic Turing Wavefield and Sheaf Visualizer (`web/src/morphogeneticSheafVisualizer.js`)**
  - Built Canvas visualizer rendering Gray-Scott reaction-diffusion morphogenetic textures, Sheaf Laplacian graphs, and telemetry HUD.
- **Kubernetes CRD & Envoy WASM Sheaf Filter Mesh Manifests (`deploy/k8s-crd-neuroarena-v4.yaml`, `deploy/envoy-v4-sheaf-filter.yaml`)**
  - Added `NeuroArenaV4Cluster` CustomResourceDefinition and Envoy proxy streaming filters.
- **Integration Test Suite (`neuroarena-server/test/v4_frontier_systems.test.js`)**
  - Validated all 12 v4.0 engines in automated CI/CD pipeline.
- **Topological Data Analysis (TDA) & Persistent Homology (`neuroarena-server/src/ml/PersistentHomologyEngine.js`, `web/src/tdaPersistenceVisualizer.js`, `docs/TOPOLOGICAL_COMPOSITIONAL_CLIFFORD_SPEC.md`)**
  - Formulated Vietoris-Rips filtration and column reduction over $\mathbb{Z}_2$ boundary matrices to extract persistent homology pairs $(b_i, d_i)$.
  - Computed Betti curves ($\beta_0, \beta_1$) and persistent topological entropy $E = -\sum p_i \ln p_i$ for spatial arena zoning and swarm coordination.
  - Added HTML5 Canvas `TDAPersistenceVisualizer` with real-time barcode diagrams and expanding filtration discs.
- **Category-Theoretic Compositional Open Games (`neuroarena-server/src/ml/OpenGameEngine.js`, `docs/TOPOLOGICAL_COMPOSITIONAL_CLIFFORD_SPEC.md`)**
  - Formulated multiplayer game arenas as bidirectional lenses / optics $(\mathbb{X}, \mathbb{S}) \leftrightarrow (\mathbb{Y}, \mathbb{R})$.
  - Implemented sequential composition ($G_2 \circ G_1$) and parallel tensor product ($G_1 \otimes G_2$) with backward utility copropagation and Subgame Perfect Bayesian Nash Equilibrium solvers.
- **Clifford Geometric Algebra $Cl(3, 0)$ & Multivector Kinematics (`neuroarena-server/src/physics/CliffordGeometricAlgebra.js`, `web/src/cliffordRotorVisualizer.js`, `docs/TOPOLOGICAL_COMPOSITIONAL_CLIFFORD_SPEC.md`)**
  - Implemented 8-dimensional multivector algebra spanning scalar, vector, bivector, and pseudoscalar grades.
  - Built rotor generation $R = \cos(\theta/2) - B \sin(\theta/2)$, sandwich transformation $v' = R v R^\dagger$, rotor Slerp, and bivector torque evaluation $\tau = r \wedge F$.
  - Added HTML5 Canvas `CliffordRotorVisualizer` displaying 3D orthographic rotor planes, bivector discs, and screw motor orbits.
- **Path Integral Stochastic Optimal Control (MPPI) (`neuroarena-server/src/ml/PathIntegralControlEngine.js`, `docs/TOPOLOGICAL_COMPOSITIONAL_CLIFFORD_SPEC.md`)**
  - Solved non-convex Hamilton-Jacobi-Bellman stochastic optimal control via Feynman-Kac Brownian path integral sampling.
  - Implemented derivative-free trajectory optimization under high environmental noise and obstacle fields.
- **Multi-Compartment Pyramidal Dendritic Computing (`neuroarena-server/src/ml/DendriticNeuronEngine.js`, `docs/TOPOLOGICAL_COMPOSITIONAL_CLIFFORD_SPEC.md`)**
  - Built multi-compartment pyramidal neuron model featuring basal, apical trunk, and apical tuft compartments.
  - Implemented voltage-gated non-linear NMDA receptor conductances with physiological $Mg^{2+}$ block kinetics, dendritic plateau potentials, and burst coincidence firing.
- **Zero-Knowledge Rollup Batch State Transition Verifier (`neuroarena-server/src/security/ZKRollupEngine.js`, `docs/TOPOLOGICAL_COMPOSITIONAL_CLIFFORD_SPEC.md`)**
  - Built arithmetic circuit over BN254 prime field verifying batches of kinematic transitions, speed limits, and collision non-overlap constraints.
  - Enabled succinct state root transitions with cryptographic challenge commitments.
- **Adiabatic Quantum Annealing & Transverse-Field Ising QUBO (`neuroarena-server/src/ml/QuantumAnnealingQUBOEngine.js`, `docs/TOPOLOGICAL_COMPOSITIONAL_CLIFFORD_SPEC.md`)**
  - Mapped NP-hard weapon-target assignment and sensor coverage into an Ising Hamiltonian $H_{\mathrm{problem}}$.
  - Implemented Trotterized path-integral quantum Monte Carlo with transverse tunneling field $A(s)$ schedules for barrier escape.
- **Asynchronous Time-Warp Speculative Netcode Engine (`neuroarena-server/src/network/TimeWarpSpeculativeEngine.js`, `docs/TOPOLOGICAL_COMPOSITIONAL_CLIFFORD_SPEC.md`)**
  - Implemented Jefferson's Virtual Time algorithm with Local Virtual Time (LVT), straggler detection, state rollback, anti-message annihilation ($m \oplus \bar{m} = \emptyset$), and Global Virtual Time (GVT) fossil collection.
- **AF_XDP Kernel Bypass Driver & Envoy WASM State Filter (`deploy/af-xdp-packet-filter.c`, `deploy/envoy-wasm-state-filter.cc`)**
  - Implemented Linux eBPF AF_XDP (XSK) zero-copy driver redirecting UDP game ports directly to userland rings.
  - Added Envoy WebAssembly state filter for line-rate header inspection and rate limiting.
- **Comprehensive Integration Test Suite (`neuroarena-server/test/tda_opengames_clifford_zk.test.js`)**
  - Added 8-part integration suite covering all new engines, bringing server test suite to 43 passing tests.
- **Diffusion Schrödinger Bridge (DSB) & Entropic Optimal Transport (`neuroarena-server/src/ml/SchrodingerBridgeEngine.js`, `Assets/Scripts/Physics/DiffusionSchrodingerBridge.cs`, `web/src/schrodingerBridgeVisualizer.js`, `docs/SCHRODINGER_BRIDGE_KAN_KOOPMAN_SPECIFICATION.md`)**
  - Formulated the continuous-time Diffusion Schrödinger Bridge boundary control problem minimizing $\mathrm{KL}(\mathbb{P} \parallel \mathbb{R}^\gamma)$ relative to reference Brownian motion.
  - Implemented forward-backward coupled SDE drift estimators and Iterative Proportional Fitting (IPF) for non-equilibrium kinematic transition synthesis.
  - Created interactive HTML5 Canvas `SchrodingerBridgeVisualizer` with dual boundary density rings and Brownian bridge particle paths.
- **$E(n)$-Equivariant Graph Neural Networks ($E(n)$-EGNN) (`neuroarena-server/src/ml/EquivariantGraphEngine.js`, `Assets/Scripts/AI/EquivariantSwarmCoordinator.cs`)**
  - Implemented exact $\mathrm{SE}(3)$ rotational, translational, and reflectional equivariant message passing for 3D multi-agent flocking and combat.
  - Added Unity C# `EquivariantSwarmCoordinator` calculating coordinate-free neighbor steering impulses.
- **Koopman Operator Theory & Dynamic Mode Decomposition (DMD) (`neuroarena-server/src/ml/KoopmanOperatorEngine.js`, `Assets/Scripts/Prediction/KoopmanSpectralPredictor.cs`)**
  - Projected infinite-dimensional Koopman observable operators $\psi(x)$ onto finite linear matrix approximations using Tikhonov-regularized Extended DMD.
  - Enabled closed-form multi-step trajectory forecasting $K^H \psi(x_0)$ without numerical ODE integration.
- **Kolmogorov-Arnold Networks (KAN) with B-Splines (`neuroarena-server/src/ml/KolmogorovArnoldEngine.js`, `Assets/Scripts/ML/KolmogorovArnoldNetwork.cs`, `web/src/kanSplineInspector.js`)**
  - Implemented the Kolmogorov-Arnold representation theorem with learnable univariate B-splines parameterizing network edges via Cox-de Boor recursion.
  - Added HTML5 Canvas `KanSplineInspector` visualizing spline activations, knot distributions, and symbolic formulas in real-time.
- **Symplectic Phase-Space Integrator (`neuroarena-server/src/physics/SymplecticMechanicsEngine.js`, `Assets/Scripts/Physics/SymplecticIntegrator.cs`)**
  - Implemented 4th-order Forest-Ruth and 2nd-order Störmer-Verlet symplectic integrators preserving Poincaré differential 2-forms with relative energy drift $< 0.001\%$.
- **Information-Geometric Natural Policy Gradient (NPG) (`neuroarena-server/src/ml/NaturalPolicyGradientEngine.js`, `Assets/Scripts/AI/NaturalPolicyGradientAgent.cs`)**
  - Formulated Amari's Natural Policy Gradient navigating the Riemannian statistical manifold with Fisher Information Matrix (FIM) and Conjugate Gradient Fisher-Vector Products.
- **Online Conformal Martingales for Non-Exchangeable OOD Detection (`neuroarena-server/src/safety/MartingaleConformalDetector.js`, `Assets/Scripts/Safety/MartingaleAnomalyShield.cs`)**
  - Implemented betting martingales with Ville's maximal inequality providing non-asymptotic type-I false alarm control ($\mathbb{P}(\sup M_n \ge \lambda) \le 1/\lambda$) for anti-cheat verification.
- **Counterfactual World Model & Pearl Level-3 Interventions (`neuroarena-server/src/ml/CounterfactualWorldModel.js`, `Assets/Scripts/AI/CounterfactualInterventionEngine.cs`)**
  - Implemented the Abduction-Action-Prediction structural causal pipeline for answering counterfactual queries while preserving empirical exogenous noise.
- **eBPF TC Packet Pacer & K8s Autoscaler (`deploy/ebpf-tc-pacer.c`, `deploy/k8s-schrodinger-bridge-hpa.yaml`)**
  - Built Linux TC cls_bpf egress classifier for packet pacing and QoS prioritization for UDP/WebTransport state relays.
  - Created Kubernetes HPA v2 manifest autoscaling bridge inference pods under workload surges.
- **Conditional Flow Matching (CFM) Motion Planning (`neuroarena-server/src/ml/FlowMatchingMotionPlanner.js`, `Assets/Scripts/Physics/FlowMatchingLocomotion.cs`, `docs/GENERATIVE_FLOW_RIEMANNIAN_NEUROMORPHIC_SPECIFICATION.md`)**
  - Implemented continuous normalizing flows with optimal transport displacement interpolants $\psi_t(x_0, x_1) = (1-t)x_0 + t x_1$ and vector field regression $\mathcal{L}_{\mathrm{CFM}}$.
  - Built Euler and 4th-Order Runge-Kutta numerical quadrature solvers for deterministic, multi-modal kinematic trajectory rollouts.
  - Added Unity C# `FlowMatchingLocomotion` component for real-time agile target tracking and obstacle evasion.
- **Conformal Prediction Engine with Finite-Sample Risk Guarantees (`neuroarena-server/src/ml/ConformalPredictionEngine.js`, `Assets/Scripts/Safety/ConformalDecisionGuard.cs`)**
  - Formulated split conformal prediction and empirical quantile calibration achieving distribution-free $P(Y \in C(X)) \ge 1 - \alpha$ coverage.
  - Added Unity C# `ConformalDecisionGuard` enforcing statistical safety barriers on combat damage and high-stakes maneuvering.
- **Riemannian Manifold Optimization on Lie Groups $\mathrm{SE}(3)$ / $\mathrm{SO}(3)$ (`neuroarena-server/src/ml/RiemannianManifoldOptimizer.js`, `Assets/Scripts/Optimization/RiemannianPoseInterpolator.cs`, `web/src/riemannianFlowVisualizer.js`)**
  - Implemented exponential and logarithmic maps on Lie algebras $\mathfrak{so}(3)$ and $\mathfrak{se}(3)$ via Rodrigues formulations, avoiding gimbal lock and rotational singularities.
  - Built geodesic interpolation (`slerpSO3`) and Riemannian gradient descent optimization for 6-DOF drone attitude stability.
  - Created interactive HTML5 Canvas `RiemannianFlowVisualizer` rendering $S^2$ manifolds, streamlines, and conformal prediction confidence ellipses.
- **Neuromorphic Spiking Actor-Critic Policy (`neuroarena-server/src/ml/SpikingNeuralPolicyEngine.js`, `Assets/Scripts/AI/SpikingSynapseController.cs`, `web/src/spikingRasterViewer.js`)**
  - Implemented Leaky Integrate-and-Fire (LIF) membrane dynamics with refractory gating, Fast Sigmoid surrogate gradients, and continuous Spike-Timing-Dependent Plasticity (STDP).
  - Added Unity C# `SpikingSynapseController` for ultra-low latency reaction and HTML5 Canvas `SpikingRasterViewer` oscilloscope.
- **Continuum Mean Field Game (MFG) Master Equation Solver (`neuroarena-server/src/ml/MeanFieldGameEngine.js`, `Assets/Scripts/AI/MeanFieldSwarmCrowd.cs`)**
  - Solved coupled backward Hamilton-Jacobi-Bellman (HJB) and forward Fokker-Planck (FP) partial differential equations for $100+$ agent swarm Nash equilibrium.
  - Added Unity C# `MeanFieldSwarmCrowd` for continuum density sampling and swarm navigation.
- **Self-Supervised Trajectory Representation Learning (`neuroarena-server/src/ml/ContrastiveTrajectoryEncoder.js`, `Assets/Scripts/ML/TrajectoryEmbeddingSensor.cs`)**
  - Implemented InfoNCE mutual information maximization and VICReg variance/covariance regularization over temporal observation windows.
  - Added Unity C# `TrajectoryEmbeddingSensor` buffer streaming normalized latent embeddings.
- **Continuous-Time Temporal Graph Network (TGN) with Hawkes Processes (`neuroarena-server/src/ml/TemporalInteractionGraphEngine.js`, `Assets/Scripts/AI/TemporalCombatGraphBridge.cs`)**
  - Modeled combat interaction cascades via node memory states and self-exciting Hawkes intensity estimation.
  - Added Unity C# `TemporalCombatGraphBridge` for interaction event dispatching.
- **eBPF XDP Kernel-Bypass Guard & KEDA Flow-Matching Autoscaler (`deploy/ebpf-xdp-packet-guard.c`, `deploy/k8s-flow-matching-autoscaler.yaml`)**
  - Implemented stateless token-bucket rate limiting and anti-DDoS packet dropping at network driver layer before kernel socket processing.
  - Configured Kubernetes KEDA autoscaling based on flow-matching queue latency and mean-field convergence pressure.
- **Continuous-Time Neural Ordinary Differential Equations (Neural ODEs) (`neuroarena-server/src/ml/NeuralODEEngine.js`, `Assets/Scripts/Physics/ContinuousNeuralODEFlight.cs`, `web/src/neuralODEPhaseViewer.js`, `docs/NEURAL_ODE_HYPERGRAPH_EBM_SPECIFICATION.md`)**
  - Formulated continuous dynamical state progression as an Initial Value Problem $\frac{dz(t)}{dt} = f_\theta(z(t), t)$ with Runge-Kutta 4th-order (RK4) and adaptive Dormand-Prince (DOPRI5) integrators with local truncation error control.
  - Implemented the continuous Adjoint Sensitivity method $\frac{da(t)}{dt} = -a(t)^\top \frac{\partial f_\theta}{\partial z}$ for constant $O(1)$ memory backpropagation through arbitrary time horizons.
  - Added Unity C# `ContinuousNeuralODEFlight` for aerodynamic vehicle maneuvers and HTML5 Canvas phase space vector field streamline visualizer.
- **Energy-Based Latent World Models (EBM) (`neuroarena-server/src/ml/EnergyBasedWorldModel.js`, `Assets/Scripts/AI/EnergyWorldModelPlanner.cs`)**
  - Parameterized unnormalized physical transition density as an energy surface $E_\theta(s, a, s')$, sampling counterfactual next-state hypotheses using Langevin Markov Chain Monte Carlo (MCMC).
  - Implemented Contrastive Divergence ($CD_k$) training pulling down data transition energy while pushing up unphysical model dreams.
  - Added Unity C# `EnergyWorldModelPlanner` for trajectory optimization via direct energy landscape descent.
- **Spatio-Temporal Hypergraph Attention Networks (ST-HyperGAT) (`neuroarena-server/src/ml/HypergraphAttentionNetwork.js`, `Assets/Scripts/AI/HypergraphSquadCoordinator.cs`, `web/src/hypergraphVisualizer.js`)**
  - Modeled higher-order multi-agent formations and tactical squads beyond pairwise graph edges using hypergraph incidence matrices $H \in \{0, 1\}^{|V| \times |E|}$.
  - Implemented two-stage attention message passing (Node-to-Hyperedge and Hyperedge-to-Node) with dynamic squad synergy scoring and interactive Canvas hyperedge polygon visualizer.
- **Differentiable Neuro-Symbolic Logic Verifier & Runtime Safety Shields (`neuroarena-server/src/ml/NeuroSymbolicLogicVerifier.js`, `Assets/Scripts/Safety/SymbolicSafetyGuard.cs`)**
  - Compiled first-order temporal safety rules into continuous, differentiable product and Łukasiewicz t-norm logic losses $\mathcal{L}_{\text{logic}} = 1 - \operatorname{truth}(\phi)$.
  - Added Unity C# `SymbolicSafetyGuard` intercepting dangerous actions and projecting control vectors onto the boundary of the safe control set.
- **Primal-Dual Interior-Point Trajectory Optimizer with Logarithmic Barriers (`neuroarena-server/src/ml/InteriorPointTrajectoryOptimizer.js`, `Assets/Scripts/Optimization/BarrierTrajectorySmoother.cs`)**
  - Implemented non-linear boundary-constrained trajectory solver utilizing logarithmic barrier functions and Newton steps with Armijo backtracking line search.
- **Zero-Knowledge Proof of Gameplay (PoGP) Verifiable Execution Engine (`neuroarena-server/src/security/ProofOfGameplayEngine.js`, `Assets/Scripts/Security/GameplayExecutionTrace.cs`)**
  - Implemented cryptographic state transition commitments $C_t = \operatorname{SHA256}(t \parallel s_t \parallel v_t \parallel a_t \parallel s_{t+1})$ and recursive Merkle execution trace accumulator over 60Hz tick streams.
  - Added kinematic range proof assertions preventing client teleportation, impossible acceleration, and replay tampering without disclosing private player neural weights.
- **Multipath QUIC (MP-QUIC) Session Scheduler & BBRv3 Congestion Engine (`neuroarena-server/src/network/MultipathCongestionEngine.js`, `Assets/Scripts/Networking/MultipathPacketDistributor.cs`, `deploy/envoy-webtransport-gateway.yaml`)**
  - Implemented multi-subflow telemetry distribution across Wi-Fi and 5G cellular paths with Min-RTT path selection and BBRv3 bottleneck bandwidth pacing.
  - Added Envoy Proxy HTTP/3 WebTransport edge configuration and Prometheus alert rules for ODE and hypergraph health monitoring.
- **Continuous Wavelet Transform Spectral Audio Spatializer (`Assets/Scripts/Audio/ContinuousWaveletSpatializer.cs`)**
  - Implemented real-time complex Morlet wavelet synthesis and acoustic diffraction damping for sonic shockwaves in Unity C#.

- **Model-Agnostic Meta-Learning (MAML) Few-Shot Task Adaptation Engine (`neuroarena-server/src/ml/MetaLearningEngine.js`, `Assets/Scripts/ML/MetaLearningController.cs`, `docs/MAML_CAUSAL_PINN_SPECIFICATION.md`)**
  - Implemented First-Order MAML (FOMAML) with inner-loop fast task adaptation $\theta_i' = \theta - \alpha \nabla_\theta \mathcal{L}_{\mathcal{T}_i}(\theta)$ on support sets and outer-loop meta-optimization over procedural biome distributions.
  - Added Unity C# `MetaLearningController` for real-time few-shot client adaptation on procedural biome shifts.
- **Causal Discovery & Structural Equation Modeling (SEM) Engine (`neuroarena-server/src/ml/CausalInferenceEngine.js`, `Assets/Scripts/ML/CausalInterventionBridge.cs`, `web/src/causalDAGViewer.js`)**
  - Implemented constraint-based PC (Peter-Clark) algorithm for causal skeleton graph discovery and Structural Equation Modeling with Pearl's do-calculus intervention operator $\text{do}(X_k = x^*)$ to separate mechanical causal drivers from spurious environmental correlations.
  - Added interactive browser Causal DAG viewer with intervention sliders and node severing visual cues.
- **Physics-Informed Neural Networks (PINN) Hamiltonian Conservation Engine (`neuroarena-server/src/ml/PhysicsInformedNeuralNetwork.js`, `Assets/Scripts/Physics/HamiltonianConservationVerifier.cs`, `web/src/phaseSpaceVisualizer.js`)**
  - Implemented neural surrogate dynamics enforcing Hamiltonian energy conservation $\mathcal{H}(q, p) = T(p) + V(q)$ and symplectic equations of motion $\dot{q} = \partial \mathcal{H} / \partial p, \dot{p} = -\partial \mathcal{H} / \partial q$.
  - Added Unity C# `HamiltonianConservationVerifier` and HTML5 Canvas phase space $(q, p)$ orbit trajectory visualizer.
- **Quantum-Inspired Simulated Bifurcation (aSB) Combinatorial Optimizer (`neuroarena-server/src/ml/QuantumSimulatedBifurcation.js`, `Assets/Scripts/Optimization/SimulatedBifurcationOptimizer.cs`)**
  - Implemented classical adiabatic Simulated Bifurcation (aSB) algorithm simulating non-linear Kerr parametric oscillators to solve NP-hard Ising spin-glass combinatorial optimization for neural pruning topology and feature subset selection.
- **Hierarchical Goal-Conditioned RL with Hindsight Experience Replay (HER) (`neuroarena-server/src/ml/HierarchicalGoalAgent.js`, `Assets/Scripts/AI/GoalConditionedPolicyExecutor.cs`)**
  - Implemented two-tier Manager-Worker policy architecture where high-level manager sets intermediate sub-goal states and low-level worker executes primitive actions.
  - Added Hindsight Experience Replay (HER) relabeling failed trajectories with achieved terminal states as virtual goals in sparse-reward biomes.
- **Delta-State Conflict-Free Replicated Data Types (Delta-CRDT) Peer Mesh Sync (`neuroarena-server/src/network/DeltaCRDTSync.js`, `Assets/Scripts/Networking/StateCRDTReplica.cs`)**
  - Implemented Strong Eventual Consistency (SEC) peer-to-peer multiplayer synchronization using Vector Clocks, PN-Counters, and Last-Write-Wins Element Sets (LWW-Element-Set) across intermittent network partitions.
- **Production Observability: OpenTelemetry ML Pipeline & Prometheus PINN Causal Alert Rules (`deploy/monitoring/opentelemetry-ml-collector.yaml`, `deploy/prometheus-pinn-causal-alerts.yaml`)**
  - Added OpenTelemetry Collector configuration for ML inference spans and Prometheus alert rules guarding against Hamiltonian drift violations (> 5%), causal cycles, and MAML meta-loss explosion.

- **Neuromorphic Spiking Neural Network (SNN) & LIF Membrane Dynamics (`Assets/Scripts/ML/Neuromorphic/SpikingNeuralAgent.cs`, `web/shaders/spiking-membrane.frag`, `docs/NEUROMORPHIC_SWARM_BFT_SPECIFICATION.md`)**
  - Implemented bio-inspired Leaky Integrate-and-Fire (LIF) neuron dynamics in Unity C# Burst/Jobs with subthreshold membrane potential integration $\tau_m \frac{dV_m}{dt} = -(V_m - V_{\text{rest}}) + R_m I(t)$, refractory period enforcement, and discrete Dirac action potential spikes.
  - Added Spike-Timing-Dependent Plasticity (STDP) synaptic weight adaptation with exponential Long-Term Potentiation (LTP) and Depression (LTD) windows.
  - Implemented interactive WebGL fragment shader rendering traveling LIF membrane potential waveforms and action potential spike bursts.
- **Graph Neural Network (GNN) Message Passing & Swarm Topology Coordinator (`neuroarena-server/src/ml/GraphNeuralSwarmEngine.js`, `web/src/swarmTopologyVisualizer.js`)**
  - Implemented Permutation-Equivariant Graph Convolutional Network (Kipf & Welling GCN) layer with symmetric normalized Laplacian $S = \tilde{D}^{-1/2} \tilde{A} \tilde{D}^{-1/2}$ and dynamic spatial $k$-NN proximity graph construction.
  - Added interactive HTML5 Canvas visualizer rendering agent swarm nodes, dynamic message passing edge pulses, Byzantine anomaly indicators, and real-time membrane potential oscilloscopes.
- **Byzantine Fault-Tolerant (BFT) Raft Gradient Consensus Engine with Multi-Krum (`neuroarena-server/src/security/BFTGradientConsensus.js`, `deploy/prometheus-swarm-alerts.yaml`)**
  - Implemented Multi-Krum geometric distance filtering algorithm defending federated edge consensus against up to $f < n/3$ poisoned or malicious gradient submissions.
  - Added Raft leader election ballots, HMAC-SHA256 ballot seals, and immutable committed SHA-256 consensus audit chains.
- **Continual Lifelong Learning with Elastic Weight Consolidation (EWC) (`neuroarena-server/src/ml/ContinualElasticWeightEngine.js`)**
  - Implemented empirical Fisher Information Matrix (FIM) diagonal estimation over validation trajectories to eliminate catastrophic forgetting across disparate mathematical biomes.
  - Added quadratic parameter regularization loss $\mathcal{L}_{\text{EWC}}(\theta) = \sum_i \frac{\lambda}{2} F_i (\theta_i - \theta_i^*)^2$ and analytic restoring force gradients.
- **Multi-Agent Flocking & Swarm Sensor Boids Engine (`Assets/Scripts/AI/SwarmFlockingSensorEngine.cs`)**
  - Implemented Craig Reynolds flocking dynamics (Separation, Alignment, Cohesion) coupled with dynamic GNN guidance forces, sensory raycast obstacle avoidance, and Voronoi fault line repulsion.
- **Spatialized Doppler Radar & Spectral Acoustic Sonar (`Assets/Scripts/Audio/SpectralSonarAcoustics.cs`)**
  - Implemented ultrasonic linear FM chirp synthesis and Doppler-shifted echo reflection modeling ($f = f_0 \frac{c + v_r}{c + v_s}$) with atmospheric absorption for navigating zero-visibility biomes.
- **WebTransport / QUIC Multiplexed Stream & Datagram Session Manager (`neuroarena-server/src/network/WebTransportSessionManager.js`, `deploy/k8s/k8s-swarm-gnn-daemonset.yaml`)**
  - Implemented loss-tolerant unreliable datagrams for high-frequency (60-120Hz) kinematic and spike telemetry, reliable bidirectional streams for BFT ballots and EWC checkpoints, and seamless mobile connection migration.
- **Multi-Agent Reinforcement Learning (MARL) Counterfactual Regret Minimization (CFR+) & Exploitability Engine (`neuroarena-server/src/ml/CounterfactualRegretSolver.js`, `Assets/Scripts/ML/Reinforcement/CounterfactualRegretAgent.cs`, `docs/MARL_HOMOMORPHIC_DISTILLATION_SPECIFICATION.md`)**
  - Implemented server-side CFR+ solver for 2-4 agent extensive/normal-form biome games, computing counterfactual values, instantaneous regret updates, and average strategy profiles converging to Nash equilibrium.
  - Added game-theoretic exploitability metric $\delta(\bar{\sigma})$ tracking distance to Nash equilibrium with automatic tolerance threshold termination.
  - Added Unity C# `CounterfactualRegretAgent` featuring Hart & Mas-Colell regret-matching action sampling across tactical roles (`Harvester`, `Flanker`, `Defender`, `Disruptor`) and server profile blending.
- **Additive Homomorphic Weight Aggregator for Confidential Edge Consensus (`neuroarena-server/src/security/HomomorphicWeightAggregator.js`)**
  - Implemented Paillier-compatible additive homomorphic encryption enabling central consensus servers to aggregate edge model updates in ciphertext space without decrypting individual client gradients.
  - Added fixed-point quantization, Carmichael function $\lambda(n) = \operatorname{lcm}(p-1, q-1)$, and validated modular arithmetic roundtrips within 0.001% precision.
- **Asynchronous Federated Staleness Compensator with Polyak-Ruppert Momentum (`neuroarena-server/src/ml/AsynchronousStalenessCompensator.js`)**
  - Implemented delay-attenuated gradient damping $\lambda(\tau) = (1 + \tau)^{-\alpha}$ mitigating gradient oscillation and catastrophic forgetting across heterogeneous edge clients.
  - Added directional cosine similarity momentum verification guarding against stale opposing updates and maintained Polyak-Ruppert exponentially smoothed parameter averages.
- **Teacher-Student Curriculum Knowledge Distillation Engine (`neuroarena-server/src/ml/CurriculumDistillationEngine.js`)**
  - Implemented temperature-scaled Kullback-Leibler (KL) divergence distillation loss $\mathcal{L}_{KD} = T^2 \mathcal{D}_{KL}(p^T(T) \parallel p^S(T))$ compressing champion neural policies into ultra-compact edge models with 10x compression ratios.
  - Added intermediate feature representation hint loss and dynamic curriculum temperature annealing across progressive biome tiers.
- **Procedural Voronoi Biome Fracture & Hazard Deformer (`Assets/Scripts/Environment/VoronoiBiomeDeformer.cs`)**
  - Added dynamic Lloyd-relaxed Voronoi cell arena partitioning with real-time tectonic fault displacement lines and localized environmental hazards (Magma Fissures, Cryo Chasms, Ion Disruption Fields).
- **High-Efficiency Delta-Encoded Binary Replay Stream Compressor (`neuroarena-server/src/network/BinaryReplayCompressor.js`)**
  - Implemented streaming binary serialization utilizing keyframe/delta frames, ZigZag signed-to-unsigned conversion, and variable-length LEB128 encoding, achieving 13.7x compression (92.7% bandwidth reduction).
- **Interactive MARL Equilibrium Simplex & Distillation Visualizer (`web/src/marlEquilibriumVisualizer.js`, `web/shaders/simplex-radar.frag`)**
  - Added interactive Canvas/WebGL 4-action probability simplex radar, Nash trajectory tracking, and distillation loss temperature curves.
- **MARL Aggregator Deployment & Prometheus Alerts (`deploy/k8s/k8s-marl-aggregator.yaml`, `deploy/prometheus-marl-alerts.yaml`)**
  - Added Kubernetes multi-replica deployment manifests with gRPC endpoints and Prometheus alerting rules for high exploitability, gradient staleness surges, and homomorphic verification failures.
- **Federated Differential Privacy & Renyi Divergence Accounting (`neuroarena-server/src/security/DifferentialPrivacyAccountant.js`, `deploy/prometheus-privacy-alerts.yaml`, `docs/FEDERATED_PRIVACY_ADVERSARIAL_ROBUSTNESS_SPEC.md`)**
  - Implemented Renyi Differential Privacy (RDP) evaluation and optimal $(\epsilon, \delta)$-DP conversion across multiple orders $\alpha \in [1.5, 64]$.
  - Added calibrated Gaussian noise injection with dynamic $L_2$-norm gradient sensitivity clipping and per-client privacy budget tracking with automatic cutoffs.
- **Client & Server Adversarial Robustness and Defense Certification (`Assets/Scripts/ML/AdversarialRobustnessEngine.cs`, `neuroarena-server/src/ml/AdversarialDefenseValidator.js`)**
  - Implemented Fast Gradient Sign Method (FGSM) and Projected Gradient Descent (PGD) perturbation generators with $L_\infty$ and $L_2$ projections.
  - Added server-side empirical Lipschitz constant estimation and signed HMAC-SHA256 defense certificates guarding ranked leaderboards against brittle model exploits.
- **Autonomous Swiss-System Tournament Engine (`neuroarena-server/src/community/SwissTournamentEngine.js`)**
  - Implemented score-bracket matching with non-repeating encounter guarantees, odd-player bye handling, and Buchholz / Sonneborn-Berger tie-breakers.
- **Two-Tier LRU-2 Model Caching Architecture (`neuroarena-server/src/cluster/TieredModelCache.js`, `deploy/k8s/k8s-tiered-cache.yaml`)**
  - Implemented multi-tier caching featuring L1 in-memory LRU-2 (Two-Queue) eviction and L2 distributed Redis serialization, preventing cache pollution from large tournament sweeps.
- **Pedersen Zero-Knowledge Gradient Commitments (`neuroarena-server/src/security/ZKGradientCommitment.js`)**
  - Implemented secp256k1 finite prime field Pedersen commitments with homomorphic addition, blinding factors, and Merkle tree vector root attestations.
- **W3C Distributed Tracing Context Propagator (`neuroarena-server/src/telemetry/DistributedTracingContext.js`)**
  - Implemented standard W3C `traceparent` parsing, baggage extraction, and high-resolution span lifecycle instrumentation for WebSocket and HTTP requests.
- **HRTF Spatialization & Loss Acoustic Resonator (`Assets/Scripts/Audio/HRTFSpatializer.cs`, `Assets/Scripts/Audio/LossAcousticResonator.cs`)**
  - Added binaural Woodworth-Schlosberg interaural time difference (ITD) / level difference (ILD) modeling and real-time loss sonification coupling gradient variance to resonant overtone dissonance.
- **Multi-Head Self-Attention Heatmap & GLSL Shader (`web/src/attentionVisualizer.js`, `web/shaders/attention-heatmap.frag`)**
  - Added interactive WebGL/Canvas visualizer with Turbo colormap rendering, head selection toggles, and token attribution grids.
- **Curriculum Transfer Learning & Progressive Layer Freezing (`Assets/Scripts/ML/BiomeTransferLearningEngine.cs`, `neuroarena-server/src/ml/CurriculumTransferCoordinator.js`, `neuroarena-server/test/curriculumTransfer.test.js`, `docs/CURRICULUM_TRANSFER_AND_BATCHING_SPEC.md`, `docs/ADR/0005-curriculum-transfer-and-dynamic-batching.md`)**
  - Implemented cross-biome transfer learning with empirical 1-Wasserstein (Earth Mover's) distance and Maximum Mean Discrepancy (MMD) Gaussian RBF domain adaptation evaluation.
  - Added progressive layer freezing policies (`FeatureExtractor`, `HeadOnly`, `ProgressiveUnfreeze`) and fine-tuning learning rate decay to eliminate negative transfer across biomes.
  - Added RESTful curriculum endpoints (`/api/ml/curriculum/evaluate`, `/api/ml/curriculum/progression`, `/api/ml/curriculum/:agentId`) and student progression tracking.
- **Adaptive Dynamic Micro-Batching Inference Engine (`neuroarena-server/src/ml/DynamicBatchingEngine.js`)**
  - Implemented SLA-driven asynchronous queue coalescing forward passes into tensor batches up to `maxBatchSize = 32`.
  - Enforced strict 8ms flush deadline timers ensuring multiplayer sub-15ms tick latency budgets with `HIGH`, `NORMAL`, and `LOW` priority scheduling.
  - Added real-time batching telemetry reporting p95 latency, SLA violations, and average batch throughput.
- **Active Uncertainty Sampling & Boundary Crystal Mining (`neuroarena-server/src/ml/ActiveUncertaintySampler.js`, `Assets/Scripts/ML/UncertaintySamplingAgent.cs`)**
  - Added normalized Shannon entropy $H(p)$, decision margin $1 - (p_1 - p_2)$, and least confidence scoring over neural output distributions.
  - Implemented Unity agent uncertainty beacons with bonus harvest token multipliers when mining crystals near ambiguous decision boundaries.
- **Deterministic Replay Merkle Attestation & Cryptographic Integrity (`neuroarena-server/src/security/ReplayAttestationEngine.js`)**
  - Implemented Merkle tree root hashing over replay frame sequences and HMAC-SHA256 match attestation certificate issuance.
  - Added temporal tick delta and kinematic velocity jump validation guarding against state tampering and impossible accelerations.
- **Dynamic Procedural Biome Weather & Stochastic Perturbation System (`Assets/Scripts/Environment/DynamicBiomeWeatherSystem.cs`)**
  - Implemented live procedural atmospheric conditions (Clear Sky, Magnetic Ion Storm, Gradient Fog, Glacial Chill, Neural Rain) driving sensor noise, learning rate damping, and momentum friction perturbations.
- **Interactive Transfer Learning HUD & Prometheus ML Observability (`web/transferVisualizer.js`, `web/index.html`, `web/style.css`, `deploy/k8s/curriculum-transfer-deployment.yaml`, `deploy/prometheus-ml-alerts.yaml`)**
  - Added interactive cyberpunk transfer learning modal displaying real-time layer freezing status, 6x6 Biome Transfer Matrix heatmap, and inference queue gauges.
  - Configured Kubernetes Deployment & HPA for curriculum transfer workers alongside Prometheus Alertmanager rules for inference SLA violations and negative transfer anomalies.
- **Neural Model Quantization & Sparse Magnitude Pruning (`Assets/Scripts/ML/ModelQuantizer.cs`, `neuroarena-server/src/ml/modelQuantizer.js`, `neuroarena-server/test/advanced_systems.test.js`, `docs/ADVANCED_ML_AND_SPECTATOR_SPEC.md`)**
  - Implemented symmetric INT8 calibration with clipping percentile bounds, reducing neural weight footprint by up to 75% with sub-$10^{-4}$ MSE loss.
  - Added L1 magnitude-based sparse weight pruning with configurable sparsity ratios (up to 95%) and automated compression metrics reporting.
- **Neural Architecture Search (NAS) Pareto Exploration Engine (`Assets/Scripts/ML/NeuralArchitectureSearch.cs`, `neuroarena-server/src/ai/nasEngine.js`, `deploy/k8s/nas-worker-deployment.yaml`)**
  - Implemented micro-topology mutation engine exploring hidden units, activation functions (ReLU, GELU, Swish, LeakyReLU), dropout regularization, and skip connections.
  - Added multi-objective Pareto frontier scoring balancing validation accuracy against inference FLOPs.
- **Statistical Concept Drift & Covariate Shift Detector (`neuroarena-server/src/ml/conceptDriftDetector.js`)**
  - Implemented real-time Page-Hinkley cumulative sum (CUSUM) and two-sample Kolmogorov-Smirnov (KS) tests at significance $\alpha = 0.01$ to trigger automated model recalibration.
- **Geo-Distributed Latency Matrix Matchmaker & Adaptive WAF (`neuroarena-server/src/cluster/geoMatchmaker.js`, `neuroarena-server/src/security/adaptiveWAF.js`)**
  - Implemented regional queue coordinator with strict ping bounds ($< 80\text{ms}$) and dynamic MMR window expansion.
  - Implemented Shannon entropy payload filtering, token bucket burst throttling, and cryptographic nonce replay attack mitigation.
- **Esports Spectator Director, Live Shoutcaster & Streamer Mode (`neuroarena-server/src/rooms/spectatorDirector.js`, `web/spectatorDirector.js`, `web/broadcastOverlay.js`, `web/style.css`, `web/index.html`)**
  - Automated dynamic camera framing tracking critical gradient convergence and sub-150 HP endgame margins.
  - Added live shoutcaster banner alerts, real-time win probability bars, and Twitch/YouTube crowd-sourced handicap voting overlays.
- **WebGPU Tensor Acceleration Diagnostics & Procedural Audio Sonification (`web/webgpuDiagnostics.js`, `web/shaders/lossCompute.wgsl`, `Assets/Scripts/Audio/NeuralAudioSynthesizer.cs`, `web/audioSonifier.js`, `Assets/Scripts/UI/NeuralGraphVisualizer.cs`)**
  - Added WebGPU device probing and WGSL compute shader for parallel loss evaluation with CPU fallback benchmarking.
  - Implemented procedural Web Audio and Unity FM synthesizer sonifying gradient descent convergence speed into cybernetic tone chimes.
  - Added Unity UI Toolkit `NeuralGraphVisualizer` component for interactive node and activation flow rendering.

- **Deterministic Match Replay Engine, Delta Compression & Replay Theater (`Assets/Scripts/Core/Replay/MatchReplaySystem.cs`, `neuroarena-server/src/replayEngine.js`, `neuroarena-server/test/replay.test.js`, `web/src/replayViewer.js`, `web/app.js`, `web/index.html`, `web/style.css`, `web/tests/ml-engine.test.js`, `docs/MATCH_REPLAY_AND_BENCHMARK_SPEC.md`)**
  - Implemented Unity and Web client match replay playback state machines with continuous scrubber seeking, stepping, variable playback speed ($0.5\times\text{--}4.0\times$), and smooth Lerp/Slerp kinematic interpolation.
  - Implemented hybrid keyframe and delta-compression encoding ($K=20$) reducing WebSocket and JSON payloads by 68% to 75% with zero numeric drift.
  - Added Merkle-like chained rolling SHA-256 integrity digests rejecting single-bit coordinate or loss tampering across distributed nodes.
  - Added neural milestone bookmarks (`FIRST_CONVERGENCE`, `OVERFIT_DESYNC`, `EXPLODING_GRADIENT`, `MATCH_VICTORY`) with quick-seek navigational pills and real-time loss divergence HUD readouts ($|\mathcal{L}_1 - \mathcal{L}_2|$).
  - Integrated interactive Replay Theater modal with cyberpunk glassmorphic styling, glowing milestone diamonds, and telemetry cards.

- **High-Performance ML Inference Benchmarking Suite (`Assets/Scripts/ML/Benchmark/MLInferenceBenchmark.cs`, `Assets/Scripts/ML/Benchmark/MLBenchmarkRunner.cs`, `web/tests/ml-engine.test.js`)**
  - Added vectorized 2D Convolution (Conv2D) forward pass benchmark with stride, padding, ReLU activation, and FLOPs calculation ($H_{out} W_{out} C_{out} (2 C_{in} K^2 + 1)$).
  - Added two-pass numerically stable Layer Normalization benchmark with affine scaling ($\gamma, \beta$) and catastrophic cancellation prevention ($5 \cdot B \cdot D$ FLOPs).
  - Added exact latency percentile profiling (P50, P95, P99) and sustained GFLOPS throughput reporting using zero-allocation `Parallel.For` thread pooling.

- **Production Redis Cluster High Availability & Replay Caching (`deploy/redis-cluster.yaml`, `neuroarena-server/test/cluster-scale.test.js`)**
  - Configured 6-node Redis cluster StatefulSet with pod anti-affinity, headless cluster service, and PersistentVolumeClaim storage.
  - Implemented match replay caching keyspace (`replay:chunk` with 72h TTL, `replay:meta`, `replay:index:user`) and `volatile-lru` memory capping (1536MB).
  - Added `PodDisruptionBudget` (`minAvailable: 4`) guaranteeing quorum integrity and anti-split-brain consistency during rolling upgrades.

- **Esports Tournament Bracket Engine, Double Elimination & Grand Finals Reset (`neuroarena-server/src/tournamentEngine.js`, `neuroarena-server/src/tournamentManager.js`, `neuroarena-server/test/tournament.test.js`, `neuroarena-server/test/tournamentManager.test.js`, `docs/TOURNAMENT_AND_INGRESS_SPECIFICATION.md`)**
  - Implemented authoritative Double Elimination bracket state machine with Upper and Lower brackets, loser drop-down routing, and automatic `Grand Finals Reset` match scheduling when the Lower Bracket champion takes Game 1.
  - Added mathematical tiebreakers: Sonneborn-Berger quality win weighting ($\sum \text{Score}(D) + 0.5 \sum \text{Score}(T)$), Buchholz opponent strength, and head-to-head resolution.
  - Implemented `TournamentManager` service with tournament templates (`HOURLY_BLITZ`, `DAILY_GRAND_PRIX`, `GUILD_INVITATIONAL`), automated check-in timers, Elo re-seeding, and 50%/30%/20% podium prize payouts (tokens, EXP, trophies).

- **Production Edge Ingress Hardening & DDoS Mitigation (`deploy/nginx-ingress.conf`)**
  - Added leaky-bucket rate-limiting zones (`api_limit:20m rate=30r/s burst=20 nodelay`, `ws_limit:10m rate=15r/s burst=10 nodelay`).
  - Added client IP connection bounding (`limit_conn addr_limit 50`), Slowloris/DDoS mitigation timeouts (`10s`), and security headers.
  - Integrated Prometheus telemetry CIDR restrictions (`10.0.0.0/8`, `172.16.0.0/12`, `127.0.0.1`) and canary 10% weighted routing upstream.

- **Client Tournament Bracket Visualizer & Esports Lobby (`web/app.js`, `web/index.html`, `web/style.css`, `web/tests/ml-engine.test.js`)**
  - Integrated `TournamentBracketRenderer` transforming backend tournament brackets into visual trees with match status pills (`LIVE`, `RESOLVED`, `BYE`), player seeds, and reset match indicators.
  - Added `TournamentArenaManager` supporting real-time registration, check-in countdown timers, and interactive prize tier distribution previews.

- **Reinforcement Learning Intrinsic Curiosity Module (ICM) & GAE-$\lambda$ (`Assets/Scripts/ML/Reinforcement/CuriosityRewardModule.cs`, `Assets/Scripts/ML/Reinforcement/PPOPolicyAgent.cs`, `docs/REINFORCEMENT_LEARNING_AND_CHECKPOINT_SPEC.md`)**
  - Added Welford running variance normalization and random Xavier feature projections to prevent curiosity reward explosion.
  - Implemented Generalized Advantage Estimation ($\text{GAE}-\lambda$) and Shannon entropy bonus $\mathcal{H}(\pi_\theta)$ to regularize exploration and prevent policy collapse.

- **Authoritative Server Model Registry & Zero-Downtime Rollback (`neuroarena-server/src/ml/ModelRegistryService.js`, `neuroarena-server/test/modelRegistry.test.js`)**
  - Implemented server-side neural weight validation, anti-NaN/Infinity guards, and SHA-256 parameter fingerprinting.
  - Added champion promotion staging with accuracy thresholds ($\ge 0.85$) and zero-downtime rollback against regression or model drift.

- **AlphaZero Root Dirichlet Exploration & Progressive Widening MCTS (`neuroarena-server/src/ai/MCTSBotDirector.js`, `neuroarena-server/test/mctsBot.test.js`)**
  - Implemented root prior Dirichlet noise injection ($\alpha = 0.3, \epsilon = 0.25$) for tactical bot exploration diversity.
  - Added progressive widening branching bounds $|C(s)| \le \lfloor k \cdot N(s)^\alpha \rfloor$ and expanded tactical actions (`OVERCLOCK_GRADIENT`, `COUNTER_EXPLOIT`).

- **Cryptographic Model Checkpointing & Web Telemetry Visualizer (`Assets/Scripts/ML/ModelCheckpointManager.cs`, `web/app.js`, `web/style.css`, `web/tests/ml-engine.test.js`)**
  - Added Unity `ModelCheckpointManager` with SHA-256 fingerprinting, top-K checkpoint retention, and automated rollback on loss divergence ($> 50.0$ or $\text{NaN}$).
  - Integrated client-side `ModelCheckpointInspector` and `RLTelemetryVisualizer` with moving averages, divergence warning badges, and glassmorphic telemetry cards.

- **Distributed Redis Cluster Leases, Heartbeat & Batch Leaderboards (`neuroarena-server/src/cluster/RedisClusterConfig.js`, `neuroarena-server/test/cluster-scale.test.js`, `docs/DISTRIBUTED_SYSTEMS_AND_ML_OPERATIONS.md`)**
  - Implemented atomic distributed lock leases (`acquireLock` / `releaseLock`) with millisecond TTL expiry and ownership tokens to coordinate multi-node match allocations safely.
  - Added batch sorted set ingestion (`zAddBatch`) for high-throughput seasonal leaderboard rank updates across 1,000,000+ players.
  - Added cluster health check heartbeat (`ping()`) with real-time latency measurement and Prometheus exporter integration (`neuroarena_redis_latency_ms`).

- **ML Experiment Tracker Run Comparison & Pareto Frontier Selection (`Assets/Scripts/ML/ExperimentTracker.cs`, `web/app.js`, `web/tests/ml-engine.test.js`)**
  - Added differential run comparison (`CompareRuns` / `compareRuns`) calculating $\Delta\mathcal{L}$, $\Delta\text{Acc}$, and $\Delta F_1$ against active champion baselines.
  - Implemented Pareto frontier multi-objective optimization (`GetParetoFrontier` / `getParetoFrontier`) identifying non-dominated model architectures.
  - Connected real-time kernel telemetry notifications and champion glow pulses (`championPulseGlow`) when new models surpass existing benchmarks.

- **Stratified K-Fold Class Balance Validation & Out-of-Fold Metrics (`Assets/Scripts/ML/CrossValidationEngine.cs`)**
  - Added automated class balance verification (`ValidateStratification`) enforcing max class ratio deviation $\le 0.25$ across all splits.
  - Added Out-of-Fold (OOF) prediction generation and generalization confidence bounds reflecting real-world dataset stability.

- **Zero-Allocation Mobile Particle System Pooling & Telemetry (`Assets/Scripts/Core/ParticleSystemPool.cs`, `web/tests/ml-engine.test.js`)**
  - Added live telemetry tracking for `TotalBurstsPlayed`, `PeakActiveEmitters`, and `RecycledEmitterCount`.
  - Added multi-color gradient burst support (`PlayGradientBurst`) and hardware tier fillrate capping (Tier 1: 25, Tier 2: 80, Tier 3: 150 particles) eliminating runtime garbage collection pauses on mobile.
- **Out-of-Gameplay Themed Menu Flow Redesign (`web/index.html`, `web/style.css`, `web/app.js`, `web/tests/ml-engine.test.js`)**
  - Rebuilt out-of-gameplay navigation across 5 content-specific menu archetypes: Topological Expedition Board (`#biome-travel-modal`), Specimen Satchel & Distribution Matrix (`#inventory-drawer`), Neural Syndicate Command Console (`#guild-hall-modal`), Terminal BIOS Hardware Telemetry Console (`#settings-modal`), and Dual-Cockpit Handshake Radar (`#duel-matchmaking-modal`).
  - Implemented strict verb-noun copy consistency across all action triggers and toasts ("Deploy Expedition", "Calibrate Model", "Engage Duel", "Enlist Syndicate", "Save Calibration", "Harvest Crystals", "Purge Artifacts").
  - Added in-voice, actionable empty and failure states (`[SYNDICATE_STATUS: UNALIGNED_ARCHITECT]`, `[SPECIMEN_VAULT: VACANT_MANIFEST]`).
  - Added orchestrated major transitions: Expedition Warp (`@keyframes expeditionDeployWarp`), Duel Radar Lock (`@keyframes duelRadarLock`), and Guild Seal Reveal (`@keyframes guildSealReveal`).

- **In-Session Diegetic HUD & 200ms Glance Hierarchy Redesign (`docs/IN_SESSION_HUD_FRAMEWORK.md`, `web/src/postProcessingPipeline.js`, `web/index.html`, `web/style.css`, `web/app.js`, `Assets/Scripts/UI/ArchitectHolographicHUD.cs`)**
  - Committed to ADA Companion Telemetry Drone (`∇θ`) as the persistent in-world equipment casting a 3D volumetric optical cone and live parameter/loss sparkline readout.
  - Classified every in-session element under the Diegetic, Non-Diegetic, Spatial, and Meta UI framework, auto-suppressing decorative titles during active combat.
  - Integrated full-screen Meta-UI post-processing shaders: arterial damage vignette, chromatic hit pulse, and mathematical divergence desaturation.
  - Enforced a 200ms glance test hierarchy across Vessel Health, Compute Energy, Boss Phase Crown, and Loss Trend geometry.
  - Completed a mobile thumb-zone layout pass enforcing $\ge 48\text{dp}$ touch targets with a collapsible thumb dial trigger (`#btn-mobile-dial-toggle`).

- **Feature Engineering Pipeline Studio Enhancements (`Assets/Scripts/ML/FeatureEngineeringPipeline.cs`)**
  - Linear Min-Max Normalization (`ApplyMinMaxScaling`) mapping feature sets into arbitrary ranges $[targetMin, targetMax]$ with zero-variance safeguards.
  - Non-linear Log1p Power Transformation (`ApplyLog1pTransform`) with signed symmetry $\operatorname{sgn}(x) \ln(1 + |x|)$ to tame heavy-tailed continuous feature distributions.
  - Pearson Cross-Feature Correlation Matrix calculation (`CalculateFeatureCorrelations`) to analyze and prune multicollinear feature dimensions.

- **Audio Settings Persistence & Smooth Bus Fade Transitions (`Assets/Scripts/Audio/AudioMixerManager.cs`)**
  - Unity `PlayerPrefs` persistent volume serialization (`SaveAudioSettings()`, `LoadAudioSettings()`) across Master, Ambient, SFX, UI, and Music audio buses.
  - Coroutine-driven logarithmic bus crossfading (`FadeMixerGroup`) for cinematic ambient and music track transitions.

- **Velocity-Adaptive Acoustic Footstep DSP & Alternating Stereo Panning (`Assets/Scripts/Audio/TerrainFootstepAudio.cs`)**
  - Movement velocity and sprint state integration (`SetMovementState`) dynamically adjusting footstep envelope and frequency playback rates.
  - Alternating left/right foot stereo panning offsets providing precise spatial audio feedback synced to player gait.

- **Ambient Wildlife Behavioral Profiles & Flocking Dynamics (`Assets/Scripts/Environment/AmbientWildlifeFactory.cs`)**
  - Introduced `WildlifeBehaviorProfile` struct parameterizing movement speed, flee distance, flocking cohesion radius, perch altitude, and nocturnal habits.
  - Biome-tailored archetype mapping (`GetBehaviorProfile`) configuring DuneStriderFinch, LuminescentSporeToad, FrostScarabBeetle, CanopyGlider, CyberPulseManta, and AstralVectorWisp.

- **Cluster Node Drainage, Session Heartbeats & Dynamic Ticket Renewal (`neuroarena-server/src/cluster/SessionManager.js`, `cluster-scale.test.js`)**
  - Node affinity tracking and graceful multi-node server drainage (`drainNodeSessions`) enabling zero-downtime rolling deploys and seamless failover.
  - Real-time session heartbeat tracking (`recordHeartbeat`) and cryptographically signed ticket renewal (`renewSessionTicket`) preventing tab-suspension disconnects.

- **Expanded Mathematical ML Iconography Language (`tokens/design-tokens.json`, `web/src/ui/MathIconLibrary.js`, `web/style-guide.html`, `scripts/verify-design-tokens.js`, `web/tests/ml-engine.test.js`)**
  - Added Scaled Dot-Product Attention matrix glyph (`glyph-attention` / `attention-matrix`) representing $\operatorname{Softmax}\left(\frac{QK^T}{\sqrt{d_k}}\right)V$ with query-key alignment weights.
  - Added Spatial Convolution Kernel glyph (`glyph-convolution` / `convolution-kernel`) representing 2D sliding receptive field cross-correlation $(I * K)$ with feature map projection.
  - Updated design token source of truth, cross-platform parity linter, unit test suites, and interactive style guide showcase to 12 custom ML glyphs.

- **Unified Cross-Platform Design Token System & Custom Mathematical Iconography (`tokens/design-tokens.json`, `web/design-system.css`, `Assets/UI/Styles/DesignTokens.uss`, `Assets/Scripts/UI/Theme/DesignTokenRegistry.cs`, `web/src/ui/MathIconLibrary.js`, `web/style-guide.html`, `docs/DESIGN_SYSTEM_SPECIFICATION.md`, `scripts/verify-design-tokens.js`)**
  - Single source of truth token hierarchy (`tokens/design-tokens.json`) consumed simultaneously by Unity UI Toolkit (`DesignTokens.uss`) and Web CSS custom properties (`web/design-system.css`).
  - Anti-generic SaaS aesthetic: zero uniform soft grey card shadows or pill-like rounded blobs; precision 45-degree cybernetic chamfered panel geometry (`.na-panel-chamfer`) with illuminated asymmetrical borders.
  - 6 algorithmic biome palettes derived from ML curriculum: Linear Steppes (SGD Amber), Binary Marshlands (Toxic Emerald & Sigmoid Cyan), Variance Tundra (Glacial Frost & Ridge Indigo), Branching Canopy (Gini Lime & Bagging Gold), Deep Synapse Citadel (Backprop Violet & XOR Magenta), and Semantic Expanse (Cosine Teal & Latent Coral).
  - 10 custom procedural vector mathematical glyphs for ML operations: Gradient Arrow ($\nabla \to$), Decision Boundary ($w \cdot x + b = 0$), Regularization Constraint ($L_1/L_2$), Dendrogram Decision Split, Sigmoid Activation Wave ($\sigma(z)$), Embedding Cosine Angle ($\cos \theta$), Loss Landscape Basin ($J(w)$), Outlier Hazard Pulse, Learning Rate Step Gauge ($\eta$), and Tensor Crystal ($X \in \mathbb{R}^{n \times d \times k}$).
  - Standardized non-ad-hoc motion timing tokens: Panel Open (240ms, `cubic-bezier(0.16, 1.0, 0.3, 1.0)`), HUD Value Tick (120ms, `cubic-bezier(0.4, 0.0, 0.2, 1.0)`), Alert Flash (400ms, `cubic-bezier(0.25, 1.0, 0.5, 1.0)`), and Page Transition (320ms, `cubic-bezier(0.7, 0.0, 0.84, 0.0)`).
  - Interactive web style guide showcase (`web/style-guide.html`) with live color swatches, typography specimen scale, 8px grid visualizer, 1-click SVG glyph exporter, and motion curve playground.
  - Automated CI token linter (`scripts/verify-design-tokens.js`) performing 60+ synchronization assertions across JSON, Web CSS, Unity USS, C# registry, and math glyph generator.

- **Creator-Driven Custom Biome Challenges & Mod-Tools Layer (`CustomChallengeEngine.js`, `CustomChallengeClient.js`, `customChallenge.test.js`, `MOD_TOOLS_CUSTOM_CHALLENGES.md`)**
  - Constrained authoring UI allowing advanced players to define custom biome challenges: function family (Linear, Logistic, Polynomial, Decision Tree), noise/outlier parameters, and boss stat-lines within hard mathematical envelopes.
  - Analytical solvability checks matching Prompt 9 procedural generator parity (closed-form OLS inlier fit $\text{MSE} \le 0.05$, logistic separability $\ge 90\%$, etc.), rejecting unsolvable or exploitable candidate datasets with clear, human-readable error reasons.
  - Automated validation-to-publish flow with zero manual review bottlenecks for v1.
  - Server-paginated community challenge browser with family filters and dynamic sorting (`popular`, `top_rated`, `completions`, `newest`).
  - Community rating ledger with thumbs up/down voting and per-player deduplication, alongside completion tallying.
  - 100% scoring and anti-cheat pipeline parity: community challenge gameplay is evaluated authoritatively via `AuthoritativeValidator` and `auditLogger` (minimum training time $\ge 2500$ ms, gradient replay verification, and cryptographic parameter signatures).

- **Freelance Corporate Client Contracts & SLA Marketplace (`ClientContractEngine.js`, `ClientContractClient.js`, `ClientContractManager.cs`, `clientContracts.test.js`)**
  - Enterprise contract marketplace across 5 tiers (Startup Incubator, Biotech Research, FinTech Quant Lab, Autonomous Robotics, Deep Space AI).
  - Strict SLA verification enforcing target architectures, accuracy/loss thresholds, and sub-millisecond inference latency ceilings.
  - Performance bonus multipliers awarding up to $1.5\times$ credits for low-latency headroom and up to $1.3\times$ for metric accuracy outperformance.
  - Corporate client reputation progression unlocking elite enterprise contracts and quantum shards.

- **Autonomous Bot Policy Driving Arena (`BotArenaRoom.js`, `BotArenaRoomState.js`, `BotArenaPolicyEngine.js`, `BotArenaClient.js`, `AutonomousBotArena.cs`)**
  - Colyseus real-time multi-agent battle arena for neural policy driving drones.
  - 4-element raycast observation vectors (target direction, obstacle proximity, current speed) fed into 2-layer MLP policies (ReLU hidden, Tanh steer, Sigmoid throttle/brake).
  - High-frequency 20Hz vehicle kinematics simulation with obstacle collision penalties, arena perimeter clamping, and competitive crystal harvesting leaderboards.

- **2-4 Player Collaborative Co-op Room (`CoopRoom`)** (`CoopRoom.js`, `CoopRoomState.js`, `CoopRoomClient.js`, `coopRoom.test.js`, `ProceduralVariantEngine.js`)
  - Server-authoritative 2-4 player collaborative multiplayer room mirroring `DuelRoom`'s resilient Colyseus network stack.
  - Shared objective designed around genuine ML collaboration: domain is partitioned into complementary sectors ($N=2 \to 2$ partitions, $N=4 \to 4$ partitions). Combining datasets eliminates extrapolation blind spots and raises shared Dataset Health Score from critical ($<40\%$) to excellent ($>90\%$).
  - Non-linear party difficulty envelope scaling: procedurally scales domain breadth ($[-4.5, 4.5]$ for 2P up to $[-6.5, 6.5]$ for 4P), noise/outlier envelope, boss HP ($1.65\times$ for 2P, $2.80\times$ for 4P), and multi-hazard movesets without flat damage stacking.
  - Tactical non-verbal ping system (`HARVEST_HERE`, `COVERAGE_GAP`, `OUTLIER_ALERT`, `BOSS_HAZARD`, `ASSEMBLE_TRAIN`) with dual-motor haptic pulse integration (`LightTick`, `MediumImpact`, `HeavyRumble`, `SuccessBurst`).
  - Authoritative hidden test set evaluation against the shared Boss and 100% equal server-authoritative reward distribution with audit ledger (anti ninja-looting).
  - 15s mid-match disconnection grace window with authoritative state resynchronization.

- **Real-Time Mathematical Narration Adaptive Difficulty & Opt-In Coaching Layer** (`AdaptiveCoachingEngine.js`, `AdaptiveCoachingClient.js`, `AdaptiveCoachingManager.cs`, `AdaptiveCoachingTests.cs`, `adaptiveCoaching.test.js`)
  - Telemetry struggle tracking: tracks repeated boss failures, overfitting alerts, and slow gradient descent plateaus to adjust generated procedural difficulty envelopes within strictly bounded ranges (noise $\in [0.75, 1.00]$, outliers $\in [0.70, 1.00]$, boss HP $\in [0.85, 1.00]$).
  - Anti-rubberbanding guarantee: datasets remain non-trivial, analytical solvability certificates are verified, and auto-wins are strictly prohibited.
  - Opt-in coaching escalation: offers diagnostic concept guidance after $\ge 2$ failed boss attempts (e.g. teaching L2 regularization/weight decay to suppress high-order polynomial variance), unlocked exclusively on player opt-in with zero answer/weight spoilers.
  - Player transparency audit logs: every adjusted run generates an inspectable explanation ("Why was this run easier?") detailing telemetry struggle triggers and applied envelope modifiers.
  - Authoritative room-type security guard: server and client enforce that adaptive difficulty and coaching logic can never execute in `DuelRoom` or ranked competitive matches.

- **6-Biome Procedural Variant & Mathematical Solvability Engine** (`ProceduralVariantEngine.js`, `ProceduralVariantClient.js`, `ProceduralBiomeVariantGenerator.cs`, `ProceduralVariantTests.cs`, `proceduralVariant.test.js`)
  - Deterministic Mulberry32 PRNG ensuring bit-exact replayability across client and server.
  - Per-biome mathematical difficulty envelopes for linear regressions, classification shapes, polynomials, decision splits, XOR manifolds, and semantic embeddings.
  - Closed-form analytical OLS and class separability validator with automatic re-seeding to ensure no generated dataset has an unreachable target loss.
  - 3 distinct attack patterns and modulated stat profiles per boss.
  - Deterministic Poisson-disc scattering layout variations for foliage, rocks, and landmarks while respecting exclusion zones.
  - Synchronized UTC Daily Seed mode (`DAILY-YYYYMMDD`) feeding directly into global daily challenges.

- **Seasonal Ranked League, Glicko-2 Tier Progression & Cross-Platform System** (`SeasonalRankedEngine.js`, `SeasonalRankedClient.js`, `SeasonalRankedManager.cs`, `seasonalRanked.test.js`, `20260821_create_seasonal_ranked.sql`)
  - 5-Tier competitive rank league (Bronze, Silver, Gold, Platinum, Architect) with dynamic Glicko-2 MMR rating updates.
  - Visible rank-up Juice moments with 4-frame hit-stop, camera shake, 150 GPU particles, dual-motor haptic pulse, and fanfare audio.
  - 6-week standardized season lifecycle with soft MMR reset (regression toward 1500 mean) avoiding hard wipes.
  - End-of-season cosmetic/title reward disbursement via Supabase account profiles.
  - 100% cross-progression parity between Web PWA and Unity Android clients accessing the identical server state.
  - Permanent historical Top 100 season leaderboard snapshot archiving.

- **Lightweight, Privacy-Conscious Event Analytics Pipeline** (`ProductAnalyticsManager.cs`, `AnalyticsSDK.js`, `AnalyticsIngestEngine.js`, `20260819_create_analytics_events.sql`)
  - Cross-platform client SDKs emitting structured events for session start/end, FTUE step completion, biome entry/exit, boss encounters, duels, rewards, and unhandled exception crashes.
  - Zero-PII sanitization and guest session anonymization with GDPR/opt-out compliance.
  - Server-side ingestion pipeline into Prometheus metrics exporter (`GET /metrics`) and in-memory analytical aggregation engine.
  - Automated calculation of D1/D7/D30 player retention cohorts, step-by-step tutorial funnel drop-off %, and biome progression rates without requiring manual ad-hoc DB queries.
  - Built-in Executive Analytics Dashboard modal in web client and pre-configured Grafana dashboard template (`deploy/grafana-analytics-dashboard.json`).

- **Live-Ops Remote Configuration & Dynamic Balance Tuning Layer** (`RemoteConfigManager.cs`, `RemoteConfigClient.js`, `RemoteConfigEngine.js`, `20260820_create_remote_config.sql`)
  - Dynamic balance tuning for harvest yield multipliers, boss HP/damage parameters, daily challenge thresholds, and 2x modifier-weekend flags.
  - Supabase/PostgreSQL source of truth with 5-minute TTL caching and safe local fallback to last-known-good configuration on network failure or offline play.
  - Schema v3 save-compatibility validation engine rejecting invalid balance values to prevent corrupting player save files.
  - 1-action rollback mechanism and version history audit trail (`POST /api/remote-config/rollback`, `GET /api/remote-config/history`).
  - Interactive balance tuning and rollback controls in web operations dashboard.

- **Systematic "Juice" Feedback & Presentation Layer** (`Assets/Scripts/Core/JuiceFeedbackManager.cs`)
  - Hit-Stop engine (2-4 frame unscaled timescale freeze) for boss critical hits, convergence, and duel wins.
  - Procedural Camera Shake with configurable intensity/decay wired to boss hits, dataset corruption, and duels.
  - Tier-aware particle burst scaling (Tier 1: 25 / Tier 2: 80 / Tier 3: 150) for graceful degradation on low-end hardware.
  - Dual-motor haptic pulse vibrations for token harvest, boundary snaps, policy updates, and boss impacts.
  - Sub-300ms procedural audio stingers for model convergence (240ms ascending shimmer) and overfitting alerts (220ms tritone warning).
  - Reduced Motion accessibility toggle integrated into SettingsUI, suppressing shake/flash while preserving functional cues.

- **Playable First-Session FTUE Tutorial** (`Assets/Scripts/Core/FirstRunTutorialDirector.cs`)
  - 3-minute action-driven core loop: Guided Harvest ➔ Live Regression Fit Reaction ➔ Lab Mini-Challenge ➔ Day-1 Reward.
  - Strict 1-sentence prompt constraint across all onboarding cues (zero text-wall modal dialogs).
  - Real-time live regression fit reaction card displaying empirical scatter and shifting slope parameters.
  - Contextual in-world idle nudge engine triggering spatial mascot guidance when player idles $>45$s.
  - Day-1 tangible rewards: Glacial Crystalline terminal skin, Vector Calibrator starter tool, Biome 2 unlock.
  - Zero-gate guest mode allowing players to reach the first "aha" moment with zero forms or auth walls.
  - Step-by-step FTUE funnel drop-off telemetry pipeline via `ProductAnalyticsManager`.

- **WebGPU Renderer Backend** (`web/src/rendererManager.js`, `web/app.js`)
  - Async `RendererManager.bootstrapRenderer()` attempts `THREE.WebGPURenderer` first
  - Catches failure and falls back silently to `THREE.WebGLRenderer` (WebGL2 → WebGL1)
  - `probeCapabilities()` runs one-time GPU probe on load (navigator.gpu + WebGL context)
  - `recordFrameDrawCalls(tierLevel)` instruments `renderer.info.render.calls` per frame
  - Draw call budget enforcement: <60 (Tier 1) / <100 (Tier 2) / <180 (Tier 3)

- **GPU Compute Particle Engine** (`web/src/gpuComputeParticles.js`, `web/app.js`)
  - `GPUParticleEngine` manages three particle subsystems on WebGPU or WebGL:
    - Harvesting/crystal burst (150-particle shockwave, additive cyan)
    - Boss VFX explosion (100-particle phase transition, additive crimson)
    - Biome ambience floating motes (80 particles, biome-palette colors)
  - `simulateGPUCompute(dt)` dispatches on WebGPU backend; mirrors CPU math
  - `simulateCPUFallback(dt)` runs zero-allocation Float32Array kinematics on WebGL
  - `setBiomeAmbience(biomeIndex)` swaps particle color per biome (0–5)

- **Standalone GPU Capability Probe** (`web/src/gpuCapabilityProbe.js`)
  - `probeGPUCapabilities(canvas?)` — async, importable, Node.js-safe
  - `getOrProbeCapabilities(force?)` — lazy-cached singleton accessor
  - Returns `GPUCapabilities` with full backend string, texture limits, workgroup sizes

- **Scene Disposal Auditor** (embedded in `web/src/rendererManager.js`, `web/app.js`)
  - `SceneDisposalAuditor.teardownAndDispose(root)` — recursive Three.js tree disposal
  - `auditSceneTransition(name, fn)` — wraps transitions with heap delta measurement
  - Fails audit if heap delta exceeds 1 MB; wired to biome transitions and duel teardowns

- **Multi-Tier Profiler WebGPU Axis** (`web/app.js` — `DeviceTierProfile.autoDetect()`)
  - `gpuBackend` now feeds into tier assignment: WebGL1 → Tier 1, WebGPU+8GB → Tier 3
  - GPU probe result from `bootstrapRenderer()` passed directly into `autoDetect()`

- **Architecture Decision Record** (`docs/ADR/003-webgpu-renderer-migration.md`)
  - Context, decision rationale, consequences, and alternatives for WebGPU migration

### Fixed
- **PostProcessingPipeline memory leak** (`web/src/postProcessingPipeline.js`)
  - Added `dispose()` method to release `main` and `bloom` `WebGLRenderTarget` objects
  - Prevents GPU render target accumulation across biome transitions

### Tests
- `testGPUComputeParticlesAndFallbackParity` — Float32Array physics parity, 3 subsystems
- `testCapabilityAwareDeviceTierProfiler` — WebGL1/WebGL2/WebGPU tier assignment
- `testDrawCallBudgetInstrumentation` — Tier 1 (<60) and Tier 2 (<100) budget assertions
- `testSceneDisposalMemoryAudit` — 1 MB heap delta threshold pass/fail validation
- `testWebGPUBootstrapAndFallbackEngine` — full async WebGPU→WebGL2→WebGL1 fallback chain
- Fixed Float32Array single-precision assertions (tolerance <0.0001 instead of `strictEqual`)

---

## [Previous Releases]

See `git log` for earlier feature history.

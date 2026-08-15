# GAME DESIGN DOCUMENT (GDD)
# Project: NeuroArena: Gradients of the Wild
**Platform:** Android (Unity Engine)  
**Genre:** 3D Open-World Educational Action-Adventure / Machine Learning Simulation  
**Target Audience:** STEM students, aspiring data scientists, game developers, tech enthusiasts (Ages 14+)  
**Camera Perspective:** Third-Person Isometric / Free 3D Chase Cam  

---

## 1. Executive Summary & Vision

*NeuroArena: Gradients of the Wild* is a 3D mobile adventure where the fundamental laws of nature are governed by Machine Learning algorithms. Players explore an untamed alien landscape, harvest mathematical and empirical resources, and return them to **Lab Stations**. 

In the Lab, players do not simply press an "Upgrade" button; they interact with a live, text-based **Formula Terminal** where they construct, tune, and execute actual ML mathematical formulas (from loss functions and gradient descent update rules to backpropagation matrices). The models trained in the terminal materialize in the 3D world as physical defenses, trajectory projectors, robotic companion behaviors, and puzzle-solving fields.

---

## 2. Core Gameplay Loop

```
           ┌────────────────────────────────────────────────────┐
           │                  1. EXPLORATION                    │
           │  Navigate 3D open-world biomes using touch controls│
           │  Locate noisy data clusters, gradients, & tensors   │
           └─────────────────────────┬──────────────────────────┘
                                     │
                                     ▼
           ┌────────────────────────────────────────────────────┐
           │              2. RESOURCE HARVESTING                │
           │  Collect Feature Samples (X), Labels (y),          │
           │  Activation Runes, Weight Essences, Learning Rates │
           └─────────────────────────┬──────────────────────────┘
                                     │
                                     ▼
           ┌────────────────────────────────────────────────────┐
           │              3. LAB STATION / TERMINAL             │
           │  Write & tune mathematical formulas in C# REPL     │
           │  Execute training steps with real-time loss curves │
           └─────────────────────────┬──────────────────────────┘
                                     │
                                     ▼
           ┌────────────────────────────────────────────────────┐
           │          4. MODEL DEPLOYMENT & BOSS TRIAL          │
           │  Deploy trained model to defeat Biome Boss puzzles │
           │  Unlock subsequent Biome Gateways & advanced tools │
           └────────────────────────────────────────────────────┘
```

---

## 3. Core Mechanics & Systems

### 3.1 3D Mobile Controls & Interaction
- **Dual Virtual Thumbsticks:** Left stick controls character movement ($X, Z$ plane); right stick controls orbit camera.
- **Contextual Scanner Pulse:** Tapping the scanner button highlights dataset noise levels, feature gradients, and nearby Lab Stations.
- **Inventory/Data Pouch:** Holds collected empirical data points $(X_i, y_i)$, hyperparameters ($\alpha, \lambda$), and matrix operators.

### 3.2 The Lab Station & Formula Terminal
The Lab Station is the heart of *NeuroArena*. When interacting with a Lab, the UI transitions into a sleek, cyber-diegetic mobile terminal:
- **Formula Editor (Monaco/TMP Input Field):** A mobile-optimized code input with quick-insert math macros ($\sum, \frac{\partial}{\partial w}, \nabla, \odot, \text{ReLU}, \sigma$).
- **Live Loss & Convergence Canvas:** Real-time $J(\theta)$ cost trajectory plotting over epochs at 60 FPS.
- **Interactive Visualizer:** Visualizes linear fits, decision boundaries (via Compute Shader heatmaps), tree partitions, or neural activations directly superimposed on the terrain or lab holograms.

---

## 4. Biome Breakdown & Curriculum Matrix

---

### Biome 1: The Linear Steppes (Linear Regression & Gradient Descent)

```
+---------------------------------------------------------------------------------------+
| BIOME 1: THE LINEAR STEPPES                                                          |
| Core Concept: Supervised Continuous Estimation & Loss Minimization                    |
+---------------------------------------------------------------------------------------+
```

#### A. Environment & Visuals
A sunlit rolling valley dotted with glowing geometric pylons, fragmented crystal arrays, and linear ravines where elevation directly correlates with feature values.

#### B. Resource Types
1. **Feature Crystals ($X$):** Raw input measurements harvested from ancient monoliths (e.g., altitude, pressure).
2. **Target Shards ($y$):** True continuous target values extracted from energy geysers.
3. **Weight Residues ($w$):** Slope multipliers dropped by valley elementals.
4. **Bias Sparks ($b$):** Constant offset fragments found at sea level.
5. **Step Fluid ($\alpha$ / Learning Rate):** Viscous fluid harvested in sizes: $\alpha = 0.001$ (stable/slow), $\alpha = 0.01$ (optimal), $\alpha = 1.5$ (divergent/explosive).

#### C. Exact Math Taught
1. **Linear Hypothesis:**
   $$\hat{y}_i = w \cdot x_i + b$$
2. **Mean Squared Error (MSE) Loss Function:**
   $$J(w, b) = \frac{1}{2m} \sum_{i=1}^{m} \left( \hat{y}_i - y_i \right)^2 = \frac{1}{2m} \sum_{i=1}^{m} \left( (w x_i + b) - y_i \right)^2$$
3. **Partial Derivatives (Gradients):**
   $$\frac{\partial J}{\partial w} = \frac{1}{m} \sum_{i=1}^{m} (\hat{y}_i - y_i) \cdot x_i$$
   $$\frac{\partial J}{\partial b} = \frac{1}{m} \sum_{i=1}^{m} (\hat{y}_i - y_i)$$
4. **Gradient Descent Parameter Updates:**
   $$w \leftarrow w - \alpha \frac{\partial J}{\partial w}, \qquad b \leftarrow b - \alpha \frac{\partial J}{\partial b}$$

#### D. Formula Terminal Mission
Player writes the update step in the terminal:
```python
# Terminal Input in Lab 1
error = y_hat - y
grad_w = (1/m) * sum(error * X)
grad_b = (1/m) * sum(error)
w = w - alpha * grad_w
b = b - alpha * grad_b
```
*Learning Feedback:* If $\alpha$ is too high, the visual line bounces violently and diverges (overheating the lab). If $\alpha$ is too low, training times out.

#### E. Unlock Condition
Reach $MSE \le 0.05$ on the Valley Calibration Benchmark and align 3 calibration bridges.

#### F. Boss Creature / World Puzzle: **The Colossus of Residuals**
- **Representation:** A towering stone automaton whose floating limbs are detached and vibrating chaotically along a scatter of noisy coordinates.
- **Encounter Mechanic:** The Colossus stomps across the valley, firing target coordinates $y$. The player must continuously fit an optimal laser baseline $\hat{y} = wx + b$ across the Colossus’s joints. Minimizing the residual sum of squares pulls the limbs into equilibrium, binding the Colossus and unlocking the gateway to Biome 2.

---

### Biome 2: The Binary Marshlands (Logistic Regression & Classification)

```
+---------------------------------------------------------------------------------------+
| BIOME 2: THE BINARY MARSHLANDS & HYPERPLANE PLATEAU                                   |
| Core Concept: Discrete Classification, Probabilities, & Decision Boundaries          |
+---------------------------------------------------------------------------------------+
```

#### A. Environment & Visuals
A bioluminescent swamp split into two distinct ecosystems: Toxic Flora (Class 0, purple haze) and Purifying Spores (Class 1, azure glow). Terrain heights form 2D feature coordinates $(x_1, x_2)$.

#### B. Resource Types
1. **Class-0 Purple Spores ($y=0$):** Sample nodes from toxic patches.
2. **Class-1 Azure Spores ($y=1$):** Sample nodes from clean springs.
3. **Sigmoid Membranes ($\sigma$):** Elastic fungal membranes that compress infinite range $(-\infty, +\infty)$ into $[0, 1]$.
4. **Cross-Entropy Vials ($J(\theta)$):** Reagents that penalize overconfident wrong predictions.
5. **Threshold Prisms ($\tau$):** Prisms configured by default at $\tau = 0.5$.

#### C. Exact Math Taught
1. **Linear Logit Combination:**
   $$z = \mathbf{w}^T \mathbf{x} + b = w_1 x_1 + w_2 x_2 + b$$
2. **The Logistic (Sigmoid) Activation Function:**
   $$\hat{y} = \sigma(z) = \frac{1}{1 + e^{-z}} = P(y=1 \mid \mathbf{x})$$
3. **Binary Cross-Entropy (Log Loss):**
   $$J(\mathbf{w}, b) = -\frac{1}{m} \sum_{i=1}^{m} \left[ y_i \ln(\hat{y}_i) + (1 - y_i) \ln(1 - \hat{y}_i) \right]$$
4. **Gradient of Binary Cross-Entropy:**
   $$\frac{\partial J}{\partial w_j} = \frac{1}{m} \sum_{i=1}^{m} (\hat{y}_i - y_i) x_{i,j}, \qquad \frac{\partial J}{\partial b} = \frac{1}{m} \sum_{i=1}^{m} (\hat{y}_i - y_i)$$
5. **Decision Rule:**
   $$\text{Prediction} = \begin{cases} 1 & \text{if } \sigma(z) \ge 0.5 \\ 0 & \text{if } \sigma(z) < 0.5 \end{cases}$$

#### D. Formula Terminal Mission
Player implements the Sigmoid mapping and Log-Loss calculation:
```python
# Terminal Input in Lab 2
z = dot(W, X) + b
y_hat = 1 / (1 + exp(-z))
loss = -(1/m) * sum(y * log(y_hat) + (1 - y) * log(1 - y_hat))
grad_W = (1/m) * dot((y_hat - y), X.T)
W = W - alpha * grad_W
```

#### E. Unlock Condition
Attain an Accuracy $\ge 95\%$ and an $F_1\text{-Score} \ge 0.92$ on the Marshland Bio-Hazard Filter.

#### F. Boss Creature / World Puzzle: **The Twin-Swarm Chasm (The Bifurcation Golem)**
- **Representation:** A gigantic twin-headed chimeric elemental spawning mixed waves of Class-0 and Class-1 energy beetles charging toward the player’s lab.
- **Encounter Mechanic:** The arena is a 2D coordinate plane. The player must calculate weights $w_1, w_2, b$ to erect a glowing **Hyperplane Energy Wall** ($w_1 x_1 + w_2 x_2 + b = 0$). Correctly separated beetles are funneled into containment pylons; misclassified beetles breach the shield and deal damage.

---

### Biome 3: The Variance Tundra (Overfitting, Underfitting & Regularization)

```
+---------------------------------------------------------------------------------------+
| BIOME 3: THE VARIANCE TUNDRA & BIAS DESOLATION                                        |
| Core Concept: Model Generalization, Bias-Variance Tradeoff, L1 (Lasso) & L2 (Ridge)   |
+---------------------------------------------------------------------------------------+
```

#### A. Environment & Visuals
A treacherous glacial expanse where weather constantly shifts between **Blinding Fog (High Bias / Underfitting)** and **Shattered Ice Spikes (High Variance / Overfitting)**.

#### B. Resource Types
1. **Training Ice-Cores ($D_{\text{train}}$):** Data harvested within sheltered caves.
2. **Validation Echoes ($D_{\text{val}}$):** Unseen data points found only in the open storm.
3. **L2 Ridge Runes ($\lambda_2 w^2$):** Smooth spheres that shrink large coefficients evenly.
4. **L1 Lasso Ribbons ($\lambda_1 |w|$):** Sharp blades that force irrelevant feature weights strictly to zero (Sparsity).
5. **Polynomial Catalysts ($x^2, x^3, \dots, x^d$):** Curvature gems that increase hypothesis capacity.

#### C. Exact Math Taught
1. **Polynomial Hypothesis:**
   $$\hat{y} = w_0 + w_1 x + w_2 x^2 + w_3 x^3 + \dots + w_d x^d$$
2. **L2 Regularization (Ridge Regression):**
   $$J_{\text{Ridge}}(\mathbf{w}) = \frac{1}{2m} \sum_{i=1}^{m} (\hat{y}_i - y_i)^2 + \frac{\lambda}{2m} \sum_{j=1}^{d} w_j^2$$
   $$\text{Update: } w_j \leftarrow w_j \left(1 - \alpha \frac{\lambda}{m}\right) - \alpha \frac{\partial J_{\text{MSE}}}{\partial w_j}$$
3. **L1 Regularization (Lasso Regression):**
   $$J_{\text{Lasso}}(\mathbf{w}) = \frac{1}{2m} \sum_{i=1}^{m} (\hat{y}_i - y_i)^2 + \frac{\lambda}{m} \sum_{j=1}^{d} |w_j|$$
   $$\text{Subgradient: } \frac{\partial}{\partial w_j} |w_j| = \text{sign}(w_j)$$
4. **Generalization Gap Metric:**
   $$\Delta_{\text{Gen}} = |J_{\text{val}} - J_{\text{train}}|$$

#### D. Formula Terminal Mission
Player tunes the regularization penalty $\lambda$ and polynomial degree $d$:
```python
# Terminal Input in Lab 3
# Player balances capacity & penalty
reg_penalty = (lambda_val / (2 * m)) * sum(W**2)
loss = mse_loss + reg_penalty
grad_W = (1/m) * dot((y_hat - y), X.T) + (lambda_val / m) * W
W = W - alpha * grad_W
```

#### E. Unlock Condition
Train a model on $D_{\text{train}}$ that maintains $J_{\text{val}} \le 0.12$ with Generalization Gap $\Delta_{\text{Gen}} \le 0.03$.

#### F. Boss Creature / World Puzzle: **The Phantom Wyrm of Overfitting**
- **Representation:** A serpentine frost dragon with body segments fluctuating in wild, high-degree oscillations ($d=15$).
- **Encounter Mechanic:** In Phase 1, the Wyrm mirrors the player's training set perfectly with $100\%$ training accuracy. In Phase 2, the arena environment changes dynamically to the **Validation Blizzard** ($D_{\text{val}}$), where the Wyrm’s erratic oscillatory tails crack and create impassable chasms. The player must introduce $\text{L2}$ weight decay and $\text{L1}$ feature selection in real-time to smooth out the curve and construct a stable traversal bridge across the blizzard.

---

### Biome 4: The Branching Canopy (Decision Trees & Ensemble Forests)

```
+---------------------------------------------------------------------------------------+
| BIOME 4: THE BRANCHING CANOPY & ENTROPY FOREST                                        |
| Core Concept: Non-Parametric Partitioning, Information Gain, & Ensembles             |
+---------------------------------------------------------------------------------------+
```

#### A. Environment & Visuals
A massive primeval rainforest made of gargantuan branching trees whose bifurcating trunks mirror recursive conditional checks (`if Feature_A > threshold: Left else Right`).

#### B. Resource Types
1. **Feature Trunks ($X_j$):** Categorical and continuous attributes (Bark Roughness, Moisture, Canopy Height).
2. **Gini Sap ($I_G$):** Impurity fluid that measures sample misclassification rate.
3. **Shannon Amber ($H(S)$):** Resinous gems storing state entropy.
4. **Pruning Shears:** Limiters for `max_depth`, `min_samples_split`, and `min_impurity_decrease`.
5. **Bagging Seeds (Bootstrap Aggregates):** Replicating pods to spawn Random Forest trees.

#### C. Exact Math Taught
1. **Shannon Entropy:**
   $$H(S) = -\sum_{k=1}^{K} p_k \log_2 (p_k)$$
2. **Gini Impurity:**
   $$I_G(S) = 1 - \sum_{k=1}^{K} p_k^2$$
3. **Information Gain (Split Evaluation):**
   $$IG(S, A) = H(S) - \sum_{v \in \text{Values}(A)} \frac{|S_v|}{|S|} H(S_v)$$
4. **Optimal Split Criterion:**
   $$A^* = \arg\max_{A} IG(S, A) \quad \text{or} \quad \arg\min_{A} \left[ \frac{|S_L|}{|S|} I_G(S_L) + \frac{|S_R|}{|S|} I_G(S_R) \right]$$
5. **Random Forest Ensemble Voting (Majority Rule):**
   $$\hat{y}_{\text{ensemble}} = \text{mode}\left( \{ T_1(\mathbf{x}), T_2(\mathbf{x}), \dots, T_B(\mathbf{x}) \} \right)$$

#### D. Formula Terminal Mission
Player codes the information gain calculator and best split selector:
```python
# Terminal Input in Lab 4
def entropy(probs):
    return -sum([p * log2(p) for p in probs if p > 0])

def info_gain(parent_s, left_s, right_s):
    w_l = len(left_s) / len(parent_s)
    w_r = len(right_s) / len(parent_s)
    return entropy(parent_s) - (w_l * entropy(left_s) + w_r * entropy(right_s))

best_split = max(features, key=lambda f: info_gain(S, f.left, f.right))
```

#### E. Unlock Condition
Synthesize a 5-tree Random Forest with Tree Depth $\le 4$ achieving $100\%$ classification on the Canopy Maze.

#### F. Boss Creature / World Puzzle: **The Dendrite Hydra (Tree of Infinite Depth)**
- **Representation:** A multi-headed hydra composed of overgrown wooden branches. Each head represents a leaf node; unpruned branches continuously split uncontrollably until they crush the arena.
- **Encounter Mechanic:** The Hydra attacks with multidimensional attribute spores $(X_1 = \text{Speed}, X_2 = \text{Armor}, X_3 = \text{Toxin})$. The player must calculate maximum Information Gain splits to selectively sever branches at the root node. If the player lets `max_depth` exceed limits, the hydra overfits and becomes invulnerable. Pruning to the exact minimal cost-complexity tree structure destroys the Hydra's core.

---

### Biome 5: The Deep Synapse Citadel (Tiny Neural Networks & Backpropagation)

```
+---------------------------------------------------------------------------------------+
| BIOME 5: THE DEEP SYNAPSE CITADEL                                                     |
| Core Concept: Non-Linear Representations, Multilayer Perceptrons, & Backpropagation   |
+---------------------------------------------------------------------------------------+
```

#### A. Environment & Visuals
A floating cyberpunk sanctuary built from luminous neural pathways, pulsing axons, floating matrix rings, and glowing synaptic nodes suspended above an infinite digital abyss.

#### B. Resource Types
1. **Synaptic Filaments (Weights $W^{[l]}$ & Biases $b^{[l]}$):** Conductive wires connecting layers.
2. **Activation Runes:** 
   - **$\text{ReLU}(z) = \max(0, z)$**
   - **$\text{LeakyReLU}(z) = \max(\alpha z, z)$**
   - **$\text{Tanh}(z) = \frac{e^z - e^{-z}}{e^z + e^{-z}}$**
   - **$\text{Sigmoid}(\sigma)$**
3. **Chain Rule Catalysts ($\frac{\partial L}{\partial \dots}$):** Golden lenses that allow gradients to flow backward across layer barriers.
4. **Batch Cores ($B$):** Mini-batch canisters for Stochastic Gradient Descent.

#### C. Exact Math Taught
1. **Network Architecture (2-Layer MLP):**
   - Input: $\mathbf{x} \in \mathbb{R}^{n_x}$
   - Hidden Layer (Layer 1): $n_h$ neurons, ReLU activation
   - Output Layer (Layer 2): 1 neuron, Sigmoid activation (Binary) or Softmax (Multiclass)
2. **Forward Propagation:**
   $$\mathbf{z}^{[1]} = W^{[1]} \mathbf{x} + \mathbf{b}^{[1]}$$
   $$\mathbf{a}^{[1]} = \text{ReLU}(\mathbf{z}^{[1]}) = \max(0, \mathbf{z}^{[1]})$$
   $$z^{[2]} = W^{[2]} \mathbf{a}^{[1]} + b^{[2]}$$
   $$\hat{y} = a^{[2]} = \sigma(z^{[2]})$$
3. **Loss Function (Cross-Entropy):**
   $$\mathcal{L}(\hat{y}, y) = - \left[ y \ln(\hat{y}) + (1-y) \ln(1-\hat{y}) \right]$$
4. **Backward Propagation (Vectorized Chain Rule):**
   $$\delta^{[2]} = dZ^{[2]} = A^{[2]} - Y$$
   $$dW^{[2]} = \frac{1}{m} dZ^{[2]} (A^{[1]})^T, \qquad db^{[2]} = \frac{1}{m} \sum_{\text{cols}} dZ^{[2]}$$
   $$\delta^{[1]} = dZ^{[1]} = \left( (W^{[2]})^T dZ^{[2]} \right) \odot \text{ReLU}'(Z^{[1]})$$
   $$\text{where } \text{ReLU}'(z) = \begin{cases} 1 & z > 0 \\ 0 & z \le 0 \end{cases}$$
   $$dW^{[1]} = \frac{1}{m} dZ^{[1]} X^T, \qquad db^{[1]} = \frac{1}{m} \sum_{\text{cols}} dZ^{[1]}$$
5. **Weight Updates with Momentum:**
   $$V_{dW}^{[l]} = \beta V_{dW}^{[l]} + (1-\beta) dW^{[l]}$$
   $$W^{[l]} \leftarrow W^{[l]} - \alpha V_{dW}^{[l]}$$

#### D. Formula Terminal Mission
Player completes the full forward and backward pass implementation:
```python
# Terminal Input in Lab 5 (The Grand Master Neural Model)
# 1. Forward Pass
Z1 = dot(W1, X) + b1
A1 = maximum(0, Z1)  # ReLU
Z2 = dot(W2, A1) + b2
A2 = 1 / (1 + exp(-Z2))  # Sigmoid Output

# 2. Backward Pass (Backprop)
dZ2 = A2 - Y
dW2 = (1/m) * dot(dZ2, A1.T)
db2 = (1/m) * sum(dZ2, axis=1, keepdims=True)

dZ1 = dot(W2.T, dZ2) * (Z1 > 0)  # ReLU derivative
dW1 = (1/m) * dot(dZ1, X.T)
db1 = (1/m) * sum(dZ1, axis=1, keepdims=True)

# 3. Update
W1 = W1 - alpha * dW1
b1 = b1 - alpha * db1
W2 = W2 - alpha * dW2
b2 = b2 - alpha * db2
```

#### E. Unlock Condition
Solve the Non-Linear Spiral Classification problem with loss $\mathcal{L} < 0.02$ and Accuracy $\ge 99\%$.

#### F. Boss Creature / World Puzzle: **The Non-Linear Singularity (The XOR Leviathan)**
- **Representation:** A colossal trans-dimensional entity encased inside concentric, interlocking rotating shields arranged in a classic intertwined twin-spiral and XOR geometry.
- **Encounter Mechanic:**
  - *Phase 1 (Linear Futility):* The player is initially equipped with a single-layer model. Attacks form only a flat hyperplanar beam that fails completely against the spiral shield (accuracy capped at $\approx 50\%$).
  - *Phase 2 (Hidden Layer Awakening):* The player inputs the 2-Layer Neural Network into the Citadel terminal, choosing hidden unit dimension $n_h = 8$ and ReLU runes.
  - *Phase 3 (The Backpropagation Convergence):* As the Leviathan unleashes non-linear energy waves, the player iterates backpropagation steps. With each epoch, the projected energy barrier warps and bends in real-time 3D space, molding perfectly around the spiral contours of the Leviathan, neutralizing its singularity core and completing the game's grand master cycle.

---

## 5. Technical Architecture & Unity Implementation

### 5.1 On-Device Pure C# Tensor Engine (`NeuroMathEngine`)
To guarantee deterministic execution and avoid heavy external dependencies (such as Python runtimes or bulky C++ bindings on Android), all linear algebra, broadcasting, autodiff/gradient math, and tree splits run on an optimized, zero-allocation C# matrix library:
- **`Memory<float>` / Native Array Pools:** Avoids garbage collection during batch training loops.
- **Unity Burst Compiler & SIMD (Jobs System):** Parallelizes matrix dot products and batch gradient accumulations across ARM cores.

```csharp
// Example of the performant C# Matrix Dot Product in Unity
[BurstCompile]
public struct MatrixMultiplyJob : IJobParallelFor
{
    [ReadOnly] public NativeArray<float> A;
    [ReadOnly] public NativeArray<float> B;
    public NativeArray<float> C;
    public int M, K, N;

    public void Execute(int row)
    {
        for (int col = 0; col < N; col++)
        {
            float sum = 0f;
            for (int k = 0; k < K; k++)
            {
                sum += A[row * K + k] * B[k * N + col];
            }
            C[row * N + col] = sum;
        }
    }
}
```

### 5.2 Real-time Visualizer Shader Pipeline
- **Decision Boundary Projector:** A Unity Custom Render Texture / Compute Shader evaluates $\hat{y} = \text{Model}(\text{UV}_x, \text{UV}_y)$ in parallel to project a real-time contour heatmap onto the 3D ground terrain mesh.
- **Scatter Plot Instanced Mesh:** Renders $10,000+$ empirical data points as GPU-instanced glowing particle spheres.

### 5.3 Mobile Performance & Android Specifications
- **Target Framerate:** Solid 60 FPS on mid-tier Android devices (Snapdragon 7xx / Dimensity 800+ or higher).
- **Graphics API:** Vulkan (with OpenGL ES 3.1 fallback).
- **Memory Footprint:** $< 350 \text{ MB}$ RAM footprint.
- **Battery Optimization:** Training epochs are capped at configurable chunks (e.g., 50 epochs/tick) to prevent thermal throttling.

---

## 6. Summary Comparison Table

| Biome | Name | ML Concept | Core Resources | Exact Math Formula Highlight | Boss Puzzle |
|---|---|---|---|---|---|
| **1** | **Linear Steppes** | Linear Regression | Crystals ($X$), Shards ($y$), Step Fluid ($\alpha$) | $w \leftarrow w - \frac{\alpha}{m}\sum(\hat{y}-y)X$ | **Colossus of Residuals** (Fit best-fit plane to align joints) |
| **2** | **Binary Marshlands** | Logistic Regression | Class 0/1 Spores, Sigmoid Membranes | $\sigma(z) = \frac{1}{1+e^{-z}}$, $-\frac{1}{m}\sum[y\ln\hat{y}+(1-y)\ln(1-\hat{y})]$ | **Twin-Swarm Chasm** (Hyperplane beam splits Class 0 & 1) |
| **3** | **Variance Tundra** | Bias/Variance & Regularization | Train/Val Echoes, L1/L2 Runes, Poly Catalysts | $J_{\text{Ridge}} = \text{MSE} + \frac{\lambda}{2m}\sum w_j^2$ | **Phantom Wyrm** (Penalize wild polynomial spikes in blizzard) |
| **4** | **Branching Canopy** | Decision Trees & Ensembles | Feature Trunks, Gini Sap, Shannon Amber, Shears | $IG(S,A) = H(S) - \sum \frac{\|S_v\|}{\|S\|} H(S_v)$ | **Dendrite Hydra** (Max-IG splits & pruning depth) |
| **5** | **Deep Synapse Citadel** | Multilayer Perceptron & Backprop | Synaptic Filaments, Activation Runes, Chain Catalysts | $\delta^{[1]} = (W^{[2]T}\delta^{[2]})\odot \text{ReLU}'(Z^{[1]})$, $dW^{[1]} = \frac{1}{m}\delta^{[1]}X^T$ | **XOR Leviathan** (2-Layer MLP warps non-linear spiral barrier) |

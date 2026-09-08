# Procedural Biome Variant & Solvability Specification

## 1. Overview
The procedural variant system generates diverse datasets, terrain layouts, and boss combat encounters while mathematically guaranteeing that every generated dataset has an achievable target loss.

---

## 2. Seeded PRNG Architecture
A 32-bit Mulberry32 pseudo-random number generator converts any alphanumeric seed (e.g. `NEURO-8842` or `DAILY-20260908`) into a bit-exact deterministic float sequence across JavaScript, C#, and Python runtimes.

---

## 3. Per-Biome Difficulty Envelopes

### Biome 1: The Linear Steppes (Linear Regression)
- **Slope ($w$):** $\pm [1.2, 3.5]$
- **Intercept ($b$):** $[-2.5, 2.5]$
- **Noise ($\sigma$):** $[0.06, 0.18]$
- **Outlier Rate:** $2\% - 6\%$
- **Solvability Proof:** Ordinary Least Squares (OLS) closed-form inlier fit verifies $\text{MSE}_{\text{optimal}} \le 0.05$.

### Biome 2: The Binary Marshlands (Logistic Classification)
- **Boundary Archetypes:** `linear_hyperplane`, `circular_boundary`, `polynomial_ridge`
- **Margin Width:** $0.40 - 0.75$
- **Overlap Rate:** $3\% - 8\%$
- **Solvability Proof:** Minimum achievable classification accuracy $\ge 90\%$.

### Biome 3: The Variance Tundra (Polynomial & Regularization)
- **Degree:** 2 or 3
- **Noise ($\sigma$):** $[0.12, 0.25]$
- **Solvability Proof:** Ridge regression validation MSE $\le 0.045$.

### Biome 4: The Branching Canopy (Decision Trees)
- **Orthogonal Splits:** 2 to 4 axis-aligned cuts in 2D space.
- **Solvability Proof:** Tree ensemble Gini impurity target $\le 0.08$.

### Biome 5: Deep Synapse Citadel (Non-Linear Manifolds)
- **Manifolds:** `xor_quadrants`, `concentric_rings`, `checkerboard_2x2`.
- **Solvability Proof:** 2-layer MLP convergence accuracy $\ge 95\%$.

### Biome 6: The Semantic Expanse (Embeddings)
- **Clusters:** 16–24 tokens across Physics, Compute, Physical, and Optimizer concept domains.
- **Solvability Proof:** Pairwise cosine similarity $\ge 0.82$.

---

## 4. Boss Move-Set Variants
Each boss possesses 3 alternate attack patterns chosen by seed:
- **The Outlier Titan:** `Gradient Avalanche`, `Residual Shockwave`, `Momentum Surge`.
- **The Hyperplane Hydra:** `Sigmoid Breath`, `Log-Loss Poison Spores`, `Dual-Head Hyperplane Cleave`.
- **The Overfit Colossus:** `Degree-7 Polynomial Wave`, `Zero-Variance Freeze Storm`, `L1 Lasso Sparse Needle Rain`.
- **The Dendrogram Dragon:** `Binary Decision Split Tail`, `5-Tree Bagging Summon`, `Cost-Complexity Pruning Gale`.
- **The Non-Linear Overlord:** `XOR Non-Linear Laser Manifold`, `Gradient Backprop Focus Beam`, `Sigmoid Saturation Dark Zone`.
- **The High-Dimensional Void:** `High-Dimensional Vector Singularity`, `PCA Eigen-Beam`, `Constellation Concept Barrage`.

# NeuroArena Mathematical & Algorithmic Specifications

This document outlines the pure mathematical formulas and update rules implemented across all 6 biomes in NeuroArena.

---

## Biome 1: The Linear Steppes (Linear Regression & Optimizers)
- **Model Hypothesis:** $\hat{y}_i = w x_i + b$
- **Loss Function (MSE):** $J(w, b) = \frac{1}{2N} \sum_{i=1}^N (\hat{y}_i - y_i)^2$
- **Analytical Gradients:**
  $$\frac{\partial J}{\partial w} = \frac{1}{N} \sum_{i=1}^N (\hat{y}_i - y_i) x_i, \quad \frac{\partial J}{\partial b} = \frac{1}{N} \sum_{i=1}^N (\hat{y}_i - y_i)$$
- **Adam Optimizer Update:**
  $$m_t = \beta_1 m_{t-1} + (1-\beta_1) g_t, \quad v_t = \beta_2 v_{t-1} + (1-\beta_2) g_t^2$$
  $$\hat{m}_t = \frac{m_t}{1-\beta_1^t}, \quad \hat{v}_t = \frac{v_t}{1-\beta_2^t}, \quad \theta_t = \theta_{t-1} - \frac{\alpha}{\sqrt{\hat{v}_t} + \epsilon} \hat{m}_t$$

---

## Biome 2: The Binary Marshlands (Logistic Classification)
- **Sigmoid Activation:** $\sigma(z) = \frac{1}{1 + e^{-z}}$
- **Binary Cross-Entropy Loss:**
  $$J(w, b) = -\frac{1}{N} \sum_{i=1}^N \left[ y_i \log(\hat{y}_i) + (1-y_i) \log(1-\hat{y}_i) \right]$$

---

## Biome 3: The Variance Tundra (Polynomial Regularization)
- **Ridge (L2 Penalty):** $J_{\text{Ridge}} = \text{MSE} + \lambda \sum_{j=1}^D w_j^2$
- **Lasso (L1 Penalty):** $J_{\text{Lasso}} = \text{MSE} + \lambda \sum_{j=1}^D |w_j|$

---

## Biome 4: The Branching Canopy (Decision Trees & Bagging Ensembles)
- **Gini Impurity:** $I_G(S) = 1 - \sum_{k=1}^K p_k^2$
- **Information Gain / Impurity Reduction:** $\Delta I = I(S) - \left( \frac{|S_L|}{|S|} I(S_L) + \frac{|S_R|}{|S|} I(S_R) \right)$

---

## Biome 5: Deep Synapse Citadel (2-Layer Neural Network & Backprop)
- **Hidden Layer:** $h = \text{ReLU}(W_1 x + b_1) = \max(0, W_1 x + b_1)$
- **Output Layer:** $\hat{y} = \sigma(W_2 h + b_2)$

---

## Biome 6: The Semantic Expanse (PPMI & Vector Embeddings)
- **Pointwise Mutual Information (PMI):** $\text{PMI}(u, v) = \log_2 \left( \frac{P(u, v)}{P(u) P(v)} \right)$
- **Positive PMI:** $\text{PPMI}(u, v) = \max(0, \text{PMI}(u, v))$
- **Cosine Similarity:** $\text{sim}(u, v) = \frac{u \cdot v}{\|u\| \|v\|}$

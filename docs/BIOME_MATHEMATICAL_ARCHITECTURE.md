# NeuroArena Pure-JS Machine Learning Core: Mathematical Architecture & Curriculum Specifications (v4.5)

This document provides the formal mathematical formulations, algorithmic implementations, and verification theorems for the 6 biomes in *NeuroArena*.

---

## 1. Biome 1: The Linear Steppes (Linear Models & Optimization)

### 1.1 Ordinary Least Squares (OLS)
For feature matrix $X \in \mathbb{R}^{N \times D}$ and ground truth targets $y \in \mathbb{R}^{N}$, the linear hypothesis is parameterized as:
$$\hat{y} = X w + b$$
The empirical risk under Mean Squared Error (MSE) is:
$$\mathcal{L}_{MSE}(w, b) = \frac{1}{N} \sum_{i=1}^N (\hat{y}_i - y_i)^2$$

### 1.2 First-Order Gradients
$$\nabla_w \mathcal{L} = \frac{2}{N} X^T (\hat{y} - y), \quad \nabla_b \mathcal{L} = \frac{2}{N} \mathbf{1}^T (\hat{y} - y)$$

### 1.3 Adaptive Optimizers
- **SGD with Momentum:**
  $$v_t = \beta v_{t-1} + (1 - \beta) g_t, \quad \theta_t = \theta_{t-1} - \eta v_t$$
- **Adam (Adaptive Moment Estimation):**
  $$m_t = \beta_1 m_{t-1} + (1 - \beta_1) g_t, \quad v_t = \beta_2 v_{t-1} + (1 - \beta_2) g_t^2$$
  $$\hat{m}_t = \frac{m_t}{1 - \beta_1^t}, \quad \hat{v}_t = \frac{v_t}{1 - \beta_2^t}, \quad \theta_t = \theta_{t-1} - \frac{\eta}{\sqrt{\hat{v}_t} + \epsilon} \hat{m}_t$$

---

## 2. Biome 2: The Binary Marshlands (Logistic Classification)

### 2.1 Numerically Stable Sigmoid
$$\sigma(z) = \begin{cases} \frac{1}{1 + e^{-z}} & \text{if } z \ge 0 \\ \frac{e^z}{1 + e^z} & \text{if } z < 0 \end{cases}$$

### 2.2 Binary Cross-Entropy Loss
$$\mathcal{L}_{BCE}(w, b) = -\frac{1}{N} \sum_{i=1}^N \left[ y_i \log(\hat{p}_i + \epsilon) + (1 - y_i) \log(1 - \hat{p}_i + \epsilon) \right]$$

---

## 3. Biome 3: The Variance Tundra (Regularization & Trade-offs)

### 3.1 Elastic Net Objective
$$\mathcal{L}_{Elastic}(w) = \mathcal{L}_{MSE}(w) + \lambda_1 \|w\|_1 + \lambda_2 \|w\|_2^2$$

### 3.2 Iterative Soft-Thresholding Algorithm (ISTA)
For Lasso $L_1$ proximal gradient steps:
$$\mathcal{S}_{\gamma}(u) = \text{sign}(u) \cdot \max(0, |u| - \gamma)$$
$$w^{(t+1)} = \mathcal{S}_{\eta \lambda_1} \left( w^{(t)} - \eta \nabla \mathcal{L}_{MSE}(w^{(t)}) \right)$$

---

## 4. Biome 4: The Branching Canopy (Trees & Ensembles)

### 4.1 Impurity Criteria
- **Gini Impurity:**
  $$I_G(S) = 1 - \sum_{k=1}^K p_k^2$$
- **Variance Impurity (Regression):**
  $$I_V(S) = \frac{1}{|S|} \sum_{i \in S} (y_i - \bar{y}_S)^2$$

### 4.2 Information Gain
$$\Delta I(S, f, \theta) = I(S) - \left( \frac{|S_L|}{|S|} I(S_L) + \frac{|S_R|}{|S|} I(S_R) \right)$$

### 4.3 Random Forest Bagging & Out-Of-Bag (OOB) Score
For $B$ bootstrap replicas:
$$\hat{y}_{OOB}(x_i) = \text{majority}\left( \{ T_b(x_i) : i \notin \text{Bag}_b \} \right)$$

---

## 5. Biome 5: Deep Synapse Citadel (Multi-Layer Perceptrons)

### 5.1 Feedforward Layer Propagation
$$Z^{[l]} = A^{[l-1]} W^{[l]} + b^{[l]}, \quad A^{[l]} = \sigma^{[l]}(Z^{[l]})$$

### 5.2 Backpropagation Dynamics
$$\delta^{[L]} = \nabla_{A^{[L]}} \mathcal{L} \odot {\sigma^{[L]}}'(Z^{[L]})$$
$$\delta^{[l]} = (\delta^{[l+1]} W^{[l+1]T}) \odot {\sigma^{[l]}}'(Z^{[l]})$$
$$\frac{\partial \mathcal{L}}{\partial W^{[l]}} = \frac{1}{N} (A^{[l-1]})^T \delta^{[l]} + \lambda W^{[l]}, \quad \frac{\partial \mathcal{L}}{\partial b^{[l]}} = \frac{1}{N} \sum_{i=1}^N \delta^{[l]}_{i,:}$$

---

## 6. Biome 6: The Semantic Expanse (Embeddings & PPMI)

### 6.1 Positive Pointwise Mutual Information (PPMI)
$$\text{PPMI}(w_i, w_j) = \max\left(0, \log_2 \frac{P(w_i, w_j)}{P(w_i) P(w_j)}\right)$$

### 6.2 Cosine Similarity Metric
$$\text{sim}(u, v) = \frac{u \cdot v}{\|u\|_2 \|v\|_2}$$

---

## 7. Model Selection & Advanced Metrics

### 7.1 Principal Component Analysis (PCA)
Data covariance $\Sigma = \frac{1}{N-1} X_c^T X_c$. Solved via symmetric Jacobi eigenvalue decomposition $\Sigma V = V \Lambda$.

### 7.2 K-Means++ Clustering
Initial centroid selection probability:
$$P(x) = \frac{D(x)^2}{\sum_{x'} D(x')^2}$$

### 7.3 Trapezoidal ROC-AUC
$$\text{AUC} = \sum_{k=1}^M \frac{\text{TPR}_k + \text{TPR}_{k-1}}{2} (\text{FPR}_k - \text{FPR}_{k-1})$$

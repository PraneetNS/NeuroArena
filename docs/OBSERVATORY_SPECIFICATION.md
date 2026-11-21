# Observatory Mechanistic Interpretability Specification

## 1. System Overview

The **Observatory** is NeuroArena's dedicated in-game mechanistic interpretability suite. It provides real-time mathematical inspection of transformer representations, attention geometries, and high-dimensional embedding spaces directly within the browser without external python tooling.

The Observatory comprises two primary instruments:
1. **AttentionInstrument**: Interactive multi-head causal attention arc visualizer with rigorous pattern classification.
2. **EmbeddingExplorer**: 3D and 2D Principal Component Analysis (PCA) token embedding cluster projection.

---

## 2. AttentionInstrument Architecture

### 2.1 Interactive Arc Geometry
For an input sequence of length $T$, causal self-attention produces an attention probability matrix:

$$\mathbf{A}^{(l, h)} \in \mathbb{R}^{T \times T}, \quad A_{i, j} \ge 0, \quad \sum_{j=0}^{i} A_{i, j} = 1$$

The instrument maps these probabilities to smooth SVG quadratic Bézier curves between token coordinates:

$$\mathbf{B}(t) = (1 - t)^2 \mathbf{P}_{\text{source}} + 2(1 - t)t \mathbf{P}_{\text{mid}} + t^2 \mathbf{P}_{\text{target}}$$

Where:
- $\mathbf{P}_{\text{source}} = (x_s, y_s)$ and $\mathbf{P}_{\text{target}} = (x_t, y_t)$ are dynamic anchor points derived from token DOM bounding rectangles.
- $\mathbf{P}_{\text{mid}} = \left(\frac{x_s + x_t}{2}, \min(y_s, y_t) - h_{\text{arc}}\right)$
- Arc height $h_{\text{arc}} = \text{clamp}(0.45 \cdot |x_t - x_s|, 20, 180) \text{ px}$

### 2.2 Beam Density & Cutoff Filtering
To eliminate cognitive clutter from uniform background probability mass, an interactive cutoff threshold $\tau \in [0.01, 0.25]$ filters displayed arcs:

$$\text{Display Arc}(s, t) \iff A_{t, s} \ge \tau$$

### 2.3 Mechanistic Pattern Classification
Each attention head $(l, h)$ is evaluated against deterministic mechanistic diagnostic criteria:

- **Previous-Token Score**:
  $$S_{\text{prev}} = \frac{1}{T-1} \sum_{t=1}^{T-1} A_{t, t-1}$$
- **First-Token Sink Score**:
  $$S_{\text{first}} = \frac{1}{T} \sum_{t=0}^{T-1} A_{t, 0}$$
- **Local-Window Score ($\Delta \le 4$)**:
  $$S_{\text{local}} = \frac{1}{T} \sum_{t=0}^{T-1} \sum_{s=\max(0, t-4)}^{t} A_{t, s}$$
- **Head Attention Entropy (in bits)**:
  $$H = \frac{1}{T} \sum_{t=0}^{T-1} \left( -\sum_{s=0}^t A_{t, s} \log_2(A_{t, s} + \epsilon) \right)$$

#### Strict Pattern Labeling Rule:
A head receives a semantic label only if it passes both the relative ratio and the strict absolute floor:
- `previous-token`: $S_{\text{prev}} \ge 0.40$
- `local-window`: $S_{\text{local}} \ge 0.60$
- `first-token`: $S_{\text{first}} \ge 0.30$
- All other heads are explicitly labelled `no clear pattern`.

---

## 3. EmbeddingExplorer Architecture

### 3.1 PCA Projection via Power Iteration
The token embedding matrix $\mathbf{W}_{\text{tok}} \in \mathbb{R}^{V \times d_{\text{model}}}$ is centered to zero-mean:

$$\mathbf{X} = \mathbf{W}_{\text{tok}} - \frac{1}{V} \mathbf{1} \mathbf{1}^T \mathbf{W}_{\text{tok}}$$

Top $K=10$ principal components $\mathbf{v}_1, \dots, \mathbf{v}_K$ are extracted via iterative power deflation:

$$\mathbf{v}_k = \lim_{m \to \infty} \frac{(\mathbf{X}^T \mathbf{X})^m \mathbf{r}_k}{\|(\mathbf{X}^T \mathbf{X})^m \mathbf{r}_k\|_2}$$

### 3.2 Variance Explained Ratio
For each component $k$, the explained variance $\lambda_k$ and ratio $\rho_k$ are computed:

$$\lambda_k = \frac{1}{V - 1} \|\mathbf{X} \mathbf{v}_k\|_2^2, \quad \rho_k = \frac{\lambda_k}{\sum_{j=1}^{d_{\text{model}}} \lambda_j}$$

Across trained Elder checkpoints, the top 3 principal components consistently account for **35% – 42%** of total embedding variance, separating tokens by syntactic categories:
- **PC1**: Whitespace and subword boundaries vs full words.
- **PC2**: Vowels and high-frequency functional affixes.
- **PC3**: Punctuation and capitalization markers.

### 3.3 Nearest Neighbor Cosine Similarity
For a hovered or selected token $u$, cosine similarities are computed across the vocabulary:

$$\text{sim}(u, v) = \frac{\mathbf{e}_u \cdot \mathbf{e}_v}{\|\mathbf{e}_u\|_2 \|\mathbf{e}_v\|_2}$$

The top 5 nearest neighbors are rendered with interactive distance bars and category color badges.

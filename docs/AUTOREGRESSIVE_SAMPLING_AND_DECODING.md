# Autoregressive Sampling & Decoding Specification

## 1. Mathematical Framework

NeuroArena generates text autoregressively token-by-token:

$$P(x_1, x_2, \dots, x_N) = \prod_{t=1}^N P(x_t \mid x_1, \dots, x_{t-1})$$

At each generation step $t$, the transformer model maps context $x_{1 \dots t-1}$ to raw unnormalized logits $\mathbf{z} \in \mathbb{R}^V$. Sampling transforms these logits into a discrete probability distribution over vocabulary $V$.

---

## 2. Decoding Pipeline Stages

The decoding engine executes four sequential transformations before multinomial sampling:

```mermaid
graph LR
    Logits[Raw Logits z] --> RepPenalty[Repetition Penalty]
    RepPenalty --> Temp[Temperature Scaling]
    Temp --> TopK[Top-K Truncation]
    TopK --> Softmax[Softmax Normalization]
    Softmax --> MinP[Min-P Relative Truncation]
    MinP --> TopP[Nucleus Top-P Filtering]
    TopP --> Sample[Multinomial Sampling]
```

### Stage 1: Repetition Penalty
To prevent degenerative looping common in small language models, tokens present in the sliding context window $C = \{x_{\max(0, t-T)} \dots x_{t-1}\}$ receive an inverse multiplicative penalty:

$$\tilde{z}_v = \begin{cases} z_v / \theta & \text{if } v \in C \text{ and } z_v > 0 \\ z_v \cdot \theta & \text{if } v \in C \text{ and } z_v \le 0 \\ z_v & \text{if } v \notin C \end{cases}$$

Where $\theta \ge 1.0$ (default $1.0$, adjustable up to $1.50$ via the Oracle modal).

### Stage 2: Temperature Scaling
Controls distribution sharpness:

$$\hat{z}_v = \frac{\tilde{z}_v}{T_{\text{temp}}}$$

- $T \to 0$: Approaches deterministic greedy argmax decoding.
- $T = 1.0$: Unscaled model calibration.
- $T > 1.0$: Flattens probabilities towards uniform distribution (high entropy, high creativity).

### Stage 3: Top-K Truncation
Restricts selection to the $K$ highest-scoring logits:

$$V_K = \operatorname{arg top}_K(\hat{\mathbf{z}}), \quad z'_v = \begin{cases} \hat{z}_v & \text{if } v \in V_K \\ -\infty & \text{otherwise} \end{cases}$$

### Stage 4: Softmax Normalization
Converts logits to intermediate probabilities:

$$p_v = \frac{\exp(z'_v - \max_{j} z'_j)}{\sum_{k \in V_K} \exp(z'_k - \max_{j} z'_j)}$$

### Stage 4b: Min-P Relative Dynamic Truncation
Unlike fixed cumulative thresholds that fail across sharp and flat distributions, Min-P sets a dynamic floor proportional to the top candidate's probability:

$$\tau_{\text{min-p}} = p_{\max} \cdot P_{\text{min-ratio}}, \quad \text{where } p_{\max} = \max_{j} p_j$$

$$V_{\text{min-p}} = \{ v \in V_K \mid p_v \ge \tau_{\text{min-p}} \}$$

The surviving candidate probabilities are immediately renormalized:

$$\tilde{p}_v = \frac{p_v}{\sum_{j \in V_{\text{min-p}}} p_j}, \quad \forall v \in V_{\text{min-p}}$$

**Dynamic Self-Adjustment Properties:**
- **High Certainty ($p_{\max} \approx 0.90$)**: $\tau = 0.90 \times 0.05 = 0.045$. Weak tail hallucination candidates are decisively eliminated without relying on arbitrary Top-P cutoff boundaries.
- **High Uncertainty ($p_{\max} \approx 0.08$)**: $\tau = 0.08 \times 0.05 = 0.004$. Preserves wide narrative divergence and grammatical alternatives across flat distributions.

### Stage 5: Nucleus Top-P Filtering
Selects the smallest subset $V_P \subseteq V_{\text{min-p}}$ whose cumulative mass meets threshold $P$:

$$\sum_{v \in V_P} \tilde{p}_v \ge P$$

The subset probabilities are then renormalized to sum strictly to $1.0$.

---

## 3. Real-Time Entropy & Surprise Metrics

For each sampled token $x_t \sim P(x)$, the Oracle and telemetry pipelines compute:

1. **Shannon Entropy (in bits)**:
   $$H(X) = -\sum_{v \in V} p_v \log_2 p_v$$
   Measures instantaneous model uncertainty. High entropy ($> 3.5 \text{ bits}$) indicates branching uncertainty at decision boundaries.

2. **Surprise (Self-Information in bits)**:
   $$S(x_t) = -\log_2 P(x_t)$$
   Reflects how unexpected the chosen token was given preceding context. High surprise tokens ($S > 4.0$) trigger distinctive color tints in the Oracle manuscript scroll.

# Shakespeare Dialogue Fine-Tuning & Loss Masking Technical Guide

## 1. Zero-Leakage Dataset Partitioning

To ensure scientific integrity during speaker character specialization, dialogue turns are extracted strictly from the pre-training **TRAIN partition** of `shakespeare.txt` (the first 90.73% of the corpus). The remaining 9.27% is strictly reserved for general validation loss evaluation and is never exposed to dialogue parsing.

### Structural Holdout Scheme (No In-Scene Leakage)
Instead of uniform random turn splitting (which creates high overlap of thematic motifs and adjacent dialogue cues), entire acts or entire plays are held out structurally:

| Speaker | Dramatic Archetype | Training Source Corpus | Structural Held-Out Unit | Train Tokens | Held-Out Tokens |
| :--- | :--- | :--- | :--- | :---: | :---: |
| **HAMLET** | Philosophical Soliloquy | Acts I–IV (*Hamlet*) | Act V (*Hamlet*) | 17,505 (253 turns) | 7,099 (93 turns) |
| **FALSTAFF** | Boisterous Colloquial | *Henry IV Part 1* | *Henry IV Part 2* (Full Play) | 28,512 (403 turns) | 5,585 (63 turns) |
| **PORTIA** | Forensic & Legal Rhetoric | Acts I–III (*Merchant of Venice*) | Act IV Trial Scene | 6,557 (66 turns) | 4,936 (67 turns) |
| **ROSALIND** | Playful Pastoral Wit | Acts I–IV (*As You Like It*) | Act V (*As You Like It*) | 11,886 (175 turns) | 1,719 (23 turns) |
| **IAGO** | Machiavellian Duplicity | Acts I–IV (*Othello*) | Act V (*Othello*) | 16,428 (232 turns) | 2,013 (37 turns) |
| **PROSPERO** | Theurgic Incantation | Acts I–IV (*The Tempest*) | Act V (*The Tempest*) | 9,250 (89 turns) | 2,597 (26 turns) |

---

## 2. Loss Masking Mechanics (`target = -1`)

During conversational fine-tuning, training the model to predict the *player's* prompt is detrimental to persona acquisition. Loss must be applied strictly to the *speaker's* reply tokens.

### Batch Tensor Construction
Each sample is formatted as:
```
PLAYER:\n<Prompt Text>\n<SPEAKER>:\n<Reply Text>\n\n
```

1. **Prompt Tokens**: Assigned target value $-1$ (or `0xFFFFFFFF` in unsigned 32-bit GPU memory).
2. **Reply Tokens**: Assigned target value $y_t = x_{t+1}$ (standard next-token prediction).
3. **Padding Slots**: Padded with $-1$ to uniform context length $T = 128$.

### Mathematical Formulation
Let $M = B \times T$ total tokens in a batch. Let $\mathcal{A} = \{i \mid y_i \neq -1\}$ be the set of active tokens ($N_{\text{active}} = |\mathcal{A}|$).

$$\mathcal{L} = \frac{1}{\max(1, N_{\text{active}})} \sum_{i \in \mathcal{A}} -\log P(y_i \mid x_{\le i})$$

$$\frac{\partial \mathcal{L}}{\partial z_{i, v}} = \begin{cases} \frac{P(v \mid x_{\le i}) - \mathbf{1}_{\{v = y_i\}}}{N_{\text{active}}} & \text{if } i \in \mathcal{A} \\ 0 & \text{if } i \notin \mathcal{A} \end{cases}$$

### GPU Shader Implementation
In `packages/ml-core/src/gpu/shaders/crossEntropy.wgsl`:
```wgsl
let tgt = targets[idx];
if (tgt == 0xFFFFFFFFu || tgt >= uniforms.vocabSize) {
    dLogits[rowOffset + v] = 0.0;
    return;
}
let prob = exp(logits[rowOffset + v] - maxVal) / sumExp;
let indicator = select(0.0, 1.0, v == tgt);
dLogits[rowOffset + v] = (prob - indicator) / uniforms.activeCount;
```

---

## 3. Empirical Gradient Parity Verification

Cross-entropy backward pass with 40% masked tokens verified on Preset C ($B=2$, $T=32$):
- **Worst Parameter Group**: `blocks.1.W2` (relative error: **$1.370 \times 10^{-6} \ll 10^{-3}$**).
- **All 20 Parameter Groups**: Passed CPU Float64 vs GPU Float32 analytical equivalence.

---

## 4. Measured Fine-Tuning Performance & Catastrophic Forgetting

Fine-tuned on discrete NVIDIA GeForce RTX 3050 Laptop GPU (250 steps, AdamW, $\text{LR}=3 \times 10^{-4}$, weight decay 0.01):

| Model State | Hamlet Held-Out Loss (Act V) | Falstaff Held-Out Loss (*H4P2*) | General VAL Loss | Forgetting Drift ($\Delta_{\text{val}}$) |
| :--- | :---: | :---: | :---: | :---: |
| **Base Elder** (Step 12,000) | 2.3000 | 2.1007 | **2.5035** | — |
| **Hamlet-Tuned Elder** | **3.0397** | — | **3.3592** | **+0.8558** |
| **Falstaff-Tuned Elder** | — | **2.4750** | **3.0696** | **+0.5661** |

### Why Catastrophic Forgetting Occurs
In models with sub-million parameters (Preset S: 940,800 params), parameter superposition causes high capacity competition between narrative syntactic structures and dialogue reply turns. Specializing strictly on reply turns with prompt masking forces dense gradient updates through token embeddings and attention projection matrices, rotating the representation manifold toward the character's vocabulary and significantly increasing cross-entropy loss across general Shakespearean prose.

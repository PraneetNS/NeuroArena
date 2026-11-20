# Shakespeare Dialogue Fine-Tuning Specification & Loss-Masking Protocol

## 1. Overview

NeuroArena enables specialization of pretrained transformer models (such as the Scout and Elder checkpoints) into specific dramatic personas through targeted dialogue fine-tuning. This document specifies the data structuring, target loss masking, holdout evaluation design, and anti-forgetting regularization protocols implemented across `@na/ml-core`, `@na/bench`, and `@na/game`.

---

## 2. Dataset Structuring & Turn Formatting

Dialogue turns are extracted strictly from the Shakespeare training partition (first 90.73% of the corpus) to ensure that the global validation set (last 9.27%) remains completely pristine and untainted.

Each fine-tuning instance models a two-turn conversational exchange between the player and a target Shakespearean persona:

```text
PLAYER:
<previous conversational turn or cue>
<SPEAKER>:
<character reply>
```

### Supported Target Personas

The system extracts dialogue batches for six canonical personas across comedy, tragedy, and history:

1. **HAMLET** (*The Tragedy of Hamlet, Prince of Denmark*)
2. **FALSTAFF** (*Henry IV, Part 1 & Part 2*)
3. **PORTIA** (*The Merchant of Venice*)
4. **ROSALIND** (*As You Like It*)
5. **IAGO** (*The Tragedy of Othello, the Moor of Venice*)
6. **PROSPERO** (*The Tempest*)

---

## 3. Target Loss Masking Protocol

Standard autoregressive language modeling computes cross-entropy loss over every token in a sequence. In conversational conditioning, calculating loss over the prompt or user query forces the model to learn the distribution of user inputs rather than the persona's response characteristics.

To solve this, NeuroArena implements **Target Loss Masking**:

$$\mathcal{L} = -\frac{1}{\sum_{t=1}^{T} m_t} \sum_{t=1}^{T} m_t \log P(x_{t+1} \mid x_1, \dots, x_t)$$

Where the mask $m_t$ is defined as:

$$m_t = \begin{cases} 1 & \text{if } t \ge T_{\text{prompt}} - 1 \text{ and } x_{t+1} \text{ is in the persona reply} \\ 0 & \text{if } t \text{ is in the prompt (PLAYER header and prompt body)} \end{cases}$$

In the tensor representation:
- Target token IDs in the prompt region are set to `-1` (`IGNORE_INDEX`).
- WebGPU compute pipelines and CPU loss evaluators (`evaluateDialogueLossOnLogits`) skip any token where `targets[t] == -1`.
- Backpropagation gradients $\frac{\partial \mathcal{L}}{\partial z_t}$ are zeroed out for all masked indices, preventing gradient updates from distorting prompt understanding.

---

## 4. Zero-Leakage Holdout Design

To prevent overfitting and test true out-of-distribution stylistic generalization, dialogue validation does not use random sentence splitting. Instead, holdout datasets are partitioned by **structural dramatic boundaries**:

| Speaker | Training Partition | Held-Out Validation Partition |
| :--- | :--- | :--- |
| **HAMLET** | Acts I – IV | Act V (Gravedigger scene, duel, catastrophe) |
| **FALSTAFF** | *Henry IV, Part 1* (Acts I – V) | *Henry IV, Part 2* & Act V |
| **PORTIA** | Acts I – III | Acts IV – V (Courtroom scene, ring comedy) |
| **ROSALIND** | Acts I – IV | Act V (Forest resolutions and epilogue) |
| **IAGO** | Acts I – IV | Act V (Unmasking and climax) |
| **PROSPERO** | Acts I – IV | Act V (Renunciation of magic and epilogue) |

This structural partitioning guarantees that the model cannot achieve low validation loss through memorization of local sentence context or scene-specific vocabulary.

---

## 5. Anti-Forgetting & Generalization Metrics

Fine-tuning on small, stylized datasets poses a risk of **catastrophic forgetting**, where the model loses general linguistic coherence. NeuroArena monitors three empirical metrics during every fine-tuning run:

1. **Target Speaker Loss ($\mathcal{L}_{\text{speaker}}$)**: Cross-entropy on held-out Act V batches for the target persona.
2. **Speaker Perplexity ($\text{PPL}_{\text{speaker}} = e^{\mathcal{L}}$)**: Exponential of held-out loss, measuring prediction uncertainty on the character's voice.
3. **General Corpus Drift ($\Delta \mathcal{L}_{\text{base}}$)**: Cross-entropy evaluated on 50 randomly sampled batches from the general Shakespeare training set. A run is flagged if $\Delta \mathcal{L}_{\text{base}} > +0.25$.

---

## 6. Implementation Reference

The core logic is implemented in the following modules:
- `packages/ml-core/src/dialogue.ts`: Dataset parsing, structural holdout splitting, `collateDialogueMiniBatch`, and `evaluateDialogueLossOnLogits`.
- `apps/bench/src/main.ts`: Fine-tuning evaluation suite with empirical before/after validation tables.
- `apps/game/src/main.ts` & `packages/ui/src/oracle/`: Oracle Stone integration for live inference.

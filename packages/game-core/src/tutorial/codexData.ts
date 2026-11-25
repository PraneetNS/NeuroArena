/**
 * Codex v1 Data Definitions.
 * 8 foundational concepts unlocked during progression:
 * - token
 * - vocabulary
 * - dataset
 * - validation_split
 * - loss
 * - learning_rate
 * - overfitting
 * - baseline
 */

export type CodexConceptId =
  | 'token'
  | 'vocabulary'
  | 'dataset'
  | 'validation_split'
  | 'loss'
  | 'learning_rate'
  | 'overfitting'
  | 'baseline'
  | 'attention'
  | 'embedding'
  | 'residual_stream'
  | 'logit_lens'
  | 'sampling'
  | 'temperature'
  | 'top_k_top_p'
  | 'min_p'
  | 'next_token_distribution';

export interface CodexEntryDef {
  id: CodexConceptId;
  title: string;
  category: string;
  unlockedAtStep: string;
  paragraphs: [string, string];
  formulaPlain: string;
  widgetType:
    | 'token_splitter'
    | 'lr_ball_curve'
    | 'loss_calculator'
    | 'vocab_slider'
    | 'split_slider'
    | 'overfit_curve'
    | 'baseline_bars'
    | 'attention_matrix'
    | 'embedding_space'
    | 'residual_norm'
    | 'logit_lens_viewer'
    | 'sampling_widget'
    | 'temperature_widget'
    | 'top_kp_widget'
    | 'min_p_widget'
    | 'next_token_dist_widget';
}

export const CODEX_ENTRIES: Record<CodexConceptId, CodexEntryDef> = {
  token: {
    id: 'token',
    title: 'The Token',
    category: 'Foundations // Representations',
    unlockedAtStep: 'tokenizer_demo',
    paragraphs: [
      'Neural networks do not perceive ink or characters. Before text enters a model, byte sequences are grouped into numbered integers called tokens. Common words become a single token, while rare or foreign words fragment into smaller constituent subwords.',
      'In modern BPE (bpe1024-v2), a single leading space attaches directly to the following word or punctuation piece (e.g., " the" instead of " " followed by "the"). This prevents whitespace from consuming isolated tokens, expanding effective context length to 2.338 characters per token.'
    ],
    formulaPlain: 'Token ID = Vocabulary_Index(Leading_Space_Subword)',
    widgetType: 'token_splitter'
  },

  vocabulary: {
    id: 'vocabulary',
    title: 'The Vocabulary Table',
    category: 'Architecture // Embeddings',
    unlockedAtStep: 'tokenizer_demo',
    paragraphs: [
      'The vocabulary is the finite dictionary of tokens recognized by the model. Each token corresponds to a learned vector of weights in the embedding table, projecting discrete indices into continuous high-dimensional space.',
      'Selecting vocabulary capacity is a vital balance. A larger vocabulary requires more memory and slows down final output projection, but allows the model to process paragraphs in fewer autoregressive steps.'
    ],
    formulaPlain: 'Embedding_Table_Size = Vocabulary_Size × Hidden_Dimension',
    widgetType: 'vocab_slider'
  },

  dataset: {
    id: 'dataset',
    title: 'The Training Corpus',
    category: 'Data Pipeline // Ingestion',
    unlockedAtStep: 'first_harvest',
    paragraphs: [
      'An autoregressive language model is a reflection of the distribution it consumed. The breadth, cleanliness, and factual density of the raw dataset define its capabilities, stylistic habits, and reasoning ceilings.',
      'Feeding low-quality boilerplate or noisy HTML scrapings teaches the model to hallucinate and waste capacity predicting repetitive patterns. Clean data consistently outperforms sheer volume.'
    ],
    formulaPlain: 'Token_Count = Characters_Total / Characters_Per_Token',
    widgetType: 'split_slider'
  },

  validation_split: {
    id: 'validation_split',
    title: 'Validation Holdout',
    category: 'Measurement // Generalization',
    unlockedAtStep: 'tutorial_cache_sweep',
    paragraphs: [
      'A student cannot be tested on the exact questions they memorized. The validation split holds out unseen text that is never exposed to gradient updates, measuring true generalized understanding.',
      'If validation loss descends alongside training loss, the network is absorbing genuine structural principles. If validation loss stagnates while training loss drops, memorization has begun.'
    ],
    formulaPlain: 'Tokens_Val = Total_Tokens × (1.0 - Train_Split_Ratio)',
    widgetType: 'split_slider'
  },

  loss: {
    id: 'loss',
    title: 'Cross-Entropy Loss',
    category: 'Optimization // Metrics',
    unlockedAtStep: 'first_run_risky',
    paragraphs: [
      'Loss measures how surprised the model was by what actually came next. If the model assigned high probability to the true next token, loss approaches zero. If it was confident in the wrong word, loss penalizes heavily.',
      'Cross-entropy loss directly reflects negative log likelihood. Minimizing loss forces the output probability distribution to align tightly with real world language distributions.'
    ],
    formulaPlain: 'Loss = -ln(Probability_Assigned_To_Target_Token)',
    widgetType: 'loss_calculator'
  },

  learning_rate: {
    id: 'learning_rate',
    title: 'Learning Rate & Schedules',
    category: 'Optimization // Dynamics',
    unlockedAtStep: 'camp_mentors_note',
    paragraphs: [
      'The learning rate determines the stride length taken down the loss landscape along calculated gradients. Too small a stride leaves the model frozen in place; too large a stride catapults the weights into numerical overflow.',
      'Scale-Invariance & Gradient Clipping in Adam: A common misconception is that gradient norm clipping will tame an excessively large learning rate under adaptive optimizers like Adam. In reality, Adam updates each coordinate by η · m̂ / (√v̂ + ε). When gradient clipping scales all gradients down by a factor α = C / ||g|| < 1, both the first moment estimate m̂ and the second moment root √v̂ scale proportionally by α after a few steps. The scale factor α cancels out in the numerator and denominator: (α g) / (α |g|) = sign(g). Thus, Adam’s effective per-coordinate update step remains approximately ±η regardless of gradient magnitude. While gradient clipping prevents numerical overflow in the float accumulators, it cannot stop an optimizer with excessive η from taking catastrophic strides across the loss landscape.'
    ],
    formulaPlain: 'Adam_Coordinate_Step ≈ -η × sign(Gradient) [Scale-Invariant to Clipping]',
    widgetType: 'lr_ball_curve'
  },

  overfitting: {
    id: 'overfitting',
    title: 'Overfitting & Fine-Tuning Forgetting',
    category: 'Diagnostics // Failure Modes',
    unlockedAtStep: 'apply_fix_retrain',
    paragraphs: [
      'Overfitting occurs when a high-capacity model memorizes exact training sequences rather than underlying grammatical structure. In fine-tuning, if speaker held-out loss rises, the model memorised the training turns and lost the ability to generalize in character: overfitting.',
      'Conversely, if speaker held-out loss falls but general VAL loss rises, the model specialised to this voice at the cost of broader knowledge: catastrophic forgetting. In empirical sweeps (Hamlet best LR 5e-5, 25% replay: held-out loss 0.8290 -> 0.8095, general VAL +0.0223; Falstaff best LR 1e-4, 0% replay: held-out loss 0.7158 -> 0.6919, general VAL +0.0667), early stopping and replay regularization bound general degradation within the 0.10 tolerance limit.'
    ],
    formulaPlain: 'Generalization_Gap = Loss_Validation - Loss_Training',
    widgetType: 'overfit_curve'
  },

  baseline: {
    id: 'baseline',
    title: 'Statistical Baselines',
    category: 'Evaluation // Benchmarks',
    unlockedAtStep: 'evaluator_inspection',
    paragraphs: [
      'A loss value is meaningless without reference points. Uniform random guessing on a 1,024-token vocabulary yields ln(1024) ≈ 6.931. An empirical unigram frequency baseline yields 5.758 (2.492 / char).',
      'Surpassing the unigram baseline proves the model learned which words are common, not how they fit together. The bigram gate (4.001) awaits in Region 1 with the promise of grammar.'
    ],
    formulaPlain: 'Tutorial_Gate: Val_Loss < 5.758 (Unigram)',
    widgetType: 'baseline_bars'
  },

  attention: {
    id: 'attention',
    title: 'Self-Attention Mechanism',
    category: 'Architecture // Routing',
    unlockedAtStep: 'observatory_unlocked',
    paragraphs: [
      'Self-attention allows tokens to communicate dynamically across distance. For every position, queries ask questions, keys publish addresses, and values provide information. Dot products between queries and keys dictate how much focus each token directs toward its predecessors.',
      'In multi-head attention, distinct heads specialize in local sequence routing: in this small 4-layer model, heads predominantly track immediate preceding tokens (local window mass > 80%), act as initial-token sinks, or provide broad diffuse smoothing across recent context.'
    ],
    formulaPlain: 'Attention(Q, K, V) = softmax(Q K^T / sqrt(d_k)) V',
    widgetType: 'attention_matrix'
  },

  embedding: {
    id: 'embedding',
    title: 'Vector Space & Semantics',
    category: 'Foundations // Geometry',
    unlockedAtStep: 'observatory_unlocked',
    paragraphs: [
      'Tokens reside as geometric points in high-dimensional continuous space. As training proceeds, words with similar grammatical roles and semantic meanings naturally cluster together through gradient attraction.',
      'Dimensionality reduction via Principal Component Analysis (PCA) unmasks this learned manifold, revealing structured axes distinguishing nouns, punctuation, syntax, and dramatic characters.'
    ],
    formulaPlain: 'Token_Vector = tokEmb[id] + posEmb[pos]',
    widgetType: 'embedding_space'
  },

  residual_stream: {
    id: 'residual_stream',
    title: 'The Residual Stream',
    category: 'Architecture // Highway',
    unlockedAtStep: 'observatory_unlocked',
    paragraphs: [
      'The residual stream is the central communication highway running uninterrupted from the first layer to the last. Instead of overwriting representations, each attention and MLP sublayer writes additive delta updates directly into the stream.',
      'Because the identity path preserves earlier information, gradients flow cleanly without vanishing. As depth increases, the L2 norm of the residual vector systematically grows as features accumulate.'
    ],
    formulaPlain: 'x_{l+1} = x_l + Sublayer(LN(x_l))',
    widgetType: 'residual_norm'
  },

  logit_lens: {
    id: 'logit_lens',
    title: 'The Logit Lens',
    category: 'Mechanistic // Interpretability',
    unlockedAtStep: 'observatory_unlocked',
    paragraphs: [
      'What is a transformer thinking mid-computation? The Logit Lens probes the intermediate residual stream at any layer by passing it through the final LayerNorm and tied unembedding head, decoding virtual predictions early.',
      'Early layers focus on unigram token frequencies and surface grammar. As information traverses through deeper layers, predictions progressively sharpen into context-specific words, revealing where cognition crystallizes.'
    ],
    formulaPlain: 'Intermediate_Prediction = softmax( LN_f( x_l ) @ tokEmb^T )',
    widgetType: 'logit_lens_viewer'
  },

  sampling: {
    id: 'sampling',
    title: 'Autoregressive Sampling',
    category: 'Inference // Stochasticity',
    unlockedAtStep: 'oracle_unlocked',
    paragraphs: [
      'Autoregressive generation does not produce complete sentences at once; it rolls a die iteratively, token by token. At every step, the model computes a categorical probability distribution over the vocabulary, samples one token according to this distribution, appends it to the context, and repeats.',
      'Deterministic greedy decoding (always picking the argmax) quickly falls into repetitive loops and dull clichés. Stochastic sampling breathes life into the model, balancing coherence against serendipity.'
    ],
    formulaPlain: 'x_{t+1} ~ Categorical( softmax( z_t ) )',
    widgetType: 'sampling_widget'
  },

  temperature: {
    id: 'temperature',
    title: 'Sampling Temperature',
    category: 'Inference // Modulation',
    unlockedAtStep: 'oracle_unlocked',
    paragraphs: [
      'Temperature (T) scales the raw model logits before computing the softmax function. As T approaches 0, the highest-probability token consumes the entire probability mass, collapsing into greedy deterministic argmax. At high T > 1, differences between logits are flattened, spreading probability across improbable and eccentric tokens.',
      'Tuning temperature allows the scholar to dial between robotic predictability (T=0.2), balanced creativity (T=0.7), and chaotic glossolalia (T >= 1.5).'
    ],
    formulaPlain: 'p_i = exp( z_i / T ) / sum_j( exp( z_j / T ) )',
    widgetType: 'temperature_widget'
  },

  top_k_top_p: {
    id: 'top_k_top_p',
    title: 'Top-K & Nucleus (Top-P) Filtering',
    category: 'Inference // Truncation',
    unlockedAtStep: 'oracle_unlocked',
    paragraphs: [
      'Raw softmax leaves an endless tail of hundreds of improbable tokens with tiny non-zero probabilities. Without truncation, rare and nonsensical tokens will eventually be drawn during long generations, completely derailing coherence.',
      'Top-K restricts candidate tokens strictly to the K highest-probability choices. Top-P (nucleus sampling) dynamically trims the vocabulary to the smallest subset of tokens whose cumulative probability exceeds threshold p, allowing broad exploration when uncertainty is high and strict focus when the next word is obvious.'
    ],
    formulaPlain: 'V^(p) = min { V\' subset V : sum_{i in V\'} p_i >= p }',
    widgetType: 'top_kp_widget'
  },

  min_p: {
    id: 'min_p',
    title: 'Min-P Dynamic Truncation',
    category: 'Inference // Dynamic Truncation',
    unlockedAtStep: 'oracle_unlocked',
    paragraphs: [
      'While Top-P sums probabilities until a fixed mass threshold is met, Min-P dynamically prunes candidates relative to the highest token probability: only tokens with p_i >= p_max * min_p are retained.',
      'This creates self-adjusting context sensitivity: when the model is confident (p_max = 0.90), a 0.05 min_p aggressively prunes any token below 0.045, preventing hallucinations. When uncertain (p_max = 0.10), the threshold drops to 0.005, permitting rich narrative diversity without arbitrary top-k cutoffs.'
    ],
    formulaPlain: 'Threshold = max(p) * min_p ; Filter: { i in V : p_i >= Threshold }',
    widgetType: 'min_p_widget'
  },

  next_token_distribution: {
    id: 'next_token_distribution',
    title: 'Next-Token Distribution & Entropy',
    category: 'Inference // Foundations',
    unlockedAtStep: 'oracle_unlocked',
    paragraphs: [
      'The core output of a causal language model is not text, but a probability distribution over the entire vocabulary for what follows the prompt. The width and shape of this distribution reflect the model’s certainty.',
      'Shannon entropy (H = -sum p_i log2 p_i) measures this uncertainty in bits. When predicting after "To be, or not to ", entropy drops near zero as "be" dominates. At branching narrative junctures, entropy spikes, reflecting genuine branching potential.'
    ],
    formulaPlain: 'H(X) = - sum_{i=1}^{V} p_i * log_2( p_i )',
    widgetType: 'next_token_dist_widget'
  }
};

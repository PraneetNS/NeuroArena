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
  | 'next_token_distribution'
  | 'fine_tuning'
  | 'replay_buffer'
  | 'catastrophic_forgetting'
  | 'domain_shift'
  | 'ngram'
  | 'context'
  | 'sparsity'
  | 'smoothing_backoff'
  | 'perplexity'
  | 'why_neural_nets_generalize';

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
    | 'next_token_dist_widget'
    | 'fine_tuning_widget'
    | 'replay_widget'
    | 'forgetting_widget'
    | 'domain_shift_widget'
    | 'ngram_widget'
    | 'context_widget'
    | 'sparsity_widget'
    | 'smoothing_widget'
    | 'perplexity_widget'
    | 'generalization_widget';
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
    title: 'Overfitting & Generalization Failure',
    category: 'Diagnostics // Failure Modes',
    unlockedAtStep: 'apply_fix_retrain',
    paragraphs: [
      'Evaluation of training dynamics tracks the gap between training loss and held-out validation loss. When capacity is exceeded or training runs for too many iterations on limited text, the network begins memorizing surface tokens rather than learning general grammatical rules.',
      'In empirical domain adaptation sweeps, four quantitative thresholds categorize performance: "improved" (target held-out loss drops by at least 0.10 nats), "negligible" (|change| under 0.03 nats), "overfitting" (target held-out loss begins climbing after reaching a global minimum), and "catastrophic forgetting" (pretraining validation loss rises by more than 0.10 nats).'
    ],
    formulaPlain: 'Generalization_Gap = Loss_HeldOut(Weights) - Loss_Train(Weights)',
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
    title: 'Autoregressive Sampling & KV-Cache',
    category: 'Inference // Stochasticity',
    unlockedAtStep: 'oracle_unlocked',
    paragraphs: [
      'Autoregressive generation does not produce complete sentences at once; it rolls a die iteratively, token by token. At every step, the model computes a categorical probability distribution over the vocabulary, samples one token according to this distribution, appends it to the context, and repeats.',
      'Deterministic greedy decoding falls into repetitive loops, while stochastic sampling breathes life into the text. KV-Cache Speedup: While KV-caching keeps decode time flat (~3.05 ms/token, >320 tok/s on Preset S and M), on tiny models like Scout (446,304 parameters, d_model=96) the cache yields ~1.0x speedup because GPU arithmetic (<0.5 ms) is so lightweight that driver submission and staging buffer readbacks dominate execution time.'
    ],
    formulaPlain: 'x_{t+1} ~ Categorical( softmax( z_t ) ) ; KV_Pos = t',
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
  },

  fine_tuning: {
    id: 'fine_tuning',
    title: 'Domain Adaptation & Fine-Tuning',
    category: 'Transfer // Domain Adaptation',
    unlockedAtStep: 'oracle_unlocked',
    paragraphs: [
      'Pretrained language models encode rich syntactic priors, but transfer to a new literary domain encounters severe distribution shift. When the Elder-H model (pretrained on Shakespeare) evaluates on Jane Austen’s Pride and Prejudice, zero-shot cross-entropy is 4.418 nats/token—underperforming the bigram baseline (3.554 nats/token) due to heavy vocabulary fragmentation.',
      'Through domain adaptation on Austen’s text, held-out validation loss plunges from 4.418 to 2.556 nats/token (+1.86 nats gain). The network rapidly learns 19th-century Regency syntax, dialogue rhythms, and characteristic vocabulary without training an architecture from scratch.'
    ],
    formulaPlain: 'Loss_Adapted = -ln P_θ(Austen_HeldOut) ; Δ_Gain = 4.418 - 2.556 = +1.862 nats',
    widgetType: 'fine_tuning_widget'
  },

  replay_buffer: {
    id: 'replay_buffer',
    title: 'Experience Replay & Co-Training',
    category: 'Transfer // Regularization',
    unlockedAtStep: 'oracle_unlocked',
    paragraphs: [
      'To prevent catastrophic forgetting during domain specialization, experience replay interleaves batches from the original pretraining corpus into the fine-tuning stream. This anchors shared attention heads and unembedding projections.',
      'At 50% Shakespeare replay mix, training the Elder-H model on Austen for 3,000 steps achieves an Austen held-out loss of 2.556 nats/token (+1.862 nats gain) while strictly bounding Shakespeare validation degradation to +0.134 nats (well within the ≤ 0.15 budget). Replay preserves dual-domain mastery.'
    ],
    formulaPlain: 'Batch = (1 - α) · Austen_Tokens + α · Shakespeare_Tokens ; α ∈ {0.25, 0.50}',
    widgetType: 'replay_widget'
  },

  catastrophic_forgetting: {
    id: 'catastrophic_forgetting',
    title: 'Catastrophic Forgetting',
    category: 'Transfer // Failure Modes',
    unlockedAtStep: 'oracle_unlocked',
    paragraphs: [
      'Catastrophic forgetting occurs when gradient updates on a specialized target domain overwrite the shared representations required for upstream capabilities. Without regularization, optimizing exclusively on a new corpus damages the pretraining manifold.',
      'In the Austen fine-tuning sweep on the RTX 3050, fine-tuning at LR 1e-4 with 0% replay causes Shakespeare general validation loss to spike from 3.168 to 4.385 nats/token (+1.217 nats degradation). At LR 3e-4, forgetting reaches +1.966 nats by step 3,000, erasing general theatrical competence.'
    ],
    formulaPlain: 'Forgetting_Drift = Loss_Shakespeare_Val(θ_tuned) - Loss_Shakespeare_Val(θ_base) > 0.10 nats',
    widgetType: 'forgetting_widget'
  },

  domain_shift: {
    id: 'domain_shift',
    title: 'Domain Shift & Vocabulary Mismatch',
    category: 'Data Pipeline // Representations',
    unlockedAtStep: 'oracle_unlocked',
    paragraphs: [
      'Domain shift arises when evaluation data diverges from the training distribution in vocabulary, register, and grammar. Because the bpe1024-v2 vocabulary was constructed on Shakespeare, 17.47% of Austen words fragment into 4 or more constituent subword tokens (e.g. "universally" into 6 tokens, "neighbourhood" into 6 tokens).',
      'On held-out Austen chapters 53–61, baseline cross-entropy measures: Uniform (6.932 nats), Unigram (5.592 nats), Bigram (3.554 nats), Trigram (3.741 nats). Untuned Elder-H begins at 4.418 nats, but domain adaptation closes this gap, reducing cross-entropy to 2.556 nats.'
    ],
    formulaPlain: 'P&P_Fragmentation(≥4 tokens) = 17.47% ; Untuned_Base = 4.418 vs Adapted = 2.556',
    widgetType: 'domain_shift_widget'
  },

  ngram: {
    id: 'ngram',
    title: 'The N-Gram Language Model',
    category: 'Foundations // Count-Based Models',
    unlockedAtStep: 'fen_beacon',
    paragraphs: [
      'An N-Gram model approximates language by assuming the probability of token w depends solely on the preceding n-1 tokens. Probabilities are estimated by tallying co-occurrence frequencies directly from a text corpus.',
      'In NeuroArena, the Loom builds discrete tables for orders 1 through 5 over the 1,024-token vocabulary. Moving from unigram (5.758 nats) to bigram (4.001 nats) and trigram (3.959 nats) drastically improves syntax by capturing local pairings.'
    ],
    formulaPlain: 'P(w_i | w_{i-n+1} ... w_{i-1}) = Count(w_{i-n+1} ... w_i) / Count(w_{i-n+1} ... w_{i-1})',
    widgetType: 'ngram_widget'
  },

  context: {
    id: 'context',
    title: 'The Context Window',
    category: 'Architecture // Sequence Length',
    unlockedAtStep: 'fen_beacon',
    paragraphs: [
      'Context defines how much history a model inspects when predicting the next token. An order-n model has a rigid context length of exactly n-1 tokens. An order-2 model sees 1 token of past text, while an order-5 model sees 4 tokens.',
      'While expanding context allows models to capture grammatical clauses and phrases, count tables scale exponentially with context length. In contrast, neural transformers can sustain 64 to 2,048 tokens of context without combinatorial explosion.'
    ],
    formulaPlain: 'Context_Length = n - 1 ; Context_Space = |V|^{n-1} = 1024^{n-1}',
    widgetType: 'context_widget'
  },

  sparsity: {
    id: 'sparsity',
    title: 'The Curse of Sparsity',
    category: 'Foundations // Statistical Limits',
    unlockedAtStep: 'loom_build_bigram',
    paragraphs: [
      'As context length n increases, the number of possible token combinations explodes as |V|^n. Because human language is vast, almost all valid phrases never appear in the training corpus—a catastrophic statistical reality called sparsity.',
      'On our full 2.08M training corpus, 96.9% of bigrams appear, but only 75.9% of trigrams, 47.1% of 4-grams, and 25.4% of 5-grams are ever seen. Validation loss drops from unigram (5.758) to trigram (3.959), but surges to 4.904 at 4-gram and 5.891 at 5-gram due to missing contexts.'
    ],
    formulaPlain: 'VAL_Seen_Fraction: 1-gram = 100% → 3-gram = 75.88% → 5-gram = 25.42%',
    widgetType: 'sparsity_widget'
  },

  smoothing_backoff: {
    id: 'smoothing_backoff',
    title: 'Smoothing and Backoff',
    category: 'Foundations // Probability Adjustments',
    unlockedAtStep: 'loom_unseen_context',
    paragraphs: [
      'When an n-gram model encounters an unseen context, naive maximum likelihood estimates assign zero probability, yielding infinite loss. Smoothing redistributes probability mass to unobserved events, while backoff cascades to shorter histories.',
      'In the Loom, Add-k smoothing (k=0.02 for trigrams) guarantees finite evaluation loss matching canonical gates. For prompt generation, Stupid Backoff penalizes unseen contexts by α = 0.4 per fallback step until an observed sub-history is found.'
    ],
    formulaPlain: 'S(w | w_{i-1}) = Count(w_{i-1}, w) / Count(w_{i-1}) if seen, else α · S(w) ; α = 0.4',
    widgetType: 'smoothing_widget'
  },

  perplexity: {
    id: 'perplexity',
    title: 'Perplexity & Cross-Entropy',
    category: 'Evaluation // Information Theory',
    unlockedAtStep: 'workbench_train_scout',
    paragraphs: [
      'Perplexity is the exponentiated cross-entropy loss, representing the effective number of equally likely tokens the model is choosing between at each step. Lower perplexity indicates greater predictive confidence and understanding.',
      'Uniform random guessing over 1,024 tokens yields a perplexity of 1,024 (loss 6.932 nats). The unigram baseline drops perplexity to 316.7 (5.758 nats), bigram to 54.7 (4.001 nats), trigram to 52.4 (3.959 nats), Scout to 18.6 (2.925 nats), and Elder-H to 10.2 (2.325 nats).'
    ],
    formulaPlain: 'Perplexity = exp(Loss_nats) ; PPL(Uniform) = 1024 → PPL(Trigram) = 52.4 → PPL(Elder) = 10.2',
    widgetType: 'perplexity_widget'
  },

  why_neural_nets_generalize: {
    id: 'why_neural_nets_generalize',
    title: 'Why Neural Networks Generalize',
    category: 'Architecture // Representations',
    unlockedAtStep: 'workbench_train_scout',
    paragraphs: [
      'Count-based n-gram models treat every token as an isolated orthogonal dimension: seeing "the king commands" provides zero statistical evidence for "the monarch commands". When word combinations shift, count tables fail immediately.',
      'Neural networks embed discrete tokens into continuous vector spaces where semantically related words cluster together. Multi-head self-attention routes information dynamically across sequences, allowing neural models like Scout and Elder-H to generalize smoothly across novel texts.'
    ],
    formulaPlain: 'Representation: N-Gram = One-Hot Orthogonal ∈ R^{1024} vs Neural = Dense Continuous Vector ∈ R^d',
    widgetType: 'generalization_widget'
  }
};

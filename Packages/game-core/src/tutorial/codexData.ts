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
  | 'logit_lens';

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
    | 'logit_lens_viewer';
}

export const CODEX_ENTRIES: Record<CodexConceptId, CodexEntryDef> = {
  token: {
    id: 'token',
    title: 'The Token',
    category: 'Foundations // Representations',
    unlockedAtStep: 'tokenizer_demo',
    paragraphs: [
      'Neural networks do not perceive ink or characters. Before text enters a model, byte sequences are grouped into numbered integers called tokens. Common words become a single token, while rare or foreign words fragment into smaller constituent subwords.',
      'Tokenization determines the computational bandwidth of the transformer. A compact vocabulary packs more meaning into every positional step, while byte fallbacks ensure the architecture never encounters an unknown character.'
    ],
    formulaPlain: 'Token ID = Vocabulary_Index(Subword_String)',
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
      'Modern architectures use cosine decay schedules: warming up gently from zero to protect unstable initial weights, then gradually annealing downward to settle cleanly into local minima.'
    ],
    formulaPlain: 'New_Weights = Current_Weights - Learning_Rate × Gradient',
    widgetType: 'lr_ball_curve'
  },

  overfitting: {
    id: 'overfitting',
    title: 'Overfitting & Generalization',
    category: 'Diagnostics // Failure Modes',
    unlockedAtStep: 'apply_fix_retrain',
    paragraphs: [
      'Overfitting occurs when a high-capacity model memorizes exact training phrases rather than underlying grammar and facts. It answers familiar sequences flawlessly, but breaks on even minor phrasing changes.',
      'Signs of overfitting appear when training loss continues downward while validation loss arcs upward. Countermeasures include larger clean corpora, weight decay, and early stopping.'
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
      'A loss value is meaningless without reference points. Uniform random guessing on a 1,024-token vocabulary yields ln(1024) ≈ 6.931. An empirical unigram frequency baseline yields 4.472.',
      'Surpassing the unigram baseline proves the model learned which words are common, not how they fit together. The bigram gate (3.286) awaits in Region 1 with the promise of grammar.'
    ],
    formulaPlain: 'Tutorial_Gate: Val_Loss < 4.472 (Unigram)',
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
  }
};

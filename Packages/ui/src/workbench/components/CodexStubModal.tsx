import React, { useEffect } from 'react';
import { GraphNode as GraphNodeType, NodeKind } from '../types.js';
import { Button } from '../../components/Button.js';
import { Badge } from '../../components/Badge.js';


export interface CodexStubModalProps {
  node: GraphNodeType | null;
  isOpen: boolean;
  onClose: () => void;
}

interface CodexEntry {
  title: string;
  category: string;
  formula?: string;
  summary: string;
  keyConcepts: Array<{ term: string; explanation: string }>;
  bestPractices: string[];
}

const CODEX_ENTRIES: Record<NodeKind, CodexEntry> = {
  dataset: {
    title: 'Training Corpus & Quality Distribution',
    category: 'Data Engineering // Ingestion',
    summary:
      'Large language models learn statistical representations of the web. The quality, diversity, and cleanliness of the raw corpus dictate the model’s downstream reasoning capability, toxicity, and hallucination rate.',
    keyConcepts: [
      {
        term: 'Contamination',
        explanation: 'Benchmark test questions inadvertently included in the training text, causing deceptive performance metrics.'
      },
      {
        term: 'Duplicate Rate',
        explanation: 'Repetitive boilerplates, robotic scraped headers, or spam. Excessive duplicates degrade sample efficiency and encourage memorization.'
      },
      {
        term: 'Corpus Sharding',
        explanation: 'Partitioning millions of documents into manageable byte streams for streaming I/O without exhausting memory.'
      }
    ],
    bestPractices: [
      'Maintain an audit trail of data sources before tokenization.',
      'Always profile quality histograms before committing to multi-hour training runs.'
    ]
  },
  cleaner: {
    title: 'Corpus Deduplication & Guardrails',
    category: 'Data Pipeline // Sanitization',
    summary:
      'Removes noisy markup, non-target languages, synthetic hallucinations, and identical documents. Deduplication reduces training compute requirements by up to 30% with zero loss in model downstream capability.',
    keyConcepts: [
      {
        term: 'Exact & Fuzzy Dedupe',
        explanation: 'Identifies string hash collisions and MinHash Jaccard similarity between document shingles.'
      },
      {
        term: 'Noise Filtering',
        explanation: 'Heuristic thresholds measuring character-to-symbol ratios, excessive uppercase tokens, and repeated punctuation.'
      },
      {
        term: 'Length Thresholds',
        explanation: 'Pruning degenerate short snippets (<15 chars) that fail to build coherent contextual representations.'
      }
    ],
    bestPractices: [
      'Balance aggressive filtering against accidental removal of specialized jargon or syntax.',
      'Check before/after sample count ratios to avoid catastrophic data shrinkage.'
    ]
  },
  tokenizer: {
    title: 'Subword Tokenization (BPE)',
    category: 'Representation // Vocabulary',
    formula: 'Text → Bytes → Subword Merges → Discrete Token IDs',
    summary:
      'Tokenization translates arbitrary UTF-8 text into integer sequences suitable for neural network embeddings. Byte Pair Encoding (BPE) iteratively merges the most frequent pairs of consecutive bytes into single tokens.',
    keyConcepts: [
      {
        term: 'Vocabulary Size',
        explanation: 'Balancing sequence compression ratio against embedding matrix memory footprint (vocab × dModel).'
      },
      {
        term: 'Token Span Granularity',
        explanation: 'Shorter tokens require more transformer context steps; longer tokens capture richer semantics per step.'
      },
      {
        term: 'Out-Of-Vocabulary (OOV)',
        explanation: 'Byte-level fallback guarantees that zero characters are dropped or replaced with unknown placeholders.'
      }
    ],
    bestPractices: [
      'Train tokenizer on the exact target domain to optimize compression efficiency.',
      'Ensure the model embedding layer vocabulary size strictly matches the tokenizer vocabulary.'
    ]
  },
  model: {
    title: 'Pre-LayerNorm Transformer Architecture',
    category: 'Architecture // Neural Core',
    formula: 'x = x + Attn(LN(x)); x = x + MLP(LN(x))',
    summary:
      'A decoder-only autoregressive language model utilizing learned positional embeddings, causal multi-head self-attention, and GELU feed-forward expansion blocks. Residual connections with pre-LayerNorm ensure gradient stability across deep stacks.',
    keyConcepts: [
      {
        term: 'dModel & nHeads',
        explanation: 'Model width and subspace projection count. Each attention head operates in dimension dModel / nHeads.'
      },
      {
        term: 'Tied Weights',
        explanation: 'Sharing parameter memory between the input token embedding and the output logits projection reduces footprint.'
      },
      {
        term: 'Causal Masking',
        explanation: 'Prevents tokens from attending to future tokens, ensuring valid autoregressive probability factoring.'
      }
    ],
    bestPractices: [
      'Scale residual output projections by 1/√(2 × nLayers) to prevent activation variance explosion.',
      'Balance context length against VRAM bandwidth (quadratic attention scaling in standard transformers).'
    ]
  },
  trainer: {
    title: 'AdamW Optimization & Gradient Descent',
    category: 'Optimization // Dynamics',
    formula: 'θ_{t+1} = θ_t - η (m̂_t / (√v̂_t + ε) + λ θ_t)',
    summary:
      'Drives backpropagation through the model weights. Decoupled weight decay (AdamW) prevents L2 regularization from distorting adaptive learning rates, while cosine decay and linear warmup stabilize initial gradient variance.',
    keyConcepts: [
      {
        term: 'Linear Warmup',
        explanation: 'Gradually ramping learning rate over initial steps prevents early ill-conditioned gradients from destabilizing initial weights.'
      },
      {
        term: 'Weight Decay (λ)',
        explanation: 'Penalizes large weights directly to improve generalization without interacting with adaptive first/second moment statistics.'
      },
      {
        term: 'Batch Size & Gradient Noise',
        explanation: 'Larger batches provide lower-variance gradient estimates but require appropriately scaled learning rates.'
      }
    ],
    bestPractices: [
      'Watch for loss divergence: if loss spikes to NaN, reduce learning rate and check gradient clipping.',
      'Tune warmup steps to roughly 5-10% of total training budget.'
    ]
  },
  evaluator: {
    title: 'Validation Loss & Autoregressive Perplexity',
    category: 'Evaluation // Quality Metrics',
    formula: 'Perplexity = exp( CrossEntropyLoss )',
    summary:
      'Measures generalization performance on unseen held-out validation data. Autoregressive prompt sampling tests whether the learned probability distribution produces coherent, syntactically sound completions.',
    keyConcepts: [
      {
        term: 'Cross-Entropy Loss',
        explanation: 'Negative log likelihood assigned to ground-truth next tokens. Lower is better.'
      },
      {
        term: 'Perplexity (PPL)',
        explanation: 'The effective branching factor of the model’s predictions. A perplexity of 10 means the model is as uncertain as choosing among 10 equally probable tokens.'
      },
      {
        term: 'Overfitting Detection',
        explanation: 'Occurs when training loss continues dropping while validation loss reverses and climbs upwards.'
      }
    ],
    bestPractices: [
      'Evaluate on clean validation splits that strictly share zero overlap with training shards.',
      'Sample prompt outputs at multiple checkpoints to visually observe emergent grammatical coherence.'
    ]
  }
};

export const CodexStubModal: React.FC<CodexStubModalProps> = ({
  node,
  isOpen,
  onClose
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !node) return null;

  const entry = CODEX_ENTRIES[node.kind];

  return (
    <div className="na-codex-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="na-codex-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="na-codex-header">
          <div className="na-codex-header-left">
            <Badge variant="accent">CODEX SPECIFICATION</Badge>
            <span className="na-codex-category">{entry.category}</span>
          </div>
          <button className="na-codex-close" onClick={onClose} aria-label="Close codex entry">
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="na-codex-body">
          <h2 className="na-codex-title">{entry.title}</h2>

          {entry.formula && (
            <div className="na-codex-formula-box">
              <span className="na-codex-formula-label">Governing Formulation</span>
              <code>{entry.formula}</code>
            </div>
          )}

          <p className="na-codex-summary">{entry.summary}</p>

          <div className="na-codex-section">
            <h3 className="na-codex-section-title">Core Principles & Mechanics</h3>
            <div className="na-codex-concepts">
              {entry.keyConcepts.map((item, idx) => (
                <div key={idx} className="na-codex-concept-item">
                  <div className="na-codex-term">{item.term}</div>
                  <div className="na-codex-desc">{item.explanation}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="na-codex-section">
            <h3 className="na-codex-section-title">Engineering Best Practices</h3>
            <ul className="na-codex-bullet-list">
              {entry.bestPractices.map((tip, idx) => (
                <li key={idx}>{tip}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="na-codex-footer">
          <span className="na-codex-status-note">
            NeuroArena Archive Reference // Entry #{node.kind.toUpperCase()}
          </span>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close Reference
          </Button>
        </div>
      </div>
    </div>
  );
};

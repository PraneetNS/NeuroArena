/**
 * Jane Austen Domain Adaptation & Evaluation Definitions.
 * 
 * Provides dataset metadata, n-gram baselines, vocabulary fragmentation statistics,
 * and diagnostic thresholds for adapting Shakespeare-pretrained models to Regency prose.
 */

export interface AustenSplitMetadata {
  title: string;
  author: string;
  totalChapters: number;
  totalCharacters: number;
  totalTokensBpeV2: number;
  charsPerToken: number;
  tuningSplit: {
    chapters: string;
    chapterCount: number;
    characters: number;
    tokensBpeV2: number;
    charsPerToken: number;
  };
  heldOutSplit: {
    chapters: string;
    chapterCount: number;
    characters: number;
    tokensBpeV2: number;
    charsPerToken: number;
  };
  leakageCheck: {
    shakespearePretrainingMatchCount: number;
    windowSizeChars: number;
    isCleanDomainBoundary: boolean;
  };
  fragmentationStats: {
    totalWords: number;
    wordsSplitFourPlusTokens: number;
    fractionSplitFourPlusTokens: number;
    sampleWords: { word: string; tokenCount: number }[];
  };
}

export const AUSTEN_DATASET_METADATA: AustenSplitMetadata = {
  title: 'Pride and Prejudice',
  author: 'Jane Austen',
  totalChapters: 61,
  totalCharacters: 708335,
  totalTokensBpeV2: 296680,
  charsPerToken: 2.3875,
  tuningSplit: {
    chapters: 'Chapters 1 to 52 (Chapters I to LII)',
    chapterCount: 52,
    characters: 599058,
    tokensBpeV2: 250839,
    charsPerToken: 2.3882
  },
  heldOutSplit: {
    chapters: 'Chapters 53 to 61 (Chapters LIII to LXI)',
    chapterCount: 9,
    characters: 109277,
    tokensBpeV2: 45841,
    charsPerToken: 2.3838
  },
  leakageCheck: {
    shakespearePretrainingMatchCount: 0,
    windowSizeChars: 40,
    isCleanDomainBoundary: true
  },
  fragmentationStats: {
    totalWords: 123103,
    wordsSplitFourPlusTokens: 21504,
    fractionSplitFourPlusTokens: 0.17468,
    sampleWords: [
      { word: 'universally', tokenCount: 6 },
      { word: 'acknowledged', tokenCount: 7 },
      { word: 'neighbourhood', tokenCount: 6 },
      { word: 'considered', tokenCount: 5 },
      { word: 'unreserved', tokenCount: 6 }
    ]
  }
};

export interface AustenBaselines {
  uniform: { natsPerToken: number; natsPerChar: number };
  unigram: { natsPerToken: number; natsPerChar: number };
  bigram: { natsPerToken: number; natsPerChar: number };
  trigram: { natsPerToken: number; natsPerChar: number };
  untunedElderH: {
    austenHeldOutLoss: number;
    natsPerChar: number;
    shakespeareGeneralVal: number;
  };
}

export const AUSTEN_BASELINES: AustenBaselines = {
  uniform: { natsPerToken: 6.9315, natsPerChar: 2.9077 },
  unigram: { natsPerToken: 5.5920, natsPerChar: 2.3458 },
  bigram: { natsPerToken: 3.5543, natsPerChar: 1.4910 },
  trigram: { natsPerToken: 3.7413, natsPerChar: 1.5695 },
  untunedElderH: {
    austenHeldOutLoss: 4.4184,
    natsPerChar: 1.8535,
    shakespeareGeneralVal: 3.1682
  }
};

export const AUSTEN_NEUTRAL_PROMPTS = [
  'It is often said that nothing is so bad as parting with ',
  'The spiritless condition into which this event threw her was ',
  'The consequence, you see, of marrying a daughter, said '
] as const;

export type DiagnosticRegime = 'improved' | 'negligible' | 'overfitting' | 'forgetting';

export interface DiagnosticResult {
  regime: DiagnosticRegime;
  label: string;
  description: string;
  austenDelta: number;
  shakespeareValRise: number;
}

/**
 * Evaluates fine-tuning performance against rigorous empirical diagnostic thresholds:
 * - improved: Austen held-out delta <= -0.10 nats
 * - negligible: |Austen held-out delta| < 0.03 nats
 * - overfitting: Austen held-out loss rises after reaching global minimum
 * - forgetting: Shakespeare VAL rise > 0.10 nats (exceeds forgetting threshold)
 */
export function evaluateDomainDiagnostics(
  currentAustenLoss: number,
  baseAustenLoss: number,
  currentShakespeareVal: number,
  baseShakespeareVal: number,
  lowestAustenLossAchieved: number
): DiagnosticResult {
  const austenDelta = currentAustenLoss - baseAustenLoss;
  const shakespeareValRise = currentShakespeareVal - baseShakespeareVal;
  const isOverfitting = currentAustenLoss > lowestAustenLossAchieved + 0.05;

  if (isOverfitting) {
    return {
      regime: 'overfitting',
      label: 'Overfitting Detected',
      description: `Held-out Austen loss rose to ${currentAustenLoss.toFixed(4)} after minimum ${lowestAustenLossAchieved.toFixed(4)}. Training is memorizing syntax.`,
      austenDelta,
      shakespeareValRise
    };
  }

  if (shakespeareValRise > 0.10) {
    return {
      regime: 'forgetting',
      label: 'Catastrophic Forgetting',
      description: `Shakespeare validation loss degraded by +${shakespeareValRise.toFixed(4)} nats (> 0.10 threshold). Pretrained linguistic competence damaged.`,
      austenDelta,
      shakespeareValRise
    };
  }

  if (austenDelta <= -0.10) {
    return {
      regime: 'improved',
      label: 'Domain Adaptation Successful',
      description: `In-domain Austen loss dropped by ${Math.abs(austenDelta).toFixed(4)} nats (gain >= 0.10) while preserving general pretraining competence.`,
      austenDelta,
      shakespeareValRise
    };
  }

  if (Math.abs(austenDelta) < 0.03) {
    return {
      regime: 'negligible',
      label: 'Negligible Adaptation',
      description: `Held-out loss change is within |Δ| < 0.03 nats. Optimization has not significantly shifted towards target prose distribution.`,
      austenDelta,
      shakespeareValRise
    };
  }

  return {
    regime: 'improved',
    label: 'Moderate Gain',
    description: `Austen loss decreased by ${Math.abs(austenDelta).toFixed(4)} nats with Shakespeare rise +${shakespeareValRise.toFixed(4)} nats.`,
    austenDelta,
    shakespeareValRise
  };
}

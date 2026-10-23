/**
 * Lightweight Character Bigram Language Model.
 * 
 * Trained on clean Shakespeare TRAIN split with Laplace smoothing.
 * Computes deterministic surprisal (cross-entropy in bits/char) for incoming shard passages.
 */

import { SHAKESPEARE_TRAIN_TEXT } from './data/corpus.js';

export class CharBigramModel {
  private transitionCounts: Int32Array; // 128 x 128
  private contextTotals: Int32Array;    // 128
  private vocabSize = 128;

  constructor() {
    this.transitionCounts = new Int32Array(128 * 128);
    this.contextTotals = new Int32Array(128);
    this.train(SHAKESPEARE_TRAIN_TEXT);
  }

  private toAscii(ch: string): number {
    const code = ch.charCodeAt(0);
    return code < 128 ? code : 63; // '?' for non-ascii
  }

  public train(corpus: string): void {
    if (corpus.length < 2) return;
    for (let i = 1; i < corpus.length; i++) {
      const prev = this.toAscii(corpus[i - 1]);
      const curr = this.toAscii(corpus[i]);
      this.transitionCounts[prev * 128 + curr]++;
      this.contextTotals[prev]++;
    }
  }

  /**
   * Computes average negative log2-likelihood (bits per character) under the bigram model.
   */
  public computeSurprisal(text: string): number {
    if (text.length < 2) return 4.0;

    let totalBits = 0;
    const count = text.length - 1;

    for (let i = 1; i < text.length; i++) {
      const prev = this.toAscii(text[i - 1]);
      const curr = this.toAscii(text[i]);

      // Laplace smoothing: (count + 1) / (total + 128)
      const c = this.transitionCounts[prev * 128 + curr] + 1;
      const denom = this.contextTotals[prev] + this.vocabSize;
      const prob = c / denom;
      totalBits += -Math.log2(prob);
    }

    return totalBits / count;
  }

  /**
   * Returns a normalized surprise score in range [0, 1].
   * Clean Shakespeare typically ranges from 2.8 to 3.8 bits.
   * OCR noise, strange markup, and off-domain text range from 4.2 to 6.5+ bits.
   */
  public getNormalizedSurprise(text: string): number {
    const bits = this.computeSurprisal(text);
    // Map [3.0 bits -> 0.0] to [6.0 bits -> 1.0]
    const clamped = Math.max(3.0, Math.min(6.0, bits));
    return (clamped - 3.0) / 3.0;
  }
}

export const defaultBigramModel = new CharBigramModel();

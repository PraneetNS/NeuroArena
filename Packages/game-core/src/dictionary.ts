/**
 * Vocabulary and dictionary lookup system built from the clean Shakespeare TRAIN split.
 * Computes dictionaryHitRate: the fraction of words in a shard found in the clean vocabulary.
 */

import { SHAKESPEARE_TRAIN_TEXT } from './data/corpus.js';

class ShakespeareDictionary {
  private vocab: Set<string>;

  constructor() {
    this.vocab = new Set<string>();
    this.build(SHAKESPEARE_TRAIN_TEXT);
  }

  private build(corpus: string): void {
    const wordCounts = new Map<string, number>();
    const words = corpus.toLowerCase().match(/[a-z]+/g) || [];
    for (const w of words) {
      wordCounts.set(w, (wordCounts.get(w) || 0) + 1);
    }
    // Words appearing at least twice (filters one-off typo anomalies from Gutenberg headers)
    for (const [w, count] of wordCounts.entries()) {
      if (count >= 2) {
        this.vocab.add(w);
      }
    }
  }

  public get vocabSize(): number {
    return this.vocab.size;
  }

  public has(word: string): boolean {
    return this.vocab.has(word.toLowerCase());
  }

  public computeHitRate(text: string): number {
    const words = text.toLowerCase().match(/[a-z]+/g) || [];
    if (words.length === 0) return 1.0;

    let hits = 0;
    for (const w of words) {
      if (this.vocab.has(w)) {
        hits++;
      }
    }
    return hits / words.length;
  }
}

export const shakespeareDictionary = new ShakespeareDictionary();

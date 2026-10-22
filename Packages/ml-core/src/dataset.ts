/**
 * Data loader: Contiguous 90/10 train/val splitting and random window sampling of length T + 1.
 */

import { Xoshiro128StarStar } from './rng.js';
import { Batch } from './types.js';

export class DataLoader {
  public trainTokens: Uint16Array;
  public valTokens: Uint16Array;
  private rng: Xoshiro128StarStar;

  constructor(tokens: Uint16Array, splitRatio = 0.9, seed = 1337) {
    if (tokens.length < 8) {
      throw new Error(`Dataset too short: ${tokens.length} tokens`);
    }

    const splitIdx = Math.floor(tokens.length * splitRatio);
    this.trainTokens = tokens.subarray(0, splitIdx);
    this.valTokens = tokens.subarray(splitIdx);
    this.rng = new Xoshiro128StarStar(seed);
  }

  /**
   * Samples a random batch of B sequences, each of length T.
   * Total window sampled per sequence is T + 1:
   * inputs = window[0..T-1], targets = window[1..T].
   */
  public getBatch(split: 'train' | 'val', B: number, T: number): Batch {
    const data = split === 'train' ? this.trainTokens : this.valTokens;
    const maxStart = data.length - (T + 1);

    if (maxStart <= 0) {
      throw new Error(
        `Split '${split}' has length ${data.length}, which is too short for sequence length T=${T} + 1`
      );
    }

    const inputs = new Uint16Array(B * T);
    const targets = new Uint16Array(B * T);

    for (let b = 0; b < B; b++) {
      const startIdx = Math.floor(this.rng.nextFloat() * maxStart);
      const bOffset = b * T;

      for (let t = 0; t < T; t++) {
        inputs[bOffset + t] = data[startIdx + t];
        targets[bOffset + t] = data[startIdx + t + 1];
      }
    }

    return { inputs, targets, B, T };
  }

  /**
   * Samples a random batch of B sequences, each of length T.
   * Returns { inputs, targets } as Int32Array of shape [B * T],
   * where targets are inputs shifted by one.
   */
  public sampleBatch(
    B: number,
    T: number,
    split: 'train' | 'val' = 'train',
    rng?: Xoshiro128StarStar
  ): { inputs: Int32Array; targets: Int32Array } {
    const data = split === 'train' ? this.trainTokens : this.valTokens;
    const maxStart = data.length - (T + 1);

    if (maxStart <= 0) {
      throw new Error(
        `Split '${split}' has length ${data.length}, which is too short for sequence length T=${T} + 1`
      );
    }

    const generator = rng ?? this.rng;
    const inputs = new Int32Array(B * T);
    const targets = new Int32Array(B * T);

    for (let b = 0; b < B; b++) {
      const startIdx = Math.floor(generator.nextFloat() * maxStart);
      const bOffset = b * T;

      for (let t = 0; t < T; t++) {
        inputs[bOffset + t] = data[startIdx + t];
        targets[bOffset + t] = data[startIdx + t + 1];
      }
    }

    return { inputs, targets };
  }

  public get length(): number {
    return this.trainTokens.length + this.valTokens.length;
  }

  public getRandomBatch(blockSize: number): { inputs: Uint16Array; targets: Uint16Array } | null {
    if (this.trainTokens.length <= blockSize + 1) return null;
    const batch = this.getBatch('train', 1, blockSize);
    return { inputs: batch.inputs, targets: batch.targets };
  }
}

export class Dataset extends DataLoader {
  public tokens: Uint16Array;
  public rawText = '';
  private tokenizer?: { encode(s: string): Uint16Array; buildVocab?(s: string): void };

  constructor(
    tokensOrTokenizer: Uint16Array | { encode(s: string): Uint16Array; buildVocab?(s: string): void },
    rawTextOrSplitRatio: string | number = 0.9,
    seed = 1337
  ) {
    let tokens: Uint16Array;
    let split = 0.9;
    let text = '';
    let tok: { encode(s: string): Uint16Array; buildVocab?(s: string): void } | undefined;

    if (tokensOrTokenizer instanceof Uint16Array) {
      tokens = tokensOrTokenizer;
      split = typeof rawTextOrSplitRatio === 'number' ? rawTextOrSplitRatio : 0.9;
    } else {
      tok = tokensOrTokenizer;
      text = typeof rawTextOrSplitRatio === 'string' ? rawTextOrSplitRatio : '';
      if (tok.buildVocab) tok.buildVocab(text);
      tokens = tok.encode(text);
    }

    const effectiveTokens = tokens.length >= 8 ? tokens : new Uint16Array([1, 2, 3, 4, 5, 6, 7, 8]);
    super(effectiveTokens, split, seed);
    this.tokens = tokens;
    this.rawText = text;
    this.tokenizer = tok;
  }

  public setText(newText: string): void {
    this.rawText = newText;
    if (this.tokenizer) {
      if (this.tokenizer.buildVocab) this.tokenizer.buildVocab(newText);
      this.tokens = this.tokenizer.encode(newText);
      const effectiveTokens = this.tokens.length >= 8 ? this.tokens : new Uint16Array([1, 2, 3, 4, 5, 6, 7, 8]);
      const splitIdx = Math.floor(effectiveTokens.length * 0.9);
      this.trainTokens = effectiveTokens.subarray(0, splitIdx);
      this.valTokens = effectiveTokens.subarray(splitIdx);
    }
  }

  public appendText(extraText: string): void {
    this.setText((this.rawText ? this.rawText + '\n\n' : '') + extraText);
  }
}


export const PRESET_CORPORA = {
  companion: `Greetings explorer. I am your neural companion, trained to assist in data harvesting, architecture analysis, and neural weights optimization. Together we venture across the digital expanse!`,
  lore: `The old networks fell silent during the great disconnect. Deep within the core, fragments of synthetic cognition lay dormant, waiting for a spark to ignite the transformers once more.`,
  logic: `function fibonacci(n) { if (n <= 1) return n; return fibonacci(n - 1) + fibonacci(n - 2); } const result = [0, 1, 1, 2, 3, 5, 8, 13];`
};


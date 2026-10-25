/**
 * Token-level N-Gram Language Model Baselines with Add-k Smoothing.
 * 
 * Implements Unigram, Bigram, and Trigram language models over discrete tokens (vocabSize = 1024).
 * Evaluates validation loss per token (cross-entropy in nats) and per character (loss / charsPerToken).
 */

export interface NGramEvalResult {
  model: 'unigram' | 'bigram' | 'trigram';
  k: number;
  valLossPerToken: number;
  valLossPerChar: number;
  perplexity: number;
  evaluatedTokens: number;
}

export class UnigramModel {
  public counts: Uint32Array;
  public totalCount = 0;
  public vocabSize: number;

  constructor(vocabSize = 1024) {
    this.vocabSize = vocabSize;
    this.counts = new Uint32Array(vocabSize);
  }

  public train(tokens: Uint16Array | number[]): void {
    this.counts.fill(0);
    this.totalCount = tokens.length;
    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];
      if (tok < this.vocabSize) {
        this.counts[tok]++;
      }
    }
  }

  public evaluate(valTokens: Uint16Array | number[], charsPerToken: number, k = 1.0): NGramEvalResult {
    const denom = this.totalCount + k * this.vocabSize;
    let totalNll = 0;
    const N = valTokens.length;

    for (let i = 0; i < N; i++) {
      const tok = valTokens[i];
      const count = tok < this.vocabSize ? this.counts[tok] : 0;
      const prob = (count + k) / denom;
      totalNll += -Math.log(prob);
    }

    const valLossPerToken = totalNll / N;
    const valLossPerChar = valLossPerToken / charsPerToken;

    return {
      model: 'unigram',
      k,
      valLossPerToken: Number(valLossPerToken.toFixed(4)),
      valLossPerChar: Number(valLossPerChar.toFixed(4)),
      perplexity: Number(Math.exp(valLossPerToken).toFixed(2)),
      evaluatedTokens: N
    };
  }
}

export class BigramModel {
  public pairCounts: Map<number, number> = new Map();
  public unigramCounts: Uint32Array;
  public vocabSize: number;

  constructor(vocabSize = 1024) {
    this.vocabSize = vocabSize;
    this.unigramCounts = new Uint32Array(vocabSize);
  }

  public train(tokens: Uint16Array | number[]): void {
    this.pairCounts.clear();
    this.unigramCounts.fill(0);

    for (let i = 0; i < tokens.length - 1; i++) {
      const u = tokens[i];
      const v = tokens[i + 1];
      if (u < this.vocabSize && v < this.vocabSize) {
        this.unigramCounts[u]++;
        const key = (u << 16) | v;
        this.pairCounts.set(key, (this.pairCounts.get(key) || 0) + 1);
      }
    }
    if (tokens.length > 0) {
      const last = tokens[tokens.length - 1];
      if (last < this.vocabSize) this.unigramCounts[last]++;
    }
  }

  public evaluate(valTokens: Uint16Array | number[], charsPerToken: number, k = 0.1): NGramEvalResult {
    let totalNll = 0;
    const N = valTokens.length - 1;

    for (let i = 0; i < N; i++) {
      const u = valTokens[i];
      const v = valTokens[i + 1];
      const uCount = u < this.vocabSize ? this.unigramCounts[u] : 0;
      const key = (u << 16) | v;
      const uvCount = this.pairCounts.get(key) || 0;

      const prob = (uvCount + k) / (uCount + k * this.vocabSize);
      totalNll += -Math.log(prob);
    }

    const valLossPerToken = totalNll / N;
    const valLossPerChar = valLossPerToken / charsPerToken;

    return {
      model: 'bigram',
      k,
      valLossPerToken: Number(valLossPerToken.toFixed(4)),
      valLossPerChar: Number(valLossPerChar.toFixed(4)),
      perplexity: Number(Math.exp(valLossPerToken).toFixed(2)),
      evaluatedTokens: N
    };
  }
}

export class TrigramModel {
  // Key: (BigInt(u) << 32n) | (BigInt(v) << 16n) | BigInt(w)
  public triCounts: Map<string, number> = new Map();
  public biCounts: Map<number, number> = new Map();
  public vocabSize: number;

  constructor(vocabSize = 1024) {
    this.vocabSize = vocabSize;
  }

  public train(tokens: Uint16Array | number[]): void {
    this.triCounts.clear();
    this.biCounts.clear();

    for (let i = 0; i < tokens.length - 2; i++) {
      const u = tokens[i];
      const v = tokens[i + 1];
      const w = tokens[i + 2];

      const biKey = (u << 16) | v;
      this.biCounts.set(biKey, (this.biCounts.get(biKey) || 0) + 1);

      const triKey = `${u},${v},${w}`;
      this.triCounts.set(triKey, (this.triCounts.get(triKey) || 0) + 1);
    }
  }

  public evaluate(valTokens: Uint16Array | number[], charsPerToken: number, k = 0.05): NGramEvalResult {
    let totalNll = 0;
    const N = valTokens.length - 2;

    for (let i = 0; i < N; i++) {
      const u = valTokens[i];
      const v = valTokens[i + 1];
      const w = valTokens[i + 2];

      const biKey = (u << 16) | v;
      const biCount = this.biCounts.get(biKey) || 0;
      const triKey = `${u},${v},${w}`;
      const triCount = this.triCounts.get(triKey) || 0;

      const prob = (triCount + k) / (biCount + k * this.vocabSize);
      totalNll += -Math.log(prob);
    }

    const valLossPerToken = totalNll / N;
    const valLossPerChar = valLossPerToken / charsPerToken;

    return {
      model: 'trigram',
      k,
      valLossPerToken: Number(valLossPerToken.toFixed(4)),
      valLossPerChar: Number(valLossPerChar.toFixed(4)),
      perplexity: Number(Math.exp(valLossPerToken).toFixed(2)),
      evaluatedTokens: N
    };
  }
}

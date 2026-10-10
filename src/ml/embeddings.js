/**
 * @file embeddings.js
 * @description Vector Embeddings, Co-occurrence Matrix, PPMI Transform, and Cosine Similarity Engine
 * for NeuroArena (Biome 6: The Semantic Expanse).
 */

import { Matrix } from './Matrix.js';

export class Vocabulary {
  constructor() {
    this.wordToIdx = new Map();
    this.idxToWord = [];
    this.wordCounts = [];
    this.totalWords = 0;
  }

  /**
   * Builds vocabulary from an array of sentences or tokens.
   * @param {string[]} sentences
   * @param {number} [minCount=1]
   */
  fit(sentences, minCount = 1) {
    const rawCounts = new Map();
    for (const sent of sentences) {
      const tokens = sent.toLowerCase().replace(/[^a-z0-9_\s]/g, '').trim().split(/\s+/);
      for (const t of tokens) {
        if (!t) continue;
        rawCounts.set(t, (rawCounts.get(t) || 0) + 1);
        this.totalWords++;
      }
    }

    this.wordToIdx.clear();
    this.idxToWord = [];
    this.wordCounts = [];

    let idx = 0;
    for (const [word, count] of rawCounts.entries()) {
      if (count >= minCount) {
        this.wordToIdx.set(word, idx);
        this.idxToWord.push(word);
        this.wordCounts.push(count);
        idx++;
      }
    }

    return this;
  }

  get size() {
    return this.idxToWord.length;
  }

  get(word) {
    return this.wordToIdx.get(word.toLowerCase()) ?? null;
  }

  getWord(idx) {
    return this.idxToWord[idx] ?? null;
  }
}

export class EmbeddingModel {
  /**
   * @param {Object} options
   * @param {number} [options.windowSize=2] - Symmetric context window size
   * @param {number} [options.embeddingDim=8] - Target projected dimensions
   * @param {number} [options.minWordCount=1]
   */
  constructor(options = {}) {
    this.windowSize = Math.max(1, options.windowSize ?? 2);
    this.embeddingDim = options.embeddingDim ?? 8;
    this.minWordCount = options.minWordCount ?? 1;

    this.vocab = new Vocabulary();
    this.cooccurrenceMatrix = null;
    this.ppmiMatrix = null;
    this.vectors = null; // Map from word -> Float64Array
  }

  /**
   * Trains embeddings from a raw text corpus using PPMI matrix transformation.
   * @param {string[]} corpus - Array of text documents or sentences
   * @returns {EmbeddingModel}
   */
  fit(corpus) {
    this.vocab.fit(corpus, this.minWordCount);
    const V = this.vocab.size;
    if (V === 0) return this;

    // 1. Build co-occurrence matrix
    this.cooccurrenceMatrix = new Matrix(V, V);
    let totalWindows = 0;

    for (const sent of corpus) {
      const tokens = sent.toLowerCase().replace(/[^a-z0-9_\s]/g, '').trim().split(/\s+/);
      const tokenIndices = tokens.map(t => this.vocab.get(t)).filter(idx => idx !== null);

      for (let i = 0; i < tokenIndices.length; i++) {
        const center = tokenIndices[i];
        const start = Math.max(0, i - this.windowSize);
        const end = Math.min(tokenIndices.length - 1, i + this.windowSize);

        for (let j = start; j <= end; j++) {
          if (i !== j) {
            const context = tokenIndices[j];
            this.cooccurrenceMatrix.set(center, context, this.cooccurrenceMatrix.get(center, context) + 1.0);
            totalWindows++;
          }
        }
      }
    }

    // 2. Compute Positive Pointwise Mutual Information (PPMI)
    // PPMI(i, j) = max(0, log2( (P(i, j)) / (P(i) * P(j)) ))
    this.ppmiMatrix = new Matrix(V, V);
    const wordTotals = new Float64Array(V);
    for (let i = 0; i < V; i++) {
      let rowSum = 0.0;
      for (let j = 0; j < V; j++) {
        rowSum += this.cooccurrenceMatrix.get(i, j);
      }
      wordTotals[i] = rowSum;
    }

    const safeTotal = Math.max(1.0, totalWindows);

    for (let i = 0; i < V; i++) {
      for (let j = 0; j < V; j++) {
        const cooccur = this.cooccurrenceMatrix.get(i, j);
        if (cooccur > 0) {
          const p_ij = cooccur / safeTotal;
          const p_i = Math.max(1e-12, wordTotals[i] / safeTotal);
          const p_j = Math.max(1e-12, wordTotals[j] / safeTotal);

          const pmi = Math.log2(p_ij / (p_i * p_j));
          const ppmi = Math.max(0.0, pmi);
          this.ppmiMatrix.set(i, j, ppmi);
        }
      }
    }

    // 3. Cache L2-normalized vector for each word
    this.vectors = new Map();
    for (let i = 0; i < V; i++) {
      const vec = new Float64Array(V);
      let normSq = 0.0;
      for (let j = 0; j < V; j++) {
        const val = this.ppmiMatrix.get(i, j);
        vec[j] = val;
        normSq += val * val;
      }

      const norm = Math.sqrt(normSq);
      if (norm > 0) {
        for (let j = 0; j < V; j++) vec[j] /= norm;
      }
      this.vectors.set(this.vocab.getWord(i), vec);
    }

    return this;
  }

  /**
   * Retrieves the embedding vector for a given word.
   * @param {string} word
   * @returns {Float64Array|null}
   */
  getVector(word) {
    return this.vectors?.get(word.toLowerCase()) ?? null;
  }

  /**
   * Computes cosine similarity between two word vectors: (u · v) / (||u|| * ||v||)
   * @param {Float64Array} u
   * @param {Float64Array} v
   * @returns {number}
   */
  static cosineSimilarity(u, v) {
    if (!u || !v || u.length !== v.length) return 0.0;
    let dot = 0.0;
    let normU = 0.0;
    let normV = 0.0;

    for (let i = 0; i < u.length; i++) {
      dot += u[i] * v[i];
      normU += u[i] * u[i];
      normV += v[i] * v[i];
    }

    const denom = Math.sqrt(normU) * Math.sqrt(normV);
    return denom > 1e-12 ? Math.max(-1.0, Math.min(1.0, dot / denom)) : 0.0;
  }

  /**
   * Finds nearest neighbors to a query word using cosine similarity.
   * @param {string} queryWord
   * @param {number} [topK=5]
   * @returns {Array<{ word: string, similarity: number }>}
   */
  findNearestNeighbors(queryWord, topK = 5) {
    const qVec = this.getVector(queryWord);
    if (!qVec) return [];

    const results = [];
    for (const [w, vec] of this.vectors.entries()) {
      if (w === queryWord.toLowerCase()) continue;
      const sim = EmbeddingModel.cosineSimilarity(qVec, vec);
      results.push({ word: w, similarity: parseFloat(sim.toFixed(4)) });
    }

    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, topK);
  }
}

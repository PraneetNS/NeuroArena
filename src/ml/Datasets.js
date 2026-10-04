/**
 * @file Datasets.js
 * @description Deterministic, seeded mathematical synthetic dataset generators
 * for all 6 Biomes with controllable noise scales and outlier injection rates.
 * Generates Float64Array-backed matrices without external math libraries.
 */

import { Matrix } from './Matrix.js';
import { Rng } from './Rng.js';

export class Datasets {
  /**
   * Biome 1 (Linear Steppes): 1D continuous linear regression y = w*x + b + noise.
   * @param {Object} options
   * @param {number} [options.slope=2.4]
   * @param {number} [options.intercept=1.1]
   * @param {number} [options.noise=0.3]
   * @param {number} [options.outlierRate=0.05]
   * @param {number} [options.nSamples=80]
   * @param {number} [options.seed=42]
   * @param {number[]} [options.domain=[-5.0, 5.0]]
   * @returns {{ X: Matrix, y: Matrix, isOutlier: boolean[], domain: number[] }}
   */
  static linearData({
    slope = 2.4,
    intercept = 1.1,
    noise = 0.3,
    outlierRate = 0.05,
    nSamples = 80,
    seed = 42,
    domain = [-5.0, 5.0]
  } = {}) {
    const rng = new Rng(seed);
    const X = new Matrix(nSamples, 1);
    const y = new Matrix(nSamples, 1);
    const isOutlier = new Array(nSamples).fill(false);

    const xSpan = domain[1] - domain[0];

    for (let i = 0; i < nSamples; i++) {
      const xVal = domain[0] + rng.next() * xSpan;
      let yVal = slope * xVal + intercept + rng.gaussian(0, noise);

      // Inject outlier with high residual
      if (rng.next() < outlierRate) {
        const direction = rng.next() > 0.5 ? 1 : -1;
        yVal += direction * (Math.abs(yVal) * 1.5 + 4.5 + rng.float(2.0, 6.0));
        isOutlier[i] = true;
      }

      X.set(i, 0, xVal);
      y.set(i, 0, yVal);
    }
    return { X, y, isOutlier, domain };
  }

  /**
   * Biome 2 (Binary Marshlands): Two-class overlapping logistic blobs in 2D.
   * @param {Object} options
   * @param {number} [options.noise=0.4]
   * @param {number} [options.outlierRate=0.04]
   * @param {number} [options.nSamples=100]
   * @param {number} [options.seed=42]
   * @returns {{ X: Matrix, y: Matrix, isOutlier: boolean[], domain: number[] }}
   */
  static twoClassBlobs({
    noise = 0.4,
    outlierRate = 0.04,
    nSamples = 100,
    seed = 42
  } = {}) {
    const rng = new Rng(seed);
    const X = new Matrix(nSamples, 2);
    const y = new Matrix(nSamples, 1);
    const isOutlier = new Array(nSamples).fill(false);

    const center0 = [-1.5, -1.2];
    const center1 = [1.5, 1.2];

    for (let i = 0; i < nSamples; i++) {
      const label = i < nSamples / 2 ? 0 : 1;
      const center = label === 0 ? center0 : center1;

      let x1 = center[0] + rng.gaussian(0, 0.75 + noise * 0.8);
      let x2 = center[1] + rng.gaussian(0, 0.75 + noise * 0.8);
      let actualLabel = label;

      if (rng.next() < outlierRate) {
        // Label flip or placed deep in opponent territory
        actualLabel = 1 - label;
        x1 += (center1[0] - center0[0]) * (label === 0 ? 1.6 : -1.6);
        isOutlier[i] = true;
      }

      X.set(i, 0, x1);
      X.set(i, 1, x2);
      y.set(i, 0, actualLabel);
    }
    return { X, y, isOutlier, domain: [-4.5, 4.5] };
  }

  /**
   * Biome 3 (Variance Tundra): Polynomial regression y = c0 + c1*x + c2*x^2 + c3*x^3 + noise.
   * @param {Object} options
   * @param {number[]} [options.coeffs=[0.5, -1.2, 0.8, -0.15]]
   * @param {number} [options.noise=0.35]
   * @param {number} [options.outlierRate=0.05]
   * @param {number} [options.nSamples=75]
   * @param {number} [options.seed=42]
   * @param {number[]} [options.domain=[-3.0, 3.0]]
   * @returns {{ X: Matrix, y: Matrix, isOutlier: boolean[], domain: number[] }}
   */
  static polynomialData({
    coeffs = [0.5, -1.2, 0.8, -0.15],
    noise = 0.35,
    outlierRate = 0.05,
    nSamples = 75,
    seed = 42,
    domain = [-3.0, 3.0]
  } = {}) {
    const rng = new Rng(seed);
    const X = new Matrix(nSamples, 1);
    const y = new Matrix(nSamples, 1);
    const isOutlier = new Array(nSamples).fill(false);

    const xSpan = domain[1] - domain[0];

    for (let i = 0; i < nSamples; i++) {
      const xVal = domain[0] + rng.next() * xSpan;
      let yVal = 0.0;
      let xPow = 1.0;
      for (let p = 0; p < coeffs.length; p++) {
        yVal += coeffs[p] * xPow;
        xPow *= xVal;
      }
      yVal += rng.gaussian(0, noise);

      if (rng.next() < outlierRate) {
        yVal += (rng.next() > 0.5 ? 1 : -1) * (Math.abs(yVal) + 5.0);
        isOutlier[i] = true;
      }

      X.set(i, 0, xVal);
      y.set(i, 0, yVal);
    }
    return { X, y, isOutlier, domain };
  }

  /**
   * Biome 4 (Branching Canopy): Tree-friendly axis-aligned step boundaries.
   * @param {Object} options
   * @param {number} [options.noise=0.1]
   * @param {number} [options.nSamples=120]
   * @param {number} [options.seed=42]
   * @returns {{ X: Matrix, y: Matrix, isOutlier: boolean[], domain: number[] }}
   */
  static treeBoundaryData({
    noise = 0.1,
    nSamples = 120,
    seed = 42
  } = {}) {
    const rng = new Rng(seed);
    const X = new Matrix(nSamples, 2);
    const y = new Matrix(nSamples, 1);
    const isOutlier = new Array(nSamples).fill(false);

    for (let i = 0; i < nSamples; i++) {
      const x1 = rng.float(-3.0, 3.0);
      const x2 = rng.float(-3.0, 3.0);

      // Decision rules aligned to orthogonal axes
      const isClass1 = (x1 > 0.5 && x2 > -0.5) || (x1 < -0.8 && x2 < 0.8) || (x2 < -1.8);
      let label = isClass1 ? 1 : 0;

      if (rng.next() < noise) {
        label = 1 - label;
        isOutlier[i] = true;
      }

      X.set(i, 0, x1);
      X.set(i, 1, x2);
      y.set(i, 0, label);
    }
    return { X, y, isOutlier, domain: [-3.0, 3.0] };
  }

  /**
   * Biome 5 (Deep Synapse Citadel): Non-linear XOR / Interleaving Moons / Spirals for Neural Networks.
   * @param {Object} options
   * @param {string} [options.type='xor'] - 'xor' | 'moons' | 'spiral'
   * @param {number} [options.noise=0.15]
   * @param {number} [options.nSamples=120]
   * @param {number} [options.seed=42]
   * @returns {{ X: Matrix, y: Matrix, isOutlier: boolean[], domain: number[] }}
   */
  static xorMoonsSpiralData({
    type = 'xor',
    noise = 0.15,
    nSamples = 120,
    seed = 42
  } = {}) {
    const rng = new Rng(seed);
    const X = new Matrix(nSamples, 2);
    const y = new Matrix(nSamples, 1);
    const isOutlier = new Array(nSamples).fill(false);

    if (type === 'xor') {
      for (let i = 0; i < nSamples; i++) {
        const x1 = rng.float(-2.5, 2.5);
        const x2 = rng.float(-2.5, 2.5);
        const label = (x1 * x2 > 0) ? 1 : 0;
        X.set(i, 0, x1 + rng.gaussian(0, noise));
        X.set(i, 1, x2 + rng.gaussian(0, noise));
        y.set(i, 0, label);
      }
    } else if (type === 'moons') {
      const halfN = Math.floor(nSamples / 2);
      for (let i = 0; i < nSamples; i++) {
        const isUpper = i < halfN;
        const progress = isUpper ? (i / halfN) * Math.PI : ((i - halfN) / (nSamples - halfN)) * Math.PI;
        let x1 = isUpper ? Math.cos(progress) : 1.0 - Math.cos(progress);
        let x2 = isUpper ? Math.sin(progress) : 0.5 - Math.sin(progress) - 0.5;

        x1 += rng.gaussian(0, noise);
        x2 += rng.gaussian(0, noise);

        X.set(i, 0, x1 * 2.0);
        X.set(i, 1, x2 * 2.0);
        y.set(i, 0, isUpper ? 0 : 1);
      }
    } else { // spiral
      const pointsPerArm = Math.floor(nSamples / 2);
      for (let i = 0; i < nSamples; i++) {
        const arm = i < pointsPerArm ? 0 : 1;
        const idx = arm === 0 ? i : i - pointsPerArm;
        const r = (idx / pointsPerArm) * 3.5;
        const theta = (idx / pointsPerArm) * 3.2 * Math.PI + (arm * Math.PI);

        const x1 = r * Math.sin(theta) + rng.gaussian(0, noise);
        const x2 = r * Math.cos(theta) + rng.gaussian(0, noise);

        X.set(i, 0, x1);
        X.set(i, 1, x2);
        y.set(i, 0, arm);
      }
    }

    return { X, y, isOutlier, domain: [-4.0, 4.0] };
  }

  /**
   * Biome 6 (Semantic Expanse): Synthetic vocabulary corpus with topic co-occurrence structure.
   * @param {Object} options
   * @param {number} [options.nVocab=50]
   * @param {number} [options.nDocs=100]
   * @param {number} [options.nTopics=4]
   * @param {number} [options.wordsPerDoc=30]
   * @param {number} [options.seed=42]
   * @returns {{ corpus: number[][], cooccurrence: Matrix, vocabulary: string[] }}
   */
  static syntheticCorpus({
    nVocab = 50,
    nDocs = 100,
    nTopics = 4,
    wordsPerDoc = 30,
    seed = 42
  } = {}) {
    const rng = new Rng(seed);
    const vocabulary = Array.from({ length: nVocab }, (_, i) => `token_${i}`);

    // Assign words primarily to distinct topic clusters
    const topicWordDist = Array.from({ length: nTopics }, () => new Float64Array(nVocab));
    for (let t = 0; t < nTopics; t++) {
      const topicCenter = Math.floor((t / nTopics) * nVocab);
      let sum = 0.0;
      for (let w = 0; w < nVocab; w++) {
        const dist = Math.min(Math.abs(w - topicCenter), nVocab - Math.abs(w - topicCenter));
        const prob = Math.exp(-0.2 * dist * dist) + 0.01;
        topicWordDist[t][w] = prob;
        sum += prob;
      }
      for (let w = 0; w < nVocab; w++) {
        topicWordDist[t][w] /= sum;
      }
    }

    const corpus = [];
    const cooccurrence = new Matrix(nVocab, nVocab);
    const coData = cooccurrence.data;

    for (let d = 0; d < nDocs; d++) {
      const activeTopic = rng.int(0, nTopics - 1);
      const doc = new Array(wordsPerDoc);

      for (let pos = 0; pos < wordsPerDoc; pos++) {
        // Sample word according to active topic distribution
        const r = rng.next();
        let cum = 0;
        let chosenWord = 0;
        for (let w = 0; w < nVocab; w++) {
          cum += topicWordDist[activeTopic][w];
          if (r <= cum) {
            chosenWord = w;
            break;
          }
        }
        doc[pos] = chosenWord;
      }
      corpus.push(doc);

      // Window co-occurrence counting (window = 3)
      const windowSize = 3;
      for (let i = 0; i < wordsPerDoc; i++) {
        const w1 = doc[i];
        for (let j = Math.max(0, i - windowSize); j <= Math.min(wordsPerDoc - 1, i + windowSize); j++) {
          if (i !== j) {
            const w2 = doc[j];
            coData[w1 * nVocab + w2] += 1.0;
          }
        }
      }
    }

    return { corpus, cooccurrence, vocabulary };
  }
}

/**
 * @file Rng.js
 * @description Deterministic pseudo-random number generator based on Mulberry32,
 * featuring Box-Muller Gaussian sampling, Fisher-Yates array shuffling, and bootstrap sampling.
 */

export class Rng {
  /**
   * @param {number} [seed=42] - 32-bit integer seed
   */
  constructor(seed = 42) {
    this.seed = (seed >>> 0) || 1;
    this.state = this.seed;
    this._hasSpareGaussian = false;
    this._spareGaussian = 0.0;
  }

  /**
   * Resets the RNG with a new seed.
   * @param {number} seed
   */
  reseed(seed) {
    this.seed = (seed >>> 0) || 1;
    this.state = this.seed;
    this._hasSpareGaussian = false;
    this._spareGaussian = 0.0;
  }

  /**
   * Core Mulberry32 algorithm: returns a deterministic float in [0, 1).
   * @returns {number}
   */
  next() {
    let t = (this.state += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Uniform floating point number in [min, max).
   * @param {number} min
   * @param {number} max
   * @returns {number}
   */
  float(min = 0, max = 1) {
    return min + this.next() * (max - min);
  }

  /**
   * Uniform integer in [min, max] inclusive.
   * @param {number} min
   * @param {number} max
   * @returns {number}
   */
  int(min, max) {
    const fMin = Math.ceil(min);
    const fMax = Math.floor(max);
    return Math.floor(this.next() * (fMax - fMin + 1)) + fMin;
  }

  /**
   * Box-Muller transform for Gaussian (normal) distribution N(mean, std^2).
   * Caches the second generated standard normal variate for maximum throughput.
   * @param {number} [mean=0]
   * @param {number} [std=1]
   * @returns {number}
   */
  gaussian(mean = 0, std = 1) {
    if (this._hasSpareGaussian) {
      this._hasSpareGaussian = false;
      return mean + this._spareGaussian * std;
    }

    let u = 0;
    let v = 0;
    while (u === 0) u = this.next(); // Box-Muller requires u in (0, 1]
    while (v === 0) v = this.next();

    const radius = Math.sqrt(-2.0 * Math.log(u));
    const theta = 2.0 * Math.PI * v;

    this._spareGaussian = radius * Math.sin(theta);
    this._hasSpareGaussian = true;

    return mean + radius * Math.cos(theta) * std;
  }

  /**
   * In-place Fisher-Yates shuffle.
   * @template T
   * @param {T[]} array
   * @returns {T[]} Same array instance, shuffled
   */
  shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      const temp = array[i];
      array[i] = array[j];
      array[j] = temp;
    }
    return array;
  }

  /**
   * Generates a bootstrap sample (sampling with replacement).
   * @template T
   * @param {T[]} array - Source data array
   * @param {number} [nSamples=array.length] - Number of samples to draw
   * @returns {T[]}
   */
  bootstrapSample(array, nSamples = array.length) {
    const len = array.length;
    if (len === 0) return [];
    const sample = new Array(nSamples);
    for (let i = 0; i < nSamples; i++) {
      const idx = this.int(0, len - 1);
      sample[i] = array[idx];
    }
    return sample;
  }

  /**
   * Selects a random element from an array.
   * @template T
   * @param {T[]} array
   * @returns {T}
   */
  choice(array) {
    if (array.length === 0) return undefined;
    const idx = this.int(0, array.length - 1);
    return array[idx];
  }
}

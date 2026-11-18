/**
 * Seeded deterministic xoshiro128** pseudo-random number generator.
 * Standard 128-bit state with SplitMix32 seed initialization.
 */

function rotl(x: number, k: number): number {
  return ((x << k) | (x >>> (32 - k))) >>> 0;
}

function splitmix32(state: { seed: number }): number {
  state.seed = (state.seed + 0x9e3779b9) >>> 0;
  let z = state.seed;
  z = Math.imul(z ^ (z >>> 16), 0x21f0aaad) >>> 0;
  z = Math.imul(z ^ (z >>> 15), 0x735a2d97) >>> 0;
  return (z ^ (z >>> 15)) >>> 0;
}

export class Xoshiro128StarStar {
  private s0: number = 0;
  private s1: number = 0;
  private s2: number = 0;
  private s3: number = 0;

  constructor(seed: number = 42) {
    this.seed(seed);
  }

  public seed(seed: number): void {
    const smState = { seed: seed >>> 0 };
    // Initialize 4 state words using SplitMix32
    this.s0 = splitmix32(smState);
    this.s1 = splitmix32(smState);
    this.s2 = splitmix32(smState);
    this.s3 = splitmix32(smState);

    // Ensure non-zero state
    if ((this.s0 | this.s1 | this.s2 | this.s3) === 0) {
      this.s0 = 1;
    }
  }

  /**
   * Generates a 32-bit unsigned integer in [0, 2^32 - 1].
   */
  public nextUint32(): number {
    const result = Math.imul(rotl(Math.imul(this.s1, 5) >>> 0, 7), 9) >>> 0;

    const t = (this.s1 << 9) >>> 0;

    this.s2 ^= this.s0;
    this.s3 ^= this.s1;
    this.s1 ^= this.s2;
    this.s0 ^= this.s3;

    this.s2 ^= t;
    this.s3 = rotl(this.s3, 11);

    return result;
  }

  /**
   * Generates a non-negative pseudo-random integer.
   */
  public next(): number {
    return this.nextUint32();
  }

  /**
   * In-place Fisher-Yates array shuffle.
   */
  public shuffle<T extends { length: number; [index: number]: any }>(array: T): T {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(this.nextFloat() * (i + 1));
      const tmp = array[i];
      array[i] = array[j];
      array[j] = tmp;
    }
    return array;
  }

  /**
   * Generates a float64 in [0, 1).
   */
  public nextFloat(): number {
    // 32-bit precision normalization: 0 <= val < 1
    return this.nextUint32() / 4294967296.0;
  }

  /**
   * Generates a normally distributed float64 ~ N(mean, std^2) using Box-Muller transform.
   */
  public nextNormal(mean = 0.0, std = 1.0): number {
    let u1 = this.nextFloat();
    while (u1 <= 1e-15) {
      u1 = this.nextFloat();
    }
    const u2 = this.nextFloat();
    const radius = Math.sqrt(-2.0 * Math.log(u1));
    const theta = 2.0 * Math.PI * u2;
    return mean + std * (radius * Math.cos(theta));
  }

  public clone(): Xoshiro128StarStar {
    const copy = new Xoshiro128StarStar(1);
    copy.s0 = this.s0;
    copy.s1 = this.s1;
    copy.s2 = this.s2;
    copy.s3 = this.s3;
    return copy;
  }
}

/**
 * Fast Deterministic Procedural Noise, Domain Warping, and Ridged Mountain Multifractal Generator.
 * Used for both CPU physics/gameplay sampling and Worker terrain mesh generation.
 */

// Permutation table for deterministic 2D Simplex Noise
const PERM = new Uint8Array(512);
const P = [
  151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225, 140, 36, 103, 30, 69,
  142, 8, 99, 37, 240, 21, 10, 23, 190, 6, 148, 247, 120, 234, 75, 0, 26, 197, 62, 94, 252, 219,
  203, 117, 35, 11, 32, 57, 177, 33, 88, 237, 149, 56, 87, 174, 20, 125, 136, 171, 168, 68, 175,
  74, 165, 71, 134, 139, 48, 27, 166, 77, 146, 158, 231, 83, 111, 229, 122, 60, 211, 133, 230,
  220, 105, 92, 41, 55, 46, 245, 40, 244, 102, 143, 54, 65, 25, 63, 161, 1, 216, 80, 73, 209,
  76, 132, 187, 208, 89, 18, 169, 200, 196, 135, 130, 116, 188, 159, 86, 164, 100, 109, 198,
  173, 186, 3, 64, 52, 217, 226, 250, 124, 123, 5, 202, 38, 147, 118, 126, 255, 82, 85, 212,
  207, 206, 59, 227, 47, 16, 58, 17, 182, 189, 28, 42, 223, 183, 170, 213, 119, 248, 152, 2, 44,
  154, 163, 70, 221, 153, 101, 155, 167, 43, 172, 9, 129, 22, 39, 253, 19, 98, 108, 110, 79,
  113, 224, 232, 178, 185, 112, 104, 218, 246, 97, 228, 251, 34, 242, 193, 238, 210, 144, 12,
  191, 179, 162, 241, 81, 51, 145, 235, 249, 14, 239, 107, 49, 192, 214, 31, 181, 199, 106,
  157, 184, 84, 204, 176, 115, 121, 50, 45, 127, 4, 150, 254, 138, 236, 205, 93, 222, 114, 67,
  29, 24, 72, 243, 141, 128, 195, 78, 66, 215, 61, 156, 180
];

for (let i = 0; i < 256; i++) {
  PERM[i] = P[i];
  PERM[256 + i] = P[i];
}

const F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
const G2 = (3.0 - Math.sqrt(3.0)) / 6.0;

const GRAD2 = [
  [1, 1], [-1, 1], [1, -1], [-1, -1],
  [1, 0], [-1, 0], [0, 1], [0, -1]
];

/**
 * 2D Simplex Noise in range [-1, 1].
 */
export function simplex2D(xin: number, yin: number): number {
  let n0 = 0;
  let n1 = 0;
  let n2 = 0;

  const s = (xin + yin) * F2;
  const i = Math.floor(xin + s);
  const j = Math.floor(yin + s);
  const t = (i + j) * G2;
  const X0 = i - t;
  const Y0 = j - t;
  const x0 = xin - X0;
  const y0 = yin - Y0;

  let i1 = 0;
  let j1 = 0;
  if (x0 > y0) {
    i1 = 1;
    j1 = 0;
  } else {
    i1 = 0;
    j1 = 1;
  }

  const x1 = x0 - i1 + G2;
  const y1 = y0 - j1 + G2;
  const x2 = x0 - 1.0 + 2.0 * G2;
  const y2 = y0 - 1.0 + 2.0 * G2;

  const ii = i & 255;
  const jj = j & 255;

  let t0 = 0.5 - x0 * x0 - y0 * y0;
  if (t0 >= 0) {
    const gi0 = PERM[ii + PERM[jj]] % 8;
    t0 *= t0;
    n0 = t0 * t0 * (GRAD2[gi0][0] * x0 + GRAD2[gi0][1] * y0);
  }

  let t1 = 0.5 - x1 * x1 - y1 * y1;
  if (t1 >= 0) {
    const gi1 = PERM[ii + i1 + PERM[jj + j1]] % 8;
    t1 *= t1;
    n1 = t1 * t1 * (GRAD2[gi1][0] * x1 + GRAD2[gi1][1] * y1);
  }

  let t2 = 0.5 - x2 * x2 - y2 * y2;
  if (t2 >= 0) {
    const gi2 = PERM[ii + 1 + PERM[jj + 1]] % 8;
    t2 *= t2;
    n2 = t2 * t2 * (GRAD2[gi2][0] * x2 + GRAD2[gi2][1] * y2);
  }

  return 70.0 * (n0 + n1 + n2);
}

/**
 * Standard Fractal Brownian Motion (fBm) with configurable octaves, persistence, and lacunarity.
 */
export function fbm(
  x: number,
  y: number,
  octaves = 5,
  lacunarity = 2.0,
  gain = 0.5
): number {
  let total = 0;
  let frequency = 1.0;
  let amplitude = 1.0;
  let maxValue = 0;

  for (let i = 0; i < octaves; i++) {
    total += simplex2D(x * frequency, y * frequency) * amplitude;
    maxValue += amplitude;
    frequency *= lacunarity;
    amplitude *= gain;
  }

  return total / maxValue;
}

/**
 * Ridged Multi-fractal Noise for sharp mountain ridges.
 * Absolute value inverted creates sharp peaks and valleys.
 */
export function ridgedNoise(
  x: number,
  y: number,
  octaves = 4,
  lacunarity = 2.0,
  gain = 0.5
): number {
  let total = 0;
  let frequency = 1.0;
  let amplitude = 1.0;
  let weight = 1.0;

  for (let i = 0; i < octaves; i++) {
    let signal = simplex2D(x * frequency, y * frequency);
    signal = Math.abs(signal);
    signal = 1.0 - signal;
    signal = signal * signal;

    signal *= weight;
    weight = Math.min(1.0, Math.max(0.0, signal * 2.0));

    total += signal * amplitude;
    frequency *= lacunarity;
    amplitude *= gain;
  }

  return total;
}

/**
 * Domain-Warped Noise: Evaluates coordinates perturbed by another noise field.
 */
export function domainWarpedFbm(x: number, y: number, warpStrength = 80.0): number {
  // First warp layer q
  const qx = fbm(x + 0.0, y + 0.0, 4);
  const qy = fbm(x + 5.2, y + 1.3, 4);

  // Second warp layer r
  const rx = fbm(x + 4.0 * qx + 1.7, y + 4.0 * qy + 9.2, 4);
  const ry = fbm(x + 4.0 * qx + 8.3, y + 4.0 * qy + 2.8, 4);

  // Final warped coordinate
  const wx = x + warpStrength * rx;
  const wy = y + warpStrength * ry;

  return fbm(wx, wy, 5);
}

/**
 * World Elevation Function (Analytical CPU Source of Truth).
 * World extends across 2 km x 2 km [-1000, 1000].
 * Combines domain-warped rolling hills, flat sand plains/riverbeds, and dramatic mountain peaks.
 */
export function getTerrainHeight(x: number, z: number): number {
  // Scale down spatial coordinates for natural 2 km landscape scale
  const sx = x * 0.0018;
  const sz = z * 0.0018;

  // 1. Continental / Biome Mask: decides where mountains vs plains occur
  const biomeNoise = fbm(sx * 0.8 + 12.3, sz * 0.8 + 45.6, 3);
  const mountainFactor = Math.pow(Math.max(0.0, biomeNoise * 0.5 + 0.5), 1.8);

  // 2. Base rolling hills with domain warping
  const baseHills = domainWarpedFbm(sx * 1.5, sz * 1.5, 0.4);
  const hillsHeight = (baseHills * 0.5 + 0.5) * 32.0;

  // 3. High sharp mountain ridges using ridged multifractal
  const ridgeVal = ridgedNoise(sx * 2.5 + 50.0, sz * 2.5 + 50.0, 5, 2.1, 0.48);
  const mountainHeight = ridgeVal * 95.0 * mountainFactor;

  // 4. Lowland basin / sand beach smoothing near zero elevation
  const rawHeight = hillsHeight + mountainHeight + 4.0;

  // Edge falloff so world gracefully cradles towards edges
  const distFromCenter = Math.sqrt(x * x + z * z);
  const edgeFalloff = Math.max(0.0, 1.0 - Math.pow(distFromCenter / 1200.0, 4.0));

  return Math.max(1.5, rawHeight * edgeFalloff);
}

/**
 * Computes analytical surface normal at world position (x, z) using central finite differences.
 */
export function getTerrainNormal(x: number, z: number, eps = 0.5): [number, number, number] {
  const hL = getTerrainHeight(x - eps, z);
  const hR = getTerrainHeight(x + eps, z);
  const hD = getTerrainHeight(x, z - eps);
  const hU = getTerrainHeight(x, z + eps);

  const dx = hR - hL;
  const dz = hU - hD;
  const dy = 2.0 * eps;

  const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
  return [-dx / len, dy / len, -dz / len];
}

/**
 * Computes surface slope angle in radians (0 = flat, PI/2 = vertical wall).
 */
export function getTerrainSlope(x: number, z: number): number {
  const normal = getTerrainNormal(x, z);
  // normal[1] is cos(theta) where theta is slope angle
  return Math.acos(Math.min(1.0, Math.max(0.0, normal[1])));
}

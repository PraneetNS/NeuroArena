import fs from 'fs';
import { getTrainTokens, getValTokens, CORPUS_PROVENANCE } from '../packages/ml-core/src/data/validation.ts';

// We want to test Interpolated Absolute Discounting across orders 1..5
// Let's build count tables for orders 1..5 and test discounts on a held-out slice of TRAIN.

const trainTokens = getTrainTokens();
const valTokens = getValTokens();
const charsPerTok = CORPUS_PROVENANCE.charsPerToken.val; // 2.3107

// Slice TRAIN: 1.98M train slice, 100k held-out slice for tuning discounts
const T_SPLIT = 1980000;
const trainSlice = trainTokens.subarray(0, T_SPLIT);
const tuneSlice = trainTokens.subarray(T_SPLIT);

console.log(`Tuning slice: train=${trainSlice.length}, held-out tune=${tuneSlice.length}`);

// Data structures for Absolute Discounting:
// Order 1:
const unigramCounts = new Uint32Array(1024);
let trainTotal = 0;

// Order 2:
const bigramCounts = new Map<number, number>();
const bigramContextTotals = new Uint32Array(1024);
const bigramUniqueCont = new Uint16Array(1024);

// Order 3:
const trigramCounts = new Map<number, number>();
const trigramContextTotals = new Map<number, number>();
const trigramUniqueCont = new Map<number, number>();

// Order 4:
const fourgramCounts = new Map<bigint, number>();
const fourgramContextTotals = new Map<number, number>();
const fourgramUniqueCont = new Map<number, number>();

// Order 5:
const fivegramCounts = new Map<bigint, number>();
const fivegramContextTotals = new Map<bigint, number>();
const fivegramUniqueCont = new Map<bigint, number>();

function buildTables(tokens: Uint16Array) {
  const N = tokens.length;
  trainTotal = N;
  unigramCounts.fill(0);
  bigramCounts.clear();
  bigramContextTotals.fill(0);
  bigramUniqueCont.fill(0);
  trigramCounts.clear();
  trigramContextTotals.clear();
  trigramUniqueCont.clear();
  fourgramCounts.clear();
  fourgramContextTotals.clear();
  fourgramUniqueCont.clear();
  fivegramCounts.clear();
  fivegramContextTotals.clear();
  fivegramUniqueCont.clear();

  for (let i = 0; i < N; i++) {
    const tok = tokens[i];
    if (tok < 1024) unigramCounts[tok]++;
  }

  for (let i = 0; i < N - 1; i++) {
    const u = tokens[i];
    const v = tokens[i + 1];
    if (u < 1024 && v < 1024) {
      bigramContextTotals[u]++;
      const k = (u << 10) | v;
      const prev = bigramCounts.get(k) || 0;
      if (prev === 0) bigramUniqueCont[u]++;
      bigramCounts.set(k, prev + 1);
    }
  }

  for (let i = 0; i < N - 2; i++) {
    const u = tokens[i];
    const v = tokens[i + 1];
    const w = tokens[i + 2];
    if (u < 1024 && v < 1024 && w < 1024) {
      const ctx = (u << 10) | v;
      trigramContextTotals.set(ctx, (trigramContextTotals.get(ctx) || 0) + 1);
      const k = (u << 20) | (v << 10) | w;
      const prev = trigramCounts.get(k) || 0;
      if (prev === 0) trigramUniqueCont.set(ctx, (trigramUniqueCont.get(ctx) || 0) + 1);
      trigramCounts.set(k, prev + 1);
    }
  }

  for (let i = 0; i < N - 3; i++) {
    const u = tokens[i];
    const v = tokens[i + 1];
    const w = tokens[i + 2];
    const x = tokens[i + 3];
    if (u < 1024 && v < 1024 && w < 1024 && x < 1024) {
      const ctx = (u << 20) | (v << 10) | w;
      fourgramContextTotals.set(ctx, (fourgramContextTotals.get(ctx) || 0) + 1);
      const k = (BigInt(ctx) << 10n) | BigInt(x);
      const prev = fourgramCounts.get(k) || 0;
      if (prev === 0) fourgramUniqueCont.set(ctx, (fourgramUniqueCont.get(ctx) || 0) + 1);
      fourgramCounts.set(k, prev + 1);
    }
  }

  for (let i = 0; i < N - 4; i++) {
    const u = tokens[i];
    const v = tokens[i + 1];
    const w = tokens[i + 2];
    const x = tokens[i + 3];
    const y = tokens[i + 4];
    if (u < 1024 && v < 1024 && w < 1024 && x < 1024 && y < 1024) {
      const ctx = (BigInt((u << 20) | (v << 10) | w) << 10n) | BigInt(x);
      fivegramContextTotals.set(ctx, (fivegramContextTotals.get(ctx) || 0) + 1);
      const k = (ctx << 10n) | BigInt(y);
      const prev = fivegramCounts.get(k) || 0;
      if (prev === 0) fivegramUniqueCont.set(ctx, (fivegramUniqueCont.get(ctx) || 0) + 1);
      fivegramCounts.set(k, prev + 1);
    }
  }
}

// Probability evaluators with order-specific discounts D1, D2, D3, D4, D5
function p1(w: number, D1: number): number {
  const c = unigramCounts[w] || 0;
  const numTypes = 1024;
  let nonZeroTypes = 0;
  for (let t = 0; t < 1024; t++) {
    if (unigramCounts[t] > 0) nonZeroTypes++;
  }
  const main = Math.max(0, c - D1) / trainTotal;
  const backoff = (D1 * nonZeroTypes / trainTotal) * (1 / 1024);
  return main + backoff;
}

function p2(u: number, v: number, D1: number, D2: number): number {
  const c_u = bigramContextTotals[u] || 0;
  const baseP1 = p1(v, D1);
  if (c_u === 0) return baseP1;
  const k = (u << 10) | v;
  const c_uv = bigramCounts.get(k) || 0;
  const numTypes = bigramUniqueCont[u] || 0;
  const main = Math.max(0, c_uv - D2) / c_u;
  const backoff = (D2 * numTypes / c_u) * baseP1;
  return main + backoff;
}

function p3(u: number, v: number, w: number, D1: number, D2: number, D3: number): number {
  const ctx = (u << 10) | v;
  const c_ctx = trigramContextTotals.get(ctx) || 0;
  const baseP2 = p2(v, w, D1, D2);
  if (c_ctx === 0) return baseP2;
  const k = (u << 20) | (v << 10) | w;
  const c_tri = trigramCounts.get(k) || 0;
  const numTypes = trigramUniqueCont.get(ctx) || 0;
  const main = Math.max(0, c_tri - D3) / c_ctx;
  const backoff = (D3 * numTypes / c_ctx) * baseP2;
  return main + backoff;
}

function p4(u: number, v: number, w: number, x: number, D1: number, D2: number, D3: number, D4: number): number {
  const ctx = (u << 20) | (v << 10) | w;
  const c_ctx = fourgramContextTotals.get(ctx) || 0;
  const baseP3 = p3(v, w, x, D1, D2, D3);
  if (c_ctx === 0) return baseP3;
  const k = (BigInt(ctx) << 10n) | BigInt(x);
  const c_quad = fourgramCounts.get(k) || 0;
  const numTypes = fourgramUniqueCont.get(ctx) || 0;
  const main = Math.max(0, c_quad - D4) / c_ctx;
  const backoff = (D4 * numTypes / c_ctx) * baseP3;
  return main + backoff;
}

function p5(u: number, v: number, w: number, x: number, y: number, D1: number, D2: number, D3: number, D4: number, D5: number): number {
  const ctx = (BigInt((u << 20) | (v << 10) | w) << 10n) | BigInt(x);
  const c_ctx = fivegramContextTotals.get(ctx) || 0;
  const baseP4 = p4(v, w, x, y, D1, D2, D3, D4);
  if (c_ctx === 0) return baseP4;
  const k = (ctx << 10n) | BigInt(y);
  const c_five = fivegramCounts.get(k) || 0;
  const numTypes = fivegramUniqueCont.get(ctx) || 0;
  const main = Math.max(0, c_five - D5) / c_ctx;
  const backoff = (D5 * numTypes / c_ctx) * baseP4;
  return main + backoff;
}

function evalLoss(order: number, val: Uint16Array, D: number[]): number {
  const N = val.length;
  let nll = 0;
  const count = N - (order - 1);
  for (let i = 0; i < count; i++) {
    let p = 0;
    if (order === 1) p = p1(val[i], D[0]);
    else if (order === 2) p = p2(val[i], val[i + 1], D[0], D[1]);
    else if (order === 3) p = p3(val[i], val[i + 1], val[i + 2], D[0], D[1], D[2]);
    else if (order === 4) p = p4(val[i], val[i + 1], val[i + 2], val[i + 3], D[0], D[1], D[2], D[3]);
    else if (order === 5) p = p5(val[i], val[i + 1], val[i + 2], val[i + 3], val[i + 4], D[0], D[1], D[2], D[3], D[4]);
    nll += -Math.log(Math.max(1e-12, p));
  }
  return nll / count;
}

// Build on trainSlice
console.log('Building tables on trainSlice...');
buildTables(trainSlice);
console.log('Tuning discounts on tuneSlice...');

for (const d of [0.5, 0.6, 0.7, 0.75, 0.8, 0.85, 0.9]) {
  const l1 = evalLoss(1, tuneSlice, [d, d, d, d, d]);
  console.log(`D=${d}: Unigram Loss = ${l1.toFixed(4)}`);
}

for (const d of [0.5, 0.6, 0.7, 0.75, 0.8, 0.85, 0.9]) {
  const l2 = evalLoss(2, tuneSlice, [0.75, d, d, d, d]);
  console.log(`D2=${d}: Bigram Loss = ${l2.toFixed(4)}`);
}

for (const d of [0.5, 0.6, 0.7, 0.75, 0.8, 0.85, 0.9]) {
  const l3 = evalLoss(3, tuneSlice, [0.75, 0.75, d, d, d]);
  console.log(`D3=${d}: Trigram Loss = ${l3.toFixed(4)}`);
}

for (const d of [0.5, 0.6, 0.7, 0.75, 0.8, 0.85, 0.9]) {
  const l4 = evalLoss(4, tuneSlice, [0.75, 0.75, 0.75, d, d]);
  console.log(`D4=${d}: 4-Gram Loss = ${l4.toFixed(4)}`);
}

for (const d of [0.5, 0.6, 0.7, 0.75, 0.8, 0.85, 0.9]) {
  const l5 = evalLoss(5, tuneSlice, [0.75, 0.75, 0.75, 0.75, d]);
  console.log(`D5=${d}: 5-Gram Loss = ${l5.toFixed(4)}`);
}

import { getTrainTokens, getValTokens } from '../packages/ml-core/src/data/validation.ts';
const trainTokens = getTrainTokens();
const valTokens = getValTokens();

// Let's test KN for orders 1..5:
// Test 1: KN where unigram fallback is continuation count
// Test 2: Absolute Discounting where unigram fallback is marginal frequency c(w)
// Let's compare their validation loss for orders 1..5!

console.log('Comparing full TRAIN orders 1..5...');
// Build counts up to order 5:
const unigramCounts = new Uint32Array(1024);
const bigramCounts = new Map<number, number>();
const bigramContextTotals = new Uint32Array(1024);
const bigramUniqueCont = new Uint16Array(1024);
const trigramCounts = new Map<number, number>();
const trigramContextTotals = new Map<number, number>();
const trigramUniqueCont = new Map<number, number>();
const fourgramCounts = new Map<bigint, number>();
const fourgramContextTotals = new Map<number, number>();
const fourgramUniqueCont = new Map<number, number>();
const fivegramCounts = new Map<bigint, number>();
const fivegramContextTotals = new Map<bigint, number>();
const fivegramUniqueCont = new Map<bigint, number>();

// Continuation counts for KN:
const knUnigramCont = new Uint32Array(1024);
let totalBigramTypes = 0;

const N = trainTokens.length;
for (let i = 0; i < N; i++) unigramCounts[trainTokens[i]]++;

for (let i = 0; i < N - 1; i++) {
  const u = trainTokens[i];
  const v = trainTokens[i + 1];
  bigramContextTotals[u]++;
  const k = (u << 10) | v;
  const prev = bigramCounts.get(k) || 0;
  if (prev === 0) {
    bigramUniqueCont[u]++;
    knUnigramCont[v]++;
    totalBigramTypes++;
  }
  bigramCounts.set(k, prev + 1);
}

for (let i = 0; i < N - 2; i++) {
  const u = trainTokens[i];
  const v = trainTokens[i + 1];
  const w = trainTokens[i + 2];
  const ctx = (u << 10) | v;
  trigramContextTotals.set(ctx, (trigramContextTotals.get(ctx) || 0) + 1);
  const k = (u << 20) | (v << 10) | w;
  const prev = trigramCounts.get(k) || 0;
  if (prev === 0) trigramUniqueCont.set(ctx, (trigramUniqueCont.get(ctx) || 0) + 1);
  trigramCounts.set(k, prev + 1);
}

for (let i = 0; i < N - 3; i++) {
  const u = trainTokens[i];
  const v = trainTokens[i + 1];
  const w = trainTokens[i + 2];
  const x = trainTokens[i + 3];
  const ctx = (u << 20) | (v << 10) | w;
  fourgramContextTotals.set(ctx, (fourgramContextTotals.get(ctx) || 0) + 1);
  const k = (BigInt(ctx) << 10n) | BigInt(x);
  const prev = fourgramCounts.get(k) || 0;
  if (prev === 0) fourgramUniqueCont.set(ctx, (fourgramUniqueCont.get(ctx) || 0) + 1);
  fourgramCounts.set(k, prev + 1);
}

for (let i = 0; i < N - 4; i++) {
  const u = trainTokens[i];
  const v = trainTokens[i + 1];
  const w = trainTokens[i + 2];
  const x = trainTokens[i + 3];
  const y = trainTokens[i + 4];
  const ctx = (BigInt((u << 20) | (v << 10) | w) << 10n) | BigInt(x);
  fivegramContextTotals.set(ctx, (fivegramContextTotals.get(ctx) || 0) + 1);
  const k = (ctx << 10n) | BigInt(y);
  const prev = fivegramCounts.get(k) || 0;
  if (prev === 0) fivegramUniqueCont.set(ctx, (fivegramUniqueCont.get(ctx) || 0) + 1);
  fivegramCounts.set(k, prev + 1);
}

console.log('Tables built. Evaluating on VAL for orders 1..5...');

// Discounts
const D = [0.75, 0.75, 0.88, 0.90, 0.90];

// Mode A: Absolute Discounting (unigram uses word frequency)
function p_ad_1(w: number): number {
  const c = unigramCounts[w] || 0;
  const d = D[0];
  let nonZero = 0;
  for (let t = 0; t < 1024; t++) if (unigramCounts[t] > 0) nonZero++;
  return Math.max(0, c - d) / N + (d * nonZero / N) * (1 / 1024);
}

function p_ad_2(u: number, v: number): number {
  const c_u = bigramContextTotals[u] || 0;
  const base = p_ad_1(v);
  if (c_u === 0) return base;
  const k = (u << 10) | v;
  const c_uv = bigramCounts.get(k) || 0;
  const d = D[1];
  const numTypes = bigramUniqueCont[u] || 0;
  return Math.max(0, c_uv - d) / c_u + (d * numTypes / c_u) * base;
}

function p_ad_3(u: number, v: number, w: number): number {
  const ctx = (u << 10) | v;
  const c_ctx = trigramContextTotals.get(ctx) || 0;
  const base = p_ad_2(v, w);
  if (c_ctx === 0) return base;
  const k = (u << 20) | (v << 10) | w;
  const c_tri = trigramCounts.get(k) || 0;
  const d = D[2];
  const numTypes = trigramUniqueCont.get(ctx) || 0;
  return Math.max(0, c_tri - d) / c_ctx + (d * numTypes / c_ctx) * base;
}

function p_ad_4(u: number, v: number, w: number, x: number): number {
  const ctx = (u << 20) | (v << 10) | w;
  const c_ctx = fourgramContextTotals.get(ctx) || 0;
  const base = p_ad_3(v, w, x);
  if (c_ctx === 0) return base;
  const k = (BigInt(ctx) << 10n) | BigInt(x);
  const c_quad = fourgramCounts.get(k) || 0;
  const d = D[3];
  const numTypes = fourgramUniqueCont.get(ctx) || 0;
  return Math.max(0, c_quad - d) / c_ctx + (d * numTypes / c_ctx) * base;
}

function p_ad_5(u: number, v: number, w: number, x: number, y: number): number {
  const ctx = (BigInt((u << 20) | (v << 10) | w) << 10n) | BigInt(x);
  const c_ctx = fivegramContextTotals.get(ctx) || 0;
  const base = p_ad_4(v, w, x, y);
  if (c_ctx === 0) return base;
  const k = (ctx << 10n) | BigInt(y);
  const c_five = fivegramCounts.get(k) || 0;
  const d = D[4];
  const numTypes = fivegramUniqueCont.get(ctx) || 0;
  return Math.max(0, c_five - d) / c_ctx + (d * numTypes / c_ctx) * base;
}

// Mode B: KN (unigram backoff uses continuation count)
function p_kn_1(w: number): number {
  const c = knUnigramCont[w] || 0;
  const d = D[0];
  let nonZero = 0;
  for (let t = 0; t < 1024; t++) if (knUnigramCont[t] > 0) nonZero++;
  return Math.max(0, c - d) / totalBigramTypes + (d * nonZero / totalBigramTypes) * (1 / 1024);
}

function p_kn_2(u: number, v: number): number {
  const c_u = bigramContextTotals[u] || 0;
  const base = p_kn_1(v);
  if (c_u === 0) return base;
  const k = (u << 10) | v;
  const c_uv = bigramCounts.get(k) || 0;
  const d = D[1];
  const numTypes = bigramUniqueCont[u] || 0;
  return Math.max(0, c_uv - d) / c_u + (d * numTypes / c_u) * base;
}

function p_kn_3(u: number, v: number, w: number): number {
  const ctx = (u << 10) | v;
  const c_ctx = trigramContextTotals.get(ctx) || 0;
  const base = p_kn_2(v, w);
  if (c_ctx === 0) return base;
  const k = (u << 20) | (v << 10) | w;
  const c_tri = trigramCounts.get(k) || 0;
  const d = D[2];
  const numTypes = trigramUniqueCont.get(ctx) || 0;
  return Math.max(0, c_tri - d) / c_ctx + (d * numTypes / c_ctx) * base;
}

function p_kn_4(u: number, v: number, w: number, x: number): number {
  const ctx = (u << 20) | (v << 10) | w;
  const c_ctx = fourgramContextTotals.get(ctx) || 0;
  const base = p_kn_3(v, w, x);
  if (c_ctx === 0) return base;
  const k = (BigInt(ctx) << 10n) | BigInt(x);
  const c_quad = fourgramCounts.get(k) || 0;
  const d = D[3];
  const numTypes = fourgramUniqueCont.get(ctx) || 0;
  return Math.max(0, c_quad - d) / c_ctx + (d * numTypes / c_ctx) * base;
}

function p_kn_5(u: number, v: number, w: number, x: number, y: number): number {
  const ctx = (BigInt((u << 20) | (v << 10) | w) << 10n) | BigInt(x);
  const c_ctx = fivegramContextTotals.get(ctx) || 0;
  const base = p_kn_4(v, w, x, y);
  if (c_ctx === 0) return base;
  const k = (ctx << 10n) | BigInt(y);
  const c_five = fivegramCounts.get(k) || 0;
  const d = D[4];
  const numTypes = fivegramUniqueCont.get(ctx) || 0;
  return Math.max(0, c_five - d) / c_ctx + (d * numTypes / c_ctx) * base;
}

const V = valTokens;
let l_ad_1 = 0, l_ad_2 = 0, l_ad_3 = 0, l_ad_4 = 0, l_ad_5 = 0;
let l_kn_1 = 0, l_kn_2 = 0, l_kn_3 = 0, l_kn_4 = 0, l_kn_5 = 0;

for (let i = 0; i < V.length; i++) {
  l_ad_1 += -Math.log(p_ad_1(V[i]));
  l_kn_1 += -Math.log(p_kn_1(V[i]));
}
for (let i = 0; i < V.length - 1; i++) {
  l_ad_2 += -Math.log(p_ad_2(V[i], V[i+1]));
  l_kn_2 += -Math.log(p_kn_2(V[i], V[i+1]));
}
for (let i = 0; i < V.length - 2; i++) {
  l_ad_3 += -Math.log(p_ad_3(V[i], V[i+1], V[i+2]));
  l_kn_3 += -Math.log(p_kn_3(V[i], V[i+1], V[i+2]));
}
for (let i = 0; i < V.length - 3; i++) {
  l_ad_4 += -Math.log(p_ad_4(V[i], V[i+1], V[i+2], V[i+3]));
  l_kn_4 += -Math.log(p_kn_4(V[i], V[i+1], V[i+2], V[i+3]));
}
for (let i = 0; i < V.length - 4; i++) {
  l_ad_5 += -Math.log(p_ad_5(V[i], V[i+1], V[i+2], V[i+3], V[i+4]));
  l_kn_5 += -Math.log(p_kn_5(V[i], V[i+1], V[i+2], V[i+3], V[i+4]));
}

console.log('Absolute Discounting:');
console.log('1:', (l_ad_1 / V.length).toFixed(4));
console.log('2:', (l_ad_2 / (V.length - 1)).toFixed(4));
console.log('3:', (l_ad_3 / (V.length - 2)).toFixed(4));
console.log('4:', (l_ad_4 / (V.length - 3)).toFixed(4));
console.log('5:', (l_ad_5 / (V.length - 4)).toFixed(4));

console.log('Kneser-Ney:');
console.log('1 (unigram standalone):', (l_ad_1 / V.length).toFixed(4), '(continuation fallback: ' + (l_kn_1 / V.length).toFixed(4) + ')');
console.log('2:', (l_kn_2 / (V.length - 1)).toFixed(4));
console.log('3:', (l_kn_3 / (V.length - 2)).toFixed(4));
console.log('4:', (l_kn_4 / (V.length - 3)).toFixed(4));
console.log('5:', (l_kn_5 / (V.length - 4)).toFixed(4));

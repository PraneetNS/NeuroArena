import { getTrainTokens, getValTokens } from '../packages/ml-core/src/data/validation.ts';
const trainTokens = getTrainTokens();
const valTokens = getValTokens();

const bigramCounts = new Map<number, number>();
const bigramContextTotals = new Uint32Array(1024);
const bigramUniqueCont = new Uint16Array(1024);
const knUnigramContCounts = new Uint32Array(1024);
let knTotalBigramTypes = 0;

for (let i = 0; i < trainTokens.length - 1; i++) {
  const u = trainTokens[i];
  const v = trainTokens[i + 1];
  if (u < 1024 && v < 1024) {
    bigramContextTotals[u]++;
    const k = (u << 10) | v;
    const prev = bigramCounts.get(k) || 0;
    if (prev === 0) {
      bigramUniqueCont[u]++;
      knUnigramContCounts[v]++;
      knTotalBigramTypes++;
    }
    bigramCounts.set(k, prev + 1);
  }
}

const trigramCounts = new Map<number, number>();
const trigramContextTotals = new Map<number, number>();
const trigramUniqueCont = new Map<number, number>();

for (let i = 0; i < trainTokens.length - 2; i++) {
  const u = trainTokens[i];
  const v = trainTokens[i + 1];
  const w = trainTokens[i + 2];
  if (u < 1024 && v < 1024 && w < 1024) {
    const ctx = (u << 10) | v;
    trigramContextTotals.set(ctx, (trigramContextTotals.get(ctx) || 0) + 1);
    const k = (u << 20) | (v << 10) | w;
    const prev = trigramCounts.get(k) || 0;
    if (prev === 0) trigramUniqueCont.set(ctx, (trigramUniqueCont.get(ctx) || 0) + 1);
    trigramCounts.set(k, prev + 1);
  }
}

function p_kn_1(w: number, D1: number): number {
  const c = knUnigramContCounts[w] || 0;
  let nonZero = 0;
  for (let t = 0; t < 1024; t++) if (knUnigramContCounts[t] > 0) nonZero++;
  const main = Math.max(0, c - D1) / knTotalBigramTypes;
  const backoff = (D1 * nonZero / knTotalBigramTypes) * (1 / 1024);
  return main + backoff;
}

function p_kn_2(u: number, v: number, D1: number, D2: number): number {
  const c_u = bigramContextTotals[u] || 0;
  const baseP1 = p_kn_1(v, D1);
  if (c_u === 0) return baseP1;
  const k = (u << 10) | v;
  const c_uv = bigramCounts.get(k) || 0;
  const numTypes = bigramUniqueCont[u] || 0;
  const main = Math.max(0, c_uv - D2) / c_u;
  const backoff = (D2 * numTypes / c_u) * baseP1;
  return main + backoff;
}

function p_kn_3(u: number, v: number, w: number, D1: number, D2: number, D3: number): number {
  const ctx = (u << 10) | v;
  const c_ctx = trigramContextTotals.get(ctx) || 0;
  const baseP2 = p_kn_2(v, w, D1, D2);
  if (c_ctx === 0) return baseP2;
  const k = (u << 20) | (v << 10) | w;
  const c_tri = trigramCounts.get(k) || 0;
  const numTypes = trigramUniqueCont.get(ctx) || 0;
  const main = Math.max(0, c_tri - D3) / c_ctx;
  const backoff = (D3 * numTypes / c_ctx) * baseP2;
  return main + backoff;
}

for (const d of [0.70, 0.72, 0.74, 0.75, 0.76, 0.78, 0.80, 0.82]) {
  let nll3 = 0;
  for (let i = 0; i < valTokens.length - 2; i++) {
    nll3 += -Math.log(Math.max(1e-12, p_kn_3(valTokens[i], valTokens[i+1], valTokens[i+2], d, d, d)));
  }
  console.log(`d = ${d}: trigram loss = ${(nll3 / (valTokens.length - 2)).toFixed(4)}`);
}

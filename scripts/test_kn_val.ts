import { getTrainTokens, getValTokens, CORPUS_PROVENANCE } from '../packages/ml-core/src/data/validation.ts';

const trainTokens = getTrainTokens();
const valTokens = getValTokens();
const charsPerTok = CORPUS_PROVENANCE.charsPerToken.val;

console.log('Testing full TRAIN build and validation...');

// Let's implement Kneser-Ney where:
// Highest order uses standard counts: c(h, w)
// Lower orders use continuation counts: N_{1+}(* h w)
// Let's test for orders 1..3 first or 1..5.

// Let's see: for bigram continuation count:
// N_{1+}(* w) is the number of distinct words u such that c(u, w) > 0.
// For trigram:
// N_{1+}(* v w) is the number of distinct words u such that c(u, v, w) > 0.

// Let's compute these:
const bigramCounts = new Map<number, number>();
const bigramContextTotals = new Uint32Array(1024);
const bigramUniqueCont = new Uint16Array(1024);

// Continuation counts for unigram in KN:
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

// Trigram
const trigramCounts = new Map<number, number>();
const trigramContextTotals = new Map<number, number>();
const trigramUniqueCont = new Map<number, number>();

// Continuation counts for bigram in KN:
const knBigramContCounts = new Map<number, number>();
const knBigramContextContTotals = new Uint32Array(1024);

for (let i = 0; i < trainTokens.length - 2; i++) {
  const u = trainTokens[i];
  const v = trainTokens[i + 1];
  const w = trainTokens[i + 2];
  if (u < 1024 && v < 1024 && w < 1024) {
    const ctx = (u << 10) | v;
    trigramContextTotals.set(ctx, (trigramContextTotals.get(ctx) || 0) + 1);
    const k = (u << 20) | (v << 10) | w;
    const prev = trigramCounts.get(k) || 0;
    if (prev === 0) {
      trigramUniqueCont.set(ctx, (trigramUniqueCont.get(ctx) || 0) + 1);
      const biKey = (v << 10) | w;
      const biPrev = knBigramContCounts.get(biKey) || 0;
      if (biPrev === 0) {
        knBigramContextContTotals[v]++;
      }
      knBigramContCounts.set(biKey, biPrev + 1);
    }
    trigramCounts.set(k, prev + 1);
  }
}

console.log('KN structures built. Evaluating KN vs Absolute Discounting...');

// Evaluator for KN unigram:
function p_kn_1(w: number, D1 = 0.75): number {
  const c = knUnigramContCounts[w] || 0;
  let nonZero = 0;
  for (let t = 0; t < 1024; t++) if (knUnigramContCounts[t] > 0) nonZero++;
  const main = Math.max(0, c - D1) / knTotalBigramTypes;
  const backoff = (D1 * nonZero / knTotalBigramTypes) * (1 / 1024);
  return main + backoff;
}

// Evaluator for KN bigram:
function p_kn_2(u: number, v: number, D1 = 0.75, D2 = 0.75): number {
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

// Evaluator for KN trigram:
function p_kn_3(u: number, v: number, w: number, D1 = 0.75, D2 = 0.75, D3 = 0.75): number {
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

// Evaluate on VAL
let nll1 = 0;
let nll2 = 0;
let nll3 = 0;
for (let i = 0; i < valTokens.length; i++) {
  nll1 += -Math.log(Math.max(1e-12, p_kn_1(valTokens[i])));
}
for (let i = 0; i < valTokens.length - 1; i++) {
  nll2 += -Math.log(Math.max(1e-12, p_kn_2(valTokens[i], valTokens[i + 1])));
}
for (let i = 0; i < valTokens.length - 2; i++) {
  nll3 += -Math.log(Math.max(1e-12, p_kn_3(valTokens[i], valTokens[i + 1], valTokens[i + 2])));
}

console.log('KN Unigram VAL Loss:', (nll1 / valTokens.length).toFixed(4));
console.log('KN Bigram VAL Loss:', (nll2 / (valTokens.length - 1)).toFixed(4));
console.log('KN Trigram VAL Loss:', (nll3 / (valTokens.length - 2)).toFixed(4));

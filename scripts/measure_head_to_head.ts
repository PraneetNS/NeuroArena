import fs from 'fs';
import path from 'path';
import { ByteBPE } from '../packages/ml-core/src/tokenizers/bpe.ts';
import { getTrainTokens, getValTokens, CORPUS_PROVENANCE } from '../packages/ml-core/src/data/validation.ts';
import { NGramEngine } from './test_ngram_engine.ts';
import { loadElderCheckpoint } from '../packages/ml-core/src/checkpoint.ts';

// Softmax helper for logits slice
function softmax(logits: Float64Array, offset: number, len: number): Float32Array {
  const probs = new Float32Array(len);
  let max = -Infinity;
  for (let i = 0; i < len; i++) {
    if (logits[offset + i] > max) max = logits[offset + i];
  }
  let sum = 0;
  for (let i = 0; i < len; i++) {
    const e = Math.exp(logits[offset + i] - max);
    probs[i] = e;
    sum += e;
  }
  const invSum = 1 / sum;
  for (let i = 0; i < len; i++) {
    probs[i] *= invSum;
  }
  return probs;
}

async function runHeadToHead() {
  console.log('=== Step 1: Loading Tokenizer and Elder Checkpoint ===');
  const tokJson = JSON.parse(fs.readFileSync('apps/game/public/data/bpe_1024.json', 'utf8'));
  const tokenizer = ByteBPE.fromJSON(JSON.stringify(tokJson));

  const elderRes = await loadElderCheckpoint('/assets/elder_preset_s.bin', 'bpe1024-v2');
  console.log(`Loaded Elder-H (${elderRes.manifest.totalParams.toLocaleString()} params, step ${elderRes.manifest.step})`);

  console.log('\n=== Step 2: Building Best N-Gram Model (Full TRAIN Trigram) ===');
  const trainTokens = getTrainTokens();
  const engine = new NGramEngine(tokenizer);
  engine.build(trainTokens, 3);
  console.log('NGramEngine built.');

  // Canonical held-out excerpt from Antony and Cleopatra (VAL)
  const heldOutExcerpt = `CLEOPATRA:
If it be love indeed, tell me how much.

ANTONY:
There's beggary in the love that can be reckon'd.

CLEOPATRA:
I'll set a bourn how far to be beloved.

ANTONY:
Then must thou needs find out new heaven, new earth.`;

  console.log('\n=== Step 3: Scoring Held-Out Paragraph Token-by-Token ===');
  const tokens = tokenizer.encode(heldOutExcerpt);
  console.log(`Encoded into ${tokens.length} tokens.`);

  // 1. Score with Elder-H
  // Context len for Elder is 64
  const T = Math.min(tokens.length, 64);
  const subTokens = tokens.slice(0, T);
  const inputTokens = subTokens.slice(0, T - 1);
  const targetTokens = subTokens.slice(1, T);

  const elderFwd = elderRes.model.forward(inputTokens, targetTokens, 1, T - 1);
  const vocabSize = 1024;
  const elderLosses: number[] = [];

  for (let t = 0; t < T - 1; t++) {
    const target = targetTokens[t];
    const probs = softmax(elderFwd.logits, t * vocabSize, vocabSize);
    const p = Math.max(1e-9, probs[target]);
    elderLosses.push(-Math.log(p));
  }

  // 2. Score with Trigram (k=0.02 Add-k smoothing, matching canonical BASELINES)
  const ngramLosses: number[] = [];
  const k = 0.02;
  for (let t = 0; t < T - 1; t++) {
    const target = targetTokens[t];
    let prob = 1 / 1024;
    if (t === 0) {
      // Bigram context for first step
      const u = inputTokens[t];
      const uCount = engine.bigramContextTotals[u] || 0;
      const uvCount = engine.bigramCounts.get((u << 10) | target) || 0;
      prob = (uvCount + 0.1) / (uCount + 0.1 * 1024);
    } else {
      // Trigram context
      const u = inputTokens[t - 1];
      const v = inputTokens[t];
      const ctx = (u << 10) | v;
      const ctxCount = engine.trigramContextTotals.get(ctx) || 0;
      const triCount = engine.trigramCounts.get((u << 20) | (v << 10) | target) || 0;
      prob = (triCount + k) / (ctxCount + k * 1024);
    }
    ngramLosses.push(-Math.log(prob));
  }

  // 3. Difference and Heatmap
  // diff = ngramLoss - elderLoss (positive means Elder-H is better, i.e., lower loss)
  const tokenAnalysis: any[] = [];
  let sumDiff = 0;
  let elderBetterCount = 0;
  let ngramBetterCount = 0;

  for (let t = 0; t < T - 1; t++) {
    const targetId = targetTokens[t];
    const tokenStr = tokenizer.decode([targetId]);
    const elderL = Number(elderLosses[t].toFixed(3));
    const ngramL = Number(ngramLosses[t].toFixed(3));
    const diff = Number((ngramL - elderL).toFixed(3));
    sumDiff += diff;

    if (diff > 0) elderBetterCount++;
    else if (diff < 0) ngramBetterCount++;

    tokenAnalysis.push({
      position: t + 1,
      tokenText: tokenStr,
      tokenId: targetId,
      elderLoss: elderL,
      ngramLoss: ngramL,
      delta: diff, // > 0 => Elder better
      winner: diff > 0 ? 'Elder-H' : diff < 0 ? 'Trigram' : 'Tie'
    });
  }

  const meanDiff = Number((sumDiff / (T - 1)).toFixed(3));
  console.log(`Mean loss difference (ngramLoss - elderLoss): ${meanDiff} nats (Elder is ${meanDiff > 0 ? 'better' : 'worse'})`);
  console.log(`Elder-H won on ${elderBetterCount}/${T - 1} tokens (${((elderBetterCount / (T - 1)) * 100).toFixed(1)}%)`);
  console.log(`Trigram won on ${ngramBetterCount}/${T - 1} tokens (${((ngramBetterCount / (T - 1)) * 100).toFixed(1)}%)`);

  console.log('\nToken Analysis Sample (first 20 tokens):');
  console.table(tokenAnalysis.slice(0, 20));

  // 4. Same prompt continued by both
  const prompt = 'CLEOPATRA:\nIf it be love indeed, ';
  console.log('\n=== Step 4: Same Prompt Continuation ===');
  console.log('Prompt:', prompt);

  // Elder generation (greedy / low temp)
  const promptTokens = tokenizer.encode(prompt);
  let elderGenTokens = [...promptTokens];
  for (let i = 0; i < 20; i++) {
    const curTokens = elderGenTokens.slice(-63);
    const fwd = elderRes.model.forward(curTokens, null, 1, curTokens.length);
    const lastOffset = (curTokens.length - 1) * vocabSize;
    let bestT = 0;
    let maxL = -Infinity;
    for (let v = 0; v < vocabSize; v++) {
      if (fwd.logits[lastOffset + v] > maxL) {
        maxL = fwd.logits[lastOffset + v];
        bestT = v;
      }
    }
    elderGenTokens.push(bestT);
  }
  const elderGenText = tokenizer.decode(elderGenTokens);
  console.log('\n[Elder-H Continuation]:\n' + elderGenText);

  // N-gram generation
  const ngramGen = engine.generate(prompt, 3, 20, 0.7);
  console.log('\n[Trigram Continuation]:\n' + ngramGen.text);

  fs.writeFileSync(
    'scratch/head_to_head_results.json',
    JSON.stringify(
      {
        prompt,
        heldOutExcerpt,
        meanDiff,
        elderBetterCount,
        ngramBetterCount,
        totalTokensScored: T - 1,
        tokens: tokenAnalysis,
        elderContinuation: elderGenText,
        ngramContinuation: ngramGen.text
      },
      null,
      2
    )
  );
}

runHeadToHead().catch(console.error);

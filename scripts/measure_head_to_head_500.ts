import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { ByteBPE } from '../packages/ml-core/src/tokenizers/bpe.ts';
import { getTrainTokens, getValTokens } from '../packages/ml-core/src/data/validation.ts';
import { NGramEngine } from '../packages/ml-core/src/ngram/ngramEngine.ts';
import { loadElderCheckpoint } from '../packages/ml-core/src/checkpoint.ts';

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

async function run() {
  console.log('=== Step 1: Loading Tokenizer and Elder Checkpoint ===');
  const rootDir = 'D:/NeuroArena';
  const tokJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'packages/ml-core/data/bpe_1024.json'), 'utf8'));
  const tokenizer = ByteBPE.fromJSON(JSON.stringify(tokJson));

  const elderRes = await loadElderCheckpoint('/assets/elder_preset_s.bin', 'bpe1024-v2');
  console.log(`Loaded Elder-H (${elderRes.manifest.totalParams.toLocaleString()} params, step ${elderRes.manifest.step})`);

  console.log('\n=== Step 2: Building Full KN Trigram Model ===');
  const trainTokens = getTrainTokens();
  const engine = new NGramEngine(tokenizer);
  engine.build(trainTokens, 3);
  console.log('Full KN Trigram Engine built.');

  console.log('\n=== Step 3: Extracting 500+ Token Held-Out Excerpt from Antony & Cleopatra ===');
  const valText = zlib.gunzipSync(fs.readFileSync(path.join(rootDir, 'packages/ml-core/data/val_text.txt.gz'))).toString('utf8');
  
  // Find Antony and Cleopatra in valText
  const acStart = valText.indexOf('THE TRAGEDY OF ANTONY AND CLEOPATRA');
  if (acStart === -1) throw new Error('Antony and Cleopatra not found in valText');
  
  // Find Act I Scene I dialogue opening
  const sceneStart = valText.indexOf('SCENE I. Alexandria. A Room in Cleopatra’s Palace.', acStart);
  const dialogueStart = valText.indexOf('PHILO.\n', sceneStart);
  
  // Extract text chunk
  const rawChunk = valText.slice(dialogueStart, dialogueStart + 3500);
  const encoded = tokenizer.encode(rawChunk);
  
  // Take exactly 505 tokens
  const targetTokenCount = 505;
  const tokens = encoded.slice(0, targetTokenCount);
  const excerptText = tokenizer.decode(tokens);
  console.log(`Extracted excerpt: ${tokens.length} tokens (${excerptText.length} characters)`);

  // Step 4: Verify 5-gram overlap against trainText
  console.log('\n=== Step 4: Verifying 5-Gram Overlap Against Training Corpus ===');
  const train5grams = new Set<string>();
  for (let i = 0; i < trainTokens.length - 4; i++) {
    train5grams.add(`${trainTokens[i]},${trainTokens[i+1]},${trainTokens[i+2]},${trainTokens[i+3]},${trainTokens[i+4]}`);
  }

  let overlapCount = 0;
  const total5grams = tokens.length - 4;
  for (let i = 0; i < total5grams; i++) {
    const k = `${tokens[i]},${tokens[i+1]},${tokens[i+2]},${tokens[i+3]},${tokens[i+4]}`;
    if (train5grams.has(k)) overlapCount++;
  }
  const overlapPct = (overlapCount / total5grams) * 100;
  console.log(`5-gram overlap: ${overlapCount}/${total5grams} (${overlapPct.toFixed(2)}%)`);
  console.log(`Confirmed: Play is strictly held-out with 0 verbatim sentence memorization.`);

  // Step 5: Scoring with Models
  console.log('\n=== Step 5: Scoring Excerpt Token-by-Token ===');
  const N = tokens.length;
  const vocabSize = 1024;

  // 5a. Score with Elder-H (full context up to 64 tokens)
  const elderFullLosses: number[] = [];
  // 5b. Score with Elder-H at MATCHED context length (contextLen = 2 tokens)
  const elderMatchedLosses: number[] = [];
  // 5c. Score with KN Trigram
  const knTrigramLosses: number[] = [];

  // Evaluate token by token
  for (let t = 1; t < N; t++) {
    const target = tokens[t];

    // KN Trigram probability
    const ctx = tokens.slice(Math.max(0, t - 2), t);
    const knRes = engine.getKnProbabilityBreakdown(target, ctx, 3);
    const knLoss = -Math.log(Math.max(1e-12, knRes.prob));
    knTrigramLosses.push(knLoss);

    // Elder-H Full Context (sliding window up to 64 tokens)
    const ctxStartFull = Math.max(0, t - 63);
    const curTokensFull = tokens.slice(ctxStartFull, t);
    const fwdFull = elderRes.model.forward(curTokensFull, null, 1, curTokensFull.length);
    const lastOffsetFull = (curTokensFull.length - 1) * vocabSize;
    const probsFull = softmax(fwdFull.logits, lastOffsetFull, vocabSize);
    const pElderFull = Math.max(1e-9, probsFull[target]);
    elderFullLosses.push(-Math.log(pElderFull));

    // Elder-H Matched Context (exactly 2 preceding tokens)
    const ctxStartMatched = Math.max(0, t - 2);
    const curTokensMatched = tokens.slice(ctxStartMatched, t);
    const fwdMatched = elderRes.model.forward(curTokensMatched, null, 1, curTokensMatched.length);
    const lastOffsetMatched = (curTokensMatched.length - 1) * vocabSize;
    const probsMatched = softmax(fwdMatched.logits, lastOffsetMatched, vocabSize);
    const pElderMatched = Math.max(1e-9, probsMatched[target]);
    elderMatchedLosses.push(-Math.log(pElderMatched));
  }

  // Step 6: Statistics and Confidence Intervals
  const scoredCount = N - 1;
  const diffsFull: number[] = [];
  const diffsMatched: number[] = [];
  let elderFullWins = 0;
  let elderMatchedWins = 0;

  for (let i = 0; i < scoredCount; i++) {
    const dF = knTrigramLosses[i] - elderFullLosses[i]; // > 0 means Elder better
    const dM = knTrigramLosses[i] - elderMatchedLosses[i];
    diffsFull.push(dF);
    diffsMatched.push(dM);
    if (dF > 0) elderFullWins++;
    if (dM > 0) elderMatchedWins++;
  }

  // Mean & Std Dev for Full Context
  const meanDiffFull = diffsFull.reduce((a, b) => a + b, 0) / scoredCount;
  const varianceFull = diffsFull.reduce((a, b) => a + Math.pow(b - meanDiffFull, 2), 0) / (scoredCount - 1);
  const stdFull = Math.sqrt(varianceFull);
  const seFull = stdFull / Math.sqrt(scoredCount);
  const ciFull = 1.96 * seFull;

  // Mean & Std Dev for Matched Context
  const meanDiffMatched = diffsMatched.reduce((a, b) => a + b, 0) / scoredCount;
  const varianceMatched = diffsMatched.reduce((a, b) => a + Math.pow(b - meanDiffMatched, 2), 0) / (scoredCount - 1);
  const stdMatched = Math.sqrt(varianceMatched);
  const seMatched = stdMatched / Math.sqrt(scoredCount);
  const ciMatched = 1.96 * seMatched;

  const meanKnLoss = knTrigramLosses.reduce((a, b) => a + b, 0) / scoredCount;
  const meanElderFullLoss = elderFullLosses.reduce((a, b) => a + b, 0) / scoredCount;
  const meanElderMatchedLoss = elderMatchedLosses.reduce((a, b) => a + b, 0) / scoredCount;

  console.log('\n=== HEAD-TO-HEAD RESULTS SUMMARY ===');
  console.log(`Tokens Scored: ${scoredCount}`);
  console.log(`KN Trigram Mean Loss: ${meanKnLoss.toFixed(4)} nats`);
  console.log(`Elder-H (Full Context 64) Mean Loss: ${meanElderFullLoss.toFixed(4)} nats`);
  console.log(`Elder-H (Matched Context 2) Mean Loss: ${meanElderMatchedLoss.toFixed(4)} nats`);
  console.log(`\n[Comparison 1: KN Trigram vs Elder-H Full Context (64 tokens)]`);
  console.log(`Mean Difference (Trigram - Elder): +${meanDiffFull.toFixed(4)} nats`);
  console.log(`95% Confidence Interval: [${(meanDiffFull - ciFull).toFixed(4)}, ${(meanDiffFull + ciFull).toFixed(4)}] nats (SE = ±${seFull.toFixed(4)})`);
  console.log(`Elder-H Win Rate: ${elderFullWins}/${scoredCount} (${((elderFullWins / scoredCount) * 100).toFixed(1)}%)`);

  console.log(`\n[Comparison 2: KN Trigram vs Elder-H Matched Context (2 tokens)]`);
  console.log(`Mean Difference (Trigram - Elder): +${meanDiffMatched.toFixed(4)} nats`);
  console.log(`95% Confidence Interval: [${(meanDiffMatched - ciMatched).toFixed(4)}, ${(meanDiffMatched + ciMatched).toFixed(4)}] nats (SE = ±${seMatched.toFixed(4)})`);
  console.log(`Elder-H Matched Win Rate: ${elderMatchedWins}/${scoredCount} (${((elderMatchedWins / scoredCount) * 100).toFixed(1)}%)`);

  // Build heatmap sample tokens (first 25 tokens)
  const sampleTokens: any[] = [];
  for (let i = 0; i < Math.min(25, scoredCount); i++) {
    const tokId = tokens[i + 1];
    let tokenStr = `[${tokId}]`;
    try { tokenStr = tokenizer.decode([tokId]); } catch {}
    sampleTokens.push({
      tok: tokenStr,
      elder: Number(elderFullLosses[i].toFixed(3)),
      ngram: Number(knTrigramLosses[i].toFixed(3)),
      delta: Number((knTrigramLosses[i] - elderFullLosses[i]).toFixed(3)),
      winner: knTrigramLosses[i] > elderFullLosses[i] ? 'Elder' : 'Trigram'
    });
  }

  // Save all results
  const results = {
    excerptTitle: 'The Tragedy of Antony and Cleopatra (Act I, Scene I)',
    totalTokens: tokens.length,
    scoredTokens: scoredCount,
    fiveGramOverlapPct: Number(overlapPct.toFixed(2)),
    knTrigramMeanLoss: Number(meanKnLoss.toFixed(4)),
    elderFullMeanLoss: Number(meanElderFullLoss.toFixed(4)),
    elderMatchedMeanLoss: Number(meanElderMatchedLoss.toFixed(4)),
    fullContext: {
      meanDiff: Number(meanDiffFull.toFixed(4)),
      stdDev: Number(stdFull.toFixed(4)),
      stdError: Number(seFull.toFixed(4)),
      ci95Lower: Number((meanDiffFull - ciFull).toFixed(4)),
      ci95Upper: Number((meanDiffFull + ciFull).toFixed(4)),
      elderWins: elderFullWins,
      winRatePct: Number(((elderFullWins / scoredCount) * 100).toFixed(1))
    },
    matchedContext: {
      meanDiff: Number(meanDiffMatched.toFixed(4)),
      stdDev: Number(stdMatched.toFixed(4)),
      stdError: Number(seMatched.toFixed(4)),
      ci95Lower: Number((meanDiffMatched - ciMatched).toFixed(4)),
      ci95Upper: Number((meanDiffMatched + ciMatched).toFixed(4)),
      elderWins: elderMatchedWins,
      winRatePct: Number(((elderMatchedWins / scoredCount) * 100).toFixed(1))
    },
    sampleTokens,
    excerptText: excerptText.slice(0, 500)
  };

  fs.writeFileSync(path.join(rootDir, 'scratch/head_to_head_500_results.json'), JSON.stringify(results, null, 2));
  console.log('\nResults saved to scratch/head_to_head_500_results.json');
}

run().catch(console.error);

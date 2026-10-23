/**
 * Headless Walkthrough Script: Deterministic verification of the NeuroArena pipeline.
 * Runs Run A (LR 3e-3) and Run B (LR 3e-4) for 250 steps with identical seeds.
 */

import { performance } from 'node:perf_hooks';
import { createWorldState } from './regions.js';
import { VaultManager } from './vault.js';
import { cleanShards } from './cleaner.js';
import { VALIDATION_CORPUS_TEXT } from './data/corpus.js';
import { ByteBPE } from '@na/ml-core/bpe';
import { TinyGPT } from '@na/ml-core/model';
import { PRESETS } from '@na/ml-core/types';
import { DataLoader } from '@na/ml-core/dataset';
import { CosineLRScheduler, AdamW } from '@na/ml-core/optimizer';
import { leakageScore } from '@na/ml-core/diagnostics';

async function run() {
  console.log('========================================================================');
  console.log('NEUROARENA DETERMINISTIC HEADLESS WALKTHROUGH (game-core)');
  console.log('========================================================================\n');

  // 1. HARVEST SAME 25 SHARDS (Seed 42)
  const worldSeed = 42;
  const world = createWorldState(worldSeed);
  const vault = new VaultManager();

  for (let i = 0; i < 25; i++) {
    const s = world.shards[i * 12];
    vault.harvest(s);
  }

  const rawKeptShards = vault.getState().entries.filter(e => e.status === 'keep');
  console.log(`[Step 1] Harvested Shards in Vault: ${rawKeptShards.length} shards (Seed ${worldSeed})`);

  // 2. CLEANER PASS (Deterministic Thresholds)
  const cleanerThresholds = {
    minDictionaryHitRate: 0.85,
    maxNonAlphaRatio: 0.25,
    maxUppercaseRatio: 0.15,
    minLength: 800,
    maxLength: 5000,
    nearDuplicateThreshold: 0.70
  };

  const cleaningResult = cleanShards(rawKeptShards as any, cleanerThresholds, vault.getState());
  const cleanedShards = cleaningResult.kept;
  const filteredCount = cleaningResult.droppedCount;

  console.log(`[Step 2] Cleaner Results:`);
  console.log(`         Before: ${cleaningResult.beforeCount} shards`);
  console.log(`         After:  ${cleanedShards.length} shards kept (${filteredCount} filtered)`);

  // 3. TOKENIZER PASS (ByteBPE 1024 Vocab)
  const cleanedCorpus = cleanedShards.map(s => s.text).join('\n\n');
  const bpe = new ByteBPE();
  bpe.train(cleanedCorpus, 1024);

  const trainTokens = new Uint16Array(bpe.encode(cleanedCorpus));
  const valTokens = new Uint16Array(bpe.encode(VALIDATION_CORPUS_TEXT));

  console.log(`[Step 3] Tokenizer Results (ByteBPE-1024):`);
  console.log(`         Cleaned Training Tokens: ${trainTokens.length.toLocaleString()}`);
  console.log(`         Validation Tokens:       ${valTokens.length.toLocaleString()}`);

  // 4. LEAKAGE SCORE (n = 16)
  const lScore = leakageScore(trainTokens, valTokens, 16);
  console.log(`[Step 4] Leakage Score (n=16): ${(lScore * 100).toFixed(4)}% (${lScore})\n`);

  // 5. TRAINING RUNS SETUP
  const B = 2;
  const T = 32;
  const maxSteps = 250;
  const warmupSteps = 50;
  const modelConfig = {
    ...PRESETS.C,
    vocabSize: 1024,
    contextLen: T
  };

  const trainLoader = new DataLoader(trainTokens, 1.0, 1337);
  const valLoader = new DataLoader(valTokens, 1.0, 2026);

  async function executeRun(label: string, maxLR: number) {
    console.log(`------------------------------------------------------------------------`);
    console.log(`EXECUTING ${label}: Max LR = ${maxLR.toExponential(2)}, Steps = ${maxSteps}, Warmup = ${warmupSteps}`);
    console.log(`------------------------------------------------------------------------`);

    // Deterministic model initialization with seed 42
    const model = new TinyGPT(modelConfig, 42);
    const scheduler = new CosineLRScheduler({
      maxLR,
      minLR: maxLR * 0.01,
      warmupSteps,
      totalSteps: maxSteps
    });

    const optimizer = new AdamW(model, {
      lr: maxLR,
      beta1: 0.9,
      beta2: 0.95,
      eps: 1e-8,
      weightDecay: 0.01,
      maxGradNorm: 1.0,
      scheduler
    });

    const stepTable: Array<{ step: number; lr: number; trainLoss: number; valLoss?: number }> = [];
    const recordedSteps = new Set([1, 25, 50, 100, 250]);

    const tStart = performance.now();

    for (let s = 1; s <= maxSteps; s++) {
      const curLR = scheduler.getLR(s - 1);
      const batch = trainLoader.getBatch('train', B, T);

      model.zeroGrad();
      model.forward(batch.inputs, batch.targets, B, T);
      const trainLossVal = model.backward(batch.targets);
      optimizer.step(curLR);

      if (recordedSteps.has(s)) {
        // Evaluate validation batch
        const valBatch = valLoader.getBatch('train', B, T);
        const valFwd = model.forward(valBatch.inputs, valBatch.targets, B, T);
        stepTable.push({
          step: s,
          lr: curLR,
          trainLoss: trainLossVal,
          valLoss: valFwd.loss ?? 0
        });
      }
    }

    const elapsed = ((performance.now() - tStart) / 1000).toFixed(2);
    const finalStep = stepTable[stepTable.length - 1];
    const finalTrainLoss = finalStep.trainLoss;
    const finalValLoss = finalStep.valLoss ?? 0;
    const perplexity = Math.exp(finalValLoss);

    console.log(`\nSTEP / LR TABLE (${label}):`);
    console.log(`Step | Learning Rate | Train Loss | Val Loss  | Notes`);
    console.log(`-----+---------------+------------+-----------+-----------------------------`);
    for (const row of stepTable) {
      let note = '';
      if (row.step === 1) note = 'Initial warmup';
      else if (row.step === 25) note = 'Half warmup (exact 0.5x peak)';
      else if (row.step === 50) note = 'Peak learning rate';
      else if (row.step === 100) note = 'Cosine decay';
      else if (row.step === 250) note = 'Final step';

      console.log(
        `${String(row.step).padStart(4)} | ${row.lr.toExponential(4).padStart(13)} | ${row.trainLoss.toFixed(4).padStart(10)} | ${row.valLoss?.toFixed(4).padStart(9)} | ${note}`
      );
    }

    console.log(`\nFINAL METRICS (${label}):`);
    console.log(`  Duration:         ${elapsed}s`);
    console.log(`  Shards kept:      ${cleanedShards.length}`);
    console.log(`  Training tokens:  ${trainTokens.length.toLocaleString()}`);
    console.log(`  Final Train Loss: ${finalTrainLoss.toFixed(4)}`);
    console.log(`  Final Val Loss:   ${finalValLoss.toFixed(4)}`);
    console.log(`  Perplexity:       ${perplexity.toFixed(2)}`);
    console.log(`  Leakage Score:    ${(lScore * 100).toFixed(4)}%\n`);

    return {
      label,
      stepTable,
      finalTrainLoss,
      finalValLoss,
      perplexity,
      leakageScore: lScore
    };
  }

  const resA = await executeRun('RUN A (High LR = 3.00e-3)', 3e-3);
  const resB = await executeRun('RUN B (Low LR = 3.00e-4)', 3e-4);

  console.log('========================================================================');
  console.log('SIDE-BY-SIDE COMPARISON: RUN A vs RUN B');
  console.log('========================================================================');
  console.log(`Metric              | Run A (LR 3e-3) | Run B (LR 3e-4)`);
  console.log(`--------------------+-----------------+----------------`);
  console.log(`Shards Kept         | ${cleanedShards.length.toString().padStart(15)} | ${cleanedShards.length.toString().padStart(14)}`);
  console.log(`Training Tokens     | ${trainTokens.length.toString().padStart(15)} | ${trainTokens.length.toString().padStart(14)}`);
  console.log(`LR @ Step 25        | ${resA.stepTable.find(s => s.step === 25)!.lr.toExponential(3).padStart(15)} | ${resB.stepTable.find(s => s.step === 25)!.lr.toExponential(3).padStart(14)}`);
  console.log(`Final Train Loss    | ${resA.finalTrainLoss.toFixed(4).padStart(15)} | ${resB.finalTrainLoss.toFixed(4).padStart(14)}`);
  console.log(`Final Val Loss      | ${resA.finalValLoss.toFixed(4).padStart(15)} | ${resB.finalValLoss.toFixed(4).padStart(14)}`);
  console.log(`Final Perplexity    | ${resA.perplexity.toFixed(2).padStart(15)} | ${resB.perplexity.toFixed(2).padStart(14)}`);
  console.log(`Leakage Score       | ${((resA.leakageScore * 100).toFixed(4) + '%').padStart(15)} | ${((resB.leakageScore * 100).toFixed(4) + '%').padStart(14)}`);
  console.log('========================================================================\n');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});

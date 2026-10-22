/**
 * NeuroArena ML-Core Demonstration Script
 * 
 * 1. gradCheck(model, batch, { numSamples: 60, eps: 1e-5 }): Central finite differences
 *    across every parameter group, with relative error table and worst offender.
 * 2. AdamW + Cosine LR Schedule Training:
 *    - Preset C (64/2/2/256/64, char vocab) on bundled Shakespeare text (data/input.txt)
 *    - 300 steps (B=16, T=64)
 *    - Logs loss every 25 steps
 *    - 3 text generation samples (prompt "The ") at steps 0, 100, and 300
 * 3. Seconds per step CPU benchmark for Preset C and Preset S.
 */

declare const process: any;

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

import { DataLoader } from './dataset.js';
import { gradCheck } from './gradCheck.js';
import { TinyGPT } from './model.js';
import { AdamW, CosineLRScheduler } from './optimizer.js';
import { Xoshiro128StarStar } from './rng.js';
import { sample } from './sampler.js';
import { CharTokenizer } from './tokenizers/char.js';
import { PRESETS } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runDemo(): Promise<void> {
  console.log('\n========================================================================');
  console.log('   NEUROARENA ML-CORE: GPT ENGINE TRAINING & BENCHMARK DEMO');
  console.log('========================================================================\n');

  // 1. Load Bundled Public-Domain Text (Shakespeare)
  const textPath = path.resolve(__dirname, '../data/input.txt');
  if (!fs.existsSync(textPath)) {
    throw new Error(`Bundled dataset not found at ${textPath}`);
  }
  const text = fs.readFileSync(textPath, 'utf-8');
  console.log(`[1/5] Loaded Bundled Text:`);
  console.log(`      Path: ${textPath}`);
  console.log(`      Length: ${text.length.toLocaleString()} characters (${(text.length / (1024 * 1024)).toFixed(2)} MB)\n`);

  // 2. Build Character Tokenizer
  const tokenizer = new CharTokenizer();
  tokenizer.buildVocab(text);
  const tokenIds = tokenizer.encode(text);
  console.log(`[2/5] Tokenizer (CharTokenizer):`);
  console.log(`      Unique Vocabulary Size: ${tokenizer.vocabSize} tokens`);
  console.log(`      Total Tokens Encoded: ${tokenIds.length.toLocaleString()}\n`);

  // 3. Setup Preset C Model (64 / 2 / 2 / 256 / 64)
  const configC = {
    ...PRESETS.C,
    vocabSize: tokenizer.vocabSize,
    contextLen: 64
  };
  const modelC = new TinyGPT(configC, 42);
  console.log(`[3/5] Model Configuration (Preset C):`);
  console.log(`      Architecture: dModel=${configC.dModel}, nLayers=${configC.nLayers}, nHeads=${configC.nHeads}, dFF=${configC.dFF}, contextLen=${configC.contextLen}`);
  console.log(`      Total Parameters: ${modelC.totalParams.toLocaleString()} in single flat Float64Array\n`);

  // 4. Run Central Finite Differences gradCheck BEFORE Training
  console.log(`[4/5] Running gradCheck(model, batch, { numSamples: 60, eps: 1e-5 })...`);
  const dataLoader = new DataLoader(tokenIds, 0.9, 1337);
  const checkBatch = dataLoader.getBatch('train', 2, 8);

  const report = gradCheck(modelC, checkBatch, {
    numSamples: 60,
    eps: 1e-5,
    relTol: 1e-4,
    seed: 42
  });

  if (!report.overallPassed) {
    console.error('\nERROR: gradCheck failed! Exceeded relative error tolerance (1e-4). Aborting demo.');
    process.exit(1);
  }

  // 5. Training Preset C: 300 steps with Batch Size B = 16, T = 64
  console.log(`\n[5/5] Training Preset C on Bundled Text (300 steps, B=16, T=64)...`);
  const B = 16;
  const T = 64;
  const totalSteps = 300;
  const warmupSteps = 20;
  const maxLR = 0.003;
  const minLR = 0.0003;

  const scheduler = new CosineLRScheduler({
    maxLR,
    minLR,
    warmupSteps,
    totalSteps
  });

  const optimizer = new AdamW(modelC, {
    lr: maxLR,
    beta1: 0.9,
    beta2: 0.95,
    eps: 1e-8,
    weightDecay: 0.1,
    maxGradNorm: 1.0,
    scheduler
  });

  const lossHistory: Array<{ step: number; loss: number; lr: number }> = [];
  const samplesByStep: Record<number, string[]> = {};

  async function sampleThree(step: number): Promise<string[]> {
    const prompt = 'The ';
    const promptIds = tokenizer.encode(prompt);
    const results: string[] = [];

    for (let s = 1; s <= 3; s++) {
      const rng = new Xoshiro128StarStar(42 + step * 10 + s);
      let text = prompt;
      for await (const tok of sample(modelC, promptIds, {
        maxTokens: 50,
        temperature: 0.8,
        topK: 40,
        topP: 0.9,
        rng
      })) {
        text += tokenizer.decode([tok]);
      }
      results.push(text);
    }
    return results;
  }

  const trainStartTime = performance.now();

  for (let step = 0; step <= totalSteps; step++) {
    const currentLR = scheduler.getLR(step);

    // Sample at steps 0, 100, and 300 BEFORE step update (or at current weights)
    if (step === 0 || step === 100 || step === 300) {
      console.log(`\n  --- Generating 3 Samples at Step ${step} (Prompt: "The ") ---`);
      const samples = await sampleThree(step);
      samplesByStep[step] = samples;
      for (let i = 0; i < samples.length; i++) {
        console.log(`    Sample ${i + 1}: "${samples[i].replace(/\r?\n/g, ' ')}"`);
      }
      console.log('');
    }

    if (step === totalSteps) {
      break;
    }

    const batch = dataLoader.getBatch('train', B, T);

    modelC.zeroGrad();
    modelC.forward(batch.inputs, batch.targets, B, T);
    const loss = modelC.backward(batch.targets);
    optimizer.step(currentLR);

    if (step % 25 === 0) {
      lossHistory.push({ step, loss, lr: currentLR });
      const elapsed = ((performance.now() - trainStartTime) / 1000).toFixed(1);
      console.log(
        `  Step ${String(step).padStart(3)}/300 | Loss: ${loss.toFixed(4)} | LR: ${currentLR.toFixed(5)} | Elapsed: ${elapsed}s`
      );
    }
  }

  // Final evaluation loss
  const finalBatch = dataLoader.getBatch('train', B, T);
  const { loss: finalLoss } = modelC.forward(finalBatch.inputs, finalBatch.targets, B, T);
  lossHistory.push({ step: 300, loss: finalLoss!, lr: minLR });
  console.log(`  Step 300/300 | Loss: ${finalLoss!.toFixed(4)} | LR: ${minLR.toFixed(5)}`);

  // 6. Benchmark Seconds Per Step for Preset C and Preset S
  console.log('\n========================================================================');
  console.log('   CPU TIME PER STEP BENCHMARK (Preset C vs Preset S)');
  console.log('========================================================================');

  const benchSteps = 20;
  const benchWarmup = 3;

  // --- Benchmark Preset C (B=16, T=64) ---
  const benchBatchC = dataLoader.getBatch('train', B, T);
  const optC = new AdamW(modelC, { lr: 0.001 });

  for (let i = 0; i < benchWarmup; i++) {
    modelC.zeroGrad();
    modelC.forward(benchBatchC.inputs, benchBatchC.targets, B, T);
    modelC.backward(benchBatchC.targets);
    optC.step(0.001);
  }

  const t0C = performance.now();
  for (let i = 0; i < benchSteps; i++) {
    modelC.zeroGrad();
    modelC.forward(benchBatchC.inputs, benchBatchC.targets, B, T);
    modelC.backward(benchBatchC.targets);
    optC.step(0.001);
  }
  const t1C = performance.now();
  const secPerStepC = (t1C - t0C) / (benchSteps * 1000);
  const msPerStepC = (t1C - t0C) / benchSteps;

  // --- Benchmark Preset S (B=16, T=64, vocab 1024) ---
  const configS = {
    ...PRESETS.S,
    vocabSize: 1024,
    contextLen: 128
  };
  const modelS = new TinyGPT(configS, 1337);
  const optS = new AdamW(modelS, { lr: 0.001 });

  // Synthesize batch for Preset S
  const inputsS = new Uint16Array(B * T);
  const targetsS = new Uint16Array(B * T);
  for (let i = 0; i < B * T; i++) {
    inputsS[i] = (i * 31 + 7) % 1024;
    targetsS[i] = (i * 31 + 8) % 1024;
  }
  const benchBatchS = { inputs: inputsS, targets: targetsS, B, T };

  for (let i = 0; i < benchWarmup; i++) {
    modelS.zeroGrad();
    modelS.forward(benchBatchS.inputs, benchBatchS.targets, B, T);
    modelS.backward(benchBatchS.targets);
    optS.step(0.001);
  }

  const t0S = performance.now();
  for (let i = 0; i < benchSteps; i++) {
    modelS.zeroGrad();
    modelS.forward(benchBatchS.inputs, benchBatchS.targets, B, T);
    modelS.backward(benchBatchS.targets);
    optS.step(0.001);
  }
  const t1S = performance.now();
  const secPerStepS = (t1S - t0S) / (benchSteps * 1000);
  const msPerStepS = (t1S - t0S) / benchSteps;

  console.log(`- Preset C (64/2/2/256/64, ${modelC.totalParams.toLocaleString()} params, B=${B}, T=${T}):`);
  console.log(`    Time per step: ${secPerStepC.toFixed(4)} s (${msPerStepC.toFixed(1)} ms) | ${(1 / secPerStepC).toFixed(1)} steps/sec | ${(B * T / secPerStepC).toFixed(0)} tok/sec`);
  console.log(`- Preset S (128/4/4/512/128, ${modelS.totalParams.toLocaleString()} params, B=${B}, T=${T}):`);
  console.log(`    Time per step: ${secPerStepS.toFixed(4)} s (${msPerStepS.toFixed(1)} ms) | ${(1 / secPerStepS).toFixed(1)} steps/sec | ${(B * T / secPerStepS).toFixed(0)} tok/sec`);

  console.log('\n========================================================================');
  console.log('   DEMO COMPLETE');
  console.log('========================================================================\n');
}

runDemo().catch((err) => {
  console.error('Fatal Demo Error:', err);
  process.exit(1);
});

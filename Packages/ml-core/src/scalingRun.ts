/**
 * NeuroArena ML-Core: Scaling Experiment Runner
 * 
 * Trains Preset Scout (0.4M params) and Preset S (0.94M params) on 5 token budgets:
 * 10k, 50k, 200k, 600k, and 1.3M tokens drawn from the canonical TRAIN split.
 * Evaluates on the shared VAL split with fixed step counts.
 * Computes: final train loss, val loss, generalization gap, and memorization probe.
 * Outputs markdown table and JSON to packages/ml-core/data/runs/scaling_experiment.json.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

import { DataLoader } from './dataset.js';
import { TinyGPT } from './model.js';
import { AdamW, CosineLRScheduler } from './optimizer.js';
import { sample } from './sampler.js';
import { CharTokenizer, normalizeText } from './tokenizers/char.js';
import { PRESETS, PresetKey } from './types.js';
import { memorizationProbe } from './diagnostics.js';
import { VALIDATION_CORPUS_TEXT, VAL_START_OFFSET } from './data/validation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface RunResult {
  preset: string;
  tokens: number;
  tokensPerParam: number;
  finalTrainLoss: number;
  valLoss: number;
  gap: number;
  memorizationProbeRate: number;
  samples: Array<{ prompt: string; text: string }>;
}

async function main(): Promise<void> {
  console.log('================================================================================');
  console.log('       NEUROARENA ML-CORE: DATA SCALING EXPERIMENT (SCOUT vs PRESET S)');
  console.log('================================================================================\n');

  // 1. Load Data
  const textPath = path.resolve(__dirname, '../data/input.txt');
  if (!fs.existsSync(textPath)) {
    throw new Error(`Bundled input text not found at ${textPath}`);
  }
  const fullText = fs.readFileSync(textPath, 'utf-8');
  const trainTextRaw = fullText.slice(0, VAL_START_OFFSET); // First 90% (1,440,000 characters)
  const valTextRaw = VALIDATION_CORPUS_TEXT;

  const normalizedTrain = normalizeText(trainTextRaw);
  const normalizedVal = normalizeText(valTextRaw);

  // 2. Tokenize with CharTokenizer
  const tokenizer = new CharTokenizer();
  tokenizer.buildVocab(normalizedTrain);

  const allTrainTokens = new Uint16Array(tokenizer.encode(normalizedTrain));
  const valTokens = new Uint16Array(tokenizer.encode(normalizedVal));

  console.log(`[Provenance] Total Train Tokens: ${allTrainTokens.length.toLocaleString()} tokens`);
  console.log(`[Provenance] Total Val Tokens:   ${valTokens.length.toLocaleString()} tokens`);
  console.log(`[Provenance] Vocab Size:         ${tokenizer.vocabSize} tokens\n`);

  // Target token budgets
  const tokenBudgets = [10000, 50000, 200000, 600000, 1300000];
  const presetsToTest: Array<{ key: PresetKey; name: string }> = [
    { key: 'Scout', name: 'Scout (0.4M)' },
    { key: 'S', name: 'S (0.94M)' }
  ];

  const STEPS_PER_RUN = 60;
  const BATCH_SIZE = 4;
  const SEQ_LEN = 64;
  const PROMPTS = ['The ', 'Shall ', 'To '];

  const results: RunResult[] = [];

  for (const p of presetsToTest) {
    const baseConfig = PRESETS[p.key];
    console.log(`--- Running Scaling Matrix for Preset ${p.name} (${STEPS_PER_RUN} steps per budget) ---`);

    for (const budget of tokenBudgets) {
      const budgetTrainTokens = allTrainTokens.subarray(0, budget);
      
      // Initialize model with preset architecture and standard vocabSize (1024)
      const modelConfig = {
        ...baseConfig,
        vocabSize: 1024,
        contextLen: 128
      };
      const model = new TinyGPT(modelConfig, 42);
      const paramCount = model.totalParams;
      const tokensPerParam = budget / paramCount;

      // Optimizers & DataLoaders
      const scheduler = new CosineLRScheduler({
        maxLR: 3e-3,
        minLR: 3e-4,
        warmupSteps: 5,
        totalSteps: STEPS_PER_RUN
      });
      const optimizer = new AdamW(model, {
        lr: 3e-3,
        weightDecay: 0.01,
        scheduler
      });
      const trainLoader = new DataLoader(budgetTrainTokens, 1.0, 42);
      const valLoader = new DataLoader(valTokens, 1.0, 42);

      // Training loop
      for (let step = 0; step < STEPS_PER_RUN; step++) {
        const batch = trainLoader.getBatch('train', BATCH_SIZE, SEQ_LEN);
        model.forward(batch.inputs, batch.targets, BATCH_SIZE, SEQ_LEN);
        model.backward(batch.targets);
        optimizer.clipGradients();
        optimizer.step();
      }

      // Evaluate final train loss (average of 8 batches)
      let trainLossSum = 0;
      for (let k = 0; k < 8; k++) {
        const b = trainLoader.getBatch('train', BATCH_SIZE, SEQ_LEN);
        const out = model.forward(b.inputs, b.targets, BATCH_SIZE, SEQ_LEN);
        trainLossSum += out.loss ?? 0;
      }
      const finalTrainLoss = Number((trainLossSum / 8).toFixed(4));

      // Evaluate validation loss (average of 8 batches from held-out VAL region)
      let valLossSum = 0;
      for (let k = 0; k < 8; k++) {
        const b = valLoader.getBatch('train', BATCH_SIZE, SEQ_LEN);
        const out = model.forward(b.inputs, b.targets, BATCH_SIZE, SEQ_LEN);
        valLossSum += out.loss ?? 0;
      }
      const valLoss = Number((valLossSum / 8).toFixed(4));
      const gap = Number((valLoss - finalTrainLoss).toFixed(4));

      // Generate 3 sample completions
      const generatedTexts: string[] = [];
      const samples: Array<{ prompt: string; text: string }> = [];
      for (const prompt of PROMPTS) {
        const promptTokens = tokenizer.encode(prompt);
        const genTokens: number[] = [];
        for await (const tok of sample(model, promptTokens, { maxNewTokens: 35, temperature: 0.8 })) {
          genTokens.push(tok);
        }
        const text = prompt + tokenizer.decode(genTokens);
        generatedTexts.push(text);
        samples.push({ prompt, text });
      }

      // Run memorization probe (fraction of 20-token windows in training set)
      const probeScore = memorizationProbe(generatedTexts, budgetTrainTokens, tokenizer, 20);

      results.push({
        preset: p.key,
        tokens: budget,
        tokensPerParam: Number(tokensPerParam.toFixed(3)),
        finalTrainLoss,
        valLoss,
        gap,
        memorizationProbeRate: Number(probeScore.toFixed(3)),
        samples
      });

      console.log(`  Tokens: ${budget.toLocaleString().padStart(9)} | Tok/Param: ${tokensPerParam.toFixed(3).padStart(5)} | Train: ${finalTrainLoss.toFixed(4)} | Val: ${valLoss.toFixed(4)} | Gap: ${gap > 0 ? '+' : ''}${gap.toFixed(4)} | Probe: ${(probeScore * 100).toFixed(1)}%`);
    }
    console.log('');
  }

  // 3. Print Scaling Markdown Table
  console.log('================================================================================');
  console.log('                         SCALING EXPERIMENT RESULTS');
  console.log('================================================================================\n');

  console.log('| Preset | Tokens | Tokens/Param | Final Train Loss | Val Loss | Gap (Val - Train) | Memorization Probe |');
  console.log('| :--- | :--- | :--- | :--- | :--- | :--- | :--- |');
  for (const r of results) {
    console.log(`| ${r.preset.padEnd(5)} | ${r.tokens.toLocaleString().padEnd(9)} | ${r.tokensPerParam.toFixed(3).padEnd(12)} | ${r.finalTrainLoss.toFixed(4).padEnd(16)} | ${r.valLoss.toFixed(4).padEnd(8)} | ${(r.gap >= 0 ? '+' : '') + r.gap.toFixed(4).padEnd(16)} | ${(r.memorizationProbeRate * 100).toFixed(1)}% |`);
  }

  // 4. Print Sample Generations for Smallest and Largest Budgets
  console.log('\n================================================================================');
  console.log('               SAMPLE GENERATIONS (SMALLEST vs LARGEST BUDGETS)');
  console.log('================================================================================\n');

  for (const p of ['Scout', 'S']) {
    const smallest = results.find(r => r.preset === p && r.tokens === 10000);
    const largest = results.find(r => r.preset === p && r.tokens === 1300000);

    console.log(`--- PRESET ${p} (10k Tokens — Smallest Budget) ---`);
    if (smallest) {
      for (const s of smallest.samples) {
        console.log(`  [Prompt: "${s.prompt}"] -> "${s.text.replace(/\n/g, '\\n')}"`);
      }
    }
    console.log('');

    console.log(`--- PRESET ${p} (~1.3M Tokens — Largest Budget) ---`);
    if (largest) {
      for (const s of largest.samples) {
        console.log(`  [Prompt: "${s.prompt}"] -> "${s.text.replace(/\n/g, '\\n')}"`);
      }
    }
    console.log('');
  }

  // 5. Save JSON to packages/ml-core/data/runs/scaling_experiment.json
  const runsDir = path.resolve(__dirname, '../data/runs');
  if (!fs.existsSync(runsDir)) {
    fs.mkdirSync(runsDir, { recursive: true });
  }
  const outPath = path.join(runsDir, 'scaling_experiment.json');
  fs.writeFileSync(outPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    config: { steps: STEPS_PER_RUN, batchSize: BATCH_SIZE, seqLen: SEQ_LEN },
    table: results
  }, null, 2), 'utf-8');

  console.log(`[Artifact] Scaling experiment results saved to: ${outPath}\n`);
}

main().catch(err => {
  console.error('Scaling run failed:', err);
  process.exit(1);
});

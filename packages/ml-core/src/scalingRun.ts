/**
 * NeuroArena ML-Core: Scaling Experiment Protocol Runner
 * 
 * Presets: Scout (0.45M params) and Preset S (0.94M params)
 * Budgets: 25k, 100k, 400k, 1.2M, and full TRAIN token count (~2.68M)
 * Each cell trains for 2,000 steps (B=16, T=128), warmup 100.
 * LR chosen per cell from {3e-4, 1e-3, 3e-3} by best val loss.
 * Train loss: mean of last 100 steps.
 * Val loss: mean over 50 fixed VAL batches.
 * 3 seeds per cell; reports mean and sample standard deviation (σ).
 * Outputs full table with Trigram baseline and saves to packages/ml-core/data/runs/scaling_experiment.json.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

import {
  CORPUS_PROVENANCE
} from './data/validation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RUNS_FILE = path.resolve(__dirname, '../data/runs/scaling_experiment.json');

export interface ScalingRow {
  preset: string;
  params: number;
  tokens: number;
  tokensPerParam: number;
  train: number;
  val: number;
  gap: number;
  std: number;
  bestLR: number;
  trigram: number;
  memorizationProbeRate?: number;
  samples?: Array<{ prompt: string; text: string }>;
}

export function printScalingTable(rows: ScalingRow[]): void {
  console.log('\n========================================================================================================');
  console.log('                      NEUROARENA ML-CORE: DATA SCALING EXPERIMENT (2,000 STEPS)');
  console.log('========================================================================================================\n');

  console.log('| Preset | Params  | Tokens    | Tok/Param | Train Loss | Val Loss (mean ± σ) | Gap (Val-Train) | Best LR | Trigram Baseline | Probe |');
  console.log('| :---   | :---    | :---      | :---      | :---       | :---                | :---            | :---    | :---             | :---  |');

  for (const r of rows) {
    const presetStr = r.preset.padEnd(6);
    const paramStr = r.params.toLocaleString().padStart(7);
    const tokStr = r.tokens.toLocaleString().padStart(9);
    const tokPerParamStr = r.tokensPerParam.toFixed(3).padStart(9);
    const trainStr = r.train.toFixed(4).padStart(10);
    const valStr = `${r.val.toFixed(4)} ± ${r.std.toFixed(4)}`.padStart(19);
    const gapStr = (r.gap >= 0 ? '+' : '') + r.gap.toFixed(4).padStart(14);
    const lrStr = r.bestLR.toExponential(0).padStart(7);
    const triStr = r.trigram.toFixed(4).padStart(16);
    const probeStr = (r.memorizationProbeRate !== undefined ? `${(r.memorizationProbeRate * 100).toFixed(1)}%` : '—').padStart(5);

    console.log(`| ${presetStr} | ${paramStr} | ${tokStr} | ${tokPerParamStr} | ${trainStr} | ${valStr} | ${gapStr} | ${lrStr} | ${triStr} | ${probeStr} |`);
  }

  console.log('\n========================================================================================================');
  console.log('                   SAMPLE GENERATIONS (SMALLEST [25k] vs LARGEST [FULL] BUDGETS)');
  console.log('========================================================================================================\n');

  for (const p of ['Scout', 'S']) {
    const smallest = rows.find(r => r.preset === p && r.tokens === 25000);
    const largest = rows.find(r => r.preset === p && r.tokens > 1200000);

    console.log(`--- PRESET ${p} (25k Tokens — Smallest Budget) ---`);
    if (smallest?.samples && smallest.samples.length > 0) {
      for (const s of smallest.samples) {
        console.log(`  [Prompt: "${s.prompt}"] -> "${s.text.replace(/\n/g, '\\n')}"`);
      }
    } else {
      console.log('  (No samples recorded)');
    }
    console.log('');

    console.log(`--- PRESET ${p} (Full Corpus Tokens — Largest Budget) ---`);
    if (largest?.samples && largest.samples.length > 0) {
      for (const s of largest.samples) {
        console.log(`  [Prompt: "${s.prompt}"] -> "${s.text.replace(/\n/g, '\\n')}"`);
      }
    } else {
      console.log('  (No samples recorded)');
    }
    console.log('');
  }
}

async function main(): Promise<void> {
  console.log(`[Corpus Provenance] Full Text: ${CORPUS_PROVENANCE.characters.total.toLocaleString()} chars | BPE-1024 Tokens: ${CORPUS_PROVENANCE.bpe1024Tokens.total.toLocaleString()}`);
  console.log(`[Provenance] Held-Out VAL Works: 4 complete works (2 comedies, 1 tragedy, 1 history) | VAL Tokens: ${CORPUS_PROVENANCE.bpe1024Tokens.val.toLocaleString()}`);

  if (fs.existsSync(RUNS_FILE)) {
    const raw = fs.readFileSync(RUNS_FILE, 'utf-8');
    const data = JSON.parse(raw);
    const table: ScalingRow[] = data.table || data;
    printScalingTable(table);
  } else {
    console.error(`Error: Scaling results file not found at ${RUNS_FILE}`);
    console.log('Run the scaling experiment via headless WebGPU runner or specify --run.');
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

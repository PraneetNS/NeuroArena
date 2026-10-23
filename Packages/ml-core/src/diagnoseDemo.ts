/**
 * Diagnose Demo Script.
 * 
 * Runs diagnose() over the four recorded reference runs from A3:
 * - healthy
 * - overfit
 * - diverge
 * - duplicated
 * 
 * Prints the detected findings, verifies that the healthy run produces NO critical findings,
 * and reports the failure taxonomy status.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { diagnose, Finding, repetitionRate } from './diagnostics.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RUNS_DIR = path.resolve(__dirname, '../data/runs');

interface RunData {
  condition: string;
  preset: string;
  config: any;
  batchSize: number;
  totalSteps: number;
  learningRate: number;
  finalTrainLoss: number;
  finalSmoothedLoss: number;
  finalValLoss?: number;
  finalPerplexity?: number;
  metricHistory: any[];
  samples?: Record<string, Array<{ prompt: string; text: string }>>;
}

function loadRun(filename: string): RunData {
  const fullPath = path.join(RUNS_DIR, filename);
  const raw = fs.readFileSync(fullPath, 'utf-8');
  return JSON.parse(raw);
}

function printFindings(runName: string, findings: Finding[]): void {
  console.log(`\n======================================================================`);
  console.log(`RUN CONDITION: [${runName.toUpperCase()}]`);
  console.log(`======================================================================`);

  if (findings.length === 0) {
    console.log(`  ✓ No failure modes or anomalies detected. Training was healthy!`);
    return;
  }

  for (const f of findings) {
    const icon = f.severity === 'critical' ? '🚨 [CRITICAL]' : f.severity === 'warn' ? '⚠️  [WARNING]' : 'ℹ️  [INFO]';
    console.log(`\n${icon} ${f.title} (${f.id})`);
    console.log(`  Evidence:`);
    for (const ev of f.evidence) {
      console.log(`    - ${ev.metric}: ${ev.value} (threshold: ${ev.threshold})`);
    }
    console.log(`  Plain Explanation:`);
    console.log(`    ${f.plainExplanation}`);
    console.log(`  Likely Causes:`);
    for (const cause of f.likelyCauses) {
      console.log(`    - ${cause}`);
    }
    console.log(`  Suggested Fixes:`);
    for (const fix of f.suggestedFixes) {
      const paramStr = fix.parameterChange
        ? ` (parameter '${fix.parameterChange.parameter}' -> ${fix.parameterChange.suggestedValue})`
        : '';
      console.log(`    - ${fix.label}${paramStr}`);
    }
  }
}

async function main() {
  console.log('Starting ML-Core Training Failure Diagnostics Audit...\n');

  const runFiles = [
    { key: 'healthy', file: 'healthy.json' },
    { key: 'overfit', file: 'overfit.json' },
    { key: 'diverge', file: 'diverge.json' },
    { key: 'duplicated', file: 'duplicated.json' },
    { key: 'leaky', file: 'leaky.json' }
  ];

  let healthyPassed = false;

  for (const { key, file } of runFiles) {
    const run = loadRun(file);

    // Extract samples from the final available step in samples object
    let sampleTexts: string[] = [];
    if (run.samples) {
      const steps = Object.keys(run.samples).map(Number).sort((a, b) => a - b);
      if (steps.length > 0) {
        const lastStep = steps[steps.length - 1];
        sampleTexts = run.samples[String(lastStep)].map(s => s.text);
      }
    }

    // Run probes
    const repRate = repetitionRate(sampleTexts);

    // If final metrics exist, ensure the evaluation reflects the final step
    const metrics = [...run.metricHistory];
    if (run.finalValLoss !== undefined) {
      const last = metrics[metrics.length - 1];
      if (run.totalSteps && (!last || last.step < run.totalSteps)) {
        metrics.push({
          step: run.totalSteps,
          trainLoss: run.finalTrainLoss ?? last?.trainLoss ?? 0,
          smoothedLoss: run.finalSmoothedLoss ?? last?.smoothedLoss,
          valLoss: run.finalValLoss,
          perplexity: run.finalPerplexity,
          lr: last?.lr ?? run.learningRate
        });
      } else if (last && last.valLoss === undefined) {
        last.valLoss = run.finalValLoss;
        last.perplexity = run.finalPerplexity;
      }
    }

    const probes = {
      repetitionRate: repRate,
      samples: sampleTexts,
      leakageScore: (run as any).leakageScore,
      leakagePassage: (run as any).leakagePassage,
      heldOutProbeLoss: (run as any).heldOutProbeLoss,
      totalTokens: (run as any).totalTokens,
      parameterCount: (run as any).parameterCount,
      preset: run.preset,
      sourceDistribution: (run as any).sourceDistribution
    };

    const findings = diagnose([], metrics, probes);
    printFindings(key, findings);

    if (key === 'healthy') {
      const criticals = findings.filter(f => f.severity === 'critical');
      if (criticals.length === 0) {
        healthyPassed = true;
      } else {
        console.error(`\n❌ Error: Healthy run produced critical findings:`, criticals);
      }
    }
  }

  // --------------------------------------------------------------------------
  // SYNTHETIC FAILURE DETECTOR VERIFICATION
  // --------------------------------------------------------------------------
  console.log(`\n======================================================================`);
  console.log(`RUNNING SYNTHETIC TAXONOMY DETECTOR VERIFICATION (10/10 DETECTORS)`);
  console.log(`======================================================================`);

  const syntheticCases = [
    {
      name: 'NaN / Loss Spike Divergence',
      history: [{
        step: 100,
        timestamp: Date.now(),
        loss: NaN,
        globalGradNorm: 100,
        clipScale: 0.01,
        learningRate: 0.001,
        maxLogit: 10,
        logitEntropy: 2.0,
        hasNanOrInf: true,
        layers: []
      }],
      metrics: [{ step: 100, trainLoss: NaN }],
      expectedId: 'divergence'
    },
    {
      name: 'Dead Hidden Units (GELU)',
      history: [{
        step: 200,
        timestamp: Date.now(),
        loss: 3.5,
        globalGradNorm: 1.0,
        clipScale: 1.0,
        learningRate: 0.001,
        maxLogit: 5.0,
        logitEntropy: 4.5,
        hasNanOrInf: false,
        layers: [
          {
            layer: 0,
            paramNorm: 10.0,
            gradNorm: 0.5,
            updateParamRatio: 0.0005,
            activationMean: 0.0,
            activationStd: 1.0,
            geluDeadFraction: 0.48, // > 0.35 threshold
            attentionEntropy: [3.0, 3.0, 3.0, 3.0],
            attnFirstTokenMass: 0.1,
            attnCurrentTokenMass: 0.2
          }
        ]
      }],
      metrics: [{ step: 200, trainLoss: 3.5 }],
      expectedId: 'dead-units'
    },
    {
      name: 'Attention Collapse (Entropy & Sink Mass)',
      history: [{
        step: 300,
        timestamp: Date.now(),
        loss: 4.0,
        globalGradNorm: 1.0,
        clipScale: 1.0,
        learningRate: 0.001,
        maxLogit: 8.0,
        logitEntropy: 3.0,
        hasNanOrInf: false,
        layers: [
          {
            layer: 1,
            paramNorm: 10.0,
            gradNorm: 0.5,
            updateParamRatio: 0.0005,
            activationMean: 0.0,
            activationStd: 1.0,
            geluDeadFraction: 0.05,
            attentionEntropy: [0.12, 0.15, 0.10, 0.14], // < 0.25 threshold
            attnFirstTokenMass: 0.92, // > 0.85 threshold
            attnCurrentTokenMass: 0.02
          }
        ]
      }],
      metrics: [{ step: 300, trainLoss: 4.0 }],
      expectedId: 'attention-collapse'
    },
    {
      name: 'Layer Gradient Vanishing / Explosion',
      history: [{
        step: 150,
        timestamp: Date.now(),
        loss: 3.8,
        globalGradNorm: 2.0,
        clipScale: 1.0,
        learningRate: 0.001,
        maxLogit: 6.0,
        logitEntropy: 4.0,
        hasNanOrInf: false,
        layers: [
          {
            layer: 0,
            paramNorm: 10.0,
            gradNorm: 0.001, // 100x ratio
            updateParamRatio: 0.0001,
            activationMean: 0.0,
            activationStd: 1.0,
            geluDeadFraction: 0.02,
            attentionEntropy: [2.5, 2.5, 2.5, 2.5],
            attnFirstTokenMass: 0.1,
            attnCurrentTokenMass: 0.2
          },
          {
            layer: 1,
            paramNorm: 10.0,
            gradNorm: 0.12,
            updateParamRatio: 0.0012,
            activationMean: 0.0,
            activationStd: 1.0,
            geluDeadFraction: 0.02,
            attentionEntropy: [2.5, 2.5, 2.5, 2.5],
            attnFirstTokenMass: 0.1,
            attnCurrentTokenMass: 0.2
          }
        ]
      }],
      metrics: [{ step: 150, trainLoss: 3.8 }],
      expectedId: 'gradient-vanishing-explosion'
    },
    {
      name: 'Learning Rate Too Low (Stagnant Curve & Tiny Update)',
      history: [{
        step: 250,
        timestamp: Date.now(),
        loss: 5.2,
        globalGradNorm: 0.001,
        clipScale: 1.0,
        learningRate: 1e-7,
        maxLogit: 2.0,
        logitEntropy: 5.0,
        hasNanOrInf: false,
        layers: [{
          layer: 0,
          paramNorm: 10.0,
          gradNorm: 0.0001,
          updateParamRatio: 1e-8,
          activationMean: 0.0,
          activationStd: 1.0,
          geluDeadFraction: 0.01,
          attentionEntropy: [3.0, 3.0, 3.0, 3.0],
          attnFirstTokenMass: 0.1,
          attnCurrentTokenMass: 0.2
        }]
      }],
      metrics: [
        { step: 210, trainLoss: 5.21, lr: 1e-7 },
        { step: 220, trainLoss: 5.21, lr: 1e-7 },
        { step: 230, trainLoss: 5.20, lr: 1e-7 },
        { step: 240, trainLoss: 5.20, lr: 1e-7 },
        { step: 250, trainLoss: 5.20, lr: 1e-7 }
      ],
      expectedId: 'lr-too-low'
    },
    {
      name: 'Data Contamination / Formatting Surprisal Ratio',
      history: [],
      metrics: [{ step: 50, trainLoss: 3.0 }],
      probes: {
        perTokenLosses: [
          { token: 'hello', tokenId: 10, loss: 1.5 },
          { token: 'world', tokenId: 11, loss: 1.6 },
          { token: '<tag>', tokenId: 12, loss: 7.8 }, // 5x surprisal
          { token: '\n\t', tokenId: 13, loss: 8.2 }
        ]
      },
      expectedId: 'data-contamination'
    },
    {
      name: 'Underfitting / Plateau',
      history: [],
      metrics: [
        { step: 400, trainLoss: 4.8 },
        { step: 450, trainLoss: 4.79 },
        { step: 500, trainLoss: 4.78 },
        { step: 550, trainLoss: 4.78 }
      ],
      expectedId: 'underfitting-plateau'
    },
    {
      name: 'Train / Val Leakage (Score > 0.02 & Probe Discrepancy)',
      history: [],
      metrics: [{ step: 1000, trainLoss: 1.15, valLoss: 0.85 }],
      probes: {
        leakageScore: 0.048,
        leakagePassage: 'HAMLET:\nTo be, or not to be, that is the question',
        heldOutProbeLoss: 3.45
      },
      expectedId: 'train-val-leakage'
    },
    {
      name: 'Data Starvation (< 2 Tokens/Param for Models < 5M)',
      history: [],
      metrics: [{ step: 500, trainLoss: 3.2 }],
      probes: {
        parameterCount: 940800,
        totalTokens: 500000 // 0.53 tokens per param (< 2.0)
      },
      expectedId: 'data-starvation'
    },
    {
      name: 'Data Imbalance (> 60% Dominant Region Share)',
      history: [],
      metrics: [{ step: 500, trainLoss: 3.0 }],
      probes: {
        sourceDistribution: {
          meadow_of_verse: 0.72,
          weathered_archive: 0.10,
          echo_hollow: 0.08,
          billboard_flats: 0.06,
          foreign_shore: 0.04
        }
      },
      expectedId: 'data-imbalance'
    }
  ];

  let synthPassed = 0;
  for (const tc of syntheticCases) {
    const f = diagnose(tc.history as any, tc.metrics, tc.probes);
    const matched = f.some(x => x.id === tc.expectedId);
    if (matched) {
      console.log(`  ✓ ${tc.name.padEnd(52)} -> DETECTED [${tc.expectedId}]`);
      synthPassed++;
    } else {
      console.log(`  ✗ ${tc.name.padEnd(52)} -> FAILED (Found: ${f.map(x => x.id).join(', ')})`);
    }
  }

  console.log(`\n======================================================================`);
  console.log(`AUDIT SUMMARY:`);
  console.log(`  - Healthy run produced zero critical findings: ${healthyPassed ? 'PASS ✓' : 'FAIL ✗'}`);
  console.log(`  - Synthetic detectors verified: ${synthPassed}/${syntheticCases.length} PASS ✓`);
  console.log(`======================================================================\n`);
}

main().catch(err => {
  console.error('Fatal in diagnoseDemo:', err);
  process.exit(1);
});

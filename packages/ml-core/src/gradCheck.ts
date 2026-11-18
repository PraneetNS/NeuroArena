/**
 * Central Finite Differences Gradient Check.
 * Compares hand-derived analytical gradients with numerical gradients across all parameter groups.
 * Exposed as an exportable function callable from UI or Node.
 */

import { TinyGPT } from './model.js';
import { Xoshiro128StarStar } from './rng.js';
import { Batch } from './types.js';

export interface ParamGroupCheckResult {
  groupName: string;
  shape: number[];
  samplesTested: number;
  maxRelError: number;
  avgRelError: number;
  passed: boolean;
  sampleDetails: Array<{
    index: number;
    analytical: number;
    numerical: number;
    relError: number;
  }>;
}

export interface WorstOffenderInfo {
  groupName: string;
  index: number;
  analytical: number;
  numerical: number;
  relError: number;
}

export interface GradCheckReport {
  overallPassed: boolean;
  maxRelError: number;
  avgRelError: number;
  totalParametersChecked: number;
  worstOffender: WorstOffenderInfo | null;
  groups: ParamGroupCheckResult[];
  formattedSummary: string;
}

export interface GradCheckOptions {
  numSamples?: number;
  samplesPerGroup?: number;
  eps?: number;
  epsilon?: number;
  relTol?: number;
  seed?: number;
  quiet?: boolean;
}

export function gradCheck(
  model: TinyGPT,
  batch: Batch,
  options: GradCheckOptions = {}
): GradCheckReport {
  const epsilon = options.eps ?? options.epsilon ?? 1e-5;
  const relTol = options.relTol ?? 1e-4;
  const rng = new Xoshiro128StarStar(options.seed ?? 1337);

  // 1. Compute Analytical Gradients via Forward + Backward
  model.zeroGrad();
  model.forward(batch.inputs, batch.B, batch.T, batch.targets);
  model.backward(batch.targets);

  // Snapshot analytical gradients
  const analyticalGrads = new Float64Array(model.grads);

  const groups: ParamGroupCheckResult[] = [];
  let overallMaxError = 0;
  let totalErrorSum = 0;
  let totalSamples = 0;
  let worstOffender: WorstOffenderInfo | null = null;

  // Determine sample counts per group ensuring EVERY parameter group has at least 1 sample
  const paramGroups = model.paramList;
  const groupSampleCounts = new Map<string, number>();

  if (typeof options.numSamples === 'number' && options.numSamples > 0) {
    const targetTotal = options.numSamples;
    // Guarantee at least 1 sample per group (or group size if size is 1)
    let allocated = 0;
    for (const meta of paramGroups) {
      const initCount = Math.min(meta.size, 1);
      groupSampleCounts.set(meta.name, initCount);
      allocated += initCount;
    }

    // Allocate remaining samples preferentially to groups with larger size
    while (allocated < targetTotal) {
      let bestGroup: typeof paramGroups[0] | null = null;
      let maxRatio = -1;
      for (const meta of paramGroups) {
        const cur = groupSampleCounts.get(meta.name) ?? 1;
        if (cur < meta.size) {
          const ratio = meta.size / (cur + 1);
          if (ratio > maxRatio) {
            maxRatio = ratio;
            bestGroup = meta;
          }
        }
      }
      if (!bestGroup) break;
      groupSampleCounts.set(bestGroup.name, (groupSampleCounts.get(bestGroup.name) ?? 1) + 1);
      allocated++;
    }
  } else {
    const perGroup = options.samplesPerGroup ?? 3;
    for (const meta of paramGroups) {
      groupSampleCounts.set(meta.name, Math.min(meta.size, perGroup));
    }
  }

  // 2. Test Central Finite Differences per parameter group
  for (const meta of paramGroups) {
    const numToTest = groupSampleCounts.get(meta.name) ?? Math.min(meta.size, 1);
    const chosenIndices = new Set<number>();

    while (chosenIndices.size < numToTest) {
      const offsetInGroup = Math.floor(rng.nextFloat() * meta.size);
      chosenIndices.add(meta.offset + offsetInGroup);
    }

    let groupMaxError = 0;
    let groupErrorSum = 0;
    const sampleDetails: ParamGroupCheckResult['sampleDetails'] = [];

    for (const paramIdx of chosenIndices) {
      const origVal = model.params[paramIdx];

      // Forward with +eps
      model.params[paramIdx] = origVal + epsilon;
      const { loss: lossPlus } = model.forward(batch.inputs, batch.B, batch.T, batch.targets);

      // Forward with -eps
      model.params[paramIdx] = origVal - epsilon;
      const { loss: lossMinus } = model.forward(batch.inputs, batch.B, batch.T, batch.targets);

      // Restore parameter
      model.params[paramIdx] = origVal;

      if (lossPlus === null || lossMinus === null) {
        throw new Error('Loss must not be null during finite difference check');
      }

      // Central finite difference: (L(θ+ε) - L(θ-ε)) / (2ε)
      const numGrad = (lossPlus - lossMinus) / (2.0 * epsilon);
      const anaGrad = analyticalGrads[paramIdx];

      // Relative error: |ana - num| / max(|ana|, |num|, 1e-8)
      const diff = Math.abs(anaGrad - numGrad);
      const denom = Math.max(Math.abs(anaGrad), Math.abs(numGrad), 1e-8);
      const relError = diff / denom;

      groupMaxError = Math.max(groupMaxError, relError);
      groupErrorSum += relError;
      if (relError > overallMaxError) {
        overallMaxError = relError;
      }
      if (!worstOffender || relError > worstOffender.relError) {
        worstOffender = {
          groupName: meta.name,
          index: paramIdx,
          analytical: anaGrad,
          numerical: numGrad,
          relError
        };
      }
      totalErrorSum += relError;
      totalSamples++;

      sampleDetails.push({
        index: paramIdx,
        analytical: anaGrad,
        numerical: numGrad,
        relError
      });
    }

    const avgError = numToTest > 0 ? groupErrorSum / numToTest : 0;
    const passed = groupMaxError <= relTol;

    groups.push({
      groupName: meta.name,
      shape: meta.shape,
      samplesTested: numToTest,
      maxRelError: groupMaxError,
      avgRelError: avgError,
      passed,
      sampleDetails
    });
  }

  // Restore analytical gradients into model
  model.grads.set(analyticalGrads);

  const overallAvgError = totalSamples > 0 ? totalErrorSum / totalSamples : 0;
  const overallPassed = overallMaxError <= relTol;

  // Build formatted text summary table
  const lines: string[] = [
    '=========================================================================================',
    '                        NEUROARENA GRADCHECK: RELATIVE ERROR REPORT                      ',
    '=========================================================================================',
    'Parameter Group                  Shape             Samples  Max Rel Error  Avg Rel Error  Status',
    '-----------------------------------------------------------------------------------------'
  ];

  for (const g of groups) {
    const nameCol = g.groupName.padEnd(32);
    const shapeCol = `[${g.shape.join(', ')}]`.padEnd(18);
    const samplesCol = String(g.samplesTested).padEnd(9);
    const maxCol = g.maxRelError.toExponential(3).padEnd(15);
    const avgCol = g.avgRelError.toExponential(3).padEnd(15);
    const statusCol = g.passed ? 'PASSED (✓)' : 'FAILED (✗)';
    lines.push(`${nameCol}${shapeCol}${samplesCol}${maxCol}${avgCol}${statusCol}`);
  }

  lines.push('-----------------------------------------------------------------------------------------');
  lines.push(`Total Checked: ${totalSamples} parameters across all ${groups.length} parameter groups`);
  lines.push(`Overall Max Relative Error: ${overallMaxError.toExponential(3)} (tolerance: ${relTol})`);
  lines.push(`Overall Average Relative Error: ${overallAvgError.toExponential(3)}`);
  if (worstOffender) {
    lines.push(
      `Worst Offender: ${worstOffender.groupName} [idx=${worstOffender.index}] | RelError: ${worstOffender.relError.toExponential(3)} | Ana: ${worstOffender.analytical.toExponential(4)} | Num: ${worstOffender.numerical.toExponential(4)}`
    );
  }
  lines.push(`Final Verdict: ${overallPassed ? 'ALL PARAMETER GROUPS PASSED (✓)' : 'FAILURES DETECTED (✗)'}`);
  lines.push('=========================================================================================');

  const summary = lines.join('\n');
  if (!options.quiet) {
    console.log(summary);
  }

  return {
    overallPassed,
    maxRelError: overallMaxError,
    avgRelError: overallAvgError,
    totalParametersChecked: totalSamples,
    worstOffender,
    groups,
    formattedSummary: summary
  };
}

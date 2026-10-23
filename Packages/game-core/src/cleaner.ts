/**
 * Cleaner Node Data Processing Logic.
 * 
 * Filters shards based on Lens signals, text length, and 3-gram Jaccard deduplication.
 */

import { Shard, VaultState } from './types.js';
import { computeLensSignals } from './lens.js';

export interface CleanerThresholds {
  dedupeEnabled?: boolean;
  nearDedupeThreshold?: number;
  minDictionaryHitRate?: number;
  maxNonAlphaRatio?: number;
  maxUppercaseRatio?: number;
  minTextLength?: number;
  maxTextLength?: number;
}

export interface CleanerResult {
  beforeCount: number;
  afterCount: number;
  droppedCount: number;
  kept: Shard[];
  removed: Array<{ shard: Shard; reason: string }>;
}

export function extract3Grams(text: string): Set<string> {
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  const set = new Set<string>();
  for (let i = 0; i <= words.length - 3; i++) {
    set.add(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
  }
  return set;
}

export function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1.0;
  if (a.size === 0 || b.size === 0) return 0.0;
  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union > 0 ? intersection / union : 0;
}

export function cleanShards(
  shards: Shard[],
  thresholds: CleanerThresholds,
  vaultState?: VaultState
): CleanerResult {
  const dedupeEnabled = thresholds.dedupeEnabled !== false;
  const nearDedupeThreshold = thresholds.nearDedupeThreshold ?? 0.85;
  const minDict = thresholds.minDictionaryHitRate ?? 0.90;
  const maxNonAlpha = thresholds.maxNonAlphaRatio ?? 0.35;
  const maxUpper = thresholds.maxUppercaseRatio ?? 0.20;
  const minLen = thresholds.minTextLength ?? 1200;
  const maxLen = thresholds.maxTextLength ?? 3800;

  const kept: Shard[] = [];
  const removed: Array<{ shard: Shard; reason: string }> = [];
  const accepted3Grams: Set<string>[] = [];

  for (const shard of shards) {
    // 1. Text length filter
    if (shard.text.length < minLen || shard.text.length > maxLen) {
      removed.push({ shard, reason: `Length ${shard.text.length} outside [${minLen}, ${maxLen}]` });
      continue;
    }

    // 2. Lens Signal filters
    const sig = computeLensSignals(shard, vaultState);
    if (sig.nonAlphabeticRatio > maxNonAlpha) {
      removed.push({ shard, reason: `nonAlphaRatio ${(sig.nonAlphabeticRatio * 100).toFixed(1)}% > ${(maxNonAlpha * 100).toFixed(1)}%` });
      continue;
    }
    if (sig.uppercaseRatio > maxUpper) {
      removed.push({ shard, reason: `uppercaseRatio ${(sig.uppercaseRatio * 100).toFixed(1)}% > ${(maxUpper * 100).toFixed(1)}%` });
      continue;
    }
    if (sig.dictionaryHitRate < minDict) {
      removed.push({ shard, reason: `dictionaryHitRate ${(sig.dictionaryHitRate * 100).toFixed(1)}% < ${(minDict * 100).toFixed(1)}%` });
      continue;
    }

    // 3. Near-duplicate 3-gram shingle filter
    if (dedupeEnabled) {
      const grams = extract3Grams(shard.text);
      let isDup = false;
      let dupSim = 0;
      for (const existing of accepted3Grams) {
        const sim = jaccardSimilarity(grams, existing);
        if (sim >= nearDedupeThreshold) {
          isDup = true;
          dupSim = sim;
          break;
        }
      }
      if (isDup) {
        removed.push({ shard, reason: `Near duplicate (similarity ${(dupSim * 100).toFixed(1)}% >= ${(nearDedupeThreshold * 100).toFixed(1)}%)` });
        continue;
      }
      accepted3Grams.push(grams);
    }

    kept.push(shard);
  }

  return {
    beforeCount: shards.length,
    afterCount: kept.length,
    droppedCount: removed.length,
    kept,
    removed
  };
}

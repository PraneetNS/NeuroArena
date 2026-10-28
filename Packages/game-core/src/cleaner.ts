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

import { extract3Grams, jaccardSimilarity } from './shingles.js';
export { extract3Grams, jaccardSimilarity };

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
  const gramIndex = new Map<string, number[]>();

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

    // 3. Near-duplicate 3-gram shingle filter with inverted index
    if (dedupeEnabled) {
      const grams = extract3Grams(shard.text);
      let isDup = false;
      let dupSim = 0;

      if (grams.size > 0 && accepted3Grams.length > 0) {
        // Collect candidates that share 3-grams
        const matchCounts = new Map<number, number>();
        for (const g of grams) {
          const list = gramIndex.get(g);
          if (list) {
            for (let i = 0; i < list.length; i++) {
              const idx = list[i];
              matchCounts.set(idx, (matchCounts.get(idx) || 0) + 1);
            }
          }
        }

        // Only compute full Jaccard for candidates that share enough grams to meet threshold
        const minShared = Math.ceil((nearDedupeThreshold / (1 + nearDedupeThreshold)) * grams.size);
        for (const [candIdx, count] of matchCounts.entries()) {
          if (count >= minShared) {
            const sim = jaccardSimilarity(grams, accepted3Grams[candIdx]);
            if (sim >= nearDedupeThreshold) {
              isDup = true;
              dupSim = sim;
              break;
            }
          }
        }
      }

      if (isDup) {
        removed.push({ shard, reason: `Near duplicate (similarity ${(dupSim * 100).toFixed(1)}% >= ${(nearDedupeThreshold * 100).toFixed(1)}%)` });
        continue;
      }

      const newIdx = accepted3Grams.length;
      accepted3Grams.push(grams);
      for (const g of grams) {
        let list = gramIndex.get(g);
        if (!list) {
          list = [];
          gramIndex.set(g, list);
        }
        list.push(newIdx);
      }
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

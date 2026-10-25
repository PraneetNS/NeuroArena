/**
 * Lens Signals & Real-Time Shard Scanning.
 * 
 * Computes 6 real, measurable signals for any shard (without revealing hidden ground-truth quality):
 * 1. nonAlphabeticRatio: share of punctuation, numbers, tags, or corruption symbols
 * 2. repetitionScore: token/3-gram overlap with the player's current vault
 * 3. surpriseScore: cross-entropy surprisal under character bigram model
 * 4. uppercaseRatio: proportion of uppercase characters (flags banners/disclaimers)
 * 5. avgWordLength: mean character length of words
 * 6. dictionaryHitRate: fraction of words found in clean TRAIN split vocabulary
 */

import { Shard, LensSignals, ScanResult, VaultState, LensRule } from './types.js';
import { defaultBigramModel } from './bigram.js';
import { shakespeareDictionary } from './dictionary.js';

export function extractWord3Grams(text: string): Set<string> {
  const words = text.toLowerCase().match(/[a-zA-Z0-9]+/g) || [];
  const set = new Set<string>();
  if (words.length < 3) {
    if (words.length > 0) set.add(words.join(' '));
    return set;
  }
  for (let i = 0; i <= words.length - 3; i++) {
    set.add(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
  }
  return set;
}

/**
 * Computes the 6 real Lens Signals for a given shard.
 */
export function computeLensSignals(shard: Shard | { text: string }, vaultState?: VaultState): LensSignals {
  const text = shard.text;
  const len = text.length;
  if (len === 0) {
    return {
      nonAlphabeticRatio: 0,
      repetitionScore: 0,
      surpriseScore: 0,
      uppercaseRatio: 0,
      avgWordLength: 0,
      dictionaryHitRate: 1.0
    };
  }

  // 1. Non-alphabetic ratio
  let alphaCount = 0;
  let upperCount = 0;
  for (let i = 0; i < len; i++) {
    const code = text.charCodeAt(i);
    if (code >= 65 && code <= 90) {
      alphaCount++;
      upperCount++;
    } else if (code >= 97 && code <= 122) {
      alphaCount++;
    }
  }
  const nonAlphabeticRatio = Math.max(0, Math.min(1, (len - alphaCount) / len));

  // 2. Uppercase ratio (relative to alphabetic characters)
  const uppercaseRatio = alphaCount > 0 ? upperCount / alphaCount : 0;

  // 3. Average word length
  const words = text.match(/[a-zA-Z]+/g) || [];
  let totalWordChars = 0;
  for (const w of words) {
    totalWordChars += w.length;
  }
  const avgWordLength = words.length > 0 ? totalWordChars / words.length : 0;

  // 4. Surprise Score under bigram model
  const surpriseScore = defaultBigramModel.getNormalizedSurprise(text);

  // 5. Dictionary Hit Rate
  const dictionaryHitRate = shakespeareDictionary.computeHitRate(text);

  // 6. Repetition Score (overlap with vault entries)
  let repetitionScore = 0;
  if (vaultState && vaultState.entries.length > 0) {
    const shardGrams = extractWord3Grams(text);
    if (shardGrams.size > 0) {
      const vaultGrams = new Set<string>();
      for (const entry of vaultState.entries) {
        if (entry.status !== 'discard') {
          const entryGrams = extractWord3Grams(entry.text);
          for (const g of entryGrams) {
            vaultGrams.add(g);
          }
        }
      }

      let matched = 0;
      for (const g of shardGrams) {
        if (vaultGrams.has(g)) {
          matched++;
        }
      }
      repetitionScore = matched / shardGrams.size;
    }
  }

  return {
    nonAlphabeticRatio: Number(nonAlphabeticRatio.toFixed(4)),
    repetitionScore: Number(repetitionScore.toFixed(4)),
    surpriseScore: Number(surpriseScore.toFixed(4)),
    uppercaseRatio: Number(uppercaseRatio.toFixed(4)),
    avgWordLength: Number(avgWordLength.toFixed(2)),
    dictionaryHitRate: Number(dictionaryHitRate.toFixed(4))
  };
}

/**
 * Scans a shard for the player HUD and computes all 6 signals,
 * identifying the dominant signal and qualitative surprise rating.
 */
export function scanShard(shard: Shard, vaultState?: VaultState): ScanResult {
  const signals = computeLensSignals(shard, vaultState);

  // Determine dominant signal (highest normalized divergence from normal baseline)
  let dominantSignal: keyof LensSignals = 'surpriseScore';
  let maxDivergence = -Infinity;

  const divergences: Record<keyof LensSignals, number> = {
    nonAlphabeticRatio: Math.abs(signals.nonAlphabeticRatio - 0.22) * 2.5,
    repetitionScore: signals.repetitionScore * 3.0,
    surpriseScore: signals.surpriseScore * 2.5,
    uppercaseRatio: Math.abs(signals.uppercaseRatio - 0.03) * 4.0,
    avgWordLength: Math.abs(signals.avgWordLength - 4.4) * 0.8,
    dictionaryHitRate: (1.0 - signals.dictionaryHitRate) * 4.0
  };

  for (const [key, div] of Object.entries(divergences)) {
    if (div > maxDivergence) {
      maxDivergence = div;
      dominantSignal = key as keyof LensSignals;
    }
  }

  let relativeSurprise: ScanResult['relativeSurprise'] = 'moderate';
  if (signals.surpriseScore < 0.25) relativeSurprise = 'very_low';
  else if (signals.surpriseScore < 0.45) relativeSurprise = 'low';
  else if (signals.surpriseScore < 0.70) relativeSurprise = 'moderate';
  else if (signals.surpriseScore < 0.88) relativeSurprise = 'high';
  else relativeSurprise = 'extreme';

  const preview = shard.text.slice(0, 160).replace(/\s+/g, ' ').trim() + (shard.text.length > 160 ? '...' : '');

  return {
    shardId: shard.id,
    signals,
    dominantSignal,
    relativeSurprise,
    preview
  };
}

/**
 * Computes Area Under the ROC Curve (AUC) for distinguishing clean vs tagged shards.
 */
export function computeAUC(cleanVals: number[], tagVals: number[], higherIsAnomaly = true): number {
  if (cleanVals.length === 0 || tagVals.length === 0) return 0.5;
  let wins = 0;
  let ties = 0;
  for (const c of cleanVals) {
    for (const t of tagVals) {
      if (higherIsAnomaly) {
        if (t > c) wins++;
        else if (t === c) ties++;
      } else {
        if (t < c) wins++;
        else if (t === c) ties++;
      }
    }
  }
  return (wins + 0.5 * ties) / (cleanVals.length * tagVals.length);
}

/**
 * Evaluates whether a shard's LensSignals pass a given LensRule.
 * Acts solely on computed analytical signals, NEVER on hidden tags.
 */
export function evaluateLensRule(signals: LensSignals, rule: LensRule): boolean {
  if (rule.minDictionaryHitRate !== undefined && signals.dictionaryHitRate < rule.minDictionaryHitRate) {
    return false;
  }
  if (rule.maxNonAlphaRatio !== undefined && signals.nonAlphabeticRatio > rule.maxNonAlphaRatio) {
    return false;
  }
  if (rule.maxRepetitionScore !== undefined && signals.repetitionScore > rule.maxRepetitionScore) {
    return false;
  }
  if (rule.maxUppercaseRatio !== undefined && signals.uppercaseRatio > rule.maxUppercaseRatio) {
    return false;
  }
  if (rule.minSurpriseScore !== undefined && signals.surpriseScore < rule.minSurpriseScore) {
    return false;
  }
  if (rule.maxSurpriseScore !== undefined && signals.surpriseScore > rule.maxSurpriseScore) {
    return false;
  }
  return true;
}

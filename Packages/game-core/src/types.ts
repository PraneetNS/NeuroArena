/**
 * Pure data model types for the game's collection, shards, regions, and vault.
 * No DOM or Three.js dependencies.
 */

export const TRAIN_VAL_SPLIT_RATIO = 0.9;

export type QualityTag =
  | 'clean'
  | 'ocr_noise'
  | 'duplicate'
  | 'boilerplate'
  | 'off_domain'
  | 'leaked_val';

export interface Position3D {
  x: number;
  y: number;
  z: number;
}

export interface Shard {
  id: string;
  text: string;
  sourceId: string;
  position: Position3D;
  tag: QualityTag; // HIDDEN ground-truth quality tag
  regionId: string;
  length: number;
}

export interface RegionDef {
  id: string;
  name: string;
  center: { x: number; z: number };
  radius: number;
  qualityMix: Record<QualityTag, number>;
  description: string;
  themeColor: number;
  themeHex: string;
  silhouette: 'crystal' | 'rune' | 'spire' | 'prism' | 'star';
  targetQuota: number;
}

export interface LensSignals {
  nonAlphabeticRatio: number; // 0..1 fraction of non-a-zA-Z characters
  repetitionScore: number;    // 0..1 overlap with shards currently in the vault
  surpriseScore: number;      // normalized surprisal under Shakespeare bigram model
  uppercaseRatio: number;     // 0..1 fraction of uppercase letters
  avgWordLength: number;      // average length of alphabetic words
  dictionaryHitRate: number;  // 0..1 fraction of words found in clean TRAIN split vocabulary
}

export interface ScanResult {
  shardId: string;
  signals: LensSignals;
  dominantSignal: keyof LensSignals;
  relativeSurprise: 'very_low' | 'low' | 'moderate' | 'high' | 'extreme';
  preview: string;
}

export interface VaultEntry {
  shardId: string;
  text: string;
  collectedTime: number;
  status: 'keep' | 'discard';
  sourceId: string;
  regionId: string;
  tag?: QualityTag;
  isRevealed?: boolean;
}

export interface LensRule {
  id: string;
  name: string;
  description?: string;
  minDictionaryHitRate?: number; // e.g. 0.90
  maxNonAlphaRatio?: number;     // e.g. 0.30
  maxRepetitionScore?: number;   // e.g. 0.40
  maxUppercaseRatio?: number;    // e.g. 0.20
  minSurpriseScore?: number;
  maxSurpriseScore?: number;
}

export const DEFAULT_LENS_RULES: LensRule[] = [
  {
    id: 'clean_english',
    name: 'Clean English',
    description: 'Dict ≥ 0.90, NonAlpha ≤ 0.30, Repetition ≤ 0.40',
    minDictionaryHitRate: 0.90,
    maxNonAlphaRatio: 0.30,
    maxRepetitionScore: 0.40
  },
  {
    id: 'strict_curator',
    name: 'Strict Curator',
    description: 'Dict ≥ 0.95, NonAlpha ≤ 0.15, Repetition ≤ 0.30, Uppercase ≤ 0.15',
    minDictionaryHitRate: 0.95,
    maxNonAlphaRatio: 0.15,
    maxRepetitionScore: 0.30,
    maxUppercaseRatio: 0.15
  },
  {
    id: 'liberal_sweep',
    name: 'Liberal Sweep',
    description: 'Dict ≥ 0.70, NonAlpha ≤ 0.50, Repetition ≤ 0.60',
    minDictionaryHitRate: 0.70,
    maxNonAlphaRatio: 0.50,
    maxRepetitionScore: 0.60
  }
];

export interface CapacityTier {
  tier: 1 | 2 | 3;
  maxPages: number; // 150, 400, 1000
  title: string;
  conditionDescription: string;
  unlockCondition: {
    type: 'initial' | 'first_completed_run' | 'first_autopsy' | 'val_loss_threshold';
    targetValLoss?: number;
  };
}

export const VAULT_CAPACITY_TIERS: CapacityTier[] = [
  {
    tier: 1,
    maxPages: 350,
    title: 'Novice Ledger',
    conditionDescription: 'Initial unlocked vault capacity',
    unlockCondition: { type: 'initial' }
  },
  {
    tier: 2,
    maxPages: 1000,
    title: 'Journeyman Vault',
    conditionDescription: 'Beat BIGRAM baseline on VAL (val loss ≤ 3.286)',
    unlockCondition: { type: 'val_loss_threshold', targetValLoss: 3.286 }
  },
  {
    tier: 3,
    maxPages: 2000,
    title: 'Grand Archive',
    conditionDescription: 'Beat TRIGRAM baseline on VAL (val loss ≤ 2.834)',
    unlockCondition: { type: 'val_loss_threshold', targetValLoss: 2.834 }
  }
];

export interface VaultStats {
  count: number;
  keptCount: number;
  discardedCount: number;
  tokens: number;
  uniqueRatio: number;
  sourceMix: Record<string, number>;
  fingerprint: string;
  maxCapacity: number;
  tier: 1 | 2 | 3;
  tierTitle: string;
  nextTierUnlock?: string;
}

export interface VaultState {
  entries: VaultEntry[];
  stats: VaultStats;
}

export type HeightSampler = (x: number, z: number) => number;

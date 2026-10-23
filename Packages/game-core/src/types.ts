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

export interface VaultStats {
  count: number;
  keptCount: number;
  discardedCount: number;
  tokens: number;
  uniqueRatio: number;
  sourceMix: Record<string, number>;
  fingerprint: string;
}

export interface VaultState {
  entries: VaultEntry[];
  stats: VaultStats;
}

export type HeightSampler = (x: number, z: number) => number;

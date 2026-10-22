/**
 * Core type definitions, configurations, parameter metadata, and architectural presets.
 */

export interface GPTConfig {
  vocabSize: number;
  dModel: number;
  nLayers: number;
  nHeads: number;
  dFF: number;
  contextLen: number;
  // Optional convenience aliases for UI compatibility
  blockSize?: number;
  nEmbd?: number;
  nLayer?: number;
  nHead?: number;
}

export interface CandidateProb {
  token: string;
  prob: number;
  id: number;
}

export type TinyGPTConfig = Partial<GPTConfig> & {
  vocabSize: number;
};


export const PRESETS: Record<'S' | 'M' | 'C', GPTConfig> = {
  // Preset S: 128 / 4 / 4 / 512 / 128, vocab 1024
  S: {
    vocabSize: 1024,
    dModel: 128,
    nLayers: 4,
    nHeads: 4,
    dFF: 512,
    contextLen: 128
  },
  // Preset M: 192 / 6 / 6 / 768 / 256, vocab 2048
  M: {
    vocabSize: 2048,
    dModel: 192,
    nLayers: 6,
    nHeads: 6,
    dFF: 768,
    contextLen: 256
  },
  // Preset C: 64 / 2 / 2 / 256 / 64, char-level
  C: {
    vocabSize: 96,
    dModel: 64,
    nLayers: 2,
    nHeads: 2,
    dFF: 256,
    contextLen: 64
  }
};

export interface ParamMeta {
  name: string;
  offset: number;
  size: number;
  shape: number[];
  decay: boolean;
}

export interface Batch {
  inputs: Uint16Array;  // shape [B, T], flat length B * T
  targets: Uint16Array; // shape [B, T], flat length B * T
  B: number;
  T: number;
}

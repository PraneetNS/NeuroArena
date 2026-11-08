/**
 * NeuroArena ML-Core: FP16 Checkpoint Serialization & Elder Model Loader.
 *
 * Implements high-efficiency binary packing for neural weights:
 * - IEEE-754 Half-Precision (Float16) conversion with universal fallback
 * - Binary header with metadata, architecture config, and loss statistics
 * - Native Float16Array support in modern engines (V8 / Node 20+)
 * - Browser fetch and Node.js file system loading
 */

import { GPTConfig } from './types.js';
import { TinyGPT } from './model.js';

export interface ElderCheckpointManifest {
  magic: string; // 'NACP'
  version: number; // 1
  name: string; // 'The Elder'
  preset: string; // 'S'
  totalParams: number;
  config: GPTConfig;
  step: number;
  trainLoss: number;
  valLoss: number;
  tokensSeen: number;
  trainedAt: string;
}

// Universal Float32 <-> Float16 converter fallback
function floatToHalf(val: number): number {
  const f32 = new Float32Array(1);
  const u32 = new Uint32Array(f32.buffer);
  f32[0] = val;
  const x = u32[0];

  const sign = (x >> 16) & 0x8000;
  let mantissa = x & 0x007fffff;
  let exp = (x >> 23) & 0xff;

  if (exp >= 143) {
    // Overflow -> Infinity / NaN
    return sign | 0x7c00 | (exp === 255 && mantissa !== 0 ? 0x0200 : 0);
  }
  if (exp <= 112) {
    // Underflow -> Subnormal or 0
    if (112 - exp > 10) return sign;
    mantissa |= 0x00800000;
    const half = (mantissa >> (113 - exp + 13)) + ((mantissa >> (112 - exp + 13)) & 1);
    return sign | half;
  }

  exp = exp - 127 + 15;
  mantissa = (mantissa >> 13) + ((mantissa >> 12) & 1);
  return sign | (exp << 10) | (mantissa & 0x03ff);
}

function halfToFloat(h: number): number {
  const sign = (h & 0x8000) << 16;
  const exp = (h & 0x7c00) >> 10;
  const mant = h & 0x03ff;

  const f32 = new Float32Array(1);
  const u32 = new Uint32Array(f32.buffer);

  if (exp === 0) {
    if (mant === 0) {
      u32[0] = sign;
      return f32[0];
    }
    // Subnormal
    let m = mant << 13;
    let e = 127 - 14;
    while ((m & 0x00800000) === 0) {
      m <<= 1;
      e--;
    }
    m &= 0x007fffff;
    u32[0] = sign | ((e + 1) << 23) | m;
    return f32[0];
  } else if (exp === 0x1f) {
    u32[0] = sign | 0x7f800000 | (mant << 13);
    return f32[0];
  }

  const newExp = exp - 15 + 127;
  u32[0] = sign | (newExp << 23) | (mant << 13);
  return f32[0];
}

/**
 * Packs a Float32Array or Float64Array into binary Float16 (2 bytes per parameter).
 */
export function packFp16(data: Float32Array | Float64Array): Uint8Array {
  const N = data.length;
  // If native Float16Array is available, use fast native typed array path
  if (typeof (globalThis as any).Float16Array !== 'undefined') {
    const f16Class = (globalThis as any).Float16Array;
    const f16 = new f16Class(N);
    for (let i = 0; i < N; i++) {
      f16[i] = data[i];
    }
    return new Uint8Array(f16.buffer, f16.byteOffset, f16.byteLength);
  }

  const u16 = new Uint16Array(N);
  for (let i = 0; i < N; i++) {
    u16[i] = floatToHalf(data[i]);
  }
  return new Uint8Array(u16.buffer, u16.byteOffset, u16.byteLength);
}

/**
 * Unpacks binary Float16 bytes into a Float32Array.
 */
export function unpackFp16(bytes: Uint8Array): Float32Array {
  const N = Math.floor(bytes.byteLength / 2);
  if (typeof (globalThis as any).Float16Array !== 'undefined') {
    const f16Class = (globalThis as any).Float16Array;
    const f16 = new f16Class(bytes.buffer, bytes.byteOffset, N);
    const f32 = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      f32[i] = f16[i];
    }
    return f32;
  }

  const u16 = new Uint16Array(bytes.buffer, bytes.byteOffset, N);
  const f32 = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    f32[i] = halfToFloat(u16[i]);
  }
  return f32;
}

/**
 * Serializes a full model checkpoint to binary format (NACP header + JSON metadata + FP16 weights).
 */
export function serializeCheckpoint(
  manifest: ElderCheckpointManifest,
  weights: Float32Array | Float64Array
): Uint8Array {
  const fp16Bytes = packFp16(weights);
  const metaJson = JSON.stringify(manifest);
  const metaBytes = new TextEncoder().encode(metaJson);

  // Layout:
  // 4 bytes: Magic "NACP" (0x4E, 0x41, 0x43, 0x50)
  // 2 bytes: Version (uint16)
  // 4 bytes: Meta JSON length in bytes (uint32)
  // Meta JSON bytes
  // FP16 weights bytes
  const headerLen = 4 + 2 + 4;
  const totalBytes = headerLen + metaBytes.byteLength + fp16Bytes.byteLength;
  const out = new Uint8Array(totalBytes);
  const view = new DataView(out.buffer);

  // Magic
  out[0] = 0x4E;
  out[1] = 0x41;
  out[2] = 0x43;
  out[3] = 0x50;

  // Version 1
  view.setUint16(4, 1, true);

  // Meta Length
  view.setUint32(6, metaBytes.byteLength, true);

  // Copy Meta JSON
  out.set(metaBytes, headerLen);

  // Copy Weights
  out.set(fp16Bytes, headerLen + metaBytes.byteLength);

  return out;
}

/**
 * Deserializes a binary checkpoint into manifest metadata and Float32 weights.
 */
export function deserializeCheckpoint(bytes: Uint8Array): {
  manifest: ElderCheckpointManifest;
  weights: Float32Array;
} {
  if (bytes.length < 10) throw new Error('Invalid checkpoint: buffer too small');

  // Verify Magic
  if (bytes[0] !== 0x4E || bytes[1] !== 0x41 || bytes[2] !== 0x43 || bytes[3] !== 0x50) {
    throw new Error('Invalid checkpoint: missing NACP magic header');
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const version = view.getUint16(4, true);
  if (version !== 1) {
    throw new Error(`Unsupported checkpoint version: ${version}`);
  }

  const metaLen = view.getUint32(6, true);
  const headerLen = 10;
  const metaBytes = bytes.subarray(headerLen, headerLen + metaLen);
  const metaJson = new TextDecoder().decode(metaBytes);
  const manifest = JSON.parse(metaJson) as ElderCheckpointManifest;

  const weightsBytes = bytes.subarray(headerLen + metaLen);
  const weights = unpackFp16(weightsBytes);

  return { manifest, weights };
}

/**
 * Instantiates a TinyGPT CPU model loaded with weights from a binary checkpoint.
 */
export function createModelFromCheckpoint(
  checkpointData: { manifest: ElderCheckpointManifest; weights: Float32Array }
): TinyGPT {
  const model = new TinyGPT(checkpointData.manifest.config, 42);
  for (let i = 0; i < checkpointData.weights.length; i++) {
    model.params[i] = checkpointData.weights[i];
  }
  return model;
}

/**
 * Loads the Elder checkpoint either from public assets or from Node.js filesystem.
 */
export async function loadElderCheckpoint(assetPath = '/assets/elder_preset_s.bin'): Promise<{
  manifest: ElderCheckpointManifest;
  weights: Float32Array;
  model: TinyGPT;
}> {
  let bytes: Uint8Array | null = null;

  // Browser fetch environment
  if (typeof window !== 'undefined' && typeof fetch !== 'undefined') {
    const res = await fetch(assetPath);
    if (!res.ok) {
      throw new Error(`Failed to fetch Elder checkpoint at ${assetPath}: ${res.statusText}`);
    }
    const buf = await res.arrayBuffer();
    bytes = new Uint8Array(buf);
  } else {
    // Node.js environment
    try {
      const fs = await import('fs');
      const path = await import('path');
      const resolvedPath = path.resolve(process.cwd(), 'apps/game/public', assetPath.replace(/^\//, ''));
      const buf = fs.readFileSync(resolvedPath);
      bytes = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    } catch (e: any) {
      throw new Error(`Failed to read Elder checkpoint from disk: ${e?.message}`);
    }
  }

  const checkpoint = deserializeCheckpoint(bytes);
  const model = createModelFromCheckpoint(checkpoint);

  return {
    manifest: checkpoint.manifest,
    weights: checkpoint.weights,
    model
  };
}

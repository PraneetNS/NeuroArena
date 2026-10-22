/**
 * Tokenization Demo Script for NeuroArena ML-Core:
 * - Trains ByteBPE on bundled public-domain text at target vocab 1024
 * - Measures training duration and encoding throughput
 * - Computes compression ratio (chars per token)
 * - Validates exact round-trip reconstruction on the first 2,000 characters
 * - Validates DataLoader batch sampling
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ByteBPE } from './tokenizers/bpe.js';
import { DataLoader } from './dataset.js';
import { Xoshiro128StarStar } from './rng.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Locate bundled dataset
const possiblePaths = [
  path.resolve(__dirname, '../data/input.txt'),
  path.resolve(process.cwd(), 'packages/ml-core/data/input.txt'),
  path.resolve(process.cwd(), 'Packages/ml-core/data/input.txt'),
  path.resolve(process.cwd(), 'data/input.txt')
];

let dataPath = '';
for (const p of possiblePaths) {
  if (fs.existsSync(p)) {
    dataPath = p;
    break;
  }
}

if (!dataPath) {
  console.error('Error: Could not locate bundled input.txt in packages/ml-core/data');
  process.exit(1);
}

console.log('='.repeat(70));
console.log('   NEUROARENA ML-CORE: BYTE-LEVEL BPE TOKENIZATION DEMO');
console.log('='.repeat(70));

const rawText = fs.readFileSync(dataPath, 'utf-8');
const byteSize = Buffer.byteLength(rawText, 'utf-8');
const charCount = rawText.length;

console.log(`Corpus file:       ${path.relative(process.cwd(), dataPath)}`);
console.log(`Corpus size:       ${(byteSize / (1024 * 1024)).toFixed(2)} MB (${byteSize.toLocaleString()} bytes, ${charCount.toLocaleString()} chars)`);

// 1. Train ByteBPE
console.log('\n[1/4] Training ByteBPE (target vocab: 1024)...');
const bpe = new ByteBPE();
const tTrainStart = performance.now();
bpe.train(rawText, 1024, 2);
const trainDurationMs = performance.now() - tTrainStart;

console.log(`✓ Training completed in ${(trainDurationMs / 1000).toFixed(3)}s (${trainDurationMs.toFixed(1)} ms)`);
console.log(`  Initial base vocab: 256 byte tokens`);
console.log(`  Learned merges:     ${bpe.merges.length}`);
console.log(`  Final vocab size:   ${bpe.vocabSize}`);

// 2. Full Corpus Encode & Compression Ratio
console.log('\n[2/4] Encoding full corpus...');
const tEncodeStart = performance.now();
const encodedTokens = bpe.encode(rawText);
const encodeDurationMs = performance.now() - tEncodeStart;

const tokenCount = encodedTokens.length;
const charsPerToken = charCount / tokenCount;
const bytesPerToken = byteSize / tokenCount;
const compressionPct = ((1 - tokenCount / charCount) * 100).toFixed(1);

console.log(`✓ Encoded ${charCount.toLocaleString()} characters -> ${tokenCount.toLocaleString()} tokens in ${(encodeDurationMs / 1000).toFixed(3)}s (${(charCount / (encodeDurationMs / 1000) / 1000).toFixed(0)}k chars/sec)`);
console.log(`  Compression ratio:  ${charsPerToken.toFixed(3)} chars/token (${bytesPerToken.toFixed(3)} bytes/token)`);
console.log(`  Token reduction:    ${compressionPct}% fewer tokens than characters`);

// 3. Exact Round-Trip Verification on First 2,000 Characters
console.log('\n[3/4] Validating exact round-trip reconstruction on first 2,000 characters...');
const testSlice = rawText.slice(0, 2000);
const testTokens = bpe.encode(testSlice);
const decodedText = bpe.decode(testTokens);

const exactMatch = decodedText === testSlice;
console.log(`  Original chars:    ${testSlice.length}`);
console.log(`  Encoded tokens:    ${testTokens.length}`);
console.log(`  Decoded chars:     ${decodedText.length}`);
console.log(`  Round-trip result: ${exactMatch ? 'EXACT MATCH (100% Lossless)' : 'MISMATCH'}`);

if (!exactMatch) {
  for (let i = 0; i < Math.max(testSlice.length, decodedText.length); i++) {
    if (testSlice[i] !== decodedText[i]) {
      console.error(`  Mismatch at offset ${i}: expected ${JSON.stringify(testSlice[i])}, got ${JSON.stringify(decodedText[i])}`);
      break;
    }
  }
  process.exit(1);
}

// 4. JSON Serialization & Restoration Test
console.log('\n[4/4] Validating JSON serialization (toJSON / fromJSON)...');
const jsonExport = bpe.toJSON();
const restoredBpe = ByteBPE.fromJSON(jsonExport);
const restoredDecoded = restoredBpe.decode(testTokens);
const jsonExactMatch = restoredDecoded === testSlice;
console.log(`  Restored vocab:    ${restoredBpe.vocabSize}`);
console.log(`  Restored decode:   ${jsonExactMatch ? 'EXACT MATCH' : 'MISMATCH'}`);

// 5. DataLoader Batch Sampling Test
console.log('\n[BONUS] Validating DataLoader sampleBatch(B=4, T=64)...');
const rng = new Xoshiro128StarStar(42);
const dataLoader = new DataLoader(encodedTokens);
const batch = dataLoader.sampleBatch(4, 64, 'train', rng);

let shiftedValid = true;
for (let b = 0; b < 4; b++) {
  for (let t = 0; t < 63; t++) {
    const currTarget = batch.targets[b * 64 + t];
    const nextInput = batch.inputs[b * 64 + t + 1];
    if (currTarget !== nextInput) {
      shiftedValid = false;
      break;
    }
  }
}

console.log(`  Train tokens:      ${dataLoader.trainTokens.length.toLocaleString()}`);
console.log(`  Val tokens:        ${dataLoader.valTokens.length.toLocaleString()}`);
console.log(`  Batch shapes:      inputs [${batch.inputs.length}] (${batch.inputs.constructor.name}), targets [${batch.targets.length}] (${batch.targets.constructor.name})`);
console.log(`  Shift verification: ${shiftedValid ? 'PASSED (targets are inputs shifted by one)' : 'FAILED'}`);

console.log('\n' + '='.repeat(70));
console.log('   TOKENIZE DEMO SUMMARY');
console.log('='.repeat(70));
console.log(`  BPE Training Time:     ${(trainDurationMs / 1000).toFixed(3)} s`);
console.log(`  Full Encode Time:      ${(encodeDurationMs / 1000).toFixed(3)} s`);
console.log(`  Target Vocab Size:     ${bpe.vocabSize}`);
console.log(`  Compression Ratio:     ${charsPerToken.toFixed(3)} chars/token`);
console.log(`  Round-Trip Match:      ${exactMatch ? 'EXACT MATCH' : 'FAIL'}`);
console.log('='.repeat(70) + '\n');

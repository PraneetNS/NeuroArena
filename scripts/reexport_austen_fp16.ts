import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { TinyGPT } from '../packages/ml-core/src/model.ts';
import { ByteBPE } from '../packages/ml-core/src/tokenizers/bpe.ts';
import { PRIDE_AND_PREJUDICE_TEXT } from '../packages/game-core/src/data/prideAndPrejudiceCorpus.ts';
import { serializeCheckpoint, deserializeCheckpoint, packFp16, unpackFp16 } from '../packages/ml-core/src/checkpoint.ts';

const repoRoot = path.resolve(import.meta.dirname, '..');

// 1. Read existing raw FP32 weights
const fp32Path = path.join(repoRoot, 'apps/game/public/assets/elder_austen_tuned.bin');
const fp32Buf = fs.readFileSync(fp32Path);
const fp32Weights = new Float32Array(fp32Buf.buffer, fp32Buf.byteOffset, fp32Buf.byteLength / 4);
console.log('Original FP32 weights count:', fp32Weights.length);

// 2. Load Tokenizer & prepare Austen held-out split (last 15% of chapters)
const tokJsonStr = fs.readFileSync(path.join(repoRoot, 'apps/game/public/data/bpe_1024.json'), 'utf8');
const tokenizer = ByteBPE.fromJSON(tokJsonStr);

// Extract Austen chapters: tuning (first 85% = chapters 1..52), held-out (last 15% = chapters 53..61)
const chapterRegex = /CHAPTER\s+([IVXLCDM]+)\./gi;
const indices: { index: number; chapter: string }[] = [];
let match: RegExpExecArray | null;
const text = PRIDE_AND_PREJUDICE_TEXT;
while ((match = chapterRegex.exec(text)) !== null) {
  indices.push({ index: match.index, chapter: match[1] });
}
console.log('Found Austen chapters:', indices.length);
const heldOutStartIndex = indices[52].index; // Chapter 53 starts here
const heldOutText = text.substring(heldOutStartIndex);
const heldOutTokens = tokenizer.encode(heldOutText);
console.log('Held-out tokens count:', heldOutTokens.length);

// 3. Prepare 50 batches (batch size 4, contextLen 128 = 25,600 tokens total)
const batchSize = 4;
const contextLen = 128;
const numBatches = 50;

function evaluateModelLoss(model: TinyGPT, tokens: number[], batchesCount: number): number {
  let totalLoss = 0;
  let cursor = 0;
  for (let b = 0; b < batchesCount; b++) {
    const x = new Uint16Array(batchSize * contextLen);
    const y = new Uint16Array(batchSize * contextLen);
    for (let i = 0; i < batchSize; i++) {
      if (cursor + contextLen + 1 >= tokens.length) cursor = 0;
      for (let t = 0; t < contextLen; t++) {
        x[i * contextLen + t] = tokens[cursor + t];
        y[i * contextLen + t] = tokens[cursor + t + 1];
      }
      cursor += 37; // stride
    }
    const { loss } = model.forward(x, y, batchSize, contextLen);
    if (loss !== null) {
      totalLoss += loss;
    }
  }
  return totalLoss / batchesCount;
}

const config = {
  vocabSize: 1024,
  dModel: 128,
  nLayers: 4,
  nHeads: 4,
  dFF: 512,
  contextLen: 128
};

// Evaluate FP32 model
const fp32Model = new TinyGPT(config, 42);
for (let i = 0; i < fp32Weights.length; i++) {
  fp32Model.params[i] = fp32Weights[i];
}
const fp32Loss = evaluateModelLoss(fp32Model, heldOutTokens, numBatches);
console.log('FP32 Validation Loss (50 batches):', fp32Loss.toFixed(6));

// 4. Convert to FP16 and pack into NACP checkpoint
const manifest = {
  magic: 'NACP',
  version: 1,
  tokenizerVersion: 'bpe1024-v2',
  name: 'The Elder - Austen Domain Adapted',
  preset: 'S',
  totalParams: 940800,
  config: config,
  step: 300,
  trainLoss: 2.21,
  valLoss: Number(fp32Loss.toFixed(4)),
  tokensSeen: 614400,
  trainedAt: '2026-11-26T23:50:00.000Z'
};

const nacpBytes = serializeCheckpoint(manifest, fp32Weights);
console.log('Packed NACP FP16 checkpoint size:', nacpBytes.byteLength, 'bytes');

// 5. Unpack and evaluate FP16 model
const deserialized = deserializeCheckpoint(nacpBytes, 'bpe1024-v2');
const fp16Model = new TinyGPT(config, 42);
for (let i = 0; i < deserialized.weights.length; i++) {
  fp16Model.params[i] = deserialized.weights[i];
}
const fp16Loss = evaluateModelLoss(fp16Model, heldOutTokens, numBatches);
console.log('FP16 Validation Loss (50 batches):', fp16Loss.toFixed(6));

const diff = Math.abs(fp32Loss - fp16Loss);
console.log('Absolute Loss Difference (FP32 vs FP16):', diff.toFixed(6), '(Negligible:', diff < 0.005, ')');

// Write out the re-exported FP16 checkpoint to public assets
const outGamePath = path.join(repoRoot, 'apps/game/public/assets/elder_austen_tuned.bin');
fs.writeFileSync(outGamePath, nacpBytes);
const outBenchPath = path.join(repoRoot, 'apps/bench/public/assets/elder_austen_tuned.bin');
if (fs.existsSync(outBenchPath)) {
  fs.writeFileSync(outBenchPath, nacpBytes);
}
console.log('Successfully re-exported elder_austen_tuned.bin as FP16 NACP binary!');

// Print final sha256
const finalHash = crypto.createHash('sha256').update(nacpBytes).digest('hex');
console.log('New elder_austen_tuned.bin SHA-256:', finalHash);

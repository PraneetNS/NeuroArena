import fs from 'fs';
import zlib from 'zlib';
import path from 'path';
import { ByteBPE } from '../packages/ml-core/src/tokenizers/bpe.ts';

const rootDir = 'D:/NeuroArena';
const tokJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'packages/ml-core/data/bpe_1024.json'), 'utf8'));
const tokenizer = ByteBPE.fromJSON(JSON.stringify(tokJson));

const trainText = zlib.gunzipSync(fs.readFileSync(path.join(rootDir, 'packages/ml-core/data/train_text.txt.gz'))).toString('utf8');
const valText = zlib.gunzipSync(fs.readFileSync(path.join(rootDir, 'packages/ml-core/data/val_text.txt.gz'))).toString('utf8');

const trainTokens = tokenizer.encode(trainText);

// Build 5-gram set from trainTokens
console.log('Building train 5-gram set...');
const train5grams = new Set<string>();
for (let i = 0; i < trainTokens.length - 4; i++) {
  const k = `${trainTokens[i]},${trainTokens[i+1]},${trainTokens[i+2]},${trainTokens[i+3]},${trainTokens[i+4]}`;
  train5grams.add(k);
}
console.log(`Train 5-grams: ${train5grams.size}`);

// Now find a contiguous excerpt of >= 550 tokens from valText
// Let's search inside Antony and Cleopatra or Comedy of Errors or King John
const valTokens = tokenizer.encode(valText);
console.log(`Total val tokens: ${valTokens.length}`);

// We want a clean dramatic scene of ~550 tokens
// Let's test candidate windows
let bestOverlap = 999;
let bestStart = 0;
let bestCount = 0;

for (let start = 1000; start < 200000; start += 200) {
  const len = 520;
  if (start + len > valTokens.length) break;
  const slice = valTokens.slice(start, start + len);
  let overlapCount = 0;
  for (let i = 0; i < slice.length - 4; i++) {
    const k = `${slice[i]},${slice[i+1]},${slice[i+2]},${slice[i+3]},${slice[i+4]}`;
    if (train5grams.has(k)) {
      overlapCount++;
    }
  }
  const overlapPct = (overlapCount / (slice.length - 4)) * 100;
  if (overlapCount < bestOverlap) {
    bestOverlap = overlapCount;
    bestStart = start;
    bestCount = overlapCount;
    console.log(`New lowest overlap: ${overlapCount}/${slice.length - 4} (${overlapPct.toFixed(2)}%) at offset ${start}`);
    if (overlapCount === 0) {
      const text = tokenizer.decode(slice);
      console.log(`Found 0% 5-gram overlap excerpt at offset ${start}!`);
      console.log(`Tokens: ${slice.length}, 5-gram overlap: 0/${slice.length - 4} (0.00%)`);
      console.log('Text preview:\n', text.slice(0, 300));
      fs.writeFileSync('D:/NeuroArena/scratch/head_to_head_candidate.txt', text);
      fs.writeFileSync('D:/NeuroArena/scratch/head_to_head_candidate.json', JSON.stringify({ start, len, text }));
      break;
    }
  }
}

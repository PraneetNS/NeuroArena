/**
 * Corpus Build Script for Project Gutenberg Shakespeare eBook #100.
 * 
 * - Strips Gutenberg header and footer while preserving text and license notes.
 * - Splits by complete works (seed 42): 4 held out works (2 comedies, 1 tragedy, 1 history) as VAL.
 * - Trains BPE-1024 tokenizer on the TRAIN partition.
 * - Stores gzip-compressed assets in packages/ml-core/data/ for lazy loading.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { fileURLToPath } from 'url';

import { ByteBPE } from '../src/tokenizers/bpe.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data');

class SplitMix32 {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0;
  }
  next(): number {
    this.s = (this.s + 0x9e3779b9) >>> 0;
    let z = this.s;
    z = Math.imul(z ^ (z >>> 16), 0x21f0aaad);
    z = Math.imul(z ^ (z >>> 15), 0x735a2d97);
    return ((z ^ (z >>> 15)) >>> 0) / 4294967296;
  }
  nextInt(max: number): number {
    return Math.floor(this.next() * max);
  }
  sample<T>(arr: T[], k: number): T[] {
    const copy = [...arr];
    const res: T[] = [];
    for (let i = 0; i < k; i++) {
      const idx = this.nextInt(copy.length);
      res.push(copy.splice(idx, 1)[0]);
    }
    return res;
  }
}

export async function buildCorpus() {
  console.log('Downloading Project Gutenberg eBook #100 (Shakespeare Complete Works)...');
  const res = await fetch('https://www.gutenberg.org/files/100/100-0.txt');
  if (!res.ok) {
    throw new Error(`Failed to download eBook #100: HTTP ${res.status}`);
  }
  const text = await res.text();

  const startMarker = '*** START OF THE PROJECT GUTENBERG EBOOK 100 ***';
  const endMarker = '*** END OF THE PROJECT GUTENBERG EBOOK 100 ***';
  const startIdx = text.indexOf(startMarker);
  const endIdx = text.indexOf(endMarker);

  if (startIdx === -1 || endIdx === -1) {
    throw new Error('Gutenberg start/end markers not found.');
  }

  // Strip Gutenberg header and footer
  const rawBody = text.slice(startIdx + startMarker.length, endIdx).trim();

  // Canonical works list in eBook #100 sequence
  const worksMeta = [
    { title: 'THE SONNETS', genre: 'poetry' },
    { title: 'ALL’S WELL THAT ENDS WELL', genre: 'comedy' },
    { title: 'THE TRAGEDY OF ANTONY AND CLEOPATRA', genre: 'tragedy' },
    { title: 'AS YOU LIKE IT', genre: 'comedy' },
    { title: 'THE COMEDY OF ERRORS', genre: 'comedy' },
    { title: 'THE TRAGEDY OF CORIOLANUS', genre: 'tragedy' },
    { title: 'CYMBELINE', genre: 'comedy' },
    { title: 'THE TRAGEDY OF HAMLET, PRINCE OF DENMARK', genre: 'tragedy' },
    { title: 'THE FIRST PART OF KING HENRY THE FOURTH', genre: 'history' },
    { title: 'THE SECOND PART OF KING HENRY THE FOURTH', genre: 'history' },
    { title: 'THE LIFE OF KING HENRY THE FIFTH', genre: 'history' },
    { title: 'THE FIRST PART OF HENRY THE SIXTH', genre: 'history' },
    { title: 'THE SECOND PART OF KING HENRY THE SIXTH', genre: 'history' },
    { title: 'THE THIRD PART OF KING HENRY THE SIXTH', genre: 'history' },
    { title: 'KING HENRY THE EIGHTH', genre: 'history' },
    { title: 'THE LIFE AND DEATH OF KING JOHN', genre: 'history' },
    { title: 'THE TRAGEDY OF JULIUS CAESAR', genre: 'tragedy' },
    { title: 'THE TRAGEDY OF KING LEAR', genre: 'tragedy' },
    { title: 'LOVE’S LABOUR’S LOST', genre: 'comedy' },
    { title: 'THE TRAGEDY OF MACBETH', genre: 'tragedy' },
    { title: 'MEASURE FOR MEASURE', genre: 'comedy' },
    { title: 'THE MERCHANT OF VENICE', genre: 'comedy' },
    { title: 'THE MERRY WIVES OF WINDSOR', genre: 'comedy' },
    { title: 'A MIDSUMMER NIGHT’S DREAM', genre: 'comedy' },
    { title: 'MUCH ADO ABOUT NOTHING', genre: 'comedy' },
    { title: 'THE TRAGEDY OF OTHELLO, THE MOOR OF VENICE', genre: 'tragedy' },
    { title: 'PERICLES, PRINCE OF TYRE', genre: 'comedy' },
    { title: 'KING RICHARD THE SECOND', genre: 'history' },
    { title: 'KING RICHARD THE THIRD', genre: 'history' },
    { title: 'THE TRAGEDY OF ROMEO AND JULIET', genre: 'tragedy' },
    { title: 'THE TAMING OF THE SHREW', genre: 'comedy' },
    { title: 'THE TEMPEST', genre: 'comedy' },
    { title: 'THE LIFE OF TIMON OF ATHENS', genre: 'tragedy' },
    { title: 'THE TRAGEDY OF TITUS ANDRONICUS', genre: 'tragedy' },
    { title: 'TROILUS AND CRESSIDA', genre: 'tragedy' },
    { title: 'TWELFTH NIGHT; OR, WHAT YOU WILL', genre: 'comedy' },
    { title: 'THE TWO GENTLEMEN OF VERONA', genre: 'comedy' },
    { title: 'THE TWO NOBLE KINSMEN', genre: 'comedy' },
    { title: 'THE WINTER’S TALE', genre: 'comedy' },
    { title: 'A LOVER’S COMPLAINT', genre: 'poetry' },
    { title: 'THE PASSIONATE PILGRIM', genre: 'poetry' },
    { title: 'THE PHOENIX AND THE TURTLE', genre: 'poetry' },
    { title: 'THE RAPE OF LUCRECE', genre: 'poetry' },
    { title: 'VENUS AND ADONIS', genre: 'poetry' }
  ];

  let searchPos = 0;
  const worksWithOffsets: Array<typeof worksMeta[0] & { start: number; end: number; text: string }> = [];

  for (let i = 0; i < worksMeta.length; i++) {
    const item = worksMeta[i];
    let pos = rawBody.indexOf('\n\n\n\n' + item.title, Math.max(0, searchPos - 50));
    if (pos === -1) pos = rawBody.indexOf('\n\n\n' + item.title, Math.max(0, searchPos - 50));
    if (pos === -1) pos = rawBody.indexOf('\n\n' + item.title, Math.max(0, searchPos - 50));
    if (pos === -1) pos = rawBody.indexOf(item.title, Math.max(0, searchPos - 50));
    if (pos === -1) throw new Error(`Could not find ${item.title}`);

    worksWithOffsets.push({ ...item, start: pos, end: 0, text: '' });
    searchPos = pos + item.title.length;
  }

  for (let i = 0; i < worksWithOffsets.length; i++) {
    const end = (i < worksWithOffsets.length - 1) ? worksWithOffsets[i + 1].start : rawBody.length;
    worksWithOffsets[i].end = end;
    worksWithOffsets[i].text = rawBody.slice(worksWithOffsets[i].start, end).trim();
  }

  // Genre selection (seed 42: 2 comedies, 1 tragedy, 1 history)
  const comedies = worksWithOffsets.filter(w => w.genre === 'comedy');
  const tragedies = worksWithOffsets.filter(w => w.genre === 'tragedy');
  const histories = worksWithOffsets.filter(w => w.genre === 'history');

  const rng = new SplitMix32(42);
  const valComedies = rng.sample(comedies, 2);
  const valTragedies = rng.sample(tragedies, 1);
  const valHistories = rng.sample(histories, 1);

  const valWorks = [...valComedies, ...valTragedies, ...valHistories];
  const valTitles = new Set(valWorks.map(w => w.title));

  const trainWorks = worksWithOffsets.filter(w => !valTitles.has(w.title));
  const preface = rawBody.slice(0, worksWithOffsets[0].start).trim();
  const trainText = [preface, ...trainWorks.map(w => w.text)].join('\n\n\n');
  const valText = valWorks.map(w => w.text).join('\n\n\n');

  console.log('Training ByteBPE-1024 Tokenizer on TRAIN text...');
  const bpe = new ByteBPE();
  bpe.train(trainText, 1024, 2);

  console.log('Encoding TRAIN and VAL splits...');
  const trainTokens = bpe.encode(trainText);
  const valTokens = bpe.encode(valText);

  // Measure Statistics
  const trainBytes = Buffer.byteLength(trainText, 'utf-8');
  const valBytes = Buffer.byteLength(valText, 'utf-8');
  const fullBytes = Buffer.byteLength(rawBody, 'utf-8');

  const trainChars = trainText.length;
  const valChars = valText.length;
  const totalChars = fullBytes; // full raw characters

  const trainTokenCount = trainTokens.length;
  const valTokenCount = valTokens.length;

  const trainCharsPerTok = trainChars / trainTokenCount;
  const valCharsPerTok = valChars / valTokenCount;
  const totalCharsPerTok = (trainChars + valChars) / (trainTokenCount + valTokenCount);

  // Write outputs to packages/ml-core/data/
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // 1. Raw stripped input.txt (Shakespeare Complete Works)
  fs.writeFileSync(path.join(DATA_DIR, 'input.txt'), rawBody, 'utf-8');
  
  // 2. Gzip-compressed assets for lazy loading
  const fullGz = zlib.gzipSync(Buffer.from(rawBody, 'utf-8'), { level: 9 });
  fs.writeFileSync(path.join(DATA_DIR, 'input.txt.gz'), fullGz);

  const trainGz = zlib.gzipSync(Buffer.from(trainText, 'utf-8'), { level: 9 });
  fs.writeFileSync(path.join(DATA_DIR, 'train_text.txt.gz'), trainGz);

  const valGz = zlib.gzipSync(Buffer.from(valText, 'utf-8'), { level: 9 });
  fs.writeFileSync(path.join(DATA_DIR, 'val_text.txt.gz'), valGz);

  // 3. Pretrained BPE-1024 JSON and GZ
  const bpeJson = bpe.toJSON();
  fs.writeFileSync(path.join(DATA_DIR, 'bpe_1024.json'), bpeJson, 'utf-8');
  const bpeGz = zlib.gzipSync(Buffer.from(bpeJson, 'utf-8'), { level: 9 });
  fs.writeFileSync(path.join(DATA_DIR, 'bpe_1024.json.gz'), bpeGz);

  // 4. Manifest JSON
  const manifest = {
    title: 'The Complete Works of William Shakespeare',
    edition: 'Project Gutenberg eBook #100',
    heldOutWorks: valWorks.map(w => ({ title: w.title, genre: w.genre, characters: w.text.length })),
    trainWorksCount: trainWorks.length,
    valWorksCount: valWorks.length,
    statistics: {
      fileBytes: fullBytes,
      gzippedBytes: fullGz.length,
      characters: {
        total: rawBody.length,
        train: trainChars,
        val: valChars
      },
      bpe1024Tokens: {
        train: trainTokenCount,
        val: valTokenCount,
        total: trainTokenCount + valTokenCount
      },
      charsPerToken: {
        train: Number(trainCharsPerTok.toFixed(3)),
        val: Number(valCharsPerTok.toFixed(3)),
        overall: Number(totalCharsPerTok.toFixed(3))
      }
    }
  };

  fs.writeFileSync(path.join(DATA_DIR, 'corpus_manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8');

  console.log('\n================ CORPUS BUILD COMPLETE ================');
  console.log(`File Bytes (raw):         ${fullBytes.toLocaleString()} bytes`);
  console.log(`Gzip Compressed Bytes:    ${fullGz.length.toLocaleString()} bytes (${(fullGz.length / 1024 / 1024).toFixed(2)} MB)`);
  console.log(`Total Characters:         ${rawBody.length.toLocaleString()}`);
  console.log(`TRAIN Characters:         ${trainChars.toLocaleString()} (${((trainChars / rawBody.length) * 100).toFixed(2)}%)`);
  console.log(`VAL Characters:           ${valChars.toLocaleString()} (${((valChars / rawBody.length) * 100).toFixed(2)}%)`);
  console.log(`TRAIN BPE-1024 Tokens:    ${trainTokenCount.toLocaleString()}`);
  console.log(`VAL BPE-1024 Tokens:      ${valTokenCount.toLocaleString()}`);
  console.log(`TRAIN chars/token:        ${trainCharsPerTok.toFixed(3)}`);
  console.log(`VAL chars/token:          ${valCharsPerTok.toFixed(3)}`);
  console.log(`Overall chars/token:      ${totalCharsPerTok.toFixed(3)}`);
  console.log('Held-out works:');
  for (const w of valWorks) {
    console.log(` - [${w.genre.toUpperCase()}] ${w.title} (${w.text.length.toLocaleString()} chars)`);
  }
  console.log('========================================================\n');

  return manifest;
}

// Run directly if invoked
buildCorpus().catch(console.error);

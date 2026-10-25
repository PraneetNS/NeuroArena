/**
 * Canonical Shakespeare Corpus & Validation Split Provenance.
 * 
 * Sourced from Project Gutenberg eBook #100 ("The Complete Works of William Shakespeare").
 * Header/footer boilerplate stripped; license notes maintained.
 * Split by COMPLETE WORKS (seed 42): 4 held out works (2 comedies, 1 tragedy, 1 history) as VAL.
 * 
 * Universal module: 100% browser-safe (no top-level Node built-in imports).
 */

import { ByteBPE } from '../tokenizers/bpe.js';

export interface WorkMetadata {
  title: string;
  genre: 'comedy' | 'tragedy' | 'history' | 'poetry';
  characters: number;
}

export const HELD_OUT_WORKS: WorkMetadata[] = [
  { title: 'THE COMEDY OF ERRORS', genre: 'comedy', characters: 88328 },
  { title: 'ALL’S WELL THAT ENDS WELL', genre: 'comedy', characters: 134619 },
  { title: 'THE TRAGEDY OF ANTONY AND CLEOPATRA', genre: 'tragedy', characters: 152395 },
  { title: 'THE LIFE AND DEATH OF KING JOHN', genre: 'history', characters: 121394 }
];

export const CORPUS_PROVENANCE = {
  edition: 'Project Gutenberg eBook #100',
  totalWorks: 44,
  trainWorksCount: 40,
  valWorksCount: 4,
  splitSeed: 42,
  fileBytes: 5422619,
  gzippedBytes: 2090578,
  characters: {
    total: 5359342,
    train: 4862508,
    val: 496745,
    valPercentage: 9.27
  },
  bpe1024Tokens: {
    total: 2957826,
    train: 2680959,
    val: 276867,
    valPercentage: 9.36
  },
  charsPerToken: {
    train: 1.814,
    val: 1.794,
    overall: 1.812
  }
} as const;

// Legacy compatibility exports
export const BUNDLED_CORPUS_PATH = 'packages/ml-core/data/input.txt';
export const TOTAL_CORPUS_CHARS = CORPUS_PROVENANCE.characters.total;
export const VAL_START_OFFSET = CORPUS_PROVENANCE.characters.train;
export const VAL_END_OFFSET = CORPUS_PROVENANCE.characters.total;
export const VAL_CHAR_COUNT = CORPUS_PROVENANCE.characters.val;
export const VAL_SPLIT_RATIO = 0.0927;

// In-memory caches for lazy loading
let cachedTrainText: string | null = null;
let cachedValText: string | null = null;
let cachedTokenizer: ByteBPE | null = null;
let cachedTrainTokens: Uint16Array | null = null;
let cachedValTokens: Uint16Array | null = null;

// Node environment helpers loaded lazily
let nodeFs: any = null;
let nodePath: any = null;
let nodeZlib: any = null;

function getNodeModules() {
  if (typeof window !== 'undefined') return null;
  const proc = (globalThis as any).process;
  if (!proc?.versions?.node) return null;
  if (!nodeFs) {
    try {
      if (typeof proc.getBuiltinModule === 'function') {
        nodeFs = proc.getBuiltinModule('fs');
        nodePath = proc.getBuiltinModule('path');
        nodeZlib = proc.getBuiltinModule('zlib');
      }
    } catch {
      // Fallback
    }
    if (!nodeFs) {
      try {
        const req = proc.mainModule?.require || (eval('typeof require !== "undefined"') ? eval('require') : null);
        if (req) {
          nodeFs = req('fs');
          nodePath = req('path');
          nodeZlib = req('zlib');
        }
      } catch {
        // ES module fallback
      }
    }
  }
  return { fs: nodeFs, path: nodePath, zlib: nodeZlib };
}

function getDataDir(node: any): string | null {
  let curr = process.cwd();
  for (let i = 0; i < 6; i++) {
    const candidate = node.path.join(curr, 'packages/ml-core/data');
    if (node.fs.existsSync(candidate)) return candidate;
    const directCandidate = node.path.join(curr, 'data');
    if (node.fs.existsSync(node.path.join(directCandidate, 'val_text.txt.gz'))) return directCandidate;
    const parent = node.path.dirname(curr);
    if (parent === curr) break;
    curr = parent;
  }
  return null;
}

/**
 * Lazy loads and returns the VAL text split.
 */
export function getValText(): string {
  if (cachedValText) return cachedValText;

  const node = getNodeModules();
  if (node?.fs && node?.path && node?.zlib) {
    // Node environment
    const dataDir = getDataDir(node);
    if (dataDir) {
      const gzPath = node.path.join(dataDir, 'val_text.txt.gz');
      if (node.fs.existsSync(gzPath)) {
        const gzBuf = node.fs.readFileSync(gzPath);
        cachedValText = node.zlib.gunzipSync(gzBuf).toString('utf-8');
        return cachedValText!;
      }
      const txtPath = node.path.join(dataDir, 'input.txt');
      if (node.fs.existsSync(txtPath)) {
        const fullText = node.fs.readFileSync(txtPath, 'utf-8');
        cachedValText = fullText.slice(-CORPUS_PROVENANCE.characters.val);
        return cachedValText!;
      }
    }
  }

  // Browser fallback
  return 'THE COMEDY OF ERRORS\nALL’S WELL THAT ENDS WELL\nTHE TRAGEDY OF ANTONY AND CLEOPATRA\nTHE LIFE AND DEATH OF KING JOHN';
}

/**
 * Lazy loads and returns the TRAIN text split.
 */
export function getTrainText(): string {
  if (cachedTrainText) return cachedTrainText;

  const node = getNodeModules();
  if (node?.fs && node?.path && node?.zlib) {
    const dataDir = getDataDir(node);
    if (dataDir) {
      const gzPath = node.path.join(dataDir, 'train_text.txt.gz');
      if (node.fs.existsSync(gzPath)) {
        const gzBuf = node.fs.readFileSync(gzPath);
        cachedTrainText = node.zlib.gunzipSync(gzBuf).toString('utf-8');
        return cachedTrainText!;
      }
      const txtPath = node.path.join(dataDir, 'input.txt');
      if (node.fs.existsSync(txtPath)) {
        const fullText = node.fs.readFileSync(txtPath, 'utf-8');
        cachedTrainText = fullText.slice(0, CORPUS_PROVENANCE.characters.train);
        return cachedTrainText!;
      }
    }
  }

  return 'The Complete Works of William Shakespeare TRAIN partition.';
}

/**
 * Lazy loads the pre-trained ByteBPE-1024 tokenizer.
 */
export function getBpeTokenizer(): ByteBPE {
  if (cachedTokenizer) return cachedTokenizer;

  const node = getNodeModules();
  if (node?.fs && node?.path && node?.zlib) {
    const dataDir = getDataDir(node);
    if (dataDir) {
      const bpeGz = node.path.join(dataDir, 'bpe_1024.json.gz');
      const bpeJson = node.path.join(dataDir, 'bpe_1024.json');

      if (node.fs.existsSync(bpeGz)) {
        const decompressed = node.zlib.gunzipSync(node.fs.readFileSync(bpeGz)).toString('utf-8');
        cachedTokenizer = ByteBPE.fromJSON(decompressed);
        return cachedTokenizer;
      } else if (node.fs.existsSync(bpeJson)) {
        const jsonStr = node.fs.readFileSync(bpeJson, 'utf-8');
        cachedTokenizer = ByteBPE.fromJSON(jsonStr);
        return cachedTokenizer;
      }
    }
  }

  // Fallback tokenizer
  const tok = new ByteBPE();
  tok.train(getTrainText(), 1024, 2);
  cachedTokenizer = tok;
  return cachedTokenizer;
}

/**
 * Sets preloaded train and val tokens (e.g. from browser assets or API)
 */
export function setCachedTokens(train: Uint16Array, val: Uint16Array): void {
  cachedTrainTokens = train;
  cachedValTokens = val;
}

/**
 * Lazy loads and caches the tokenized validation set under BPE-1024.
 */
export function getValTokens(): Uint16Array {
  if (cachedValTokens) return cachedValTokens;
  const tokenizer = getBpeTokenizer();
  const valText = getValText();
  const toks = tokenizer.encode(valText);
  cachedValTokens = new Uint16Array(toks);
  return cachedValTokens;
}

/**
 * Lazy loads and caches the tokenized training set under BPE-1024.
 */
export function getTrainTokens(): Uint16Array {
  if (cachedTrainTokens) return cachedTrainTokens;
  const tokenizer = getBpeTokenizer();
  const trainText = getTrainText();
  const toks = tokenizer.encode(trainText);
  cachedTrainTokens = new Uint16Array(toks);
  return cachedTrainTokens;
}

export const VALIDATION_CORPUS_TEXT = getValText();

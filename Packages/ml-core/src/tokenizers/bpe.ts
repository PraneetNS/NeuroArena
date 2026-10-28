/**
 * Byte-level Byte-Pair Encoding (ByteBPE) Tokenizer with in-browser / Node trainer,
 * regex word pre-splitting, fast memoized encoding, lossless decoding, and JSON serialization.
 */

// Regular expression to pre-split text into words, whitespace runs, and punctuation
// Merges never cross word boundaries
const WORD_REGEX = /\s+|[^\s\w]+|\w+/g;

export class ByteBPE {
  // Mapping from pairKey ((id1 << 16) | id2) to new token id
  public pairToId: Map<number, number> = new Map();
  // Mapping from pairKey ((id1 << 16) | id2) to merge rank (0-indexed order of creation)
  public pairToRank: Map<number, number> = new Map();
  // Mapping from token id to [id1, id2]
  public idToPair: Map<number, [number, number]> = new Map();
  // Sequence of learned merges: [id1, id2, newId]
  public merges: Array<[number, number, number]> = [];

  // Token ID to exact raw bytes
  private tokenBytes: Map<number, Uint8Array> = new Map();

  // Fast memoization cache: word string -> array of token IDs
  private wordCache: Map<string, number[]> = new Map();

  private textEncoder = new TextEncoder();
  private textDecoder = new TextDecoder('utf-8', { fatal: false });

  constructor() {
    this.reset();
  }

  public reset(): void {
    this.pairToId.clear();
    this.pairToRank.clear();
    this.idToPair.clear();
    this.merges = [];
    this.tokenBytes.clear();
    this.wordCache.clear();

    // Base vocabulary: 256 individual byte values
    for (let b = 0; b < 256; b++) {
      this.tokenBytes.set(b, new Uint8Array([b]));
    }
  }

  public get vocabSize(): number {
    return 256 + this.merges.length;
  }

  /**
   * Trains BPE merges on raw text corpus up to targetVocabSize (e.g. 1024 or 2048).
   * Pre-splits text into words with a regex so merges do not cross word boundaries.
   */
  public train(corpus: string, targetVocabSize = 1024, minFrequency = 2): void {
    this.reset();
    if (!corpus) return;

    // 1. Pre-split corpus into words and compute frequency of each unique word
    const words = corpus.match(WORD_REGEX) || [];
    const wordCounts = new Map<string, number>();
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      wordCounts.set(w, (wordCounts.get(w) || 0) + 1);
    }

    // 2. Convert each unique word into an array of byte tokens
    const uniqueWords: Array<{ tokens: number[]; count: number }> = [];
    for (const [w, count] of wordCounts.entries()) {
      const bytes = this.textEncoder.encode(w);
      uniqueWords.push({ tokens: Array.from(bytes), count });
    }

    // 3. Initialize pair frequencies and inverted word index (pairKey -> set of word indices)
    const pairCounts = new Map<number, number>();
    const pairToWords = new Map<number, Set<number>>();

    for (let i = 0; i < uniqueWords.length; i++) {
      const toks = uniqueWords[i].tokens;
      const count = uniqueWords[i].count;
      for (let j = 0; j < toks.length - 1; j++) {
        const key = (toks[j] << 16) | toks[j + 1];
        pairCounts.set(key, (pairCounts.get(key) || 0) + count);
        let set = pairToWords.get(key);
        if (!set) {
          set = new Set();
          pairToWords.set(key, set);
        }
        set.add(i);
      }
    }

    // 4. Iteratively merge most frequent pairs using incremental updates
    while (this.vocabSize < targetVocabSize) {
      let bestKey = -1;
      let maxCount = 0;

      for (const [key, count] of pairCounts.entries()) {
        if (count > maxCount) {
          maxCount = count;
          bestKey = key;
        }
      }

      if (maxCount < minFrequency || bestKey === -1) {
        break; // No pairs meet frequency threshold
      }

      const p1 = (bestKey >>> 16) & 0xffff;
      const p2 = bestKey & 0xffff;
      const newId = this.vocabSize;
      const rank = this.merges.length;

      // Register merge rule
      this.pairToId.set(bestKey, newId);
      this.pairToRank.set(bestKey, rank);
      this.idToPair.set(newId, [p1, p2]);
      this.merges.push([p1, p2, newId]);

      // Cache concatenated byte representation
      const b1 = this.tokenBytes.get(p1)!;
      const b2 = this.tokenBytes.get(p2)!;
      const combined = new Uint8Array(b1.length + b2.length);
      combined.set(b1, 0);
      combined.set(b2, b1.length);
      this.tokenBytes.set(newId, combined);

      // Retrieve words affected by this merge
      const affectedIndices = pairToWords.get(bestKey);
      pairCounts.delete(bestKey);
      pairToWords.delete(bestKey);

      if (!affectedIndices) continue;

      for (const wIdx of affectedIndices) {
        const item = uniqueWords[wIdx];
        const toks = item.tokens;
        const count = item.count;

        let hasPair = false;
        for (let j = 0; j < toks.length - 1; j++) {
          if (toks[j] === p1 && toks[j + 1] === p2) {
            hasPair = true;
            break;
          }
        }
        if (!hasPair) continue;

        // Subtract old adjacent pairs for this word
        for (let j = 0; j < toks.length - 1; j++) {
          const key = (toks[j] << 16) | toks[j + 1];
          const curr = pairCounts.get(key) || 0;
          if (curr <= count) {
            pairCounts.delete(key);
          } else {
            pairCounts.set(key, curr - count);
          }
          pairToWords.get(key)?.delete(wIdx);
        }

        // Apply merge
        const nextToks: number[] = [];
        let j = 0;
        while (j < toks.length) {
          if (j < toks.length - 1 && toks[j] === p1 && toks[j + 1] === p2) {
            nextToks.push(newId);
            j += 2;
          } else {
            nextToks.push(toks[j]);
            j += 1;
          }
        }
        item.tokens = nextToks;

        // Add new adjacent pairs for this word
        for (let j = 0; j < nextToks.length - 1; j++) {
          const key = (nextToks[j] << 16) | nextToks[j + 1];
          pairCounts.set(key, (pairCounts.get(key) || 0) + count);
          let set = pairToWords.get(key);
          if (!set) {
            set = new Set();
            pairToWords.set(key, set);
          }
          set.add(wIdx);
        }
      }
    }
  }

  /**
   * Encodes a single word using rank-based BPE merges.
   */
  private encodeWord(word: string): number[] {
    const cached = this.wordCache.get(word);
    if (cached !== undefined) return cached;

    const rawBytes = this.textEncoder.encode(word);
    let tokens: number[] = Array.from(rawBytes);

    while (tokens.length >= 2) {
      // Find pair with lowest merge rank
      let minRank = Infinity;
      let minIdx = -1;
      let bestNewId = -1;

      for (let i = 0; i < tokens.length - 1; i++) {
        const key = (tokens[i] << 16) | tokens[i + 1];
        const rank = this.pairToRank.get(key);
        if (rank !== undefined && rank < minRank) {
          minRank = rank;
          minIdx = i;
          bestNewId = this.pairToId.get(key)!;
        }
      }

      if (minIdx === -1) {
        break; // No further valid merges
      }

      // Replace the lowest-rank pair
      const nextTokens: number[] = [];
      let i = 0;
      const p1 = tokens[minIdx];
      const p2 = tokens[minIdx + 1];

      while (i < tokens.length) {
        if (i < tokens.length - 1 && tokens[i] === p1 && tokens[i + 1] === p2) {
          nextTokens.push(bestNewId);
          i += 2;
        } else {
          nextTokens.push(tokens[i]);
          i += 1;
        }
      }
      tokens = nextTokens;
    }

    if (this.wordCache.size >= 10000) {
      this.wordCache.clear();
    }
    this.wordCache.set(word, tokens);
    return tokens;
  }

  /**
   * Encodes a string into Uint16Array of BPE token IDs.
   * Pre-splits with regex and leverages word caching for extreme throughput.
   */
  public encode(text: string): Uint16Array {
    if (!text) return new Uint16Array(0);

    const words = text.match(WORD_REGEX) || [];
    const allTokens: number[] = [];

    for (let i = 0; i < words.length; i++) {
      const wordTokens = this.encodeWord(words[i]);
      for (let j = 0; j < wordTokens.length; j++) {
        allTokens.push(wordTokens[j]);
      }
    }

    return new Uint16Array(allTokens);
  }

  /**
   * Decodes Uint16Array token IDs back into string.
   */
  public decode(tokens: Uint16Array | number[]): string {
    if (tokens.length === 0) return '';

    const byteChunks: Uint8Array[] = [];
    let totalLen = 0;

    for (let i = 0; i < tokens.length; i++) {
      const id = tokens[i];
      let bytes = this.tokenBytes.get(id);
      if (!bytes) {
        bytes = this.expandToken(id);
        this.tokenBytes.set(id, bytes);
      }
      byteChunks.push(bytes);
      totalLen += bytes.length;
    }

    const flatBytes = new Uint8Array(totalLen);
    let offset = 0;
    for (let i = 0; i < byteChunks.length; i++) {
      const chunk = byteChunks[i];
      flatBytes.set(chunk, offset);
      offset += chunk.length;
    }

    return this.textDecoder.decode(flatBytes);
  }

  private expandToken(id: number): Uint8Array {
    if (id < 256) {
      return new Uint8Array([id]);
    }
    const pair = this.idToPair.get(id);
    if (!pair) {
      return new Uint8Array(0);
    }
    const b1 = this.expandToken(pair[0]);
    const b2 = this.expandToken(pair[1]);
    const merged = new Uint8Array(b1.length + b2.length);
    merged.set(b1, 0);
    merged.set(b2, b1.length);
    return merged;
  }

  /**
   * Serializes tokenizer to JSON.
   */
  public toJSON(): string {
    return JSON.stringify(
      {
        type: 'byte_bpe',
        vocabSize: this.vocabSize,
        merges: this.merges
      },
      null,
      2
    );
  }

  /**
   * Restores tokenizer from JSON.
   */
  public static fromJSON(jsonStr: string): ByteBPE {
    const data = JSON.parse(jsonStr);
    const tok = new ByteBPE();
    tok.reset();

    for (let rank = 0; rank < data.merges.length; rank++) {
      const [p1, p2, newId] = data.merges[rank];
      const pairKey = (p1 << 16) | p2;
      tok.pairToId.set(pairKey, newId);
      tok.pairToRank.set(pairKey, rank);
      tok.idToPair.set(newId, [p1, p2]);
      tok.merges.push([p1, p2, newId]);

      const b1 = tok.tokenBytes.get(p1)!;
      const b2 = tok.tokenBytes.get(p2)!;
      const combined = new Uint8Array(b1.length + b2.length);
      combined.set(b1, 0);
      combined.set(b2, b1.length);
      tok.tokenBytes.set(newId, combined);
    }

    return tok;
  }
}

// Backward-compatibility alias
export const BytePairTokenizer = ByteBPE;

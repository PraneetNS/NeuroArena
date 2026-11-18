/**
 * Maps curly quotes, dashes, ligatures, and accented characters to plain ASCII.
 */
export function normalizeText(str: string): string {
  return str
    // Curly quotes & apostrophes -> standard '
    .replace(/[\u2018\u2019\u201A\u201B\u00B4\u0060]/g, "'")
    // Curly double quotes -> standard "
    .replace(/[\u201C\u201D\u201E\u201F\u00AB\u00BB]/g, '"')
    // Dashes (em-dash, en-dash, horizontal bar, minus) -> standard -
    .replace(/[\u2013\u2014\u2015\u2212]/g, '-')
    // Ligatures
    .replace(/\u00E6/g, 'ae')
    .replace(/\u00C6/g, 'AE')
    .replace(/\u0153/g, 'oe')
    .replace(/\u0152/g, 'OE')
    // Accented characters to plain ASCII via NFD decomposition
    .normalize('NFD')
    .replace(/[\u0300-\u036F]/g, '');
}

export class CharTokenizer {
  public charToId: Map<string, number> = new Map();
  public idToChar: Map<number, string> = new Map();
  public unkId = 0;

  constructor() {
    this.charToId.set('<|unk|>', 0);
    this.idToChar.set(0, '<|unk|>');
  }

  public get vocabSize(): number {
    return this.charToId.size;
  }

  /**
   * Builds vocabulary from training text corpus.
   */
  public buildVocab(corpus: string, options?: { normalize?: boolean }): void {
    const textToProcess = options?.normalize ? normalizeText(corpus) : corpus;
    this.charToId.clear();
    this.idToChar.clear();

    this.charToId.set('<|unk|>', 0);
    this.idToChar.set(0, '<|unk|>');

    const charCounts = new Map<string, number>();
    for (const char of textToProcess) {
      charCounts.set(char, (charCounts.get(char) || 0) + 1);
    }

    // Sort by frequency
    const sorted = Array.from(charCounts.entries()).sort((a, b) => b[1] - a[1]);
    for (const [char] of sorted) {
      if (!this.charToId.has(char)) {
        const id = this.charToId.size;
        this.charToId.set(char, id);
        this.idToChar.set(id, char);
      }
    }
  }

  /**
   * Encodes string to Uint16Array of token IDs.
   */
  public encode(text: string): Uint16Array {
    const out = new Uint16Array(text.length);
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const id = this.charToId.get(char);
      out[i] = id !== undefined ? id : this.unkId;
    }
    return out;
  }

  /**
   * Decodes Uint16Array back into string.
   */
  public decode(tokens: Uint16Array | number[]): string {
    let result = '';
    for (let i = 0; i < tokens.length; i++) {
      const id = tokens[i];
      const char = this.idToChar.get(id);
      if (char !== undefined && id !== this.unkId) {
        result += char;
      }
    }
    return result;
  }

  /**
   * Tokenizer statistics helper for UI data curation.
   */
  public getStats(corpus: string): {
    totalChars: number;
    uniqueChars: number;
    topTokens: Array<{ token: string; id: number; count: number }>;
  } {
    const counts = new Map<number, number>();
    for (const char of corpus) {
      const id = this.charToId.get(char) ?? this.unkId;
      counts.set(id, (counts.get(id) || 0) + 1);
    }
    const topTokens = Array.from(counts.entries())
      .map(([id, count]) => ({
        token: this.idToChar.get(id) ?? '',
        id,
        count
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);

    return {
      totalChars: corpus.length,
      uniqueChars: this.vocabSize,
      topTokens
    };
  }

  /**
   * Visual span tokenizer for text stream highlighting in UI.
   */
  public tokenizeWithSpans(text: string): Array<{ text: string; id: number }> {
    const spans: Array<{ text: string; id: number }> = [];
    for (const char of text) {
      const id = this.charToId.get(char) ?? this.unkId;
      spans.push({ text: char, id });
    }
    return spans;
  }


  /**
   * JSON Serialization
   */
  public toJSON(): string {
    const entries = Array.from(this.charToId.entries());
    return JSON.stringify({
      type: 'char',
      vocabSize: this.vocabSize,
      entries
    }, null, 2);
  }

  /**
   * JSON Deserialization
   */
  public static fromJSON(jsonStr: string): CharTokenizer {
    const data = JSON.parse(jsonStr);
    const tok = new CharTokenizer();
    tok.charToId.clear();
    tok.idToChar.clear();
    for (const [char, id] of data.entries) {
      tok.charToId.set(char, id);
      tok.idToChar.set(id, char);
    }
    return tok;
  }
}

/**
 * Autoregressive sampling via an AsyncGenerator with temperature scaling,
 * Top-K, and Nucleus Top-P filtering.
 */

import { TinyGPT } from './model.js';
import { Xoshiro128StarStar } from './rng.js';

export interface GenerateOptions {
  maxTokens?: number;
  maxNewTokens?: number;
  temperature?: number;
  topK?: number;
  topP?: number;
  rng?: Xoshiro128StarStar;
}

export async function* sample(
  model: TinyGPT,
  promptIds: Uint16Array | number[],
  options: GenerateOptions = {}
): AsyncGenerator<number, void, unknown> {
  yield* generate(model, promptIds, options);
}

export async function* generate(
  model: TinyGPT,
  promptIds: Uint16Array | number[],
  options: GenerateOptions = {}
): AsyncGenerator<number, void, unknown> {
  const contextLen = model.config.contextLen;
  const vocabSize = model.config.vocabSize;
  const maxTokens = options.maxNewTokens ?? options.maxTokens ?? contextLen;
  const temperature = Math.max(1e-4, options.temperature ?? 0.8);
  const topK = options.topK ?? 10;
  const topP = options.topP ?? 0.9;
  const rng = options.rng ?? new Xoshiro128StarStar(Date.now() & 0xffffffff);

  const tokens: number[] = Array.from(promptIds);
  if (tokens.length === 0) {
    tokens.push(0);
  }

  for (let step = 0; step < maxTokens; step++) {
    // 1. Sliding window context
    const currentContext = tokens.slice(-contextLen);
    const T = currentContext.length;
    const inputBuf = new Uint16Array(currentContext);

    // 2. Forward pass for single batch (B = 1)
    const { logits } = model.forward(inputBuf, 1, T);

    // 3. Extract logits at the last position (T - 1)
    const lastOffset = (T - 1) * vocabSize;
    const scaledLogits = new Float64Array(vocabSize);
    for (let v = 0; v < vocabSize; v++) {
      scaledLogits[v] = logits[lastOffset + v] / temperature;
    }

    // 4. Top-K filtering
    const candidates = Array.from({ length: vocabSize }, (_, i) => ({
      id: i,
      val: scaledLogits[i]
    }));
    candidates.sort((a, b) => b.val - a.val);

    const kFiltered = topK > 0 ? candidates.slice(0, Math.min(topK, vocabSize)) : candidates;

    // 5. Softmax over Top-K candidates
    const maxVal = kFiltered[0].val;
    let sumExp = 0;
    const probs = kFiltered.map(c => {
      const p = Math.exp(c.val - maxVal);
      sumExp += p;
      return { id: c.id, p };
    });
    for (const item of probs) {
      item.p /= sumExp;
    }

    // 6. Top-P (nucleus) filtering
    let cumProb = 0;
    const nucleus: typeof probs = [];
    for (const item of probs) {
      nucleus.push(item);
      cumProb += item.p;
      if (cumProb >= topP) break;
    }

    let nSum = 0;
    for (const item of nucleus) nSum += item.p;
    for (const item of nucleus) item.p /= nSum;

    // 7. Categorical sampling using seeded RNG
    const r = rng.nextFloat();
    let acc = 0;
    let nextToken = nucleus[0].id;
    for (const item of nucleus) {
      acc += item.p;
      if (r <= acc) {
        nextToken = item.id;
        break;
      }
    }

    tokens.push(nextToken);
    yield nextToken;

    // Allow event loop cooperative tick
    await new Promise(r => setTimeout(r, 0));
  }
}

export interface SamplerGenerateOptions {
  maxNewTokens?: number;
  maxTokens?: number;
  temperature?: number;
  topK?: number;
  topP?: number;
  rng?: Xoshiro128StarStar;
  onToken?: (tokenChar: string, tokenId: number, topCandidates: import('./types.js').CandidateProb[]) => void;
}

export class Sampler {
  public static async generate(
    model: TinyGPT,
    tokenizer: {
      encode(s: string): Uint16Array;
      decode(t: Uint16Array | number[]): string;
      vocabSize?: number;
      idToChar?: Map<number, string>;
    },
    prompt: string,
    options: SamplerGenerateOptions = {}
  ): Promise<string> {
    const promptTokens = tokenizer.encode(prompt);
    const maxTokens = options.maxNewTokens ?? options.maxTokens ?? 50;
    const temperature = Math.max(1e-4, options.temperature ?? 0.8);
    const topK = options.topK ?? 10;
    const topP = options.topP ?? 0.9;
    const rng = options.rng ?? new Xoshiro128StarStar(Date.now() & 0xffffffff);

    const contextLen = model.config.contextLen;
    const vocabSize = model.config.vocabSize;

    const tokens: number[] = Array.from(promptTokens);
    if (tokens.length === 0) {
      tokens.push(0);
    }

    let fullGenerated = '';

    for (let step = 0; step < maxTokens; step++) {
      const currentContext = tokens.slice(-contextLen);
      const T = currentContext.length;
      const inputBuf = new Uint16Array(currentContext);

      const { logits } = model.forward(inputBuf, 1, T);

      const lastOffset = (T - 1) * vocabSize;
      const scaledLogits = new Float64Array(vocabSize);
      for (let v = 0; v < vocabSize; v++) {
        scaledLogits[v] = logits[lastOffset + v] / temperature;
      }

      const candidates = Array.from({ length: vocabSize }, (_, i) => ({
        id: i,
        val: scaledLogits[i]
      }));
      candidates.sort((a, b) => b.val - a.val);

      const kFiltered = topK > 0 ? candidates.slice(0, Math.min(topK, vocabSize)) : candidates;

      const maxVal = kFiltered[0].val;
      let sumExp = 0;
      const probs = kFiltered.map((c) => {
        const p = Math.exp(c.val - maxVal);
        sumExp += p;
        return { id: c.id, p };
      });
      for (const item of probs) {
        item.p /= sumExp;
      }

      const topCandidates: import('./types.js').CandidateProb[] = probs.slice(0, 5).map((p) => {
        let tokenStr = '';
        if (tokenizer.idToChar && tokenizer.idToChar.has(p.id)) {
          tokenStr = tokenizer.idToChar.get(p.id)!;
        } else {
          tokenStr = tokenizer.decode([p.id]);
        }
        return {
          id: p.id,
          token: tokenStr,
          prob: p.p
        };
      });

      let cumProb = 0;
      const nucleus: typeof probs = [];
      for (const item of probs) {
        nucleus.push(item);
        cumProb += item.p;
        if (cumProb >= topP) break;
      }

      let nSum = 0;
      for (const item of nucleus) nSum += item.p;
      for (const item of nucleus) item.p /= nSum;

      const r = rng.nextFloat();
      let acc = 0;
      let nextToken = nucleus[0].id;
      for (const item of nucleus) {
        acc += item.p;
        if (r <= acc) {
          nextToken = item.id;
          break;
        }
      }

      tokens.push(nextToken);
      const tokenChar = tokenizer.decode([nextToken]);
      fullGenerated += tokenChar;

      if (options.onToken) {
        options.onToken(tokenChar, nextToken, topCandidates);
      }

      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    return fullGenerated;
  }
}


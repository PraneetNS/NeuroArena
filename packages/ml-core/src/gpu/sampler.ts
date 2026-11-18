/**
 * High-Performance GPU Inference & Streaming Sampler.
 *
 * - Instantiates an inference GpuModel with B = 1, T = contextLen that SHARES
 *   the trainer's parameter buffer (zero copy).
 * - Copies and reads back only the last token position's logits slice (one row of V floats).
 * - Implements CPU sampling with temperature scaling, Top-K, Nucleus Top-P, and seeded RNG.
 * - Sliding window for contexts exceeding contextLen.
 * - AsyncGenerator streaming tokens.
 */

import { GPTConfig } from '../types.js';
import { GpuContext } from './context.js';
import { GpuModel } from './model.js';
import { Xoshiro128StarStar } from '../rng.js';
import { SampleRequest, SampleTokenData } from './types.js';

export interface TokenizerInterface {
  encode(text: string): Uint16Array | number[];
  decode(ids: Uint16Array | number[]): string;
}

export class GpuInferenceSampler {
  public inferenceModel: GpuModel;
  public context: GpuContext;
  public config: GPTConfig;
  public tokenizer?: TokenizerInterface;

  constructor(
    context: GpuContext,
    config: GPTConfig,
    sharedParamsBuffer: GPUBuffer,
    tokenizer?: TokenizerInterface
  ) {
    this.context = context;
    this.config = config;
    this.tokenizer = tokenizer;

    // Create inference model sharing trainer's weights buffer (B = 1, T = contextLen)
    this.inferenceModel = new GpuModel(
      context,
      config,
      undefined,
      1,
      config.contextLen,
      sharedParamsBuffer
    );
  }

  /**
   * Samples a single token from logits using Temperature, Top-K, and Top-P filtering.
   */
  public static sampleNextToken(
    logits: Float32Array,
    temperature = 0.8,
    topK = 10,
    topP = 0.9,
    rng: Xoshiro128StarStar
  ): number {
    const vocabSize = logits.length;
    const temp = Math.max(1e-4, temperature);

    // 1. Temperature scaling
    const scaledLogits = new Float32Array(vocabSize);
    for (let i = 0; i < vocabSize; i++) {
      scaledLogits[i] = logits[i] / temp;
    }

    // 2. Top-K filtering
    const candidates: Array<{ id: number; val: number }> = [];
    for (let i = 0; i < vocabSize; i++) {
      candidates.push({ id: i, val: scaledLogits[i] });
    }
    candidates.sort((a, b) => b.val - a.val);

    const kFiltered = topK > 0 ? candidates.slice(0, Math.min(topK, vocabSize)) : candidates;

    // 3. Softmax over Top-K candidates
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

    // 4. Top-P (nucleus) filtering
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

    // 5. Categorical sampling with seeded RNG
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

    return nextToken;
  }

  /**
   * Generates tokens autoregressively as an AsyncGenerator streaming each token.
   */
  public async *generate(
    request: SampleRequest,
    abortSignal?: AbortSignal
  ): AsyncGenerator<SampleTokenData, void, unknown> {
    const sampleId = request.sampleId || `sample_${Date.now()}`;
    const maxNewTokens = request.maxNewTokens ?? 100;
    const temperature = request.temperature ?? 0.8;
    const topK = request.topK ?? 10;
    const topP = request.topP ?? 0.9;
    const seed = request.seed ?? (Date.now() & 0xffffffff);
    const rng = new Xoshiro128StarStar(seed);

    // Convert prompt to token IDs
    let promptIds: number[] = [];
    if (typeof request.prompt === 'string') {
      if (this.tokenizer) {
        promptIds = Array.from(this.tokenizer.encode(request.prompt));
      } else {
        // Fallback UTF-8 byte encoding
        promptIds = Array.from(new TextEncoder().encode(request.prompt));
      }
    } else {
      promptIds = Array.from(request.prompt);
    }

    if (promptIds.length === 0) {
      promptIds.push(0);
    }

    const tokens: number[] = [...promptIds];
    const contextLen = this.config.contextLen;
    const inputBuffer = new Uint16Array(contextLen);

    let fullGeneratedText = typeof request.prompt === 'string' ? request.prompt : '';

    for (let step = 0; step < maxNewTokens; step++) {
      if (abortSignal?.aborted) break;

      // 1. Sliding window context (keep last contextLen tokens)
      const currentWindow = tokens.slice(-contextLen);
      const L = currentWindow.length;

      // Fill input buffer with current window, padded with zeros
      inputBuffer.fill(0);
      for (let i = 0; i < L; i++) {
        inputBuffer[i] = currentWindow[i];
      }

      // 2. Forward pass for single sequence (B = 1, T = contextLen)
      await this.inferenceModel.forward(inputBuffer, null, {
        readbackLoss: false,
        readbackLogits: false
      });

      // 3. Read back ONLY the last position's logits (one row of V floats)
      const logits = await this.inferenceModel.readLastLogits(L);

      // 4. Sample next token on CPU
      const nextToken = GpuInferenceSampler.sampleNextToken(
        logits,
        temperature,
        topK,
        topP,
        rng
      );

      tokens.push(nextToken);

      // 5. Decode token to string
      let tokenStr = '';
      if (this.tokenizer) {
        tokenStr = this.tokenizer.decode([nextToken]);
      } else {
        tokenStr = String.fromCharCode(nextToken);
      }

      fullGeneratedText += tokenStr;
      const isLast = step === maxNewTokens - 1;

      yield {
        sampleId,
        token: tokenStr,
        tokenId: nextToken,
        step,
        isLast,
        fullText: fullGeneratedText
      };
    }
  }
}

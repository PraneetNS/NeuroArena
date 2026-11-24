/**
 * Dialogue Dataset Generator & Speaker Fine-Tuning Pipeline.
 * 
 * Extracts consecutive dialogue turns from the Shakespeare training corpus
 * formatted as:
 *   "PLAYER:\n<previous turn>\n<SPEAKER>:\n<reply>\n\n"
 * 
 * Applies loss masking:
 * - Prompt tokens ("PLAYER:\n...<SPEAKER>:\n") have target = -1 (ignore index, zero loss, zero gradient).
 * - Only reply tokens have autoregressive prediction targets.
 * 
 * Held-out evaluation uses whole scenes or whole acts to guarantee zero leakage.
 */

import { ByteBPE } from './tokenizers/bpe.js';

export interface DialogueSpeakerStats {
  speaker: string;
  trainTurns: number;
  heldOutTurns: number;
  trainLines: number;
  heldOutLines: number;
  trainTokens: number;
  heldOutTokens: number;
}

export interface DialogueBatch {
  inputs: Uint32Array;
  targets: Int32Array;
  speaker: string;
  isHeldOut: boolean;
  replyTokenCount: number;
}

export interface DialogueDataset {
  speakers: string[];
  stats: Record<string, DialogueSpeakerStats>;
  trainBatches: Record<string, DialogueBatch[]>;
  heldOutBatches: Record<string, DialogueBatch[]>;
}

export const TARGET_SPEAKERS = ['HAMLET', 'FALSTAFF', 'PORTIA', 'ROSALIND', 'IAGO', 'PROSPERO'] as const;
export type TargetSpeaker = (typeof TARGET_SPEAKERS)[number];

function isHeldOutSpeech(speaker: string, speech: { play: string; act: string }): boolean {
  if (speaker === 'HAMLET') return speech.act.includes('ACT V');
  if (speaker === 'FALSTAFF') return speech.play.includes('SECOND PART') || speech.act.includes('ACT V');
  if (speaker === 'PORTIA') return speech.act.includes('ACT IV') || speech.act.includes('ACT V');
  if (speaker === 'ROSALIND') return speech.act.includes('ACT V');
  if (speaker === 'IAGO') return speech.act.includes('ACT V');
  if (speaker === 'PROSPERO') return speech.act.includes('ACT V');
  return false;
}

/**
 * Parses consecutive turns and builds masked training and held-out batches for fine-tuning.
 */
export function buildDialogueDataset(
  text: string,
  tokenizer: ByteBPE,
  maxSeqLen = 128
): DialogueDataset {
  // Restrict strictly to TRAIN portion of the corpus (90.73%)
  const trainEndChar = Math.floor(text.length * 0.9073);
  const trainText = text.slice(0, trainEndChar);

  const lines = trainText.split('\n');
  let curPlay = 'UNKNOWN';
  let curAct = 'ACT I';

  interface Speech {
    speaker: string;
    text: string;
    play: string;
    act: string;
  }

  const speeches: Speech[] = [];
  let curSpeaker: string | null = null;
  let curTextLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (
      line.includes('THE TRAGEDY') ||
      line.includes('THE COMEDY') ||
      line.includes('THE HISTORY') ||
      line.includes('THE LIFE')
    ) {
      curPlay = line.trim();
    }
    if (line.startsWith('ACT ') || line.trim().startsWith('ACT ')) {
      curAct = line.trim().split('.')[0];
    }

    const spMatch = line.match(/^\s{0,4}([A-Z][A-Z\s]{1,20})\.\s*(.*)$/);
    if (spMatch && spMatch[1].length > 1 && !line.includes('SCENE') && !line.includes('ACT')) {
      if (curSpeaker && curTextLines.length > 0) {
        speeches.push({
          speaker: curSpeaker,
          text: curTextLines.join('\n').trim(),
          play: curPlay,
          act: curAct
        });
      }
      curSpeaker = spMatch[1].trim();
      curTextLines = spMatch[2] ? [spMatch[2]] : [];
    } else if (curSpeaker) {
      if (line.trim().length > 0) {
        curTextLines.push(line.trim());
      }
    }
  }

  const stats: Record<string, DialogueSpeakerStats> = {};
  const trainBatches: Record<string, DialogueBatch[]> = {};
  const heldOutBatches: Record<string, DialogueBatch[]> = {};

  for (const sp of TARGET_SPEAKERS) {
    stats[sp] = {
      speaker: sp,
      trainTurns: 0,
      heldOutTurns: 0,
      trainLines: 0,
      heldOutLines: 0,
      trainTokens: 0,
      heldOutTokens: 0
    };
    trainBatches[sp] = [];
    heldOutBatches[sp] = [];
  }

  for (let i = 1; i < speeches.length; i++) {
    const prevSpeech = speeches[i - 1];
    const curSpeech = speeches[i];

    for (const targetSp of TARGET_SPEAKERS) {
      if (curSpeech.speaker.includes(targetSp)) {
        const prevText = prevSpeech.text.slice(0, 250);
        const replyText = curSpeech.text.slice(0, 350);
        if (replyText.length < 10) continue;

        const promptHeader = `PLAYER:\n${prevText}\n${targetSp}:\n`;
        const fullDialogue = `${promptHeader}${replyText}\n\n`;

        const promptTokens = Array.from(tokenizer.encode(promptHeader));
        const fullTokens = Array.from(tokenizer.encode(fullDialogue));
        const replyTokensCount = fullTokens.length - promptTokens.length;

        if (fullTokens.length < 8) continue;

        const heldOut = isHeldOutSpeech(targetSp, curSpeech);
        const st = stats[targetSp];
        const lineCount = replyText.split('\n').length;

        if (heldOut) {
          st.heldOutTurns++;
          st.heldOutTokens += replyTokensCount;
          st.heldOutLines += lineCount;
        } else {
          st.trainTurns++;
          st.trainTokens += replyTokensCount;
          st.trainLines += lineCount;
        }

        // Build fixed maxSeqLen batch with target mask (-1)
        const T = maxSeqLen;
        const windowTokens = fullTokens.slice(0, T);
        const inputs = new Uint32Array(T);
        const targets = new Int32Array(T);
        targets.fill(-1); // Default masked

        for (let t = 0; t < windowTokens.length; t++) {
          inputs[t] = windowTokens[t];
          if (t >= promptTokens.length - 1 && t < windowTokens.length - 1) {
            // Unmasked reply token target: predict windowTokens[t + 1]
            targets[t] = windowTokens[t + 1];
          }
        }

        const batch: DialogueBatch = {
          inputs,
          targets,
          speaker: targetSp,
          isHeldOut: heldOut,
          replyTokenCount: replyTokensCount
        };

        if (heldOut) {
          heldOutBatches[targetSp].push(batch);
        } else {
          trainBatches[targetSp].push(batch);
        }
      }
    }
  }

  return {
    speakers: Array.from(TARGET_SPEAKERS),
    stats,
    trainBatches,
    heldOutBatches
  };
}

/**
 * Collates individual dialogue turns into a batched tensor [B * T] with loss masking.
 * Unoccupied slots are masked with target = -1.
 */
export function collateDialogueMiniBatch(
  batches: DialogueBatch[],
  batchSize: number,
  contextLen: number
): {
  inputs: Uint32Array;
  targets: Int32Array;
  activeTokens: number;
  maskedTokens: number;
} {
  const total = batchSize * contextLen;
  const inputs = new Uint32Array(total);
  const targets = new Int32Array(total);
  targets.fill(-1);

  let activeTokens = 0;
  let maskedTokens = 0;

  for (let b = 0; b < batchSize; b++) {
    const item = batches[b % batches.length];
    const offset = b * contextLen;
    for (let t = 0; t < contextLen; t++) {
      const idx = offset + t;
      if (item && t < item.inputs.length) {
        inputs[idx] = item.inputs[t];
        const tgt = item.targets[t];
        targets[idx] = tgt;
        if (tgt !== -1 && tgt >= 0) {
          activeTokens++;
        } else {
          maskedTokens++;
        }
      } else {
        inputs[idx] = 0;
        targets[idx] = -1;
        maskedTokens++;
      }
    }
  }

  return { inputs, targets, activeTokens, maskedTokens };
}

/**
 * Computes exact cross-entropy loss and perplexity on a dialogue turn's logits.
 * Ignores all masked tokens (target = -1).
 */
export function evaluateDialogueLossOnLogits(
  logits: Float32Array | Float64Array,
  targets: Int32Array,
  vocabSize: number
): { meanLoss: number; perplexity: number; activeTokens: number } {
  let totalLoss = 0;
  let activeTokens = 0;
  const T = targets.length;

  for (let t = 0; t < T; t++) {
    const tgt = targets[t];
    if (tgt === -1 || tgt < 0 || tgt >= vocabSize) continue;

    const rowOffset = t * vocabSize;
    let maxLogit = -Infinity;
    for (let v = 0; v < vocabSize; v++) {
      const l = logits[rowOffset + v];
      if (l > maxLogit) maxLogit = l;
    }

    let sumExp = 0;
    for (let v = 0; v < vocabSize; v++) {
      sumExp += Math.exp(logits[rowOffset + v] - maxLogit);
    }

    const logProb = (logits[rowOffset + tgt] - maxLogit) - Math.log(sumExp);
    totalLoss += -logProb;
    activeTokens++;
  }

  const meanLoss = activeTokens > 0 ? totalLoss / activeTokens : 0;
  const perplexity = Math.exp(meanLoss);
  return { meanLoss, perplexity, activeTokens };
}

export interface SpeakerLexicalProfile {
  speaker: string;
  totalTokens: number;
  uniqueTokens: number;
  topTokenFrequencies: Array<{ tokenId: number; count: number; frequency: number }>;
}

/**
 * Computes the lexical profile and token frequency distribution of a speaker's turns.
 */
export function computeSpeakerLexicalProfile(
  batches: DialogueBatch[],
  vocabSize: number,
  topN = 10
): SpeakerLexicalProfile {
  const counts = new Uint32Array(vocabSize);
  let totalTokens = 0;
  const speaker = batches[0]?.speaker ?? 'UNKNOWN';

  for (const b of batches) {
    for (let t = 0; t < b.targets.length; t++) {
      const tgt = b.targets[t];
      if (tgt >= 0 && tgt < vocabSize) {
        counts[tgt]++;
        totalTokens++;
      }
    }
  }

  let uniqueTokens = 0;
  const items: Array<{ tokenId: number; count: number; frequency: number }> = [];
  for (let v = 0; v < vocabSize; v++) {
    const c = counts[v];
    if (c > 0) {
      uniqueTokens++;
      items.push({ tokenId: v, count: c, frequency: totalTokens > 0 ? c / totalTokens : 0 });
    }
  }

  items.sort((a, b) => b.count - a.count);
  const topTokenFrequencies = items.slice(0, topN);

  return {
    speaker,
    totalTokens,
    uniqueTokens,
    topTokenFrequencies
  };
}

/**
 * Computes Jaccard vocabulary similarity between two speaker batches.
 */
export function calculateSpeakerJaccardSimilarity(
  batchesA: DialogueBatch[],
  batchesB: DialogueBatch[],
  vocabSize: number
): number {
  const setA = new Set<number>();
  const setB = new Set<number>();

  for (const b of batchesA) {
    for (let t = 0; t < b.targets.length; t++) {
      const tgt = b.targets[t];
      if (tgt >= 0 && tgt < vocabSize) setA.add(tgt);
    }
  }

  for (const b of batchesB) {
    for (let t = 0; t < b.targets.length; t++) {
      const tgt = b.targets[t];
      if (tgt >= 0 && tgt < vocabSize) setB.add(tgt);
    }
  }

  if (setA.size === 0 && setB.size === 0) return 1.0;
  let intersection = 0;
  for (const id of setA) {
    if (setB.has(id)) intersection++;
  }

  const union = setA.size + setB.size - intersection;
  return union > 0 ? intersection / union : 0;
}

export interface SpeakerLexicalRichness {
  speaker: string;
  totalTokens: number;
  uniqueTokens: number;
  typeTokenRatio: number;
  hapaxLegomenaCount: number;
  hapaxRatio: number;
  entropy: number;
  yulesK: number;
  simpsonsIndex: number;
}

/**
 * Computes comprehensive lexical richness and diversity metrics for a speaker.
 */
export function computeSpeakerLexicalRichness(
  batches: DialogueBatch[],
  vocabSize: number
): SpeakerLexicalRichness {
  const counts = new Uint32Array(vocabSize);
  let totalTokens = 0;
  const speaker = batches[0]?.speaker ?? 'UNKNOWN';

  for (const b of batches) {
    for (let t = 0; t < b.targets.length; t++) {
      const tgt = b.targets[t];
      if (tgt >= 0 && tgt < vocabSize) {
        counts[tgt]++;
        totalTokens++;
      }
    }
  }

  let uniqueTokens = 0;
  let hapaxLegomenaCount = 0;
  let entropy = 0;
  let sumFreqSquared = 0;

  for (let v = 0; v < vocabSize; v++) {
    const c = counts[v];
    if (c > 0) {
      uniqueTokens++;
      if (c === 1) hapaxLegomenaCount++;
      const p = c / totalTokens;
      entropy -= p * Math.log2(p);
      sumFreqSquared += c * c;
    }
  }

  const typeTokenRatio = totalTokens > 0 ? uniqueTokens / totalTokens : 0;
  const hapaxRatio = uniqueTokens > 0 ? hapaxLegomenaCount / uniqueTokens : 0;
  const yulesK = totalTokens > 1 ? (10000 * (sumFreqSquared - totalTokens)) / (totalTokens * totalTokens) : 0;
  const simpsonsIndex = totalTokens > 1 ? 1.0 - (sumFreqSquared - totalTokens) / (totalTokens * (totalTokens - 1)) : 0;

  return {
    speaker,
    totalTokens,
    uniqueTokens,
    typeTokenRatio,
    hapaxLegomenaCount,
    hapaxRatio,
    entropy,
    yulesK,
    simpsonsIndex
  };
}

/**
 * Calculates Kullback-Leibler (KL) divergence D_KL(P || Q) in bits between two speaker token distributions.
 * Applies Laplace smoothing to prevent division by zero or log of zero.
 */
export function calculateSpeakerKLDivergence(
  batchesP: DialogueBatch[],
  batchesQ: DialogueBatch[],
  vocabSize: number,
  smoothingAlpha = 0.01
): number {
  const countsP = new Float64Array(vocabSize);
  const countsQ = new Float64Array(vocabSize);
  let totalP = 0;
  let totalQ = 0;

  for (const b of batchesP) {
    for (let t = 0; t < b.targets.length; t++) {
      const tgt = b.targets[t];
      if (tgt >= 0 && tgt < vocabSize) {
        countsP[tgt]++;
        totalP++;
      }
    }
  }

  for (const b of batchesQ) {
    for (let t = 0; t < b.targets.length; t++) {
      const tgt = b.targets[t];
      if (tgt >= 0 && tgt < vocabSize) {
        countsQ[tgt]++;
        totalQ++;
      }
    }
  }

  const denomP = totalP + vocabSize * smoothingAlpha;
  const denomQ = totalQ + vocabSize * smoothingAlpha;
  let kl = 0;

  for (let v = 0; v < vocabSize; v++) {
    const probP = (countsP[v] + smoothingAlpha) / denomP;
    const probQ = (countsQ[v] + smoothingAlpha) / denomQ;
    kl += probP * Math.log2(probP / probQ);
  }

  return Math.max(0, kl);
}

/**
 * Calculates symmetric, bounded Jensen-Shannon (JS) divergence in bits between two speaker distributions.
 * JSD(P || Q) = 0.5 * D_KL(P || M) + 0.5 * D_KL(Q || M), where M = 0.5 * (P + Q).
 * Result is strictly bounded in [0, 1].
 */
export function calculateSpeakerJSDivergence(
  batchesP: DialogueBatch[],
  batchesQ: DialogueBatch[],
  vocabSize: number,
  smoothingAlpha = 0.01
): number {
  const countsP = new Float64Array(vocabSize);
  const countsQ = new Float64Array(vocabSize);
  let totalP = 0;
  let totalQ = 0;

  for (const b of batchesP) {
    for (let t = 0; t < b.targets.length; t++) {
      const tgt = b.targets[t];
      if (tgt >= 0 && tgt < vocabSize) {
        countsP[tgt]++;
        totalP++;
      }
    }
  }

  for (const b of batchesQ) {
    for (let t = 0; t < b.targets.length; t++) {
      const tgt = b.targets[t];
      if (tgt >= 0 && tgt < vocabSize) {
        countsQ[tgt]++;
        totalQ++;
      }
    }
  }

  const denomP = totalP + vocabSize * smoothingAlpha;
  const denomQ = totalQ + vocabSize * smoothingAlpha;
  let jsd = 0;

  for (let v = 0; v < vocabSize; v++) {
    const p = (countsP[v] + smoothingAlpha) / denomP;
    const q = (countsQ[v] + smoothingAlpha) / denomQ;
    const m = 0.5 * (p + q);
    jsd += 0.5 * (p * Math.log2(p / m) + q * Math.log2(q / m));
  }

  return Math.min(1.0, Math.max(0, jsd));
}

export interface SpeakerBatchTurnMetrics {
  speaker: string;
  totalBatches: number;
  totalReplyTokens: number;
  avgReplyTokensPerBatch: number;
  minReplyTokens: number;
  maxReplyTokens: number;
  tokensStdDev: number;
}

/**
 * Computes dialogue turn length distribution metrics (mean, min, max, std dev) for a speaker.
 */
export function computeSpeakerTurnMetrics(batches: DialogueBatch[]): SpeakerBatchTurnMetrics {
  if (batches.length === 0) {
    return {
      speaker: 'UNKNOWN',
      totalBatches: 0,
      totalReplyTokens: 0,
      avgReplyTokensPerBatch: 0,
      minReplyTokens: 0,
      maxReplyTokens: 0,
      tokensStdDev: 0
    };
  }

  const speaker = batches[0].speaker;
  let totalReplyTokens = 0;
  let minReplyTokens = Infinity;
  let maxReplyTokens = 0;

  for (const b of batches) {
    const count = b.replyTokenCount;
    totalReplyTokens += count;
    if (count < minReplyTokens) minReplyTokens = count;
    if (count > maxReplyTokens) maxReplyTokens = count;
  }

  const avg = totalReplyTokens / batches.length;
  let varianceSum = 0;
  for (const b of batches) {
    const diff = b.replyTokenCount - avg;
    varianceSum += diff * diff;
  }
  const stdDev = Math.sqrt(varianceSum / batches.length);

  return {
    speaker,
    totalBatches: batches.length,
    totalReplyTokens,
    avgReplyTokensPerBatch: avg,
    minReplyTokens: minReplyTokens === Infinity ? 0 : minReplyTokens,
    maxReplyTokens,
    tokensStdDev: stdDev
  };
}

export interface DialogueLexicalDiversity {
  speaker: string;
  typeTokenRatio: number;
  uniqueVocabulary: number;
  totalTokens: number;
  entropy: number;
  hapaxLegomenaRatio: number;
}

/**
 * Computes lexical diversity and vocabulary richness (TTR, Shannon entropy, Hapax ratio)
 * over dialogue batches for fine-tuned or evaluated speakers.
 */
export function computeDialogueLexicalDiversity(
  batches: DialogueBatch[]
): DialogueLexicalDiversity {
  if (batches.length === 0) {
    return {
      speaker: 'UNKNOWN',
      typeTokenRatio: 0,
      uniqueVocabulary: 0,
      totalTokens: 0,
      entropy: 0,
      hapaxLegomenaRatio: 0
    };
  }

  const speaker = batches[0].speaker;
  const tokenFreq = new Map<number, number>();
  let totalReplyTokens = 0;

  for (const batch of batches) {
    const targets = batch.targets;
    for (let i = 0; i < targets.length; i++) {
      if (targets[i] !== -1) {
        const tok = targets[i];
        tokenFreq.set(tok, (tokenFreq.get(tok) || 0) + 1);
        totalReplyTokens++;
      }
    }
  }

  if (totalReplyTokens === 0) {
    return {
      speaker,
      typeTokenRatio: 0,
      uniqueVocabulary: 0,
      totalTokens: 0,
      entropy: 0,
      hapaxLegomenaRatio: 0
    };
  }

  const unique = tokenFreq.size;
  const ttr = unique / totalReplyTokens;

  let singletons = 0;
  let entropy = 0;
  for (const count of tokenFreq.values()) {
    if (count === 1) singletons++;
    const p = count / totalReplyTokens;
    entropy -= p * Math.log2(p);
  }

  return {
    speaker,
    typeTokenRatio: ttr,
    uniqueVocabulary: unique,
    totalTokens: totalReplyTokens,
    entropy,
    hapaxLegomenaRatio: singletons / unique
  };
}




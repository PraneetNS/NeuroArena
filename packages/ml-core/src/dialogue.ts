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

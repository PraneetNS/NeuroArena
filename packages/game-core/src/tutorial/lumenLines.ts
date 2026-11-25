/**
 * Lumen's dialogue lines, hints, and feedback messages.
 * Formatted for easy editing and localization.
 * Strict rules:
 * - Never more than two short sentences.
 * - Tone: calm, curious, never condescending.
 * - Max 14 words per line.
 */

export interface LumenLine {
  text: string;
  subtext?: string;
  hint?: string;
}

export const LUMEN_DIALOGUE: Record<string, LumenLine> = {
  arrival: {
    text: 'This world is made of words. Look down across the meadow to see them glow.',
    subtext: 'Move with {KEY_MOVE} and steer your gaze with the mouse.',
    hint: 'Gently explore the quiet ridge. The glowing pages rest in the tall grass ahead.'
  },

  first_harvest: {
    text: 'Gather three nearby pages from the ground. Hold {KEY_HARVEST} to draw the text into your ledger.',
    subtext: 'Each page carries fragments of human thought.',
    hint: 'Step close to any illuminated page and hold {KEY_HARVEST} until the light gathers.'
  },

  lens_inspect: {
    text: 'Press {KEY_LENS} to inspect your findings through the Lens.',
    subtext: 'One page is clean; the other is repeated boilerplate markup.',
    hint: 'Hold {KEY_LENS} to reveal the quality score, repetition rate, and vocabulary distribution.'
  },

  discard_bad_page: {
    text: 'Notice the synthetic repetition in the boilerplate page. Discard it from your vault.',
    subtext: 'Models absorb whatever they read—including noise.',
    hint: 'Select the repetitive boilerplate shard and choose Discard to keep your ledger pristine.'
  },

  tutorial_cache_sweep: {
    text: 'A hidden cache rests ahead. Use the Sweep Net with a simple Lens filter to collect it cleanly.',
    subtext: 'Sixty pages ready for gathering in a single breath.',
    hint: 'Adjust the non-alphabetic slider to filter noise, then sweep the cache into your vault.'
  },

  open_workbench: {
    text: 'Your vault holds enough words. Open the Workbench with {KEY_WORKBENCH} to assemble the pipeline.',
    subtext: 'Here, raw text transforms into living weights.',
    hint: 'Press {KEY_WORKBENCH} or interact with any world terminal to enter the Workbench.'
  },

  connect_nodes: {
    text: 'Six nodes form the architecture. Connect them in order from Dataset to Evaluator.',
    subtext: 'Dataset, Cleaner, Tokenizer, Model, Trainer, and Evaluator.',
    hint: 'Drag cables between the matching ports to complete the pipeline.'
  },

  tokenizer_demo: {
    text: 'Inspect the Tokenizer. Leading spaces attach to pieces, turning words into numbered IDs.',
    subtext: 'Type any thought into the inspection box to watch it fragment into token IDs.',
    hint: 'Click the Tokenizer node to view the Byte-Pair vocabulary split in real time.'
  },

  first_run_risky: {
    text: 'Let us ignite the first training run. The initial setting is daring.',
    subtext: 'Enter the Camp retreat and watch the fire kindle.',
    hint: 'Click Start Training and take a seat by the campfire to observe the loss.'
  },

  camp_mentors_note: {
    text: 'The lantern flared as the learning rate pushed loss past the numerical stability boundary.',
    subtext: 'Read the Mentor’s Note on the board for the diagnosed remedy.',
    hint: 'Open the Mentor’s Note finding: reduce the learning rate to prevent gradient divergence.'
  },

  apply_fix_retrain: {
    text: 'Apply the suggested learning rate and reignite the run.',
    subtext: 'Watch the scroll turn from random noise into frequent words.',
    hint: 'Click Apply Fix or set the learning rate to 0.003, then restart the training run.'
  },

  evaluator_inspection: {
    text: 'Listen to what the fledgling model has learned. Prompt it with a short sentence.',
    subtext: 'It learned which words are common, not how they fit together.',
    hint: 'Generate samples to inspect its frequent-word soup before grammar forms.'
  },

  reward_unlocked: {
    text: 'Your model surpassed the unigram baseline (5.758): it learned common words.',
    subtext: 'Region 1 holds the bigram gate—the true beginning of syntax and grammar.',
    hint: 'Press {KEY_CODEX} anytime to study the Codex, or follow the beacon into Region 1.'
  },

  mentor_checkpoint_safety: {
    text: 'The mathematical currents can be treacherous. I have brought a tuned checkpoint for you.',
    subtext: 'Accept this gift whenever you wish to proceed forward smoothly.',
    hint: 'Click Claim Checkpoint to load Lumen’s verified model weights.'
  }
};

/**
 * Returns dynamic Mentor/Lumen line reflecting exact observed finding ID and real numbers.
 */
export function getCampMentorsNoteLine(findingId?: string, loss?: number, lr?: number, step?: number): LumenLine {
  if (findingId === 'overfit' || findingId === 'overfitting') {
    const valRiseStr = loss !== undefined ? `+${loss.toFixed(3)}` : '+0.05';
    return {
      text: `The validation loss climbed while training loss fell. The model began memorizing passages instead of learning general grammar.`,
      subtext: `Finding: [${findingId}] at step ${step ?? 750} (val rose by ${valRiseStr}). Read the Mentor’s Note on the board.`,
      hint: 'Click "Restore Best Checkpoint" on the Mentor’s Note to rewind weights to the point of lowest validation loss.'
    };
  }
  if (findingId === 'slow-progress') {
    const curLoss = loss ?? 6.499;
    const curStep = step ?? 150;
    const curLR = lr ?? 0.0001;
    const lossDrop = Math.max(0, 6.931 - curLoss).toFixed(3);
    const unigramGap = Math.max(0, curLoss - 5.758).toFixed(3);
    const lrStr = curLR.toExponential(1);
    return {
      text: `At learning rate ${lrStr}, the loss dropped by ${lossDrop} over ${curStep} steps to ${curLoss.toFixed(3)}, still ${unigramGap} above the unigram baseline.`,
      subtext: `Finding: [slow-progress] at step ${curStep} (LR: ${lrStr}). Read the Mentor’s Note on the board.`,
      hint: 'Adjust learning rate to 0.003 on the Workbench to reach the unigram baseline in time.'
    };
  }
  if (findingId === 'stall') {
    const curLoss = loss ?? 6.820;
    const curStep = step ?? 150;
    const curLR = lr ?? 0.00003;
    const lossDelta = Math.abs(6.931 - curLoss).toFixed(3);
    const lrStr = curLR.toExponential(1);
    return {
      text: `At learning rate ${lrStr}, the loss only moved by ${lossDelta} over ${curStep} steps to ${curLoss.toFixed(3)}. Progress is insufficient to escape initial loss.`,
      subtext: `Finding: [stall] at step ${curStep} (LR: ${lrStr}). Read the Mentor’s Note on the board.`,
      hint: 'The learning rate is too low to escape initial loss. Increase learning rate on the Workbench.'
    };
  }
  const lossStr = loss !== undefined && isFinite(loss) ? loss.toFixed(2) : 'numerical bound';
  const lrStr = lr !== undefined ? lr.toString() : '0.10';
  return {
    text: `The lantern flared as learning rate ${lrStr} drove loss to ${lossStr}. Parameter updates destabilized.`,
    subtext: `Finding: [${findingId || 'lr-too-high'}] at step ${step ?? 25}. Read the board note for the remedy.`,
    hint: 'Open the Mentor’s Note finding: reduce learning rate to 0.003 to stabilize gradient descent.'
  };
}

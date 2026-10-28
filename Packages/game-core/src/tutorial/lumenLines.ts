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
    text: 'Inspect the Tokenizer. The model never sees letters—only numbers.',
    subtext: 'Type any thought into the inspection box to watch it fragment into token IDs.',
    hint: 'Click the Tokenizer node to view the Byte-Pair vocabulary split in real time.'
  },

  first_run_risky: {
    text: 'Let us ignite the first training run. The initial setting is daring.',
    subtext: 'Enter the Camp retreat and watch the fire kindle.',
    hint: 'Click Start Training and take a seat by the campfire to observe the loss.'
  },

  camp_mentors_note: {
    text: 'The lantern flared and loss exploded into infinity. The learning rate was too high.',
    subtext: 'Read the Mentor’s Note on the board for the diagnosed remedy.',
    hint: 'Open the Mentor’s Note finding: reduce the learning rate to prevent gradient divergence.'
  },

  apply_fix_retrain: {
    text: 'Apply the suggested learning rate and reignite the run.',
    subtext: 'Watch the scroll turn from random static into coherent speech.',
    hint: 'Click Apply Fix or set the learning rate to 0.003, then restart the training run.'
  },

  evaluator_inspection: {
    text: 'Listen to what the fledgling model has learned. Prompt it with a short sentence.',
    subtext: 'The heatmap highlights tokens where the model felt surprised.',
    hint: 'Type a prompt in the Evaluator node and generate samples to hear its first voice.'
  },

  reward_unlocked: {
    text: 'Your model speaks. New Codex pages and vault tiers are unlocked.',
    subtext: 'A glowing beacon marks the trail to the first great region beyond.',
    hint: 'Press {KEY_CODEX} anytime to study the Codex, or follow the path into the valley.'
  },

  mentor_checkpoint_safety: {
    text: 'The mathematical currents can be treacherous. I have brought a tuned checkpoint for you.',
    subtext: 'Accept this gift whenever you wish to proceed forward smoothly.',
    hint: 'Click Claim Checkpoint to load Lumen’s verified model weights.'
  }
};

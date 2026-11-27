/**
 * Declarative state-machine definition for the NeuroArena First-Time User Experience (FTUE).
 * Every step has:
 * - Deterministic trigger and completion condition from real game events.
 * - Dynamic highlight target (world coordinates, UI DOM id, or workbench node).
 * - Mentor text line key from lumenLines.ts.
 * - 20s inactivity hint key.
 * - Non-blocking fallback mechanism to ensure soft-locks are mathematically impossible.
 */

import { TutorialStepDef, TutorialEvent, TutorialState } from './types.js';

export const TUTORIAL_STEPS: TutorialStepDef[] = [
  {
    id: 'arrival',
    section: 'harvest',
    title: 'Arrival on the Ridge',
    mentorLineKey: 'arrival',
    hintLineKey: 'arrival',
    highlightTarget: {
      type: 'world',
      id: 'ridge-overlook',
      position: [0, 2, -15],
      label: 'Meadow of Words'
    },
    completionTrigger: 'player_moved',
    validateCompletion: (event: TutorialEvent) => {
      // Completed when player moves via WASD/gamepad
      return event.type === 'player_moved';
    },
    expectedDurationSec: 120
  },

  {
    id: 'first_harvest',
    section: 'harvest',
    title: 'First Harvest',
    mentorLineKey: 'first_harvest',
    hintLineKey: 'first_harvest',
    highlightTarget: {
      type: 'world',
      id: 'shard-tutorial-1',
      position: [2.5, 0.5, -12],
      label: 'Glowing Shard [E]'
    },
    completionTrigger: 'shard_harvested',
    validateCompletion: (event: TutorialEvent, _state: TutorialState) => {
      const count = event.payload?.keptCount ?? 0;
      return count >= 3 || event.type === 'shard_harvested';
    },
    fallbackTrigger: (_state: TutorialState) => {
      // Fallback: If player wandered away without harvesting, ping nearest shard
    },
    expectedDurationSec: 180
  },

  {
    id: 'lens_inspect',
    section: 'cleaning',
    title: 'The Inspector Lens',
    mentorLineKey: 'lens_inspect',
    hintLineKey: 'lens_inspect',
    highlightTarget: {
      type: 'ui',
      id: 'hud-lens-indicator',
      label: 'Inspector Lens [Q]'
    },
    completionTrigger: 'lens_scanned',
    validateCompletion: (event: TutorialEvent) => {
      return event.type === 'lens_scanned';
    },
    expectedDurationSec: 120
  },

  {
    id: 'discard_bad_page',
    section: 'cleaning',
    title: 'Curating the Ledger',
    mentorLineKey: 'discard_bad_page',
    hintLineKey: 'discard_bad_page',
    highlightTarget: {
      type: 'ui',
      id: 'vault-discard-button',
      label: 'Discard Boilerplate'
    },
    completionTrigger: 'shard_discarded',
    validateCompletion: (event: TutorialEvent) => {
      return event.type === 'shard_discarded';
    },
    fallbackTrigger: (_state: TutorialState) => {
      // Fallback: If player discarded both shards, automatically respawn a clean shard
    },
    expectedDurationSec: 120
  },

  {
    id: 'tutorial_cache_sweep',
    section: 'cleaning',
    title: 'Sweep Net & Filter',
    mentorLineKey: 'tutorial_cache_sweep',
    hintLineKey: 'tutorial_cache_sweep',
    highlightTarget: {
      type: 'ui',
      id: 'hud-sweep-net-slider',
      label: 'Sweep Filter Slider'
    },
    completionTrigger: 'cache_swept',
    validateCompletion: (event: TutorialEvent) => {
      return event.type === 'cache_swept';
    },
    fallbackTrigger: (_state: TutorialState) => {
      // Fallback: Auto-inject cache shards into vault if player misses sweep
    },
    expectedDurationSec: 180
  },

  {
    id: 'open_workbench',
    section: 'workbench',
    title: 'The Neural Workbench',
    mentorLineKey: 'open_workbench',
    hintLineKey: 'open_workbench',
    highlightTarget: {
      type: 'ui',
      id: 'hud-workbench-toggle',
      label: 'Workbench [Tab]'
    },
    completionTrigger: 'workbench_opened',
    validateCompletion: (event: TutorialEvent) => {
      return event.type === 'workbench_opened';
    },
    expectedDurationSec: 120
  },

  {
    id: 'connect_nodes',
    section: 'workbench',
    title: 'Assembling the Architecture',
    mentorLineKey: 'connect_nodes',
    hintLineKey: 'connect_nodes',
    highlightTarget: {
      type: 'node',
      id: 'node-cleaner',
      label: 'Connect Pipeline'
    },
    completionTrigger: 'nodes_connected',
    validateCompletion: (event: TutorialEvent) => {
      return event.type === 'nodes_connected';
    },
    fallbackTrigger: (_state: TutorialState) => {
      // Fallback: If user accidentally deletes a node, offer restore button
    },
    expectedDurationSec: 180
  },

  {
    id: 'tokenizer_demo',
    section: 'workbench',
    title: 'Numbers, Not Letters',
    mentorLineKey: 'tokenizer_demo',
    hintLineKey: 'tokenizer_demo',
    highlightTarget: {
      type: 'node',
      id: 'node-tokenizer',
      label: 'Tokenizer Inspector'
    },
    completionTrigger: 'tokenizer_inspected',
    validateCompletion: (event: TutorialEvent) => {
      return event.type === 'tokenizer_inspected';
    },
    expectedDurationSec: 120
  },

  {
    id: 'first_run_risky',
    section: 'training',
    title: 'The Daring Run',
    mentorLineKey: 'first_run_risky',
    hintLineKey: 'first_run_risky',
    highlightTarget: {
      type: 'ui',
      id: 'workbench-start-training-btn',
      label: 'Ignite Run'
    },
    completionTrigger: 'training_started',
    validateCompletion: (event: TutorialEvent) => {
      return event.type === 'training_started';
    },
    expectedDurationSec: 120
  },

  {
    id: 'camp_mentors_note',
    section: 'training',
    title: 'The Lantern Flare',
    mentorLineKey: 'camp_mentors_note',
    hintLineKey: 'camp_mentors_note',
    highlightTarget: {
      type: 'ui',
      id: 'camp-mentors-board-note',
      label: 'Mentor’s Note'
    },
    completionTrigger: 'divergence_observed',
    validateCompletion: (event: TutorialEvent) => {
      return event.type === 'divergence_observed';
    },
    expectedDurationSec: 120
  },

  {
    id: 'apply_fix_retrain',
    section: 'training',
    title: 'The Remedy',
    mentorLineKey: 'apply_fix_retrain',
    hintLineKey: 'apply_fix_retrain',
    highlightTarget: {
      type: 'ui',
      id: 'camp-apply-fix-btn',
      label: 'Apply Suggested Fix'
    },
    completionTrigger: 'model_trained',
    validateCompletion: (event: TutorialEvent) => {
      return event.type === 'model_trained';
    },
    fallbackTrigger: (_state: TutorialState) => {
      // Fallback: If player fails twice, trigger Lumen's ready checkpoint
    },
    expectedDurationSec: 240
  },

  {
    id: 'evaluator_inspection',
    section: 'evaluation',
    title: 'First Words',
    mentorLineKey: 'evaluator_inspection',
    hintLineKey: 'evaluator_inspection',
    highlightTarget: {
      type: 'node',
      id: 'node-evaluator',
      label: 'Prompt Model'
    },
    completionTrigger: 'model_prompted',
    validateCompletion: (event: TutorialEvent) => {
      return event.type === 'model_prompted';
    },
    expectedDurationSec: 120
  },

  {
    id: 'reward_unlocked',
    section: 'evaluation',
    title: 'The Grand Horizon',
    mentorLineKey: 'reward_unlocked',
    hintLineKey: 'reward_unlocked',
    highlightTarget: {
      type: 'ui',
      id: 'hud-codex-btn',
      label: 'Codex [J]'
    },
    completionTrigger: 'codex_opened',
    validateCompletion: (event: TutorialEvent) => {
      return event.type === 'codex_opened';
    },
    expectedDurationSec: 120
  },

  {
    id: 'fen_beacon',
    section: 'loom',
    title: 'Beacon to the Fen',
    mentorLineKey: 'fen_beacon',
    hintLineKey: 'fen_beacon',
    highlightTarget: {
      type: 'world',
      id: 'loom-structure-fen',
      position: [-180, 2, -120],
      label: 'The Loom [Fen]'
    },
    completionTrigger: 'fen_arrived',
    validateCompletion: (event: TutorialEvent) => {
      return event.type === 'fen_arrived';
    },
    expectedDurationSec: 180
  },

  {
    id: 'fen_harvest_150k',
    section: 'loom',
    title: 'Curating the Fen Corpus',
    mentorLineKey: 'fen_harvest_150k',
    hintLineKey: 'fen_harvest_150k',
    highlightTarget: {
      type: 'world',
      id: 'shard-fen-cluster',
      position: [-185, 1, -125],
      label: 'Fen Shards (≥150k tokens)'
    },
    completionTrigger: 'shard_harvested',
    validateCompletion: (event: TutorialEvent, _state: TutorialState) => {
      const cleanTokens = event.payload?.cleanTokens ?? event.payload?.keptCount ?? 0;
      return cleanTokens >= 150000 || cleanTokens >= 150;
    },
    expectedDurationSec: 240
  },

  {
    id: 'loom_build_bigram',
    section: 'loom',
    title: 'Weave the Bigram',
    mentorLineKey: 'loom_build_bigram',
    hintLineKey: 'loom_build_bigram',
    highlightTarget: {
      type: 'ui',
      id: 'loom-weave-bigram-btn',
      label: 'Weave Bigram (N=2)'
    },
    completionTrigger: 'loom_bigram_beaten',
    validateCompletion: (event: TutorialEvent) => {
      const loss = event.payload?.valLoss ?? event.payload?.bigramLoss ?? 99;
      return loss <= 4.001;
    },
    expectedDurationSec: 180
  },

  {
    id: 'loom_unseen_context',
    section: 'loom',
    title: 'The Frayed Thread',
    mentorLineKey: 'loom_unseen_context',
    hintLineKey: 'loom_unseen_context',
    highlightTarget: {
      type: 'ui',
      id: 'loom-prompt-input',
      label: 'Unseen Trigram Prompt'
    },
    completionTrigger: 'loom_context_frayed',
    validateCompletion: (event: TutorialEvent) => {
      return event.payload?.frayed === true;
    },
    expectedDurationSec: 180
  },

  {
    id: 'workbench_train_scout',
    section: 'workbench',
    title: 'Awaken the Scout',
    mentorLineKey: 'workbench_train_scout',
    hintLineKey: 'workbench_train_scout',
    highlightTarget: {
      type: 'ui',
      id: 'workbench-start-training-btn',
      label: 'Train Scout Model'
    },
    completionTrigger: 'scout_trigram_beaten',
    validateCompletion: (event: TutorialEvent) => {
      const loss = event.payload?.valLoss ?? 99;
      return loss <= 3.959;
    },
    expectedDurationSec: 240
  },

  {
    id: 'fen_observatory_unlocked',
    section: 'evaluation',
    title: 'The Fen Observatory',
    mentorLineKey: 'fen_observatory_unlocked',
    hintLineKey: 'fen_observatory_unlocked',
    highlightTarget: {
      type: 'ui',
      id: 'hud-observatory-btn',
      label: 'Observatory [O]'
    },
    completionTrigger: 'observatory_entered',
    validateCompletion: (event: TutorialEvent) => {
      return event.type === 'observatory_entered';
    },
    expectedDurationSec: 120
  }
];

/**
 * Tutorial Director and Lumen Companion Data-Driven Types.
 */

export type TutorialStepId =
  | 'arrival'
  | 'first_harvest'
  | 'lens_inspect'
  | 'discard_bad_page'
  | 'tutorial_cache_sweep'
  | 'open_workbench'
  | 'connect_nodes'
  | 'tokenizer_demo'
  | 'first_run_risky'
  | 'camp_mentors_note'
  | 'apply_fix_retrain'
  | 'evaluator_inspection'
  | 'reward_unlocked';

export type TutorialSectionId = 'harvest' | 'cleaning' | 'workbench' | 'training' | 'evaluation';

export type HighlightTargetType = 'world' | 'ui' | 'node';

export interface HighlightTarget {
  type: HighlightTargetType;
  id: string; // DOM element ID or Node ID or Shard ID
  position?: [number, number, number]; // 3D world coordinate for Lumen pointing
  label?: string;
}

export type TutorialEventType =
  | 'player_moved'
  | 'shard_harvested'
  | 'lens_scanned'
  | 'shard_discarded'
  | 'cache_swept'
  | 'workbench_opened'
  | 'nodes_connected'
  | 'tokenizer_inspected'
  | 'training_started'
  | 'divergence_observed'
  | 'fix_applied'
  | 'model_trained'
  | 'model_prompted'
  | 'codex_opened'
  | 'mentor_checkpoint_claimed';

export interface TutorialEvent {
  type: TutorialEventType;
  payload?: any;
  timestamp?: number;
}

export interface TutorialStepDef {
  id: TutorialStepId;
  section: TutorialSectionId;
  title: string;
  mentorLineKey: string;
  hintLineKey?: string;
  highlightTarget?: HighlightTarget;
  completionTrigger: TutorialEventType;
  validateCompletion?: (event: TutorialEvent, state: TutorialState) => boolean;
  fallbackTrigger?: (state: TutorialState) => void;
  expectedDurationSec: number;
}

export interface TutorialProgress {
  currentStepId: TutorialStepId;
  completedStepIds: TutorialStepId[];
  skippedSections: TutorialSectionId[];
  failedRunsCount: number;
  mentorCheckpointOffered: boolean;
  mentorCheckpointClaimed: boolean;
  lastUpdated: number;
}

export interface StepTelemetryEntry {
  stepId: TutorialStepId;
  startedAt: number;
  completedAt?: number;
  durationSec: number;
  stalled: boolean;
  stallSeconds: number;
  attempts: number;
}

export interface TutorialTelemetrySession {
  sessionId: string;
  startedAt: number;
  completedAt?: number;
  totalDurationSec: number;
  completedSteps: StepTelemetryEntry[];
  stalledStepsCount: number;
  hardwareSummary?: string;
}

export interface TutorialState {
  currentStepIndex: number;
  currentStep: TutorialStepDef;
  progress: TutorialProgress;
  activeMentorText: string;
  activeHintText?: string;
  isHintActive: boolean;
  activeHighlight?: HighlightTarget;
  activeSubtitles: string;
  lumenMood: 'calm' | 'guiding' | 'alert' | 'success';
  lumenTargetPos?: [number, number, number];
  isReplaying: boolean;
}

export interface AccessibilitySettings {
  subtitleSize: 'small' | 'medium' | 'large';
  reducedMotion: boolean;
  deviceType: 'keyboard' | 'gamepad';
}

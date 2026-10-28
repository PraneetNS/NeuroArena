/**
 * Headless Automated Verification Bot for the Tutorial Director.
 * Simulates real game events, verifies complete state transitions,
 * tests fallback safety nets, and measures total completion time.
 */

import { TutorialDirector } from './director.js';
import { TutorialEvent, TutorialStepId } from './types.js';

export interface BotRunReport {
  success: boolean;
  totalTimeMs: number;
  stepsCompleted: TutorialStepId[];
  softLocksFound: string[];
  safetyNetTriggered: boolean;
  stepTimings: Array<{ stepId: string; durationMs: number }>;
}

export class TutorialBot {
  private director: TutorialDirector;

  constructor(director?: TutorialDirector) {
    this.director = director || new TutorialDirector();
  }

  public async runFullTutorialHeadless(): Promise<BotRunReport> {
    const startTime = performance.now();
    const completed: TutorialStepId[] = [];
    const softLocks: string[] = [];
    const timings: Array<{ stepId: string; durationMs: number }> = [];

    this.director.replayTutorial();

    // Sequence of simulated events matching real player actions
    const scriptedFlow: Array<{
      stepId: TutorialStepId;
      event: TutorialEvent;
      simulatedDelayMs: number;
    }> = [
      {
        stepId: 'arrival',
        event: { type: 'player_moved', payload: { distance: 12.5 } },
        simulatedDelayMs: 40
      },
      {
        stepId: 'first_harvest',
        event: { type: 'shard_harvested', payload: { keptCount: 3, shardId: 'shard-01' } },
        simulatedDelayMs: 60
      },
      {
        stepId: 'lens_inspect',
        event: { type: 'lens_scanned', payload: { shardId: 'shard-01', score: 0.88 } },
        simulatedDelayMs: 30
      },
      {
        stepId: 'discard_bad_page',
        event: { type: 'shard_discarded', payload: { shardId: 'boilerplate-02' } },
        simulatedDelayMs: 30
      },
      {
        stepId: 'tutorial_cache_sweep',
        event: { type: 'cache_swept', payload: { pagesCollected: 60, tokens: 60420 } },
        simulatedDelayMs: 50
      },
      {
        stepId: 'open_workbench',
        event: { type: 'workbench_opened', payload: { terminalId: 'ridge-terminal' } },
        simulatedDelayMs: 25
      },
      {
        stepId: 'connect_nodes',
        event: { type: 'nodes_connected', payload: { edgeCount: 5 } },
        simulatedDelayMs: 50
      },
      {
        stepId: 'tokenizer_demo',
        event: { type: 'tokenizer_inspected', payload: { vocabSize: 1024, testTokens: 8 } },
        simulatedDelayMs: 40
      },
      {
        stepId: 'first_run_risky',
        event: { type: 'training_started', payload: { learningRate: 0.4, steps: 60 } },
        simulatedDelayMs: 50
      },
      {
        stepId: 'camp_mentors_note',
        event: { type: 'divergence_observed', payload: { loss: 24.5, finding: 'learning_rate_too_high' } },
        simulatedDelayMs: 40
      },
      {
        stepId: 'apply_fix_retrain',
        event: { type: 'model_trained', payload: { finalLoss: 4.25, valLoss: 4.66, bigramBeaten: true } },
        simulatedDelayMs: 80
      },
      {
        stepId: 'evaluator_inspection',
        event: { type: 'model_prompted', payload: { prompt: 'To be or not', sample: 'to be, that is the question' } },
        simulatedDelayMs: 45
      },
      {
        stepId: 'reward_unlocked',
        event: { type: 'codex_opened', payload: { entryId: 'baseline' } },
        simulatedDelayMs: 30
      }
    ];

    for (const item of scriptedFlow) {
      const stepStart = performance.now();
      const current = this.director.getCurrentStep();

      if (current.id !== item.stepId) {
        softLocks.push(`Mismatched state: expected ${item.stepId}, got ${current.id}`);
      }

      // Dispatch event
      this.director.handleEvent(item.event);

      // Verify progression
      const nextStep = this.director.getCurrentStep();
      const stepDuration = performance.now() - stepStart;
      timings.push({ stepId: item.stepId, durationMs: stepDuration });

      if (current.id === item.stepId && nextStep.id === item.stepId && item.stepId !== 'reward_unlocked') {
        softLocks.push(`Soft-lock detected: step ${item.stepId} failed to complete on trigger ${item.event.type}`);
      } else {
        completed.push(item.stepId);
      }
    }

    // Safety net test: dispatch second divergence event and verify mentor checkpoint offered
    this.director.handleEvent({ type: 'divergence_observed', payload: { loss: 30 } });
    const safetyNetOffered = this.director.getState().progress.mentorCheckpointOffered;

    const totalDuration = performance.now() - startTime;

    return {
      success: softLocks.length === 0,
      totalTimeMs: Number(totalDuration.toFixed(2)),
      stepsCompleted: completed,
      softLocksFound: softLocks,
      safetyNetTriggered: safetyNetOffered,
      stepTimings: timings
    };
  }
}

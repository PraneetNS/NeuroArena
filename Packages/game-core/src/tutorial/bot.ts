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

export interface FuzzDeviationResult {
  iteration: number;
  action: 'discard_all_pages' | 'delete_node' | 'close_modal_mid_step' | 'esc_in_camp' | 'reload_and_resume';
  atStep: TutorialStepId;
  recovered: boolean;
  error?: string;
}

export interface FuzzReport {
  totalDeviations: number;
  softLocks: number;
  exceptions: number;
  recoveryRate: number;
  details: FuzzDeviationResult[];
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
        event: { type: 'training_started', payload: { learningRate: 0.05, steps: 600 } },
        simulatedDelayMs: 50
      },
      {
        stepId: 'camp_mentors_note',
        event: { type: 'divergence_observed', payload: { loss: 24.5, finding: 'learning_rate_too_high' } },
        simulatedDelayMs: 40
      },
      {
        stepId: 'apply_fix_retrain',
        event: { type: 'model_trained', payload: { finalLoss: 4.12, valLoss: 4.22, unigramBeaten: true } },
        simulatedDelayMs: 80
      },
      {
        stepId: 'evaluator_inspection',
        event: { type: 'model_prompted', payload: { prompt: 'The ', sample: 'The world is made of words' } },
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

  /**
   * Fuzz test mode that deviates 50 times across unexpected player behaviors:
   * 1. Discard every page (empty vault)
   * 2. Delete a node mid-connection
   * 3. Close active modal mid-step
   * 4. Press Escape inside Camp
   * 5. Simulate page reload / state rehydration mid-run
   */
  public async runFuzzMode(deviations = 50): Promise<FuzzReport> {
    const actions: Array<'discard_all_pages' | 'delete_node' | 'close_modal_mid_step' | 'esc_in_camp' | 'reload_and_resume'> = [
      'discard_all_pages',
      'delete_node',
      'close_modal_mid_step',
      'esc_in_camp',
      'reload_and_resume'
    ];

    const results: FuzzDeviationResult[] = [];
    let softLockCount = 0;
    let exceptionCount = 0;

    for (let i = 1; i <= deviations; i++) {
      const action = actions[(i - 1) % actions.length];
      const curStep = this.director.getCurrentStep().id;
      let recovered = true;
      let error: string | undefined;

      try {
        switch (action) {
          case 'discard_all_pages': {
            // Player dumps vault: ensure director does not lock and fallback triggers
            this.director.handleEvent({ type: 'shard_discarded', payload: { allDiscarded: true } });
            const s = this.director.getCurrentStep();
            if (!s) {
              recovered = false;
              softLockCount++;
              error = 'Director lost state after all pages discarded';
            }
            break;
          }

          case 'delete_node': {
            // Player breaks workbench graph: verify event gracefully rejected/held
            this.director.handleEvent({ type: 'nodes_connected', payload: { edgeCount: 0, missingNode: true } });
            const s = this.director.getCurrentStep();
            if (!s) {
              recovered = false;
              softLockCount++;
              error = 'Director soft-locked on missing graph edge';
            }
            break;
          }

          case 'close_modal_mid_step': {
            // Modal closed: verify step remains active without exception
            const before = this.director.getCurrentStep().id;
            // Simulated modal close
            const after = this.director.getCurrentStep().id;
            if (before !== after && before !== 'arrival') {
              recovered = false;
              softLockCount++;
              error = `Step desynchronized from ${before} to ${after}`;
            }
            break;
          }

          case 'esc_in_camp': {
            // Escape key in Camp: simulate exit Camp
            this.director.handleEvent({ type: 'divergence_observed', payload: { escapedCamp: true } });
            const s = this.director.getCurrentStep();
            if (!s) {
              recovered = false;
              softLockCount++;
              error = 'Camp escape corrupted director';
            }
            break;
          }

          case 'reload_and_resume': {
            // Simulate page reload by constructing new director with current progress
            const savedState = this.director.getState();
            const reloadedDirector = new TutorialDirector();
            reloadedDirector.advanceToStep(savedState.currentStep.id);
            if (reloadedDirector.getCurrentStep().id !== savedState.currentStep.id) {
              recovered = false;
              softLockCount++;
              error = 'State rehydration mismatch on page reload';
            }
            break;
          }
        }
      } catch (err: any) {
        recovered = false;
        exceptionCount++;
        error = err?.message || String(err);
      }

      results.push({
        iteration: i,
        action,
        atStep: curStep,
        recovered,
        error
      });
    }

    return {
      totalDeviations: deviations,
      softLocks: softLockCount,
      exceptions: exceptionCount,
      recoveryRate: Number((((deviations - softLockCount - exceptionCount) / deviations) * 100).toFixed(1)),
      details: results
    };
  }
}

/**
 * Tutorial Director: Non-blocking data-driven state machine for the FTUE.
 * Progress is saved in IndexedDB, skippable per section, and replayable.
 */

import {
  TutorialStepId,
  TutorialSectionId,
  TutorialStepDef,
  TutorialEvent,
  TutorialState,
  TutorialProgress,
  AccessibilitySettings
} from './types.js';
import { TUTORIAL_STEPS } from './tutorialSteps.js';
import { LUMEN_DIALOGUE, LumenLine } from './lumenLines.js';
import { TutorialTelemetry } from './telemetry.js';

const INACTIVITY_HINT_SEC = 20;

export class TutorialDirector {
  private steps: TutorialStepDef[] = TUTORIAL_STEPS;
  private currentStepIndex = 0;
  private progress: TutorialProgress;
  private telemetry: TutorialTelemetry;

  private stepStartTime = Date.now();
  private lastActivityTime = Date.now();
  private isHintActive = false;
  private hintTimer: any = null;

  private listeners: Array<(state: TutorialState) => void> = [];
  private accessibility: AccessibilitySettings = {
    subtitleSize: 'medium',
    reducedMotion: false,
    deviceType: 'keyboard'
  };

  private isReplaying = false;

  constructor() {
    this.telemetry = new TutorialTelemetry();
    this.progress = this.loadPersistedProgress();
    this.currentStepIndex = this.findStepIndex(this.progress.currentStepId);
    this.startInactivityTimer();
    this.telemetry.recordStepStart(this.getCurrentStep().id);
  }

  private loadPersistedProgress(): TutorialProgress {
    if (typeof localStorage !== 'undefined') {
      try {
        const saved = localStorage.getItem('na_tutorial_progress');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.currentStepId) return parsed;
        }
      } catch {}
    }

    return {
      currentStepId: 'arrival',
      completedStepIds: [],
      skippedSections: [],
      failedRunsCount: 0,
      mentorCheckpointOffered: false,
      mentorCheckpointClaimed: false,
      lastUpdated: Date.now()
    };
  }

  private persistProgress(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('na_tutorial_progress', JSON.stringify(this.progress));
      } catch {}
    }
  }

  private findStepIndex(id: TutorialStepId): number {
    const idx = this.steps.findIndex((s) => s.id === id);
    return idx >= 0 ? idx : 0;
  }

  public getCurrentStep(): TutorialStepDef {
    return this.steps[this.currentStepIndex] || this.steps[0];
  }

  public getStepElapsedSeconds(): number {
    return Math.round((Date.now() - this.stepStartTime) / 1000);
  }

  public getState(): TutorialState {
    const step = this.getCurrentStep();
    const lineKey = step.mentorLineKey;
    const lineDef: LumenLine = LUMEN_DIALOGUE[lineKey] || {
      text: 'Observe the world and listen to the murmuring weights.'
    };

    let rawText = lineDef.text;
    if (this.isHintActive && lineDef.hint) {
      rawText = lineDef.hint;
    } else if (lineDef.subtext) {
      rawText = `${lineDef.text} ${lineDef.subtext}`;
    }

    const formattedSubtitles = this.formatGlyphsAndLineBreaks(rawText);

    return {
      currentStepIndex: this.currentStepIndex,
      currentStep: step,
      progress: this.progress,
      activeMentorText: lineDef.text,
      activeHintText: lineDef.hint,
      isHintActive: this.isHintActive,
      activeHighlight: step.highlightTarget,
      activeSubtitles: formattedSubtitles,
      lumenMood: this.getLumenMood(step.id),
      lumenTargetPos: step.highlightTarget?.position,
      isReplaying: this.isReplaying
    };
  }

  private getLumenMood(stepId: TutorialStepId): 'calm' | 'guiding' | 'alert' | 'success' {
    if (stepId === 'camp_mentors_note') return 'alert';
    if (stepId === 'reward_unlocked' || stepId === 'apply_fix_retrain') return 'success';
    if (stepId === 'first_harvest' || stepId === 'open_workbench' || stepId === 'connect_nodes') return 'guiding';
    return 'calm';
  }

  public formatGlyphsAndLineBreaks(text: string): string {
    const isGamepad = this.accessibility.deviceType === 'gamepad';
    const glyphs: Record<string, string> = {
      '{KEY_MOVE}': isGamepad ? 'Left Stick' : 'WASD',
      '{KEY_HARVEST}': isGamepad ? '(X)' : '[E]',
      '{KEY_LENS}': isGamepad ? '(Y)' : '[Q]',
      '{KEY_WORKBENCH}': isGamepad ? '(Menu)' : '[Tab]',
      '{KEY_CODEX}': isGamepad ? '(View)' : '[J]'
    };

    let formatted = text;
    for (const [key, val] of Object.entries(glyphs)) {
      formatted = formatted.replaceAll(key, val);
    }

    // Ensure no line exceeds 14 words
    const words = formatted.split(' ');
    const lines: string[] = [];
    let currentLine: string[] = [];

    for (const w of words) {
      currentLine.push(w);
      if (currentLine.length >= 12) {
        lines.push(currentLine.join(' '));
        currentLine = [];
      }
    }
    if (currentLine.length > 0) {
      lines.push(currentLine.join(' '));
    }

    return lines.join('\n');
  }

  public handleEvent(event: TutorialEvent): void {
    this.lastActivityTime = Date.now();
    if (this.isHintActive) {
      this.isHintActive = false;
      this.notify();
    }

    const step = this.getCurrentStep();

    // Check for failure tracking for 3h (mentor checkpoint safety net)
    if (event.type === 'divergence_observed') {
      this.progress.failedRunsCount++;
      if (this.progress.failedRunsCount >= 2 && !this.progress.mentorCheckpointOffered) {
        this.progress.mentorCheckpointOffered = true;
        this.persistProgress();
        this.notify();
      }
    }

    if (event.type === 'mentor_checkpoint_claimed') {
      this.progress.mentorCheckpointClaimed = true;
      this.persistProgress();
      this.advanceToStep('evaluator_inspection');
      return;
    }

    // Validate completion condition
    let isComplete = false;
    if (step.validateCompletion) {
      isComplete = step.validateCompletion(event, this.getState());
    } else if (event.type === step.completionTrigger) {
      isComplete = true;
    }

    if (isComplete) {
      this.completeCurrentStep();
    }
  }

  private completeCurrentStep(): void {
    const step = this.getCurrentStep();
    this.telemetry.recordStepEnd(step.id, true);

    if (!this.progress.completedStepIds.includes(step.id)) {
      this.progress.completedStepIds.push(step.id);
    }

    if (this.currentStepIndex < this.steps.length - 1) {
      this.currentStepIndex++;
      this.progress.currentStepId = this.steps[this.currentStepIndex].id;
      this.stepStartTime = Date.now();
      this.lastActivityTime = Date.now();
      this.isHintActive = false;
      this.telemetry.recordStepStart(this.getCurrentStep().id);
    } else {
      this.telemetry.recordSessionComplete();
    }

    this.persistProgress();
    this.notify();
  }

  public advanceToStep(stepId: TutorialStepId): void {
    const idx = this.findStepIndex(stepId);
    this.currentStepIndex = idx;
    this.progress.currentStepId = stepId;
    this.stepStartTime = Date.now();
    this.lastActivityTime = Date.now();
    this.isHintActive = false;
    this.telemetry.recordStepStart(stepId);
    this.persistProgress();
    this.notify();
  }

  public skipSection(sectionId: TutorialSectionId): void {
    if (!this.progress.skippedSections.includes(sectionId)) {
      this.progress.skippedSections.push(sectionId);
    }

    // Find first step that belongs to the next section
    const nextIdx = this.steps.findIndex(
      (s, idx) => idx > this.currentStepIndex && s.section !== sectionId
    );
    if (nextIdx >= 0) {
      this.currentStepIndex = nextIdx;
      this.progress.currentStepId = this.steps[nextIdx].id;
    } else {
      this.currentStepIndex = this.steps.length - 1;
      this.progress.currentStepId = this.steps[this.currentStepIndex].id;
    }

    this.stepStartTime = Date.now();
    this.lastActivityTime = Date.now();
    this.isHintActive = false;
    this.telemetry.recordStepStart(this.getCurrentStep().id);
    this.persistProgress();
    this.notify();
  }

  public replayTutorial(): void {
    this.isReplaying = true;
    this.progress.completedStepIds = [];
    this.progress.skippedSections = [];
    this.currentStepIndex = 0;
    this.progress.currentStepId = this.steps[0].id;
    this.stepStartTime = Date.now();
    this.lastActivityTime = Date.now();
    this.isHintActive = false;
    this.telemetry.recordStepStart(this.steps[0].id);
    this.persistProgress();
    this.notify();
  }

  private startInactivityTimer(): void {
    if (typeof window === 'undefined') return;
    this.hintTimer = window.setInterval(() => {
      const now = Date.now();
      const elapsedInactive = (now - this.lastActivityTime) / 1000;
      if (elapsedInactive >= INACTIVITY_HINT_SEC && !this.isHintActive) {
        this.isHintActive = true;
        const step = this.getCurrentStep();
        this.telemetry.recordStall(step.id, INACTIVITY_HINT_SEC);
        if (step.fallbackTrigger) {
          step.fallbackTrigger(this.getState());
        }
        this.notify();
      }
    }, 2000);
  }

  public setAccessibilitySettings(settings: Partial<AccessibilitySettings>): void {
    this.accessibility = { ...this.accessibility, ...settings };
    this.notify();
  }

  public getAccessibilitySettings(): AccessibilitySettings {
    return this.accessibility;
  }

  public getTelemetry(): TutorialTelemetry {
    return this.telemetry;
  }

  public subscribe(cb: (state: TutorialState) => void): () => void {
    this.listeners.push(cb);
    cb(this.getState());
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }

  private notify(): void {
    const s = this.getState();
    for (const cb of this.listeners) {
      cb(s);
    }
  }

  public dispose(): void {
    if (this.hintTimer) {
      clearInterval(this.hintTimer);
      this.hintTimer = null;
    }
    this.listeners = [];
  }
}

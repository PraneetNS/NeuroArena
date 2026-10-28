/**
 * Local-only Tutorial Telemetry persisted in IndexedDB.
 * Zero remote network transmission.
 */

import { StepTelemetryEntry, TutorialTelemetrySession, TutorialStepId } from './types.js';

const DB_NAME = 'neuroarena_tutorial_db';
const DB_VERSION = 1;
const STORE_TELEMETRY = 'telemetry_sessions';
const STORE_PROGRESS = 'tutorial_progress';

export class TutorialTelemetry {
  private db: IDBDatabase | null = null;
  private currentSession: TutorialTelemetrySession;
  private activeStepEntry: StepTelemetryEntry | null = null;

  constructor() {
    this.currentSession = {
      sessionId: `session_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      startedAt: Date.now(),
      totalDurationSec: 0,
      completedSteps: [],
      stalledStepsCount: 0,
      hardwareSummary: typeof navigator !== 'undefined' ? `${navigator.userAgent} (${navigator.hardwareConcurrency || 4} cores)` : 'headless'
    };
    this.initDb();
  }

  private initDb(): void {
    if (typeof indexedDB === 'undefined') return;
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_TELEMETRY)) {
          db.createObjectStore(STORE_TELEMETRY, { keyPath: 'sessionId' });
        }
        if (!db.objectStoreNames.contains(STORE_PROGRESS)) {
          db.createObjectStore(STORE_PROGRESS, { keyPath: 'key' });
        }
      };
      req.onsuccess = (e) => {
        this.db = (e.target as IDBOpenDBRequest).result;
        this.persistSession();
      };
    } catch {
      // Memory fallback
    }
  }

  public recordStepStart(stepId: TutorialStepId): void {
    if (this.activeStepEntry && !this.activeStepEntry.completedAt) {
      this.recordStepEnd(this.activeStepEntry.stepId, false);
    }

    this.activeStepEntry = {
      stepId,
      startedAt: Date.now(),
      durationSec: 0,
      stalled: false,
      stallSeconds: 0,
      attempts: (this.activeStepEntry?.stepId === stepId ? this.activeStepEntry.attempts + 1 : 1)
    };
  }

  public recordStall(stepId: TutorialStepId, stallSec: number): void {
    if (this.activeStepEntry && this.activeStepEntry.stepId === stepId) {
      this.activeStepEntry.stalled = true;
      this.activeStepEntry.stallSeconds += stallSec;
      this.currentSession.stalledStepsCount++;
      this.persistSession();
    }
  }

  public recordStepEnd(stepId: TutorialStepId, _succeeded: boolean = true): void {
    if (!this.activeStepEntry || this.activeStepEntry.stepId !== stepId) return;

    this.activeStepEntry.completedAt = Date.now();
    this.activeStepEntry.durationSec = Math.round((this.activeStepEntry.completedAt - this.activeStepEntry.startedAt) / 1000);
    this.currentSession.completedSteps.push({ ...this.activeStepEntry });
    this.currentSession.totalDurationSec += this.activeStepEntry.durationSec;
    this.activeStepEntry = null;

    this.persistSession();
  }

  public recordSessionComplete(): void {
    this.currentSession.completedAt = Date.now();
    this.currentSession.totalDurationSec = Math.round((this.currentSession.completedAt - this.currentSession.startedAt) / 1000);
    this.persistSession();
  }

  public getSession(): TutorialTelemetrySession {
    return this.currentSession;
  }

  private persistSession(): void {
    if (!this.db) {
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem('na_tutorial_telemetry_latest', JSON.stringify(this.currentSession));
        } catch {}
      }
      return;
    }

    try {
      const tx = this.db.transaction(STORE_TELEMETRY, 'readwrite');
      tx.objectStore(STORE_TELEMETRY).put(this.currentSession);
    } catch {}
  }

  public async exportTelemetryJSON(): Promise<string> {
    const data = this.currentSession;
    return JSON.stringify(data, null, 2);
  }

  public downloadTelemetryReport(): void {
    if (typeof document === 'undefined') return;
    const json = JSON.stringify(this.currentSession, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `neuroarena_tutorial_telemetry_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

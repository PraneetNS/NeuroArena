/**
 * Main-thread Client for the WebGPU Training Worker.
 *
 * Provides a strongly-typed event emitter interface:
 * - Methods: start(config), pause(), resume(), stop(), setLearningRate(lr),
 *   setThrottle(fraction), sample(request), loadCheckpoint(id), saveCheckpoint().
 * - Events: stats, valStats, sampleToken, checkpoint, error, deviceLost, finished.
 */

import {
  TrainerWorkerInMessage,
  TrainerWorkerOutEvent,
  TrainingRunConfig,
  TrainingStats,
  ValidationStats,
  SampleRequest,
  SampleTokenData,
  CheckpointEventData,
  DeviceLostEventData,
  FinishedEventData,
  DiagnosticsSnapshot
} from './types.js';

export type EventMap = {
  stats: TrainingStats;
  valStats: ValidationStats;
  sampleToken: SampleTokenData;
  checkpoint: CheckpointEventData;
  diagnostics: DiagnosticsSnapshot;
  deviceLost: DeviceLostEventData;
  error: { message: string; stack?: string };
  finished: FinishedEventData;
};

export class TrainingClient {
  private worker: Worker;
  private listeners: Map<keyof EventMap, Set<(data: any) => void>> = new Map();
  private isTerminated = false;

  constructor(workerOrFactory?: Worker | (() => Worker)) {
    if (workerOrFactory instanceof Worker) {
      this.worker = workerOrFactory;
    } else if (typeof workerOrFactory === 'function') {
      this.worker = workerOrFactory();
    } else {
      // Default instantiation using Vite/ESM module worker
      this.worker = new Worker(new URL('./trainer.worker.ts', import.meta.url), {
        type: 'module'
      });
    }

    this.worker.onmessage = (event: MessageEvent<TrainerWorkerOutEvent>) => {
      this.handleWorkerEvent(event.data);
    };

    this.worker.onerror = (err: ErrorEvent) => {
      this.emit('error', {
        message: err.message || 'Worker encountered an error',
        stack: err.error?.stack
      });
    };
  }

  private handleWorkerEvent(evt: TrainerWorkerOutEvent): void {
    switch (evt.type) {
      case 'STATS':
        this.emit('stats', evt.data);
        break;
      case 'VAL_STATS':
        this.emit('valStats', evt.data);
        break;
      case 'SAMPLE_TOKEN':
        this.emit('sampleToken', evt.data);
        break;
      case 'CHECKPOINT':
        this.emit('checkpoint', evt.data);
        break;
      case 'DIAGNOSTICS':
        this.emit('diagnostics', evt.data);
        break;
      case 'DEVICE_LOST':
        this.emit('deviceLost', evt.data);
        break;
      case 'ERROR':
        this.emit('error', evt.data);
        break;
      case 'FINISHED':
        this.emit('finished', evt.data);
        break;
    }
  }

  private post(msg: TrainerWorkerInMessage): void {
    if (this.isTerminated) {
      throw new Error('Cannot send message: TrainingClient worker is terminated.');
    }
    this.worker.postMessage(msg);
  }

  // --- Strongly Typed Event Listeners ---
  public on<K extends keyof EventMap>(event: K, handler: (data: EventMap[K]) => void): this {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
    return this;
  }

  public off<K extends keyof EventMap>(event: K, handler: (data: EventMap[K]) => void): this {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
    return this;
  }

  private emit<K extends keyof EventMap>(event: K, data: EventMap[K]): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      for (const h of handlers) {
        try {
          h(data);
        } catch (e) {
          console.error(`Error in ${event} event listener:`, e);
        }
      }
    }
  }

  // --- Runtime Control Methods ---

  public start(config: TrainingRunConfig): void {
    this.post({ type: 'START', config });
  }

  public pause(): void {
    this.post({ type: 'PAUSE' });
  }

  public resume(): void {
    this.post({ type: 'RESUME' });
  }

  public stop(): void {
    this.post({ type: 'STOP' });
  }

  public setLearningRate(lr: number): void {
    this.post({ type: 'SET_LR', lr });
  }

  /**
   * Adjusts the training throttle fraction (0..1).
   * 1 = full GPU speed.
   * Lower values insert idle delay between steps so the main thread and GPU can render frames.
   */
  public setThrottle(fraction: number): void {
    const clamped = Math.max(0, Math.min(1, fraction));
    this.post({ type: 'SET_THROTTLE', throttle: clamped });
  }

  public sample(request: SampleRequest): void {
    this.post({ type: 'SAMPLE', request });
  }

  public saveCheckpoint(): void {
    this.post({ type: 'SAVE_CHECKPOINT' });
  }

  public loadCheckpoint(checkpointId?: string | number): void {
    this.post({ type: 'LOAD_CHECKPOINT', checkpointId });
  }

  public terminate(): void {
    if (!this.isTerminated) {
      this.isTerminated = true;
      this.worker.terminate();
      this.listeners.clear();
    }
  }
}

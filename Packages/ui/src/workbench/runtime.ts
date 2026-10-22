/**
 * Mock Workbench Runtime
 * Emits plausible training stats, convergence curves, annotations, and text samples at 10 Hz.
 * Fully decoupled from UI code for seamless future replacement with real ml-core worker.
 */

import {
  WorkbenchRuntime,
  RuntimeListener,
  TrainingStepStats,
  GeneratedSample,
  GraphState
} from './types.js';

export class MockRuntime implements WorkbenchRuntime {
  private listeners: Set<RuntimeListener> = new Set();
  private timer: number | null = null;
  private history: TrainingStepStats[] = [];
  private samples: GeneratedSample[] = [];

  private currentStep = 0;
  private maxSteps = 500;
  private runningState: 'idle' | 'running' | 'paused' | 'completed' | 'error' = 'idle';

  // Simulation parameters
  public simulateDivergence: boolean = false;
  public simulateOverfitting: boolean = false;

  private startTime = 0;
  private lastLoss = 6.2;


  public async start(graph: GraphState): Promise<void> {
    this.reset();

    // Extract trainer node parameters if present
    const trainerNode = graph.nodes.find((n) => n.kind === 'trainer');
    if (trainerNode && trainerNode.data) {
      const data = trainerNode.data as any;
      if (data.maxSteps) this.maxSteps = data.maxSteps;
    }

    this.runningState = 'running';
    this.startTime = performance.now();
    this.emitState('running');

    // Initial baseline sample
    this.generateCheckpointSample(0);

    // 10 Hz tick loop (100ms)
    this.timer = window.setInterval(() => {
      this.tick();
    }, 100);
  }

  public pause(): void {
    if (this.runningState === 'running') {
      if (this.timer) clearInterval(this.timer);
      this.timer = null;
      this.runningState = 'paused';
      this.emitState('paused');
    }
  }

  public resume(): void {
    if (this.runningState === 'paused') {
      this.runningState = 'running';
      this.emitState('running');
      this.timer = window.setInterval(() => {
        this.tick();
      }, 100);
    }
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.runningState = 'idle';
    this.emitState('idle');
  }

  public reset(): void {
    this.stop();
    this.history = [];
    this.samples = [];
    this.currentStep = 0;
    this.lastLoss = 6.2;
  }

  private tick(): void {
    this.currentStep++;

    const progress = this.currentStep / this.maxSteps;
    const elapsedSec = (performance.now() - this.startTime) / 1000;
    const stepsLeft = Math.max(0, this.maxSteps - this.currentStep);
    const etaSec = Math.round(stepsLeft * 0.1);

    // Plausible learning rate warmup and cosine decay
    let lr = 3e-4;
    const warmupSteps = Math.round(this.maxSteps * 0.1);
    if (this.currentStep <= warmupSteps) {
      lr = (this.currentStep / warmupSteps) * 3e-4;
    } else {
      const decayProgress = (this.currentStep - warmupSteps) / (this.maxSteps - warmupSteps);
      lr = 3e-4 * (0.5 * (1 + Math.cos(decayProgress * Math.PI)));
    }

    // Realistic loss decay with mini-batch noise
    let trainLoss: number;
    let valLoss: number;
    const annotations: string[] = [];

    if (this.simulateDivergence && this.currentStep > 80) {
      // Divergence failure simulation
      this.lastLoss += 0.45 + Math.random() * 0.8;
      trainLoss = this.lastLoss;
      valLoss = trainLoss * 1.25;
      if (this.currentStep === 81) {
        annotations.push('Gradient exploded (learning rate too high)');
      }
      if (trainLoss > 30.0) {
        this.stop();
        this.runningState = 'error';
        this.emitState('error', 'Training diverged to NaN. Reduce learning rate or add gradient clipping.');
        return;
      }
    } else {
      // Normal healthy convergence
      const baseIdealLoss = 1.45 + 4.75 * Math.exp(-progress * 4.2);
      const noise = (Math.random() - 0.48) * 0.08;
      trainLoss = Math.max(1.15, Math.round((baseIdealLoss + noise) * 1000) / 1000);

      // Validation loss
      if (this.simulateOverfitting && progress > 0.6) {
        valLoss = trainLoss + (progress - 0.6) * 1.8 + Math.random() * 0.05;
        if (progress > 0.6 && progress < 0.62) {
          annotations.push('Overfitting detected: validation loss rising');
        }
      } else {
        valLoss = Math.max(1.22, Math.round((trainLoss + 0.12 + Math.random() * 0.04) * 1000) / 1000);
      }

      // Plausible event annotations
      if (this.currentStep === warmupSteps) {
        annotations.push('Warmup phase completed');
      } else if (this.currentStep === Math.round(this.maxSteps * 0.4)) {
        annotations.push('Checkpoint #1 saved');
        this.generateCheckpointSample(this.currentStep);
      } else if (this.currentStep === Math.round(this.maxSteps * 0.75)) {
        annotations.push('Checkpoint #2 saved');
        this.generateCheckpointSample(this.currentStep);
      }
    }

    const stats: TrainingStepStats = {
      step: this.currentStep,
      maxSteps: this.maxSteps,
      trainLoss,
      valLoss,
      learningRate: lr,
      tokensPerSec: Math.round(14000 + (Math.random() - 0.5) * 800),
      elapsedSeconds: Math.round(elapsedSec * 10) / 10,
      etaSeconds: etaSec,
      annotations: annotations.length > 0 ? annotations : undefined
    };

    this.history.push(stats);
    this.emitStep(stats);

    // Completion
    if (this.currentStep >= this.maxSteps) {
      this.generateCheckpointSample(this.maxSteps);
      this.stop();
      this.runningState = 'completed';
      this.emitState('completed');
    }
  }

  private generateCheckpointSample(step: number): void {
    const prompts = [
      'The transformer architecture',
      'In the silicon sands of the arena'
    ];

    prompts.forEach((prompt) => {
      let output = '';
      let ppl = 85.0;

      if (step === 0) {
        output = 'q9# zx.. //? kjlw 010 [unk] 884';
        ppl = 92.4;
      } else if (step <= 150) {
        output = prompt === prompts[0]
          ? 'is a token layer with weights and matrices that compute tokens.'
          : 'the robot companion was collecting datasets near the forge terminal.';
        ppl = 18.2;
      } else if (step <= 350) {
        output = prompt === prompts[0]
          ? 'processes sequence vectors through multi-head self-attention and pre-LayerNorm residual blocks.'
          : 'the ancient network whispered residual weights across the valley, awaiting backpropagation.';
        ppl = 6.4;
      } else {
        output = prompt === prompts[0]
          ? 'unifies token embedding, learned positional embeddings, and causal multi-head self-attention with tied output projections.'
          : 'the dormant drone awakened, its local weights fully converged inside the browser memory without external APIs.';
        ppl = 3.8;
      }

      const sample: GeneratedSample = {
        checkpointStep: step,
        prompt,
        output,
        perplexity: ppl,
        timestamp: Date.now()
      };

      this.samples.push(sample);
      this.emitSample(sample);
    });
  }

  public subscribe(listener: RuntimeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getHistory(): TrainingStepStats[] {
    return this.history;
  }

  public getSamples(): GeneratedSample[] {
    return this.samples;
  }

  public isRunning(): boolean {
    return this.runningState === 'running';
  }

  private emitStep(stats: TrainingStepStats): void {
    this.listeners.forEach((l) => l.onStep?.(stats));
  }

  private emitSample(sample: GeneratedSample): void {
    this.listeners.forEach((l) => l.onSample?.(sample));
  }

  private emitState(state: 'idle' | 'running' | 'paused' | 'completed' | 'error', error?: string): void {
    this.listeners.forEach((l) => l.onStateChange?.(state, error));
  }
}

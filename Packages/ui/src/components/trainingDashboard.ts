/**
 * Neural Forge Training Dashboard: Real-time loss charts, attention heatmaps,
 * live generation checkpoints, and hyperparameter controls.
 */

import { TinyGPT, TinyGPTConfig, AdamW, Dataset, Tokenizer, Sampler } from '@na/ml-core';

export class TrainingDashboard {
  public root: HTMLElement;
  public isOpen = false;

  private model: TinyGPT;
  private optimizer: AdamW;
  private dataset: Dataset;
  private tokenizer: Tokenizer;

  private isTraining = false;
  private stepCount = 0;
  private lossHistory: number[] = [];
  private startTime = 0;
  private totalTokensTrained = 0;

  // Hyperparameters
  public config: TinyGPTConfig = {
    vocabSize: 64,
    blockSize: 32,
    nEmbd: 48,
    nLayer: 2,
    nHead: 4
  };
  public learningRate = 0.006;
  public batchSize = 1;

  // UI elements
  private lossCanvas!: HTMLCanvasElement;
  private attentionCanvas!: HTMLCanvasElement;
  private liveSampleBox!: HTMLElement;
  private lossMetricEl!: HTMLElement;
  private perplexityMetricEl!: HTMLElement;
  private stepMetricEl!: HTMLElement;
  private speedMetricEl!: HTMLElement;
  private trainBtn!: HTMLButtonElement;

  private onAwakenCompanion: (model: TinyGPT) => void;
  private onStepSound: () => void;

  constructor(
    parent: HTMLElement,
    tokenizer: Tokenizer,
    dataset: Dataset,
    callbacks: {
      onAwaken: (model: TinyGPT) => void;
      onStepSound: () => void;
    }
  ) {
    this.tokenizer = tokenizer;
    this.dataset = dataset;
    this.onAwakenCompanion = callbacks.onAwaken;
    this.onStepSound = callbacks.onStepSound;

    this.config.vocabSize = Math.max(16, this.tokenizer.vocabSize);
    this.model = new TinyGPT(this.config);
    this.optimizer = new AdamW(this.model, { lr: this.learningRate });

    this.root = document.createElement('div');
    this.root.className = 'modal-overlay';
    parent.appendChild(this.root);

    this.render();
  }

  public getModel(): TinyGPT {
    return this.model;
  }

  public open(): void {
    this.isOpen = true;
    this.root.classList.add('active');
    this.render();
  }

  public close(): void {
    this.isOpen = false;
    this.root.classList.remove('active');
  }

  public resetModel(): void {
    this.isTraining = false;
    this.config.vocabSize = Math.max(16, this.tokenizer.vocabSize);
    this.model = new TinyGPT(this.config);
    this.optimizer = new AdamW(this.model, { lr: this.learningRate });
    this.stepCount = 0;
    this.lossHistory = [];
    this.totalTokensTrained = 0;
    this.render();
  }

  public trainStep(): number | null {
    const blockSize = this.config.blockSize ?? 32;
    if (this.dataset.length < blockSize + 1) {
      return null;
    }

    const batch = this.dataset.getRandomBatch(blockSize);
    if (!batch) return null;


    // 1. Zero gradients
    this.model.zeroGrad();

    // 2. Forward pass
    this.model.forward(batch.inputs);

    // 3. Backward pass with cross entropy loss
    const loss = this.model.backwardWithLoss(batch.targets);

    // 4. Optimizer update
    this.optimizer.step();

    this.stepCount++;
    this.totalTokensTrained += batch.inputs.length;
    this.lossHistory.push(loss);
    if (this.lossHistory.length > 300) {
      this.lossHistory.shift();
    }

    // Play periodic audio step
    if (this.stepCount % 5 === 0) {
      this.onStepSound();
    }

    return loss;
  }

  private loop = (): void => {
    if (!this.isTraining) return;

    // Run 2 steps per animation frame for optimal speed
    let lastLoss: number | null = null;
    for (let i = 0; i < 2; i++) {
      lastLoss = this.trainStep();
    }

    if (lastLoss !== null) {
      this.updateMetrics(lastLoss);
      this.drawLossGraph();

      // Checkpoint generation every 25 steps
      if (this.stepCount % 25 === 0) {
        this.generateLiveSample();
        this.drawAttentionHeatmap();
      }
    }

    requestAnimationFrame(this.loop);
  };

  public toggleTraining(): void {
    this.isTraining = !this.isTraining;
    if (this.isTraining) {
      this.startTime = performance.now();
      this.trainBtn.textContent = 'Pause Training ⏸';
      this.trainBtn.classList.add('btn-cyber-amber');
      requestAnimationFrame(this.loop);
    } else {
      this.trainBtn.textContent = 'Start Training ▶';
      this.trainBtn.classList.remove('btn-cyber-amber');
    }
  }

  private async generateLiveSample(): Promise<void> {
    if (!this.liveSampleBox) return;
    try {
      const sample = await Sampler.generate(this.model, this.tokenizer, '[PLAYER]: ', {
        maxNewTokens: 35,
        temperature: 0.8
      });
      this.liveSampleBox.innerHTML = `
        <span style="color: var(--accent-cyan); font-weight: 700;">[Step ${this.stepCount} Checkpoint]</span>
        <div style="margin-top: 0.4rem; color: #fff;">${sample.replace(/\n/g, '<br/>')}</div>
      `;
    } catch {
      // Ignored if prompt length mismatch
    }
  }

  private updateMetrics(currentLoss: number): void {
    if (!this.lossMetricEl) return;
    const perplexity = Math.min(999, Math.exp(currentLoss));
    this.lossMetricEl.textContent = currentLoss.toFixed(4);
    this.perplexityMetricEl.textContent = perplexity.toFixed(2);
    this.stepMetricEl.textContent = this.stepCount.toString();

    const elapsedSec = (performance.now() - this.startTime) / 1000;
    const speed = elapsedSec > 0 ? (this.totalTokensTrained / elapsedSec).toFixed(0) : '0';
    this.speedMetricEl.textContent = `${speed} tok/s`;
  }

  private drawLossGraph(): void {
    if (!this.lossCanvas) return;
    const ctx = this.lossCanvas.getContext('2d');
    if (!ctx) return;

    const w = this.lossCanvas.width;
    const h = this.lossCanvas.height;
    ctx.clearRect(0, 0, w, h);

    // Background & subtle grid lines
    ctx.fillStyle = 'rgba(15, 23, 42, 0.6)';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    for (let y = 0; y < h; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    if (this.lossHistory.length < 2) return;

    const maxLoss = Math.max(5.0, ...this.lossHistory);
    const minLoss = Math.min(0.5, ...this.lossHistory);
    const range = maxLoss - minLoss || 1;

    // Draw raw loss curve
    ctx.strokeStyle = 'rgba(0, 243, 255, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    this.lossHistory.forEach((loss, i) => {
      const x = (i / (this.lossHistory.length - 1)) * (w - 20) + 10;
      const y = h - ((loss - minLoss) / range) * (h - 20) - 10;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Draw smoothed moving average
    const smoothed: number[] = [];
    const windowSize = 8;
    for (let i = 0; i < this.lossHistory.length; i++) {
      const start = Math.max(0, i - windowSize + 1);
      const sub = this.lossHistory.slice(start, i + 1);
      smoothed.push(sub.reduce((a, b) => a + b, 0) / sub.length);
    }

    ctx.strokeStyle = '#a855f7';
    ctx.lineWidth = 3;
    ctx.beginPath();
    smoothed.forEach((loss, i) => {
      const x = (i / (smoothed.length - 1)) * (w - 20) + 10;
      const y = h - ((loss - minLoss) / range) * (h - 20) - 10;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  private drawAttentionHeatmap(): void {
    if (!this.attentionCanvas) return;
    const ctx = this.attentionCanvas.getContext('2d');
    if (!ctx) return;

    const w = this.attentionCanvas.width;
    const h = this.attentionCanvas.height;
    ctx.clearRect(0, 0, w, h);

    const maps = this.model.getAttentionMaps();
    if (maps.length === 0 || maps[0].length === 0) return;

    const blockSize = this.config.blockSize ?? 32;
    const T = Math.min(blockSize, 16);
    const firstMap = maps[0]; // First block, first head
    const cellSize = w / T;

    for (let i = 0; i < T; i++) {
      for (let j = 0; j < T; j++) {
        const val = firstMap[i * blockSize + j] || 0;
        // Cyan intensity gradient
        const intensity = Math.min(1.0, val * 3.0);
        ctx.fillStyle = `rgba(0, 243, 255, ${intensity})`;
        ctx.fillRect(j * cellSize, i * cellSize, cellSize - 1, cellSize - 1);
      }
    }
  }

  private render(): void {
    const paramCount = this.model.getParameterCount();

    this.root.innerHTML = `
      <div class="modal-container glass-panel glass-panel-glow" style="padding: 1.8rem; display: flex; flex-direction: column; gap: 1.2rem; max-width: 1040px;">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.8rem;">
          <div>
            <div style="font-family: var(--font-mono); font-weight: 800; font-size: 1.35rem; color: var(--accent-purple); letter-spacing: 0.05em;">
              THE NEURAL FORGE
            </div>
            <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.2rem;">
              Backpropagation & Transformer Decoder Architecture (${paramCount.toLocaleString()} parameters)
            </div>
          </div>
          <button id="forge-close" class="btn-cyber" style="padding: 0.4rem 0.8rem;">ESC ✕</button>
        </div>

        <!-- Metrics Row -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.8rem;">
          <div class="glass-panel" style="padding: 0.8rem; text-align: center;">
            <div style="font-size: 0.7rem; color: var(--text-dim); text-transform: uppercase; font-family: var(--font-mono);">Current Loss</div>
            <div id="forge-loss" style="font-family: var(--font-mono); font-size: 1.35rem; font-weight: 700; color: var(--accent-cyan); margin-top: 0.2rem;">0.0000</div>
          </div>
          <div class="glass-panel" style="padding: 0.8rem; text-align: center;">
            <div style="font-size: 0.7rem; color: var(--text-dim); text-transform: uppercase; font-family: var(--font-mono);">Perplexity</div>
            <div id="forge-ppl" style="font-family: var(--font-mono); font-size: 1.35rem; font-weight: 700; color: var(--accent-purple); margin-top: 0.2rem;">0.00</div>
          </div>
          <div class="glass-panel" style="padding: 0.8rem; text-align: center;">
            <div style="font-size: 0.7rem; color: var(--text-dim); text-transform: uppercase; font-family: var(--font-mono);">Training Steps</div>
            <div id="forge-steps" style="font-family: var(--font-mono); font-size: 1.35rem; font-weight: 700; color: var(--accent-amber); margin-top: 0.2rem;">${this.stepCount}</div>
          </div>
          <div class="glass-panel" style="padding: 0.8rem; text-align: center;">
            <div style="font-size: 0.7rem; color: var(--text-dim); text-transform: uppercase; font-family: var(--font-mono);">Throughput</div>
            <div id="forge-speed" style="font-family: var(--font-mono); font-size: 1.35rem; font-weight: 700; color: var(--accent-green); margin-top: 0.2rem;">0 tok/s</div>
          </div>
        </div>

        <!-- Main Workspace: Loss Chart & Attention Heatmap -->
        <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 1rem;">
          <!-- Loss Chart -->
          <div class="glass-panel" style="padding: 1rem; display: flex; flex-direction: column; gap: 0.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-family: var(--font-mono); font-size: 0.75rem; text-transform: uppercase; color: var(--text-dim);">
                Real-Time Loss Convergence
              </span>
              <span style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--accent-purple);">
                ● Moving Average
              </span>
            </div>
            <canvas id="loss-canvas" width="560" height="200" style="width: 100%; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);"></canvas>
          </div>

          <!-- Attention Heatmap -->
          <div class="glass-panel" style="padding: 1rem; display: flex; flex-direction: column; gap: 0.5rem;">
            <div style="font-family: var(--font-mono); font-size: 0.75rem; text-transform: uppercase; color: var(--text-dim);">
              Self-Attention Weights [T × T]
            </div>
            <div style="display: flex; justify-content: center; align-items: center; flex: 1;">
              <canvas id="attn-canvas" width="200" height="200" style="border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);"></canvas>
            </div>
          </div>
        </div>

        <!-- Live Sample Checkpoint Box -->
        <div class="glass-panel" style="padding: 1rem;">
          <div style="font-family: var(--font-mono); font-size: 0.75rem; text-transform: uppercase; color: var(--text-dim); margin-bottom: 0.4rem;">
            Live Generative Checkpoint (Watching the Tiny GPT learn)
          </div>
          <div id="live-sample-box" style="font-family: var(--font-mono); font-size: 0.85rem; background: rgba(15, 23, 42, 0.6); padding: 0.8rem; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); min-height: 48px;">
            <span style="color: var(--text-dim);">Start training to see checkpoints stream in...</span>
          </div>
        </div>

        <!-- Training Controls & Awaken -->
        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-subtle); padding-top: 1rem;">
          <div style="display: flex; gap: 0.6rem;">
            <button id="btn-toggle-train" class="btn-cyber btn-cyber-purple">
              Start Training ▶
            </button>
            <button id="btn-step-1" class="btn-cyber">
              Step 1x
            </button>
            <button id="btn-step-10" class="btn-cyber">
              Step 10x
            </button>
            <button id="btn-reset-weights" class="btn-cyber" style="border-color: var(--text-dim); color: var(--text-muted);">
              Reset Weights
            </button>
          </div>

          <button id="btn-awaken-companion" class="btn-cyber btn-cyber-amber" style="padding: 0.6rem 1.4rem;">
            Awaken 3D Companion Drone ⚡
          </button>
        </div>
      </div>
    `;

    this.lossCanvas = this.root.querySelector('#loss-canvas') as HTMLCanvasElement;
    this.attentionCanvas = this.root.querySelector('#attn-canvas') as HTMLCanvasElement;
    this.liveSampleBox = this.root.querySelector('#live-sample-box') as HTMLElement;
    this.lossMetricEl = this.root.querySelector('#forge-loss') as HTMLElement;
    this.perplexityMetricEl = this.root.querySelector('#forge-ppl') as HTMLElement;
    this.stepMetricEl = this.root.querySelector('#forge-steps') as HTMLElement;
    this.speedMetricEl = this.root.querySelector('#forge-speed') as HTMLElement;
    this.trainBtn = this.root.querySelector('#btn-toggle-train') as HTMLButtonElement;

    // Attach listeners
    this.root.querySelector('#forge-close')?.addEventListener('click', () => this.close());
    this.trainBtn.addEventListener('click', () => this.toggleTraining());

    this.root.querySelector('#btn-step-1')?.addEventListener('click', () => {
      const loss = this.trainStep();
      if (loss !== null) {
        this.updateMetrics(loss);
        this.drawLossGraph();
        this.generateLiveSample();
        this.drawAttentionHeatmap();
      }
    });

    this.root.querySelector('#btn-step-10')?.addEventListener('click', () => {
      for (let i = 0; i < 10; i++) {
        this.trainStep();
      }
      if (this.lossHistory.length > 0) {
        this.updateMetrics(this.lossHistory[this.lossHistory.length - 1]);
        this.drawLossGraph();
        this.generateLiveSample();
        this.drawAttentionHeatmap();
      }
    });

    this.root
      .querySelector('#btn-reset-weights')
      ?.addEventListener('click', () => this.resetModel());

    this.root.querySelector('#btn-awaken-companion')?.addEventListener('click', () => {
      this.onAwakenCompanion(this.model);
      this.close();
    });

    this.drawLossGraph();
    this.drawAttentionHeatmap();
  }
}

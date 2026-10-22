/**
 * NeuroArena ML-Core Performance Micro-Benchmark Suite.
 */

import {
  matmul,
  causalAttention,
  causalAttentionBackward,
  TinyGPT,
  AdamW,
  Tokenizer,
  Sampler,
  PRESET_CORPORA,
  PRESETS
} from '@na/ml-core';
import '@na/ui/styles';

interface BenchmarkResult {
  name: string;
  category: string;
  metric: string;
  value: string;
  details: string;
}

class BenchmarkRunner {
  private root: HTMLElement;
  private results: BenchmarkResult[] = [];
  private isRunning = false;

  constructor() {
    this.root = document.getElementById('bench-root')!;
    this.render();
  }

  private async runMatmulBenchmark(): Promise<BenchmarkResult> {
    const size = 128;
    const iters = 150;
    const A = new Float64Array(size * size);
    const B = new Float64Array(size * size);
    const C = new Float64Array(size * size);
    A.fill(0.5);
    B.fill(0.2);

    // Warm-up
    for (let i = 0; i < 5; i++) matmul(A, B, C, size, size, size);

    const start = performance.now();
    for (let i = 0; i < iters; i++) {
      matmul(A, B, C, size, size, size);
    }
    const elapsedMs = performance.now() - start;

    // FLOPs = 2 * M * N * K per matmul
    const totalFlops = 2 * size * size * size * iters;
    const gflops = (totalFlops / (elapsedMs / 1000) / 1e9).toFixed(2);
    const perIterMs = (elapsedMs / iters).toFixed(3);

    return {
      name: `Float64 Dense Matrix Multiplication (${size}×${size})`,
      category: 'Tensor Ops',
      metric: `${gflops} GFLOPS`,
      value: `${perIterMs} ms/op`,
      details: `${iters} iterations in ${elapsedMs.toFixed(1)} ms`
    };
  }

  private async runAttentionBenchmark(): Promise<BenchmarkResult> {
    const T = 32;
    const D = 64;
    const H = 4;
    const headDim = D / H;
    const q = new Float64Array(T * D).fill(0.1);
    const k = new Float64Array(T * D).fill(0.1);
    const v = new Float64Array(T * D).fill(0.1);
    const out = new Float64Array(T * D);
    const weights = new Float64Array(H * T * T);
    const dOut = new Float64Array(T * D).fill(0.01);
    const dq = new Float64Array(T * D);
    const dk = new Float64Array(T * D);
    const dv = new Float64Array(T * D);

    // Warm-up
    for (let i = 0; i < 5; i++) {
      causalAttention(q, k, v, out, weights, 1, T, H, headDim);
      causalAttentionBackward(dOut, q, k, v, weights, dq, dk, dv, 1, T, H, headDim);
    }

    const iters = 200;
    const start = performance.now();
    for (let i = 0; i < iters; i++) {
      causalAttention(q, k, v, out, weights, 1, T, H, headDim);
      causalAttentionBackward(dOut, q, k, v, weights, dq, dk, dv, 1, T, H, headDim);
    }
    const elapsedMs = performance.now() - start;
    const msPerStep = (elapsedMs / iters).toFixed(3);

    return {
      name: `Causal Multi-Head Attention (T=${T}, D=${D}, H=${H})`,
      category: 'Attention',
      metric: `${msPerStep} ms/step`,
      value: `${(1000 / (elapsedMs / iters)).toFixed(0)} ops/sec`,
      details: `Forward + Backward pass combined across ${iters} runs`
    };
  }

  private async runTransformerBlockBenchmark(): Promise<BenchmarkResult> {
    const T = 32;
    const model = new TinyGPT({
      vocabSize: 64,
      dModel: 64,
      nLayers: 1,
      nHeads: 4,
      dFF: 256,
      contextLen: 64
    });
    const inputs = new Uint16Array(T);
    const targets = new Uint16Array(T);
    for (let i = 0; i < T; i++) {
      inputs[i] = i % 64;
      targets[i] = (i + 1) % 64;
    }

    // Warm-up
    for (let i = 0; i < 5; i++) {
      model.zeroGrad();
      model.forward(inputs, 1, T, targets);
      model.backward(targets);
    }

    const iters = 100;
    const start = performance.now();
    for (let i = 0; i < iters; i++) {
      model.zeroGrad();
      model.forward(inputs, 1, T, targets);
      model.backward(targets);
    }
    const elapsedMs = performance.now() - start;
    const msPerStep = (elapsedMs / iters).toFixed(3);

    return {
      name: `Full Transformer Decoder Block (T=${T}, D=64, H=4)`,
      category: 'Architecture',
      metric: `${msPerStep} ms/step`,
      value: `${(1000 / (elapsedMs / iters)).toFixed(0)} steps/sec`,
      details: `Pre-LN Attn + Pre-LN MLP + Residuals Forward & Backward`
    };
  }

  private async runTinyGPTTrainingBenchmark(): Promise<BenchmarkResult> {
    const config = PRESETS.C;
    const model = new TinyGPT(config);
    const optimizer = new AdamW(model, { lr: 0.005 });
    const inputs = new Uint16Array(config.contextLen);
    const targets = new Uint16Array(config.contextLen);
    for (let i = 0; i < config.contextLen; i++) {
      inputs[i] = i % config.vocabSize;
      targets[i] = (i + 1) % config.vocabSize;
    }

    // Warm-up
    for (let i = 0; i < 5; i++) {
      model.zeroGrad();
      model.forward(inputs, 1, config.contextLen, targets);
      model.backward(targets);
      optimizer.step();
    }

    const iters = 50;
    const start = performance.now();
    for (let i = 0; i < iters; i++) {
      model.zeroGrad();
      model.forward(inputs, 1, config.contextLen, targets);
      model.backward(targets);
      optimizer.step();
    }
    const elapsedMs = performance.now() - start;
    const msPerStep = (elapsedMs / iters).toFixed(2);
    const tokPerSec = ((config.contextLen * iters) / (elapsedMs / 1000)).toFixed(0);

    return {
      name: `TinyGPT Preset C Training (${model.getParameterCount().toLocaleString()} params)`,
      category: 'End-to-End Training',
      metric: `${tokPerSec} tok/s`,
      value: `${msPerStep} ms/batch`,
      details: `Full batch (T=${config.contextLen}): Forward + CrossEntropy + Backward + AdamW`
    };
  }

  private async runInferenceBenchmark(): Promise<BenchmarkResult> {
    const config = PRESETS.C;
    const model = new TinyGPT(config);
    const tokenizer = new Tokenizer();
    tokenizer.buildVocab(PRESET_CORPORA.companion);

    // Warm-up
    await Sampler.generate(model, tokenizer, 'Hello', { maxNewTokens: 5 });

    const totalTokens = 30;
    const start = performance.now();
    await Sampler.generate(model, tokenizer, 'Hello companion, tell me ', {
      maxNewTokens: totalTokens,
      temperature: 0.8
    });
    const elapsedMs = performance.now() - start;
    const tokPerSec = (totalTokens / (elapsedMs / 1000)).toFixed(1);

    return {
      name: 'Autoregressive Generative Inference',
      category: 'Inference',
      metric: `${tokPerSec} tok/s`,
      value: `${(elapsedMs / totalTokens).toFixed(2)} ms/token`,
      details: `Greedy/Nucleus next-token sampling with sliding context`
    };
  }


  public async runAll(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    this.results = [];
    this.render();

    const benches = [
      () => this.runMatmulBenchmark(),
      () => this.runAttentionBenchmark(),
      () => this.runTransformerBlockBenchmark(),
      () => this.runTinyGPTTrainingBenchmark(),
      () => this.runInferenceBenchmark()
    ];

    for (const b of benches) {
      const res = await b();
      this.results.push(res);
      this.render();
      await new Promise((r) => setTimeout(r, 50));
    }

    this.isRunning = false;
    this.render();
  }

  private render(): void {
    this.root.innerHTML = `
      <div class="glass-panel glass-panel-glow" style="padding: 2.2rem; display: flex; flex-direction: column; gap: 1.6rem;">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid var(--border-subtle); padding-bottom: 1.2rem;">
          <div>
            <div style="font-family: var(--font-mono); font-weight: 800; font-size: 1.6rem; color: var(--accent-cyan); letter-spacing: 0.08em;">
              ML-CORE BENCHMARK SUITE
            </div>
            <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.3rem;">
              Hardware & Execution Profiling for Pure TypeScript Float32Array Transformer Engine
            </div>
          </div>
          <button id="btn-run-all" class="btn-cyber ${this.isRunning ? 'btn-cyber-amber' : ''}" style="padding: 0.7rem 1.6rem;">
            ${this.isRunning ? 'Executing Benchmarks ⟳' : 'Run All Benchmarks ▶'}
          </button>
        </div>

        <!-- Hardware & Environment Info -->
        <div class="glass-panel" style="padding: 1rem 1.4rem; background: rgba(30, 41, 59, 0.4); display: flex; gap: 2rem; font-family: var(--font-mono); font-size: 0.82rem;">
          <div>
            <span style="color: var(--text-dim);">ENGINE:</span>
            <span style="color: var(--accent-cyan); font-weight: 600;"> Pure TypeScript (zero ML libs)</span>
          </div>
          <div>
            <span style="color: var(--text-dim);">PLATFORM:</span>
            <span style="color: var(--accent-purple); font-weight: 600;"> ${navigator.userAgent.slice(0, 36)}...</span>
          </div>
          <div>
            <span style="color: var(--text-dim);">CORES:</span>
            <span style="color: var(--accent-green); font-weight: 600;"> ${navigator.hardwareConcurrency || 4} threads</span>
          </div>
        </div>

        <!-- Benchmark Results Table -->
        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; font-family: var(--font-mono); font-size: 0.85rem;">
            <thead>
              <tr style="border-bottom: 1px solid var(--border-subtle); color: var(--text-dim); text-align: left;">
                <th style="padding: 0.8rem 0.6rem;">BENCHMARK</th>
                <th style="padding: 0.8rem 0.6rem;">CATEGORY</th>
                <th style="padding: 0.8rem 0.6rem;">PRIMARY METRIC</th>
                <th style="padding: 0.8rem 0.6rem;">LATENCY</th>
                <th style="padding: 0.8rem 0.6rem;">DETAILS</th>
              </tr>
            </thead>
            <tbody>
              ${
                this.results.length === 0
                  ? `
                <tr>
                  <td colspan="5" style="text-align: center; padding: 3rem; color: var(--text-dim);">
                    Click "Run All Benchmarks" to measure browser execution performance.
                  </td>
                </tr>
              `
                  : this.results
                      .map(
                        (r) => `
                <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
                  <td style="padding: 0.9rem 0.6rem; font-weight: 600; color: #fff;">${r.name}</td>
                  <td style="padding: 0.9rem 0.6rem;">
                    <span class="badge-neon" style="font-size: 0.72rem;">${r.category}</span>
                  </td>
                  <td style="padding: 0.9rem 0.6rem; color: var(--accent-cyan); font-weight: 700; font-size: 0.95rem;">
                    ${r.metric}
                  </td>
                  <td style="padding: 0.9rem 0.6rem; color: var(--accent-purple); font-weight: 600;">
                    ${r.value}
                  </td>
                  <td style="padding: 0.9rem 0.6rem; color: var(--text-muted); font-size: 0.78rem;">
                    ${r.details}
                  </td>
                </tr>
              `
                      )
                      .join('')
              }
            </tbody>
          </table>
        </div>
      </div>
    `;

    this.root.querySelector('#btn-run-all')?.addEventListener('click', () => this.runAll());
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new BenchmarkRunner();
});

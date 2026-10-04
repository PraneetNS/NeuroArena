/**
 * @file mlSandbox.js
 * @description Interactive visual workbench for live training of Linear and Logistic Regression,
 * mid-run optimizer swapping (SGD, Momentum, RMSprop, Adam), loss curve plotting,
 * decision boundary tracking, and real-time narrator hook feeds.
 */

import { Datasets } from '../ml/Datasets.js';
import { DatasetHealth } from '../ml/DatasetHealth.js';
import { LinearRegression } from '../ml/linear.js';
import { LogisticRegression } from '../ml/logistic.js';
import { createOptimizer } from '../ml/optimizers.js';
import { createDatasetSplit } from '../ml/Split.js';
import { drawScatterPlot, drawLossCurves } from './sandboxPlotter.js';

// DOM Element References
const selectDataset = document.getElementById('select-dataset');
const selectModel = document.getElementById('select-model');
const selectOptimizer = document.getElementById('select-optimizer');

const sliderNoise = document.getElementById('slider-noise');
const sliderOutliers = document.getElementById('slider-outliers');
const sliderSamples = document.getElementById('slider-samples');
const sliderLr = document.getElementById('slider-lr');

const valNoise = document.getElementById('val-noise');
const valOutliers = document.getElementById('val-outliers');
const valSamples = document.getElementById('val-samples');
const valLr = document.getElementById('val-lr');

const inputSeed = document.getElementById('input-seed');
const btnRandomSeed = document.getElementById('btn-random-seed');
const btnIllConditioned = document.getElementById('btn-ill-conditioned');

const btnToggleTrain = document.getElementById('btn-toggle-train');
const btnStepOnce = document.getElementById('btn-step-once');
const btnResetModel = document.getElementById('btn-reset-model');
const btnSolveOLS = document.getElementById('btn-solve-ols');

const scatterCanvas = document.getElementById('scatter-canvas');
const scatterCtx = scatterCanvas.getContext('2d');

const lossCanvas = document.getElementById('loss-canvas');
const lossCtx = lossCanvas.getContext('2d');

// Health Readouts
const elTotalHealth = document.getElementById('health-total-val');
const elHealthBar = document.getElementById('health-total-bar');
const elBalance = document.getElementById('val-balance');
const elCleanliness = document.getElementById('val-cleanliness');
const elCoverage = document.getElementById('val-coverage');
const elStatOutliers = document.getElementById('stat-outliers');
const elHealthSummary = document.getElementById('health-summary');

// Model Telemetry Readouts
const elStatStep = document.getElementById('stat-step');
const elStatLoss = document.getElementById('stat-loss');
const elStatValLoss = document.getElementById('stat-val-loss');
const elStatGradNorm = document.getElementById('stat-grad-norm');
const elStatWeights = document.getElementById('stat-weights');
const elStatOlsLoss = document.getElementById('stat-ols-loss');
const narratorFeed = document.getElementById('narrator-feed');

// State
let currentDataset = null;
let currentSplit = null;
let model = null;
let optimizer = null;
let isTraining = false;
let stepCount = 0;
let trainLoss = 0.0;
let valLoss = 0.0;
let gradNorm = 0.0;
let olsReference = null;

// History for Loss Curves
const MAX_LOSS_HISTORY = 120;
const trainLossHistory = [];
const valLossHistory = [];

// Web Worker instance
let worker = null;

/**
 * Initializes or resets Web Worker.
 */
function initWorker() {
  if (worker) {
    worker.terminate();
    worker = null;
  }

  try {
    worker = new Worker(new URL('../../workers/Trainer.worker.js', import.meta.url), { type: 'module' });

    worker.onmessage = (e) => {
      const msg = e.data;
      if (!msg) return;

      if (msg.type === 'PROGRESS') {
        stepCount = msg.step;
        trainLoss = msg.trainLoss;
        valLoss = msg.valLoss;
        gradNorm = msg.gradNorm;

        if (model && msg.weights) {
          for (let i = 0; i < msg.weights.length; i++) {
            model.weights[i] = msg.weights[i];
          }
          model.bias = msg.bias;
          model.syncToParams();
        }

        recordLoss(trainLoss, valLoss);
        updateTelemetryUI();
        renderAllCanvases();

        if (msg.event) {
          logNarratorEvent(msg.event);
        }
      } else if (msg.type === 'PAUSED') {
        isTraining = false;
        btnToggleTrain.textContent = 'RESUME FIT';
        btnToggleTrain.className = 'chamfer-btn';
      }
    };
  } catch (err) {
    console.warn('[mlSandbox] Web Worker fallback to main thread loop:', err.message);
    worker = null;
  }
}

/**
 * Generates an ill-conditioned anisotropic dataset where Adam converges visibly faster than SGD.
 */
function generateIllConditionedData(nSamples = 100, seed = 42) {
  return Datasets.linearData({
    slope: 5.5,
    intercept: -2.8,
    noise: 0.15,
    outlierRate: 0.0,
    nSamples,
    seed,
    domain: [-0.2, 0.2] // Narrow compressed span creates high condition number
  });
}

/**
 * Generates active dataset from UI controls.
 */
function generateDataset() {
  const dsType = selectDataset.value;
  const noise = parseFloat(sliderNoise.value);
  const outlierRate = parseFloat(sliderOutliers.value);
  const nSamples = parseInt(sliderSamples.value, 10);
  const seed = parseInt(inputSeed.value, 10) || 42;

  valNoise.textContent = noise.toFixed(2);
  valOutliers.textContent = `${Math.round(outlierRate * 100)}%`;
  valSamples.textContent = nSamples;

  if (dsType === 'ill_conditioned') {
    currentDataset = generateIllConditionedData(nSamples, seed);
    selectModel.value = 'linear';
  } else if (dsType === 'linear') {
    currentDataset = Datasets.linearData({ noise, outlierRate, nSamples, seed, slope: 2.2, intercept: 0.8 });
    selectModel.value = 'linear';
  } else if (dsType === 'blobs') {
    currentDataset = Datasets.twoClassBlobs({ noise, outlierRate, nSamples, seed });
    selectModel.value = 'logistic';
  } else if (dsType === 'polynomial') {
    currentDataset = Datasets.polynomialData({ noise, outlierRate, nSamples, seed });
    selectModel.value = 'linear';
  } else if (dsType === 'tree') {
    currentDataset = Datasets.treeBoundaryData({ noise, nSamples, seed });
    selectModel.value = 'logistic';
  } else {
    currentDataset = Datasets.xorMoonsSpiralData({ type: 'moons', noise, nSamples, seed });
    selectModel.value = 'logistic';
  }

  currentSplit = createDatasetSplit({
    X: currentDataset.X,
    y: currentDataset.y,
    trainRatio: 0.75,
    seed
  });

  const health = DatasetHealth.evaluate({
    X: currentDataset.X,
    y: currentDataset.y,
    targetDomain: currentDataset.domain || [-5, 5]
  });
  updateHealthUI(health);

  if (selectModel.value === 'linear') {
    const probe = new LinearRegression(currentSplit.train.X.cols);
    olsReference = probe.solveOLS(currentSplit.train.X, currentSplit.train.y);
    elStatOlsLoss.textContent = olsReference.mse.toFixed(4);
  } else {
    olsReference = null;
    elStatOlsLoss.textContent = '—';
  }

  resetModel();
}

/**
 * Resets model parameters and optimizer state.
 */
function resetModel() {
  pauseTraining();
  stepCount = 0;
  trainLoss = 0.0;
  valLoss = 0.0;
  gradNorm = 0.0;
  trainLossHistory.length = 0;
  valLossHistory.length = 0;

  const modelType = selectModel.value;
  const nFeatures = currentSplit.train.X.cols;

  if (modelType === 'logistic') {
    model = new LogisticRegression(nFeatures);
    btnSolveOLS.style.display = 'none';
  } else {
    model = new LinearRegression(nFeatures);
    btnSolveOLS.style.display = 'inline-block';
  }

  const optType = selectOptimizer.value;
  const lr = parseFloat(sliderLr.value);
  optimizer = createOptimizer(optType, { lr });

  if (worker) {
    worker.postMessage({
      type: 'INIT',
      modelType,
      nFeatures,
      trainDataX: { rows: currentSplit.train.X.rows, cols: currentSplit.train.X.cols, data: currentSplit.train.X.data },
      trainDataY: { rows: currentSplit.train.y.rows, cols: currentSplit.train.y.cols, data: currentSplit.train.y.data },
      valDataX: currentSplit.val.X ? { rows: currentSplit.val.X.rows, cols: currentSplit.val.X.cols, data: currentSplit.val.X.data } : null,
      valDataY: currentSplit.val.y ? { rows: currentSplit.val.y.rows, cols: currentSplit.val.y.cols, data: currentSplit.val.y.data } : null,
      optType,
      optOptions: { lr },
      interval: 2
    });
  }

  updateTelemetryUI();
  renderAllCanvases();
  logNarratorEvent({ type: 'SYSTEM', message: `Model initialized (${modelType.toUpperCase()}) with ${optType.toUpperCase()} optimizer.` });
}

/**
 * Swaps optimizer mid-run without resetting parameter weights.
 */
function updateOptimizer() {
  const optType = selectOptimizer.value;
  const lr = parseFloat(sliderLr.value);

  optimizer = createOptimizer(optType, { lr });

  if (worker) {
    worker.postMessage({
      type: 'SET_OPTIMIZER',
      optType,
      optOptions: { lr }
    });
  }

  logNarratorEvent({
    type: 'SWAP_OPTIMIZER',
    message: `Optimizer swapped to ${optType.toUpperCase()} (lr = ${lr}). Weights preserved.`
  });
}

function updateLearningRate() {
  const lr = parseFloat(sliderLr.value);
  valLr.textContent = lr.toFixed(3);

  if (optimizer) optimizer.setLr(lr);
  if (worker) worker.postMessage({ type: 'SET_LEARNING_RATE', lr });
}

function toggleTraining() {
  if (isTraining) pauseTraining();
  else startTraining();
}

function startTraining() {
  isTraining = true;
  btnToggleTrain.textContent = 'PAUSE FIT';
  btnToggleTrain.className = 'chamfer-btn chamfer-btn-secondary';

  if (worker) {
    worker.postMessage({ type: 'START' });
  } else {
    runMainThreadLoop();
  }
}

function pauseTraining() {
  isTraining = false;
  btnToggleTrain.textContent = 'START FIT';
  btnToggleTrain.className = 'chamfer-btn';

  if (worker) worker.postMessage({ type: 'PAUSE' });
}

function stepOnce() {
  if (worker) {
    worker.postMessage({ type: 'STEP' });
  } else if (model && currentSplit) {
    stepMainThread();
  }
}

function stepMainThread() {
  if (!model || !optimizer || !currentSplit) return;
  stepCount++;

  const res = model.fitStep(currentSplit.train.X, currentSplit.train.y, optimizer);
  trainLoss = res.loss;
  gradNorm = res.gradNorm;
  valLoss = currentSplit.val.X.rows > 0 ? model.loss(currentSplit.val.X, currentSplit.val.y) : trainLoss;

  recordLoss(trainLoss, valLoss);
  updateTelemetryUI();
  renderAllCanvases();
}

function runMainThreadLoop() {
  if (!isTraining) return;
  for (let i = 0; i < 4; i++) stepMainThread();
  requestAnimationFrame(runMainThreadLoop);
}

function solveOLSExact() {
  if (!model || selectModel.value !== 'linear' || !currentSplit) return;

  pauseTraining();
  const res = model.solveOLS(currentSplit.train.X, currentSplit.train.y);
  trainLoss = model.loss(currentSplit.train.X, currentSplit.train.y);
  valLoss = currentSplit.val.X.rows > 0 ? model.loss(currentSplit.val.X, currentSplit.val.y) : trainLoss;
  gradNorm = 0.0;

  recordLoss(trainLoss, valLoss);
  updateTelemetryUI();
  renderAllCanvases();

  logNarratorEvent({
    type: 'SOLVE_OLS',
    message: `Normal equations solved analytically via Cholesky (MSE = ${res.mse.toFixed(4)}, R² = ${res.r2.toFixed(3)}).`
  });
}

function recordLoss(tLoss, vLoss) {
  trainLossHistory.push(tLoss);
  valLossHistory.push(vLoss);
  if (trainLossHistory.length > MAX_LOSS_HISTORY) {
    trainLossHistory.shift();
    valLossHistory.shift();
  }
}

function logNarratorEvent(event) {
  const line = document.createElement('div');
  line.style.marginBottom = '4px';

  let badgeColor = 'var(--steppes-primary)';
  if (event.type === 'DIVERGENCE_NAN' || event.type === 'OVERFIT_GAP') badgeColor = 'var(--alert-critical)';
  if (event.type === 'PLATEAU') badgeColor = 'var(--alert-converged)';

  line.innerHTML = `<span class="narrator-badge" style="background: rgba(255,255,255,0.1); color: ${badgeColor};">[${event.type}]</span>${event.message}`;
  narratorFeed.appendChild(line);
  narratorFeed.scrollTop = narratorFeed.scrollHeight;
}

function updateTelemetryUI() {
  elStatStep.textContent = stepCount;
  elStatLoss.textContent = trainLoss.toFixed(4);
  elStatValLoss.textContent = valLoss.toFixed(4);
  elStatGradNorm.textContent = gradNorm.toFixed(4);

  if (model) {
    const w0 = model.weights[0] !== undefined ? model.weights[0].toFixed(3) : '0.0';
    const b = model.bias !== undefined ? model.bias.toFixed(3) : '0.0';
    elStatWeights.textContent = `w: ${w0}, b: ${b}`;
  }
}

function updateHealthUI(health) {
  const pct = Math.round(health.totalHealth * 100);
  elTotalHealth.textContent = `${pct}%`;
  elHealthBar.style.width = `${pct}%`;

  elBalance.textContent = health.balance.toFixed(3);
  elCleanliness.textContent = health.cleanliness.toFixed(3);
  elCoverage.textContent = health.coverage.toFixed(3);
  elStatOutliers.textContent = `${health.outlierCount} (${((health.outlierCount / currentDataset.X.rows) * 100).toFixed(1)}%)`;
  elHealthSummary.textContent = health.summary;
}

function renderAllCanvases() {
  drawScatterPlot(scatterCanvas, scatterCtx, currentDataset, model, selectModel.value, olsReference);
  drawLossCurves(lossCanvas, lossCtx, trainLossHistory, valLossHistory, MAX_LOSS_HISTORY);
}

// Event Listeners
selectDataset.addEventListener('change', generateDataset);
selectModel.addEventListener('change', resetModel);
selectOptimizer.addEventListener('change', updateOptimizer);

sliderNoise.addEventListener('input', generateDataset);
sliderOutliers.addEventListener('input', generateDataset);
sliderSamples.addEventListener('input', generateDataset);
sliderLr.addEventListener('input', updateLearningRate);

inputSeed.addEventListener('change', generateDataset);
btnRandomSeed.addEventListener('click', () => {
  inputSeed.value = Math.floor(Math.random() * 100000);
  generateDataset();
});

btnIllConditioned.addEventListener('click', () => {
  selectDataset.value = 'ill_conditioned';
  sliderNoise.value = '0.05';
  sliderOutliers.value = '0.0';
  generateDataset();
  logNarratorEvent({
    type: 'BENCHMARK',
    message: 'Ill-conditioned dataset loaded. Test SGD vs ADAM: observe Adam converge smoothly without canyon bouncing.'
  });
});

btnToggleTrain.addEventListener('click', toggleTraining);
btnStepOnce.addEventListener('click', stepOnce);
btnResetModel.addEventListener('click', resetModel);
btnSolveOLS.addEventListener('click', solveOLSExact);

// Boot
initWorker();
generateDataset();

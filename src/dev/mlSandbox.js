/**
 * @file mlSandbox.js
 * @description Interactive visual workbench for live training of Polynomial (Elastic Net),
 * Linear, and Logistic Regression with live ISTA soft-thresholding, Cholesky closed-form Ridge,
 * mid-run optimizer swapping, bias-variance overfit gap tracking, and coefficient sparsity bar charts.
 */

import { Datasets } from '../ml/Datasets.js';
import { DatasetHealth } from '../ml/DatasetHealth.js';
import { LinearRegression } from '../ml/linear.js';
import { LogisticRegression } from '../ml/logistic.js';
import { PolynomialFeatures } from '../ml/polynomial.js';
import { RegularizedRegression } from '../ml/regularization.js';
import { createOptimizer } from '../ml/optimizers.js';
import { createDatasetSplit } from '../ml/Split.js';
import { Metrics } from '../ml/Metrics.js';
import { Matrix } from '../ml/Matrix.js';
import { drawScatterPlot, drawLossCurves, drawCoefficientBarChart } from './sandboxPlotter.js';

// DOM Element References
const $ = (id) => document.getElementById(id);
const selectDataset = $('select-dataset');
const selectModel = $('select-model');
const selectOptimizer = $('select-optimizer');

const sliderNoise = $('slider-noise');
const sliderOutliers = $('slider-outliers');
const sliderSamples = $('slider-samples');
const sliderLr = $('slider-lr');
const valNoise = $('val-noise');
const valOutliers = $('val-outliers');
const valSamples = $('val-samples');
const valLr = $('val-lr');

const panelPolyControls = $('panel-poly-controls');
const sliderDegree = $('slider-degree');
const sliderLambda2 = $('slider-lambda2');
const sliderLambda1 = $('slider-lambda1');
const valDegree = $('val-degree');
const valLambda2 = $('val-lambda2');
const valLambda1 = $('val-lambda1');

const inputSeed = $('input-seed');
const btnRandomSeed = $('btn-random-seed');
const btnIllConditioned = $('btn-ill-conditioned');
const btnToggleTrain = $('btn-toggle-train');
const btnStepOnce = $('btn-step-once');
const btnResetModel = $('btn-reset-model');
const btnSolveOLS = $('btn-solve-ols');

const scatterCanvas = $('scatter-canvas');
const scatterCtx = scatterCanvas.getContext('2d');
const lossCanvas = $('loss-canvas');
const lossCtx = lossCanvas.getContext('2d');
const coeffCanvas = $('coeff-canvas');
const coeffCtx = coeffCanvas ? coeffCanvas.getContext('2d') : null;

const elTotalHealth = $('health-total-val');
const elHealthBar = $('health-total-bar');
const elHealthSummary = $('health-summary');

const elStatLoss = $('stat-loss');
const elStatValLoss = $('stat-val-loss');
const elStatHiddenLoss = $('stat-hidden-loss');
const elStatOverfitGap = $('stat-overfit-gap');
const elStatZeroWeights = $('stat-zero-weights');
const elStatL1Norm = $('stat-l1-norm');
const elStatL2Norm = $('stat-l2-norm');
const elSparsityBadge = $('stat-sparsity-badge');
const narratorFeed = $('narrator-feed');

// State
let currentDataset = null;
let currentSplit = null;
let polyFeatures = null;
let transformedTrainX = null;
let transformedValX = null;
let model = null;
let optimizer = null;
let isTraining = false;
let stepCount = 0;
let trainLoss = 0.0;
let valLoss = 0.0;
let hiddenLoss = null;
let gradNorm = 0.0;
let olsReference = null;
let worker = null;

const MAX_LOSS_HISTORY = 120;
const trainLossHistory = [];
const valLossHistory = [];

function initWorker() {
  if (worker) { worker.terminate(); worker = null; }
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
          for (let i = 0; i < msg.weights.length; i++) model.weights[i] = msg.weights[i];
          model.bias = msg.bias;
          if (model.syncToParams) model.syncToParams();
        }
        recordLoss(trainLoss, valLoss);
        updateTelemetryUI();
        renderAllCanvases();
        if (msg.event) logNarratorEvent(msg.event);
      } else if (msg.type === 'PAUSED') {
        isTraining = false;
        btnToggleTrain.textContent = 'RESUME FIT';
        btnToggleTrain.className = 'chamfer-btn';
      }
    };
  } catch (err) {
    console.warn('[mlSandbox] Worker fallback:', err.message);
    worker = null;
  }
}

function generateDataset() {
  const dsType = selectDataset.value;
  const noise = parseFloat(sliderNoise.value);
  const outlierRate = parseFloat(sliderOutliers.value);
  const nSamples = parseInt(sliderSamples.value, 10);
  const seed = parseInt(inputSeed.value, 10) || 42;

  valNoise.textContent = noise.toFixed(2);
  valOutliers.textContent = `${Math.round(outlierRate * 100)}%`;
  valSamples.textContent = nSamples;

  let hiddenGenerator = null;
  if (dsType === 'polynomial') {
    currentDataset = Datasets.polynomialData({ noise, outlierRate, nSamples, seed });
    selectModel.value = 'polynomial';
    hiddenGenerator = (secretSeed) => Datasets.polynomialData({ noise, outlierRate: 0, nSamples: 50, seed: secretSeed });
  } else if (dsType === 'linear') {
    currentDataset = Datasets.linearData({ noise, outlierRate, nSamples, seed, slope: 2.2, intercept: 0.8 });
    selectModel.value = 'linear';
    hiddenGenerator = (secretSeed) => Datasets.linearData({ noise, outlierRate: 0, nSamples: 50, seed: secretSeed });
  } else if (dsType === 'blobs') {
    currentDataset = Datasets.twoClassBlobs({ noise, outlierRate, nSamples, seed });
    selectModel.value = 'logistic';
  } else if (dsType === 'ill_conditioned') {
    currentDataset = Datasets.linearData({ slope: 5.5, intercept: -2.8, noise: 0.15, outlierRate: 0.0, nSamples, seed, domain: [-0.2, 0.2] });
    selectModel.value = 'linear';
  } else if (dsType === 'tree') {
    currentDataset = Datasets.treeBoundaryData({ noise, nSamples, seed });
    selectModel.value = 'logistic';
  } else {
    currentDataset = Datasets.xorMoonsSpiralData({ type: 'moons', noise, nSamples, seed });
    selectModel.value = 'logistic';
  }

  currentSplit = createDatasetSplit({ X: currentDataset.X, y: currentDataset.y, trainRatio: 0.75, seed, hiddenGenerator });
  const health = DatasetHealth.evaluate({ X: currentDataset.X, y: currentDataset.y, targetDomain: currentDataset.domain || [-5, 5] });
  updateHealthUI(health);
  resetModel();
}

function resetModel() {
  pauseTraining();
  stepCount = 0; trainLoss = 0.0; valLoss = 0.0; hiddenLoss = null; gradNorm = 0.0;
  trainLossHistory.length = 0; valLossHistory.length = 0;

  const modelType = selectModel.value;
  const optType = selectOptimizer.value;
  const lr = parseFloat(sliderLr.value);
  optimizer = createOptimizer(optType, { lr });

  if (modelType === 'polynomial') {
    if (panelPolyControls) panelPolyControls.style.display = 'block';
    btnSolveOLS.style.display = 'inline-block';
    btnSolveOLS.textContent = 'SOLVE RIDGE';

    const degree = parseInt(sliderDegree.value, 10);
    const l1 = parseFloat(sliderLambda1.value);
    const l2 = parseFloat(sliderLambda2.value);

    valDegree.textContent = degree;
    valLambda2.textContent = l2.toFixed(3);
    valLambda1.textContent = l1.toFixed(3);

    polyFeatures = new PolynomialFeatures(degree, { standardize: true });
    transformedTrainX = polyFeatures.fitTransform(currentSplit.train.X);
    transformedValX = polyFeatures.transform(currentSplit.val.X);

    model = new RegularizedRegression(degree, { lambda1: l1, lambda2: l2 });
    try {
      const refSolver = new RegularizedRegression(degree, { lambda1: 0, lambda2: 0 });
      olsReference = refSolver.solveClosedFormRidge(transformedTrainX, currentSplit.train.y, 0.0);
    } catch { olsReference = null; }

    model.solveClosedFormRidge(transformedTrainX, currentSplit.train.y, l2);

    if (worker) {
      worker.postMessage({
        type: 'INIT', modelType: 'polynomial', nFeatures: degree,
        trainDataX: { rows: transformedTrainX.rows, cols: transformedTrainX.cols, data: transformedTrainX.data },
        trainDataY: { rows: currentSplit.train.y.rows, cols: currentSplit.train.y.cols, data: currentSplit.train.y.data },
        valDataX: { rows: transformedValX.rows, cols: transformedValX.cols, data: transformedValX.data },
        valDataY: { rows: currentSplit.val.y.rows, cols: currentSplit.val.y.cols, data: currentSplit.val.y.data },
        optType, optOptions: { lr }, lambda1: l1, lambda2: l2, interval: 2
      });
    }
  } else {
    if (panelPolyControls) panelPolyControls.style.display = 'none';
    polyFeatures = null;
    transformedTrainX = currentSplit.train.X;
    transformedValX = currentSplit.val.X;
    const nFeatures = currentSplit.train.X.cols;

    if (modelType === 'logistic') {
      model = new LogisticRegression(nFeatures);
      btnSolveOLS.style.display = 'none';
      olsReference = null;
    } else {
      model = new LinearRegression(nFeatures);
      btnSolveOLS.style.display = 'inline-block';
      btnSolveOLS.textContent = 'SOLVE OLS';
      try {
        const probe = new LinearRegression(nFeatures);
        olsReference = probe.solveOLS(currentSplit.train.X, currentSplit.train.y);
      } catch { olsReference = null; }
    }

    if (worker) {
      worker.postMessage({
        type: 'INIT', modelType, nFeatures,
        trainDataX: { rows: currentSplit.train.X.rows, cols: currentSplit.train.X.cols, data: currentSplit.train.X.data },
        trainDataY: { rows: currentSplit.train.y.rows, cols: currentSplit.train.y.cols, data: currentSplit.train.y.data },
        valDataX: currentSplit.val.X ? { rows: currentSplit.val.X.rows, cols: currentSplit.val.X.cols, data: currentSplit.val.X.data } : null,
        valDataY: currentSplit.val.y ? { rows: currentSplit.val.y.rows, cols: currentSplit.val.y.cols, data: currentSplit.val.y.data } : null,
        optType, optOptions: { lr }, interval: 2
      });
    }
  }

  evaluateAndRecord();
  updateTelemetryUI();
  renderAllCanvases();
  logNarratorEvent({ type: 'SYSTEM', message: `Model initialized (${modelType.toUpperCase()}) with ${optType.toUpperCase()} optimizer.` });
}

function updatePenalties() {
  const l1 = parseFloat(sliderLambda1.value);
  const l2 = parseFloat(sliderLambda2.value);
  valLambda1.textContent = l1.toFixed(3);
  valLambda2.textContent = l2.toFixed(3);

  if (model && model.setPenalties) model.setPenalties(l1, l2);
  if (worker) worker.postMessage({ type: 'SET_PENALTIES', lambda1: l1, lambda2: l2 });

  if (!isTraining && model instanceof RegularizedRegression && transformedTrainX) {
    if (l1 > 0) {
      const lr = parseFloat(sliderLr.value) || 0.03;
      for (let s = 0; s < 180; s++) model.stepISTA(transformedTrainX, currentSplit.train.y, lr);
    } else {
      model.solveClosedFormRidge(transformedTrainX, currentSplit.train.y, l2);
    }
    evaluateAndRecord();
    updateTelemetryUI();
    renderAllCanvases();
  }
}

function updateDegree() {
  valDegree.textContent = sliderDegree.value;
  resetModel();
}

function evaluateAndRecord() {
  if (!model || !currentSplit) return;
  if (selectModel.value === 'polynomial') {
    const bv = model.evaluateBiasVariance(
      transformedTrainX, currentSplit.train.y, transformedValX, currentSplit.val.y, currentSplit.evaluateHidden
    );
    trainLoss = bv.trainMse; valLoss = bv.valMse; hiddenLoss = bv.hiddenMse;
  } else {
    trainLoss = model.loss(currentSplit.train.X, currentSplit.train.y);
    valLoss = currentSplit.val.X.rows > 0 ? model.loss(currentSplit.val.X, currentSplit.val.y) : trainLoss;
    if (currentSplit.evaluateHidden) {
      const res = currentSplit.evaluateHidden(
        (rawX) => new Matrix(rawX.rows, 1, model.predict(rawX)),
        (yTrue, yPred) => Metrics.mse(yTrue, yPred)
      );
      hiddenLoss = res.score;
    }
  }
  recordLoss(trainLoss, valLoss);
}

function updateOptimizer() {
  const optType = selectOptimizer.value;
  const lr = parseFloat(sliderLr.value);
  optimizer = createOptimizer(optType, { lr });
  if (worker) worker.postMessage({ type: 'SET_OPTIMIZER', optType, optOptions: { lr } });
  logNarratorEvent({ type: 'SWAP_OPTIMIZER', message: `Optimizer swapped to ${optType.toUpperCase()} (lr = ${lr}).` });
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
  if (worker) worker.postMessage({ type: 'START' });
  else runMainThreadLoop();
}

function pauseTraining() {
  isTraining = false;
  btnToggleTrain.textContent = 'START FIT';
  btnToggleTrain.className = 'chamfer-btn';
  if (worker) worker.postMessage({ type: 'PAUSE' });
}

function stepOnce() {
  if (worker) worker.postMessage({ type: 'STEP' });
  else if (model && currentSplit) stepMainThread();
}

function stepMainThread() {
  if (!model || !currentSplit) return;
  stepCount++;
  const lr = parseFloat(sliderLr.value);
  if (model instanceof RegularizedRegression) {
    const res = model.stepISTA(transformedTrainX, currentSplit.train.y, lr);
    trainLoss = res.mse; gradNorm = res.gradNorm;
    valLoss = model.loss(transformedValX, currentSplit.val.y).mse;
  } else if (optimizer) {
    const res = model.fitStep(currentSplit.train.X, currentSplit.train.y, optimizer);
    trainLoss = res.loss; gradNorm = res.gradNorm;
    valLoss = currentSplit.val.X.rows > 0 ? model.loss(currentSplit.val.X, currentSplit.val.y) : trainLoss;
  }
  evaluateAndRecord();
  updateTelemetryUI();
  renderAllCanvases();
}

function runMainThreadLoop() {
  if (!isTraining) return;
  for (let i = 0; i < 4; i++) stepMainThread();
  requestAnimationFrame(runMainThreadLoop);
}

function solveAnalyticalExact() {
  if (!model || !currentSplit) return;
  pauseTraining();

  if (selectModel.value === 'polynomial') {
    const l2 = parseFloat(sliderLambda2.value);
    const res = model.solveClosedFormRidge(transformedTrainX, currentSplit.train.y, l2);
    evaluateAndRecord();
    updateTelemetryUI();
    renderAllCanvases();
    logNarratorEvent({
      type: 'SOLVE_RIDGE',
      message: `Closed-form Ridge solved via Cholesky (MSE = ${res.mse.toFixed(4)}, λ2 = ${l2.toFixed(3)}).`
    });
  } else if (selectModel.value === 'linear') {
    const res = model.solveOLS(currentSplit.train.X, currentSplit.train.y);
    evaluateAndRecord();
    updateTelemetryUI();
    renderAllCanvases();
    logNarratorEvent({
      type: 'SOLVE_OLS',
      message: `Normal equations solved analytically via Cholesky (MSE = ${res.mse.toFixed(4)}, R² = ${res.r2.toFixed(3)}).`
    });
  }
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
  if (event.type === 'PLATEAU' || event.type === 'SPARSITY_SNAP') badgeColor = 'var(--alert-converged)';
  line.innerHTML = `<span class="narrator-badge" style="background: rgba(255,255,255,0.1); color: ${badgeColor};">[${event.type}]</span>${event.message}`;
  narratorFeed.appendChild(line);
  narratorFeed.scrollTop = narratorFeed.scrollHeight;
}

function updateTelemetryUI() {
  if (elStatLoss) elStatLoss.textContent = trainLoss.toFixed(4);
  if (elStatValLoss) elStatValLoss.textContent = valLoss.toFixed(4);
  if (elStatHiddenLoss) elStatHiddenLoss.textContent = hiddenLoss !== null ? hiddenLoss.toFixed(4) : '—';

  const overfitGap = valLoss - trainLoss;
  if (elStatOverfitGap) {
    elStatOverfitGap.textContent = (overfitGap >= 0 ? '+' : '') + overfitGap.toFixed(4);
    elStatOverfitGap.style.color = overfitGap > 0.25 ? 'var(--alert-critical)' : 'var(--alert-converged)';
  }

  if (model && model.getCoefficients) {
    const coeffInfo = model.getCoefficients();
    const D = model.nFeatures;
    if (elStatZeroWeights) elStatZeroWeights.textContent = `${coeffInfo.zeroCount} / ${D}`;
    if (elStatL1Norm) elStatL1Norm.textContent = coeffInfo.l1Norm.toFixed(2);
    if (elStatL2Norm) elStatL2Norm.textContent = coeffInfo.l2Norm.toFixed(2);
    if (elSparsityBadge) elSparsityBadge.textContent = `SPARSITY: ${Math.round(coeffInfo.sparsity * 100)}%`;
  } else {
    if (elStatZeroWeights) elStatZeroWeights.textContent = '—';
    if (elStatL1Norm) elStatL1Norm.textContent = '—';
    if (elStatL2Norm) elStatL2Norm.textContent = '—';
    if (elSparsityBadge) elSparsityBadge.textContent = 'SPARSITY: 0%';
  }
}

function updateHealthUI(health) {
  const pct = Math.round(health.totalHealth * 100);
  if (elTotalHealth) elTotalHealth.textContent = `${pct}%`;
  if (elHealthBar) elHealthBar.style.width = `${pct}%`;
  if (elHealthSummary) elHealthSummary.textContent = health.summary;
}

function renderAllCanvases() {
  drawScatterPlot(scatterCanvas, scatterCtx, currentDataset, model, selectModel.value, olsReference, polyFeatures);
  drawLossCurves(lossCanvas, lossCtx, trainLossHistory, valLossHistory, MAX_LOSS_HISTORY);
  if (coeffCanvas && coeffCtx && model && model.getCoefficients) {
    drawCoefficientBarChart(coeffCanvas, coeffCtx, model.getCoefficients());
  }
}

// Event Listeners
selectDataset.addEventListener('change', generateDataset);
selectModel.addEventListener('change', resetModel);
selectOptimizer.addEventListener('change', updateOptimizer);

sliderNoise.addEventListener('input', generateDataset);
sliderOutliers.addEventListener('input', generateDataset);
sliderSamples.addEventListener('input', generateDataset);
sliderLr.addEventListener('input', updateLearningRate);

if (sliderDegree) sliderDegree.addEventListener('input', updateDegree);
if (sliderLambda2) sliderLambda2.addEventListener('input', updatePenalties);
if (sliderLambda1) sliderLambda1.addEventListener('input', updatePenalties);

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
btnSolveOLS.addEventListener('click', solveAnalyticalExact);

// Boot
initWorker();
generateDataset();

/**
 * @file mlSandbox.js
 * @description Interactive visual sandbox for testing and inspecting the Pure-JS ML Core:
 * Generates datasets live, plots scatter points and MAD outliers on a 2D canvas,
 * and updates Dataset Health Score components (Balance, Cleanliness, Coverage) in real time.
 */

import { Datasets } from '../ml/Datasets.js';
import { DatasetHealth } from '../ml/DatasetHealth.js';

// DOM element references
const selectDataset = document.getElementById('select-dataset');
const sliderNoise = document.getElementById('slider-noise');
const sliderOutliers = document.getElementById('slider-outliers');
const sliderSamples = document.getElementById('slider-samples');
const inputSeed = document.getElementById('input-seed');
const btnRandomSeed = document.getElementById('btn-random-seed');

const valNoise = document.getElementById('val-noise');
const valOutliers = document.getElementById('val-outliers');
const valSamples = document.getElementById('val-samples');

const canvas = document.getElementById('scatter-canvas');
const ctx = canvas.getContext('2d');

// Health UI Elements
const elTotalHealth = document.getElementById('health-total-val');
const elHealthBar = document.getElementById('health-total-bar');
const elBalanceVal = document.getElementById('val-balance');
const elBalanceBar = document.getElementById('bar-balance');
const elCleanlinessVal = document.getElementById('val-cleanliness');
const elCleanlinessBar = document.getElementById('bar-cleanliness');
const elCoverageVal = document.getElementById('val-coverage');
const elCoverageBar = document.getElementById('bar-coverage');
const elSummary = document.getElementById('health-summary');

const elStatMedian = document.getElementById('stat-median');
const elStatMad = document.getElementById('stat-mad');
const elStatOutliers = document.getElementById('stat-outliers');
const elStatSpan = document.getElementById('stat-span');

let currentData = null;

/**
 * Generates dataset according to active control values.
 */
function generateActiveDataset() {
  const dsType = selectDataset.value;
  const noise = parseFloat(sliderNoise.value);
  const outlierRate = parseFloat(sliderOutliers.value);
  const nSamples = parseInt(sliderSamples.value, 10);
  const seed = parseInt(inputSeed.value, 10) || 42;

  valNoise.textContent = noise.toFixed(2);
  valOutliers.textContent = `${Math.round(outlierRate * 100)}%`;
  valSamples.textContent = nSamples;

  switch (dsType) {
    case 'linear':
      currentData = Datasets.linearData({ noise, outlierRate, nSamples, seed, slope: 2.2, intercept: 0.8 });
      break;
    case 'blobs':
      currentData = Datasets.twoClassBlobs({ noise, outlierRate, nSamples, seed });
      break;
    case 'polynomial':
      currentData = Datasets.polynomialData({ noise, outlierRate, nSamples, seed, coeffs: [0.2, -1.1, 0.65, -0.12] });
      break;
    case 'tree':
      currentData = Datasets.treeBoundaryData({ noise, nSamples, seed });
      break;
    case 'moons':
      currentData = Datasets.xorMoonsSpiralData({ type: 'moons', noise, nSamples, seed });
      break;
    case 'spiral':
      currentData = Datasets.xorMoonsSpiralData({ type: 'spiral', noise, nSamples, seed });
      break;
    default:
      currentData = Datasets.linearData({ noise, outlierRate, nSamples, seed });
  }

  evaluateAndRender();
}

/**
 * Computes health score and renders 2D scatter visualization.
 */
function evaluateAndRender() {
  if (!currentData) return;

  const { X, y, domain } = currentData;
  const health = DatasetHealth.evaluate({ X, y, targetDomain: domain || [-5.0, 5.0] });

  // Update UI Telemetry
  updateHealthUI(health);

  // Render 2D Canvas
  renderScatterPlot(currentData, health);
}

/**
 * Updates DOM cards with computed health score components.
 */
function updateHealthUI(health) {
  const pct = Math.round(health.totalHealth * 100);
  elTotalHealth.textContent = `${pct}%`;
  elHealthBar.style.width = `${pct}%`;

  if (health.totalHealth >= 0.80) {
    elTotalHealth.className = 'health-num val-active';
    elHealthBar.style.background = 'var(--alert-converged)';
  } else if (health.totalHealth >= 0.55) {
    elTotalHealth.className = 'health-num val-warning';
    elHealthBar.style.background = 'var(--alert-warning)';
  } else {
    elTotalHealth.className = 'health-num val-crit';
    elHealthBar.style.background = 'var(--alert-critical)';
  }

  // Components
  elBalanceVal.textContent = health.balance.toFixed(3);
  elBalanceBar.style.width = `${Math.round(health.balance * 100)}%`;

  elCleanlinessVal.textContent = health.cleanliness.toFixed(3);
  elCleanlinessBar.style.width = `${Math.round(health.cleanliness * 100)}%`;

  elCoverageVal.textContent = health.coverage.toFixed(3);
  elCoverageBar.style.width = `${Math.round(health.coverage * 100)}%`;

  elSummary.textContent = health.summary;

  // Additional Robust Stats
  elStatMedian.textContent = health.median.toFixed(2);
  elStatMad.textContent = health.mad.toFixed(2);
  elStatOutliers.textContent = `${health.outlierCount} (${((health.outlierCount / currentData.X.rows) * 100).toFixed(1)}%)`;
  elStatSpan.textContent = `${health.observedSpan} / ${health.targetSpan}`;
}

/**
 * Renders data points and highlighted MAD outliers on canvas.
 */
function renderScatterPlot(dataset, health) {
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);

  // Background Grid
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 1;
  const step = 40;
  for (let x = 0; x < width; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Find min and max bounds for coordinate transformation
  const N = dataset.X.rows;
  const is2D = dataset.X.cols >= 2;

  let minX = -5.0, maxX = 5.0;
  let minY = -5.0, maxY = 5.0;

  for (let i = 0; i < N; i++) {
    const xVal = dataset.X.get(i, 0);
    const yVal = is2D ? dataset.X.get(i, 1) : dataset.y.get(i, 0);
    if (xVal < minX) minX = xVal;
    if (xVal > maxX) maxX = xVal;
    if (yVal < minY) minY = yVal;
    if (yVal > maxY) maxY = yVal;
  }

  const padX = (maxX - minX) * 0.12 || 1.0;
  const padY = (maxY - minY) * 0.12 || 1.0;
  minX -= padX; maxX += padX;
  minY -= padY; maxY += padY;

  const toScreenX = (x) => ((x - minX) / (maxX - minX)) * (width - 40) + 20;
  const toScreenY = (y) => height - (((y - minY) / (maxY - minY)) * (height - 40) + 20);

  // Draw Axes
  const zeroX = toScreenX(0);
  const zeroY = toScreenY(0);
  ctx.strokeStyle = 'rgba(0, 245, 155, 0.25)';
  ctx.lineWidth = 1.5;
  if (zeroX >= 0 && zeroX <= width) {
    ctx.beginPath(); ctx.moveTo(zeroX, 0); ctx.lineTo(zeroX, height); ctx.stroke();
  }
  if (zeroY >= 0 && zeroY <= height) {
    ctx.beginPath(); ctx.moveTo(0, zeroY); ctx.lineTo(width, zeroY); ctx.stroke();
  }

  const outlierSet = new Set(health.outlierIndices);

  // Plot Samples
  for (let i = 0; i < N; i++) {
    const xVal = dataset.X.get(i, 0);
    const yVal = is2D ? dataset.X.get(i, 1) : dataset.y.get(i, 0);
    const px = toScreenX(xVal);
    const py = toScreenY(yVal);
    const isOutlier = outlierSet.has(i);

    const label = dataset.y.get(i, 0);

    if (isOutlier) {
      // Outlier Alert Halo & Crosshair
      ctx.strokeStyle = '#FF2A55';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.arc(px, py, 9, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 42, 85, 0.4)';
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Inliers
      ctx.fillStyle = label >= 0.5 ? '#10B981' : '#F59E0B';
      ctx.shadowColor = label >= 0.5 ? 'rgba(16, 185, 129, 0.6)' : 'rgba(245, 158, 11, 0.6)';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(px, py, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }
}

// Event Listeners
selectDataset.addEventListener('change', generateActiveDataset);
sliderNoise.addEventListener('input', generateActiveDataset);
sliderOutliers.addEventListener('input', generateActiveDataset);
sliderSamples.addEventListener('input', generateActiveDataset);
inputSeed.addEventListener('change', generateActiveDataset);

btnRandomSeed.addEventListener('click', () => {
  inputSeed.value = Math.floor(Math.random() * 100000);
  generateActiveDataset();
});

// Initial boot run
generateActiveDataset();

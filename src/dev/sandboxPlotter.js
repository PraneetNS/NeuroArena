/**
 * @file sandboxPlotter.js
 * @description Pure HTML5 Canvas 2D rendering routines for the ML Sandbox:
 * 1. Scatter plot with model line / decision boundary / polynomial spline
 * 2. Real-time convergence loss curves (J_train vs J_val)
 * 3. Live coefficient magnitude bar-chart showing L1 Lasso sparsity
 */

import { Matrix } from '../ml/Matrix.js';

/**
 * Renders 2D scatter plot, data points, and fitted lines / decision boundaries / polynomial curves.
 * @param {HTMLCanvasElement} canvas
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} dataset
 * @param {Object} model
 * @param {string} modelType
 * @param {Object | null} olsReference
 * @param {Object | null} polyFeatures
 */
export function drawScatterPlot(canvas, ctx, dataset, model, modelType, olsReference, polyFeatures = null) {
  if (!dataset) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  // Background Grid
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  }
  for (let y = 0; y < h; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }

  const N = dataset.X.rows;
  const is2D = dataset.X.cols >= 2 && modelType !== 'polynomial';

  let minX = -3.5, maxX = 3.5;
  let minY = -3.5, maxY = 3.5;

  for (let i = 0; i < N; i++) {
    const xVal = dataset.X.get(i, 0);
    const yVal = is2D ? dataset.X.get(i, 1) : dataset.y.get(i, 0);
    if (xVal < minX) minX = xVal;
    if (xVal > maxX) maxX = xVal;
    if (yVal < minY) minY = yVal;
    if (yVal > maxY) maxY = yVal;
  }

  const padX = (maxX - minX) * 0.15 || 1.0;
  const padY = (maxY - minY) * 0.15 || 1.0;
  minX -= padX; maxX += padX;
  minY -= padY; maxY += padY;

  const toX = (x) => ((x - minX) / (maxX - minX)) * (w - 40) + 20;
  const toY = (y) => h - (((y - minY) / (maxY - minY)) * (h - 40) + 20);

  // Draw OLS Reference Line (if standard linear regression)
  if (olsReference && modelType === 'linear') {
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    const olsY1 = olsReference.weights[0] * minX + olsReference.bias;
    const olsY2 = olsReference.weights[0] * maxX + olsReference.bias;
    ctx.moveTo(toX(minX), toY(olsY1));
    ctx.lineTo(toX(maxX), toY(olsY2));
    ctx.stroke();
    ctx.setLineDash([]);
  } else if (olsReference && modelType === 'polynomial' && polyFeatures && olsReference.weights) {
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    const nRefSteps = 100;
    const refStepSize = (maxX - minX) / (nRefSteps - 1);
    const refEvalX = new Matrix(nRefSteps, 1);
    for (let s = 0; s < nRefSteps; s++) refEvalX.set(s, 0, minX + s * refStepSize);
    const refPolyX = polyFeatures.transform(refEvalX);
    for (let s = 0; s < nRefSteps; s++) {
      let sum = olsReference.bias;
      for (let j = 0; j < olsReference.weights.length; j++) {
        sum += refPolyX.get(s, j) * olsReference.weights[j];
      }
      const px = toX(refEvalX.get(s, 0));
      const py = toY(sum);
      if (s === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Draw Live Fitted Model Line / Boundary / Polynomial Curve
  if (model) {
    ctx.strokeStyle = '#00F59B';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = 'rgba(0, 245, 155, 0.7)';
    ctx.shadowBlur = 10;

    if (modelType === 'linear') {
      const predY1 = model.weights[0] * minX + model.bias;
      const predY2 = model.weights[0] * maxX + model.bias;
      ctx.beginPath();
      ctx.moveTo(toX(minX), toY(predY1));
      ctx.lineTo(toX(maxX), toY(predY2));
      ctx.stroke();
    } else if (modelType === 'logistic' && model.nFeatures === 2) {
      const boundary = model.getDecisionBoundary();
      if (boundary.slope !== null) {
        const boundY1 = boundary.slope * minX + boundary.intercept;
        const boundY2 = boundary.slope * maxX + boundary.intercept;
        ctx.beginPath();
        ctx.moveTo(toX(minX), toY(boundY1));
        ctx.lineTo(toX(maxX), toY(boundY2));
        ctx.stroke();
      }
    } else if (modelType === 'polynomial' && polyFeatures) {
      // Evaluate high-resolution polynomial curve across 150 points
      const nSteps = 150;
      const stepSize = (maxX - minX) / (nSteps - 1);
      const evalX = new Matrix(nSteps, 1);
      for (let s = 0; s < nSteps; s++) {
        evalX.set(s, 0, minX + s * stepSize);
      }

      const evalPolyX = polyFeatures.transform(evalX);
      const evalPreds = model.predict(evalPolyX);

      ctx.beginPath();
      for (let s = 0; s < nSteps; s++) {
        const px = toX(evalX.get(s, 0));
        const py = toY(evalPreds[s]);
        if (s === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
  }

  // Draw Data Samples
  for (let i = 0; i < N; i++) {
    const xVal = dataset.X.get(i, 0);
    const yVal = is2D ? dataset.X.get(i, 1) : dataset.y.get(i, 0);
    const label = dataset.y.get(i, 0);
    const isOutlier = dataset.isOutlier && dataset.isOutlier[i];

    const px = toX(xVal);
    const py = toY(yVal);

    if (isOutlier) {
      ctx.strokeStyle = '#FF2A55';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(px, py, 8, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = label >= 0.5 ? '#10B981' : '#F59E0B';
    ctx.beginPath();
    ctx.arc(px, py, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Renders real-time convergence loss curves (J_train vs J_val).
 * @param {HTMLCanvasElement} canvas
 * @param {CanvasRenderingContext2D} ctx
 * @param {number[]} trainHistory
 * @param {number[]} valHistory
 * @param {number} maxHistory
 */
export function drawLossCurves(canvas, ctx, trainHistory, valHistory, maxHistory = 120) {
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  if (trainHistory.length < 2) return;

  let maxLoss = 1.0;
  for (const l of trainHistory) if (l > maxLoss && l < 50) maxLoss = l;
  for (const l of valHistory) if (l > maxLoss && l < 50) maxLoss = l;
  maxLoss *= 1.15;

  const count = trainHistory.length;
  const toX = (idx) => (idx / (maxHistory - 1)) * (w - 40) + 30;
  const toY = (val) => h - 15 - (Math.min(val, maxLoss) / maxLoss) * (h - 30);

  // Axes and labels
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(30, 10);
  ctx.lineTo(30, h - 15);
  ctx.lineTo(w - 10, h - 15);
  ctx.stroke();

  ctx.fillStyle = '#64748B';
  ctx.font = '10px JetBrains Mono';
  ctx.fillText(`max: ${maxLoss.toFixed(2)}`, 35, 20);
  ctx.fillText('0', 16, h - 14);

  // Train Loss Curve
  ctx.strokeStyle = '#00F59B';
  ctx.lineWidth = 2.0;
  ctx.beginPath();
  for (let i = 0; i < count; i++) {
    const x = toX(i);
    const y = toY(trainHistory[i]);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Val Loss Curve
  ctx.strokeStyle = '#38BDF8';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i < count; i++) {
    const x = toX(i);
    const y = toY(valHistory[i]);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

/**
 * Renders coefficient magnitude bar chart showing L1 Lasso sparsity and L2 Ridge damping.
 * @param {HTMLCanvasElement} canvas
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} coeffStats - Result from RegularizedRegression.getCoefficients()
 */
export function drawCoefficientBarChart(canvas, ctx, coeffStats) {
  if (!canvas || !ctx || !coeffStats) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const mags = coeffStats.magnitudes;
  const D = mags.length;
  if (D === 0) return;

  let maxMag = 0.5;
  for (let j = 0; j < D; j++) {
    if (mags[j] > maxMag) maxMag = mags[j];
  }
  maxMag *= 1.2;

  // Background Grid Lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(25, h - 16);
  ctx.lineTo(w - 10, h - 16);
  ctx.stroke();

  const chartWidth = w - 35;
  const barGap = 4;
  const barWidth = Math.max(4, Math.floor((chartWidth - (D - 1) * barGap) / D));

  ctx.font = '9px JetBrains Mono';

  for (let j = 0; j < D; j++) {
    const mag = mags[j];
    const isZero = mag === 0.0;
    const barHeight = Math.max(2, (mag / maxMag) * (h - 28));

    const x = 25 + j * (barWidth + barGap);
    const y = h - 16 - barHeight;

    if (isZero) {
      // Dimmed grey outline with red indicator
      ctx.fillStyle = 'rgba(255, 42, 85, 0.2)';
      ctx.fillRect(x, h - 19, barWidth, 3);
      ctx.strokeStyle = '#FF2A55';
      ctx.strokeRect(x, h - 19, barWidth, 3);
    } else {
      // Glowing cyan/gold active weight bar
      const gradient = ctx.createLinearGradient(0, y, 0, h - 16);
      gradient.addColorStop(0, '#00F59B');
      gradient.addColorStop(1, '#06B6D4');
      ctx.fillStyle = gradient;
      ctx.fillRect(x, y, barWidth, barHeight);
    }

    // Power index label
    ctx.fillStyle = isZero ? '#64748B' : '#94A3B8';
    ctx.fillText(`${j + 1}`, x + 1, h - 4);
  }
}

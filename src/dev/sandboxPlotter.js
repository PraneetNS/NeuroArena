/**
 * @file sandboxPlotter.js
 * @description Pure HTML5 Canvas 2D rendering routines for the ML Sandbox:
 * 1. Scatter plot with model line / decision boundary and OLS reference
 * 2. Real-time convergence loss curves (J_train vs J_val)
 */

/**
 * Renders 2D scatter plot, data points, and fitted lines / decision boundaries.
 * @param {HTMLCanvasElement} canvas
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} dataset
 * @param {Object} model
 * @param {string} modelType
 * @param {Object | null} olsReference
 */
export function drawScatterPlot(canvas, ctx, dataset, model, modelType, olsReference) {
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
  const is2D = dataset.X.cols >= 2;

  let minX = -4.0, maxX = 4.0;
  let minY = -4.0, maxY = 4.0;

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

  // Draw OLS Reference Line (if linear regression)
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
  }

  // Draw Live Fitted Model Line / Boundary
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

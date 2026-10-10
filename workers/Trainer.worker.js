/**
 * @file Trainer.worker.js
 * @description Dedicated Web Worker for background training of Linear and Logistic models.
 * Runs minibatch or full-batch gradient descent steps, transfers parameters/gradients
 * via transferable ArrayBuffers every K steps, supports live optimizer/learning-rate swapping,
 * and emits structured mathematical narrator events.
 */

import { Matrix } from '../src/ml/Matrix.js';
import { LinearRegression } from '../src/ml/linear.js';
import { LogisticRegression } from '../src/ml/logistic.js';
import { RegularizedRegression } from '../src/ml/regularization.js';
import { DecisionTree } from '../src/ml/tree.js';
import { RandomForest } from '../src/ml/forest.js';
import { MLP } from '../src/ml/mlp.js';
import { createOptimizer } from '../src/ml/optimizers.js';

let model = null;
let optimizer = null;
let trainX = null;
let trainY = null;
let valX = null;
let valY = null;

let isRunning = false;
let step = 0;
let reportInterval = 5;
let batchSize = 0; // 0 = full-batch

// Telemetry history for structured narrator hook event detection
let prevGradVec = null;
let prevWeights = null;
let prevTrainLoss = 0.0;
let plateauCounter = 0;
let lastSlopeRotationStep = 0;
let lastOverfitStep = 0;

/**
 * Checks for salient mathematical training events.
 * @param {number} trainLoss
 * @param {number} valLoss
 * @param {Float64Array} grads
 * @param {number} gradNorm
 * @returns {Object | null} Structured event or null
 */
function checkNarratorEvents(trainLoss, valLoss, grads, gradNorm) {
  // 1. Divergence / NaN Guard
  if (isNaN(trainLoss) || trainLoss > 50.0) {
    return {
      type: 'DIVERGENCE_NAN',
      trainLoss,
      valLoss,
      message: `Gradient explosion or NaN detected (J = ${trainLoss.toFixed(2)}): learning rate is too aggressive.`
    };
  }

  // 2. Sign Reversal (Oscillation across steep canyon walls)
  if (prevGradVec && grads.length === prevGradVec.length) {
    let dot = 0.0;
    for (let i = 0; i < grads.length; i++) {
      dot += grads[i] * prevGradVec[i];
    }
    if (dot < -0.05 && gradNorm > 0.08) {
      return {
        type: 'SIGN_REVERSAL',
        dotProduct: dot,
        gradNorm,
        message: `Gradient reversed sign (dot = ${dot.toFixed(3)}): optimizer is bouncing across steep canyon walls.`
      };
    }
  }

  // 3. Slope / Weight Rotation (Substantial parameter movement)
  if (prevWeights && step - lastSlopeRotationStep > 10) {
    let deltaSq = 0.0;
    for (let i = 0; i < model.weights.length; i++) {
      const d = model.weights[i] - prevWeights[i];
      deltaSq += d * d;
    }
    const deltaW = Math.sqrt(deltaSq);
    if (deltaW > 0.35) {
      lastSlopeRotationStep = step;
      return {
        type: 'SLOPE_ROTATION',
        deltaW,
        message: `The decision boundary is rotating rapidly (Δw = ${deltaW.toFixed(3)}) to reduce initial residual errors.`
      };
    }
  }

  // 4. Plateau (Vanishing gradients near local or global minimum)
  if (gradNorm < 0.005 || Math.abs(trainLoss - prevTrainLoss) < 1e-5) {
    plateauCounter++;
    if (plateauCounter === 12) {
      return {
        type: 'PLATEAU',
        gradNorm,
        trainLoss,
        message: `Optimization plateau reached (||∇J|| = ${gradNorm.toFixed(5)}): loss has flattened near convergence.`
      };
    }
  } else {
    plateauCounter = 0;
  }

  // 5. Overfitting Gap (Validation loss rising while training loss dropping)
  if (valX && valX.rows > 0 && step - lastOverfitStep > 15) {
    const gap = valLoss - trainLoss;
    if (gap > 0.35 && trainLoss < prevTrainLoss) {
      lastOverfitStep = step;
      return {
        type: 'OVERFIT_GAP',
        trainLoss,
        valLoss,
        gap,
        message: `Overfitting detected: training error is low (${trainLoss.toFixed(3)}) but validation error rose (${valLoss.toFixed(3)}, gap = +${gap.toFixed(3)}). Model is memorizing noise.`
      };
    }
  }

  // 6. L1 Sparsity Milestone (coefficients snapping to exact zero)
  if (model && model.getCoefficients) {
    const c = model.getCoefficients();
    if (c.zeroCount > 0 && (!self._lastAnnouncedZero || self._lastAnnouncedZero !== c.zeroCount)) {
      self._lastAnnouncedZero = c.zeroCount;
      return {
        type: 'SPARSITY_SNAP',
        zeroCount: c.zeroCount,
        sparsity: c.sparsity,
        message: `Lasso ISTA collapsed ${c.zeroCount}/${c.magnitudes.length} coefficients to exactly 0 (sparsity = ${(c.sparsity * 100).toFixed(0)}%).`
      };
    }
  }

  return null;
}

/**
 * Runs a single training step.
 */
function trainStep() {
  if (!model || !optimizer || !trainX) return;

  step++;

  // Minibatch or full-batch selection
  let stepX = trainX;
  let stepY = trainY;

  if (batchSize > 0 && batchSize < trainX.rows) {
    const startIdx = ((step - 1) * batchSize) % (trainX.rows - batchSize + 1);
    stepX = new Matrix(batchSize, trainX.cols);
    stepY = new Matrix(batchSize, trainY.cols);
    for (let r = 0; r < batchSize; r++) {
      for (let c = 0; c < trainX.cols; c++) {
        stepX.set(r, c, trainX.get(startIdx + r, c));
      }
      stepY.set(r, 0, trainY.get(startIdx + r, 0));
    }
  }

  // Regularized Regression (ISTA Proximal Step)
  if (model instanceof RegularizedRegression) {
    const lr = optimizer ? optimizer.lr : 0.02;
    const stepRes = model.stepISTA(stepX, stepY, lr);
    const trainLoss = stepRes.mse;
    const valLoss = (valX && valX.rows > 0) ? model.loss(valX, valY).mse : trainLoss;
    const gradNorm = stepRes.gradNorm;

    const event = checkNarratorEvents(trainLoss, valLoss, model._grads, gradNorm);
    prevTrainLoss = trainLoss;

    if (step % reportInterval === 0 || event !== null || !isRunning) {
      const coeffInfo = model.getCoefficients();
      self.postMessage({
        type: 'PROGRESS',
        step,
        trainLoss,
        valLoss,
        gradNorm,
        weights: Array.from(model.weights),
        bias: model.bias,
        event,
        coeffInfo
      });
    }
    return;
  }

  // Multi-Layer Perceptron (Backprop Step)
  if (model instanceof MLP) {
    const stepRes = model.trainStep(stepX, stepY);
    const trainLoss = stepRes.loss;
    const valLoss = (valX && valX.rows > 0) ? (model.forward(valX) ? trainLoss : trainLoss) : trainLoss;
    prevTrainLoss = trainLoss;

    if (step % reportInterval === 0 || !isRunning) {
      self.postMessage({
        type: 'PROGRESS',
        step,
        trainLoss,
        valLoss,
        gradNorm: 0.0
      });
    }
    return;
  }

  // Decision Tree and Random Forest (Direct Fit)
  if (model instanceof DecisionTree || model instanceof RandomForest) {
    model.fit(stepX, stepY);
    const trainScore = model.score(stepX, stepY).score;
    const valScore = (valX && valX.rows > 0) ? model.score(valX, valY).score : trainScore;
    isRunning = false;
    self.postMessage({
      type: 'COMPLETE',
      step: 1,
      trainScore,
      valScore,
      featureImportances: Array.from(model.featureImportances || [])
    });
    return;
  }

  // Compute gradients and step optimizer
  const { gradNorm, gradWeights } = model.computeGradients(stepX, stepY);
  optimizer.step(model.params, model.grads);
  model.syncFromParams();

  // Evaluate losses
  const trainLoss = model.loss(trainX, trainY);
  const valLoss = (valX && valX.rows > 0) ? model.loss(valX, valY) : trainLoss;

  // Check structured narrator events
  const event = checkNarratorEvents(trainLoss, valLoss, model.grads, gradNorm);

  // Store telemetry history
  if (!prevGradVec || prevGradVec.length !== model.grads.length) {
    prevGradVec = new Float64Array(model.grads.length);
    prevWeights = new Float64Array(model.weights.length);
  }
  prevGradVec.set(model.grads);
  prevWeights.set(model.weights);
  prevTrainLoss = trainLoss;

  // Report progress every K steps
  if (step % reportInterval === 0 || event !== null || !isRunning) {
    const paramsCopy = new Float64Array(model.params);
    const gradsCopy = new Float64Array(model.grads);

    self.postMessage({
      type: 'PROGRESS',
      step,
      trainLoss,
      valLoss,
      gradNorm,
      weights: Array.from(model.weights),
      bias: model.bias,
      event,
      coeffInfo: model.getCoefficients ? model.getCoefficients() : null,
      paramsBuffer: paramsCopy.buffer,
      gradsBuffer: gradsCopy.buffer
    }, [paramsCopy.buffer, gradsCopy.buffer]);
  }
}

/**
 * Recursive animation loop for continuous worker training.
 */
function loop() {
  if (!isRunning) return;

  // Run up to 4 fast micro-steps per tick to keep CPU efficient
  for (let i = 0; i < 4; i++) {
    trainStep();
    if (!isRunning) break;
  }

  setTimeout(loop, 16); // ~60 Hz worker tick rate
}

// =========================================================================
// Message Protocol
// =========================================================================
self.onmessage = function (e) {
  const msg = e.data;
  if (!msg || !msg.type) return;

  switch (msg.type) {
    case 'INIT': {
      const {
        modelType = 'linear',
        nFeatures = 1,
        trainDataX,
        trainDataY,
        valDataX,
        valDataY,
        optType = 'sgd',
        optOptions = {},
        batch = 0,
        interval = 5,
        lambda1 = 0.0,
        lambda2 = 0.0
      } = msg;

      if (modelType === 'mlp') {
        const hidden = msg.hiddenDims || [16, 8];
        const outDim = msg.outputDim || 1;
        model = new MLP([nFeatures, ...hidden, outDim], {
          hiddenActivation: msg.hiddenActivation || 'relu',
          outputActivation: msg.outputActivation || (outDim > 1 ? 'softmax' : 'linear'),
          lr: optOptions.lr || 0.01
        });
      } else if (modelType === 'tree') {
        model = new DecisionTree({
          task: msg.task || 'classification',
          maxDepth: msg.maxDepth || 6
        });
      } else if (modelType === 'forest') {
        model = new RandomForest({
          task: msg.task || 'classification',
          nEstimators: msg.nEstimators || 10,
          maxDepth: msg.maxDepth || 6
        });
      } else if (modelType === 'polynomial') {
        model = new RegularizedRegression(nFeatures, { lambda1, lambda2 });
      } else if (modelType === 'logistic') {
        model = new LogisticRegression(nFeatures);
      } else {
        model = new LinearRegression(nFeatures);
      }
      optimizer = createOptimizer(optType, optOptions);

      trainX = new Matrix(trainDataX.rows, trainDataX.cols, trainDataX.data);
      trainY = new Matrix(trainDataY.rows, trainDataY.cols, trainDataY.data);

      if (valDataX && valDataY) {
        valX = new Matrix(valDataX.rows, valDataX.cols, valDataX.data);
        valY = new Matrix(valDataY.rows, valDataY.cols, valDataY.data);
      } else {
        valX = null;
        valY = null;
      }

      batchSize = batch;
      reportInterval = interval;
      step = 0;
      plateauCounter = 0;
      prevGradVec = null;
      prevWeights = null;

      self.postMessage({ type: 'INIT_DONE', modelType, nFeatures });
      break;
    }

    case 'START': {
      if (!isRunning) {
        isRunning = true;
        loop();
      }
      break;
    }

    case 'PAUSE': {
      isRunning = false;
      self.postMessage({ type: 'PAUSED', step });
      break;
    }

    case 'RESUME': {
      if (!isRunning) {
        isRunning = true;
        loop();
      }
      break;
    }

    case 'STEP': {
      trainStep();
      break;
    }

    case 'RESET': {
      isRunning = false;
      step = 0;
      if (model) model.reset();
      if (optimizer) optimizer.reset();
      plateauCounter = 0;
      prevGradVec = null;
      prevWeights = null;
      self.postMessage({ type: 'RESET_DONE' });
      break;
    }

    case 'SET_OPTIMIZER': {
      const { optType, optOptions = {} } = msg;
      // Preserve current parameters when swapping optimizer
      optimizer = createOptimizer(optType, optOptions);
      self.postMessage({ type: 'OPTIMIZER_UPDATED', optimizer: optType });
      break;
    }

    case 'SET_LEARNING_RATE': {
      const { lr } = msg;
      if (optimizer) {
        optimizer.setLr(lr);
      }
      self.postMessage({ type: 'LR_UPDATED', lr });
      break;
    }

    case 'SET_PENALTIES': {
      const { lambda1 = 0.0, lambda2 = 0.0 } = msg;
      if (model && model.setPenalties) {
        model.setPenalties(lambda1, lambda2);
      }
      self.postMessage({ type: 'PENALTIES_UPDATED', lambda1, lambda2 });
      break;
    }
  }
};

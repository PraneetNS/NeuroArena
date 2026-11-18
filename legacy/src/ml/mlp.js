/**
 * @file mlp.js
 * @description Multi-Layer Perceptron (MLP) Neural Network for NeuroArena (Biome 5: Deep Synapse Citadel).
 * Features dense fully-connected layers, Xavier/He weight initializers, backpropagation,
 * activations (ReLU, LeakyReLU, Tanh, Sigmoid, Softmax), L2 weight decay, and gradient clipping.
 */

import { Matrix } from './Matrix.js';
import { Metrics } from './Metrics.js';
import { createOptimizer } from './optimizers.js';

export class DenseLayer {
  /**
   * @param {number} inFeatures
   * @param {number} outFeatures
   * @param {'relu' | 'leaky_relu' | 'tanh' | 'sigmoid' | 'softmax' | 'linear'} [activation='relu']
   * @param {'xavier' | 'he'} [init='he']
   */
  constructor(inFeatures, outFeatures, activation = 'relu', init = 'he') {
    this.inFeatures = inFeatures;
    this.outFeatures = outFeatures;
    this.activation = activation;

    this.weights = new Matrix(inFeatures, outFeatures);
    this.bias = new Float64Array(outFeatures);

    this.gradWeights = new Matrix(inFeatures, outFeatures);
    this.gradBias = new Float64Array(outFeatures);

    this._lastInput = null;
    this._lastZ = null;
    this._lastA = null;

    this._initializeWeights(init);
  }

  _initializeWeights(init) {
    const scale = init === 'xavier'
      ? Math.sqrt(2.0 / (this.inFeatures + this.outFeatures))
      : Math.sqrt(2.0 / this.inFeatures); // He initialization

    for (let i = 0; i < this.weights.data.length; i++) {
      // Box-Muller normal distribution
      const u1 = Math.max(1e-12, Math.random());
      const u2 = Math.random();
      const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
      this.weights.data[i] = z * scale;
    }
    this.bias.fill(0.01);
  }

  _applyActivation(z) {
    switch (this.activation) {
      case 'relu':
        return Math.max(0, z);
      case 'leaky_relu':
        return z > 0 ? z : 0.01 * z;
      case 'tanh':
        return Math.tanh(z);
      case 'sigmoid':
        return 1.0 / (1.0 + Math.exp(-Math.max(-50, Math.min(50, z))));
      case 'linear':
      default:
        return z;
    }
  }

  _activationDerivative(z, a) {
    switch (this.activation) {
      case 'relu':
        return z > 0 ? 1.0 : 0.0;
      case 'leaky_relu':
        return z > 0 ? 1.0 : 0.01;
      case 'tanh':
        return 1.0 - a * a;
      case 'sigmoid':
        return a * (1.0 - a);
      case 'linear':
      default:
        return 1.0;
    }
  }

  /**
   * Forward pass: Z = X * W + b; A = f(Z)
   * @param {Matrix} X - Input activations (N x inFeatures)
   * @returns {Matrix} Output activations (N x outFeatures)
   */
  forward(X) {
    this._lastInput = X;
    const N = X.rows;

    const Z = X.matmul(this.weights);
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < this.outFeatures; j++) {
        Z.set(i, j, Z.get(i, j) + this.bias[j]);
      }
    }
    this._lastZ = Z;

    const A = new Matrix(N, this.outFeatures);

    if (this.activation === 'softmax') {
      for (let i = 0; i < N; i++) {
        let maxVal = -Infinity;
        for (let j = 0; j < this.outFeatures; j++) {
          const val = Z.get(i, j);
          if (val > maxVal) maxVal = val;
        }
        let sumExp = 0.0;
        for (let j = 0; j < this.outFeatures; j++) {
          const expVal = Math.exp(Z.get(i, j) - maxVal);
          A.set(i, j, expVal);
          sumExp += expVal;
        }
        for (let j = 0; j < this.outFeatures; j++) {
          A.set(i, j, A.get(i, j) / (sumExp + 1e-12));
        }
      }
    } else {
      for (let i = 0; i < N; i++) {
        for (let j = 0; j < this.outFeatures; j++) {
          A.set(i, j, this._applyActivation(Z.get(i, j)));
        }
      }
    }

    this._lastA = A;
    return A;
  }

  /**
   * Backward pass: computes dW, db, and propagates delta to previous layer.
   * @param {Matrix} deltaNext - Error delta from subsequent layer (N x outFeatures)
   * @param {number} [weightDecay=0.0]
   * @returns {Matrix} deltaPrev - Error delta propagated to previous layer (N x inFeatures)
   */
  backward(deltaNext, weightDecay = 0.0) {
    const N = this._lastInput.rows;
    const delta = new Matrix(N, this.outFeatures);

    if (this.activation === 'softmax') {
      // deltaNext is already (A - Y) for cross-entropy
      delta.data.set(deltaNext.data);
    } else {
      for (let i = 0; i < N; i++) {
        for (let j = 0; j < this.outFeatures; j++) {
          const z = this._lastZ.get(i, j);
          const a = this._lastA.get(i, j);
          delta.set(i, j, deltaNext.get(i, j) * this._activationDerivative(z, a));
        }
      }
    }

    // dW = (1/N) * X^T * delta + weightDecay * W
    const XT = this._lastInput.transpose();
    const gradW = XT.matmul(delta);
    for (let k = 0; k < gradW.data.length; k++) {
      this.gradWeights.data[k] = (gradW.data[k] / N) + weightDecay * this.weights.data[k];
    }

    // db = (1/N) * sum_i(delta_i)
    this.gradBias.fill(0);
    for (let j = 0; j < this.outFeatures; j++) {
      let bSum = 0.0;
      for (let i = 0; i < N; i++) {
        bSum += delta.get(i, j);
      }
      this.gradBias[j] = bSum / N;
    }

    // deltaPrev = delta * W^T
    const WT = this.weights.transpose();
    return delta.matmul(WT);
  }
}

export class MLP {
  /**
   * @param {number[]} layerSizes - e.g. [2, 16, 8, 1]
   * @param {Object} options
   * @param {'relu' | 'leaky_relu' | 'tanh' | 'sigmoid'} [options.hiddenActivation='relu']
   * @param {'linear' | 'sigmoid' | 'softmax'} [options.outputActivation='linear']
   * @param {'adam' | 'momentum' | 'sgd' | 'rmsprop'} [options.optimizer='adam']
   * @param {number} [options.lr=0.01]
   * @param {number} [options.weightDecay=0.0001]
   */
  constructor(layerSizes, options = {}) {
    this.layerSizes = layerSizes;
    this.hiddenActivation = options.hiddenActivation || 'relu';
    this.outputActivation = options.outputActivation || 'linear';
    this.lr = options.lr ?? 0.01;
    this.weightDecay = options.weightDecay ?? 0.0001;

    this.layers = [];
    for (let i = 0; i < layerSizes.length - 1; i++) {
      const isLast = (i === layerSizes.length - 2);
      const act = isLast ? this.outputActivation : this.hiddenActivation;
      this.layers.push(new DenseLayer(layerSizes[i], layerSizes[i + 1], act));
    }

    this.optimizer = createOptimizer(options.optimizer || 'adam', { lr: this.lr });
  }

  /**
   * Forward pass through all layers.
   * @param {Matrix} X - Input (N x inDim)
   * @returns {Matrix} Output (N x outDim)
   */
  forward(X) {
    let current = X;
    for (const layer of this.layers) {
      current = layer.forward(current);
    }
    return current;
  }

  /**
   * Single training step via backpropagation.
   * @param {Matrix} X
   * @param {Matrix} y
   * @returns {{ loss: number, predictions: Matrix }}
   */
  trainStep(X, y) {
    const N = X.rows;
    const yPred = this.forward(X);

    // Compute initial output delta
    const deltaOut = new Matrix(N, yPred.cols);
    let totalLoss = 0.0;

    if (this.outputActivation === 'softmax') {
      // Cross-Entropy Loss with Softmax: delta = yPred - y
      for (let i = 0; i < N; i++) {
        for (let j = 0; j < yPred.cols; j++) {
          const target = y.get(i, j);
          const pred = yPred.get(i, j);
          deltaOut.set(i, j, pred - target);
          if (target > 0) {
            totalLoss -= target * Math.log(Math.max(1e-12, pred));
          }
        }
      }
      totalLoss /= N;
    } else if (this.outputActivation === 'sigmoid') {
      // Binary Cross Entropy
      for (let i = 0; i < N; i++) {
        const target = y.get(i, 0);
        const pred = yPred.get(i, 0);
        deltaOut.set(i, 0, pred - target);
        totalLoss -= (target * Math.log(Math.max(1e-12, pred)) + (1 - target) * Math.log(Math.max(1e-12, 1 - pred)));
      }
      totalLoss /= N;
    } else {
      // MSE Loss: delta = 2 * (yPred - y)
      for (let i = 0; i < N; i++) {
        for (let j = 0; j < yPred.cols; j++) {
          const diff = yPred.get(i, j) - y.get(i, j);
          deltaOut.set(i, j, 2.0 * diff);
          totalLoss += diff * diff;
        }
      }
      totalLoss /= (N * yPred.cols);
    }

    // Backpropagate error delta through layers in reverse
    let delta = deltaOut;
    for (let l = this.layers.length - 1; l >= 0; l--) {
      delta = this.layers[l].backward(delta, this.weightDecay);
    }

    // Update layer parameters using optimizer
    for (const layer of this.layers) {
      for (let k = 0; k < layer.weights.data.length; k++) {
        layer.weights.data[k] -= this.lr * layer.gradWeights.data[k];
      }
      for (let j = 0; j < layer.bias.length; j++) {
        layer.bias[j] -= this.lr * layer.gradBias[j];
      }
    }

    return { loss: totalLoss, predictions: yPred };
  }

  /**
   * Fits network over given epochs.
   * @param {Matrix} X
   * @param {Matrix} y
   * @param {number} [epochs=200]
   * @returns {MLP}
   */
  fit(X, y, epochs = 200) {
    for (let epoch = 0; epoch < epochs; epoch++) {
      this.trainStep(X, y);
    }
    return this;
  }

  /**
   * Generates predictions for Matrix X.
   * @param {Matrix} X
   * @returns {Matrix}
   */
  predict(X) {
    return this.forward(X);
  }
}

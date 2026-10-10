/**
 * @file mlp.test.js
 * @description Comprehensive unit and integration test suite for Multi-Layer Perceptron (Biome 5: Deep Synapse Citadel).
 */

import assert from 'assert';
import { Matrix } from '../../src/ml/Matrix.js';
import { MLP, DenseLayer } from '../../src/ml/mlp.js';

console.log('▶ Testing DenseLayer Activations & Dimensions...');

const layer = new DenseLayer(2, 4, 'relu');
const inputX = new Matrix(3, 2, Float64Array.from([1, 2, -1, 0, 3, -4]));
const outputA = layer.forward(inputX);

assert.strictEqual(outputA.rows, 3);
assert.strictEqual(outputA.cols, 4);
for (let i = 0; i < outputA.data.length; i++) {
  assert(outputA.data[i] >= 0, 'ReLU output activations must be non-negative');
}
console.log('✅ DenseLayer Forward Activation Test Passed!');

console.log('▶ Testing MLP Non-Linear XOR Boundary Convergence...');

// Non-linear XOR Problem (unsolvable by standard linear hyperplanes)
const xorX = new Matrix(4, 2, Float64Array.from([
  0, 0,
  0, 1,
  1, 0,
  1, 1
]));
const xorY = new Matrix(4, 1, Float64Array.from([0, 1, 1, 0]));

const mlpXor = new MLP([2, 8, 1], {
  hiddenActivation: 'tanh',
  outputActivation: 'sigmoid',
  lr: 0.25,
  weightDecay: 0.00001
});

// Train on XOR
let initialLoss = mlpXor.trainStep(xorX, xorY).loss;
let finalLoss = initialLoss;

for (let ep = 0; ep < 600; ep++) {
  const stepRes = mlpXor.trainStep(xorX, xorY);
  finalLoss = stepRes.loss;
}

const xorPreds = mlpXor.predict(xorX);
console.log('XOR Final Predictions:', Array.from(xorPreds.data).map(v => v.toFixed(3)));

assert(finalLoss < initialLoss, 'Training loss must decrease');
assert(xorPreds.get(0, 0) < 0.35, 'XOR [0,0] must predict close to 0');
assert(xorPreds.get(1, 0) > 0.65, 'XOR [0,1] must predict close to 1');
assert(xorPreds.get(2, 0) > 0.65, 'XOR [1,0] must predict close to 1');
assert(xorPreds.get(3, 0) < 0.35, 'XOR [1,1] must predict close to 0');

console.log(`✅ MLP Non-Linear XOR Convergence Test Passed! Final Loss: ${finalLoss.toFixed(4)}`);

console.log('▶ Testing Softmax Multi-Class Classification...');
const mlpMulti = new MLP([2, 6, 3], {
  hiddenActivation: 'relu',
  outputActivation: 'softmax',
  lr: 0.1
});

const multiX = new Matrix(3, 2, Float64Array.from([1, 1, -1, -1, 0, 2]));
const multiY = new Matrix(3, 3, Float64Array.from([
  1, 0, 0,
  0, 1, 0,
  0, 0, 1
]));

mlpMulti.fit(multiX, multiY, 150);
const multiPreds = mlpMulti.predict(multiX);

for (let i = 0; i < 3; i++) {
  let rowSum = 0;
  for (let c = 0; c < 3; c++) rowSum += multiPreds.get(i, c);
  assert(Math.abs(rowSum - 1.0) < 1e-4, 'Softmax probabilities must sum to 1.0');
}
console.log('✅ Softmax Multi-Class Probability Normalization Test Passed!');
console.log('🎉 All MLP Neural Network Tests Passed Cleanly!');

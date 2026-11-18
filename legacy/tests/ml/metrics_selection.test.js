/**
 * @file metrics_selection.test.js
 * @description Test suite for Model Selection (K-Fold, GridSearchCV) and Advanced Classification Metrics (ROC-AUC, Confusion Matrix).
 */

import assert from 'assert';
import { Matrix } from '../../src/ml/Matrix.js';
import { DecisionTree } from '../../src/ml/tree.js';
import { KFold, StratifiedKFold, GridSearchCV } from '../../src/ml/modelSelection.js';
import { AdvancedMetrics } from '../../src/ml/advancedMetrics.js';

console.log('▶ Testing KFold Index Partitioning...');
const kf = new KFold({ nSplits: 4, shuffle: false });
const splits = kf.split(20);

assert.strictEqual(splits.length, 4);
for (const { trainIndices, valIndices } of splits) {
  assert.strictEqual(trainIndices.length, 15);
  assert.strictEqual(valIndices.length, 5);
}
console.log('✅ KFold Partitioning Test Passed!');

console.log('▶ Testing StratifiedKFold Class Balance...');
const yClass = [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1]; // 6 zeros, 6 ones
const skf = new StratifiedKFold({ nSplits: 3 });
const sSplits = skf.split(yClass);

assert.strictEqual(sSplits.length, 3);
for (const { valIndices } of sSplits) {
  assert.strictEqual(valIndices.length, 4);
  const zeros = valIndices.filter(idx => yClass[idx] === 0).length;
  const ones = valIndices.filter(idx => yClass[idx] === 1).length;
  assert.strictEqual(zeros, 2, 'Each fold must contain exactly 2 zeros');
  assert.strictEqual(ones, 2, 'Each fold must contain exactly 2 ones');
}
console.log('✅ StratifiedKFold Class Balance Test Passed!');

console.log('▶ Testing GridSearchCV Hyperparameter Optimization...');
const X_grid = new Matrix(10, 2, Float64Array.from([
  -2, -2, -1.8, -1.9, -2.1, -1.7, -1.5, -2.0, -1.9, -1.8,
   2,  2,  1.8,  1.9,  2.1,  1.7,  1.5,  2.0,  1.9,  1.8
]));
const y_grid = new Matrix(10, 1, Float64Array.from([0, 0, 0, 0, 0, 1, 1, 1, 1, 1]));

const grid = new GridSearchCV(
  (params) => new DecisionTree({ task: 'classification', ...params }),
  { maxDepth: [1, 2, 4], criterion: ['gini'] },
  { cv: 2 }
);

grid.fit(X_grid, y_grid);
console.log(`GridSearchCV Best Params:`, grid.bestParams, `Best Score:`, grid.bestScore);
assert(grid.bestScore >= 0.8, 'GridSearchCV best score must be >= 0.8');
console.log('✅ GridSearchCV Optimization Test Passed!');

console.log('▶ Testing Confusion Matrix & Classification Report...');
const yTrue = [0, 0, 1, 1, 1, 0, 1, 0];
const yPred = [0, 0, 1, 1, 0, 0, 1, 1];

const cm = AdvancedMetrics.confusionMatrix(yTrue, yPred, 2);
assert.strictEqual(cm.get(0, 0), 3, 'True Negatives = 3');
assert.strictEqual(cm.get(0, 1), 1, 'False Positives = 1');
assert.strictEqual(cm.get(1, 0), 1, 'False Negatives = 1');
assert.strictEqual(cm.get(1, 1), 3, 'True Positives = 3');

const report = AdvancedMetrics.classificationReport(yTrue, yPred, 2);
assert(report.classes[0].precision === 0.75);
assert(report.classes[1].recall === 0.75);
console.log('✅ Confusion Matrix & Classification Report Test Passed!');

console.log('▶ Testing ROC-AUC Score...');
const yTrueBinary = [0, 0, 1, 1];
const yPerfectScores = [0.1, 0.2, 0.8, 0.9];
const aucPerfect = AdvancedMetrics.rocaucScore(yTrueBinary, yPerfectScores);
assert.strictEqual(aucPerfect, 1.0, 'Perfect predictions must produce ROC-AUC = 1.0');

const yReversedScores = [0.9, 0.8, 0.2, 0.1];
const aucReversed = AdvancedMetrics.rocaucScore(yTrueBinary, yReversedScores);
assert.strictEqual(aucReversed, 0.0, 'Inverted predictions must produce ROC-AUC = 0.0');

console.log('✅ ROC-AUC Numerical Quadrature Test Passed!');
console.log('🎉 All Model Selection & Advanced Metrics Tests Passed Cleanly!');

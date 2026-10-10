/**
 * @file tree_forest.test.js
 * @description Comprehensive test suite for Decision Trees and Random Forests (Biome 4: Branching Canopy).
 */

import assert from 'assert';
import { Matrix } from '../../src/ml/Matrix.js';
import { DecisionTree } from '../../src/ml/tree.js';
import { RandomForest } from '../../src/ml/forest.js';
import { Metrics } from '../../src/ml/Metrics.js';

console.log('▶ Testing Decision Tree Classifier...');

// 1. Synthetic 2D classification dataset with separable boundary
const X_data = [
  [-2.0, -2.0],
  [-1.5, -1.8],
  [-2.2, -1.0],
  [-1.0, -0.5],
  [1.0, 1.2],
  [1.5, 2.0],
  [2.0, 1.8],
  [2.5, 2.2]
];
const y_data = [0, 0, 0, 0, 1, 1, 1, 1];

const X = new Matrix(8, 2, Float64Array.from(X_data.flat()));
const y = new Matrix(8, 1, Float64Array.from(y_data));

const clf = new DecisionTree({
  task: 'classification',
  criterion: 'gini',
  maxDepth: 3
});

clf.fit(X, y);
const preds = clf.predict(X);
const acc = Metrics.accuracy(y, preds);

assert.strictEqual(acc, 1.0, 'Decision Tree must achieve 100% accuracy on linearly separable data');
console.log(`✅ Decision Tree Classification Test Passed! Accuracy: ${(acc * 100).toFixed(1)}%`);

// 2. Probabilistic predictions
const probas = clf.predictProba(X);
assert.strictEqual(probas.rows, 8);
assert.strictEqual(probas.cols, 2);
for (let i = 0; i < 4; i++) {
  assert(probas.get(i, 0) > 0.8, 'Class 0 samples should have high p(0)');
}
for (let i = 4; i < 8; i++) {
  assert(probas.get(i, 1) > 0.8, 'Class 1 samples should have high p(1)');
}
console.log('✅ Decision Tree Probability Calibration Test Passed!');

// 3. Regression Tree test
console.log('▶ Testing Decision Tree Regressor...');
const X_reg = new Matrix(6, 1, Float64Array.from([1.0, 2.0, 3.0, 10.0, 11.0, 12.0]));
const y_reg = new Matrix(6, 1, Float64Array.from([10.0, 10.0, 10.0, 50.0, 50.0, 50.0]));

const reg = new DecisionTree({
  task: 'regression',
  criterion: 'mse',
  maxDepth: 2
});
reg.fit(X_reg, y_reg);
const regPreds = reg.predict(X_reg);
const r2 = Metrics.r2(y_reg, regPreds);

assert(r2 > 0.95, `Regression Tree R2 must exceed 0.95 (actual: ${r2})`);
console.log(`✅ Decision Tree Regression Test Passed! R2: ${r2.toFixed(4)}`);

// 4. Random Forest Classifier Test
console.log('▶ Testing Random Forest Classifier & OOB Error...');
const rfClf = new RandomForest({
  task: 'classification',
  nEstimators: 15,
  maxDepth: 4,
  maxFeatures: 'sqrt'
});

rfClf.fit(X, y);
const rfPreds = rfClf.predict(X);
const rfAcc = Metrics.accuracy(y, rfPreds);

assert(rfAcc >= 0.9, `Random Forest accuracy must be >= 0.9 (actual: ${rfAcc})`);
assert.strictEqual(rfClf.trees.length, 15, 'Forest must contain exactly 15 trees');
assert(rfClf.featureImportances !== null, 'Feature importances must be computed');
console.log(`✅ Random Forest Classification Test Passed! Accuracy: ${(rfAcc * 100).toFixed(1)}% | OOB Score: ${rfClf.oobScore}`);

// 5. Random Forest Regressor Test
console.log('▶ Testing Random Forest Regressor...');
const rfReg = new RandomForest({
  task: 'regression',
  nEstimators: 12,
  maxDepth: 3
});
rfReg.fit(X_reg, y_reg);
const rfRegPreds = rfReg.predict(X_reg);
const rfR2 = Metrics.r2(y_reg, rfRegPreds);
assert(rfR2 > 0.85, `Random Forest Regressor R2 must exceed 0.85 (actual: ${rfR2})`);
console.log(`✅ Random Forest Regression Test Passed! R2: ${rfR2.toFixed(4)}`);

console.log('🎉 All Decision Tree & Random Forest Tests Passed Cleanly!');

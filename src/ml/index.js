/**
 * @file index.js
 * @description Central export gateway for the NeuroArena Pure-JS Machine Learning Core.
 */

export { Matrix } from './Matrix.js';
export { Rng } from './Rng.js';
export { Datasets } from './Datasets.js';
export { createDatasetSplit } from './Split.js';
export { Metrics } from './Metrics.js';
export { StandardScaler, MinMaxScaler } from './Normalizer.js';
export { DatasetHealth } from './DatasetHealth.js';

export { LinearRegression } from './linear.js';
export { LogisticRegression, stableSigmoid } from './logistic.js';
export { BaseOptimizer, SGD, Momentum, RMSprop, Adam, createOptimizer } from './optimizers.js';

export { PolynomialFeatures } from './polynomial.js';
export { RegularizedRegression, softThreshold } from './regularization.js';
export { TreeNode, DecisionTree } from './tree.js';
export { RandomForest } from './forest.js';
export { DenseLayer, MLP } from './mlp.js';

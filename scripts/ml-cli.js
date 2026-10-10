#!/usr/bin/env node
/**
 * @file ml-cli.js
 * @description NeuroArena Developer Multi-Model ML CLI & Evaluation Suite.
 * Usage:
 *   node scripts/ml-cli.js --model tree
 *   node scripts/ml-cli.js --model embeddings --query fire
 *   node scripts/ml-cli.js --model mlp --epochs 300
 *   node scripts/ml-cli.js --model pca
 */

import {
  Matrix,
  LinearRegression,
  LogisticRegression,
  DecisionTree,
  RandomForest,
  MLP,
  EmbeddingModel,
  PCA,
  KMeans,
  AdvancedMetrics
} from '../src/ml/index.js';

const args = process.argv.slice(2);
let modelType = 'linear';
let queryArg = 'fire';
let epochs = 300;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--model' && args[i + 1]) modelType = args[++i].toLowerCase();
  if (args[i] === '--query' && args[i + 1]) queryArg = args[++i];
  if (args[i] === '--epochs' && args[i + 1]) epochs = parseInt(args[++i], 10);
}

console.log('==================================================');
console.log('⚡ NEURO-ARENA V4.5 MULTI-MODEL ML CORE CLI');
console.log(`🤖 Selected Model Architecture: ${modelType.toUpperCase()}`);
console.log('==================================================\n');

switch (modelType) {
  case 'tree': {
    console.log('🌲 Training Decision Tree Classifier (Biome 4)...');
    const X = new Matrix(6, 2, Float64Array.from([-2, -2, -1, -1, -2, -1, 1, 1, 2, 2, 2, 1]));
    const y = new Matrix(6, 1, Float64Array.from([0, 0, 0, 1, 1, 1]));
    const tree = new DecisionTree({ task: 'classification', maxDepth: 4 });
    tree.fit(X, y);
    const score = tree.score(X, y);
    console.log(`✅ Tree Training Complete. Accuracy: ${(score.score * 100).toFixed(1)}%`);
    console.log(`📊 Normalized Feature Importances:`, Array.from(tree.featureImportances).map(v => v.toFixed(3)));
    break;
  }

  case 'forest': {
    console.log('🌳 Training Random Forest Ensemble with 20 Estimators (Biome 4)...');
    const X = new Matrix(6, 2, Float64Array.from([-2, -2, -1, -1, -2, -1, 1, 1, 2, 2, 2, 1]));
    const y = new Matrix(6, 1, Float64Array.from([0, 0, 0, 1, 1, 1]));
    const rf = new RandomForest({ task: 'classification', nEstimators: 20, maxDepth: 4 });
    rf.fit(X, y);
    const score = rf.score(X, y);
    console.log(`✅ Forest Training Complete. Accuracy: ${(score.score * 100).toFixed(1)}% | OOB Score: ${rf.oobScore}`);
    console.log(`📊 Ensemble MDI Feature Importances:`, Array.from(rf.featureImportances).map(v => v.toFixed(3)));
    break;
  }

  case 'mlp': {
    console.log(`🧠 Training Multi-Layer Perceptron on XOR Manifold (${epochs} Epochs, Biome 5)...`);
    const X = new Matrix(4, 2, Float64Array.from([0, 0, 0, 1, 1, 0, 1, 1]));
    const y = new Matrix(4, 1, Float64Array.from([0, 1, 1, 0]));
    const mlp = new MLP([2, 8, 1], { hiddenActivation: 'tanh', outputActivation: 'sigmoid', lr: 0.2 });
    mlp.fit(X, y, epochs);
    const preds = mlp.predict(X);
    console.log('✅ MLP Convergence Complete. Predictions:');
    console.log(`  [0, 0] ➔ ${preds.get(0, 0).toFixed(3)} (Expected ~0)`);
    console.log(`  [0, 1] ➔ ${preds.get(1, 0).toFixed(3)} (Expected ~1)`);
    console.log(`  [1, 0] ➔ ${preds.get(2, 0).toFixed(3)} (Expected ~1)`);
    console.log(`  [1, 1] ➔ ${preds.get(3, 0).toFixed(3)} (Expected ~0)`);
    break;
  }

  case 'embeddings': {
    console.log(`📚 Fitting PPMI Semantic Embeddings and Querying Nearest Neighbors (Biome 6)...`);
    const corpus = [
      'fire heat blaze warm heat fire flame sun ignite torch',
      'ice cold frost arctic cold ice freeze snow glacier tundra chill',
      'vector matrix tensor gradient backprop weights bias neuron optimization'
    ];
    const emb = new EmbeddingModel({ windowSize: 3 });
    emb.fit(corpus);
    const neighbors = emb.findNearestNeighbors(queryArg, 4);
    console.log(`🔍 Query: "${queryArg}" ➔ Top Nearest Neighbors:`);
    neighbors.forEach((n, idx) => {
      console.log(`  ${idx + 1}. "${n.word}" (Cosine Similarity: ${n.similarity})`);
    });
    break;
  }

  case 'pca': {
    console.log('📉 Computing PCA Eigenvectors and Subspace Projection...');
    const X = new Matrix(6, 3, Float64Array.from([
      1, 2, 0.1,
      2, 4, 0.2,
      3, 6, 0.1,
      10, 20, 0.3,
      11, 22, 0.2,
      12, 24, 0.4
    ]));
    const pca = new PCA({ nComponents: 2 });
    pca.fit(X);
    console.log(`✅ Explained Variance Ratio:`, Array.from(pca.explainedVarianceRatio).map(v => `${(v * 100).toFixed(2)}%`));
    break;
  }

  case 'kmeans': {
    console.log('🎯 Running K-Means++ Clustering and Voronoi Partitioning...');
    const X = new Matrix(6, 2, Float64Array.from([
      -5, -5, -4.9, -5.1,
      0, 5, 0.1, 4.9,
      5, -5, 5.1, -4.9
    ]));
    const km = new KMeans({ nClusters: 3 });
    km.fit(X);
    console.log(`✅ K-Means Fit Complete. Labels:`, Array.from(km.labels));
    console.log(`📊 Silhouette Score: ${km.silhouetteScore(X)} | Inertia: ${km.inertia.toFixed(4)}`);
    break;
  }

  case 'linear':
  default: {
    const queryNum = parseFloat(queryArg) || 14.5;
    const w = 2.45, b = 1.15;
    const minX = -4.5, maxX = 4.5, sigma = 2.5;
    const yHat = w * queryNum + b;
    const isExtrap = (queryNum < minX - 0.2 * sigma) || (queryNum > maxX + 0.2 * sigma);

    console.log(`🔍 Query Input: X = ${queryNum}`);
    console.log(`📈 Model Prediction: y = (${w}) * (${queryNum}) + (${b}) = ${yHat.toFixed(3)}`);
    console.log(`📊 Empirical Domain: [${minX}, ${maxX}]`);
    if (isExtrap) {
      console.log('\n⚠️ [LOW CONFIDENCE :: EXTRAPOLATION WARNING]');
      console.log('Explanation: Query lies outside the empirical training distribution.');
    } else {
      console.log('\n✓ [HIGH CONFIDENCE :: IN-DOMAIN INTERPOLATION]');
    }
    break;
  }
}

console.log('\n==================================================');

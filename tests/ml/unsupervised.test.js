/**
 * @file unsupervised.test.js
 * @description Test suite for Unsupervised Learning engines: PCA and K-Means Clustering.
 */

import assert from 'assert';
import { Matrix } from '../../src/ml/Matrix.js';
import { PCA } from '../../src/ml/pca.js';
import { KMeans } from '../../src/ml/kmeans.js';

console.log('▶ Testing Principal Component Analysis (PCA)...');

// 3D synthetic data embedded largely in a 2D plane
const N = 12;
const X_3d = new Matrix(N, 3);
for (let i = 0; i < N; i++) {
  const x = i * 1.5;
  const y = (i % 3) * 2.0;
  const z = 0.05 * Math.sin(i); // Very little variance along Z
  X_3d.set(i, 0, x);
  X_3d.set(i, 1, y);
  X_3d.set(i, 2, z);
}

const pca = new PCA({ nComponents: 2 });
pca.fit(X_3d);

const varianceExplainedSum = pca.explainedVarianceRatio[0] + pca.explainedVarianceRatio[1];
console.log(`Top 2 PCA Explained Variance Ratio: ${(varianceExplainedSum * 100).toFixed(2)}%`);
assert(varianceExplainedSum > 0.95, 'Top 2 components must capture >95% of total variance');

const Z = pca.transform(X_3d);
assert.strictEqual(Z.rows, N);
assert.strictEqual(Z.cols, 2);

const X_reconstructed = pca.inverseTransform(Z);
let maxReconError = 0.0;
for (let i = 0; i < N; i++) {
  for (let j = 0; j < 3; j++) {
    const err = Math.abs(X_3d.get(i, j) - X_reconstructed.get(i, j));
    if (err > maxReconError) maxReconError = err;
  }
}
console.log(`Max PCA Reconstruction Error: ${maxReconError.toFixed(5)}`);
assert(maxReconError < 0.1, 'PCA Inverse Reconstruction error should be minimal');
console.log('✅ PCA Dimensionality Reduction & Reconstruction Test Passed!');

console.log('▶ Testing K-Means++ Clustering & Silhouette Score...');
// 3 well-separated 2D clusters
const clusterPoints = [
  // Cluster 0: near (-10, -10)
  [-10.1, -10.2], [-9.8, -9.9], [-10.3, -10.0], [-9.9, -10.4],
  // Cluster 1: near (0, 10)
  [0.1, 9.8], [-0.2, 10.2], [0.3, 10.1], [-0.1, 9.9],
  // Cluster 2: near (10, -10)
  [9.9, -10.1], [10.2, -9.8], [10.0, -10.3], [10.3, -9.9]
];

const X_clust = new Matrix(12, 2, Float64Array.from(clusterPoints.flat()));
const kmeans = new KMeans({ nClusters: 3, init: 'k-means++' });
kmeans.fit(X_clust);

assert.strictEqual(kmeans.clusterCenters.rows, 3);
assert.strictEqual(kmeans.clusterCenters.cols, 2);

// Check that samples in the same group received identical labels
assert.strictEqual(kmeans.labels[0], kmeans.labels[1]);
assert.strictEqual(kmeans.labels[0], kmeans.labels[2]);
assert.strictEqual(kmeans.labels[4], kmeans.labels[5]);
assert.strictEqual(kmeans.labels[8], kmeans.labels[9]);
assert.notStrictEqual(kmeans.labels[0], kmeans.labels[4]);
assert.notStrictEqual(kmeans.labels[0], kmeans.labels[8]);

const silScore = kmeans.silhouetteScore(X_clust);
console.log(`K-Means Silhouette Score: ${silScore.toFixed(4)} | Inertia: ${kmeans.inertia.toFixed(4)}`);
assert(silScore > 0.8, 'Well-separated clusters must have Silhouette Score > 0.8');

console.log('✅ K-Means Clustering & Silhouette Validation Test Passed!');
console.log('🎉 All Unsupervised PCA & K-Means Tests Passed Cleanly!');

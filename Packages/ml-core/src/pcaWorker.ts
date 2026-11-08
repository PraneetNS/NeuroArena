/**
 * NeuroArena ML-Core: PCA Web Worker.
 *
 * Runs power-iteration PCA and checkpoint scrubber projections off the main thread
 * ensuring UI interaction remains at 60 fps during analytical calculations.
 */

import { computeEmbeddingPca, projectEmbeddingsToBasis, findNearestNeighbors } from './pca.js';

export interface PcaWorkerRequest {
  id: number;
  type: 'compute' | 'project' | 'nearest';
  tokEmb: Float32Array;
  vocabSize: number;
  dModel: number;
  basis?: { components: Float32Array[]; mean: Float32Array };
  targetIdx?: number;
  k?: number;
}

export interface PcaWorkerResponse {
  id: number;
  type: 'compute' | 'project' | 'nearest';
  pcaResult?: any;
  coordinates?: Float32Array;
  neighbors?: any[];
  error?: string;
}

self.onmessage = (e: MessageEvent<PcaWorkerRequest>) => {
  const req = e.data;
  try {
    if (req.type === 'compute') {
      const res = computeEmbeddingPca(req.tokEmb, req.vocabSize, req.dModel, 3);
      self.postMessage({
        id: req.id,
        type: 'compute',
        pcaResult: {
          components: res.components,
          mean: res.mean,
          explainedVarianceRatio: res.explainedVarianceRatio,
          totalVariance: res.totalVariance,
          eigenvalues: res.eigenvalues,
          coordinates: res.coordinates
        }
      });
    } else if (req.type === 'project' && req.basis) {
      const coords = projectEmbeddingsToBasis(req.tokEmb, req.basis, req.vocabSize, req.dModel);
      self.postMessage({
        id: req.id,
        type: 'project',
        coordinates: coords
      });
    } else if (req.type === 'nearest' && req.targetIdx !== undefined) {
      const neighbors = findNearestNeighbors(req.targetIdx, req.tokEmb, req.vocabSize, req.dModel, req.k ?? 8);
      self.postMessage({
        id: req.id,
        type: 'nearest',
        neighbors
      });
    }
  } catch (err: any) {
    self.postMessage({
      id: req.id,
      type: req.type,
      error: err?.message || String(err)
    });
  }
};


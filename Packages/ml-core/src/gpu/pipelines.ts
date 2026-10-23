/**
 * Compiles WGSL shaders into reusable GPUComputePipelines.
 * All pipelines are initialized once at startup.
 */

import { Shaders } from './shaders/index.js';

export interface GpuPipelines {
  embedding: GPUComputePipeline;
  matmul: GPUComputePipeline;
  batchedMatmul: GPUComputePipeline;
  layernorm: GPUComputePipeline;
  causalAttention: GPUComputePipeline;
  attentionValue: GPUComputePipeline;
  gelu: GPUComputePipeline;
  residual: GPUComputePipeline;
  crossEntropy: GPUComputePipeline;
  reduceSum: GPUComputePipeline;

  // Backward & Optimizer Pipelines
  biasBackward: GPUComputePipeline;
  layernormBackwardDx: GPUComputePipeline;
  layernormBackwardParams: GPUComputePipeline;
  causalAttentionBackwardQ: GPUComputePipeline;
  causalAttentionBackwardKv: GPUComputePipeline;
  geluBackward: GPUComputePipeline;
  embeddingBackward: GPUComputePipeline;
  positionEmbeddingBackward: GPUComputePipeline;
  zeroBuffer: GPUComputePipeline;
  gradNorm: GPUComputePipeline;
  reduceNorm: GPUComputePipeline;
  adamw: GPUComputePipeline;
  reduceLayerDiagnostics: GPUComputePipeline;
  reduceGlobalDiagnostics: GPUComputePipeline;
}

export function createPipelines(device: GPUDevice): GpuPipelines {
  function makePipeline(code: string, label: string, entryPoint = 'main'): GPUComputePipeline {
    const module = device.createShaderModule({
      label: `${label}Module`,
      code
    });
    return device.createComputePipeline({
      label: `${label}Pipeline`,
      layout: 'auto',
      compute: {
        module,
        entryPoint
      }
    });
  }

  return {
    embedding: makePipeline(Shaders.embedding, 'embedding'),
    matmul: makePipeline(Shaders.matmul, 'matmul'),
    batchedMatmul: makePipeline(Shaders.batchedMatmul, 'batchedMatmul'),
    layernorm: makePipeline(Shaders.layernorm, 'layernorm'),
    causalAttention: makePipeline(Shaders.causalAttention, 'causalAttention'),
    attentionValue: makePipeline(Shaders.attentionValue, 'attentionValue'),
    gelu: makePipeline(Shaders.gelu, 'gelu'),
    residual: makePipeline(Shaders.residual, 'residual'),
    crossEntropy: makePipeline(Shaders.crossEntropy, 'crossEntropy'),
    reduceSum: makePipeline(Shaders.reduceSum, 'reduceSum'),

    biasBackward: makePipeline(Shaders.biasBackward, 'biasBackward'),
    layernormBackwardDx: makePipeline(Shaders.layernormBackwardDx, 'layernormBackwardDx'),
    layernormBackwardParams: makePipeline(Shaders.layernormBackwardParams, 'layernormBackwardParams'),
    causalAttentionBackwardQ: makePipeline(Shaders.causalAttentionBackwardQ, 'causalAttentionBackwardQ'),
    causalAttentionBackwardKv: makePipeline(Shaders.causalAttentionBackwardKv, 'causalAttentionBackwardKv'),
    geluBackward: makePipeline(Shaders.geluBackward, 'geluBackward'),
    embeddingBackward: makePipeline(Shaders.embeddingBackward, 'embeddingBackward'),
    positionEmbeddingBackward: makePipeline(Shaders.positionEmbeddingBackward, 'positionEmbeddingBackward'),
    zeroBuffer: makePipeline(Shaders.zeroBuffer, 'zeroBuffer'),
    gradNorm: makePipeline(Shaders.gradNorm, 'gradNorm'),
    reduceNorm: makePipeline(Shaders.reduceNorm, 'reduceNorm'),
    adamw: makePipeline(Shaders.adamw, 'adamw'),
    reduceLayerDiagnostics: makePipeline(Shaders.diagnostics, 'reduceLayerDiagnostics', 'reduce_layer_diagnostics'),
    reduceGlobalDiagnostics: makePipeline(Shaders.diagnostics, 'reduceGlobalDiagnostics', 'reduce_global_diagnostics')
  };
}

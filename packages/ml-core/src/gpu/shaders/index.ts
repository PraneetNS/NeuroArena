// Shader sources exported as raw strings
import embeddingShader from './embedding.wgsl?raw';
import matmulShader from './matmul.wgsl?raw';
import batchedMatmulShader from './batched_matmul.wgsl?raw';
import layernormShader from './layernorm.wgsl?raw';
import causalAttentionShader from './causal_attention.wgsl?raw';
import attentionValueShader from './attention_value.wgsl?raw';
import geluShader from './gelu.wgsl?raw';
import residualShader from './residual.wgsl?raw';
import crossEntropyShader from './cross_entropy.wgsl?raw';
import reduceSumShader from './reduce_sum.wgsl?raw';

// Backward & Optimizer Shaders
import biasBackwardShader from './bias_backward.wgsl?raw';
import layernormBackwardDxShader from './layernorm_backward_dx.wgsl?raw';
import layernormBackwardParamsShader from './layernorm_backward_params.wgsl?raw';
import causalAttentionBackwardQShader from './causal_attention_backward_q.wgsl?raw';
import causalAttentionBackwardKvShader from './causal_attention_backward_kv.wgsl?raw';
import geluBackwardShader from './gelu_backward.wgsl?raw';
import embeddingBackwardShader from './embedding_backward.wgsl?raw';
import positionEmbeddingBackwardShader from './position_embedding_backward.wgsl?raw';
import zeroBufferShader from './zero_buffer.wgsl?raw';
import gradNormShader from './grad_norm.wgsl?raw';
import reduceNormShader from './reduce_norm.wgsl?raw';
import adamwShader from './adamw.wgsl?raw';
import diagnosticsShader from './diagnostics.wgsl?raw';

export const Shaders = {
  embedding: embeddingShader,
  matmul: matmulShader,
  batchedMatmul: batchedMatmulShader,
  layernorm: layernormShader,
  causalAttention: causalAttentionShader,
  attentionValue: attentionValueShader,
  gelu: geluShader,
  residual: residualShader,
  crossEntropy: crossEntropyShader,
  reduceSum: reduceSumShader,

  biasBackward: biasBackwardShader,
  layernormBackwardDx: layernormBackwardDxShader,
  layernormBackwardParams: layernormBackwardParamsShader,
  causalAttentionBackwardQ: causalAttentionBackwardQShader,
  causalAttentionBackwardKv: causalAttentionBackwardKvShader,
  geluBackward: geluBackwardShader,
  embeddingBackward: embeddingBackwardShader,
  positionEmbeddingBackward: positionEmbeddingBackwardShader,
  zeroBuffer: zeroBufferShader,

  gradNorm: gradNormShader,
  reduceNorm: reduceNormShader,
  adamw: adamwShader,
  diagnostics: diagnosticsShader
};

export default Shaders;

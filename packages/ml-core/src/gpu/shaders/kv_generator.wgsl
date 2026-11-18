// kv_generator.wgsl - High-Performance GPU Autoregressive KV-Cache Kernels
// Executes single-token step and prompt prefill with per-layer KV cache.

struct ModelDims {
  dModel: u32,
  nHeads: u32,
  headDim: u32,
  contextLen: u32,
  vocabSize: u32,
  dFF: u32,
  nLayers: u32,
  pad0: u32,
};

// --- Step 1: Token Embedding + Positional Embedding ---
struct EmbedStepUniforms {
  tokenId: u32,
  pos: u32,
  tokEmbOffset: u32,
  posEmbOffset: u32,
};

@group(0) @binding(0) var<storage, read> allParams: array<f32>;
@group(0) @binding(1) var<storage, read_write> currentX: array<f32>;
@group(0) @binding(2) var<uniform> embedUni: EmbedStepUniforms;
@group(0) @binding(3) var<uniform> modelDims: ModelDims;

@compute @workgroup_size(64, 1, 1)
fn embed_step_main(@builtin(local_invocation_id) local_id: vec3<u32>, @builtin(workgroup_id) group_id: vec3<u32>) {
  let d = group_id.x * 64u + local_id.x;
  let D = modelDims.dModel;
  if (d < D) {
    let tokIdx = embedUni.tokEmbOffset + embedUni.tokenId * D + d;
    let posIdx = embedUni.posEmbOffset + embedUni.pos * D + d;
    currentX[d] = allParams[tokIdx] + allParams[posIdx];
  }
}

// --- Step 2: LayerNorm on Vector X ---
struct LnStepUniforms {
  gammaOffset: u32,
  betaOffset: u32,
  dim: u32,
  eps: f32,
};

@group(0) @binding(0) var<storage, read> lnAllParams: array<f32>;
@group(0) @binding(1) var<storage, read> lnInput: array<f32>;
@group(0) @binding(2) var<storage, read_write> lnOutput: array<f32>;
@group(0) @binding(3) var<uniform> lnUni: LnStepUniforms;

var<workgroup> ln_sdata: array<f32, 256>;
var<workgroup> ln_mean: f32;
var<workgroup> ln_invStd: f32;

@compute @workgroup_size(256, 1, 1)
fn layernorm_step_main(@builtin(local_invocation_id) local_id: vec3<u32>) {
  let tid = local_id.x;
  let D = lnUni.dim;

  var sum: f32 = 0.0;
  var i: u32 = tid;
  while (i < D) {
    sum = sum + lnInput[i];
    i = i + 256u;
  }
  ln_sdata[tid] = sum;
  workgroupBarrier();

  for (var s: u32 = 128u; s > 0u; s = s >> 1u) {
    if (tid < s) {
      ln_sdata[tid] = ln_sdata[tid] + ln_sdata[tid + s];
    }
    workgroupBarrier();
  }
  if (tid == 0u) {
    ln_mean = ln_sdata[0] / f32(D);
  }
  workgroupBarrier();

  let mean = ln_mean;
  var varSum: f32 = 0.0;
  i = tid;
  while (i < D) {
    let diff = lnInput[i] - mean;
    varSum = varSum + diff * diff;
    i = i + 256u;
  }
  ln_sdata[tid] = varSum;
  workgroupBarrier();

  for (var s: u32 = 128u; s > 0u; s = s >> 1u) {
    if (tid < s) {
      ln_sdata[tid] = ln_sdata[tid] + ln_sdata[tid + s];
    }
    workgroupBarrier();
  }
  if (tid == 0u) {
    let variance = ln_sdata[0] / f32(D);
    ln_invStd = 1.0 / sqrt(variance + lnUni.eps);
  }
  workgroupBarrier();

  let invStd = ln_invStd;
  i = tid;
  while (i < D) {
    let g = lnAllParams[lnUni.gammaOffset + i];
    let b = lnAllParams[lnUni.betaOffset + i];
    lnOutput[i] = (lnInput[i] - mean) * invStd * g + b;
    i = i + 256u;
  }
}

// --- Step 3: Q, K, V Projection + KV Cache Append ---
struct QkvStepUniforms {
  layerIdx: u32,
  pos: u32,
  wqOffset: u32,
  bqOffset: u32,
  wkOffset: u32,
  bkOffset: u32,
  wvOffset: u32,
  bvOffset: u32,
};

@group(0) @binding(0) var<storage, read> qkvParams: array<f32>;
@group(0) @binding(1) var<storage, read> qkvInX: array<f32>;
@group(0) @binding(2) var<storage, read_write> qVector: array<f32>;
@group(0) @binding(3) var<storage, read_write> kvCacheBuf: array<f32>;
@group(0) @binding(4) var<uniform> qkvUni: QkvStepUniforms;
@group(0) @binding(5) var<uniform> qkvModelDims: ModelDims;

@compute @workgroup_size(64, 1, 1)
fn qkv_step_main(@builtin(local_invocation_id) local_id: vec3<u32>, @builtin(workgroup_id) group_id: vec3<u32>) {
  let d = group_id.x * 64u + local_id.x;
  let D = qkvModelDims.dModel;
  let H = qkvModelDims.nHeads;
  let headDim = qkvModelDims.headDim;
  let contextLen = qkvModelDims.contextLen;
  let layer = qkvUni.layerIdx;
  let pos = qkvUni.pos;

  if (d >= D) {
    return;
  }

  var dotQ: f32 = qkvParams[qkvUni.bqOffset + d];
  var dotK: f32 = qkvParams[qkvUni.bkOffset + d];
  var dotV: f32 = qkvParams[qkvUni.bvOffset + d];

  for (var k: u32 = 0u; k < D; k = k + 1u) {
    let xVal = qkvInX[k];
    dotQ = dotQ + xVal * qkvParams[qkvUni.wqOffset + k * D + d];
    dotK = dotK + xVal * qkvParams[qkvUni.wkOffset + k * D + d];
    dotV = dotV + xVal * qkvParams[qkvUni.wvOffset + k * D + d];
  }

  qVector[d] = dotQ;

  // Append K and V into kvCacheBuf:
  // Layout: [layer, isV (0=K, 1=V), head, contextLen, headDim]
  let h = d / headDim;
  let dh = d % headDim;
  let kOffset = (((layer * 2u + 0u) * H + h) * contextLen + pos) * headDim + dh;
  let vOffset = (((layer * 2u + 1u) * H + h) * contextLen + pos) * headDim + dh;
  kvCacheBuf[kOffset] = dotK;
  kvCacheBuf[vOffset] = dotV;
}

// --- Step 4: Multi-Head Attention over KV Cache ---
struct AttnStepUniforms {
  layerIdx: u32,
  pos: u32,
  pad0: u32,
  pad1: u32,
};

@group(0) @binding(0) var<storage, read> attnQVector: array<f32>;
@group(0) @binding(1) var<storage, read> attnKvCache: array<f32>;
@group(0) @binding(2) var<storage, read_write> attnOutVec: array<f32>;
@group(0) @binding(3) var<uniform> attnStepUni: AttnStepUniforms;
@group(0) @binding(4) var<uniform> attnModelDims: ModelDims;

var<workgroup> s_scores: array<f32, 256>;
var<workgroup> s_maxVal: f32;
var<workgroup> s_sumExp: f32;

@compute @workgroup_size(64, 1, 1)
fn kv_attention_step_main(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) group_id: vec3<u32>
) {
  let h = group_id.x; // head index [0, H-1]
  let H = attnModelDims.nHeads;
  if (h >= H) {
    return;
  }

  let tid = local_id.x;
  let headDim = attnModelDims.headDim;
  let contextLen = attnModelDims.contextLen;
  let layer = attnStepUni.layerIdx;
  let pos = attnStepUni.pos;
  let qBase = h * headDim;
  let scale = 1.0 / sqrt(f32(headDim));

  // Compute scores: Q_h @ K[layer, 0, h, j] for j in [0, pos]
  var j: u32 = tid;
  while (j <= pos) {
    let kBase = (((layer * 2u + 0u) * H + h) * contextLen + j) * headDim;
    var dot: f32 = 0.0;
    for (var d: u32 = 0u; d < headDim; d = d + 1u) {
      dot = dot + attnQVector[qBase + d] * attnKvCache[kBase + d];
    }
    s_scores[j] = dot * scale;
    j = j + 64u;
  }
  workgroupBarrier();

  // Max score
  if (tid == 0u) {
    var maxVal: f32 = -1e9;
    for (var k: u32 = 0u; k <= pos; k = k + 1u) {
      if (s_scores[k] > maxVal) {
        maxVal = s_scores[k];
      }
    }
    s_maxVal = maxVal;
  }
  workgroupBarrier();

  // Exp & sumExp
  let maxVal = s_maxVal;
  j = tid;
  while (j <= pos) {
    s_scores[j] = exp(s_scores[j] - maxVal);
    j = j + 64u;
  }
  workgroupBarrier();

  if (tid == 0u) {
    var sumExp: f32 = 0.0;
    for (var k: u32 = 0u; k <= pos; k = k + 1u) {
      sumExp = sumExp + s_scores[k];
    }
    s_sumExp = select(1.0, sumExp, sumExp > 0.0);
  }
  workgroupBarrier();

  // Softmax * V accumulation
  let invSumExp = 1.0 / s_sumExp;
  var d: u32 = tid;
  while (d < headDim) {
    var acc: f32 = 0.0;
    for (var k: u32 = 0u; k <= pos; k = k + 1u) {
      let weight = s_scores[k] * invSumExp;
      let vBase = (((layer * 2u + 1u) * H + h) * contextLen + k) * headDim + d;
      acc = acc + weight * attnKvCache[vBase];
    }
    attnOutVec[h * headDim + d] = acc;
    d = d + 64u;
  }
}

// --- Step 5: General Matrix-Vector (Linear Layer with optional Bias & Residual) ---
struct GemvStepUniforms {
  wOffset: u32,
  bOffset: u32,
  inDim: u32,
  outDim: u32,
  hasBias: u32,
  hasResidual: u32,
  pad0: u32,
  pad1: u32,
};

@group(0) @binding(0) var<storage, read> gemvAllParams: array<f32>;
@group(0) @binding(1) var<storage, read> gemvInX: array<f32>;
@group(0) @binding(2) var<storage, read_write> gemvOutY: array<f32>;
@group(0) @binding(3) var<storage, read> gemvResidualIn: array<f32>;
@group(0) @binding(4) var<uniform> gemvUni: GemvStepUniforms;

@compute @workgroup_size(64, 1, 1)
fn gemv_step_main(@builtin(local_invocation_id) local_id: vec3<u32>, @builtin(workgroup_id) group_id: vec3<u32>) {
  let outIdx = group_id.x * 64u + local_id.x;
  let inDim = gemvUni.inDim;
  let outDim = gemvUni.outDim;

  if (outIdx >= outDim) {
    return;
  }

  var dot: f32 = 0.0;
  if (gemvUni.hasBias == 1u) {
    dot = gemvAllParams[gemvUni.bOffset + outIdx];
  }

  for (var k: u32 = 0u; k < inDim; k = k + 1u) {
    dot = dot + gemvInX[k] * gemvAllParams[gemvUni.wOffset + k * outDim + outIdx];
  }

  if (gemvUni.hasResidual == 1u) {
    dot = dot + gemvResidualIn[outIdx];
  }

  gemvOutY[outIdx] = dot;
}

// --- Step 6: Vector GELU Activation ---
@group(0) @binding(0) var<storage, read_write> geluTarget: array<f32>;
@group(0) @binding(1) var<uniform> geluCount: u32;

@compute @workgroup_size(64, 1, 1)
fn gelu_step_main(@builtin(local_invocation_id) local_id: vec3<u32>, @builtin(workgroup_id) group_id: vec3<u32>) {
  let idx = group_id.x * 64u + local_id.x;
  if (idx < geluCount) {
    let x = geluTarget[idx];
    let sqrt2OverPi = 0.7978845608;
    let x3 = x * x * x;
    let inner = sqrt2OverPi * (x + 0.044715 * x3);
    geluTarget[idx] = 0.5 * x * (1.0 + tanh(inner));
  }
}

// --- Step 7: Final Tied Output Head Projection ---
struct TiedHeadUniforms {
  tokEmbOffset: u32,
  dModel: u32,
  vocabSize: u32,
  pad0: u32,
};

@group(0) @binding(0) var<storage, read> tiedAllParams: array<f32>;
@group(0) @binding(1) var<storage, read> tiedFinalX: array<f32>;
@group(0) @binding(2) var<storage, read_write> finalLogits: array<f32>;
@group(0) @binding(3) var<uniform> tiedHeadUni: TiedHeadUniforms;

@compute @workgroup_size(64, 1, 1)
fn tied_logits_step_main(@builtin(local_invocation_id) local_id: vec3<u32>, @builtin(workgroup_id) group_id: vec3<u32>) {
  let v = group_id.x * 64u + local_id.x;
  let vocabSize = tiedHeadUni.vocabSize;
  let dModel = tiedHeadUni.dModel;
  let tokEmbOffset = tiedHeadUni.tokEmbOffset;

  if (v >= vocabSize) {
    return;
  }

  var dot: f32 = 0.0;
  let embBase = tokEmbOffset + v * dModel;
  for (var d: u32 = 0u; d < dModel; d = d + 1u) {
    dot = dot + tiedFinalX[d] * tiedAllParams[embBase + d];
  }

  finalLogits[v] = dot;
}

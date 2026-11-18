// kv_single_token.wgsl - Single-Token KV-Cache Step & Matrix-Vector Shaders
// Optimized for interactive low-latency generation (B = 1) with per-layer KV cache.

struct TokenUniforms {
  tokenId: u32,
  pos: u32,
  dModel: u32,
  vocabSize: u32,
};

// 1. Embedding: tokEmb + posEmb -> x
@group(0) @binding(0) var<storage, read> tokEmb: array<f32>;
@group(0) @binding(1) var<storage, read> posEmb: array<f32>;
@group(0) @binding(2) var<storage, read_write> outX: array<f32>;
@group(0) @binding(3) var<uniform> embedUniforms: TokenUniforms;

@compute @workgroup_size(64, 1, 1)
fn embed_main(@builtin(local_invocation_id) local_id: vec3<u32>, @builtin(workgroup_id) group_id: vec3<u32>) {
  let idx = group_id.x * 64u + local_id.x;
  let dModel = embedUniforms.dModel;
  if (idx < dModel) {
    let tokOffset = embedUniforms.tokenId * dModel + idx;
    let posOffset = embedUniforms.pos * dModel + idx;
    outX[idx] = tokEmb[tokOffset] + posEmb[posOffset];
  }
}

// 2. LayerNorm on a single vector
struct LnUniforms {
  dim: u32,
  eps: f32,
  pad0: u32,
  pad1: u32,
};

@group(0) @binding(0) var<storage, read> lnIn: array<f32>;
@group(0) @binding(1) var<storage, read> lnGamma: array<f32>;
@group(0) @binding(2) var<storage, read> lnBeta: array<f32>;
@group(0) @binding(3) var<storage, read_write> lnOut: array<f32>;
@group(0) @binding(4) var<uniform> lnUniforms: LnUniforms;

var<workgroup> ln_sdata: array<f32, 256>;
var<workgroup> ln_mean: f32;
var<workgroup> ln_invStd: f32;

@compute @workgroup_size(256, 1, 1)
fn layernorm_main(@builtin(local_invocation_id) local_id: vec3<u32>) {
  let tid = local_id.x;
  let D = lnUniforms.dim;

  // Mean
  var sum: f32 = 0.0;
  var i: u32 = tid;
  while (i < D) {
    sum = sum + lnIn[i];
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

  // Variance
  let mean = ln_mean;
  var varSum: f32 = 0.0;
  i = tid;
  while (i < D) {
    let diff = lnIn[i] - mean;
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
    ln_invStd = 1.0 / sqrt(variance + lnUniforms.eps);
  }
  workgroupBarrier();

  // Normalize
  let invStd = ln_invStd;
  i = tid;
  while (i < D) {
    lnOut[i] = (lnIn[i] - mean) * invStd * lnGamma[i] + lnBeta[i];
    i = i + 256u;
  }
}

// 3. Q, K, V Projection + KV Cache Append
struct QkvUniforms {
  dModel: u32,
  pos: u32,
  contextLen: u32,
  headDim: u32,
};

@group(0) @binding(0) var<storage, read> qkvX: array<f32>;
@group(0) @binding(1) var<storage, read> Wq: array<f32>;
@group(0) @binding(2) var<storage, read> Bq: array<f32>;
@group(0) @binding(3) var<storage, read> Wk: array<f32>;
@group(0) @binding(4) var<storage, read> Bk: array<f32>;
@group(0) @binding(5) var<storage, read> Wv: array<f32>;
@group(0) @binding(6) var<storage, read> Bv: array<f32>;
@group(0) @binding(7) var<storage, read_write> outQ: array<f32>;
@group(0) @binding(8) var<storage, read_write> kCache: array<f32>;
@group(0) @binding(9) var<storage, read_write> vCache: array<f32>;
@group(0) @binding(10) var<uniform> qkvUniforms: QkvUniforms;

@compute @workgroup_size(64, 1, 1)
fn qkv_append_main(@builtin(local_invocation_id) local_id: vec3<u32>, @builtin(workgroup_id) group_id: vec3<u32>) {
  let d = group_id.x * 64u + local_id.x;
  let dModel = qkvUniforms.dModel;
  let pos = qkvUniforms.pos;
  let contextLen = qkvUniforms.contextLen;
  let headDim = qkvUniforms.headDim;

  if (d >= dModel) {
    return;
  }

  var dotQ: f32 = Bq[d];
  var dotK: f32 = Bk[d];
  var dotV: f32 = Bv[d];

  for (var k: u32 = 0u; k < dModel; k = k + 1u) {
    let xVal = qkvX[k];
    dotQ = dotQ + xVal * Wq[k * dModel + d];
    dotK = dotK + xVal * Wk[k * dModel + d];
    dotV = dotV + xVal * Wv[k * dModel + d];
  }

  // Save Q vector
  outQ[d] = dotQ;

  // Append K and V directly to KV cache: shape [H, contextLen, headDim]
  let h = d / headDim;
  let dh = d % headDim;
  let cacheOffset = (h * contextLen + pos) * headDim + dh;
  kCache[cacheOffset] = dotK;
  vCache[cacheOffset] = dotV;
}

// 4. Single-Token KV-Cache Attention
// Multi-Head Attention query for pos against keys/values [0 .. pos]
struct AttnUniforms {
  H: u32,
  headDim: u32,
  pos: u32,
  contextLen: u32,
};

@group(0) @binding(0) var<storage, read> inQ: array<f32>;
@group(0) @binding(1) var<storage, read> inKCache: array<f32>;
@group(0) @binding(2) var<storage, read> inVCache: array<f32>;
@group(0) @binding(3) var<storage, read_write> attnOut: array<f32>;
@group(0) @binding(4) var<uniform> attnUniforms: AttnUniforms;

var<workgroup> s_scores: array<f32, 256>; // Max contextLen <= 256
var<workgroup> s_maxVal: f32;
var<workgroup> s_sumExp: f32;

@compute @workgroup_size(64, 1, 1)
fn kv_attention_main(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) group_id: vec3<u32>
) {
  let h = group_id.x; // head index [0, H-1]
  if (h >= attnUniforms.H) {
    return;
  }

  let tid = local_id.x;
  let headDim = attnUniforms.headDim;
  let pos = attnUniforms.pos;
  let contextLen = attnUniforms.contextLen;
  let qOffset = h * headDim;
  let scale = 1.0 / sqrt(f32(headDim));

  // 1. Compute dot product Q_h @ K[h, j] for j in [0, pos]
  var j: u32 = tid;
  while (j <= pos) {
    let kOffset = (h * contextLen + j) * headDim;
    var dot: f32 = 0.0;
    for (var d: u32 = 0u; d < headDim; d = d + 1u) {
      dot = dot + inQ[qOffset + d] * inKCache[kOffset + d];
    }
    s_scores[j] = dot * scale;
    j = j + 64u;
  }
  workgroupBarrier();

  // 2. Reduce to find max score for j <= pos
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

  // 3. Compute exp(score - max) and sumExp
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

  // 4. Multiply softmax weights with V[h, j] and accumulate
  let invSumExp = 1.0 / s_sumExp;
  var d: u32 = tid;
  while (d < headDim) {
    var acc: f32 = 0.0;
    for (var k: u32 = 0u; k <= pos; k = k + 1u) {
      let weight = s_scores[k] * invSumExp;
      let vOffset = (h * contextLen + k) * headDim + d;
      acc = acc + weight * inVCache[vOffset];
    }
    attnOut[h * headDim + d] = acc;
    d = d + 64u;
  }
}

// 5. General Matrix-Vector Multiplication: y = b + x @ W
struct GemvUniforms {
  inDim: u32,
  outDim: u32,
  hasBias: u32,
  pad0: u32,
};

@group(0) @binding(0) var<storage, read> gemvX: array<f32>;
@group(0) @binding(1) var<storage, read> gemvW: array<f32>;
@group(0) @binding(2) var<storage, read> gemvB: array<f32>;
@group(0) @binding(3) var<storage, read_write> gemvY: array<f32>;
@group(0) @binding(4) var<uniform> gemvUniforms: GemvUniforms;

@compute @workgroup_size(64, 1, 1)
fn gemv_main(@builtin(local_invocation_id) local_id: vec3<u32>, @builtin(workgroup_id) group_id: vec3<u32>) {
  let outIdx = group_id.x * 64u + local_id.x;
  let inDim = gemvUniforms.inDim;
  let outDim = gemvUniforms.outDim;

  if (outIdx >= outDim) {
    return;
  }

  var dot: f32 = 0.0;
  if (gemvUniforms.hasBias == 1u) {
    dot = gemvB[outIdx];
  }

  for (var k: u32 = 0u; k < inDim; k = k + 1u) {
    dot = dot + gemvX[k] * gemvW[k * outDim + outIdx];
  }

  gemvY[outIdx] = dot;
}

// 6. Vector GELU activation
@group(0) @binding(0) var<storage, read_write> geluBuf: array<f32>;
@group(0) @binding(1) var<uniform> geluLen: u32;

@compute @workgroup_size(64, 1, 1)
fn gelu_main(@builtin(local_invocation_id) local_id: vec3<u32>, @builtin(workgroup_id) group_id: vec3<u32>) {
  let idx = group_id.x * 64u + local_id.x;
  if (idx < geluLen) {
    let x = geluBuf[idx];
    // Approximation: 0.5 * x * (1.0 + tanh(sqrt(2.0 / pi) * (x + 0.044715 * x^3)))
    let sqrt2OverPi = 0.7978845608;
    let x3 = x * x * x;
    let inner = sqrt2OverPi * (x + 0.044715 * x3);
    geluBuf[idx] = 0.5 * x * (1.0 + tanh(inner));
  }
}

// 7. Vector Residual Add: x = x + res
@group(0) @binding(0) var<storage, read_write> resX: array<f32>;
@group(0) @binding(1) var<storage, read> resDelta: array<f32>;
@group(0) @binding(2) var<uniform> resLen: u32;

@compute @workgroup_size(64, 1, 1)
fn residual_main(@builtin(local_invocation_id) local_id: vec3<u32>, @builtin(workgroup_id) group_id: vec3<u32>) {
  let idx = group_id.x * 64u + local_id.x;
  if (idx < resLen) {
    resX[idx] = resX[idx] + resDelta[idx];
  }
}

// 8. Tied Output Head: logits[v] = sum_d ( x[d] * tokEmb[v * dModel + d] )
struct TiedLogitsUniforms {
  dModel: u32,
  vocabSize: u32,
  pad0: u32,
  pad1: u32,
};

@group(0) @binding(0) var<storage, read> finalX: array<f32>;
@group(0) @binding(1) var<storage, read> tiedTokEmb: array<f32>;
@group(0) @binding(2) var<storage, read_write> outLogits: array<f32>;
@group(0) @binding(3) var<uniform> tiedUniforms: TiedLogitsUniforms;

@compute @workgroup_size(64, 1, 1)
fn tied_logits_main(@builtin(local_invocation_id) local_id: vec3<u32>, @builtin(workgroup_id) group_id: vec3<u32>) {
  let v = group_id.x * 64u + local_id.x;
  let vocabSize = tiedUniforms.vocabSize;
  let dModel = tiedUniforms.dModel;

  if (v >= vocabSize) {
    return;
  }

  var dot: f32 = 0.0;
  let embOffset = v * dModel;
  for (var d: u32 = 0u; d < dModel; d = d + 1u) {
    dot = dot + finalX[d] * tiedTokEmb[embOffset + d];
  }

  outLogits[v] = dot;
}

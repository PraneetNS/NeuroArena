// layernorm.wgsl - Layer Normalization with workgroup-memory reduction (one workgroup per row)
// Saves (mean, rstd) to outMeanRstd for backward pass.

struct LayerNormUniforms {
  M: u32,           // Number of rows (B * T)
  D: u32,           // Hidden dimension (dModel)
  gammaOffset: u32, // Offset of gamma in params buffer
  biasOffset: u32,  // Offset of bias in params buffer
  eps: f32,         // Epsilon (1e-5)
  pad0: u32,
  pad1: u32,
  pad2: u32,
};

@group(0) @binding(0) var<storage, read> inX: array<f32>;
@group(0) @binding(1) var<storage, read> params: array<f32>;
@group(0) @binding(2) var<storage, read_write> outY: array<f32>;
@group(0) @binding(3) var<storage, read_write> outMeanRstd: array<f32>;
@group(0) @binding(4) var<uniform> uniforms: LayerNormUniforms;

var<workgroup> sdata: array<f32, 256>;
var<workgroup> rowMean: f32;
var<workgroup> rowRstd: f32;

@compute @workgroup_size(256, 1, 1)
fn main(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) group_id: vec3<u32>
) {
  let m = group_id.x;
  if (m >= uniforms.M) {
    return;
  }

  let tid = local_id.x;
  let D = uniforms.D;
  let rowOffset = m * D;

  // 1. Compute row mean
  var sum: f32 = 0.0;
  var d: u32 = tid;
  while (d < D) {
    sum = sum + inX[rowOffset + d];
    d = d + 256u;
  }
  sdata[tid] = sum;
  workgroupBarrier();

  for (var s: u32 = 128u; s > 0u; s = s >> 1u) {
    if (tid < s) {
      sdata[tid] = sdata[tid] + sdata[tid + s];
    }
    workgroupBarrier();
  }

  if (tid == 0u) {
    rowMean = sdata[0] / f32(D);
  }
  workgroupBarrier();

  // 2. Compute row variance
  let mean = rowMean;
  var varSum: f32 = 0.0;
  d = tid;
  while (d < D) {
    let diff = inX[rowOffset + d] - mean;
    varSum = varSum + diff * diff;
    d = d + 256u;
  }
  sdata[tid] = varSum;
  workgroupBarrier();

  for (var s: u32 = 128u; s > 0u; s = s >> 1u) {
    if (tid < s) {
      sdata[tid] = sdata[tid] + sdata[tid + s];
    }
    workgroupBarrier();
  }

  if (tid == 0u) {
    let variance = sdata[0] / f32(D);
    let rstd = 1.0 / sqrt(variance + uniforms.eps);
    rowRstd = rstd;
    outMeanRstd[m * 2u] = mean;
    outMeanRstd[m * 2u + 1u] = rstd;
  }
  workgroupBarrier();

  // 3. Normalize, scale and shift
  let rstd = rowRstd;
  d = tid;
  while (d < D) {
    let normVal = (inX[rowOffset + d] - mean) * rstd;
    let gamma = params[uniforms.gammaOffset + d];
    let bias = params[uniforms.biasOffset + d];
    outY[rowOffset + d] = normVal * gamma + bias;
    d = d + 256u;
  }
}

// layernorm_backward_dx.wgsl - Layer Normalization input gradient (dx) with workgroup reduction
// Uses closed-form LayerNorm backward formula:
// dx = rstd * [ dy * gamma - (1/D) * sum(dy * gamma) - xHat * (1/D) * sum(dy * gamma * xHat) ]

struct LayerNormDxUniforms {
  M: u32,           // Total tokens (B * T)
  D: u32,           // Hidden dimension
  gammaOffset: u32, // Offset of gamma in params buffer
  hasResidual: u32, // 1: accumulate dX += dx, 0: overwrite dX = dx
};

@group(0) @binding(0) var<storage, read> dY: array<f32>;
@group(0) @binding(1) var<storage, read> inX: array<f32>;
@group(0) @binding(2) var<storage, read> params: array<f32>;
@group(0) @binding(3) var<storage, read> meanRstd: array<f32>;
@group(0) @binding(4) var<storage, read_write> dX: array<f32>;
@group(0) @binding(5) var<uniform> uniforms: LayerNormDxUniforms;

var<workgroup> sdata1: array<f32, 256>;
var<workgroup> sdata2: array<f32, 256>;
var<workgroup> rowMeanDyGamma: f32;
var<workgroup> rowMeanDyGammaXhat: f32;

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

  let mean = meanRstd[m * 2u];
  let rstd = meanRstd[m * 2u + 1u];

  var sum1: f32 = 0.0;
  var sum2: f32 = 0.0;

  var d: u32 = tid;
  while (d < D) {
    let dy = dY[rowOffset + d];
    let gamma = params[uniforms.gammaOffset + d];
    let xHat = (inX[rowOffset + d] - mean) * rstd;
    let dyGamma = dy * gamma;

    sum1 = sum1 + dyGamma;
    sum2 = sum2 + dyGamma * xHat;

    d = d + 256u;
  }

  sdata1[tid] = sum1;
  sdata2[tid] = sum2;
  workgroupBarrier();

  for (var s: u32 = 128u; s > 0u; s = s >> 1u) {
    if (tid < s) {
      sdata1[tid] = sdata1[tid] + sdata1[tid + s];
      sdata2[tid] = sdata2[tid] + sdata2[tid + s];
    }
    workgroupBarrier();
  }

  if (tid == 0u) {
    let invD = 1.0 / f32(D);
    rowMeanDyGamma = sdata1[0] * invD;
    rowMeanDyGammaXhat = sdata2[0] * invD;
  }
  workgroupBarrier();

  let meanDyGamma = rowMeanDyGamma;
  let meanDyGammaXhat = rowMeanDyGammaXhat;

  d = tid;
  while (d < D) {
    let dy = dY[rowOffset + d];
    let gamma = params[uniforms.gammaOffset + d];
    let xHat = (inX[rowOffset + d] - mean) * rstd;
    let dyGamma = dy * gamma;

    let dx = rstd * (dyGamma - meanDyGamma - xHat * meanDyGammaXhat);
    let idx = rowOffset + d;

    if (uniforms.hasResidual == 1u) {
      dX[idx] = dX[idx] + dx;
    } else {
      dX[idx] = dx;
    }

    d = d + 256u;
  }
}

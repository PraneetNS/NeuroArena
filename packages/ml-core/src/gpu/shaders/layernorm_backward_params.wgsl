// layernorm_backward_params.wgsl - Layer Normalization parameter gradients (dgamma, dbeta)
// One workgroup per feature column j in [0..D-1], with workgroup-memory reduction across rows M.
// dgamma[j] += sum_{m=0}^{M-1} dy[m, j] * xHat[m, j]
// dbeta[j]  += sum_{m=0}^{M-1} dy[m, j]

struct LayerNormParamsUniforms {
  M: u32,            // Total tokens (B * T)
  D: u32,            // Hidden dimension
  offsetDgamma: u32, // Offset in grads buffer
  offsetDbeta: u32,  // Offset in grads buffer
};

@group(0) @binding(0) var<storage, read> dY: array<f32>;
@group(0) @binding(1) var<storage, read> inX: array<f32>;
@group(0) @binding(2) var<storage, read> meanRstd: array<f32>;
@group(0) @binding(3) var<storage, read_write> grads: array<f32>;
@group(0) @binding(4) var<uniform> uniforms: LayerNormParamsUniforms;

var<workgroup> sdataDg: array<f32, 256>;
var<workgroup> sdataDb: array<f32, 256>;

@compute @workgroup_size(256, 1, 1)
fn main(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) group_id: vec3<u32>
) {
  let j = group_id.x;
  let D = uniforms.D;
  let M = uniforms.M;
  if (j >= D) {
    return;
  }

  let tid = local_id.x;

  var localDg: f32 = 0.0;
  var localDb: f32 = 0.0;

  var m: u32 = tid;
  while (m < M) {
    let dy = dY[m * D + j];
    let mean = meanRstd[m * 2u];
    let rstd = meanRstd[m * 2u + 1u];
    let xHat = (inX[m * D + j] - mean) * rstd;

    localDg = localDg + dy * xHat;
    localDb = localDb + dy;

    m = m + 256u;
  }

  sdataDg[tid] = localDg;
  sdataDb[tid] = localDb;
  workgroupBarrier();

  for (var s: u32 = 128u; s > 0u; s = s >> 1u) {
    if (tid < s) {
      sdataDg[tid] = sdataDg[tid] + sdataDg[tid + s];
      sdataDb[tid] = sdataDb[tid] + sdataDb[tid + s];
    }
    workgroupBarrier();
  }

  if (tid == 0u) {
    let gammaIdx = uniforms.offsetDgamma + j;
    let betaIdx = uniforms.offsetDbeta + j;
    grads[gammaIdx] = grads[gammaIdx] + sdataDg[0];
    grads[betaIdx] = grads[betaIdx] + sdataDb[0];
  }
}

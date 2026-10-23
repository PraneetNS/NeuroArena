// batched_matmul.wgsl - 16x16 shared-memory tiled batched matrix multiplication (per batch x head)
// Modes:
//   0: C[z] = A[z] @ B[z]
//   1: C[z] = A[z] @ B[z]^T

struct BatchedMatmulUniforms {
  M: u32,
  N: u32,
  K: u32,
  batchCount: u32,
  mode: u32,
  pad0: u32,
  pad1: u32,
  pad2: u32,
};

@group(0) @binding(0) var<storage, read> bufA: array<f32>;
@group(0) @binding(1) var<storage, read> bufB: array<f32>;
@group(0) @binding(2) var<storage, read_write> bufC: array<f32>;
@group(0) @binding(3) var<uniform> uniforms: BatchedMatmulUniforms;

var<workgroup> tileA: array<array<f32, 16>, 16>;
var<workgroup> tileB: array<array<f32, 16>, 16>;

@compute @workgroup_size(16, 16, 1)
fn main(
  @builtin(global_invocation_id) global_id: vec3<u32>,
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) group_id: vec3<u32>
) {
  let z = group_id.z;
  if (z >= uniforms.batchCount) {
    return;
  }

  let row = global_id.y;
  let col = global_id.x;
  let lr = local_id.y;
  let lc = local_id.x;

  let M = uniforms.M;
  let N = uniforms.N;
  let K = uniforms.K;
  let mode = uniforms.mode;

  let offsetA = z * M * K;
  let offsetB = z * (select(K * N, N * K, mode == 1u));
  let offsetC = z * M * N;

  let numTiles = (K + 15u) / 16u;
  var acc: f32 = 0.0;

  for (var t: u32 = 0u; t < numTiles; t = t + 1u) {
    let tK_A = t * 16u + lc;
    let tK_B = t * 16u + lr;

    // Load tileA [M, K]
    if (row < M && tK_A < K) {
      tileA[lr][lc] = bufA[offsetA + row * K + tK_A];
    } else {
      tileA[lr][lc] = 0.0;
    }

    // Load tileB
    if (mode == 1u) {
      // B is [N, K], accessing B[col, tK_B]
      if (col < N && tK_B < K) {
        tileB[lr][lc] = bufB[offsetB + col * K + tK_B];
      } else {
        tileB[lr][lc] = 0.0;
      }
    } else {
      // B is [K, N], accessing B[tK_B, col]
      if (tK_B < K && col < N) {
        tileB[lr][lc] = bufB[offsetB + tK_B * N + col];
      } else {
        tileB[lr][lc] = 0.0;
      }
    }

    workgroupBarrier();

    for (var k: u32 = 0u; k < 16u; k = k + 1u) {
      acc = acc + tileA[lr][k] * tileB[k][lc];
    }

    workgroupBarrier();
  }

  if (row < M && col < N) {
    bufC[offsetC + row * N + col] = acc;
  }
}

// matmul.wgsl - 64x64 tiled matrix multiplication with 4x4 register blocking
// Workgroup size: (16, 16, 1) = 256 threads.
// Each thread computes 4x4 = 16 elements in registers.
// Modes:
//   0: C = A @ B      (A: [M, K], B: [K, N] -> C: [M, N])
//   1: C = A @ B^T    (A: [M, K], B: [N, K] -> C: [M, N])
//   2: C = A^T @ B    (A: [K, M], B: [K, N] -> C: [M, N])
// Epilogue: optional bias addition C[r, c] += bias[c]
// Supports optional accumulation: if accumulate == 1, C += acc, else C = acc.
// Supports offsetC for writing directly into flat parameter or gradient buffers.

struct MatmulUniforms {
  M: u32,
  N: u32,
  K: u32,
  mode: u32,
  hasBias: u32,
  accumulate: u32,
  offsetA: u32,
  offsetB: u32,
  offsetBias: u32,
  offsetC: u32,
  pad0: u32,
  pad1: u32,
};

@group(0) @binding(0) var<storage, read> bufA: array<f32>;
@group(0) @binding(1) var<storage, read> bufB: array<f32>;
@group(0) @binding(2) var<storage, read> bufBias: array<f32>;
@group(0) @binding(3) var<storage, read_write> bufC: array<f32>;
@group(0) @binding(4) var<uniform> uniforms: MatmulUniforms;

var<workgroup> tileA: array<array<f32, 16>, 64>;
var<workgroup> tileB: array<array<f32, 64>, 16>;

@compute @workgroup_size(16, 16, 1)
fn main(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) group_id: vec3<u32>
) {
  let lr = local_id.y;
  let lc = local_id.x;

  let baseRow = group_id.y * 64u;
  let baseCol = group_id.x * 64u;

  let row0 = baseRow + lr;
  let row1 = row0 + 16u;
  let row2 = row0 + 32u;
  let row3 = row0 + 48u;

  let col0 = baseCol + lc;
  let col1 = col0 + 16u;
  let col2 = col0 + 32u;
  let col3 = col0 + 48u;

  let M = uniforms.M;
  let N = uniforms.N;
  let K = uniforms.K;
  let mode = uniforms.mode;

  let numTiles = (K + 15u) / 16u;

  var acc00: f32 = 0.0; var acc01: f32 = 0.0; var acc02: f32 = 0.0; var acc03: f32 = 0.0;
  var acc10: f32 = 0.0; var acc11: f32 = 0.0; var acc12: f32 = 0.0; var acc13: f32 = 0.0;
  var acc20: f32 = 0.0; var acc21: f32 = 0.0; var acc22: f32 = 0.0; var acc23: f32 = 0.0;
  var acc30: f32 = 0.0; var acc31: f32 = 0.0; var acc32: f32 = 0.0; var acc33: f32 = 0.0;

  for (var t: u32 = 0u; t < numTiles; t = t + 1u) {
    let tK_A = t * 16u + lc;
    let tK_B = t * 16u + lr;

    // Load tileA (64 rows x 16 cols): thread (lr, lc) loads 4 rows
    if (mode == 2u) {
      if (tK_A < K && row0 < M) { tileA[lr][lc] = bufA[uniforms.offsetA + tK_A * M + row0]; } else { tileA[lr][lc] = 0.0; }
      if (tK_A < K && row1 < M) { tileA[lr + 16u][lc] = bufA[uniforms.offsetA + tK_A * M + row1]; } else { tileA[lr + 16u][lc] = 0.0; }
      if (tK_A < K && row2 < M) { tileA[lr + 32u][lc] = bufA[uniforms.offsetA + tK_A * M + row2]; } else { tileA[lr + 32u][lc] = 0.0; }
      if (tK_A < K && row3 < M) { tileA[lr + 48u][lc] = bufA[uniforms.offsetA + tK_A * M + row3]; } else { tileA[lr + 48u][lc] = 0.0; }
    } else {
      if (row0 < M && tK_A < K) { tileA[lr][lc] = bufA[uniforms.offsetA + row0 * K + tK_A]; } else { tileA[lr][lc] = 0.0; }
      if (row1 < M && tK_A < K) { tileA[lr + 16u][lc] = bufA[uniforms.offsetA + row1 * K + tK_A]; } else { tileA[lr + 16u][lc] = 0.0; }
      if (row2 < M && tK_A < K) { tileA[lr + 32u][lc] = bufA[uniforms.offsetA + row2 * K + tK_A]; } else { tileA[lr + 32u][lc] = 0.0; }
      if (row3 < M && tK_A < K) { tileA[lr + 48u][lc] = bufA[uniforms.offsetA + row3 * K + tK_A]; } else { tileA[lr + 48u][lc] = 0.0; }
    }

    // Load tileB (16 rows x 64 cols): thread (lr, lc) loads 4 cols
    if (mode == 1u) {
      if (col0 < N && tK_B < K) { tileB[lr][lc] = bufB[uniforms.offsetB + col0 * K + tK_B]; } else { tileB[lr][lc] = 0.0; }
      if (col1 < N && tK_B < K) { tileB[lr][lc + 16u] = bufB[uniforms.offsetB + col1 * K + tK_B]; } else { tileB[lr][lc + 16u] = 0.0; }
      if (col2 < N && tK_B < K) { tileB[lr][lc + 32u] = bufB[uniforms.offsetB + col2 * K + tK_B]; } else { tileB[lr][lc + 32u] = 0.0; }
      if (col3 < N && tK_B < K) { tileB[lr][lc + 48u] = bufB[uniforms.offsetB + col3 * K + tK_B]; } else { tileB[lr][lc + 48u] = 0.0; }
    } else {
      if (tK_B < K && col0 < N) { tileB[lr][lc] = bufB[uniforms.offsetB + tK_B * N + col0]; } else { tileB[lr][lc] = 0.0; }
      if (tK_B < K && col1 < N) { tileB[lr][lc + 16u] = bufB[uniforms.offsetB + tK_B * N + col1]; } else { tileB[lr][lc + 16u] = 0.0; }
      if (tK_B < K && col2 < N) { tileB[lr][lc + 32u] = bufB[uniforms.offsetB + tK_B * N + col2]; } else { tileB[lr][lc + 32u] = 0.0; }
      if (tK_B < K && col3 < N) { tileB[lr][lc + 48u] = bufB[uniforms.offsetB + tK_B * N + col3]; } else { tileB[lr][lc + 48u] = 0.0; }
    }

    workgroupBarrier();

    for (var k: u32 = 0u; k < 16u; k = k + 1u) {
      let a0 = tileA[lr][k];
      let a1 = tileA[lr + 16u][k];
      let a2 = tileA[lr + 32u][k];
      let a3 = tileA[lr + 48u][k];

      let b0 = tileB[k][lc];
      let b1 = tileB[k][lc + 16u];
      let b2 = tileB[k][lc + 32u];
      let b3 = tileB[k][lc + 48u];

      acc00 = acc00 + a0 * b0; acc01 = acc01 + a0 * b1; acc02 = acc02 + a0 * b2; acc03 = acc03 + a0 * b3;
      acc10 = acc10 + a1 * b0; acc11 = acc11 + a1 * b1; acc12 = acc12 + a1 * b2; acc13 = acc13 + a1 * b3;
      acc20 = acc20 + a2 * b0; acc21 = acc21 + a2 * b1; acc22 = acc22 + a2 * b2; acc23 = acc23 + a2 * b3;
      acc30 = acc30 + a3 * b0; acc31 = acc31 + a3 * b1; acc32 = acc32 + a3 * b2; acc33 = acc33 + a3 * b3;
    }

    workgroupBarrier();
  }

  let hasBias = uniforms.hasBias;
  let accFlag = uniforms.accumulate;
  let offsetBias = uniforms.offsetBias;
  let offsetC = uniforms.offsetC;

  // Row 0
  if (row0 < M && col0 < N) {
    var v = acc00; if (hasBias == 1u) { v = v + bufBias[offsetBias + col0]; }
    let idx = offsetC + row0 * N + col0;
    if (accFlag == 1u) { bufC[idx] = bufC[idx] + v; } else { bufC[idx] = v; }
  }
  if (row0 < M && col1 < N) {
    var v = acc01; if (hasBias == 1u) { v = v + bufBias[offsetBias + col1]; }
    let idx = offsetC + row0 * N + col1;
    if (accFlag == 1u) { bufC[idx] = bufC[idx] + v; } else { bufC[idx] = v; }
  }
  if (row0 < M && col2 < N) {
    var v = acc02; if (hasBias == 1u) { v = v + bufBias[offsetBias + col2]; }
    let idx = offsetC + row0 * N + col2;
    if (accFlag == 1u) { bufC[idx] = bufC[idx] + v; } else { bufC[idx] = v; }
  }
  if (row0 < M && col3 < N) {
    var v = acc03; if (hasBias == 1u) { v = v + bufBias[offsetBias + col3]; }
    let idx = offsetC + row0 * N + col3;
    if (accFlag == 1u) { bufC[idx] = bufC[idx] + v; } else { bufC[idx] = v; }
  }

  // Row 1
  if (row1 < M && col0 < N) {
    var v = acc10; if (hasBias == 1u) { v = v + bufBias[offsetBias + col0]; }
    let idx = offsetC + row1 * N + col0;
    if (accFlag == 1u) { bufC[idx] = bufC[idx] + v; } else { bufC[idx] = v; }
  }
  if (row1 < M && col1 < N) {
    var v = acc11; if (hasBias == 1u) { v = v + bufBias[offsetBias + col1]; }
    let idx = offsetC + row1 * N + col1;
    if (accFlag == 1u) { bufC[idx] = bufC[idx] + v; } else { bufC[idx] = v; }
  }
  if (row1 < M && col2 < N) {
    var v = acc12; if (hasBias == 1u) { v = v + bufBias[offsetBias + col2]; }
    let idx = offsetC + row1 * N + col2;
    if (accFlag == 1u) { bufC[idx] = bufC[idx] + v; } else { bufC[idx] = v; }
  }
  if (row1 < M && col3 < N) {
    var v = acc13; if (hasBias == 1u) { v = v + bufBias[offsetBias + col3]; }
    let idx = offsetC + row1 * N + col3;
    if (accFlag == 1u) { bufC[idx] = bufC[idx] + v; } else { bufC[idx] = v; }
  }

  // Row 2
  if (row2 < M && col0 < N) {
    var v = acc20; if (hasBias == 1u) { v = v + bufBias[offsetBias + col0]; }
    let idx = offsetC + row2 * N + col0;
    if (accFlag == 1u) { bufC[idx] = bufC[idx] + v; } else { bufC[idx] = v; }
  }
  if (row2 < M && col1 < N) {
    var v = acc21; if (hasBias == 1u) { v = v + bufBias[offsetBias + col1]; }
    let idx = offsetC + row2 * N + col1;
    if (accFlag == 1u) { bufC[idx] = bufC[idx] + v; } else { bufC[idx] = v; }
  }
  if (row2 < M && col2 < N) {
    var v = acc22; if (hasBias == 1u) { v = v + bufBias[offsetBias + col2]; }
    let idx = offsetC + row2 * N + col2;
    if (accFlag == 1u) { bufC[idx] = bufC[idx] + v; } else { bufC[idx] = v; }
  }
  if (row2 < M && col3 < N) {
    var v = acc23; if (hasBias == 1u) { v = v + bufBias[offsetBias + col3]; }
    let idx = offsetC + row2 * N + col3;
    if (accFlag == 1u) { bufC[idx] = bufC[idx] + v; } else { bufC[idx] = v; }
  }

  // Row 3
  if (row3 < M && col0 < N) {
    var v = acc30; if (hasBias == 1u) { v = v + bufBias[offsetBias + col0]; }
    let idx = offsetC + row3 * N + col0;
    if (accFlag == 1u) { bufC[idx] = bufC[idx] + v; } else { bufC[idx] = v; }
  }
  if (row3 < M && col1 < N) {
    var v = acc31; if (hasBias == 1u) { v = v + bufBias[offsetBias + col1]; }
    let idx = offsetC + row3 * N + col1;
    if (accFlag == 1u) { bufC[idx] = bufC[idx] + v; } else { bufC[idx] = v; }
  }
  if (row3 < M && col2 < N) {
    var v = acc32; if (hasBias == 1u) { v = v + bufBias[offsetBias + col2]; }
    let idx = offsetC + row3 * N + col2;
    if (accFlag == 1u) { bufC[idx] = bufC[idx] + v; } else { bufC[idx] = v; }
  }
  if (row3 < M && col3 < N) {
    var v = acc33; if (hasBias == 1u) { v = v + bufBias[offsetBias + col3]; }
    let idx = offsetC + row3 * N + col3;
    if (accFlag == 1u) { bufC[idx] = bufC[idx] + v; } else { bufC[idx] = v; }
  }
}

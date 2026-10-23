// causal_attention.wgsl - Causal Attention Scoring + Causal Softmax per row
// Computes P[b, h, i, j] = softmax(Q_i @ K_j^T / sqrt(headDim)) with causal mask (j <= i)
// Output: P of shape [B, H, T, T]

struct AttentionUniforms {
  B: u32,
  H: u32,
  T: u32,
  headDim: u32,
  scale: f32, // 1.0 / sqrt(headDim)
  pad0: u32,
  pad1: u32,
  pad2: u32,
};

@group(0) @binding(0) var<storage, read> Q: array<f32>;
@group(0) @binding(1) var<storage, read> K: array<f32>;
@group(0) @binding(2) var<storage, read_write> P: array<f32>;
@group(0) @binding(3) var<uniform> uniforms: AttentionUniforms;

var<workgroup> sdata: array<f32, 256>;
var<workgroup> s_Q: array<f32, 64>;
var<workgroup> rowMax: f32;
var<workgroup> rowSum: f32;

@compute @workgroup_size(256, 1, 1)
fn main(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) group_id: vec3<u32>
) {
  let rowIdx = group_id.x; // row in [0, B * H * T - 1]
  let B = uniforms.B;
  let H = uniforms.H;
  let T = uniforms.T;
  let headDim = uniforms.headDim;
  let D = H * headDim;

  let totalRows = B * H * T;
  if (rowIdx >= totalRows) {
    return;
  }

  let i = rowIdx % T; // token query position in sequence [0, T-1]
  let bh = rowIdx / T;
  let h = bh % H;     // head index [0, H-1]
  let b = bh / H;     // batch index [0, B-1]

  let j = local_id.x; // key position [0, 255]
  let pRowOffset = b * (H * T * T) + h * (T * T) + i * T;
  let qOffset = (b * T + i) * D + h * headDim;

  // Stash Q row in workgroup shared memory
  if (j < headDim) {
    s_Q[j] = Q[qOffset + j];
  }
  workgroupBarrier();

  // 1. Compute dot product Q_i @ K_j / sqrt(headDim) for j <= i
  var score: f32 = -1e9;
  if (j < T && j <= i) {
    let kOffset = (b * T + j) * D + h * headDim;
    var dot: f32 = 0.0;
    for (var d: u32 = 0u; d < headDim; d = d + 1u) {
      dot = dot + s_Q[d] * K[kOffset + d];
    }
    score = dot * uniforms.scale;
  }
  sdata[j] = score;
  workgroupBarrier();

  // 2. Reduce to find max score for j <= i
  for (var s: u32 = 128u; s > 0u; s = s >> 1u) {
    if (j < s) {
      sdata[j] = max(sdata[j], sdata[j + s]);
    }
    workgroupBarrier();
  }

  if (j == 0u) {
    rowMax = sdata[0];
  }
  workgroupBarrier();

  // 3. Compute exp(score - max) and sum
  var expVal: f32 = 0.0;
  if (j < T) {
    if (j <= i) {
      expVal = exp(score - rowMax);
    } else {
      expVal = 0.0; // Strictly 0 for masked positions
    }
  }
  sdata[j] = expVal;
  workgroupBarrier();

  for (var s: u32 = 128u; s > 0u; s = s >> 1u) {
    if (j < s) {
      sdata[j] = sdata[j] + sdata[j + s];
    }
    workgroupBarrier();
  }

  if (j == 0u) {
    rowSum = sdata[0];
  }
  workgroupBarrier();

  // 4. Normalize and write to P
  if (j < T) {
    let invSum = select(0.0, 1.0 / rowSum, rowSum > 0.0);
    let pVal = expVal * invSum;
    P[pRowOffset + j] = pVal;
  }
}

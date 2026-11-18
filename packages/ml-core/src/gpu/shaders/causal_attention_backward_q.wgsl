// causal_attention_backward_q.wgsl
// Computes dP, dS, and dQ for row i of attention head (b, h):
// 1. dP[i, j] = dO[i] . V[j] (for j <= i)
// 2. dotSum_i = sum_{j <= i} dP[i, j] * P[i, j]
// 3. dS[i, j] = P[i, j] * (dP[i, j] - dotSum_i) * scale (for j <= i, 0 for j > i)
// 4. dQ[i, d] = sum_{j <= i} dS[i, j] * K[j, d]

struct AttentionBackwardUniforms {
  B: u32,       // Batch size
  H: u32,       // Number of heads
  T: u32,       // Sequence length
  headDim: u32, // Head dimension
  scale: f32,   // 1.0 / sqrt(headDim)
  pad0: u32,
  pad1: u32,
  pad2: u32,
};

@group(0) @binding(0) var<storage, read> dO: array<f32>;
@group(0) @binding(1) var<storage, read> P: array<f32>;
@group(0) @binding(2) var<storage, read> K: array<f32>;
@group(0) @binding(3) var<storage, read> V: array<f32>;
@group(0) @binding(4) var<storage, read_write> dS: array<f32>;
@group(0) @binding(5) var<storage, read_write> dQ: array<f32>;
@group(0) @binding(6) var<uniform> uniforms: AttentionBackwardUniforms;

var<workgroup> sdata: array<f32, 256>;
var<workgroup> s_dO: array<f32, 64>;
var<workgroup> s_dP: array<f32, 256>;
var<workgroup> s_dS: array<f32, 256>;
var<workgroup> rowDotSum: f32;

@compute @workgroup_size(256, 1, 1)
fn main(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) group_id: vec3<u32>
) {
  let workgroupId = group_id.x;
  let B = uniforms.B;
  let H = uniforms.H;
  let T = uniforms.T;
  let headDim = uniforms.headDim;
  let D = H * headDim;

  let totalRows = B * H * T;
  if (workgroupId >= totalRows) {
    return;
  }

  let i = workgroupId % T;
  let bh = workgroupId / T;
  let h = bh % H;
  let b = bh / H;

  let tid = local_id.x;

  let bOffsetD = b * T * D;
  let bOffsetAttn = b * H * T * T;
  let hOffsetAttn = bOffsetAttn + h * T * T;
  let hDimOffset = h * headDim;

  let outOffset = bOffsetD + i * D + hDimOffset;
  let iAttnRow = hOffsetAttn + i * T;

  // Stash dO in workgroup shared memory
  if (tid < headDim) {
    s_dO[tid] = dO[outOffset + tid];
  }
  workgroupBarrier();

  // 1. Compute dP[i, j] and local contribution to dotSum
  var localSum: f32 = 0.0;
  var j: u32 = tid;
  while (j < T) {
    if (j <= i) {
      let vOffset = bOffsetD + j * D + hDimOffset;
      var dot: f32 = 0.0;
      for (var d: u32 = 0u; d < headDim; d = d + 1u) {
        dot = dot + s_dO[d] * V[vOffset + d];
      }
      if (j < 256u) {
        s_dP[j] = dot;
      }
      let p_ij = P[iAttnRow + j];
      localSum = localSum + dot * p_ij;
    } else {
      if (j < 256u) {
        s_dP[j] = 0.0;
      }
    }
    j = j + 256u;
  }

  sdata[tid] = localSum;
  workgroupBarrier();

  // Workgroup reduction for dotSum
  for (var s: u32 = 128u; s > 0u; s = s >> 1u) {
    if (tid < s) {
      sdata[tid] = sdata[tid] + sdata[tid + s];
    }
    workgroupBarrier();
  }

  if (tid == 0u) {
    rowDotSum = sdata[0];
  }
  workgroupBarrier();

  let dotSum = rowDotSum;
  let scale = uniforms.scale;

  // 2. Compute dS[i, j] from cached dP without recomputing dot product
  j = tid;
  while (j < T) {
    let attnIdx = iAttnRow + j;
    if (j <= i) {
      var dP_ij: f32 = 0.0;
      if (j < 256u) {
        dP_ij = s_dP[j];
      } else {
        let vOffset = bOffsetD + j * D + hDimOffset;
        for (var d: u32 = 0u; d < headDim; d = d + 1u) {
          dP_ij = dP_ij + s_dO[d] * V[vOffset + d];
        }
      }
      let p_ij = P[attnIdx];
      let ds = p_ij * (dP_ij - dotSum) * scale;
      dS[attnIdx] = ds;
      if (j < 256u) {
        s_dS[j] = ds;
      }
    } else {
      dS[attnIdx] = 0.0;
      if (j < 256u) {
        s_dS[j] = 0.0;
      }
    }
    j = j + 256u;
  }
  workgroupBarrier();

  // 3. Compute dQ[i, d] = sum_{col <= i} dS[i, col] * K[col, d]
  if (tid < headDim) {
    let d = tid;
    var sumQ: f32 = 0.0;
    for (var col: u32 = 0u; col <= i; col = col + 1u) {
      let kOffset = bOffsetD + col * D + hDimOffset;
      var ds: f32 = 0.0;
      if (col < 256u) {
        ds = s_dS[col];
      } else {
        ds = dS[iAttnRow + col];
      }
      sumQ = sumQ + ds * K[kOffset + d];
    }
    let qOffset = bOffsetD + i * D + hDimOffset;
    dQ[qOffset + d] = sumQ;
  }
}

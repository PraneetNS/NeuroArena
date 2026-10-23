// causal_attention_backward_kv.wgsl
// Computes dK and dV for position j of attention head (b, h):
// dK[j, d] = sum_{i = j}^{T-1} dS[i, j] * Q[i, d]
// dV[j, d] = sum_{i = j}^{T-1} P[i, j] * dO[i, d]

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
@group(0) @binding(2) var<storage, read> Q: array<f32>;
@group(0) @binding(3) var<storage, read> dS: array<f32>;
@group(0) @binding(4) var<storage, read_write> dK: array<f32>;
@group(0) @binding(5) var<storage, read_write> dV: array<f32>;
@group(0) @binding(6) var<uniform> uniforms: AttentionBackwardUniforms;

@compute @workgroup_size(32, 1, 1)
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

  let totalCols = B * H * T;
  if (workgroupId >= totalCols) {
    return;
  }

  let j = workgroupId % T;
  let bh = workgroupId / T;
  let h = bh % H;
  let b = bh / H;

  let tid = local_id.x;

  let bOffsetD = b * T * D;
  let bOffsetAttn = b * H * T * T;
  let hOffsetAttn = bOffsetAttn + h * T * T;
  let hDimOffset = h * headDim;

  let kOffset = bOffsetD + j * D + hDimOffset;

  var d: u32 = tid;
  while (d < headDim) {
    var sumK: f32 = 0.0;
    var sumV: f32 = 0.0;

    for (var row: u32 = j; row < T; row = row + 1u) {
      let attnIdx = hOffsetAttn + row * T + j;
      let qRowOffset = bOffsetD + row * D + hDimOffset + d;
      let dORowOffset = bOffsetD + row * D + hDimOffset + d;

      sumK = sumK + dS[attnIdx] * Q[qRowOffset];
      sumV = sumV + P[attnIdx] * dO[dORowOffset];
    }

    dK[kOffset + d] = sumK;
    dV[kOffset + d] = sumV;
    d = d + 32u;
  }
}


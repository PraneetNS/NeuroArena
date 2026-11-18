// attention_value.wgsl - Attention Value multiplication: attnOut = P @ V
// P: [B, H, T, T]
// V: [B * T, D] where D = H * headDim
// Output: [B * T, D]

struct AttentionUniforms {
  B: u32,
  H: u32,
  T: u32,
  headDim: u32,
  scale: f32,
  pad0: u32,
  pad1: u32,
  pad2: u32,
};

@group(0) @binding(0) var<storage, read> P: array<f32>;
@group(0) @binding(1) var<storage, read> V: array<f32>;
@group(0) @binding(2) var<storage, read_write> outAttn: array<f32>;
@group(0) @binding(3) var<uniform> uniforms: AttentionUniforms;

@compute @workgroup_size(32, 1, 1)
fn main(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) group_id: vec3<u32>
) {
  let rowIdx = group_id.x; // in [0, B * H * T - 1]
  let B = uniforms.B;
  let H = uniforms.H;
  let T = uniforms.T;
  let headDim = uniforms.headDim;
  let D = H * headDim;

  let totalRows = B * H * T;
  if (rowIdx >= totalRows) {
    return;
  }

  let i = rowIdx % T; // query position [0, T-1]
  let bh = rowIdx / T;
  let h = bh % H;     // head [0, H-1]
  let b = bh / H;     // batch [0, B-1]

  let tid = local_id.x;
  let pRowOffset = b * (H * T * T) + h * (T * T) + i * T;
  let outBase = (b * T + i) * D + h * headDim;

  var d: u32 = tid;
  while (d < headDim) {
    var acc: f32 = 0.0;
    for (var j: u32 = 0u; j <= i; j = j + 1u) {
      let pVal = P[pRowOffset + j];
      let vVal = V[(b * T + j) * D + h * headDim + d];
      acc = acc + pVal * vVal;
    }
    outAttn[outBase + d] = acc;
    d = d + 32u;
  }
}

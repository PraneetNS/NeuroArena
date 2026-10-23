// position_embedding_backward.wgsl - Direct reduction for posEmb gradient without atomics
struct PosEmbBackwardUniforms {
  B: u32,            // Batch size
  T: u32,            // Sequence length
  D: u32,            // Hidden dimension (dModel)
  posEmbOffset: u32, // Offset in grads buffer
};

@group(0) @binding(0) var<storage, read> dCurr: array<f32>;
@group(0) @binding(1) var<storage, read_write> grads: array<f32>;
@group(0) @binding(2) var<uniform> uniforms: PosEmbBackwardUniforms;

@compute @workgroup_size(256, 1, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let idx = global_id.x;
  let total = uniforms.T * uniforms.D;
  if (idx >= total) {
    return;
  }

  let t = idx / uniforms.D;
  let d = idx % uniforms.D;
  let B = uniforms.B;
  let T = uniforms.T;
  let D = uniforms.D;

  var sum: f32 = 0.0;
  for (var b: u32 = 0u; b < B; b = b + 1u) {
    let offset = (b * T + t) * D + d;
    sum = sum + dCurr[offset];
  }

  let destIdx = uniforms.posEmbOffset + idx;
  grads[destIdx] = grads[destIdx] + sum;
}

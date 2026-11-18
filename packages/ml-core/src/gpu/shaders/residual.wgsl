// residual.wgsl - Elementwise Residual Add: out = A + B

struct ResidualUniforms {
  totalElements: u32,
  pad0: u32,
  pad1: u32,
  pad2: u32,
};

@group(0) @binding(0) var<storage, read> inA: array<f32>;
@group(0) @binding(1) var<storage, read> inB: array<f32>;
@group(0) @binding(2) var<storage, read_write> outSum: array<f32>;
@group(0) @binding(3) var<uniform> uniforms: ResidualUniforms;

@compute @workgroup_size(256, 1, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let idx = global_id.x;
  if (idx >= uniforms.totalElements) {
    return;
  }
  outSum[idx] = inA[idx] + inB[idx];
}

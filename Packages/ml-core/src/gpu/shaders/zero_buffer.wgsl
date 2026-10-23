// zero_buffer.wgsl - Fast parallel zeroing of storage buffer

struct ZeroBufferUniforms {
  count: u32,
  pad0: u32,
  pad1: u32,
  pad2: u32,
};

@group(0) @binding(0) var<storage, read_write> buf: array<f32>;
@group(0) @binding(1) var<uniform> uniforms: ZeroBufferUniforms;

@compute @workgroup_size(256, 1, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let idx = global_id.x;
  if (idx < uniforms.count) {
    buf[idx] = 0.0;
  }
}

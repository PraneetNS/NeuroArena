// gelu.wgsl - Elementwise GELU (tanh approximation)
// y = 0.5 * x * (1.0 + tanh(sqrt(2/pi) * (x + 0.044715 * x^3)))

struct GeluUniforms {
  totalElements: u32,
  pad0: u32,
  pad1: u32,
  pad2: u32,
};

@group(0) @binding(0) var<storage, read> inX: array<f32>;
@group(0) @binding(1) var<storage, read_write> outY: array<f32>;
@group(0) @binding(2) var<uniform> uniforms: GeluUniforms;

const SQRT_2_OVER_PI: f32 = 0.7978845608028654;
const COEFF: f32 = 0.044715;

@compute @workgroup_size(256, 1, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let idx = global_id.x;
  if (idx >= uniforms.totalElements) {
    return;
  }

  let x = inX[idx];
  let x3 = x * x * x;
  let inner = SQRT_2_OVER_PI * (x + COEFF * x3);
  let y = 0.5 * x * (1.0 + tanh(inner));
  outY[idx] = y;
}

// gelu_backward.wgsl - GELU activation backward pass (tanh approximation)
// dX = dY * [ 0.5 * (1 + tanh(u)) + 0.5 * x * sech^2(u) * du ]
// where u = sqrt(2/pi) * (x + 0.044715 * x^3)

const SQRT_2_OVER_PI: f32 = 0.7978845608028654;

struct GeluBackwardUniforms {
  count: u32,
  pad0: u32,
  pad1: u32,
  pad2: u32,
};

@group(0) @binding(0) var<storage, read> dY: array<f32>;
@group(0) @binding(1) var<storage, read> inX: array<f32>;
@group(0) @binding(2) var<storage, read_write> dX: array<f32>;
@group(0) @binding(3) var<uniform> uniforms: GeluBackwardUniforms;

@compute @workgroup_size(256, 1, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let idx = global_id.x;
  if (idx >= uniforms.count) {
    return;
  }

  let x = inX[idx];
  let x2 = x * x;
  let x3 = x2 * x;
  let inner = SQRT_2_OVER_PI * (x + 0.044715 * x3);
  let tanhVal = tanh(inner);
  let sech2 = 1.0 - tanhVal * tanhVal;
  let dInner = SQRT_2_OVER_PI * (1.0 + 3.0 * 0.044715 * x2);
  let grad = 0.5 * (1.0 + tanhVal) + 0.5 * x * sech2 * dInner;

  dX[idx] = dY[idx] * grad;
}

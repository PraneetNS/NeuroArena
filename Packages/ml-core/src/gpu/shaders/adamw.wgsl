// adamw.wgsl - Fused in-place AdamW optimizer kernel with GPU gradient clipping & decoupled weight decay

struct AdamWUniforms {
  lr: f32,
  beta1: f32,
  beta2: f32,
  eps: f32,
  weightDecay: f32,
  bc1Inv: f32,
  bc2Inv: f32,
  totalParams: u32,
};

@group(0) @binding(0) var<storage, read_write> params: array<f32>;
@group(0) @binding(1) var<storage, read> grads: array<f32>;
@group(0) @binding(2) var<storage, read_write> m: array<f32>;
@group(0) @binding(3) var<storage, read_write> v: array<f32>;
@group(0) @binding(4) var<storage, read> decayMask: array<u32>;
@group(0) @binding(5) var<storage, read> normClip: array<f32>; // [0]=globalNorm, [1]=clipScale
@group(0) @binding(6) var<uniform> uniforms: AdamWUniforms;

@compute @workgroup_size(256, 1, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let idx = global_id.x;
  if (idx >= uniforms.totalParams) {
    return;
  }

  // 1. Read gradient and apply global gradient clipping scale computed on GPU
  let clipScale = normClip[1];
  let g = grads[idx] * clipScale;

  // 2. Decoupled weight decay (only applied when decayMask[idx] == 1)
  var p = params[idx];
  let applyDecay = decayMask[idx];
  if (applyDecay == 1u && uniforms.weightDecay > 0.0) {
    p = p - uniforms.lr * uniforms.weightDecay * p;
  }

  // 3. Momentum & second moment updates
  let beta1 = uniforms.beta1;
  let beta2 = uniforms.beta2;
  let m_val = beta1 * m[idx] + (1.0 - beta1) * g;
  let v_val = beta2 * v[idx] + (1.0 - beta2) * g * g;
  m[idx] = m_val;
  v[idx] = v_val;

  // 4. Bias corrections
  let mHat = m_val * uniforms.bc1Inv;
  let vHat = v_val * uniforms.bc2Inv;

  // 5. In-place parameter update
  let denom = sqrt(max(0.0, vHat)) + 1e-5;
  p = p - (uniforms.lr * mHat) / denom;
  params[idx] = p;
}

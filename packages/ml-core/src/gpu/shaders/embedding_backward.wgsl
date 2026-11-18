// embedding_backward.wgsl - Scatter-add gradient into tokEmb and posEmb using atomic compare-exchange weak loop
// dTokEmb[ids[m], d] += dCurr[m, d]
// dPosEmb[t, d]      += dCurr[m, d]

struct EmbeddingBackwardUniforms {
  M: u32,            // Total tokens (B * T)
  T: u32,            // Sequence length
  D: u32,            // Hidden dimension (dModel)
  tokEmbOffset: u32, // Offset of tokEmb in grads buffer
  posEmbOffset: u32, // Offset of posEmb in grads buffer
  pad0: u32,
  pad1: u32,
  pad2: u32,
};

@group(0) @binding(0) var<storage, read> dCurr: array<f32>;
@group(0) @binding(1) var<storage, read> inputIds: array<u32>;
@group(0) @binding(2) var<storage, read_write> grads: array<atomic<u32>>;
@group(0) @binding(3) var<uniform> uniforms: EmbeddingBackwardUniforms;

fn atomicAddFloat(index: u32, val: f32) {
  var oldVal = atomicLoad(&grads[index]);
  loop {
    let fVal = bitcast<f32>(oldVal);
    let newVal = bitcast<u32>(fVal + val);
    let res = atomicCompareExchangeWeak(&grads[index], oldVal, newVal);
    if (res.exchanged) {
      break;
    }
    oldVal = res.old_value;
  }
}

@compute @workgroup_size(256, 1, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let idx = global_id.x;
  let M = uniforms.M;
  let D = uniforms.D;
  let T = uniforms.T;
  let total = M * D;

  if (idx >= total) {
    return;
  }

  let m = idx / D;
  let d = idx % D;
  let t = m % T;
  let tok = inputIds[m];

  let g = dCurr[idx];

  // Accumulate token embedding gradient
  let tokIdx = uniforms.tokEmbOffset + tok * D + d;
  atomicAddFloat(tokIdx, g);
}


// embedding.wgsl - Embedding Gather + Positional Add

struct EmbeddingUniforms {
  M: u32,            // Total tokens: B * T
  T: u32,            // Sequence length
  D: u32,            // Hidden dimension (dModel)
  tokEmbOffset: u32, // Offset of tokEmb in params buffer
  posEmbOffset: u32, // Offset of posEmb in params buffer
  pad0: u32,
  pad1: u32,
  pad2: u32,
};

@group(0) @binding(0) var<storage, read> params: array<f32>;
@group(0) @binding(1) var<storage, read> ids: array<u32>;
@group(0) @binding(2) var<storage, read_write> outEmbeddings: array<f32>;
@group(0) @binding(3) var<uniform> uniforms: EmbeddingUniforms;

@compute @workgroup_size(256, 1, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let idx = global_id.x;
  let total = uniforms.M * uniforms.D;
  if (idx >= total) {
    return;
  }

  let m = idx / uniforms.D;
  let d = idx % uniforms.D;
  let t = m % uniforms.T;

  let tokId = ids[m];
  let tokVal = params[uniforms.tokEmbOffset + tokId * uniforms.D + d];
  let posVal = params[uniforms.posEmbOffset + t * uniforms.D + d];

  outEmbeddings[idx] = tokVal + posVal;
}

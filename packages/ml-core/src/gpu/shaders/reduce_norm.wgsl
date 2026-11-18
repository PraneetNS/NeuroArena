// reduce_norm.wgsl - Reduces partial norm sums to global norm and computes clipScale on the GPU

struct ReduceNormUniforms {
  numPartials: u32,
  maxGradNorm: f32,
  pad0: u32,
  pad1: u32,
};

@group(0) @binding(0) var<storage, read> partialNorms: array<f32>;
@group(0) @binding(1) var<storage, read_write> outNormClip: array<f32>; // [0]=globalNorm, [1]=clipScale
@group(0) @binding(2) var<uniform> uniforms: ReduceNormUniforms;

var<workgroup> sdata: array<f32, 256>;

@compute @workgroup_size(256, 1, 1)
fn main(@builtin(local_invocation_id) local_id: vec3<u32>) {
  let tid = local_id.x;
  let numPartials = uniforms.numPartials;

  var sumSq: f32 = 0.0;
  var i: u32 = tid;
  while (i < numPartials) {
    sumSq = sumSq + partialNorms[i];
    i = i + 256u;
  }

  sdata[tid] = sumSq;
  workgroupBarrier();

  for (var s: u32 = 128u; s > 0u; s = s >> 1u) {
    if (tid < s) {
      sdata[tid] = sdata[tid] + sdata[tid + s];
    }
    workgroupBarrier();
  }

  if (tid == 0u) {
    let totalSumSq = sdata[0];
    let globalNorm = sqrt(totalSumSq);
    var clipScale: f32 = 1.0;
    if (uniforms.maxGradNorm > 0.0 && globalNorm > uniforms.maxGradNorm) {
      clipScale = uniforms.maxGradNorm / (globalNorm + 1e-12);
    }
    outNormClip[0] = globalNorm;
    outNormClip[1] = clipScale;
  }
}

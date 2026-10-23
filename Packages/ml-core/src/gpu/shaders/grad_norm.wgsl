// grad_norm.wgsl - Computes partial sums of squared gradients: sum(g^2)

struct GradNormUniforms {
  totalCount: u32,
  pad0: u32,
  pad1: u32,
  pad2: u32,
};

@group(0) @binding(0) var<storage, read> grads: array<f32>;
@group(0) @binding(1) var<storage, read_write> partialNorms: array<f32>;
@group(0) @binding(2) var<uniform> uniforms: GradNormUniforms;

var<workgroup> sdata: array<f32, 256>;

@compute @workgroup_size(256, 1, 1)
fn main(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) group_id: vec3<u32>,
  @builtin(num_workgroups) num_workgroups: vec3<u32>
) {
  let tid = local_id.x;
  let wid = group_id.x;
  let totalWorkgroups = num_workgroups.x;
  let totalCount = uniforms.totalCount;

  let stride = totalWorkgroups * 256u;
  var idx: u32 = wid * 256u + tid;

  var sumSq: f32 = 0.0;
  while (idx < totalCount) {
    let g = grads[idx];
    sumSq = sumSq + g * g;
    idx = idx + stride;
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
    partialNorms[wid] = sdata[0];
  }
}

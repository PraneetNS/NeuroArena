// reduce_sum.wgsl - Workgroup reduction to compute scalar mean loss

struct ReduceUniforms {
  totalCount: u32,
  pad0: u32,
  pad1: u32,
  pad2: u32,
};

@group(0) @binding(0) var<storage, read> inValues: array<f32>;
@group(0) @binding(1) var<storage, read_write> outScalar: array<f32>;
@group(0) @binding(2) var<uniform> uniforms: ReduceUniforms;

var<workgroup> sdata: array<f32, 256>;

@compute @workgroup_size(256, 1, 1)
fn main(@builtin(local_invocation_id) local_id: vec3<u32>) {
  let tid = local_id.x;
  let count = uniforms.totalCount;

  var sum: f32 = 0.0;
  var i: u32 = tid;
  while (i < count) {
    sum = sum + inValues[i];
    i = i + 256u;
  }
  sdata[tid] = sum;
  workgroupBarrier();

  for (var s: u32 = 128u; s > 0u; s = s >> 1u) {
    if (tid < s) {
      sdata[tid] = sdata[tid] + sdata[tid + s];
    }
    workgroupBarrier();
  }

  if (tid == 0u) {
    let mean = select(0.0, sdata[0] / f32(count), count > 0u);
    outScalar[0] = mean;
  }
}

// bias_backward.wgsl - 2D parallel reduction for column-wise bias gradient accumulation:
// dBias[j] += sum_{m=0}^{M-1} dY[m * N + j]

struct BiasBackwardUniforms {
  M: u32,            // Total tokens (B * T)
  N: u32,            // Channel dimension
  offsetGradBias: u32,// Offset in grads buffer
  pad0: u32,
};

@group(0) @binding(0) var<storage, read> dY: array<f32>;
@group(0) @binding(1) var<storage, read_write> grads: array<f32>;
@group(0) @binding(2) var<uniform> uniforms: BiasBackwardUniforms;

var<workgroup> sdata: array<array<f32, 16>, 16>;

@compute @workgroup_size(16, 16, 1)
fn main(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) group_id: vec3<u32>
) {
  let col = group_id.x * 16u + local_id.x;
  let rowLane = local_id.y;
  let M = uniforms.M;
  let N = uniforms.N;

  var threadSum: f32 = 0.0;
  if (col < N) {
    for (var m: u32 = rowLane; m < M; m = m + 16u) {
      threadSum = threadSum + dY[m * N + col];
    }
  }

  sdata[local_id.x][rowLane] = threadSum;
  workgroupBarrier();

  // Reduce 16 rows down to 1
  if (rowLane < 8u) {
    sdata[local_id.x][rowLane] = sdata[local_id.x][rowLane] + sdata[local_id.x][rowLane + 8u];
  }
  workgroupBarrier();

  if (rowLane < 4u) {
    sdata[local_id.x][rowLane] = sdata[local_id.x][rowLane] + sdata[local_id.x][rowLane + 4u];
  }
  workgroupBarrier();

  if (rowLane < 2u) {
    sdata[local_id.x][rowLane] = sdata[local_id.x][rowLane] + sdata[local_id.x][rowLane + 2u];
  }
  workgroupBarrier();

  if (rowLane == 0u && col < N) {
    let finalColSum = sdata[local_id.x][0] + sdata[local_id.x][1];
    let destIdx = uniforms.offsetGradBias + col;
    grads[destIdx] = grads[destIdx] + finalColSum;
  }
}


// cross_entropy.wgsl - Fused Softmax + Cross-Entropy Loss per row & dlogits calculation
// Computes rowLoss[m] = -ln(p_target)
// Writes dlogits[m, v] = (p_v - onehot) / activeTokens
// Target 0xFFFFFFFFu (-1) indicates ignored/masked token (no loss, zero gradient).

struct CrossEntropyUniforms {
  M: u32,          // Total tokens (B * T)
  V: u32,          // Vocab size
  hasTargets: u32, // 1 if targets buffer present, 0 if inference only
  activeCount: u32, // Count of active unmasked tokens (or M if all active)
};

@group(0) @binding(0) var<storage, read> logits: array<f32>;
@group(0) @binding(1) var<storage, read> targets: array<u32>;
@group(0) @binding(2) var<storage, read_write> rowLoss: array<f32>;
@group(0) @binding(3) var<storage, read_write> dlogits: array<f32>;
@group(0) @binding(4) var<uniform> uniforms: CrossEntropyUniforms;

var<workgroup> sdata: array<f32, 256>;
var<workgroup> rowMax: f32;
var<workgroup> rowSumExp: f32;

@compute @workgroup_size(256, 1, 1)
fn main(
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) group_id: vec3<u32>
) {
  let m = group_id.x;
  if (m >= uniforms.M) {
    return;
  }

  let tid = local_id.x;
  let V = uniforms.V;
  let rowOffset = m * V;

  // Check if this token is masked (target == 0xFFFFFFFFu)
  if (uniforms.hasTargets == 1u) {
    let targetId = targets[m];
    if (targetId == 0xFFFFFFFFu) {
      if (tid == 0u) {
        rowLoss[m] = 0.0;
      }
      var vZero: u32 = tid;
      while (vZero < V) {
        dlogits[rowOffset + vZero] = 0.0;
        vZero = vZero + 256u;
      }
      return;
    }
  }

  // 1. Find max logit in row
  var localMax: f32 = -1e9;
  var v: u32 = tid;
  while (v < V) {
    localMax = max(localMax, logits[rowOffset + v]);
    v = v + 256u;
  }
  sdata[tid] = localMax;
  workgroupBarrier();

  for (var s: u32 = 128u; s > 0u; s = s >> 1u) {
    if (tid < s) {
      sdata[tid] = max(sdata[tid], sdata[tid + s]);
    }
    workgroupBarrier();
  }

  if (tid == 0u) {
    rowMax = sdata[0];
  }
  workgroupBarrier();

  // 2. Compute sum of exp(logits - max)
  let maxVal = rowMax;
  var localSumExp: f32 = 0.0;
  v = tid;
  while (v < V) {
    localSumExp = localSumExp + exp(logits[rowOffset + v] - maxVal);
    v = v + 256u;
  }
  sdata[tid] = localSumExp;
  workgroupBarrier();

  for (var s: u32 = 128u; s > 0u; s = s >> 1u) {
    if (tid < s) {
      sdata[tid] = sdata[tid] + sdata[tid + s];
    }
    workgroupBarrier();
  }

  if (tid == 0u) {
    rowSumExp = sdata[0];
  }
  workgroupBarrier();

  // 3. Loss and dlogits
  let sumExp = rowSumExp;
  let invSumExp = select(0.0, 1.0 / sumExp, sumExp > 0.0);
  let divisor = select(f32(uniforms.M), f32(uniforms.activeCount), uniforms.activeCount > 0u);
  let invTotalTokens = 1.0 / divisor;

  if (uniforms.hasTargets == 1u) {
    let targetId = targets[m];
    if (tid == 0u) {
      let targetLogit = logits[rowOffset + targetId];
      // Loss = -ln(p_target) = ln(sumExp) - (targetLogit - maxVal);
      let loss = log(sumExp) - (targetLogit - maxVal);
      rowLoss[m] = loss;
    }

    // Write dlogits = (p - onehot) / divisor
    v = tid;
    while (v < V) {
      let p_v = exp(logits[rowOffset + v] - maxVal) * invSumExp;
      let onehot = select(0.0, 1.0, v == targetId);
      dlogits[rowOffset + v] = (p_v - onehot) * invTotalTokens;
      v = v + 256u;
    }
  }
}

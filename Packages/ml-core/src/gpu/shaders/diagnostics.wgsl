// WGSL Compute Shaders for Training Diagnostics Instrumentation

struct LayerDiagUniforms {
  paramOffset: u32,
  paramCount: u32,
  actCount: u32,        // M * dModel
  dFF: u32,             // dFF
  M: u32,               // B * T
  T: u32,               // T
  nHeads: u32,          // nHeads
  layerIndex: u32,      // layer index
  layerStride: u32,     // stride in floats for layer struct
  lr: f32,
  clipScale: f32,
  pad: u32
};

struct GlobalDiagUniforms {
  totalParams: u32,
  M: u32,
  vocabSize: u32,
  globalOffset: u32,
  clipScale: f32,
  pad0: u32,
  pad1: u32,
  pad2: u32
};

var<workgroup> s_reduce_0: array<f32, 256>;
var<workgroup> s_reduce_1: array<f32, 256>;

fn is_invalid_float(v: f32) -> bool {
  let b = bitcast<u32>(v);
  let exp = (b >> 23u) & 0xFFu;
  return exp == 0xFFu;
}

// ----------------------------------------------------------------------------
// LAYER REDUCTIONS
// ----------------------------------------------------------------------------
@group(0) @binding(0) var<storage, read> layer_params: array<f32>;
@group(0) @binding(1) var<storage, read> layer_grads: array<f32>;
@group(0) @binding(2) var<storage, read> layer_blockOut: array<f32>;
@group(0) @binding(3) var<storage, read> layer_geluOut: array<f32>;
@group(0) @binding(4) var<storage, read> layer_probs: array<f32>;
@group(0) @binding(5) var<storage, read_write> layer_output: array<f32>;
@group(0) @binding(6) var<uniform> u_layer: LayerDiagUniforms;

@compute @workgroup_size(256)
fn reduce_layer_diagnostics(@builtin(local_invocation_id) local_id: vec3<u32>) {
  let tid = local_id.x;

  // 1. Param Norm Sq & Grad Norm Sq
  var p_sum = 0.0;
  var g_sum = 0.0;
  for (var i = tid; i < u_layer.paramCount; i += 256u) {
    let p = layer_params[u_layer.paramOffset + i];
    let g = layer_grads[u_layer.paramOffset + i];
    p_sum += p * p;
    g_sum += g * g;
  }
  s_reduce_0[tid] = p_sum;
  s_reduce_1[tid] = g_sum;
  workgroupBarrier();

  for (var s = 128u; s > 0u; s >>= 1u) {
    if (tid < s) {
      s_reduce_0[tid] += s_reduce_0[tid + s];
      s_reduce_1[tid] += s_reduce_1[tid + s];
    }
    workgroupBarrier();
  }
  let paramNormSq = s_reduce_0[0];
  let gradNormSq = s_reduce_1[0];
  workgroupBarrier();

  // 2. Activation Mean & Std (Sum and SqSum)
  var a_sum = 0.0;
  var a_sq_sum = 0.0;
  for (var i = tid; i < u_layer.actCount; i += 256u) {
    let a = layer_blockOut[i];
    a_sum += a;
    a_sq_sum += a * a;
  }
  s_reduce_0[tid] = a_sum;
  s_reduce_1[tid] = a_sq_sum;
  workgroupBarrier();

  for (var s = 128u; s > 0u; s >>= 1u) {
    if (tid < s) {
      s_reduce_0[tid] += s_reduce_0[tid + s];
      s_reduce_1[tid] += s_reduce_1[tid + s];
    }
    workgroupBarrier();
  }
  let actSum = s_reduce_0[0];
  let actSqSum = s_reduce_1[0];
  workgroupBarrier();

  // 3. GELU Dead Unit Count (max activation across batch < 1e-3)
  var dead_count = 0.0;
  for (var j = tid; j < u_layer.dFF; j += 256u) {
    var is_dead = true;
    for (var m = 0u; m < u_layer.M; m += 1u) {
      if (abs(layer_geluOut[m * u_layer.dFF + j]) >= 0.001) {
        is_dead = false;
        break;
      }
    }
    if (is_dead) {
      dead_count += 1.0;
    }
  }
  s_reduce_0[tid] = dead_count;
  workgroupBarrier();

  for (var s = 128u; s > 0u; s >>= 1u) {
    if (tid < s) {
      s_reduce_0[tid] += s_reduce_0[tid + s];
    }
    workgroupBarrier();
  }
  let totalDeadCount = s_reduce_0[0];
  workgroupBarrier();

  // 4. Attention Mass (First Token & Current Token)
  let totalRows = u_layer.M * u_layer.nHeads;
  let T = u_layer.T;
  let H = u_layer.nHeads;
  let TT = T * T;

  var first_mass_sum = 0.0;
  var cur_mass_sum = 0.0;

  for (var row = tid; row < totalRows; row += 256u) {
    let b = row / (H * T);
    let rem = row % (H * T);
    let h = rem / T;
    let t = rem % T;

    let rowOffset = (b * H + h) * TT + t * T;
    if (t > 0u) {
      first_mass_sum += layer_probs[rowOffset + 0u];
    }
    cur_mass_sum += layer_probs[rowOffset + t];
  }

  s_reduce_0[tid] = first_mass_sum;
  s_reduce_1[tid] = cur_mass_sum;
  workgroupBarrier();

  for (var s = 128u; s > 0u; s >>= 1u) {
    if (tid < s) {
      s_reduce_0[tid] += s_reduce_0[tid + s];
      s_reduce_1[tid] += s_reduce_1[tid + s];
    }
    workgroupBarrier();
  }
  let finalFirstMass = s_reduce_0[0];
  let finalCurMass = s_reduce_1[0];
  workgroupBarrier();

  // 5. Per-Head Attention Entropy
  let B = u_layer.M / T;
  let BT = B * T;
  for (var h = 0u; h < u_layer.nHeads; h += 1u) {
    var h_entropy = 0.0;
    for (var bt = tid; bt < BT; bt += 256u) {
      let b = bt / T;
      let t = bt % T;
      let rowOffset = (b * H + h) * TT + t * T;
      var row_entropy = 0.0;
      for (var k = 0u; k <= t; k += 1u) {
        let p = layer_probs[rowOffset + k];
        if (p > 1e-9) {
          row_entropy -= p * log(p);
        }
      }
      h_entropy += row_entropy;
    }
    s_reduce_0[tid] = h_entropy;
    workgroupBarrier();

    for (var s = 128u; s > 0u; s >>= 1u) {
      if (tid < s) {
        s_reduce_0[tid] += s_reduce_0[tid + s];
      }
      workgroupBarrier();
    }
    if (tid == 0u) {
      let base = u_layer.layerIndex * u_layer.layerStride;
      layer_output[base + 10u + h] = s_reduce_0[0];
    }
    workgroupBarrier();
  }

  // Thread 0 writes base metrics
  if (tid == 0u) {
    let base = u_layer.layerIndex * u_layer.layerStride;
    layer_output[base + 0u] = paramNormSq;
    layer_output[base + 1u] = gradNormSq;
    layer_output[base + 2u] = actSum;
    layer_output[base + 3u] = actSqSum;
    layer_output[base + 4u] = f32(u_layer.actCount);
    layer_output[base + 5u] = totalDeadCount;
    layer_output[base + 6u] = f32(u_layer.dFF);
    layer_output[base + 7u] = finalFirstMass;
    layer_output[base + 8u] = finalCurMass;
    layer_output[base + 9u] = f32(u_layer.M);
  }
}

// ----------------------------------------------------------------------------
// GLOBAL REDUCTIONS
// ----------------------------------------------------------------------------
@group(0) @binding(0) var<storage, read> global_logits: array<f32>;
@group(0) @binding(1) var<storage, read> global_meanLoss: array<f32>;
@group(0) @binding(2) var<storage, read> global_normClip: array<f32>;
@group(0) @binding(3) var<storage, read> global_params: array<f32>;
@group(0) @binding(4) var<storage, read> global_grads: array<f32>;
@group(0) @binding(5) var<storage, read_write> global_output: array<f32>;
@group(0) @binding(6) var<uniform> u_global: GlobalDiagUniforms;

@compute @workgroup_size(256)
fn reduce_global_diagnostics(@builtin(local_invocation_id) local_id: vec3<u32>) {
  let tid = local_id.x;

  // 1. NaN / Inf Detection across loss, params, grads
  var has_nan = 0.0;
  if (is_invalid_float(global_meanLoss[0])) {
    has_nan = 1.0;
  }
  for (var i = tid; i < u_global.totalParams; i += 256u) {
    if (is_invalid_float(global_params[i]) || is_invalid_float(global_grads[i])) {
      has_nan = 1.0;
      break;
    }
  }
  s_reduce_0[tid] = has_nan;
  workgroupBarrier();

  for (var s = 128u; s > 0u; s >>= 1u) {
    if (tid < s) {
      if (s_reduce_0[tid + s] > 0.5) {
        s_reduce_0[tid] = 1.0;
      }
    }
    workgroupBarrier();
  }
  let finalNanFlag = s_reduce_0[0];
  workgroupBarrier();

  // 2. Max Logit and Softmax Entropy
  var max_logit = -1e30;
  var entropy_sum = 0.0;
  let V = u_global.vocabSize;

  for (var m = tid; m < u_global.M; m += 256u) {
    let rowOffset = m * V;
    var row_max = -1e30;
    for (var v = 0u; v < V; v += 1u) {
      let z = global_logits[rowOffset + v];
      if (z > row_max) {
        row_max = z;
      }
    }
    if (row_max > max_logit) {
      max_logit = row_max;
    }

    var sum_exp = 0.0;
    for (var v = 0u; v < V; v += 1u) {
      sum_exp += exp(global_logits[rowOffset + v] - row_max);
    }

    var row_entropy = 0.0;
    let inv_sum = 1.0 / max(1e-12, sum_exp);
    for (var v = 0u; v < V; v += 1u) {
      let p = exp(global_logits[rowOffset + v] - row_max) * inv_sum;
      if (p > 1e-9) {
        row_entropy -= p * log(p);
      }
    }
    entropy_sum += row_entropy;
  }

  s_reduce_0[tid] = max_logit;
  s_reduce_1[tid] = entropy_sum;
  workgroupBarrier();

  for (var s = 128u; s > 0u; s >>= 1u) {
    if (tid < s) {
      s_reduce_0[tid] = max(s_reduce_0[tid], s_reduce_0[tid + s]);
      s_reduce_1[tid] += s_reduce_1[tid + s];
    }
    workgroupBarrier();
  }

  if (tid == 0u) {
    let g = u_global.globalOffset;
    global_output[g + 0u] = s_reduce_0[0];          // maxLogit
    global_output[g + 1u] = s_reduce_1[0];          // logitEntropySum
    global_output[g + 2u] = f32(u_global.M);        // M (rowCount)
    global_output[g + 3u] = finalNanFlag;           // hasNanOrInf
    global_output[g + 4u] = global_meanLoss[0];     // loss
    global_output[g + 5u] = global_normClip[0];     // globalNorm
    global_output[g + 6u] = global_normClip[1];     // clipScale
  }
}

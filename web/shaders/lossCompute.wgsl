// WGSL Mean Squared Error and Forward Linear Compute Shader
@group(0) @binding(0) var<storage, read> inputs: array<f32>;
@group(0) @binding(1) var<storage, read> weights: array<f32>;
@group(0) @binding(2) var<storage, read> targets: array<f32>;
@group(0) @binding(3) var<storage, read_write> lossOutput: array<f32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let idx = global_id.x;
    let total = arrayLength(&inputs);
    
    if (idx >= total) {
        return;
    }

    // Forward activation: y_pred = input * weight
    let pred = inputs[idx] * weights[0] + weights[1];
    let diff = pred - targets[idx];
    lossOutput[idx] = diff * diff;
}

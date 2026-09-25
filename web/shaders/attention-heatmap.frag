#ifdef GL_ES
precision mediump float;
#endif

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_attention_weights[16]; // 4x4 attention matrix
uniform int u_active_head;

varying vec2 v_uv;

// Turbo color palette approximation
vec3 turboColormap(float t) {
    const vec4 kRedVec4 = vec4(0.13572138, 4.61539260, -42.66032258, 132.13108234);
    const vec4 kGreenVec4 = vec4(0.09140261, 2.19418839, 4.84296658, -14.18503333);
    const vec4 kBlueVec4 = vec4(0.10667330, 12.64194608, -60.58204836, 110.36276771);
    const vec2 kRedVec2 = vec2(-152.94239396, 59.28637943);
    const vec2 kGreenVec2 = vec2(4.27729857, 2.82956604);
    const vec2 kBlueVec2 = vec2(-89.90310912, 27.34824973);

    t = clamp(t, 0.0, 1.0);
    vec4 v4 = vec4(1.0, t, t * t, t * t * t);
    vec2 v2 = v4.zw * v4.z;

    return vec3(
        dot(v4, kRedVec4) + dot(v2, kRedVec2),
        dot(v4, kGreenVec4) + dot(v2, kGreenVec2),
        dot(v4, kBlueVec4) + dot(v2, kBlueVec2)
    );
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    uv.y = 1.0 - uv.y; // Flip Y for matrix ordering

    // 4x4 grid cell coordinate
    vec2 cell = floor(uv * 4.0);
    int col = int(clamp(cell.x, 0.0, 3.0));
    int row = int(clamp(cell.y, 0.0, 3.0));
    int index = row * 4 + col;

    // Fetch attention value
    float weight = 0.25;
    for (int i = 0; i < 16; i++) {
        if (i == index) {
            weight = u_attention_weights[i];
        }
    }

    // Grid border effect
    vec2 cellUV = fract(uv * 4.0);
    float border = step(0.03, cellUV.x) * step(0.03, cellUV.y) * 
                   step(cellUV.x, 0.97) * step(cellUV.y, 0.97);

    // Subtle breathing pulse for active attention cells
    float pulse = 0.05 * sin(u_time * 3.0 + weight * 6.28);
    float displayWeight = clamp(weight + pulse, 0.0, 1.0);

    vec3 heatmapColor = turboColormap(displayWeight);
    vec3 borderColor = vec3(0.08, 0.12, 0.18);

    vec3 finalColor = mix(borderColor, heatmapColor, border);

    gl_FragColor = vec4(finalColor, 1.0);
}

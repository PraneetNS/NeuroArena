precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform vec4 u_actionProbabilities; // [Harvester, Flanker, Defender, Disruptor]
uniform float u_exploitability;

void main() {
    vec2 st = (gl_FragCoord.xy * 2.0 - u_resolution) / min(u_resolution.x, u_resolution.y);
    float dist = length(st);
    float angle = atan(st.y, st.x);

    // 4-quadrant tactical axes
    float axisPulse = abs(sin(angle * 2.0)) * 0.25;
    
    // Equipotential radar rings
    float rings = abs(sin(dist * 18.0 - u_time * 1.5));
    rings = smoothstep(0.85, 0.98, rings) * 0.35;

    // Barycentric polygon radius based on 4-action probabilities
    // Quadrant 0 (Harvester, +X), Quadrant 1 (Flanker, +Y), Quadrant 2 (Defender, -X), Quadrant 3 (Disruptor, -Y)
    float polyRadius = 0.15 + 
        u_actionProbabilities.x * max(0.0, cos(angle)) * 0.7 +
        u_actionProbabilities.y * max(0.0, sin(angle)) * 0.7 +
        u_actionProbabilities.z * max(0.0, -cos(angle)) * 0.7 +
        u_actionProbabilities.w * max(0.0, -sin(angle)) * 0.7;

    // Glow boundary
    float polyEdge = smoothstep(polyRadius + 0.04, polyRadius - 0.01, dist);
    float polyGlow = exp(-abs(dist - polyRadius) * 12.0);

    // Color gradient: Cyan (Harvester) -> Amber (Flanker) -> Violet (Defender) -> Emerald (Disruptor)
    vec3 baseColor = vec3(0.05, 0.1, 0.18);
    vec3 glowColor = mix(
        vec3(0.1, 0.8, 0.9), // Cyan
        vec3(0.9, 0.6, 0.1), // Amber
        sin(u_time * 0.8) * 0.5 + 0.5
    );

    // Exploitability perturbation tint (red when exploitability is high)
    glowColor = mix(glowColor, vec3(1.0, 0.2, 0.3), clamp(u_exploitability * 2.0, 0.0, 0.8));

    vec3 finalColor = baseColor + (glowColor * polyGlow * 1.2) + (glowColor * polyEdge * 0.45) + rings * vec3(0.2, 0.4, 0.6);

    // Outer circular boundary fade
    finalColor *= smoothstep(1.0, 0.85, dist);

    gl_FragColor = vec4(finalColor, 1.0);
}

precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_membranePotential; // -75.0 to -50.0 mV
uniform float u_firingRateHz;      // 0 to 100 Hz
uniform float u_isSpiking;         // 1.0 if spike event, 0.0 otherwise

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    vec2 p = (gl_FragCoord.xy * 2.0 - u_resolution) / min(u_resolution.x, u_resolution.y);

    // Normalize membrane potential from [-75, -50] mV to [0.0, 1.0]
    float normV = clamp((u_membranePotential + 75.0) / 25.0, 0.0, 1.0);

    // Oscilloscope grid lines
    vec2 grid = abs(fract(uv * 10.0 - 0.5) - 0.5) / fwidth(uv * 10.0);
    float gridLine = 1.0 - min(min(grid.x, grid.y), 1.0);

    // Traveling Leaky Integrate-and-Fire waveform
    float wavePhase = uv.x * 24.0 - u_time * 8.0;
    float waveY = 0.5 + (normV - 0.5) * 0.4 * sin(wavePhase);

    // Sharp Dirac action potential spike burst if spiking
    float spikePeak = u_isSpiking * exp(-pow((uv.x - 0.75) * 40.0, 2.0)) * 0.45;
    waveY += spikePeak;

    float distToWave = abs(uv.y - waveY);
    float beam = exp(-distToWave * 32.0);
    float glow = exp(-distToWave * 8.0);

    // Color palette: Neon Emerald for resting/decay, Hyper Magenta for action potentials
    vec3 restColor = vec3(0.05, 0.95, 0.55);
    vec3 spikeColor = vec3(1.0, 0.15, 0.65);
    vec3 waveColor = mix(restColor, spikeColor, normV + u_isSpiking * 0.7);

    // Background bioluminescent haze
    vec3 bgColor = vec3(0.02, 0.04, 0.08) + gridLine * vec3(0.04, 0.1, 0.15);

    // Composite final color
    vec3 finalColor = bgColor + (beam * waveColor * 1.5) + (glow * waveColor * 0.6);

    // Add vignette
    float vignette = uv.x * uv.y * (1.0 - uv.x) * (1.0 - uv.y);
    finalColor *= clamp(16.0 * vignette, 0.0, 1.0);

    gl_FragColor = vec4(finalColor, 1.0);
}

/**
 * VolumetricFogShader.js
 * Volumetric height fog with Henyey-Greenstein single-scattering phase function,
 * raymarching jitter, and clustered light attenuation.
 */

export const VolumetricFogVertexShader = /* glsl */ `
varying vec2 vUv;
varying vec3 vViewRay;

void main() {
    vUv = uv;
    // Ray reconstruction from camera clip space
    vec4 clipPos = vec4(position.xy, 1.0, 1.0);
    vec4 viewPos = projectionMatrixInverse * clipPos;
    vViewRay = viewPos.xyz / viewPos.w;
    gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const VolumetricFogFragmentShader = /* glsl */ `
uniform sampler2D tDepth;
uniform sampler2D tBlueNoise;
uniform vec3 cameraWorldPosition;
uniform mat4 viewMatrixInverse;
uniform vec3 fogColor;
uniform float fogDensity;
uniform float fogHeightDecay;
uniform float fogBaseHeight;
uniform vec3 sunDirection;
uniform vec3 sunColor;
uniform float sunIntensity;
uniform float anisotropy; // Henyey-Greenstein g (-1 to +1)

varying vec2 vUv;
varying vec3 vViewRay;

// Henyey-Greenstein phase function for aerosol forward scattering
float henyeyGreenstein(float cosTheta, float g) {
    float g2 = g * g;
    return (1.0 - g2) / (4.0 * 3.14159265 * pow(1.0 + g2 - 2.0 * g * cosTheta, 1.5));
}

// Pseudo-random Bayer dither offset
float dither(vec2 coord) {
    return fract(sin(dot(coord, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
    float depthVal = texture2D(tDepth, vUv).r;
    // Linearize depth
    float zNear = 0.1;
    float zFar = 500.0;
    float linearDepth = zNear * zFar / (zFar - depthVal * (zFar - zNear));

    vec3 rayDir = normalize(vViewRay);
    vec3 rayStart = cameraWorldPosition;
    float marchDistance = min(linearDepth, 150.0);

    const int STEPS = 16;
    float stepSize = marchDistance / float(STEPS);
    float jitter = dither(vUv * 500.0);

    vec3 accumulatedLight = vec3(0.0);
    float accumulatedOpticalDepth = 0.0;

    float cosTheta = dot(rayDir, -normalize(sunDirection));
    float phase = henyeyGreenstein(cosTheta, anisotropy);

    for (int i = 0; i < STEPS; i++) {
        float t = (float(i) + jitter) * stepSize;
        vec3 p = rayStart + rayDir * t;

        // Exponential height fog density
        float height = p.y - fogBaseHeight;
        float localDensity = fogDensity * exp(-max(0.0, height) * fogHeightDecay);
        
        // Sun in-scattering
        vec3 inScattered = sunColor * sunIntensity * phase * localDensity;
        
        // Extinction
        float stepExtinction = localDensity * stepSize;
        accumulatedOpticalDepth += stepExtinction;
        float transmittance = exp(-accumulatedOpticalDepth);

        accumulatedLight += inScattered * transmittance * stepSize;
    }

    float finalTransmittance = exp(-accumulatedOpticalDepth);
    vec3 outFog = accumulatedLight + fogColor * (1.0 - finalTransmittance);

    gl_FragColor = vec4(outFog, 1.0 - finalTransmittance);
}
`;

export class VolumetricFogConfig {
    static getUniforms() {
        return {
            tDepth: { value: null },
            tBlueNoise: { value: null },
            cameraWorldPosition: { value: [0, 0, 0] },
            viewMatrixInverse: { value: new Float32Array(16) },
            fogColor: { value: [0.12, 0.18, 0.28] },
            fogDensity: { value: 0.025 },
            fogHeightDecay: { value: 0.15 },
            fogBaseHeight: { value: 0.0 },
            sunDirection: { value: [0.5, 0.8, 0.3] },
            sunColor: { value: [1.0, 0.95, 0.8] },
            sunIntensity: { value: 1.2 },
            anisotropy: { value: 0.45 }
        };
    }
}

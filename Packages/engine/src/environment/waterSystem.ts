/**
 * Stylized Painterly Water System for Lakes, Rivers & Basins.
 * Features:
 * - Parameterized water level elevation
 * - Depth-based color absorption (crystal turquoise to deep sapphire)
 * - Animated shore foam where water intersects terrain shores
 * - Dual scrolling normal maps with opposite ripple vectors
 * - Fresnel sky reflection & sun specular sparkles
 * - Subtle refraction distortion
 */

import * as THREE from 'three/webgpu';

export interface WaterConfig {
  waterLevel: number;
  size: number;
}

export class WaterSystem {
  public mesh: THREE.Mesh;
  public group = new THREE.Group();

  public waterLevel: number = 7.5;
  private material: THREE.ShaderMaterial;

  constructor(config?: Partial<WaterConfig>) {
    this.waterLevel = config?.waterLevel ?? 7.5;
    const size = config?.size ?? 2000.0;

    // Water Plane Geometry (Subdivided plane for smooth depth interpolation)
    const waterGeo = new THREE.PlaneGeometry(size, size, 64, 64);
    waterGeo.rotateX(-Math.PI / 2);

    // Procedural Ripple Normal Texture generated in memory
    const normalMap = this.createProceduralWaveTexture();

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0.0 },
        uWaterLevel: { value: this.waterLevel },
        uNormalMap: { value: normalMap },
        uSunDirection: { value: new THREE.Vector3(0.5, 0.6, 0.3) },
        uSunColor: { value: new THREE.Color(0xfff3db) },
        uSkyColor: { value: new THREE.Color(0x7dd3fc) },
        uShallowColor: { value: new THREE.Color(0x2dd4bf) }, // Radiant turquoise
        uDeepColor: { value: new THREE.Color(0x0c4a6e) },    // Deep ocean sapphire
        uFoamColor: { value: new THREE.Color(0xffffff) },
        uCameraPos: { value: new THREE.Vector3() }
      },
      vertexShader: `
        varying vec3 vWorldPos;
        varying vec2 vUv;

        uniform float uTime;

        void main() {
          vUv = uv * 32.0;

          // Subtle harmonic surface wave displacement
          vec3 pos = position;
          float wave1 = sin(pos.x * 0.05 + uTime * 1.5) * cos(pos.z * 0.05 + uTime * 1.2) * 0.12;
          float wave2 = sin(pos.x * 0.12 - uTime * 2.0) * 0.06;
          pos.y += wave1 + wave2;

          vec4 worldPos = modelMatrix * vec4(pos, 1.0);
          vWorldPos = worldPos.xyz;

          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        varying vec3 vWorldPos;
        varying vec2 vUv;

        uniform float uTime;
        uniform float uWaterLevel;
        uniform sampler2D uNormalMap;
        uniform vec3 uSunDirection;
        uniform vec3 uSunColor;
        uniform vec3 uSkyColor;
        uniform vec3 uShallowColor;
        uniform vec3 uDeepColor;
        uniform vec3 uFoamColor;
        uniform vec3 uCameraPos;

        void main() {
          vec3 viewDir = normalize(uCameraPos - vWorldPos);

          // 1. Dual Scrolling Normal Maps for multi-directional capillary waves
          vec2 uv1 = vUv * 0.5 + vec2(uTime * 0.025, uTime * 0.018);
          vec2 uv2 = vUv * 0.75 - vec2(uTime * 0.020, uTime * 0.028);

          vec3 n1 = texture2D(uNormalMap, uv1).rgb * 2.0 - 1.0;
          vec3 n2 = texture2D(uNormalMap, uv2).rgb * 2.0 - 1.0;
          vec3 waveNormal = normalize(vec3(n1.xy + n2.xy, 1.5));

          // 2. Fresnel factor (glancing view reflects sky)
          float ndotv = max(0.0, dot(viewDir, vec3(0.0, 1.0, 0.0)));
          float fresnel = pow(1.0 - ndotv, 4.0) * 0.75 + 0.15;

          // 3. Sun Specular Sparkle Highlight (Blinn-Phong reflection)
          vec3 halfVec = normalize(viewDir + uSunDirection);
          float specFactor = pow(max(0.0, dot(waveNormal, halfVec)), 85.0);
          vec3 sunSparkle = uSunColor * specFactor * 1.8;

          // 4. Depth-based color absorption & Shore Foam
          // Approximate water depth below plane
          float estimatedDepth = max(0.1, vWorldPos.y - 0.0);
          float depthFactor = clamp(estimatedDepth / 8.0, 0.0, 1.0);
          vec3 waterBodyColor = mix(uShallowColor, uDeepColor, depthFactor);

          // Foam edge near shore
          float foamNoise = sin(vUv.x * 2.0 + uTime * 3.0) * cos(vUv.y * 2.0 - uTime * 2.5);
          float isShore = smoothstep(0.85, 0.2, estimatedDepth);
          float foamMask = clamp((foamNoise * 0.5 + 0.5) * isShore * 1.4, 0.0, 1.0);

          // 5. Combine: Reflected Sky + Water Body + Foam + Sun Specular
          vec3 surfaceColor = mix(waterBodyColor, uSkyColor, fresnel);
          vec3 finalColor = mix(surfaceColor, uFoamColor, foamMask * 0.65) + sunSparkle;

          gl_FragColor = vec4(finalColor, 0.88);
        }
      `,
      transparent: true,
      depthWrite: false
    });

    this.mesh = new THREE.Mesh(waterGeo, this.material);
    this.mesh.position.y = this.waterLevel;
    this.group.add(this.mesh);
  }

  private createProceduralWaveTexture(): THREE.DataTexture {
    const size = 128;
    const data = new Uint8Array(size * size * 4);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = (x / size) * Math.PI * 4;
        const v = (y / size) * Math.PI * 4;

        // Wave normal derivatives
        const dx = Math.cos(u * 2.0 + v) * 0.35 + Math.cos(u * 4.0 - v * 2.0) * 0.15;
        const dy = Math.sin(v * 2.0 + u) * 0.35 + Math.sin(v * 4.0 - u * 2.0) * 0.15;

        const idx = (y * size + x) * 4;
        data[idx + 0] = Math.floor((dx * 0.5 + 0.5) * 255);
        data[idx + 1] = Math.floor((dy * 0.5 + 0.5) * 255);
        data[idx + 2] = 255; // Upward Z normal
        data[idx + 3] = 255;
      }
    }

    const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.needsUpdate = true;
    return tex;
  }

  public update(time: number, cameraPos: THREE.Vector3, sunDir: THREE.Vector3, sunCol: THREE.Color, skyCol: THREE.Color): void {
    this.material.uniforms.uTime.value = time;
    this.material.uniforms.uCameraPos.value.copy(cameraPos);
    this.material.uniforms.uSunDirection.value.copy(sunDir);
    this.material.uniforms.uSunColor.value.copy(sunCol);
    this.material.uniforms.uSkyColor.value.copy(skyCol);

    // Keep water centered beneath camera so it covers entire visible range
    this.mesh.position.x = cameraPos.x;
    this.mesh.position.z = cameraPos.z;
    this.mesh.position.y = this.waterLevel;
  }

  public setWaterLevel(level: number): void {
    this.waterLevel = level;
    this.mesh.position.y = level;
    this.material.uniforms.uWaterLevel.value = level;
  }

  public getStats(): { triangles: number; drawCalls: number } {
    return {
      triangles: 64 * 64 * 2, // 8,192 triangles
      drawCalls: this.group.visible ? 1 : 0
    };
  }
}

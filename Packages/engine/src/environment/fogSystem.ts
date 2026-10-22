/**
 * Exponential Height Fog, Aerial Perspective & Volumetric Light Shafts.
 * Controls atmospheric depth perception, terrain horizon blending,
 * and optional directional god rays towards the sun.
 */

import * as THREE from 'three/webgpu';
import { TimeOfDayState } from './timeOfDay.js';

export class FogSystem {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;

  // Configuration
  public enabled: boolean = true;
  public enableLightShafts: boolean = true;
  public heightFogDecay: number = 0.025; // Controls height falloff
  public baseDensity: number = 0.0012;

  // Light shaft mesh & material (subtle radial sunburst in front of camera)
  private shaftMesh: THREE.Mesh;
  private shaftMaterial: THREE.ShaderMaterial;
  private sunScreenPos = new THREE.Vector2();

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    this.scene = scene;
    this.camera = camera;

    // 1. Initial Scene Distance Fog (FogExp2)
    this.scene.fog = new THREE.FogExp2(0xfde68a, this.baseDensity);

    // 2. Light Shaft Screen Quad (View space billboard facing camera)
    const shaftGeo = new THREE.PlaneGeometry(2, 2);
    this.shaftMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uSunPos: { value: new THREE.Vector2(0.5, 0.5) },
        uSunColor: { value: new THREE.Color(0xffedd5) },
        uIntensity: { value: 0.35 },
        uSunVisible: { value: 1.0 }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.9999, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec2 uSunPos;
        uniform vec3 uSunColor;
        uniform float uIntensity;
        uniform float uSunVisible;
        varying vec2 vUv;

        void main() {
          if (uSunVisible <= 0.01 || uIntensity <= 0.01) {
            discard;
          }

          vec2 delta = uSunPos - vUv;
          float dist = length(delta);

          // Ray step sampling towards sun position
          float rays = 0.0;
          float weight = 0.06;
          vec2 step = delta * 0.035;
          vec2 coord = vUv;

          for (int i = 0; i < 8; i++) {
            coord += step;
            float falloff = clamp(1.0 - length(coord - uSunPos) * 1.4, 0.0, 1.0);
            rays += falloff * weight;
          }

          float radialGlow = clamp(1.0 - dist * 1.2, 0.0, 1.0);
          float alpha = (rays * 0.6 + radialGlow * 0.4) * uIntensity * uSunVisible;

          gl_FragColor = vec4(uSunColor, alpha * 0.28);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false
    });

    this.shaftMesh = new THREE.Mesh(shaftGeo, this.shaftMaterial);
    this.shaftMesh.frustumCulled = false;
    this.shaftMesh.renderOrder = 999; // Overlay
    this.scene.add(this.shaftMesh);
  }

  public update(state: TimeOfDayState): void {
    if (!this.enabled) {
      if (this.scene.fog) {
        this.scene.fog.color.setHex(0x000000);
        (this.scene.fog as THREE.FogExp2).density = 0.0;
      }
      this.shaftMesh.visible = false;
      return;
    }

    // 1. Update Exponential Scene Fog (Aerial perspective color & density)
    if (this.scene.fog && this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.copy(state.fogColor);
      this.scene.fog.density = state.fogDensity;
    }

    // 2. Update Light Shafts
    if (this.enableLightShafts && state.sunIntensity > 0.1) {
      this.shaftMesh.visible = true;

      // Calculate sun position in screen space
      const sunWorldPos = this.camera.position.clone().add(
        state.sunDirection.clone().multiplyScalar(500)
      );

      // Check if sun is in front of camera
      const camDir = new THREE.Vector3();
      this.camera.getWorldDirection(camDir);
      const dotSun = camDir.dot(state.sunDirection);

      if (dotSun > 0.05) {
        const proj = sunWorldPos.clone().project(this.camera);
        // Map from NDC [-1, 1] to UV [0, 1]
        this.sunScreenPos.set(proj.x * 0.5 + 0.5, proj.y * 0.5 + 0.5);

        this.shaftMaterial.uniforms.uSunPos.value.copy(this.sunScreenPos);
        this.shaftMaterial.uniforms.uSunColor.value.copy(state.sunColor);
        // Golden hour gets dramatic warm light shafts
        const shaftBoost = state.isGoldenHour ? 0.65 : 0.35;
        this.shaftMaterial.uniforms.uIntensity.value = shaftBoost * Math.min(1.0, dotSun * 2.0);
        this.shaftMaterial.uniforms.uSunVisible.value = 1.0;
      } else {
        this.shaftMaterial.uniforms.uSunVisible.value = 0.0;
      }
    } else {
      this.shaftMesh.visible = false;
    }
  }

  public setQuality(tier: 'low' | 'medium' | 'high'): void {
    if (tier === 'low') {
      this.enableLightShafts = false;
    } else if (tier === 'medium') {
      this.enableLightShafts = true;
    } else {
      this.enableLightShafts = true;
    }
  }
}

/**
 * Exponential Height Fog, Aerial Perspective & Volumetric Light Shafts.
 * Controls atmospheric depth perception, terrain horizon blending,
 * and optional directional god rays towards the sun.
 */

import * as THREE from 'three/webgpu';
import { uniform, vec4, float, Fn, length, clamp, uv } from 'three/tsl';
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
  private shaftMaterial: THREE.MeshBasicNodeMaterial;
  private sunScreenPos = new THREE.Vector2();

  private uSunPos = uniform(new THREE.Vector2(0.5, 0.5));
  private uSunColor = uniform(new THREE.Color(0xffedd5));
  private uIntensity = uniform(0.35);
  private uSunVisible = uniform(1.0);

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    this.scene = scene;
    this.camera = camera;

    // 1. Initial Scene Distance Fog (FogExp2)
    this.scene.fog = new THREE.FogExp2(0xfde68a, this.baseDensity);

    // 2. Light Shaft Screen Quad (View space billboard facing camera)
    const shaftGeo = new THREE.PlaneGeometry(2, 2);
    const shaftColorNode = Fn(() => {
      const coord = uv();
      const delta = this.uSunPos.sub(coord);
      const dist = length(delta);
      const radialGlow = clamp(float(1.0).sub(dist.mul(1.1)), 0.0, 1.0);

      // Radial crepuscular god ray streaks
      const angle = delta.y.atan2(delta.x);
      const streaks = angle.mul(14.0).sin().mul(0.35).add(0.65);

      const alpha = radialGlow.mul(streaks).mul(this.uIntensity).mul(this.uSunVisible).mul(0.35);
      return vec4(this.uSunColor, alpha);
    });

    this.shaftMaterial = new THREE.MeshBasicNodeMaterial({
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      fog: false
    });
    this.shaftMaterial.colorNode = shaftColorNode();

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

      // Position quad in front of camera view
      const camDir = new THREE.Vector3();
      this.camera.getWorldDirection(camDir);
      this.shaftMesh.position.copy(this.camera.position).addScaledVector(camDir, 0.5);
      this.shaftMesh.quaternion.copy(this.camera.quaternion);
      this.shaftMesh.scale.set(1.4, 0.9, 1.0);

      // Calculate sun position in screen space
      const sunWorldPos = this.camera.position.clone().add(
        state.sunDirection.clone().multiplyScalar(500)
      );

      // Check if sun is in front of camera
      const dotSun = camDir.dot(state.sunDirection);

      if (dotSun > 0.05) {
        const proj = sunWorldPos.clone().project(this.camera);
        // Map from NDC [-1, 1] to UV [0, 1]
        this.sunScreenPos.set(proj.x * 0.5 + 0.5, proj.y * 0.5 + 0.5);

        this.uSunPos.value.copy(this.sunScreenPos);
        this.uSunColor.value.copy(state.sunColor);
        // Golden hour gets dramatic warm light shafts
        const shaftBoost = state.isGoldenHour ? 0.65 : 0.35;
        this.uIntensity.value = shaftBoost * Math.min(1.0, dotSun * 2.0);
        this.uSunVisible.value = 1.0;
      } else {
        this.uSunVisible.value = 0.0;
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

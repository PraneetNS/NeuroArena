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

  // Atmospheric dust motes and drifting pollen
  public motePoints: THREE.Points;
  private moteCount = 450;
  private moteBoxSize = 24.0;

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

    // 3. Atmospheric Dust Motes & Drifting Pollen
    const moteGeo = new THREE.BufferGeometry();
    const motePositions = new Float32Array(this.moteCount * 3);
    for (let i = 0; i < this.moteCount; i++) {
      motePositions[i * 3 + 0] = (Math.random() - 0.5) * this.moteBoxSize;
      motePositions[i * 3 + 1] = (Math.random() - 0.5) * (this.moteBoxSize * 0.6) + 2.0;
      motePositions[i * 3 + 2] = (Math.random() - 0.5) * this.moteBoxSize;
    }
    moteGeo.setAttribute('position', new THREE.BufferAttribute(motePositions, 3));

    const moteMat = new THREE.PointsMaterial({
      size: 0.16,
      color: 0xffedd5,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.motePoints = new THREE.Points(moteGeo, moteMat);
    this.motePoints.frustumCulled = false;
    this.motePoints.castShadow = false;
    this.motePoints.receiveShadow = false;
    this.scene.add(this.motePoints);
  }

  public update(state: TimeOfDayState, dt: number = 0.016): void {
    if (!this.enabled) {
      if (this.scene.fog) {
        this.scene.fog.color.setHex(0x000000);
        (this.scene.fog as THREE.FogExp2).density = 0.0;
      }
      this.shaftMesh.visible = false;
      this.motePoints.visible = false;
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

    // 3. Update Dust Motes (Drifting with subtle wind and wrapping around camera)
    if (this.motePoints.visible) {
      const posAttr = this.motePoints.geometry.getAttribute('position') as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;
      const camPos = this.camera.position;
      const halfBox = this.moteBoxSize * 0.5;
      const t = performance.now() * 0.001;

      for (let i = 0; i < this.moteCount; i++) {
        let x = arr[i * 3 + 0];
        let y = arr[i * 3 + 1];
        let z = arr[i * 3 + 2];

        // Drift velocity with harmonic oscillation
        x += Math.sin(t * 0.6 + i * 0.5) * 0.02 * dt * 60;
        y += (Math.sin(t * 1.2 + i) * 0.015 - 0.005) * dt * 60;
        z += Math.cos(t * 0.5 + i * 0.7) * 0.02 * dt * 60;

        // Wrap around camera bounding box
        if (x - camPos.x > halfBox) x -= this.moteBoxSize;
        else if (x - camPos.x < -halfBox) x += this.moteBoxSize;

        if (y - camPos.y > halfBox * 0.6) y -= this.moteBoxSize * 0.6;
        else if (y - camPos.y < -halfBox * 0.6) y += this.moteBoxSize * 0.6;

        if (z - camPos.z > halfBox) z -= this.moteBoxSize;
        else if (z - camPos.z < -halfBox) z += this.moteBoxSize;

        arr[i * 3 + 0] = x;
        arr[i * 3 + 1] = y;
        arr[i * 3 + 2] = z;
      }
      posAttr.needsUpdate = true;

      // Color tint from sun and time of day
      const moteMat = this.motePoints.material as THREE.PointsMaterial;
      moteMat.color.copy(state.sunColor);
      moteMat.opacity = state.isGoldenHour ? 0.65 : 0.38;
    }
  }

  public setQuality(tier: 'low' | 'medium' | 'high'): void {
    if (tier === 'low') {
      this.enableLightShafts = false;
      this.motePoints.visible = false;
    } else if (tier === 'medium') {
      this.enableLightShafts = true;
      this.motePoints.visible = true;
    } else {
      this.enableLightShafts = true;
      this.motePoints.visible = true;
    }
  }
}

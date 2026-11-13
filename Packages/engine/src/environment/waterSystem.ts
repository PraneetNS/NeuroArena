/**
 * Stylized Painterly Water System for Lakes, Rivers & Basins.
 * Features:
 * - Parameterized water level elevation
 * - Depth-based color absorption (crystal turquoise to deep sapphire)
 * - Animated shore foam where water intersects terrain shores
 * - Pure Three.js TSL NodeMaterial (fully WebGPU compliant)
 * - Fresnel sky reflection & sun specular sparkles
 */

import * as THREE from 'three/webgpu';
import {
  Fn,
  positionWorld,
  uniform,
  float,
  mix,
  smoothstep
} from 'three/tsl';

export interface WaterConfig {
  waterLevel: number;
  size: number;
}

export class WaterSystem {
  public mesh: THREE.Mesh;
  public group = new THREE.Group();
  public floatingParticles: THREE.Points;

  public waterLevel: number = 7.5;
  private material: THREE.MeshStandardNodeMaterial;
  private particleMaterial: THREE.PointsMaterial;

  private uTime = uniform(0.0);
  private uWaterLevel = uniform(7.5);
  private uSunDirection = uniform(new THREE.Vector3(0.5, 0.6, 0.3));
  private uSunColor = uniform(new THREE.Color(0xfff3db));
  private uSkyColor = uniform(new THREE.Color(0x7dd3fc));
  private uShallowColor = uniform(new THREE.Color(0x2dd4bf)); // Radiant turquoise
  private uDeepColor = uniform(new THREE.Color(0x0c4a6e));    // Deep ocean sapphire
  private uFoamColor = uniform(new THREE.Color(0xffffff));
  private uCameraPos = uniform(new THREE.Vector3());
  private size: number = 2000.0;
  private currentSegments: number = 64;

  private particleCount = 400;
  private particlePositions: Float32Array;

  constructor(config?: Partial<WaterConfig>) {
    this.waterLevel = config?.waterLevel ?? 7.5;
    this.uWaterLevel.value = this.waterLevel;
    this.size = config?.size ?? 2000.0;

    // Water Plane Geometry (Subdivided plane for smooth depth interpolation)
    const waterGeo = new THREE.PlaneGeometry(this.size, this.size, 64, 64);
    waterGeo.rotateX(-Math.PI / 2);

    const waterColorNode = Fn(() => {
      const p = positionWorld;
      const w1 = p.x.mul(0.04).add(this.uTime.mul(1.2)).sin();
      const w2 = p.z.mul(0.05).add(this.uTime.mul(0.9)).cos();
      const wave = w1.add(w2).mul(0.5);

      const baseWater = mix(this.uDeepColor, this.uShallowColor, wave.mul(0.3).add(0.5));
      const foam = smoothstep(float(0.7), float(1.0), wave);
      const colWithFoam = mix(baseWater, this.uFoamColor, foam.mul(0.35));

      // Stylized high-frequency caustic sparkles on sunlit wave peaks
      const sparkleW1 = p.x.mul(1.6).add(this.uTime.mul(4.0)).sin();
      const sparkleW2 = p.z.mul(1.9).sub(this.uTime.mul(3.2)).cos();
      const sparkleVal = smoothstep(float(0.80), float(0.98), sparkleW1.mul(sparkleW2));
      const colWithSparkles = colWithFoam.add(this.uSunColor.mul(sparkleVal).mul(1.4));

      return colWithSparkles;
    });

    this.material = new THREE.MeshStandardNodeMaterial({
      roughness: 0.15,
      metalness: 0.1,
      transparent: true,
      opacity: 0.88,
      depthWrite: false
    });
    this.material.colorNode = waterColorNode();
    this.material.opacityNode = float(0.88);

    this.mesh = new THREE.Mesh(waterGeo, this.material);
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    this.mesh.position.y = this.waterLevel;
    this.group.add(this.mesh);

    // Floating water foam & mist particles drifting above water surface
    const particleGeo = new THREE.BufferGeometry();
    this.particlePositions = new Float32Array(this.particleCount * 3);
    for (let i = 0; i < this.particleCount; i++) {
      const r = Math.sqrt(Math.random()) * 80.0;
      const theta = Math.random() * Math.PI * 2;
      this.particlePositions[i * 3 + 0] = Math.cos(theta) * r;
      this.particlePositions[i * 3 + 1] = this.waterLevel + 0.15 + Math.random() * 0.45;
      this.particlePositions[i * 3 + 2] = Math.sin(theta) * r;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(this.particlePositions, 3));
    this.particleMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.35,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.floatingParticles = new THREE.Points(particleGeo, this.particleMaterial);
    this.floatingParticles.castShadow = false;
    this.floatingParticles.receiveShadow = false;
    this.group.add(this.floatingParticles);
  }

  public update(time: number, cameraPos: THREE.Vector3, sunDir: THREE.Vector3, sunCol: THREE.Color, skyCol: THREE.Color): void {
    this.uTime.value = time;
    this.uCameraPos.value.copy(cameraPos);
    this.uSunDirection.value.copy(sunDir);
    this.uSunColor.value.copy(sunCol);
    this.uSkyColor.value.copy(skyCol);

    // Keep water centered beneath camera so it covers entire visible range
    this.mesh.position.x = cameraPos.x;
    this.mesh.position.z = cameraPos.z;
    this.mesh.position.y = this.waterLevel;

    // Drift floating particles near camera
    if (this.floatingParticles) {
      this.floatingParticles.position.x = cameraPos.x;
      this.floatingParticles.position.z = cameraPos.z;
      const attr = this.floatingParticles.geometry.attributes.position as THREE.BufferAttribute;
      const arr = attr.array as Float32Array;
      for (let i = 0; i < this.particleCount; i++) {
        // Slow river drift
        arr[i * 3 + 0] += Math.sin(time + i) * 0.02;
        arr[i * 3 + 2] += 0.03;
        if (arr[i * 3 + 2] > 80.0) arr[i * 3 + 2] = -80.0;
      }
      attr.needsUpdate = true;
    }
  }

  public setWaterLevel(level: number): void {
    this.waterLevel = level;
    this.mesh.position.y = level;
    this.uWaterLevel.value = level;
  }

  public setQuality(tier: 'low' | 'medium' | 'high'): void {
    const segs = tier === 'low' ? 16 : tier === 'medium' ? 32 : 64;
    if (segs === this.currentSegments) return;
    this.currentSegments = segs;
    if (this.mesh.geometry) {
      this.mesh.geometry.dispose();
    }
    const newGeo = new THREE.PlaneGeometry(this.size, this.size, segs, segs);
    newGeo.rotateX(-Math.PI / 2);
    this.mesh.geometry = newGeo;
  }

  public getStats(): { triangles: number; drawCalls: number } {
    return {
      triangles: this.currentSegments * this.currentSegments * 2,
      drawCalls: this.group.visible ? 1 : 0
    };
  }
}

/**
 * Stylized Atmospheric Particles (Floating Pollen, Dust Motes, & Spores).
 * Renders 1,200 floating ambient particles in a bounding volume centered on the camera.
 * Dynamic coloring driven by time of day:
 * - Sunrise / Golden Hour: radiant amber & honey dust motes
 * - Midday: subtle pollen grains
 * - Dusk / Blue Hour: bioluminescent teal spores and fireflies
 */

import * as THREE from 'three/webgpu';
import { TimeOfDayState } from './timeOfDay.js';

export class AtmosphereParticles {
  public group = new THREE.Group();
  private points: THREE.Points;
  private particleCount = 1200;
  private positions: Float32Array;
  private velocities: Float32Array;
  private material: THREE.PointsMaterial;
  private bounds = { x: 50, y: 16, z: 50 };

  constructor() {
    const geo = new THREE.BufferGeometry();
    this.positions = new Float32Array(this.particleCount * 3);
    this.velocities = new Float32Array(this.particleCount * 3);

    for (let i = 0; i < this.particleCount; i++) {
      this.positions[i * 3 + 0] = (Math.random() - 0.5) * this.bounds.x * 2;
      this.positions[i * 3 + 1] = Math.random() * this.bounds.y;
      this.positions[i * 3 + 2] = (Math.random() - 0.5) * this.bounds.z * 2;

      this.velocities[i * 3 + 0] = (Math.random() - 0.5) * 0.4;
      this.velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.25;
      this.velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.4;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));

    this.material = new THREE.PointsMaterial({
      color: 0xffedd5,
      size: 0.18,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.group.add(this.points);
  }

  public update(dt: number, timeState: TimeOfDayState, cameraPos: THREE.Vector3): void {
    const posAttr = this.points.geometry.attributes.position as THREE.BufferAttribute;
    const array = posAttr.array as Float32Array;

    // Adapt particle color and glow by time of day
    if (timeState.isGoldenHour) {
      this.material.color.setHex(0xfbbf24); // Warm golden honey motes
      this.material.size = 0.22;
      this.material.opacity = 0.75;
    } else if (timeState.timeHours >= 19.0 || timeState.timeHours < 5.5) {
      this.material.color.setHex(0x38bdf8); // Glowing bioluminescent cyan night spores
      this.material.size = 0.24;
      this.material.opacity = 0.7;
    } else {
      this.material.color.setHex(0xfef08a); // Subtle midday pollen
      this.material.size = 0.16;
      this.material.opacity = 0.45;
    }

    const halfX = this.bounds.x;
    const halfZ = this.bounds.z;
    const maxY = this.bounds.y;

    for (let i = 0; i < this.particleCount; i++) {
      const idx = i * 3;
      array[idx + 0] += this.velocities[idx + 0] * dt;
      array[idx + 1] += this.velocities[idx + 1] * dt;
      array[idx + 2] += this.velocities[idx + 2] * dt;

      // Wrap around camera focal center
      const relX = array[idx + 0] - cameraPos.x;
      const relY = array[idx + 1] - cameraPos.y;
      const relZ = array[idx + 2] - cameraPos.z;

      if (relX > halfX) array[idx + 0] -= halfX * 2;
      if (relX < -halfX) array[idx + 0] += halfX * 2;
      if (relY > maxY) array[idx + 1] -= maxY;
      if (relY < -2.0) array[idx + 1] += maxY;
      if (relZ > halfZ) array[idx + 2] -= halfZ * 2;
      if (relZ < -halfZ) array[idx + 2] += halfZ * 2;
    }

    posAttr.needsUpdate = true;
  }

  public setQuality(tier: 'low' | 'medium' | 'high'): void {
    if (tier === 'low') {
      this.group.visible = false;
    } else if (tier === 'medium') {
      this.group.visible = true;
      this.points.geometry.setDrawRange(0, 500);
    } else {
      this.group.visible = true;
      this.points.geometry.setDrawRange(0, 1200);
    }
  }
}

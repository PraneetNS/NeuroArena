/**
 * Lumen: Floating lantern spirit companion that follows the player.
 * Expressive through light only:
 * - Color (Calm Cyan, Warm Amber, Warning Red/Orange flare, Serene Emerald).
 * - Pulse (breathing pulse vs rapid alert pulse).
 * - Orbit (gentle shoulder drift vs pointing forward towards target objects).
 * - Purely visual, zero voice acting.
 */

import * as THREE from 'three';

export type LumenMood = 'calm' | 'guiding' | 'alert' | 'success';

const MOOD_COLORS: Record<LumenMood, { hex: number; intensity: number; pulseSpeed: number }> = {
  calm: { hex: 0x00f3ff, intensity: 2.2, pulseSpeed: 2.0 }, // Cyan breathing
  guiding: { hex: 0xf59e0b, intensity: 2.8, pulseSpeed: 3.5 }, // Warm amber guiding
  alert: { hex: 0xef4444, intensity: 4.5, pulseSpeed: 8.0 }, // Red/Orange warning flare
  success: { hex: 0x10b981, intensity: 3.2, pulseSpeed: 2.5 } // Emerald serene
};

export class LumenCompanion {
  public group: THREE.Group;
  public mood: LumenMood = 'calm';

  private targetWorldPos: THREE.Vector3 | null = null;
  private coreMesh: THREE.Mesh;
  private cageMesh: THREE.Mesh;
  private haloMesh: THREE.Mesh;
  private light: THREE.PointLight;

  private currentHex = 0x00f3ff;
  private currentIntensity = 2.2;

  constructor() {
    this.group = new THREE.Group();

    // 1. Inner radiant flame core
    const coreGeo = new THREE.SphereGeometry(0.22, 16, 16);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0x00f3ff,
      transparent: true,
      opacity: 0.95
    });
    this.coreMesh = new THREE.Mesh(coreGeo, coreMat);
    this.group.add(this.coreMesh);

    // 2. Ornate lantern cage / rings (brass/obsidian aesthetic)
    const cageGeo = new THREE.IcosahedronGeometry(0.35, 1);
    const cageMat = new THREE.MeshStandardMaterial({
      color: 0x27272a,
      metalness: 0.85,
      roughness: 0.3,
      wireframe: true
    });
    this.cageMesh = new THREE.Mesh(cageGeo, cageMat);
    this.group.add(this.cageMesh);

    // 3. Orbiting halo
    const haloGeo = new THREE.TorusGeometry(0.48, 0.015, 8, 32);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0x00f3ff,
      transparent: true,
      opacity: 0.65
    });
    this.haloMesh = new THREE.Mesh(haloGeo, haloMat);
    this.haloMesh.rotation.x = Math.PI / 2;
    this.group.add(this.haloMesh);

    // 4. Point light casting soft glow onto terrain and player
    this.light = new THREE.PointLight(0x00f3ff, 2.2, 8);
    this.group.add(this.light);
  }

  public setMood(mood: LumenMood): void {
    this.mood = mood;
  }

  public pointAt(pos: [number, number, number] | null): void {
    if (pos) {
      this.targetWorldPos = new THREE.Vector3(pos[0], pos[1], pos[2]);
    } else {
      this.targetWorldPos = null;
    }
  }

  public update(timeSec: number, playerPos: THREE.Vector3): void {
    const config = MOOD_COLORS[this.mood];

    // Smoothly interpolate color
    const currentColor = new THREE.Color(this.currentHex);
    const targetColor = new THREE.Color(config.hex);
    currentColor.lerp(targetColor, 0.08);
    this.currentHex = currentColor.getHex();

    // Pulse intensity
    const pulse = 1.0 + Math.sin(timeSec * config.pulseSpeed) * 0.25;
    this.currentIntensity = THREE.MathUtils.lerp(
      this.currentIntensity,
      config.intensity * pulse,
      0.1
    );

    // Apply to materials and light
    (this.coreMesh.material as THREE.MeshBasicMaterial).color.setHex(this.currentHex);
    (this.haloMesh.material as THREE.MeshBasicMaterial).color.setHex(this.currentHex);
    this.light.color.setHex(this.currentHex);
    this.light.intensity = this.currentIntensity;

    // Rotate cage and halo
    this.cageMesh.rotation.y += 0.02;
    this.cageMesh.rotation.x = Math.sin(timeSec * 1.5) * 0.2;
    this.haloMesh.rotation.z += 0.035;

    // Position calculation
    let desiredPos: THREE.Vector3;
    if (this.targetWorldPos && this.mood === 'guiding') {
      // Drift halfway towards the target to lead the player
      const dir = this.targetWorldPos.clone().sub(playerPos);
      const dist = dir.length();
      const leadDist = Math.min(dist * 0.4, 4.5);
      desiredPos = playerPos
        .clone()
        .add(dir.normalize().multiplyScalar(leadDist))
        .add(new THREE.Vector3(0, 1.8 + Math.sin(timeSec * 2) * 0.2, 0));
    } else {
      // Friendly shoulder orbit
      const bob = Math.sin(timeSec * 2.2) * 0.18;
      desiredPos = playerPos
        .clone()
        .add(new THREE.Vector3(1.2, 1.7 + bob, -0.9));
    }

    this.group.position.lerp(desiredPos, 0.06);
  }
}

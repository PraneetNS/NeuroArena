/**
 * OracleStone: Diegetic 3D Monolith & Runic Communing Station.
 * Exists both in the Open World and in the Dusk Camp Retreat.
 */

import * as THREE from 'three/webgpu';

export class OracleStone {
  public group: THREE.Group;
  public interactionDistance = 3.8;
  public isPlayerNearby = false;

  private floatingCrystal: THREE.Mesh;
  private runicRings: THREE.Mesh[] = [];
  private pulseLight: THREE.PointLight;
  private animTimer = 0;

  constructor(position: THREE.Vector3 = new THREE.Vector3(0, 0, 0), runeColorHex = 0x4fb3a9) {
    this.group = new THREE.Group();
    this.group.position.copy(position);

    // 1. Foundation Plinth (dark ancient stone)
    const plinthMat = new THREE.MeshStandardMaterial({
      color: 0x151a21,
      roughness: 0.85,
      metalness: 0.2
    });
    const plinthGeo = new THREE.CylinderGeometry(1.3, 1.6, 0.45, 6);
    const plinth = new THREE.Mesh(plinthGeo, plinthMat);
    plinth.position.y = 0.225;
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    this.group.add(plinth);

    // 2. Tapered Basalt Monolith Pillar
    const monolithMat = new THREE.MeshStandardMaterial({
      color: 0x1a222d,
      roughness: 0.7,
      metalness: 0.4
    });
    const monolithGeo = new THREE.CylinderGeometry(0.42, 0.82, 3.2, 6);
    const monolith = new THREE.Mesh(monolithGeo, monolithMat);
    monolith.position.y = 1.95;
    monolith.castShadow = true;
    monolith.receiveShadow = true;
    this.group.add(monolith);

    // 3. Glowing Runic Rings wrapping the monolith
    const runeMat = new THREE.MeshStandardMaterial({
      color: runeColorHex,
      emissive: runeColorHex,
      emissiveIntensity: 0.9,
      roughness: 0.2,
      metalness: 0.8
    });

    const ringHeights = [1.2, 2.0, 2.8];
    const ringRadii = [0.72, 0.58, 0.48];
    for (let i = 0; i < 3; i++) {
      const ringGeo = new THREE.TorusGeometry(ringRadii[i], 0.035, 8, 24);
      ringGeo.rotateX(Math.PI / 2);
      const ring = new THREE.Mesh(ringGeo, runeMat);
      ring.position.y = ringHeights[i];
      this.runicRings.push(ring);
      this.group.add(ring);
    }

    // 4. Levitating Runic Crystal Beacon (floating above monolith)
    const crystalGeo = new THREE.OctahedronGeometry(0.38, 0);
    const crystalMat = new THREE.MeshStandardMaterial({
      color: runeColorHex,
      emissive: runeColorHex,
      emissiveIntensity: 1.2,
      roughness: 0.1,
      metalness: 0.9,
      wireframe: false
    });
    this.floatingCrystal = new THREE.Mesh(crystalGeo, crystalMat);
    this.floatingCrystal.position.y = 4.1;
    this.floatingCrystal.castShadow = true;
    this.group.add(this.floatingCrystal);

    // 5. Pulsing Oracle Point Light
    this.pulseLight = new THREE.PointLight(runeColorHex, 2.2, 8.5, 1.8);
    this.pulseLight.position.set(0, 4.1, 0);
    this.group.add(this.pulseLight);
  }

  /**
   * Updates rotations, floating bobbing, emissive light pulsing, and proximity.
   */
  public update(dt: number, playerPos?: THREE.Vector3): boolean {
    this.animTimer += dt;

    // Levitation bobbing and rotation
    const bobOffset = Math.sin(this.animTimer * 2.2) * 0.08;
    this.floatingCrystal.position.y = 4.1 + bobOffset;
    this.floatingCrystal.rotation.y += dt * 0.8;
    this.floatingCrystal.rotation.x = Math.sin(this.animTimer * 1.5) * 0.15;

    // Proximity detection & resonant glow intensification
    let proximityFactor = 0;
    if (playerPos) {
      const dist = this.group.position.distanceTo(playerPos);
      this.isPlayerNearby = dist <= this.interactionDistance;
      proximityFactor = Math.max(0, Math.min(1.0, 1.0 - dist / 10.0));
    }

    // Slowly rotate runic rings in opposing directions, accelerated by proximity
    const ringSpeedMult = 1.0 + proximityFactor * 1.5;
    if (this.runicRings[0]) this.runicRings[0].rotation.z += dt * 0.4 * ringSpeedMult;
    if (this.runicRings[1]) this.runicRings[1].rotation.z -= dt * 0.6 * ringSpeedMult;
    if (this.runicRings[2]) this.runicRings[2].rotation.z += dt * 0.5 * ringSpeedMult;

    // Light pulse intensified by player proximity
    const basePulse = 1.6 + Math.sin(this.animTimer * 2.5) * 0.6;
    this.pulseLight.intensity = basePulse + proximityFactor * 2.2;

    return this.isPlayerNearby;
  }
}

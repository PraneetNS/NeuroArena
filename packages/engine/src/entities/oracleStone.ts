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

  // Orbiting Runic Spark Motes
  private sparkPoints: THREE.Points;
  private sparkPositions: Float32Array;
  private sparkVelocities: Float32Array;
  private sparkCount = 48;
  private sparkBurstTimer = 0;

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

    // 6. Orbiting Runic Spark Motes
    const sparkGeo = new THREE.BufferGeometry();
    this.sparkPositions = new Float32Array(this.sparkCount * 3);
    this.sparkVelocities = new Float32Array(this.sparkCount * 3);

    for (let i = 0; i < this.sparkCount; i++) {
      const angle = (i / this.sparkCount) * Math.PI * 2;
      const radius = 0.6 + Math.random() * 0.4;
      this.sparkPositions[i * 3 + 0] = Math.cos(angle) * radius;
      this.sparkPositions[i * 3 + 1] = 4.1 + (Math.random() - 0.5) * 0.5;
      this.sparkPositions[i * 3 + 2] = Math.sin(angle) * radius;

      this.sparkVelocities[i * 3 + 0] = -Math.sin(angle) * 0.6;
      this.sparkVelocities[i * 3 + 1] = (Math.random() - 0.5) * 0.2;
      this.sparkVelocities[i * 3 + 2] = Math.cos(angle) * 0.6;
    }
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(this.sparkPositions, 3));

    const sparkMat = new THREE.PointsMaterial({
      color: runeColorHex,
      size: 0.12,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.sparkPoints = new THREE.Points(sparkGeo, sparkMat);
    this.group.add(this.sparkPoints);
  }

  /**
   * Triggers an explosive burst of runic motes when player communes with the stone.
   */
  public triggerCommunePulse(): void {
    this.sparkBurstTimer = 1.5;
    for (let i = 0; i < this.sparkCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.2 + Math.random() * 1.8;
      this.sparkVelocities[i * 3 + 0] = Math.cos(angle) * speed;
      this.sparkVelocities[i * 3 + 1] = (Math.random() - 0.2) * speed * 0.8;
      this.sparkVelocities[i * 3 + 2] = Math.sin(angle) * speed;
    }
  }

  /**
   * Triggers a concentric shockwave ripple when a branch is forked in the Oracle UI.
   */
  public triggerBranchForkRipple(branchDepth = 1): void {
    this.sparkBurstTimer = 0.8;
    const rippleSpeed = 0.8 + Math.min(2.0, branchDepth * 0.25);
    for (let i = 0; i < this.sparkCount; i++) {
      const angle = (i / this.sparkCount) * Math.PI * 2;
      this.sparkVelocities[i * 3 + 0] = Math.cos(angle) * rippleSpeed;
      this.sparkVelocities[i * 3 + 1] = Math.sin(this.animTimer * 4 + i) * 0.4;
      this.sparkVelocities[i * 3 + 2] = Math.sin(angle) * rippleSpeed;
    }
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
    if (this.runicRings[0]) {
      this.runicRings[0].rotation.z += dt * 0.4 * ringSpeedMult;
      this.runicRings[0].rotation.x = Math.sin(this.animTimer * 0.8) * 0.08;
    }
    if (this.runicRings[1]) {
      this.runicRings[1].rotation.z -= dt * 0.6 * ringSpeedMult;
      this.runicRings[1].rotation.y = Math.cos(this.animTimer * 0.9) * 0.08;
    }
    if (this.runicRings[2]) {
      this.runicRings[2].rotation.z += dt * 0.5 * ringSpeedMult;
      this.runicRings[2].rotation.x = Math.sin(this.animTimer * 1.1) * 0.06;
    }

    // Light pulse intensified by player proximity
    const basePulse = 1.6 + Math.sin(this.animTimer * 2.5) * 0.6;
    this.pulseLight.intensity = basePulse + proximityFactor * 2.2;
    this.pulseLight.distance = 8.5 + proximityFactor * 3.5;

    // 7. Update Orbiting / Bursting Spark Motes
    const sparkPosAttr = this.sparkPoints.geometry.attributes.position as THREE.BufferAttribute;
    const sparkArr = sparkPosAttr.array as Float32Array;

    if (this.sparkBurstTimer > 0) {
      this.sparkBurstTimer -= dt;
      // Damped expansion
      for (let i = 0; i < this.sparkCount; i++) {
        const idx = i * 3;
        sparkArr[idx + 0] += this.sparkVelocities[idx + 0] * dt;
        sparkArr[idx + 1] += this.sparkVelocities[idx + 1] * dt;
        sparkArr[idx + 2] += this.sparkVelocities[idx + 2] * dt;
        this.sparkVelocities[idx + 0] *= 0.94;
        this.sparkVelocities[idx + 1] *= 0.94;
        this.sparkVelocities[idx + 2] *= 0.94;
      }
    } else {
      // Harmonic orbit around crystal
      const orbitSpeed = 1.2 + proximityFactor * 1.5;
      for (let i = 0; i < this.sparkCount; i++) {
        const idx = i * 3;
        const angle = (i / this.sparkCount) * Math.PI * 2 + this.animTimer * orbitSpeed;
        const radius = 0.65 + Math.sin(this.animTimer * 2 + i) * 0.15;
        const targetX = Math.cos(angle) * radius;
        const targetY = 4.1 + bobOffset + Math.sin(this.animTimer * 3 + i * 0.5) * 0.25;
        const targetZ = Math.sin(angle) * radius;

        sparkArr[idx + 0] += (targetX - sparkArr[idx + 0]) * Math.min(1.0, dt * 4.0);
        sparkArr[idx + 1] += (targetY - sparkArr[idx + 1]) * Math.min(1.0, dt * 4.0);
        sparkArr[idx + 2] += (targetZ - sparkArr[idx + 2]) * Math.min(1.0, dt * 4.0);
      }
    }
    sparkPosAttr.needsUpdate = true;

    return this.isPlayerNearby;
  }
}

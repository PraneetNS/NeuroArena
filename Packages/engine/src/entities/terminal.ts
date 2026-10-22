/**
 * Interactive 3D World Terminals & NPC Stations in the NeuroArena.
 */

import * as THREE from 'three';

export type TerminalType = 'forge' | 'curator' | 'archivist' | 'nexus';

export class WorldTerminal {
  public type: TerminalType;
  public title: string;
  public description: string;
  public group: THREE.Group;
  public interactionDistance = 3.5;
  public isPlayerNearby = false;

  private rings: THREE.Mesh[] = [];
  private beaconLight: THREE.PointLight;

  constructor(
    type: TerminalType,
    title: string,
    description: string,
    position: THREE.Vector3,
    colorHex = 0x00f3ff
  ) {
    this.type = type;
    this.title = title;
    this.description = description;
    this.group = new THREE.Group();
    this.group.position.copy(position);

    // Base pedestal
    const baseGeo = new THREE.CylinderGeometry(1.2, 1.6, 0.6, 8);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      metalness: 0.9,
      roughness: 0.3
    });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 0.3;
    this.group.add(base);

    // Floating Holographic Core
    const coreGeo = new THREE.DodecahedronGeometry(0.6);
    const coreMat = new THREE.MeshStandardMaterial({
      color: colorHex,
      emissive: colorHex,
      emissiveIntensity: 0.8,
      roughness: 0.1,
      metalness: 0.9,
      wireframe: true
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.position.y = 1.8;
    this.group.add(core);

    // Rotating holographic rings
    for (let r = 0; r < 2; r++) {
      const ringGeo = new THREE.TorusGeometry(0.9 + r * 0.3, 0.03, 8, 24);
      const ringMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.7
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.y = 1.8;
      this.rings.push(ring);
      this.group.add(ring);
    }

    // Beacon Light
    this.beaconLight = new THREE.PointLight(colorHex, 2.5, 12);
    this.beaconLight.position.y = 2.0;
    this.group.add(this.beaconLight);
  }

  public update(time: number, playerPos: THREE.Vector3): boolean {
    // Animate rings
    this.rings.forEach((ring, idx) => {
      ring.rotation.x = Math.sin(time + idx) * 0.5;
      ring.rotation.y += idx === 0 ? 0.02 : -0.015;
      ring.rotation.z += 0.01;
    });

    // Check distance
    const dist = this.group.position.distanceTo(playerPos);
    this.isPlayerNearby = dist <= this.interactionDistance;

    // Pulse light when player is nearby
    if (this.isPlayerNearby) {
      this.beaconLight.intensity = 3.5 + Math.sin(time * 6) * 1.0;
    } else {
      this.beaconLight.intensity = 2.0;
    }

    return this.isPlayerNearby;
  }
}

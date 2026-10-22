/**
 * Collectible 3D Neural Data Shard with glowing geometry, floating animation,
 * and magnetic attraction.
 */

import * as THREE from 'three';

export interface ShardData {
  id: string;
  title: string;
  sector: string;
  text: string;
  category: 'dialogue' | 'lore' | 'logic';
}

export class NeuralShard {
  public data: ShardData;
  public group: THREE.Group;
  public isCollected = false;
  public initialPosition: THREE.Vector3;

  private outerMesh: THREE.Mesh;
  private innerMesh: THREE.Mesh;
  private light: THREE.PointLight;
  private animOffset = Math.random() * Math.PI * 2;

  constructor(data: ShardData, position: THREE.Vector3) {
    this.data = data;
    this.initialPosition = position.clone();
    this.group = new THREE.Group();
    this.group.position.copy(position);

    // Color based on category
    let color = 0x00f3ff; // Cyan for dialogue
    if (data.category === 'lore') color = 0xa855f7; // Purple for lore
    if (data.category === 'logic') color = 0xf59e0b; // Amber for logic

    // Outer crystal (Octahedron)
    const outerGeo = new THREE.OctahedronGeometry(0.7, 0);
    const outerMat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.6,
      roughness: 0.2,
      metalness: 0.8,
      transparent: true,
      opacity: 0.85
    });
    this.outerMesh = new THREE.Mesh(outerGeo, outerMat);
    this.group.add(this.outerMesh);

    // Inner bright core
    const innerGeo = new THREE.IcosahedronGeometry(0.35, 1);
    const innerMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      wireframe: true
    });
    this.innerMesh = new THREE.Mesh(innerGeo, innerMat);
    this.group.add(this.innerMesh);

    // Point light
    this.light = new THREE.PointLight(color, 2, 8);
    this.group.add(this.light);
  }

  public update(
    time: number,
    playerPos: THREE.Vector3,
    onCollect: (shard: NeuralShard) => void
  ): void {
    if (this.isCollected) return;

    // Bobbing & rotation
    const yOffset = Math.sin(time * 2.5 + this.animOffset) * 0.25;
    this.group.position.y = this.initialPosition.y + yOffset;

    this.outerMesh.rotation.y += 0.02;
    this.outerMesh.rotation.x += 0.01;
    this.innerMesh.rotation.y -= 0.03;
    this.innerMesh.rotation.z += 0.015;

    // Proximity check with player
    const dist = this.group.position.distanceTo(playerPos);

    // Magnetic pull when close
    if (dist < 4.0 && dist > 0.8) {
      this.group.position.lerp(playerPos, 0.08);
    } else if (dist <= 0.8) {
      this.isCollected = true;
      this.group.visible = false;
      onCollect(this);
    }
  }

  public reset(): void {
    this.isCollected = false;
    this.group.visible = true;
    this.group.position.copy(this.initialPosition);
  }
}

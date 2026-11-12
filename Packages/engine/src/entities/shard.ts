/**
 * Collectible 3D Neural Data Shard with floating text glyph cluster,
 * pre-scan visual telemetry (jitter, echoes, signboards), and unfolding inspection.
 */

import * as THREE from 'three/webgpu';

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
  private glyphPlates: THREE.Mesh[] = [];
  private light: THREE.PointLight;
  private animOffset = Math.random() * Math.PI * 2;
  private unfoldProgress = 0;

  constructor(data: ShardData, position: THREE.Vector3) {
    this.data = data;
    this.initialPosition = position.clone();
    this.group = new THREE.Group();
    this.group.position.copy(position);

    // Color based on category using design-system tokens
    let color = 0x4FB3A9; // Signal Teal for dialogue
    if (data.category === 'lore') color = 0x8E9AAF; // Archival slate for lore
    if (data.category === 'logic') color = 0xE8A33D; // Accent Amber for logic

    // 1. Outer crystal core
    const outerGeo = new THREE.OctahedronGeometry(0.55, 0);
    const outerMat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.6,
      roughness: 0.25,
      metalness: 0.7,
      transparent: true,
      opacity: 0.82
    });
    this.outerMesh = new THREE.Mesh(outerGeo, outerMat);
    this.group.add(this.outerMesh);

    // 2. Inner bright rune core
    const innerGeo = new THREE.IcosahedronGeometry(0.28, 1);
    const innerMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      wireframe: true
    });
    this.innerMesh = new THREE.Mesh(innerGeo, innerMat);
    this.group.add(this.innerMesh);

    // 3. Floating Text Glyph Plates (Fragmented words orbiting the core)
    const plateGeo = new THREE.PlaneGeometry(0.5, 0.16);
    const plateMat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.4,
      roughness: 0.3,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75
    });

    const plateCount = 4;
    for (let i = 0; i < plateCount; i++) {
      const plate = new THREE.Mesh(plateGeo, plateMat);
      const angle = (i / plateCount) * Math.PI * 2;
      plate.position.set(Math.cos(angle) * 0.72, (i - 1.5) * 0.2, Math.sin(angle) * 0.72);
      plate.rotation.y = -angle + Math.PI / 2;
      this.glyphPlates.push(plate);
      this.group.add(plate);
    }

    // 4. Point light
    this.light = new THREE.PointLight(color, 2, 7);
    this.group.add(this.light);
  }

  public update(
    time: number,
    playerPos: THREE.Vector3,
    onCollect: (shard: NeuralShard) => void
  ): void {
    if (this.isCollected) return;

    // Bobbing & rotation
    const yOffset = Math.sin(time * 2.5 + this.animOffset) * 0.22;
    this.group.position.y = this.initialPosition.y + yOffset;

    this.outerMesh.rotation.y += 0.02;
    this.outerMesh.rotation.x += 0.01;
    this.innerMesh.rotation.y -= 0.03;

    // Proximity check with player
    const dist = this.group.position.distanceTo(playerPos);

    // Unfold glyph plates when near
    const targetUnfold = dist < 5.0 ? 1.0 : 0.0;
    this.unfoldProgress = THREE.MathUtils.lerp(this.unfoldProgress, targetUnfold, 0.08);

    for (let i = 0; i < this.glyphPlates.length; i++) {
      const plate = this.glyphPlates[i];
      const baseAngle = (i / this.glyphPlates.length) * Math.PI * 2 + time * 0.8;
      const radius = 0.72 + this.unfoldProgress * 0.45;
      plate.position.set(
        Math.cos(baseAngle) * radius,
        (i - 1.5) * (0.2 + this.unfoldProgress * 0.15),
        Math.sin(baseAngle) * radius
      );
      plate.rotation.y = -baseAngle + Math.PI / 2;
    }

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

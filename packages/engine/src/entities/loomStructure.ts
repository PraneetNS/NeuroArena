/**
 * LoomStructure: Diegetic 3D N-Gram Loom in Region 1 (The Fen).
 *
 * Visual design based on the NeuroArena Art Bible:
 * - Weathered bogwood timber frame and brass planetary gears
 * - Vertical glowing warp threads with token beads that slide and pulse
 * - Tall atmospheric beacon light column visible across the world
 * - Proximity detection and interactive "[E] The Loom: Weave N-Grams" prompt
 */

import * as THREE from 'three/webgpu';

export class LoomStructure {
  public group: THREE.Group;
  public interactionDistance = 5.5;
  public isPlayerNearby = false;

  private frameMesh: THREE.Group;
  private gears: THREE.Mesh[] = [];
  private threadsGroup: THREE.Group;
  private beads: THREE.Mesh[] = [];
  private beaconMesh: THREE.Mesh;
  private pulseLight: THREE.PointLight;
  private animTimer = 0;

  // Floating interaction billboard
  private billboardMesh: THREE.Mesh | null = null;

  constructor(position: THREE.Vector3 = new THREE.Vector3(-180, 14.5, -120)) {
    this.group = new THREE.Group();
    this.group.position.copy(position);

    // 1. Timber Base Plinth (Dark Bogwood / Silt palette)
    const timberMat = new THREE.MeshStandardMaterial({
      color: 0x221d18,
      roughness: 0.88,
      metalness: 0.1
    });

    const plinthGeo = new THREE.BoxGeometry(4.2, 0.4, 3.2);
    const plinth = new THREE.Mesh(plinthGeo, timberMat);
    plinth.position.y = 0.2;
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    this.group.add(plinth);

    // 2. Vertical Frame Uprights
    this.frameMesh = new THREE.Group();
    const uprightGeo = new THREE.BoxGeometry(0.3, 3.8, 0.3);
    const postPositions = [
      [-1.8, 1.9, -1.3],
      [1.8, 1.9, -1.3],
      [-1.8, 1.9, 1.3],
      [1.8, 1.9, 1.3]
    ];

    for (const [x, y, z] of postPositions) {
      const post = new THREE.Mesh(uprightGeo, timberMat);
      post.position.set(x, y, z);
      post.castShadow = true;
      this.frameMesh.add(post);
    }

    // Top Crossbeams
    const crossbeamGeoX = new THREE.BoxGeometry(3.9, 0.25, 0.3);
    const topBarFront = new THREE.Mesh(crossbeamGeoX, timberMat);
    topBarFront.position.set(0, 3.8, 1.3);
    this.frameMesh.add(topBarFront);

    const topBarBack = new THREE.Mesh(crossbeamGeoX, timberMat);
    topBarBack.position.set(0, 3.8, -1.3);
    this.frameMesh.add(topBarBack);

    this.group.add(this.frameMesh);

    // 3. Brass Gears & Spindles
    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xc8963e,
      roughness: 0.35,
      metalness: 0.85,
      emissive: 0x4a3410,
      emissiveIntensity: 0.2
    });

    const rollerGeo = new THREE.CylinderGeometry(0.12, 0.12, 3.6, 16);
    rollerGeo.rotateZ(Math.PI / 2);
    const topRoller = new THREE.Mesh(rollerGeo, brassMat);
    topRoller.position.set(0, 3.6, 0);
    this.group.add(topRoller);

    const botRoller = new THREE.Mesh(rollerGeo, brassMat);
    botRoller.position.set(0, 0.6, 0);
    this.group.add(botRoller);

    // Spinning cog wheels
    const gearGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.1, 12);
    gearGeo.rotateZ(Math.PI / 2);
    const leftGear = new THREE.Mesh(gearGeo, brassMat);
    leftGear.position.set(-1.85, 3.6, 0);
    this.group.add(leftGear);
    this.gears.push(leftGear);

    const rightGear = new THREE.Mesh(gearGeo, brassMat);
    rightGear.position.set(1.85, 3.6, 0);
    this.group.add(rightGear);
    this.gears.push(rightGear);

    // 4. Glowing Vertical Warp Threads & Token Beads
    this.threadsGroup = new THREE.Group();
    const threadMat = new THREE.MeshBasicMaterial({
      color: 0x3dcf8e,
      transparent: true,
      opacity: 0.75
    });

    const beadMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x10b981,
      emissiveIntensity: 0.8,
      roughness: 0.2,
      metalness: 0.6
    });

    const threadCount = 9;
    const threadGeo = new THREE.CylinderGeometry(0.015, 0.015, 3.0, 6);
    const beadGeo = new THREE.SphereGeometry(0.08, 12, 12);

    for (let i = 0; i < threadCount; i++) {
      const x = -1.4 + (i * 2.8) / (threadCount - 1);
      const thread = new THREE.Mesh(threadGeo, threadMat);
      thread.position.set(x, 2.1, 0);
      this.threadsGroup.add(thread);

      // Add 2 sliding beads per thread
      for (let b = 0; b < 2; b++) {
        const bead = new THREE.Mesh(beadGeo, beadMat);
        const yOffset = 0.9 + b * 1.2 + (i % 3) * 0.2;
        bead.position.set(x, yOffset, 0);
        this.beads.push(bead);
        this.threadsGroup.add(bead);
      }
    }
    this.group.add(this.threadsGroup);

    // 5. Skyward Beacon Light Pillar (Moss-green / Signal Cyan)
    const beaconGeo = new THREE.CylinderGeometry(0.35, 1.6, 120, 16, 1, true);
    const beaconMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    this.beaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
    this.beaconMesh.position.y = 60;
    this.group.add(this.beaconMesh);

    // 6. Dynamic Point Light
    this.pulseLight = new THREE.PointLight(0x10b981, 2.5, 18, 1.2);
    this.pulseLight.position.set(0, 2.4, 0);
    this.group.add(this.pulseLight);

    // 7. Interactive Billboard
    this.createBillboard();
  }

  private createBillboard(): void {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = 'rgba(10, 14, 18, 0.85)';
    ctx.roundRect(16, 16, 480, 96, 16);
    ctx.fill();
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 4;
    ctx.roundRect(16, 16, 480, 96, 16);
    ctx.stroke();

    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 36px "IBM Plex Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('[E] The Loom: Weave N-Grams', 256, 74);

    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const geo = new THREE.PlaneGeometry(2.4, 0.6);
    this.billboardMesh = new THREE.Mesh(geo, mat);
    this.billboardMesh.position.set(0, 4.4, 0);
    this.billboardMesh.visible = false;
    this.group.add(this.billboardMesh);
  }

  public checkProximity(playerPos: THREE.Vector3): boolean {
    const dist = this.group.position.distanceTo(playerPos);
    this.isPlayerNearby = dist <= this.interactionDistance;

    if (this.billboardMesh) {
      this.billboardMesh.visible = this.isPlayerNearby;
      if (this.isPlayerNearby) {
        // Look at player on Y axis
        this.billboardMesh.lookAt(playerPos.x, this.billboardMesh.position.y + this.group.position.y, playerPos.z);
      }
    }

    return this.isPlayerNearby;
  }

  public update(delta: number): void {
    this.animTimer += delta;

    // Rotate brass cogs
    for (const gear of this.gears) {
      gear.rotation.x += delta * 0.8;
    }

    // Oscillate beads along threads
    for (let i = 0; i < this.beads.length; i++) {
      const bead = this.beads[i];
      const speed = 0.8 + (i % 4) * 0.2;
      const baseHeight = 1.0 + (i % 2) * 1.2;
      bead.position.y = baseHeight + Math.sin(this.animTimer * speed + i) * 0.45;
    }

    // Beacon pulse and light breathing
    const pulse = 0.85 + Math.sin(this.animTimer * 2.0) * 0.15;
    this.beaconMesh.scale.set(pulse, 1, pulse);
    this.pulseLight.intensity = 2.0 + Math.sin(this.animTimer * 3.0) * 0.8;
  }
}

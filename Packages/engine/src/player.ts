/**
 * Stylized Indie Third-Person Player Character.
 * Art Direction: Journey / Sable / Breath of the Wild Scholar-Explorer.
 * Features:
 * - Low-poly procedural character: hooded tunic, belt, satchel, boots, and carried lantern
 * - Animated State Machine: idle, walk, run, jump, gather (lean into turns, bob, landing squash)
 * - 4-segment Verlet cloth scarf trailing in wind and velocity
 * - Carried scholar's lantern with warm amber PointLight illuminating terrain and grass
 * - Foot ground-snap for terrain slope stability
 */

import * as THREE from 'three/webgpu';

export type PlayerState = 'idle' | 'walk' | 'run' | 'jump' | 'gather';

export interface PlayerControlsState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  sprint: boolean;
  jump: boolean;
  gather?: boolean;
}

interface VerletParticle {
  pos: THREE.Vector3;
  prevPos: THREE.Vector3;
}

export class Player {
  public group: THREE.Group;
  public velocity = new THREE.Vector3();
  public isGrounded = true;
  public state: PlayerState = 'idle';

  public baseSpeed = 10.0;
  public sprintMultiplier = 1.75;
  public jumpStrength = 9.5;
  public gravity = 24.0;

  public controls: PlayerControlsState = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    sprint: false,
    jump: false,
    gather: false
  };

  // Character body parts
  private bodyRoot: THREE.Group;
  private torso: THREE.Mesh;
  private head: THREE.Mesh;
  private hood: THREE.Mesh;
  private leftLeg: THREE.Group;
  private rightLeg: THREE.Group;
  private leftArm: THREE.Group;
  private rightArm: THREE.Group;
  private lanternGroup: THREE.Group;
  public lanternLight: THREE.PointLight;

  // Verlet Scarf
  private scarfMesh: THREE.Line;
  private scarfParticles: VerletParticle[] = [];
  private scarfSegmentLength = 0.32;

  // Animation timing
  private animTime = 0;
  private landingSquash = 1.0;
  private currentSpeedMag = 0;
  private turnLean = 0;

  constructor() {
    this.group = new THREE.Group();
    this.group.position.set(0, 0, 10);

    this.bodyRoot = new THREE.Group();
    this.group.add(this.bodyRoot);

    // Materials following Art Bible design tokens
    const robeMat = new THREE.MeshStandardMaterial({
      color: 0x1e3a5f, // Deep scholar indigo (#1e3a5f)
      roughness: 0.8,
      metalness: 0.05
    });
    const tunicAccentMat = new THREE.MeshStandardMaterial({
      color: 0xc2410c, // Terracotta rust accent
      roughness: 0.75,
      metalness: 0.05
    });
    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xf6d3b3,
      roughness: 0.6
    });
    const leatherMat = new THREE.MeshStandardMaterial({
      color: 0x4a2e1b, // Dark saddle leather
      roughness: 0.85
    });
    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xd97706, // Polished brass
      metalness: 0.8,
      roughness: 0.25
    });

    // 1. Torso & Robes (flared tunic)
    const torsoGeo = new THREE.CylinderGeometry(0.32, 0.46, 0.95, 8);
    this.torso = new THREE.Mesh(torsoGeo, robeMat);
    this.torso.position.y = 1.05;
    this.torso.castShadow = true;
    this.bodyRoot.add(this.torso);

    // Belt & Satchel
    const beltGeo = new THREE.CylinderGeometry(0.35, 0.36, 0.12, 8);
    const belt = new THREE.Mesh(beltGeo, leatherMat);
    belt.position.y = 0.92;
    this.bodyRoot.add(belt);

    const satchelGeo = new THREE.BoxGeometry(0.2, 0.22, 0.12);
    const satchel = new THREE.Mesh(satchelGeo, leatherMat);
    satchel.position.set(0.34, 0.88, 0.1);
    satchel.rotation.z = -0.15;
    this.bodyRoot.add(satchel);

    // 2. Head & Hood
    const headGeo = new THREE.SphereGeometry(0.24, 8, 8);
    this.head = new THREE.Mesh(headGeo, skinMat);
    this.head.position.y = 1.68;
    this.bodyRoot.add(this.head);

    const hoodGeo = new THREE.ConeGeometry(0.32, 0.48, 8);
    hoodGeo.rotateX(-0.15);
    this.hood = new THREE.Mesh(hoodGeo, tunicAccentMat);
    this.hood.position.set(0, 1.82, -0.06);
    this.hood.castShadow = true;
    this.bodyRoot.add(this.hood);

    // 3. Legs and Boots
    this.leftLeg = this.createLeg(robeMat, leatherMat);
    this.leftLeg.position.set(-0.2, 0.65, 0);
    this.bodyRoot.add(this.leftLeg);

    this.rightLeg = this.createLeg(robeMat, leatherMat);
    this.rightLeg.position.set(0.2, 0.65, 0);
    this.bodyRoot.add(this.rightLeg);

    // 4. Arms
    this.leftArm = this.createArm(robeMat);
    this.leftArm.position.set(-0.42, 1.45, 0);
    this.bodyRoot.add(this.leftArm);

    this.rightArm = this.createArm(robeMat);
    this.rightArm.position.set(0.42, 1.45, 0);
    this.bodyRoot.add(this.rightArm);

    // 5. Carried Brass Lantern (attached to right arm)
    this.lanternGroup = new THREE.Group();
    const lanternFrameGeo = new THREE.CylinderGeometry(0.1, 0.12, 0.28, 6);
    const lanternFrame = new THREE.Mesh(lanternFrameGeo, brassMat);
    this.lanternGroup.add(lanternFrame);

    const glassGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.18, 6);
    const glassMat = new THREE.MeshBasicMaterial({ color: 0xffedd5 });
    const glass = new THREE.Mesh(glassGeo, glassMat);
    this.lanternGroup.add(glass);

    // Warm amber lantern light illuminating grass and terrain
    this.lanternLight = new THREE.PointLight(0xf59e0b, 2.2, 6.5, 1.8);
    this.lanternLight.position.set(0, 0, 0);
    this.lanternGroup.add(this.lanternLight);

    this.lanternGroup.position.set(0, -0.62, 0.18);
    this.rightArm.add(this.lanternGroup);

    // 6. Verlet Scarf trailing behind character
    const scarfCount = 5;
    const scarfGeo = new THREE.BufferGeometry();
    const scarfPositions = new Float32Array(scarfCount * 3);
    for (let i = 0; i < scarfCount; i++) {
      const p = new THREE.Vector3(0, 1.5 - i * this.scarfSegmentLength, -0.15 - i * 0.1);
      this.scarfParticles.push({ pos: p.clone(), prevPos: p.clone() });
      scarfPositions[i * 3 + 0] = p.x;
      scarfPositions[i * 3 + 1] = p.y;
      scarfPositions[i * 3 + 2] = p.z;
    }
    scarfGeo.setAttribute('position', new THREE.BufferAttribute(scarfPositions, 3));
    const scarfLineMat = new THREE.LineBasicMaterial({ color: 0xf59e0b, linewidth: 3 });
    this.scarfMesh = new THREE.Line(scarfGeo, scarfLineMat);
    this.group.add(this.scarfMesh);
  }

  private createLeg(robeMat: THREE.Material, bootMat: THREE.Material): THREE.Group {
    const leg = new THREE.Group();
    const thighGeo = new THREE.CylinderGeometry(0.12, 0.1, 0.45, 6);
    const thigh = new THREE.Mesh(thighGeo, robeMat);
    thigh.position.y = -0.22;
    thigh.castShadow = true;
    leg.add(thigh);

    const bootGeo = new THREE.BoxGeometry(0.16, 0.22, 0.26);
    const boot = new THREE.Mesh(bootGeo, bootMat);
    boot.position.set(0, -0.52, 0.05);
    boot.castShadow = true;
    leg.add(boot);

    return leg;
  }

  private createArm(sleeveMat: THREE.Material): THREE.Group {
    const arm = new THREE.Group();
    const sleeveGeo = new THREE.CylinderGeometry(0.1, 0.12, 0.55, 6);
    const sleeve = new THREE.Mesh(sleeveGeo, sleeveMat);
    sleeve.position.y = -0.28;
    sleeve.castShadow = true;
    arm.add(sleeve);
    return arm;
  }

  public update(dt: number, cameraAngle: number, getGroundHeight?: (x: number, z: number) => number): void {
    const moveDir = new THREE.Vector3();

    if (this.controls.forward) moveDir.z -= 1;
    if (this.controls.backward) moveDir.z += 1;
    if (this.controls.left) moveDir.x -= 1;
    if (this.controls.right) moveDir.x += 1;

    const isMoving = moveDir.lengthSq() > 0;
    if (isMoving) {
      moveDir.normalize();
      moveDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraAngle);

      const targetRotation = Math.atan2(moveDir.x, moveDir.z);
      // Smooth turning with lean
      const angleDiff = Math.atan2(Math.sin(targetRotation - this.group.rotation.y), Math.cos(targetRotation - this.group.rotation.y));
      this.turnLean = THREE.MathUtils.lerp(this.turnLean, -angleDiff * 0.4, dt * 10);
      this.group.rotation.y = THREE.MathUtils.lerp(this.group.rotation.y, targetRotation, dt * 12);
    } else {
      this.turnLean = THREE.MathUtils.lerp(this.turnLean, 0, dt * 8);
    }

    const isSprinting = this.controls.sprint && isMoving;
    const currentSpeed = this.baseSpeed * (isSprinting ? this.sprintMultiplier : 1.0);

    // Apply horizontal velocity with smoothing
    const targetVx = moveDir.x * currentSpeed;
    const targetVz = moveDir.z * currentSpeed;
    this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, targetVx, dt * 10);
    this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, targetVz, dt * 10);
    this.currentSpeedMag = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.z * this.velocity.z);

    // Jump & Gravity
    if (this.controls.jump && this.isGrounded) {
      this.velocity.y = this.jumpStrength;
      this.isGrounded = false;
      this.state = 'jump';
    }

    if (!this.isGrounded) {
      this.velocity.y -= this.gravity * dt;
    }

    // Apply displacement
    this.group.position.x += this.velocity.x * dt;
    this.group.position.y += this.velocity.y * dt;
    this.group.position.z += this.velocity.z * dt;

    // Floor / Terrain collision & Foot IK snap
    const groundY = getGroundHeight ? getGroundHeight(this.group.position.x, this.group.position.z) : 0;
    if (this.group.position.y <= groundY) {
      if (!this.isGrounded) {
        // Landing squash trigger
        this.landingSquash = 0.82;
      }
      this.group.position.y = groundY;
      this.velocity.y = 0;
      this.isGrounded = true;
    }

    // Recover landing squash
    this.landingSquash = THREE.MathUtils.lerp(this.landingSquash, 1.0, dt * 12);

    // World boundary clamp [-950, 950] for 2 km world
    this.group.position.x = THREE.MathUtils.clamp(this.group.position.x, -950, 950);
    this.group.position.z = THREE.MathUtils.clamp(this.group.position.z, -950, 950);

    // Determine Animation State
    if (!this.isGrounded) {
      this.state = 'jump';
    } else if (this.controls.gather) {
      this.state = 'gather';
    } else if (isMoving) {
      this.state = isSprinting ? 'run' : 'walk';
    } else {
      this.state = 'idle';
    }

    // Step procedural skeletal animation
    this.updateAnimation(dt);

    // Step Verlet scarf simulation
    this.updateScarf(dt);
  }

  private updateAnimation(dt: number): void {
    this.animTime += dt * (this.state === 'run' ? 14 : this.state === 'walk' ? 9 : 3);

    // Body squash and lateral lean
    this.bodyRoot.scale.set(
      1.0 / Math.sqrt(this.landingSquash),
      this.landingSquash,
      1.0 / Math.sqrt(this.landingSquash)
    );
    this.bodyRoot.rotation.z = this.turnLean;

    if (this.state === 'idle') {
      const breath = Math.sin(this.animTime) * 0.03;
      this.torso.position.y = 1.05 + breath;
      this.head.position.y = 1.68 + breath * 1.2;
      this.hood.position.y = 1.82 + breath * 1.2;

      this.leftLeg.rotation.x = 0;
      this.rightLeg.rotation.x = 0;
      this.leftArm.rotation.x = Math.sin(this.animTime * 0.5) * 0.08;
      this.rightArm.rotation.x = -Math.sin(this.animTime * 0.5) * 0.08;
      this.bodyRoot.rotation.x = 0;
    } else if (this.state === 'walk' || this.state === 'run') {
      const strideFreq = this.state === 'run' ? 1.4 : 1.0;
      const legSwing = Math.sin(this.animTime * strideFreq) * (this.state === 'run' ? 0.95 : 0.6);
      const bob = Math.abs(Math.cos(this.animTime * strideFreq)) * (this.state === 'run' ? 0.12 : 0.06);

      this.leftLeg.rotation.x = legSwing;
      this.rightLeg.rotation.x = -legSwing;
      this.leftArm.rotation.x = -legSwing * 0.85;
      this.rightArm.rotation.x = legSwing * 0.85;

      this.torso.position.y = 1.05 + bob;
      this.head.position.y = 1.68 + bob;
      this.hood.position.y = 1.82 + bob;

      // Forward lean during movement
      const forwardLean = this.state === 'run' ? 0.22 : 0.1;
      this.bodyRoot.rotation.x = forwardLean;
    } else if (this.state === 'jump') {
      this.leftLeg.rotation.x = -0.45;
      this.rightLeg.rotation.x = 0.35;
      this.leftArm.rotation.x = -0.7;
      this.rightArm.rotation.x = -0.7;
      this.bodyRoot.rotation.x = -0.15;
    } else if (this.state === 'gather') {
      // Kneeling inspect posture
      this.bodyRoot.rotation.x = 0.45;
      this.leftLeg.rotation.x = -0.8;
      this.rightLeg.rotation.x = 0.5;
      this.torso.position.y = 0.65;
    }

    // Lantern physics sway
    const lanternSway = Math.sin(this.animTime * 1.2) * 0.2 + (this.currentSpeedMag / this.baseSpeed) * 0.35;
    this.lanternGroup.rotation.x = lanternSway;
    this.lanternGroup.rotation.z = this.turnLean * 0.5;
  }

  private updateScarf(dt: number): void {
    if (this.scarfParticles.length === 0) return;

    // Anchor particle 0 to neck position behind hood
    const anchor = new THREE.Vector3(0, 1.58, -0.18);
    this.bodyRoot.localToWorld(anchor);
    this.group.worldToLocal(anchor);

    this.scarfParticles[0].pos.copy(anchor);
    this.scarfParticles[0].prevPos.copy(anchor);

    // Wind and gravity vector
    const windVec = new THREE.Vector3(0.04, -0.06, -0.12);

    for (let i = 1; i < this.scarfParticles.length; i++) {
      const p = this.scarfParticles[i];
      const vel = p.pos.clone().sub(p.prevPos).multiplyScalar(0.92); // Damping

      p.prevPos.copy(p.pos);
      p.pos.add(vel).addScaledVector(windVec, dt * 10);
    }

    // Distance constraint passes (Verlet relaxation)
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 1; i < this.scarfParticles.length; i++) {
        const p1 = this.scarfParticles[i - 1];
        const p2 = this.scarfParticles[i];
        const delta = p2.pos.clone().sub(p1.pos);
        const dist = delta.length();
        if (dist > 0.0001) {
          const diff = (dist - this.scarfSegmentLength) / dist;
          p2.pos.sub(delta.multiplyScalar(diff * 0.75));
        }
      }
    }

    // Write back to geometry attribute
    const attr = this.scarfMesh.geometry.attributes.position as THREE.BufferAttribute;
    const array = attr.array as Float32Array;
    for (let i = 0; i < this.scarfParticles.length; i++) {
      array[i * 3 + 0] = this.scarfParticles[i].pos.x;
      array[i * 3 + 1] = this.scarfParticles[i].pos.y;
      array[i * 3 + 2] = this.scarfParticles[i].pos.z;
    }
    attr.needsUpdate = true;
  }

  public get position(): THREE.Vector3 {
    return this.group.position;
  }
}

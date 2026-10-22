/**
 * 3D Player Entity and Third-Person Controller with keyboard/mouse inputs.
 */

import * as THREE from 'three';

export interface PlayerControlsState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  sprint: boolean;
  jump: boolean;
}

export class Player {
  public group: THREE.Group;
  public velocity = new THREE.Vector3();
  public isGrounded = true;

  public baseSpeed = 12.0;
  public sprintMultiplier = 1.8;
  public jumpStrength = 9.0;
  public gravity = 24.0;

  public rotationY = 0;
  public controls: PlayerControlsState = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    sprint: false,
    jump: false
  };

  private chassisMesh: THREE.Mesh;
  private visorMesh: THREE.Mesh;
  private thrusterLight: THREE.PointLight;

  constructor() {
    this.group = new THREE.Group();
    this.group.position.set(0, 0, 10);

    // Chassis (Futuristic Mech Drone)
    const bodyGeo = new THREE.CylinderGeometry(0.5, 0.4, 1.4, 8);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.9,
      roughness: 0.2
    });
    this.chassisMesh = new THREE.Mesh(bodyGeo, bodyMat);
    this.chassisMesh.position.y = 0.9;
    this.group.add(this.chassisMesh);

    // Glowing Neon Visor
    const visorGeo = new THREE.BoxGeometry(0.65, 0.25, 0.3);
    const visorMat = new THREE.MeshBasicMaterial({
      color: 0x00f3ff
    });
    this.visorMesh = new THREE.Mesh(visorGeo, visorMat);
    this.visorMesh.position.set(0, 1.25, 0.35);
    this.group.add(this.visorMesh);

    // Thruster ring at base
    const thrusterGeo = new THREE.TorusGeometry(0.35, 0.06, 8, 16);
    thrusterGeo.rotateX(Math.PI / 2);
    const thrusterMat = new THREE.MeshBasicMaterial({
      color: 0x00f3ff
    });
    const thruster = new THREE.Mesh(thrusterGeo, thrusterMat);
    thruster.position.y = 0.2;
    this.group.add(thruster);

    // Thruster Light
    this.thrusterLight = new THREE.PointLight(0x00f3ff, 2, 4);
    this.thrusterLight.position.y = 0.1;
    this.group.add(this.thrusterLight);
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
      // Rotate movement vector according to camera horizontal angle
      moveDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraAngle);

      const targetRotation = Math.atan2(moveDir.x, moveDir.z);
      // Smoothly rotate player toward movement direction
      this.group.rotation.y = THREE.MathUtils.lerp(this.group.rotation.y, targetRotation, dt * 12);
    }

    const currentSpeed = this.baseSpeed * (this.controls.sprint ? this.sprintMultiplier : 1.0);

    // Apply horizontal velocity with smoothing
    const targetVx = moveDir.x * currentSpeed;
    const targetVz = moveDir.z * currentSpeed;
    this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, targetVx, dt * 10);
    this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, targetVz, dt * 10);

    // Jump & Gravity
    if (this.controls.jump && this.isGrounded) {
      this.velocity.y = this.jumpStrength;
      this.isGrounded = false;
    }

    if (!this.isGrounded) {
      this.velocity.y -= this.gravity * dt;
    }

    // Apply displacement
    this.group.position.x += this.velocity.x * dt;
    this.group.position.y += this.velocity.y * dt;
    this.group.position.z += this.velocity.z * dt;

    // Floor / Terrain collision
    const groundY = getGroundHeight ? getGroundHeight(this.group.position.x, this.group.position.z) : 0;
    if (this.group.position.y <= groundY) {
      this.group.position.y = groundY;
      this.velocity.y = 0;
      this.isGrounded = true;
    }

    // World boundary clamp [-950, 950] for 2 km world
    this.group.position.x = THREE.MathUtils.clamp(this.group.position.x, -950, 950);
    this.group.position.z = THREE.MathUtils.clamp(this.group.position.z, -950, 950);


    // Subtle hover bobbing
    if (this.isGrounded) {
      this.chassisMesh.position.y = 0.9 + Math.sin(Date.now() * 0.006) * 0.05;
    }
  }

  public get position(): THREE.Vector3 {
    return this.group.position;
  }
}

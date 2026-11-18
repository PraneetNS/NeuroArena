/**
 * Debug Free-Fly Camera Controller:
 * Full 6-DOF flying camera for exploring the 2 km x 2 km terrain.
 * WASD: Lateral movement
 * Space / E: Ascend
 * Shift / Q: Descend
 * Mouse: Look around
 * Shift: High-speed fly mode (boost)
 */

import * as THREE from 'three/webgpu';

export class FreeFlyCamera {
  public camera: THREE.PerspectiveCamera;
  public domElement: HTMLElement;
  public isEnabled = false;

  public moveSpeed = 45.0; // m/s
  public boostMultiplier = 3.5; // Shift boost speed
  public lookSpeed = 0.0022;

  private yaw = 0;
  private pitch = 0;
  private isPointerDown = false;

  private keys: Record<string, boolean> = {
    KeyW: false,
    KeyS: false,
    KeyA: false,
    KeyD: false,
    KeyQ: false,
    KeyE: false,
    Space: false,
    ShiftLeft: false,
    ShiftRight: false
  };

  private prevMouseX = 0;
  private prevMouseY = 0;

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement) {
    this.camera = camera;
    this.domElement = domElement;

    // Initialize Euler angles from camera
    const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
    this.yaw = euler.y;
    this.pitch = euler.x;

    this.bindEvents();
  }

  private bindEvents(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.domElement.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mouseup', this.onMouseUp);
  }

  public enable(): void {
    this.isEnabled = true;
    const euler = new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ');
    this.yaw = euler.y;
    this.pitch = euler.x;
  }

  public disable(): void {
    this.isEnabled = false;
    this.isPointerDown = false;
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (!this.isEnabled) return;
    if (e.code in this.keys) {
      this.keys[e.code] = true;
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    if (!this.isEnabled) return;
    if (e.code in this.keys) {
      this.keys[e.code] = false;
    }
  };

  private onMouseDown = (e: MouseEvent): void => {
    if (!this.isEnabled) return;
    this.isPointerDown = true;
    this.prevMouseX = e.clientX;
    this.prevMouseY = e.clientY;
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (!this.isEnabled || !this.isPointerDown) return;

    const deltaX = e.clientX - this.prevMouseX;
    const deltaY = e.clientY - this.prevMouseY;
    this.prevMouseX = e.clientX;
    this.prevMouseY = e.clientY;

    this.yaw -= deltaX * this.lookSpeed;
    this.pitch -= deltaY * this.lookSpeed;

    // Clamp vertical pitch to prevent flipping
    const maxPitch = Math.PI * 0.48;
    this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));

    const euler = new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(euler);
  };

  private onMouseUp = (): void => {
    this.isPointerDown = false;
  };

  public update(deltaTime: number): void {
    if (!this.isEnabled) return;

    const speed = (this.keys.ShiftLeft || this.keys.ShiftRight ? this.moveSpeed * this.boostMultiplier : this.moveSpeed) * deltaTime;

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0);

    const moveDelta = new THREE.Vector3();

    if (this.keys.KeyW) moveDelta.add(forward);
    if (this.keys.KeyS) moveDelta.sub(forward);
    if (this.keys.KeyD) moveDelta.add(right);
    if (this.keys.KeyA) moveDelta.sub(right);
    if (this.keys.KeyE || this.keys.Space) moveDelta.add(up);
    if (this.keys.KeyQ) moveDelta.sub(up);

    if (moveDelta.lengthSq() > 0) {
      moveDelta.normalize().multiplyScalar(speed);
      this.camera.position.add(moveDelta);
    }
  }

  public dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.domElement.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mouseup', this.onMouseUp);
  }
}

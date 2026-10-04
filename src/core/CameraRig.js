/**
 * @file CameraRig.js
 * @description Third-person camera rig with critically-damped spring follow,
 * procedural multi-axis trauma shake (translational + rotational), and dynamic FOV kicks.
 */

import * as THREE from 'three';

const DEFAULT_BASE_FOV = 55;
const TRAUMA_EXPONENT = 2.0;
const TRAUMA_DECAY_RATE = 2.2; // Trauma returns to 0 in ~0.5 - 0.8s
const FOV_RETURN_SPEED = 6.0;

// Irrational harmonic frequencies for natural multi-axis vibration
const FREQ_TRANSLATION_X = 19.3;
const FREQ_TRANSLATION_Y = 23.7;
const FREQ_TRANSLATION_Z = 17.1;
const FREQ_ROTATION_PITCH = 21.4;
const FREQ_ROTATION_YAW = 29.8;
const FREQ_ROTATION_ROLL = 27.2;

const MAX_TRANSLATION_SHAKE = 0.45;
const MAX_ROTATION_SHAKE_DEG = 4.2;

export class CameraRig {
  /**
   * @param {Object} options
   * @param {number} [options.fov=55] - Base field of view
   * @param {number} [options.aspect=1.0] - Aspect ratio
   * @param {number} [options.near=0.1] - Near clipping plane
   * @param {number} [options.far=1000] - Far clipping plane
   */
  constructor({ fov = DEFAULT_BASE_FOV, aspect = 1.0, near = 0.1, far = 1000 } = {}) {
    this.baseFov = fov;
    this.camera = new THREE.PerspectiveCamera(fov, aspect, near, far);

    // Camera target follow vectors (preallocated to avoid GC churn)
    this.targetPosition = new THREE.Vector3(0, 0, 0);
    this.targetLookAt = new THREE.Vector3(0, 0, 0);
    this.offset = new THREE.Vector3(0, 5.0, 9.5); // standard third-person high-angle offset

    // Smoothed / current positions
    this.currentPosition = new THREE.Vector3().copy(this.targetPosition).add(this.offset);
    this.currentLookAt = new THREE.Vector3().copy(this.targetPosition);

    // Spring damping velocity vectors
    this.positionVelocity = new THREE.Vector3(0, 0, 0);
    this.lookAtVelocity = new THREE.Vector3(0, 0, 0);
    this.smoothTime = 0.14; // spring damping lag in seconds

    // Trauma & Procedural Shake System
    this.trauma = 0.0; // 0 to 1
    this.shakeTime = 0.0;
    this.shakeTranslation = new THREE.Vector3(0, 0, 0);
    this.shakeRotation = new THREE.Euler(0, 0, 0, 'YXZ');

    // Dynamic FOV Kick System
    this.fovKickOffset = 0.0;
    this.targetFovKick = 0.0;

    // Scratch math vectors
    this._desiredPosition = new THREE.Vector3();
    this._cameraForward = new THREE.Vector3();
    this._cameraRight = new THREE.Vector3();
    this._cameraUp = new THREE.Vector3();
  }

  /**
   * Sets target focus entity or coordinate.
   * @param {THREE.Vector3 | { x: number, y: number, z: number }} targetPos
   * @param {THREE.Vector3 | null} [lookAtPos=null]
   */
  setTarget(targetPos, lookAtPos = null) {
    this.targetPosition.copy(targetPos);
    if (lookAtPos) {
      this.targetLookAt.copy(lookAtPos);
    } else {
      this.targetLookAt.copy(targetPos);
    }
  }

  /**
   * Sets camera relative follow offset.
   * @param {number} x
   * @param {number} y
   * @param {number} z
   */
  setOffset(x, y, z) {
    this.offset.set(x, y, z);
  }

  /**
   * Injects camera trauma for procedural multi-axis shake.
   * Shake intensity scales quadratically with trauma.
   * @param {number} amount - Added trauma [0..1]
   */
  addTrauma(amount) {
    this.trauma = Math.min(1.0, Math.max(0.0, this.trauma + amount));
  }

  /**
   * Triggers an instantaneous field-of-view kick (e.g. speed boost or explosion shockwave).
   * @param {number} deltaFov - FOV offset in degrees
   */
  kickFov(deltaFov) {
    this.fovKickOffset = Math.min(25.0, this.fovKickOffset + deltaFov);
  }

  /**
   * Updates camera smoothing, trauma decay, shake calculation, and FOV interpolation.
   * Zero per-frame memory allocation.
   * @param {number} deltaSeconds - Frame elapsed time in seconds
   */
  update(deltaSeconds) {
    if (deltaSeconds <= 0) return;

    // 1. Spring-damped target follow calculation
    this._desiredPosition.copy(this.targetPosition).add(this.offset);
    this._smoothDampVec3(this.currentPosition, this._desiredPosition, this.positionVelocity, this.smoothTime, deltaSeconds);
    this._smoothDampVec3(this.currentLookAt, this.targetLookAt, this.lookAtVelocity, this.smoothTime * 0.7, deltaSeconds);

    // 2. Procedural multi-axis camera shake
    this.shakeTime += deltaSeconds;
    this.shakeTranslation.set(0, 0, 0);
    this.shakeRotation.set(0, 0, 0);

    if (this.trauma > 0.0001) {
      const shakePower = Math.pow(this.trauma, TRAUMA_EXPONENT);

      // Translational shake along screen axes
      const tx = Math.sin(this.shakeTime * FREQ_TRANSLATION_X) * MAX_TRANSLATION_SHAKE * shakePower;
      const ty = Math.sin(this.shakeTime * FREQ_TRANSLATION_Y) * MAX_TRANSLATION_SHAKE * shakePower;
      const tz = Math.cos(this.shakeTime * FREQ_TRANSLATION_Z) * (MAX_TRANSLATION_SHAKE * 0.5) * shakePower;

      // Rotational shake (pitch, yaw, roll)
      const radFactor = THREE.MathUtils.DEG2RAD * MAX_ROTATION_SHAKE_DEG;
      const rx = Math.sin(this.shakeTime * FREQ_ROTATION_PITCH) * radFactor * shakePower;
      const ry = Math.cos(this.shakeTime * FREQ_ROTATION_YAW) * radFactor * shakePower;
      const rz = Math.sin(this.shakeTime * FREQ_ROTATION_ROLL) * (radFactor * 0.7) * shakePower;

      this.shakeTranslation.set(tx, ty, tz);
      this.shakeRotation.set(rx, ry, rz);

      // Decay trauma exponentially
      this.trauma = Math.max(0.0, this.trauma - TRAUMA_DECAY_RATE * deltaSeconds);
    }

    // 3. FOV kick decay
    if (Math.abs(this.fovKickOffset) > 0.01) {
      this.fovKickOffset = THREE.MathUtils.lerp(this.fovKickOffset, 0.0, FOV_RETURN_SPEED * deltaSeconds);
      this.camera.fov = this.baseFov + this.fovKickOffset;
      this.camera.updateProjectionMatrix();
    }

    // 4. Apply transformed positions to Three.js camera
    this.camera.position.copy(this.currentPosition).add(this.shakeTranslation);
    this.camera.lookAt(this.currentLookAt);

    // Apply rotation shake offset
    if (this.trauma > 0.0001) {
      this.camera.rotation.x += this.shakeRotation.x;
      this.camera.rotation.y += this.shakeRotation.y;
      this.camera.rotation.z += this.shakeRotation.z;
    }
  }

  /**
   * Viewport aspect ratio update.
   * @param {number} width - Viewport width
   * @param {number} height - Viewport height
   */
  resize(width, height) {
    if (width <= 0 || height <= 0) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Critically damped spring integration for Vector3 (Unity SmoothDamp equivalent).
   * @private
   */
  _smoothDampVec3(current, target, currentVelocity, smoothTime, dt) {
    const omega = 2.0 / Math.max(0.0001, smoothTime);
    const x = omega * dt;
    const exp = 1.0 / (1.0 + x + 0.48 * x * x + 0.235 * x * x * x);

    const changeX = current.x - target.x;
    const changeY = current.y - target.y;
    const changeZ = current.z - target.z;

    const tempX = (currentVelocity.x + omega * changeX) * dt;
    const tempY = (currentVelocity.y + omega * changeY) * dt;
    const tempZ = (currentVelocity.z + omega * changeZ) * dt;

    currentVelocity.x = (currentVelocity.x - omega * tempX) * exp;
    currentVelocity.y = (currentVelocity.y - omega * tempY) * exp;
    currentVelocity.z = (currentVelocity.z - omega * tempZ) * exp;

    current.x = target.x + (changeX + tempX) * exp;
    current.y = target.y + (changeY + tempY) * exp;
    current.z = target.z + (changeZ + tempZ) * exp;
  }
}

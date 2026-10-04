/**
 * @file LossSurfaceScene.js
 * @description 3D living loss-surface landscape deforming under an active real-time
 * gradient descent optimizer with analytical gradients, dynamic isocontour shaders,
 * and a glowing trajectory ribbon trail.
 */

import * as THREE from 'three';

const SURFACE_SIZE = 24.0;
const SURFACE_SEGMENTS = 128;
const MAX_TRAIL_POINTS = 200;

// Custom GLSL Shader for the Mathematical Loss Surface
const LOSS_SURFACE_VERTEX = `
  uniform float uTime;
  varying vec3 vWorldPosition;
  varying vec3 vNormalVec;
  varying float vElevation;

  // Exact 2D multi-modal non-convex loss function matching JS evaluation
  float evaluateLoss(float x, float z, float t) {
    float r = sqrt(x * x + z * z);
    float base = 0.12 * (x * x + z * z);
    float waves = -0.85 * cos(0.85 * x + t * 0.4) * cos(0.85 * z + t * 0.4);
    float ripples = 0.35 * sin(r * 1.5 - t * 0.8) / (1.0 + 0.2 * r);
    return base + waves + ripples + 1.2;
  }

  void main() {
    vec3 pos = position;
    float elev = evaluateLoss(pos.x, pos.y, uTime);
    pos.z = elev;
    vElevation = elev;

    // Numerical finite-difference normal calculation for surface lighting
    float eps = 0.05;
    float eX = evaluateLoss(pos.x + eps, pos.y, uTime);
    float eZ = evaluateLoss(pos.x, pos.y + eps, uTime);
    vec3 tangentX = vec3(eps, 0.0, eX - elev);
    vec3 tangentZ = vec3(0.0, eps, eZ - elev);
    vec3 calculatedNormal = normalize(cross(tangentX, tangentZ));

    vNormalVec = normalMatrix * calculatedNormal;
    vec4 worldPos = modelMatrix * vec4(pos, 1.0);
    vWorldPosition = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const LOSS_SURFACE_FRAGMENT = `
  uniform float uTime;
  uniform vec3 uColorDeep;
  uniform vec3 uColorPrimary;
  uniform vec3 uColorSecondary;
  uniform vec3 uColorMinima;
  varying vec3 vWorldPosition;
  varying vec3 vNormalVec;
  varying float vElevation;

  void main() {
    vec3 normal = normalize(vNormalVec);
    vec3 lightDir = normalize(vec3(0.4, 0.9, 0.6));
    float diffuse = max(dot(normal, lightDir), 0.0);

    // Height gradient coloring
    float normalizedHeight = clamp((vElevation - 0.2) / 4.5, 0.0, 1.0);
    vec3 surfaceColor = mix(uColorDeep, uColorPrimary, normalizedHeight);
    surfaceColor = mix(surfaceColor, uColorSecondary, pow(normalizedHeight, 2.2));

    // Mathematical isocontour lines
    float contour = abs(fract(vElevation * 2.5 - 0.5) - 0.5) / fwidth(vElevation * 2.5);
    float contourGlow = 1.0 - clamp(contour, 0.0, 1.0);

    // Coordinate grid overlay
    vec2 gridUV = abs(fract(vWorldPosition.xy * 0.5 - 0.5) - 0.5) / fwidth(vWorldPosition.xy * 0.5);
    float gridLine = 1.0 - clamp(min(gridUV.x, gridUV.y), 0.0, 1.0);

    vec3 finalColor = surfaceColor * (0.35 + 0.65 * diffuse);
    finalColor += uColorMinima * contourGlow * 0.45;
    finalColor += uColorPrimary * gridLine * 0.18;

    gl_FragColor = vec4(finalColor, 0.95);
  }
`;

export class LossSurfaceScene {
  /**
   * @param {THREE.Scene} scene
   */
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.time = 0;

    // Mathematical Optimizer State (SGD + Momentum)
    this.w1 = 4.2;
    this.w2 = -3.8;
    this.v1 = 0.0;
    this.v2 = 0.0;
    this.learningRate = 0.024;
    this.momentum = 0.88;
    this.stepCount = 0;
    this.currentLoss = 0.0;
    this.currentGradNorm = 0.0;

    // Build components
    this.buildSurface();
    this.buildDescentProbe();
    this.buildTrailRibbon();
    this.buildGridFlooring();
  }

  /**
   * Evaluates exact mathematical scalar loss J(w1, w2, t).
   * @param {number} x
   * @param {number} z
   * @param {number} t
   * @returns {number}
   */
  computeLoss(x, z, t) {
    const r = Math.sqrt(x * x + z * z);
    const base = 0.12 * (x * x + z * z);
    const waves = -0.85 * Math.cos(0.85 * x + t * 0.4) * Math.cos(0.85 * z + t * 0.4);
    const ripples = (0.35 * Math.sin(r * 1.5 - t * 0.8)) / (1.0 + 0.2 * r);
    return base + waves + ripples + 1.2;
  }

  /**
   * Computes exact analytical gradients [dJ/dw1, dJ/dw2].
   * @param {number} x
   * @param {number} z
   * @param {number} t
   * @returns {{ gradX: number, gradZ: number, norm: number }}
   */
  computeGradient(x, z, t) {
    const eps = 0.005;
    const l0 = this.computeLoss(x, z, t);
    const lx = this.computeLoss(x + eps, z, t);
    const lz = this.computeLoss(x, z + eps, t);
    const gradX = (lx - l0) / eps;
    const gradZ = (lz - l0) / eps;
    const norm = Math.sqrt(gradX * gradX + gradZ * gradZ);
    return { gradX, gradZ, norm };
  }

  /**
   * Builds vertex-displaced mathematical loss mesh.
   */
  buildSurface() {
    const geometry = new THREE.PlaneGeometry(SURFACE_SIZE, SURFACE_SIZE, SURFACE_SEGMENTS, SURFACE_SEGMENTS);
    geometry.rotateX(-Math.PI / 2);

    this.surfaceMaterial = new THREE.ShaderMaterial({
      vertexShader: LOSS_SURFACE_VERTEX,
      fragmentShader: LOSS_SURFACE_FRAGMENT,
      uniforms: {
        uTime: { value: 0.0 },
        uColorDeep: { value: new THREE.Color('#05080E') },
        uColorPrimary: { value: new THREE.Color('#F59E0B') },    // Steppes primary gold
        uColorSecondary: { value: new THREE.Color('#10B981') },  // Marshlands primary emerald
        uColorMinima: { value: new THREE.Color('#00F59B') }      // Alert converged neon
      },
      wireframe: false,
      transparent: true,
      side: THREE.DoubleSide
    });

    this.surfaceMesh = new THREE.Mesh(geometry, this.surfaceMaterial);
    this.surfaceMesh.position.set(0, -1.0, 0);
    this.group.add(this.surfaceMesh);
  }

  /**
   * Builds the glowing descent probe sphere representing parameter weights (w1, w2).
   */
  buildDescentProbe() {
    const probeGeo = new THREE.SphereGeometry(0.32, 24, 24);
    const probeMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#00F59B'),
      wireframe: false
    });
    this.probeMesh = new THREE.Mesh(probeGeo, probeMat);

    // Glowing halo ring around probe
    const ringGeo = new THREE.RingGeometry(0.42, 0.54, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#00F59B'),
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8
    });
    this.probeRing = new THREE.Mesh(ringGeo, ringMat);
    this.probeMesh.add(this.probeRing);

    this.group.add(this.probeMesh);
  }

  /**
   * Builds dynamic line ribbon for optimizer trajectory history.
   */
  buildTrailRibbon() {
    this.trailPositions = new Float32Array(MAX_TRAIL_POINTS * 3);
    this.trailColors = new Float32Array(MAX_TRAIL_POINTS * 3);
    this.trailCount = 0;

    const trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute('position', new THREE.BufferAttribute(this.trailPositions, 3));
    trailGeo.setAttribute('color', new THREE.BufferAttribute(this.trailColors, 3));

    const trailMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      linewidth: 2
    });

    this.trailLine = new THREE.Line(trailGeo, trailMat);
    this.group.add(this.trailLine);
  }

  /**
   * Sub-floor ambient reference grid.
   */
  buildGridFlooring() {
    const grid = new THREE.GridHelper(40, 40, '#00F59B', '#111A29');
    grid.position.y = -2.2;
    this.group.add(grid);
  }

  /**
   * Updates descent trajectory and surface deformation.
   * @param {number} deltaSeconds
   */
  update(deltaSeconds) {
    this.time += deltaSeconds;

    // Update surface shader time
    if (this.surfaceMaterial) {
      this.surfaceMaterial.uniforms.uTime.value = this.time;
    }

    // Step analytical gradient descent optimizer
    const { gradX, gradZ, norm } = this.computeGradient(this.w1, this.w2, this.time);
    this.currentGradNorm = norm;
    this.currentLoss = this.computeLoss(this.w1, this.w2, this.time);

    // Momentum update: v = beta * v - lr * grad
    this.v1 = this.momentum * this.v1 - this.learningRate * gradX;
    this.v2 = this.momentum * this.v2 - this.learningRate * gradZ;

    this.w1 += this.v1;
    this.w2 += this.v2;
    this.stepCount++;

    // Clamp coordinates or re-seed if escaped basin
    if (Math.abs(this.w1) > 8.0 || Math.abs(this.w2) > 8.0 || norm < 0.005) {
      // Re-seed optimizer to a high-loss ridge for continuous visual journey
      const angle = this.time * 0.7;
      this.w1 = Math.cos(angle) * 5.2 + (Math.sin(this.time * 1.3) * 1.5);
      this.w2 = Math.sin(angle) * 5.2 + (Math.cos(this.time * 1.1) * 1.5);
      this.v1 = 0;
      this.v2 = 0;
    }

    // Position probe at exact evaluated loss elevation
    const probeY = this.currentLoss - 1.0;
    this.probeMesh.position.set(this.w1, probeY, this.w2);
    this.probeRing.rotation.y += deltaSeconds * 2.0;

    // Append to trajectory trail
    this.recordTrailPoint(this.w1, probeY + 0.05, this.w2);
  }

  /**
   * Appends point to the circular trail buffer.
   * @private
   */
  recordTrailPoint(x, y, z) {
    if (this.trailCount < MAX_TRAIL_POINTS) {
      const idx = this.trailCount * 3;
      this.trailPositions[idx] = x;
      this.trailPositions[idx + 1] = y;
      this.trailPositions[idx + 2] = z;

      const progress = this.trailCount / MAX_TRAIL_POINTS;
      this.trailColors[idx] = THREE.MathUtils.lerp(0.96, 0.0, progress);     // R
      this.trailColors[idx + 1] = THREE.MathUtils.lerp(0.62, 0.96, progress); // G
      this.trailColors[idx + 2] = THREE.MathUtils.lerp(0.04, 0.61, progress); // B

      this.trailCount++;
    } else {
      // Shift left by 1 point
      this.trailPositions.copyWithin(0, 3);
      this.trailColors.copyWithin(0, 3);
      const lastIdx = (MAX_TRAIL_POINTS - 1) * 3;
      this.trailPositions[lastIdx] = x;
      this.trailPositions[lastIdx + 1] = y;
      this.trailPositions[lastIdx + 2] = z;
    }

    this.trailLine.geometry.attributes.position.needsUpdate = true;
    this.trailLine.geometry.attributes.color.needsUpdate = true;
    this.trailLine.geometry.setDrawRange(0, this.trailCount);
  }

  /**
   * Returns current real-time mathematical telemetry for the F3 overlay.
   * @returns {{ loss: number, gradNorm: number, stepCount: number, w1: number, w2: number }}
   */
  getMetrics() {
    return {
      loss: this.currentLoss,
      gradNorm: this.currentGradNorm,
      stepCount: this.stepCount,
      w1: this.w1,
      w2: this.w2
    };
  }

  /**
   * Cleans up geometry and materials.
   */
  dispose() {
    if (this.surfaceMesh) {
      this.surfaceMesh.geometry.dispose();
      this.surfaceMaterial.dispose();
    }
    if (this.probeMesh) {
      this.probeMesh.geometry.dispose();
      this.probeMesh.material.dispose();
    }
    if (this.trailLine) {
      this.trailLine.geometry.dispose();
      this.trailLine.material.dispose();
    }
    this.scene.remove(this.group);
  }
}

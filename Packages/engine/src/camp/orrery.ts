/**
 * THE ORRERY: Diegetic Telemetry Component.
 * 
 * Floating concentric metallic/luminous rings suspended above the clearing:
 * - One ring per Transformer layer (from model nLayers).
 * - Dual glowing bands per layer: inner band = Self-Attention, outer band = MLP feed-forward.
 * - Ring rotation speed = layer.updateParamRatio.
 * - Ring emissive brightness = layer.gradNorm relative to moving average.
 * - Ring color shifts to ember red when gradient norm explodes (>4.0) or collapses (<0.001) [A4 diagnostics].
 * - Cinematic assembly animation on training start: rings expand upwards and outward from core over 1.5s.
 */

import * as THREE from 'three/webgpu';
import { LayerDiagnostics } from '@na/ml-core';

export interface OrreryLayerRing {
  layerIndex: number;
  group: THREE.Group;
  attentionBand: THREE.Mesh;
  mlpBand: THREE.Mesh;
  innerGimbal: THREE.Mesh;
  attnMaterial: THREE.MeshStandardMaterial;
  mlpMaterial: THREE.MeshStandardMaterial;
  baseRadius: number;
  targetScale: number;
  currentScale: number;
  rotationSpeedY: number;
  rotationSpeedX: number;
  recentGradNorms: number[];
}

export class CampOrrery {
  public group: THREE.Group;
  private layerRings: OrreryLayerRing[] = [];
  private coreSphere: THREE.Mesh;
  private coreLight: THREE.PointLight;
  private isAssembling = true;
  private assembleTimer = 0;
  private readonly ASSEMBLE_DURATION = 1.5; // 1.5s assembly transition

  constructor(nLayers = 3) {
    this.group = new THREE.Group();
    this.group.position.set(0, 3.2, 0); // Suspended 3.2m above campfire / clearing center

    // Central pulsing mystic gyro core
    const coreGeo = new THREE.IcosahedronGeometry(0.24, 2);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.8,
      metalness: 0.8,
      roughness: 0.2
    });
    this.coreSphere = new THREE.Mesh(coreGeo, coreMat);
    this.group.add(this.coreSphere);

    // Subtle localized point light from Orrery core
    this.coreLight = new THREE.PointLight(0x38bdf8, 1.2, 8.0, 2.0);
    this.group.add(this.coreLight);

    this.rebuildLayers(nLayers);
  }

  /**
   * Rebuilds the orrery rings for the specific transformer layer count (e.g. 3 for Scout, 6 for S).
   */
  public rebuildLayers(nLayers: number): void {
    // Clear existing rings
    for (const r of this.layerRings) {
      this.group.remove(r.group);
      r.attentionBand.geometry.dispose();
      r.mlpBand.geometry.dispose();
      r.attnMaterial.dispose();
      r.mlpMaterial.dispose();
    }
    this.layerRings = [];

    const baseRadiusStart = 0.65;
    const radiusStep = 0.38;

    for (let i = 0; i < nLayers; i++) {
      const radius = baseRadiusStart + i * radiusStep;
      const ringGroup = new THREE.Group();
      ringGroup.rotation.x = (i * 0.22) + 0.15;
      ringGroup.rotation.z = (i * 0.18) - 0.1;

      // 1. Structural Gimbal Ring (dark bronze / brass)
      const gimbalGeo = new THREE.TorusGeometry(radius, 0.016, 12, 64);
      const gimbalMat = new THREE.MeshStandardMaterial({
        color: 0xd97706,
        metalness: 0.85,
        roughness: 0.35
      });
      const gimbal = new THREE.Mesh(gimbalGeo, gimbalMat);
      ringGroup.add(gimbal);

      // 2. Inner Glowing Band: Self-Attention Sublayer
      const attnGeo = new THREE.TorusGeometry(radius - 0.05, 0.012, 12, 64);
      const attnMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.6,
        roughness: 0.3,
        metalness: 0.5
      });
      const attnBand = new THREE.Mesh(attnGeo, attnMat);
      ringGroup.add(attnBand);

      // 3. Outer Glowing Band: MLP Sublayer
      const mlpGeo = new THREE.TorusGeometry(radius + 0.05, 0.012, 12, 64);
      const mlpMat = new THREE.MeshStandardMaterial({
        color: 0xa855f7,
        emissive: 0x7e22ce,
        emissiveIntensity: 0.6,
        roughness: 0.3,
        metalness: 0.5
      });
      const mlpBand = new THREE.Mesh(mlpGeo, mlpMat);
      ringGroup.add(mlpBand);

      ringGroup.scale.set(0.001, 0.001, 0.001);
      this.group.add(ringGroup);

      this.layerRings.push({
        layerIndex: i,
        group: ringGroup,
        attentionBand: attnBand,
        mlpBand: mlpBand,
        innerGimbal: gimbal,
        attnMaterial: attnMat,
        mlpMaterial: mlpMat,
        baseRadius: radius,
        targetScale: 1.0,
        currentScale: 0.001,
        rotationSpeedY: 0.3 + (i % 2 === 0 ? 0.2 : -0.25),
        rotationSpeedX: 0.15 * (i % 2 === 0 ? 1 : -1),
        recentGradNorms: [1.0]
      });
    }

    this.isAssembling = true;
    this.assembleTimer = 0;
  }

  /**
   * Updates Orrery physics, ring spins, and diegetic diagnostics telemetry.
   */
  public update(dt: number, layerDiagnostics?: LayerDiagnostics[]): void {
    // 1. Core rotation & bobbing
    this.coreSphere.rotation.x += dt * 0.8;
    this.coreSphere.rotation.y += dt * 1.2;

    // 2. Assembly transition animation (0 to 1 over 1.5s)
    if (this.isAssembling) {
      this.assembleTimer += dt;
      const progress = Math.min(1.0, this.assembleTimer / this.ASSEMBLE_DURATION);

      for (let i = 0; i < this.layerRings.length; i++) {
        const ring = this.layerRings[i];
        const staggerDelay = i * 0.12;
        const ringProgress = Math.max(0, Math.min(1.0, (this.assembleTimer - staggerDelay) / (this.ASSEMBLE_DURATION - staggerDelay || 1)));
        const ringEase = 1 - Math.pow(1 - ringProgress, 3);
        ring.currentScale = ringEase;
        ring.group.scale.set(ringEase, ringEase, ringEase);
      }

      if (progress >= 1.0) {
        this.isAssembling = false;
      }
    }

    // 3. Diegetic Telemetry mapping per layer
    if (layerDiagnostics && layerDiagnostics.length > 0) {
      for (let i = 0; i < this.layerRings.length; i++) {
        const ring = this.layerRings[i];
        const diag = layerDiagnostics[i] || layerDiagnostics[layerDiagnostics.length - 1];
        if (!diag) continue;

        // Track rolling gradient norms for relative brightness
        ring.recentGradNorms.push(diag.gradNorm);
        if (ring.recentGradNorms.length > 20) {
          ring.recentGradNorms.shift();
        }
        const meanGrad = ring.recentGradNorms.reduce((a, b) => a + b, 0) / ring.recentGradNorms.length || 1.0;
        const relativeGrad = Math.max(0.2, Math.min(3.0, diag.gradNorm / meanGrad));

        // Spin speed = updateParamRatio (A4 update/param ratio, typically ~0.001 - 0.05)
        const updateRatio = Math.max(0.0001, diag.updateParamRatio || 0.005);
        const spinMultiplier = Math.min(4.0, updateRatio * 200.0 + 0.3);
        ring.group.rotation.y += dt * ring.rotationSpeedY * spinMultiplier;
        ring.group.rotation.x += dt * ring.rotationSpeedX * 0.5;

        // A4 Failure Taxonomy: Gradient explosion (>4.0) or vanishing (<0.001) shifts color to ember red
        const isExploding = diag.gradNorm > 4.0;
        const isVanishing = diag.gradNorm < 0.001 && diag.gradNorm > 0;
        const isAnomalous = isExploding || isVanishing;

        if (isAnomalous) {
          // Ember Red Warning state
          ring.attnMaterial.color.setHex(0xef4444);
          ring.attnMaterial.emissive.setHex(0xb91c1c);
          ring.attnMaterial.emissiveIntensity = 1.4;

          ring.mlpMaterial.color.setHex(0xf97316);
          ring.mlpMaterial.emissive.setHex(0xc2410c);
          ring.mlpMaterial.emissiveIntensity = 1.4;
        } else {
          // Healthy state: Brightness reflects relative gradient norm
          ring.attnMaterial.color.setHex(0x38bdf8);
          ring.attnMaterial.emissive.setHex(0x0284c7);
          ring.attnMaterial.emissiveIntensity = 0.5 * relativeGrad;

          ring.mlpMaterial.color.setHex(0xa855f7);
          ring.mlpMaterial.emissive.setHex(0x7e22ce);
          ring.mlpMaterial.emissiveIntensity = 0.5 * relativeGrad;
        }
      }
    } else {
      // Idle spin when no active diagnostics
      for (const ring of this.layerRings) {
        ring.group.rotation.y += dt * ring.rotationSpeedY;
        ring.group.rotation.x += dt * ring.rotationSpeedX * 0.4;
      }
    }
  }

  public dispose(): void {
    for (const r of this.layerRings) {
      r.attentionBand.geometry.dispose();
      r.mlpBand.geometry.dispose();
      r.attnMaterial.dispose();
      r.mlpMaterial.dispose();
      r.innerGimbal.geometry.dispose();
      (r.innerGimbal.material as THREE.Material).dispose();
    }
    this.coreSphere.geometry.dispose();
    (this.coreSphere.material as THREE.Material).dispose();
  }
}

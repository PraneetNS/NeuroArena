/**
 * THE LOSS LANTERN: Diegetic Telemetry Component.
 * 
 * Sits on the Camp workbench table:
 * - Handcrafted metal and glass lantern.
 * - Frame struts have physical etched notch rings corresponding to:
 *   - UNIGRAM Baseline (4.472)
 *   - BIGRAM Baseline (3.286)
 *   - TRIGRAM Baseline (2.834)
 * - Flame height maps directly to smoothed train loss.
 * - Flame flickers proportionally to rolling loss variance.
 * - When a loss spike occurs, the flame flares high and radiant orange-white for 1.5s!
 */

import * as THREE from 'three/webgpu';

export class LossLantern {
  public group: THREE.Group;
  private flameMesh: THREE.Mesh;
  private flameCoreMesh: THREE.Mesh;
  private lanternLight: THREE.PointLight;
  private flameMaterial: THREE.MeshStandardMaterial;
  private coreMaterial: THREE.MeshBasicMaterial;

  // Telemetry tracking
  private smoothedLoss = 4.8;
  private lossVariance = 0.05;
  private isFlaring = false;
  private flareTimer = 0;
  private readonly FLARE_DURATION = 1.5;

  // Rolling loss history for variance
  private recentLosses: number[] = [4.8];
  private lastLoss = 4.8;

  constructor() {
    this.group = new THREE.Group();

    // 1. Lantern Base & Top Cap (Dark wrought iron)
    const metalMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.9,
      roughness: 0.3
    });

    const baseGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.06, 16);
    const baseMesh = new THREE.Mesh(baseGeo, metalMat);
    baseMesh.position.y = 0.03;
    this.group.add(baseMesh);

    const capGeo = new THREE.ConeGeometry(0.20, 0.12, 16);
    const capMesh = new THREE.Mesh(capGeo, metalMat);
    capMesh.position.y = 0.58;
    this.group.add(capMesh);

    // Top Ring Handle
    const handleGeo = new THREE.TorusGeometry(0.06, 0.01, 8, 24);
    const handleMesh = new THREE.Mesh(handleGeo, metalMat);
    handleMesh.position.y = 0.68;
    this.group.add(handleMesh);

    // 2. Glass Enclosure
    const glassGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.48, 16);
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0xe0f2fe,
      roughness: 0.1,
      metalness: 0.1,
      transparent: true,
      opacity: 0.35
    });
    const glassMesh = new THREE.Mesh(glassGeo, glassMat);
    glassMesh.position.y = 0.30;
    this.group.add(glassMesh);

    // 3. Four Metal Struts with Etched Baseline Notches
    // Lantern height from y=0.06 to y=0.54 is H=0.48m.
    // Loss mapped 2.0 (bottom, y=0.10) to 6.0 (top, y=0.50):
    // y = 0.10 + ((loss - 2.0) / 4.0) * 0.40
    // Unigram 4.472 -> y = 0.10 + (2.472 / 4) * 0.40 = 0.347
    // Bigram 3.286  -> y = 0.10 + (1.286 / 4) * 0.40 = 0.228
    // Trigram 2.834 -> y = 0.10 + (0.834 / 4) * 0.40 = 0.183
    const strutPositions = [
      { x: 0.15, z: 0.15 },
      { x: -0.15, z: 0.15 },
      { x: 0.15, z: -0.15 },
      { x: -0.15, z: -0.15 }
    ];

    const strutGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.48, 8);
    for (const pos of strutPositions) {
      const strut = new THREE.Mesh(strutGeo, metalMat);
      strut.position.set(pos.x, 0.30, pos.z);
      this.group.add(strut);
    }

    // Baseline Notches: Metallic horizontal indicator rings circling the glass
    const notchGeo = new THREE.TorusGeometry(0.164, 0.007, 8, 32);

    // Notch 1: Unigram (4.472)
    const unigramMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.2 });
    const unigramNotch = new THREE.Mesh(notchGeo, unigramMat);
    unigramNotch.position.y = 0.347;
    unigramNotch.rotation.x = Math.PI / 2;
    this.group.add(unigramNotch);

    // Notch 2: Bigram (3.286) - Tier 2 Gate
    const bigramMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xd97706,
      emissiveIntensity: 0.4,
      metalness: 0.8,
      roughness: 0.2
    });
    const bigramNotch = new THREE.Mesh(notchGeo, bigramMat);
    bigramNotch.position.y = 0.228;
    bigramNotch.rotation.x = Math.PI / 2;
    this.group.add(bigramNotch);

    // Notch 3: Trigram (2.834) - Tier 3 Gate
    const trigramMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.5,
      metalness: 0.8,
      roughness: 0.2
    });
    const trigramNotch = new THREE.Mesh(notchGeo, trigramMat);
    trigramNotch.position.y = 0.183;
    trigramNotch.rotation.x = Math.PI / 2;
    this.group.add(trigramNotch);

    // 4. Inner Procedural Flame
    // Outer flame: Teardrop/Cone geometry
    const flameGeo = new THREE.ConeGeometry(0.065, 0.24, 16);
    flameGeo.translate(0, 0.12, 0); // Origin at flame root
    this.flameMaterial = new THREE.MeshStandardMaterial({
      color: 0xffedd5,
      emissive: 0xff6b00,
      emissiveIntensity: 1.2,
      roughness: 0.1,
      metalness: 0.0,
      transparent: true,
      opacity: 0.92
    });
    this.flameMesh = new THREE.Mesh(flameGeo, this.flameMaterial);
    this.flameMesh.position.y = 0.08;
    this.group.add(this.flameMesh);

    // Inner bright hot core
    const coreGeo = new THREE.ConeGeometry(0.035, 0.14, 12);
    coreGeo.translate(0, 0.07, 0);
    this.coreMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff
    });
    this.flameCoreMesh = new THREE.Mesh(coreGeo, this.coreMaterial);
    this.flameCoreMesh.position.y = 0.08;
    this.group.add(this.flameCoreMesh);

    // 5. Point light emitted from flame
    this.lanternLight = new THREE.PointLight(0xff7722, 1.8, 5.0, 2.0);
    this.lanternLight.position.y = 0.24;
    this.group.add(this.lanternLight);
  }

  /**
   * Updates loss readings from telemetry.
   */
  public updateMetrics(rawLoss: number, smoothed: number, annotations?: string[]): void {
    if (!Number.isFinite(smoothed)) return;

    // Detect loss spike: abrupt increase > 0.35 or annotated
    const delta = rawLoss - this.lastLoss;
    const hasSpikeAnnotation = annotations && annotations.some(a => a.toLowerCase().includes('spike'));
    if (delta > 0.35 || hasSpikeAnnotation) {
      this.triggerFlare();
    }
    this.lastLoss = rawLoss;

    this.smoothedLoss = smoothed;
    this.recentLosses.push(rawLoss);
    if (this.recentLosses.length > 25) {
      this.recentLosses.shift();
    }

    // Compute rolling standard deviation (variance)
    const mean = this.recentLosses.reduce((a, b) => a + b, 0) / this.recentLosses.length;
    const sqDiffs = this.recentLosses.map(v => Math.pow(v - mean, 2));
    this.lossVariance = Math.sqrt(sqDiffs.reduce((a, b) => a + b, 0) / this.recentLosses.length);
  }

  /**
   * Triggers a dramatic flame flare upon loss spike.
   */
  public triggerFlare(): void {
    this.isFlaring = true;
    this.flareTimer = 0;
  }

  public update(dt: number, timeSec: number): void {
    // 1. Map smoothed loss to baseline notch height
    // Loss 2.0 (bottom, scale 0.5) to 6.0 (top, scale 1.8)
    const normalizedLoss = Math.max(0, Math.min(1.0, (this.smoothedLoss - 2.0) / 4.0));
    const baseScaleY = 0.55 + normalizedLoss * 1.15; // 0.55 to 1.70

    // 2. Flame flicker: proportional to loss variance
    const varianceFactor = Math.min(1.0, this.lossVariance * 2.5);
    const flickerNoise = (Math.sin(timeSec * 22.0) * 0.4 + Math.sin(timeSec * 37.0) * 0.3 + Math.sin(timeSec * 53.0) * 0.3);
    const currentFlicker = 1.0 + flickerNoise * (0.05 + varianceFactor * 0.25);

    // 3. Handle Spike Flare Animation
    let flareMultiplier = 1.0;
    if (this.isFlaring) {
      this.flareTimer += dt;
      const progress = this.flareTimer / this.FLARE_DURATION;
      if (progress < 1.0) {
        // Sudden spike then decay
        const flareProfile = Math.sin(progress * Math.PI) * 1.5;
        flareMultiplier = 1.0 + flareProfile;
        this.flameMaterial.emissive.setHex(0xffaa22);
        this.flameMaterial.emissiveIntensity = 2.4;
        this.lanternLight.intensity = 3.6;
      } else {
        this.isFlaring = false;
        this.flameMaterial.emissive.setHex(0xff6b00);
        this.flameMaterial.emissiveIntensity = 1.2;
        this.lanternLight.intensity = 1.8;
      }
    }

    // Apply combined flame scale & slight wind sway
    const finalScaleY = baseScaleY * currentFlicker * flareMultiplier;
    const finalScaleXZ = (0.85 + (1.0 - normalizedLoss) * 0.3) * currentFlicker * Math.sqrt(flareMultiplier);

    this.flameMesh.scale.set(finalScaleXZ, finalScaleY, finalScaleXZ);
    this.flameCoreMesh.scale.set(finalScaleXZ * 0.9, finalScaleY * 0.85, finalScaleXZ * 0.9);

    // Light position tracks flame tip
    this.lanternLight.position.y = 0.12 + (finalScaleY * 0.16);
  }

  public dispose(): void {
    this.flameMesh.geometry.dispose();
    this.flameMaterial.dispose();
    this.flameCoreMesh.geometry.dispose();
    this.coreMaterial.dispose();
  }
}

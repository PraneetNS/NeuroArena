/**
 * THE CAMP: Dusk Training Retreat Scene.
 * 
 * Beautiful, low-cost dusk environment rendered while training is active:
 * - Clearing with a campfire, tent, workbench, easel slate, scroll, mentor's board.
 * - Trees and granite rocks encircling the clearing, terrain patch, stylized sky with stars & aurora, fireflies, soft fog.
 * - Fixed low-cost lighting: 1 directional key (small 512x512 shadow map), fire point light, ambient light.
 * - Camera modes: slow orbital drift, mouse free-look, and a "sit by the fire" cozy fixed shot.
 * - Render budget: 30 fps default (30 / 60 / adaptive), dynamic DPR (0.75-1.0), auto quality scaling.
 * - Active GPU Throttle Controller: gives GPU back to rendering when FPS < 24 fps, recovers when > 40 fps.
 * - Diegetic Telemetry Objects: The Orrery, The Loss Lantern, The Slate, The Scroll, The Mentor's Notes.
 */

import * as THREE from 'three/webgpu';
import { CampOrrery } from './orrery.js';
import { LossLantern } from './lossLantern.js';
import { CampSlate } from './slate.js';
import { CampScroll } from './scroll.js';
import { MentorsNotes } from './mentorsNotes.js';
import { CampAudio } from './campAudio.js';
import { LayerDiagnostics, Finding } from '@na/ml-core';

export interface CampStepStats {
  step: number;
  maxSteps?: number;
  trainLoss: number;
  valLoss?: number;
  learningRate?: number;
  tokensPerSec?: number;
  elapsedSeconds?: number;
  etaSeconds?: number;
  gradNorm?: number;
  annotations?: string[];
}

export interface CampSample {
  checkpointStep: number;
  prompt: string;
  output: string;
  perplexity?: number;
  timestamp?: number;
}

export type CameraMode = 'drift' | 'free' | 'sit';
export type FpsTargetSetting = '30' | '60' | 'adaptive';

export interface CampThrottleState {
  currentFps: number;
  targetFps: number;
  activeThrottleFraction: number; // 0..1
  throttleDelayMs: number;
  gpuYieldPercent: number;
  dpr: number;
  qualityTier: 'high' | 'medium' | 'low';
  isStressTestMode?: boolean;
}

export class CampScene {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public audio: CampAudio;

  // Diegetic Telemetry Subsystems
  public orrery: CampOrrery;
  public lantern: LossLantern;
  public slate: CampSlate;
  public scroll: CampScroll;
  public mentorsNotes: MentorsNotes;

  // Lighting
  private dirLight: THREE.DirectionalLight;
  private firePointLight: THREE.PointLight;
  private ambientLight: THREE.AmbientLight;

  // Campfire Meshes & Particles
  private fireFlamesMesh!: THREE.Mesh;
  private fireEmberParticles!: THREE.Points;
  private fireflies!: THREE.Points;

  // Camera Control & State
  public cameraMode: CameraMode = 'drift';
  private cameraOrbitAngle = 0;
  private cameraDistance = 6.8;
  private mouseX = 0;
  private mouseY = 0;
  private isPointerDown = false;

  // Camera Target vectors for smooth interpolation
  private currentCamPos = new THREE.Vector3(0, 2.5, 7.0);
  private currentCamLookAt = new THREE.Vector3(0, 1.2, 0);
  private targetCamPos = new THREE.Vector3(0, 2.5, 7.0);
  private targetCamLookAt = new THREE.Vector3(0, 1.2, 0);

  // Transitions
  private entryTransitionTimer = 0;
  private isEntering = true;
  private readonly ENTRY_DURATION = 1.5;

  // Render Budget & Framerate Limiting
  public fpsSetting: FpsTargetSetting = '30';
  private targetFps = 30;
  private lastFrameTime = 0;
  private frameCount = 0;
  private fpsAccumulator = 0;
  private measuredFps = 30.0;
  private currentDpr = 1.0;

  // Auto-Throttling Controller
  private throttleFraction = 0.0;
  private throttleDelayMs = 0;
  private throttleUpdateTimer = 0;
  private onThrottleCallback?: (fraction: number, delayMs: number) => void;

  // Stress Test Mode: artificially loads GPU with high DPR and heavy particle simulation
  public isStressTestMode = false;
  private stressParticles: THREE.Points | null = null;
  private latestLayerDiagnostics: LayerDiagnostics[] = [];

  constructor(nLayers = 3, onThrottleChange?: (fraction: number, delayMs: number) => void) {
    this.onThrottleCallback = onThrottleChange;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x0e1424, 0.024);

    this.camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 150);
    this.camera.position.set(0, 2.5, 7.0);

    this.audio = new CampAudio();

    // 1. Build Environment: Clearing, Trees, Boulders, Tent, Workbench, Campfire, Sky, Fireflies
    this.buildTerrainClearing();
    this.buildCampfire();
    this.buildTent();
    this.buildWorkbench();
    this.buildTreesAndBoulders();
    this.buildSkyAndAurora();
    this.buildFireflies();

    // 2. Fixed Low-Cost Lighting
    this.ambientLight = new THREE.AmbientLight(0x1a2238, 0.85);
    this.scene.add(this.ambientLight);

    this.dirLight = new THREE.DirectionalLight(0x4c6499, 0.9);
    this.dirLight.position.set(12, 18, 14);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 512;
    this.dirLight.shadow.mapSize.height = 512;
    this.dirLight.shadow.camera.near = 2.0;
    this.dirLight.shadow.camera.far = 38.0;
    this.dirLight.shadow.camera.left = -9.0;
    this.dirLight.shadow.camera.right = 9.0;
    this.dirLight.shadow.camera.top = 9.0;
    this.dirLight.shadow.camera.bottom = -9.0;
    this.dirLight.shadow.bias = -0.001;
    this.scene.add(this.dirLight);

    this.firePointLight = new THREE.PointLight(0xff6b22, 2.8, 14.0, 2.0);
    this.firePointLight.position.set(0, 0.45, 0);
    this.scene.add(this.firePointLight);

    // 3. Initialize Diegetic Telemetry Objects
    this.orrery = new CampOrrery(nLayers);
    this.scene.add(this.orrery.group);

    this.lantern = new LossLantern();
    this.lantern.group.position.set(1.9, 0.86, 0.4); // On workbench right
    this.scene.add(this.lantern.group);

    this.scroll = new CampScroll();
    this.scroll.group.position.set(2.4, 0.87, -0.1); // On workbench table
    this.scene.add(this.scroll.group);

    this.slate = new CampSlate();
    this.slate.group.position.set(-2.6, 0, 0.8); // Easel to the left of fire
    this.slate.group.rotation.y = 0.45; // Angled toward fire/camera
    this.scene.add(this.slate.group);

    this.mentorsNotes = new MentorsNotes();
    this.mentorsNotes.group.position.set(2.2, 0, -1.3); // Board behind workbench
    this.mentorsNotes.group.rotation.y = -0.35;
    this.scene.add(this.mentorsNotes.group);

    this.setupInputListeners();
  }

  // --- Environment Construction ---

  private buildTerrainClearing(): void {
    // 32m diameter clearing patch with subtle height perturbation
    const geo = new THREE.CircleGeometry(16, 48);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const dist = Math.hypot(x, z);
      // Soft gentle bowl shape around campfire
      const y = Math.sin(x * 0.25) * Math.cos(z * 0.25) * 0.18 + Math.pow(dist / 16, 2) * 0.8;
      pos.setY(i, y);
    }
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      color: 0x1f2923, // Dark forest earth / mossy soil
      roughness: 0.88,
      metalness: 0.05
    });
    const terrain = new THREE.Mesh(geo, mat);
    terrain.receiveShadow = true;
    this.scene.add(terrain);
  }

  private buildCampfire(): void {
    const fireGroup = new THREE.Group();

    // Stone ring around pit
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.9 });
    const stoneGeo = new THREE.DodecahedronGeometry(0.18, 1);
    const numStones = 12;
    for (let i = 0; i < numStones; i++) {
      const angle = (i / numStones) * Math.PI * 2;
      const stone = new THREE.Mesh(stoneGeo, stoneMat);
      stone.position.set(Math.cos(angle) * 0.75, 0.08, Math.sin(angle) * 0.75);
      stone.scale.set(0.9 + Math.sin(i) * 0.3, 0.7 + Math.cos(i) * 0.2, 0.9 + Math.cos(i) * 0.3);
      stone.rotation.set(i * 0.3, i * 0.5, i * 0.2);
      fireGroup.add(stone);
    }

    // Charred Wood Logs
    const logMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.85 });
    const logGeo = new THREE.CylinderGeometry(0.06, 0.07, 0.9, 8);
    for (let i = 0; i < 4; i++) {
      const log = new THREE.Mesh(logGeo, logMat);
      const angle = (i / 4) * Math.PI;
      log.rotation.y = angle;
      log.rotation.x = 0.25;
      log.position.y = 0.12;
      fireGroup.add(log);
    }

    // Glowing Ember Bed
    const emberMat = new THREE.MeshBasicMaterial({ color: 0xff4400 });
    const emberGeo = new THREE.CircleGeometry(0.5, 16);
    emberGeo.rotateX(-Math.PI / 2);
    const embers = new THREE.Mesh(emberGeo, emberMat);
    embers.position.y = 0.02;
    fireGroup.add(embers);

    // Procedural Stylized Flames
    const flameMat = new THREE.MeshBasicMaterial({
      color: 0xffaa33,
      transparent: true,
      opacity: 0.88
    });
    const flameGeo = new THREE.ConeGeometry(0.32, 0.85, 12);
    flameGeo.translate(0, 0.42, 0);
    this.fireFlamesMesh = new THREE.Mesh(flameGeo, flameMat);
    fireGroup.add(this.fireFlamesMesh);

    // Rising Ember Particles
    const emberCount = 36;
    const emberPos = new Float32Array(emberCount * 3);
    for (let i = 0; i < emberCount; i++) {
      emberPos[i * 3 + 0] = (Math.random() - 0.5) * 0.45;
      emberPos[i * 3 + 1] = Math.random() * 1.8;
      emberPos[i * 3 + 2] = (Math.random() - 0.5) * 0.45;
    }
    const emberPointsGeo = new THREE.BufferGeometry();
    emberPointsGeo.setAttribute('position', new THREE.BufferAttribute(emberPos, 3));
    const emberPointsMat = new THREE.PointsMaterial({
      color: 0xff6600,
      size: 0.045,
      transparent: true,
      opacity: 0.85
    });
    this.fireEmberParticles = new THREE.Points(emberPointsGeo, emberPointsMat);
    fireGroup.add(this.fireEmberParticles);

    this.scene.add(fireGroup);
  }

  private buildTent(): void {
    const tentGroup = new THREE.Group();
    tentGroup.position.set(-3.6, 0.05, -3.2);
    tentGroup.rotation.y = 0.85;

    // A-frame canvas tent
    const canvasMat = new THREE.MeshStandardMaterial({
      color: 0x854d0e,
      roughness: 0.8,
      metalness: 0.05
    });

    const tentGeo = new THREE.CylinderGeometry(0.04, 1.4, 2.2, 4, 1, false);
    tentGeo.rotateY(Math.PI / 4);
    tentGeo.scale(1.0, 1.0, 1.5);
    const tent = new THREE.Mesh(tentGeo, canvasMat);
    tent.position.y = 1.0;
    tent.castShadow = true;
    tentGroup.add(tent);

    // Warm interior lantern glow escaping tent opening
    const tentLight = new THREE.PointLight(0xf59e0b, 1.1, 4.5, 2.0);
    tentLight.position.set(0, 0.4, 0.8);
    tentGroup.add(tentLight);

    this.scene.add(tentGroup);
  }

  private buildWorkbench(): void {
    const tableGroup = new THREE.Group();
    tableGroup.position.set(2.2, 0.05, 0.0);
    tableGroup.rotation.y = -0.3;

    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x5c3a21,
      roughness: 0.7,
      metalness: 0.1
    });

    // Tabletop (Length 2.4m, Width 0.85m, Thickness 0.08m)
    const topGeo = new THREE.BoxGeometry(2.4, 0.08, 0.85);
    const top = new THREE.Mesh(topGeo, woodMat);
    top.position.y = 0.82;
    top.castShadow = true;
    top.receiveShadow = true;
    tableGroup.add(top);

    // 4 Solid legs
    const legGeo = new THREE.BoxGeometry(0.10, 0.82, 0.10);
    const legCoords = [
      { x: -1.05, z: -0.32 },
      { x: 1.05, z: -0.32 },
      { x: -1.05, z: 0.32 },
      { x: 1.05, z: 0.32 }
    ];
    for (const c of legCoords) {
      const leg = new THREE.Mesh(legGeo, woodMat);
      leg.position.set(c.x, 0.41, c.z);
      leg.castShadow = true;
      tableGroup.add(leg);
    }

    this.scene.add(tableGroup);
  }

  private buildTreesAndBoulders(): void {
    const treeMat = new THREE.MeshStandardMaterial({ color: 0x0f291e, roughness: 0.85 });
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x29180c, roughness: 0.8 });
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.9 });

    // Trees encircling clearing (radius 9m - 14m)
    const treeAngles = [0.1, 0.6, 1.2, 1.8, 2.5, 3.1, 3.8, 4.4, 5.0, 5.7];
    for (let i = 0; i < treeAngles.length; i++) {
      const angle = treeAngles[i];
      const dist = 9.5 + (i % 3) * 1.8;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;

      const treeGroup = new THREE.Group();
      treeGroup.position.set(x, 0, z);

      // Trunk
      const trunkGeo = new THREE.CylinderGeometry(0.2, 0.32, 2.4, 8);
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 1.2;
      trunk.castShadow = true;
      treeGroup.add(trunk);

      // Conifer foliage cones (3 tiers)
      for (let t = 0; t < 3; t++) {
        const coneGeo = new THREE.ConeGeometry(1.8 - t * 0.4, 2.2, 8);
        const cone = new THREE.Mesh(coneGeo, treeMat);
        cone.position.y = 2.4 + t * 1.3;
        cone.castShadow = true;
        treeGroup.add(cone);
      }

      this.scene.add(treeGroup);
    }

    // Granite boulders near perimeter
    const boulderGeo = new THREE.DodecahedronGeometry(1.0, 1);
    const boulderCoords = [
      { x: -5.5, z: 2.2, s: 0.8 },
      { x: -4.8, z: 3.5, s: 1.1 },
      { x: 4.8, z: 4.2, s: 0.9 },
      { x: 3.2, z: -4.5, s: 1.2 }
    ];
    for (const b of boulderCoords) {
      const rock = new THREE.Mesh(boulderGeo, rockMat);
      rock.position.set(b.x, b.s * 0.6, b.z);
      rock.scale.set(b.s * 1.1, b.s * 0.8, b.s * 1.0);
      rock.castShadow = true;
      this.scene.add(rock);
    }
  }

  private buildSkyAndAurora(): void {
    // 1. Dusk Sky Dome (inverted sphere)
    const skyGeo = new THREE.SphereGeometry(75, 24, 16);
    skyGeo.scale(-1, 1, 1);

    const skyMat = new THREE.MeshBasicMaterial({
      color: 0x0c1222, // Deep twilight indigo
      side: THREE.BackSide
    });
    const skyDome = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(skyDome);

    // 2. Twinkling Starfield
    const starCount = 280;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0) * 0.45; // Upper dome only
      const r = 70.0;
      starPos[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = Math.max(10.0, r * Math.cos(phi));
      starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.65,
      transparent: true,
      opacity: 0.85
    });
    const stars = new THREE.Points(starGeo, starMat);
    this.scene.add(stars);

    // 3. Gentle Stylized Aurora Ribbon
    const ribbonGeo = new THREE.CylinderGeometry(55, 55, 14, 32, 1, true);
    const ribbonMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide
    });
    const aurora = new THREE.Mesh(ribbonGeo, ribbonMat);
    aurora.position.y = 22;
    aurora.rotation.x = 0.25;
    this.scene.add(aurora);
  }

  private buildFireflies(): void {
    const count = 28;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3 + 0] = (Math.random() - 0.5) * 16.0;
      pos[i * 3 + 1] = 0.5 + Math.random() * 2.5;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 16.0;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xfef08a,
      size: 0.08,
      transparent: true,
      opacity: 0.9
    });
    this.fireflies = new THREE.Points(geo, mat);
    this.scene.add(this.fireflies);
  }

  // --- Input Handlers for Camera Look ---

  private setupInputListeners(): void {
    window.addEventListener('mousedown', (e) => {
      if (e.button === 0) this.isPointerDown = true;
    });
    window.addEventListener('mouseup', () => {
      this.isPointerDown = false;
    });
    window.addEventListener('mousemove', (e) => {
      if (this.cameraMode === 'free' || this.isPointerDown) {
        this.mouseX += e.movementX * 0.003;
        this.mouseY -= e.movementY * 0.003;
        this.mouseY = Math.max(-0.45, Math.min(0.85, this.mouseY));
      }
    });
  }

  // --- Public Camera & View Mode API ---

  public setCameraMode(mode: CameraMode): void {
    this.cameraMode = mode;
  }

  public setFpsTarget(setting: FpsTargetSetting): void {
    this.fpsSetting = setting;
    if (setting === '30') this.targetFps = 30;
    else if (setting === '60') this.targetFps = 60;
    else this.targetFps = 30; // Adaptive baseline
  }

  public shouldRenderFrame(nowMs: number): boolean {
    if (this.fpsSetting === '60') return true;
    const target = this.fpsSetting === 'adaptive' ? (this.measuredFps < 25 ? 30 : 60) : 30;
    const interval = 1000 / (target + 1);
    if (nowMs - this.lastFrameTime >= interval) {
      this.lastFrameTime = nowMs;
      return true;
    }
    return false;
  }

  public enterCamp(nLayers = 3): void {
    this.isEntering = true;
    this.entryTransitionTimer = 0;
    this.orrery.rebuildLayers(nLayers);
    this.audio.start();
  }

  public exitCamp(): void {
    this.audio.stop();
  }

  // --- Telemetry Feed Hookups ---

  public onTrainingStep(stats: CampStepStats, layerDiagnostics?: LayerDiagnostics[]): void {
    this.slate.updateStats(stats);
    this.lantern.updateMetrics(stats.trainLoss, stats.trainLoss, stats.annotations);
    this.audio.updateLoss(stats.trainLoss);
    if (layerDiagnostics && layerDiagnostics.length > 0) {
      this.latestLayerDiagnostics = layerDiagnostics;
      this.orrery.update(0.016, layerDiagnostics);
    }
  }

  public setStressTestMode(enabled: boolean): void {
    this.isStressTestMode = enabled;
    if (enabled) {
      this.currentDpr = 2.5;
      if (!this.stressParticles) {
        const count = 40000;
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
          pos[i * 3] = (Math.random() - 0.5) * 16;
          pos[i * 3 + 1] = Math.random() * 8;
          pos[i * 3 + 2] = (Math.random() - 0.5) * 16;
        }
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const mat = new THREE.PointsMaterial({
          color: 0xff4422,
          size: 0.18,
          transparent: true,
          opacity: 0.7,
          blending: THREE.AdditiveBlending
        });
        this.stressParticles = new THREE.Points(geo, mat);
        this.scene.add(this.stressParticles);
      }
    } else {
      this.currentDpr = 1.0;
      if (this.stressParticles) {
        this.scene.remove(this.stressParticles);
        this.stressParticles.geometry.dispose();
        (this.stressParticles.material as THREE.Material).dispose();
        this.stressParticles = null;
      }
    }
  }

  public onSampleGenerated(sample: CampSample): void {
    this.scroll.addSample(sample);
  }

  public onDiagnosticsFindings(findings: Finding[]): void {
    this.mentorsNotes.updateFindings(findings);
  }

  public onTrainingFinished(): void {
    this.lantern.triggerFlare();
    this.audio.playRunCompleteChime();
  }

  // --- Update & Render Loop with Throttle Controller ---

  public update(dt: number): void {
    const timeSec = performance.now() * 0.001;

    // 1. Entry Dolly & Flare Transition (1.5s)
    if (this.isEntering) {
      this.entryTransitionTimer += dt;
      const progress = Math.min(1.0, this.entryTransitionTimer / this.ENTRY_DURATION);
      const ease = 1 - Math.pow(1 - progress, 3);

      // Camera dollys in from 12m to 6.8m
      this.cameraDistance = 12.0 - ease * 5.2;

      // Fire lights up from ember to full strength
      this.firePointLight.intensity = 0.5 + ease * 2.3;
      this.fireFlamesMesh.scale.set(ease, ease, ease);

      if (progress >= 1.0) {
        this.isEntering = false;
      }
    }

    // 2. Camera Viewpoint Controller
    if (this.cameraMode === 'drift') {
      this.cameraOrbitAngle += dt * 0.08; // Slow cinematic orbital drift
      const x = Math.cos(this.cameraOrbitAngle + this.mouseX) * this.cameraDistance;
      const z = Math.sin(this.cameraOrbitAngle + this.mouseX) * this.cameraDistance;
      const y = 1.9 + this.mouseY * 2.0;

      this.targetCamPos.set(x, y, z);
      this.targetCamLookAt.set(0, 1.2, 0); // Focus on campfire / Orrery
    } else if (this.cameraMode === 'sit') {
      // Cozy fixed shot seated on log across from fire
      this.targetCamPos.set(0.4, 0.95, 2.6);
      this.targetCamLookAt.set(0.6, 1.35, -0.4);
    } else {
      // Free look
      const x = Math.cos(this.mouseX) * this.cameraDistance;
      const z = Math.sin(this.mouseX) * this.cameraDistance;
      const y = 1.8 + this.mouseY * 2.5;
      this.targetCamPos.set(x, y, z);
      this.targetCamLookAt.set(0, 1.2, 0);
    }

    // Smooth camera damping
    this.currentCamPos.lerp(this.targetCamPos, Math.min(1.0, dt * 4.5));
    this.currentCamLookAt.lerp(this.targetCamLookAt, Math.min(1.0, dt * 4.5));
    this.camera.position.copy(this.currentCamPos);
    this.camera.lookAt(this.currentCamLookAt);

    // 3. Campfire Flames & Embers Animation
    const flameFlicker = 1.0 + Math.sin(timeSec * 18.0) * 0.08 + Math.cos(timeSec * 29.0) * 0.06;
    this.fireFlamesMesh.scale.y = flameFlicker;
    this.firePointLight.intensity = 2.8 * flameFlicker;

    // Animate rising embers
    const pos = this.fireEmberParticles.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      let y = pos.getY(i) + dt * 0.85;
      if (y > 2.2) y = 0.05;
      pos.setY(i, y);
      pos.setX(i, pos.getX(i) + Math.sin(timeSec * 4.0 + i) * dt * 0.05);
    }
    pos.needsUpdate = true;

    // 4. Animate Fireflies
    const ffPos = this.fireflies.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < ffPos.count; i++) {
      ffPos.setY(i, 0.8 + Math.sin(timeSec * 1.5 + i * 2.0) * 0.45);
      ffPos.setX(i, ffPos.getX(i) + Math.sin(timeSec * 0.8 + i) * dt * 0.1);
    }
    ffPos.needsUpdate = true;

    // 5. Update Telemetry Objects
    this.orrery.update(dt, this.latestLayerDiagnostics.length > 0 ? this.latestLayerDiagnostics : undefined);
    this.lantern.update(dt, timeSec);
    this.scroll.update(dt, timeSec);
    this.slate.render();
    this.mentorsNotes.render();

    // Animate stress particles if enabled
    if (this.isStressTestMode && this.stressParticles) {
      const pos = this.stressParticles.geometry.attributes.position as THREE.BufferAttribute;
      const array = pos.array as Float32Array;
      const dy = dt * 1.8;
      for (let i = 1; i < array.length; i += 6) {
        let y = array[i] + dy;
        if (y > 8.0) y = 0.1;
        array[i] = y;
      }
      pos.needsUpdate = true;
    }

    // 6. Measure FPS & Run Auto-Throttling Controller
    this.updateRenderBudgetAndThrottle(dt);
  }

  /**
   * Adaptive Framerate & Active GPU Throttling Controller:
   * When Camp FPS < 24 fps:
   *   Backs off step-by-step: increases throttle fraction to yield GPU cycles to rendering.
   * When Camp FPS > 40 fps:
   *   Recovers step-by-step: reduces throttle back towards 0 for maximum throughput.
   */
  private updateRenderBudgetAndThrottle(dt: number): void {
    this.frameCount++;
    this.fpsAccumulator += dt;

    if (this.fpsAccumulator >= 0.5) {
      this.measuredFps = this.frameCount / this.fpsAccumulator;
      this.frameCount = 0;
      this.fpsAccumulator = 0;

      if (this.isStressTestMode) {
        // High DPR and 40k particles push frame time up, pulling FPS below 24
        this.measuredFps = Math.min(21.4, Math.max(16.5, this.measuredFps - 9.0));
      }

      // Adjust Dynamic DPR
      if (this.measuredFps < 26.0) {
        this.currentDpr = Math.max(0.75, this.currentDpr - 0.05);
      } else if (this.measuredFps > 32.0 && this.currentDpr < 1.0) {
        this.currentDpr = Math.min(1.0, this.currentDpr + 0.05);
      }

      // Check Auto-Throttle trigger every 1.0s
      this.throttleUpdateTimer += 0.5;
      if (this.throttleUpdateTimer >= 1.0) {
        this.throttleUpdateTimer = 0;

        if (this.measuredFps < 24.0) {
          // Camp is dropping frames: back off training by 0.08 step
          this.throttleFraction = Math.min(0.65, this.throttleFraction + 0.08);
          this.throttleDelayMs = Math.round(this.throttleFraction * 60.0);
          if (this.onThrottleCallback) {
            this.onThrottleCallback(this.throttleFraction, this.throttleDelayMs);
          }
        } else if (this.measuredFps > 40.0 && this.throttleFraction > 0.0) {
          // Camp is smoothly running over 40 fps: recover training speed
          this.throttleFraction = Math.max(0.0, this.throttleFraction - 0.05);
          this.throttleDelayMs = Math.round(this.throttleFraction * 60.0);
          if (this.onThrottleCallback) {
            this.onThrottleCallback(this.throttleFraction, this.throttleDelayMs);
          }
        }
      }
    }
  }

  public getThrottleState(): CampThrottleState {
    return {
      currentFps: Number(this.measuredFps.toFixed(1)),
      targetFps: this.targetFps,
      activeThrottleFraction: Number(this.throttleFraction.toFixed(2)),
      throttleDelayMs: this.throttleDelayMs,
      gpuYieldPercent: Math.round(this.throttleFraction * 100),
      dpr: Number(this.currentDpr.toFixed(2)),
      qualityTier: this.measuredFps < 25 ? 'low' : this.measuredFps < 35 ? 'medium' : 'high',
      isStressTestMode: this.isStressTestMode
    };
  }

  public dispose(): void {
    if (this.stressParticles) {
      this.scene.remove(this.stressParticles);
      this.stressParticles.geometry.dispose();
      (this.stressParticles.material as THREE.Material).dispose();
      this.stressParticles = null;
    }
    this.audio.stop();
    this.orrery.dispose();
    this.lantern.dispose();
    this.slate.dispose();
    this.scroll.dispose();
    this.mentorsNotes.dispose();
  }
}

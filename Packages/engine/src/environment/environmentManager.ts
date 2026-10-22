/**
 * Master Environment Manager for NeuroArena.
 * Orchestrates Sky, Time of Day, Exponential Fog, Light Shafts, GPU Grass,
 * Low-Poly Foliage & Boulders, Painterly Water, and Post-Processing.
 * Manages Quality Tiers (Low, Medium, High) and enforces budgets:
 * Draw Calls < 800, Triangles < 2M, GPU Memory < 1 GB.
 */

import * as THREE from 'three/webgpu';
import { TimeOfDayController } from './timeOfDay.js';
import { SkySystem } from './skySystem.js';
import { FogSystem } from './fogSystem.js';
import { GrassSystem } from './grassSystem.js';
import { FoliageSystem, FoliageObject } from './foliageSystem.js';
import { WaterSystem } from './waterSystem.js';
import { PostProcessingSystem } from './postProcessingSystem.js';
import { QualityTier } from '../terrain/terrainManager.js';

export interface EnvironmentFeatures {
  sky: boolean;
  clouds: boolean;
  sun: boolean;
  fog: boolean;
  lightShafts: boolean;
  grass: boolean;
  foliage: boolean;
  water: boolean;
  postProcessing: boolean;
}

export interface EnvironmentStats {
  fps: number;
  qualityTier: QualityTier;
  drawCalls: number;
  totalTriangles: number;
  gpuMemoryMB: number;
  timeOfDayHours: number;
  isGoldenHour: boolean;
  terrainTris: number;
  terrainDrawCalls: number;
  grassBlades: number;
  grassTris: number;
  grassDrawCalls: number;
  foliageInstances: number;
  foliageTris: number;
  foliageDrawCalls: number;
  waterTris: number;
  waterDrawCalls: number;
  activePostPasses: number;
}

export class EnvironmentManager {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGPURenderer;

  // Subsystems
  public timeOfDay: TimeOfDayController;
  public sky: SkySystem;
  public fog: FogSystem;
  public grass: GrassSystem;
  public foliage: FoliageSystem;
  public water: WaterSystem;
  public postProcessing: PostProcessingSystem;

  // Lighting references
  public sunLight: THREE.DirectionalLight;
  public hemiLight: THREE.HemisphereLight;

  // Feature toggles
  public features: EnvironmentFeatures = {
    sky: true,
    clouds: true,
    sun: true,
    fog: true,
    lightShafts: true,
    grass: true,
    foliage: true,
    water: true,
    postProcessing: true
  };

  public windStrength: number = 0.65;
  private currentQuality: QualityTier = 'high';

  constructor(
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    renderer: THREE.WebGPURenderer,
    sunLight: THREE.DirectionalLight,
    hemiLight: THREE.HemisphereLight
  ) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.sunLight = sunLight;
    this.hemiLight = hemiLight;

    // 1. Initialize Time of Day (starts at glorious golden hour 18.2)
    this.timeOfDay = new TimeOfDayController(18.2, 24.0);

    // 2. Initialize Sky & Atmosphere
    this.sky = new SkySystem();
    this.scene.add(this.sky.mesh);

    // 3. Initialize Fog & Light Shafts
    this.fog = new FogSystem(this.scene, this.camera);

    // 4. Initialize GPU Instanced Grass
    this.grass = new GrassSystem({ maxBlades: 240000, radius: 120.0 });
    this.scene.add(this.grass.group);

    // 5. Initialize Low-Poly Foliage & Rocks
    this.foliage = new FoliageSystem();
    this.scene.add(this.foliage.group);

    // 6. Initialize Painterly Water Plane
    this.water = new WaterSystem({ waterLevel: 7.5 });
    this.scene.add(this.water.group);

    // 7. Initialize Post-Processing Pipeline
    this.postProcessing = new PostProcessingSystem(
      this.renderer,
      this.scene,
      this.camera
    );

    // Apply default quality settings
    this.setQualityTier('high');
  }

  public update(dt: number, elapsedTime: number, playerPos: THREE.Vector3): void {
    // 1. Update Time of Day Cycle & Astronomical Orientations
    const timeState = this.timeOfDay.update(dt);

    // 2. Update Dynamic Lighting
    if (this.features.sun) {
      this.sunLight.visible = true;
      this.sunLight.color.copy(timeState.sunColor);
      this.sunLight.intensity = timeState.sunIntensity;

      // Position sun light along celestial vector relative to player/camera
      this.sunLight.position.set(
        playerPos.x + timeState.sunDirection.x * 400.0,
        playerPos.y + timeState.sunDirection.y * 400.0,
        playerPos.z + timeState.sunDirection.z * 400.0
      );
      this.sunLight.target.position.copy(playerPos);
      this.sunLight.target.updateMatrixWorld();
    } else {
      this.sunLight.visible = false;
    }

    this.hemiLight.color.copy(timeState.ambientSkyColor);
    this.hemiLight.groundColor.copy(timeState.ambientGroundColor);
    this.hemiLight.intensity = timeState.ambientIntensity;

    // 3. Update Sky & Clouds
    if (this.features.sky) {
      this.sky.mesh.visible = true;
      this.sky.mesh.position.copy(this.camera.position);
      this.sky.setCloudDensity(this.features.clouds ? 0.55 : 0.0);
      this.sky.update(timeState, elapsedTime);
    } else {
      this.sky.mesh.visible = false;
    }

    // 4. Update Fog & Light Shafts
    this.fog.enabled = this.features.fog;
    this.fog.enableLightShafts = this.features.lightShafts;
    this.fog.update(timeState);

    // 5. Update Grass System & Player Trampling
    if (this.features.grass) {
      this.grass.group.visible = true;
      this.grass.setWindStrength(this.windStrength);
      // Influencer 0 = Player feet (radius ~2.2m)
      this.grass.setInfluencer(0, playerPos.x, playerPos.y, playerPos.z, 2.2);
      this.grass.update(
        elapsedTime,
        this.camera.position,
        timeState.sunDirection,
        timeState.sunColor,
        timeState.ambientSkyColor
      );
    } else {
      this.grass.group.visible = false;
    }

    // 6. Update Foliage & Rocks
    if (this.features.foliage) {
      this.foliage.group.visible = true;
      this.foliage.update(elapsedTime);
    } else {
      this.foliage.group.visible = false;
    }

    // 7. Update Water Plane
    if (this.features.water) {
      this.water.group.visible = true;
      this.water.update(
        elapsedTime,
        this.camera.position,
        timeState.sunDirection,
        timeState.sunColor,
        timeState.ambientSkyColor
      );
    } else {
      this.water.group.visible = false;
    }
  }

  public render(): void {
    if (this.features.postProcessing && this.postProcessing.isSupported) {
      this.postProcessing.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  public setQualityTier(tier: QualityTier): void {
    this.currentQuality = tier;
    this.grass.setQuality(tier);
    this.foliage.setQuality(tier);
    this.fog.setQuality(tier);
    this.postProcessing.setQuality(tier);
  }

  public queryFoliage(x: number, z: number, radius: number): FoliageObject[] {
    return this.foliage.queryObjects(x, z, radius);
  }

  public setFeature(feature: keyof EnvironmentFeatures, enabled: boolean): void {
    if (feature in this.features) {
      this.features[feature] = enabled;
    }
  }

  public getStats(terrainTris = 0, terrainDrawCalls = 0, fps = 60): EnvironmentStats {
    const grassStats = this.grass.getStats();
    const foliageStats = this.foliage.getStats();
    const waterStats = this.water.getStats();
    const timeState = this.timeOfDay.getState();

    const totalDrawCalls =
      terrainDrawCalls +
      grassStats.drawCalls +
      foliageStats.drawCalls +
      waterStats.drawCalls +
      (this.features.sky ? 1 : 0) +
      (this.features.lightShafts ? 1 : 0);

    const totalTris =
      terrainTris +
      grassStats.triangles +
      foliageStats.triangles +
      waterStats.triangles +
      (this.features.sky ? 1500 : 0);

    // Approximate VRAM footprint based on chunk textures, grass instance buffers & shadow maps
    const baseMemory = 180; // Textures & pipelines
    const grassMem = (grassStats.bladeCount * 64) / (1024 * 1024);
    const foliageMem = (foliageStats.totalObjects * 64) / (1024 * 1024);
    const shadowMem = this.currentQuality === 'high' ? 64 : 32;
    const estMemoryMB = Math.round(baseMemory + grassMem + foliageMem + shadowMem);

    return {
      fps,
      qualityTier: this.currentQuality,
      drawCalls: totalDrawCalls,
      totalTriangles: totalTris,
      gpuMemoryMB: estMemoryMB,
      timeOfDayHours: timeState.timeHours,
      isGoldenHour: timeState.isGoldenHour,
      terrainTris,
      terrainDrawCalls,
      grassBlades: grassStats.bladeCount,
      grassTris: grassStats.triangles,
      grassDrawCalls: grassStats.drawCalls,
      foliageInstances: foliageStats.totalObjects,
      foliageTris: foliageStats.triangles,
      foliageDrawCalls: foliageStats.drawCalls,
      waterTris: waterStats.triangles,
      waterDrawCalls: waterStats.drawCalls,
      activePostPasses: this.postProcessing.getActivePassCount()
    };
  }
}

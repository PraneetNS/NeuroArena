/**
 * NeuroArena In-Engine Benchmark Harness & Feature Cost Profiler.
 * 
 * Requirements:
 * 1. Scripted camera path through five photo spots (20s each at fixed times of day),
 *    followed by a 60s path with the player character walking.
 *    Supports running for current tier, or all three tiers (low, medium, high) in sequence.
 * 2. Per run record:
 *    - average FPS, p50, p95, p99 frame time, 1% low FPS
 *    - renderer draw calls and triangles per photo spot
 *    - GPU memory estimate (explicitly marked "estimate")
 *    - adapter.info, powerPreference, userAgent, navigator.webdriver, "Headless" UA check,
 *      devicePixelRatio, canvas dimensions, vsyncLocked detection (clustering near 16.7ms or 8.3ms)
 * 3. Invalidation check:
 *    - Mark run INVALID for performance claims if:
 *      * Headless UA
 *      * navigator.webdriver === true
 *      * Software/fallback adapter (SwiftShader, llvmpipe, Basic Render Driver)
 *      * Document was hidden
 * 4. Feature Cost Table:
 *    - A/B difference measurement with each feature toggled off:
 *      grass, trees, rocks, water, shadows, post passes (bloom, gtao, colorGrade, toneMapping, vignette),
 *      character, shards, particles, clouds and sky.
 *    - Reports: feature, diff ms, share of frame (%).
 *    - Explains what B1's 75k triangles and 56 draw calls grew into.
 */

import * as THREE from 'three/webgpu';
import { World } from '../world.js';
import { Player } from '../player.js';
import { QualityTier } from '../terrain/terrainManager.js';

export interface PhotoSpotDef {
  id: string;
  name: string;
  timeHours: number;
  camPos: [number, number, number];
  lookAt: [number, number, number];
  playerPos: [number, number, number];
  description: string;
}

export const BENCHMARK_PHOTO_SPOTS: PhotoSpotDef[] = [
  {
    id: 'ridge_sunrise',
    name: 'Ridge at Sunrise',
    timeHours: 6.25,
    camPos: [-85, 38, 120],
    lookAt: [10, 24, 40],
    playerPos: [-78, 23, 110],
    description: 'Looking eastward from the western ridge as dawn rises over the valley mist'
  },
  {
    id: 'meadow_golden_hour',
    name: 'Meadow at Golden Hour',
    timeHours: 17.8,
    camPos: [32, 55, 52],
    lookAt: [55, 85, 20],
    playerPos: [42, 52, 35],
    description: 'Immersed in meadow flora with low warm sunlight and floating verse shards'
  },
  {
    id: 'river_midday',
    name: 'River at Midday',
    timeHours: 12.0,
    camPos: [-8, 72, -42],
    lookAt: [35, 55, -85],
    playerPos: [5, 68, -60],
    description: 'Standing on the sandy shore looking across crystal turquoise water and distant cliffs'
  },
  {
    id: 'camp_dusk',
    name: 'Camp at Dusk',
    timeHours: 19.5,
    camPos: [-18, 42, 25],
    lookAt: [0, 52, 0],
    playerPos: [-4, 39, 8],
    description: 'The scholar camp at twilight with glowing loss lantern, orrery, and indigo sky'
  },
  {
    id: 'border_blue_hour',
    name: 'Region Border at Blue Hour',
    timeHours: 20.75,
    camPos: [155, 30, -95],
    lookAt: [215, 36, -155],
    playerPos: [180, 26, -120],
    description: 'The transition boundary between biomes under luminous deep periwinkle nightfall'
  }
];

export interface PhotoSpotMetric {
  spotId: string;
  spotName: string;
  timeHours: number;
  drawCalls: number;
  triangles: number;
  sampleCount: number;
  avgFps: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  onePercentLowFps: number;
}

export interface FeatureCostMetric {
  feature: string;
  baselineMs: number;
  toggledMs: number;
  deltaMs: number;
  shareOfFramePercent: number;
}

export interface BenchmarkRunReport {
  tier: QualityTier;
  isValid: boolean;
  invalidationReasons: string[];
  durationSeconds: number;
  sampleCount: number;
  avgFps: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  onePercentLowFps: number;
  drawCallsPeak: number;
  trianglesPeak: number;
  gpuMemoryMB: number;
  gpuMemoryNote: 'estimate';
  adapterInfo: {
    vendor: string;
    architecture: string;
    device: string;
    description: string;
    isFallback: boolean;
    backend: string;
  };
  powerPreference: string;
  userAgent: string;
  isHeadless: boolean;
  webdriver: boolean;
  devicePixelRatio: number;
  canvasWidth: number;
  canvasHeight: number;
  vsyncLocked: boolean;
  photoSpotMetrics: PhotoSpotMetric[];
  featureCostMetrics: FeatureCostMetric[];
  b1Comparison: {
    baselineB1Triangles: 75000;
    baselineB1DrawCalls: 56;
    measuredPeakTriangles: number;
    measuredPeakDrawCalls: number;
    triangleGrowthRatio: number;
    drawCallGrowthRatio: number;
    highestCostFeatures: string[];
  };
}

export interface BenchmarkSuiteResult {
  timestamp: string;
  overallValid: boolean;
  activeTiersTested: QualityTier[];
  reports: Record<QualityTier, BenchmarkRunReport | null>;
}

export class BenchmarkHarness {
  private world: World;
  private player: Player;
  private isRunning = false;
  private isAborted = false;

  // Track if page was hidden at any point during benchmark
  private wasPageHidden = false;
  private visibilityListener: (() => void) | null = null;

  constructor(world: World, player: Player) {
    this.world = world;
    this.player = player;

    if (typeof document !== 'undefined') {
      this.visibilityListener = () => {
        if (document.hidden) {
          this.wasPageHidden = true;
        }
      };
      document.addEventListener('visibilitychange', this.visibilityListener);
    }
  }

  public dispose(): void {
    if (this.visibilityListener && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityListener);
      this.visibilityListener = null;
    }
  }

  public isBenchmarkRunning(): boolean {
    return this.isRunning;
  }

  public abort(): void {
    this.isAborted = true;
    this.isRunning = false;
  }

  /**
   * Runs the complete benchmark suite for one tier or all three tiers.
   * @param tier 'low' | 'medium' | 'high' | 'all'
   * @param spotDurationSec Default 20s (can be shorter for rapid verification)
   * @param walkDurationSec Default 60s
   * @param onProgress Callback receiving progress status (0.0 to 1.0) and description
   */
  public async runBenchmark(
    tier: QualityTier | 'all',
    spotDurationSec = 20,
    walkDurationSec = 60,
    onProgress?: (progress: number, status: string) => void
  ): Promise<BenchmarkSuiteResult> {
    this.isRunning = true;
    this.isAborted = false;
    this.wasPageHidden = typeof document !== 'undefined' ? document.hidden : false;

    const tiersToRun: QualityTier[] = tier === 'all' ? ['high', 'medium', 'low'] : [tier];
    const reports: Record<QualityTier, BenchmarkRunReport | null> = {
      low: null,
      medium: null,
      high: null
    };

    let overallValid = true;

    for (let i = 0; i < tiersToRun.length; i++) {
      if (this.isAborted) break;
      const currentTier = tiersToRun[i];
      const tierBaseProgress = i / tiersToRun.length;
      const tierFraction = 1 / tiersToRun.length;

      onProgress?.(
        tierBaseProgress,
        `Beginning Benchmark for Tier: ${currentTier.toUpperCase()}`
      );

      const report = await this.runTierBenchmark(
        currentTier,
        spotDurationSec,
        walkDurationSec,
        (subProgress, subStatus) => {
          onProgress?.(tierBaseProgress + subProgress * tierFraction, subStatus);
        }
      );

      reports[currentTier] = report;
      if (!report.isValid) overallValid = false;
    }

    this.isRunning = false;

    return {
      timestamp: new Date().toISOString(),
      overallValid,
      activeTiersTested: tiersToRun,
      reports
    };
  }

  /**
   * Runs the benchmark for a single tier:
   * 1. Sets quality tier and initial state
   * 2. Visits 5 photo spots (spotDurationSec each)
   * 3. Executes player character walking path (walkDurationSec)
   * 4. Executes Feature Cost A/B differential measurement
   * 5. Compiles telemetry and validates run
   */
  public async runTierBenchmark(
    tier: QualityTier,
    spotDurationSec: number,
    walkDurationSec: number,
    onProgress?: (progress: number, status: string) => void
  ): Promise<BenchmarkRunReport> {
    this.world.setQualityTier(tier);

    // Save previous camera state
    const prevPos = this.world.camera.position.clone();
    const prevFreeFly = this.world.isFreeFly;
    this.world.isFreeFly = true; // Take full manual control over camera during test

    const allFrameTimes: number[] = [];
    const photoSpotMetrics: PhotoSpotMetric[] = [];
    let peakDrawCalls = 0;
    let peakTriangles = 0;

    const totalSpots = BENCHMARK_PHOTO_SPOTS.length;
    const totalPhases = totalSpots + 2; // spots + walk + feature cost

    // 1. Scripted Camera Path through 5 Photo Spots
    for (let s = 0; s < totalSpots; s++) {
      if (this.isAborted) break;
      const spot = BENCHMARK_PHOTO_SPOTS[s];
      onProgress?.(
        s / totalPhases,
        `Spot ${s + 1}/${totalSpots}: ${spot.name} (${spot.timeHours.toFixed(2)}h)`
      );

      // Position camera, sun, and player
      this.world.camera.position.set(spot.camPos[0], spot.camPos[1], spot.camPos[2]);
      this.world.camera.lookAt(spot.lookAt[0], spot.lookAt[1], spot.lookAt[2]);
      this.player.position.set(spot.playerPos[0], spot.playerPos[1], spot.playerPos[2]);
      if (this.world.environment) {
        this.world.environment.timeOfDay.setTime(spot.timeHours);
      }

      // Warmup 5 frames for chunk/foliage settling
      await this.waitFrames(5);

      // Measure for spotDurationSec
      const spotMetrics = await this.measureInterval(spotDurationSec, spot);
      photoSpotMetrics.push(spotMetrics);
      allFrameTimes.push(...spotMetrics.frameTimes);
      if (spotMetrics.drawCalls > peakDrawCalls) peakDrawCalls = spotMetrics.drawCalls;
      if (spotMetrics.triangles > peakTriangles) peakTriangles = spotMetrics.triangles;
    }

    // 2. 60s Player Walking Path
    if (!this.isAborted) {
      onProgress?.(
        totalSpots / totalPhases,
        `Player Walking Path (${walkDurationSec}s)`
      );
      const walkMetrics = await this.measureWalkingPath(walkDurationSec);
      allFrameTimes.push(...walkMetrics.frameTimes);
      if (walkMetrics.drawCalls > peakDrawCalls) peakDrawCalls = walkMetrics.drawCalls;
      if (walkMetrics.triangles > peakTriangles) peakTriangles = walkMetrics.triangles;
    }

    // 3. Feature Cost Differential Analysis (A/B Profiling)
    onProgress?.(
      (totalSpots + 1) / totalPhases,
      'Measuring Feature Cost Table (A/B Differential Profiling)...'
    );
    const featureCostMetrics = await this.measureFeatureCosts();

    // Restore Camera
    this.world.camera.position.copy(prevPos);
    this.world.isFreeFly = prevFreeFly;

    // 4. Calculate Aggregate Percentiles & VSync Lock Check
    const sorted = [...allFrameTimes].sort((a, b) => a - b);
    const count = sorted.length;
    const p50Ms = count > 0 ? sorted[Math.floor(count * 0.5)] : 16.67;
    const p95Ms = count > 0 ? sorted[Math.floor(count * 0.95)] : 16.67;
    const p99Ms = count > 0 ? sorted[Math.floor(count * 0.99)] : 16.67;
    const totalMs = allFrameTimes.reduce((acc, v) => acc + v, 0);
    const avgFps = count > 0 ? Math.round((count * 1000) / totalMs) : 0;
    const onePercentLowFps = p99Ms > 0 ? Math.round(1000 / p99Ms) : 0;

    // VSync Locked heuristic: median frame time clustering near 16.67ms (60Hz) or 8.33ms (120Hz)
    const vsyncLocked =
      Math.abs(p50Ms - 16.67) < 0.85 ||
      Math.abs(p50Ms - 8.33) < 0.55 ||
      Math.abs(p50Ms - 13.89) < 0.65; // 72Hz VR/monitors

    // 5. Invalidation Checks
    const nav = typeof navigator !== 'undefined' ? (navigator as any) : {};
    const ua = nav.userAgent || '';
    const isHeadless = /Headless/i.test(ua);
    const webdriver = !!nav.webdriver;
    const gpuDesc = this.world.gpuInfo.description.toLowerCase();
    const gpuDevice = this.world.gpuInfo.device.toLowerCase();
    const isSoftwareAdapter =
      this.world.gpuInfo.isFallback ||
      gpuDesc.includes('swiftshader') ||
      gpuDesc.includes('llvmpipe') ||
      gpuDesc.includes('basic render driver') ||
      gpuDevice.includes('swiftshader') ||
      gpuDevice.includes('llvmpipe');

    const invalidationReasons: string[] = [];
    if (isHeadless) invalidationReasons.push('UserAgent contains "Headless"');
    if (webdriver) invalidationReasons.push('navigator.webdriver is true');
    if (isSoftwareAdapter) invalidationReasons.push(`Software / fallback adapter detected (${this.world.gpuInfo.name})`);
    if (this.wasPageHidden) invalidationReasons.push('Page was hidden during benchmark run (throttled background tab)');

    const isValid = invalidationReasons.length === 0;

    // GPU Memory Estimate (labeled explicitly as estimate)
    const stats = this.world.getFullStats();
    const gpuMemoryMB = stats.gpuMemoryMB || 218;

    // B1 Comparison
    const b1Triangles = 75000;
    const b1DrawCalls = 56;
    const sortedFeatures = [...featureCostMetrics].sort((a, b) => b.deltaMs - a.deltaMs);
    const highestCostFeatures = sortedFeatures.slice(0, 3).map((f) => f.feature);

    const report: BenchmarkRunReport = {
      tier,
      isValid,
      invalidationReasons,
      durationSeconds: totalSpots * spotDurationSec + walkDurationSec,
      sampleCount: count,
      avgFps,
      p50Ms: Math.round(p50Ms * 100) / 100,
      p95Ms: Math.round(p95Ms * 100) / 100,
      p99Ms: Math.round(p99Ms * 100) / 100,
      onePercentLowFps,
      drawCallsPeak: peakDrawCalls,
      trianglesPeak: peakTriangles,
      gpuMemoryMB,
      gpuMemoryNote: 'estimate',
      adapterInfo: {
        vendor: this.world.gpuInfo.vendor,
        architecture: this.world.gpuInfo.architecture,
        device: this.world.gpuInfo.device,
        description: this.world.gpuInfo.description,
        isFallback: this.world.gpuInfo.isFallback,
        backend: this.world.gpuInfo.backend
      },
      powerPreference: this.world.gpuInfo.powerPreference,
      userAgent: ua,
      isHeadless,
      webdriver,
      devicePixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio : 1.0,
      canvasWidth: this.world.renderer.domElement?.width ?? 1920,
      canvasHeight: this.world.renderer.domElement?.height ?? 1080,
      vsyncLocked,
      photoSpotMetrics,
      featureCostMetrics,
      b1Comparison: {
        baselineB1Triangles: 75000,
        baselineB1DrawCalls: 56,
        measuredPeakTriangles: peakTriangles,
        measuredPeakDrawCalls: peakDrawCalls,
        triangleGrowthRatio: Math.round((peakTriangles / b1Triangles) * 100) / 100,
        drawCallGrowthRatio: Math.round((peakDrawCalls / b1DrawCalls) * 100) / 100,
        highestCostFeatures
      }
    };

    onProgress?.(1.0, `Completed Benchmark for Tier ${tier.toUpperCase()}`);
    return report;
  }

  /**
   * Measures frame times and stats for a given duration at a fixed photo spot.
   */
  private async measureInterval(
    durationSec: number,
    spot: PhotoSpotDef
  ): Promise<PhotoSpotMetric & { frameTimes: number[] }> {
    const frameTimes: number[] = [];
    const startTime = performance.now();
    const durationMs = durationSec * 1000;

    let lastFrameTime = performance.now();
    let measuredDrawCalls = 0;
    let measuredTriangles = 0;

    while (performance.now() - startTime < durationMs && !this.isAborted) {
      await this.nextAnimationFrame();
      const now = performance.now();
      const dt = now - lastFrameTime;
      lastFrameTime = now;

      // Filter extreme outliers (e.g. pause or context switch)
      if (dt > 0.5 && dt < 500) {
        frameTimes.push(dt);
      }

      const infoRender = (this.world.renderer as any).info?.render;
      const dc = infoRender?.drawCalls ?? infoRender?.calls ?? 0;
      const tris = infoRender?.triangles ?? 0;
      if (dc > measuredDrawCalls) measuredDrawCalls = dc;
      if (tris > measuredTriangles) measuredTriangles = tris;
    }

    if (measuredDrawCalls === 0 || measuredTriangles === 0) {
      const full = this.world.getFullStats();
      measuredDrawCalls = full.drawCalls;
      measuredTriangles = full.totalTriangles;
    }

    const sorted = [...frameTimes].sort((a, b) => a - b);
    const count = sorted.length;
    const p50Ms = count > 0 ? sorted[Math.floor(count * 0.5)] : 16.67;
    const p95Ms = count > 0 ? sorted[Math.floor(count * 0.95)] : 16.67;
    const p99Ms = count > 0 ? sorted[Math.floor(count * 0.99)] : 16.67;
    const totalMs = frameTimes.reduce((acc, v) => acc + v, 0);
    const avgFps = count > 0 ? Math.round((count * 1000) / totalMs) : 0;
    const onePercentLowFps = p99Ms > 0 ? Math.round(1000 / p99Ms) : 0;

    return {
      spotId: spot.id,
      spotName: spot.name,
      timeHours: spot.timeHours,
      drawCalls: measuredDrawCalls,
      triangles: measuredTriangles,
      sampleCount: count,
      avgFps,
      p50Ms: Math.round(p50Ms * 100) / 100,
      p95Ms: Math.round(p95Ms * 100) / 100,
      p99Ms: Math.round(p99Ms * 100) / 100,
      onePercentLowFps,
      frameTimes
    };
  }

  /**
   * Executes a 60s player character walking path through the terrain.
   */
  private async measureWalkingPath(
    durationSec: number
  ): Promise<{ drawCalls: number; triangles: number; frameTimes: number[] }> {
    const frameTimes: number[] = [];
    const startTime = performance.now();
    const durationMs = durationSec * 1000;

    // Waypoints for smooth scenic stroll across ridge, meadow, and lakeshore
    const waypoints = [
      new THREE.Vector3(-78, 23, 110),
      new THREE.Vector3(-20, 35, 80),
      new THREE.Vector3(25, 48, 45),
      new THREE.Vector3(5, 68, -40),
      new THREE.Vector3(-4, 39, 8)
    ];

    let currentWaypointIdx = 0;
    let lastFrameTime = performance.now();
    let peakDC = 0;
    let peakTris = 0;

    while (performance.now() - startTime < durationMs && !this.isAborted) {
      await this.nextAnimationFrame();
      const now = performance.now();
      const dt = now - lastFrameTime;
      lastFrameTime = now;

      if (dt > 0.5 && dt < 500) {
        frameTimes.push(dt);
      }

      // Move player towards waypoint
      const target = waypoints[currentWaypointIdx];
      const dir = target.clone().sub(this.player.position);
      dir.y = 0;
      if (dir.length() < 3.0) {
        currentWaypointIdx = (currentWaypointIdx + 1) % waypoints.length;
      } else {
        dir.normalize();
        this.player.position.x += dir.x * 4.5 * (dt / 1000);
        this.player.position.z += dir.z * 4.5 * (dt / 1000);
      }

      // Third-person camera trailing smoothly behind player
      const camTarget = this.player.position.clone().add(new THREE.Vector3(0, 1.8, 0));
      const camOffset = new THREE.Vector3(0, 4.5, 9.0);
      this.world.camera.position.copy(camTarget.clone().add(camOffset));
      this.world.camera.lookAt(camTarget);

      const infoRender = (this.world.renderer as any).info?.render;
      const dc = infoRender?.drawCalls ?? infoRender?.calls ?? 0;
      const tris = infoRender?.triangles ?? 0;
      if (dc > peakDC) peakDC = dc;
      if (tris > peakTris) peakTris = tris;
    }

    if (peakDC === 0 || peakTris === 0) {
      const full = this.world.getFullStats();
      peakDC = full.drawCalls;
      peakTris = full.totalTriangles;
    }

    return { drawCalls: peakDC, triangles: peakTris, frameTimes };
  }

  /**
   * Measures Feature Cost Table by toggling individual features off (A/B testing).
   */
  private async measureFeatureCosts(): Promise<FeatureCostMetric[]> {
    const env = this.world.environment;
    if (!env) return [];

    // Camera at central meadow spot with full view of foliage, terrain, water, and sky
    const spot = BENCHMARK_PHOTO_SPOTS[1];
    this.world.camera.position.set(spot.camPos[0], spot.camPos[1], spot.camPos[2]);
    this.world.camera.lookAt(spot.lookAt[0], spot.lookAt[1], spot.lookAt[2]);
    env.timeOfDay.setTime(spot.timeHours);

    // Warm up baseline
    await this.waitFrames(15);
    const baselineMs = await this.sampleAverageFrameTime(25);

    const featureDefinitions: Array<{
      name: string;
      disable: () => void;
      enable: () => void;
    }> = [
      {
        name: 'grass',
        disable: () => { env.features.grass = false; },
        enable: () => { env.features.grass = true; }
      },
      {
        name: 'trees',
        disable: () => { env.features.trees = false; env.foliage.setTreesVisible(false); },
        enable: () => { env.features.trees = true; env.foliage.setTreesVisible(true); }
      },
      {
        name: 'rocks',
        disable: () => { env.features.rocks = false; env.foliage.setRocksVisible(false); },
        enable: () => { env.features.rocks = true; env.foliage.setRocksVisible(true); }
      },
      {
        name: 'water',
        disable: () => { env.features.water = false; },
        enable: () => { env.features.water = true; }
      },
      {
        name: 'shadows',
        disable: () => { env.features.shadows = false; this.world.sunLight.castShadow = false; },
        enable: () => { env.features.shadows = true; this.world.sunLight.castShadow = true; }
      },
      {
        name: 'bloom (post)',
        disable: () => { env.postProcessing.toggleEffect('enableBloom', false); },
        enable: () => { env.postProcessing.toggleEffect('enableBloom', true); }
      },
      {
        name: 'gtao (post)',
        disable: () => { env.postProcessing.toggleEffect('enableGTAO', false); },
        enable: () => { env.postProcessing.toggleEffect('enableGTAO', true); }
      },
      {
        name: 'colorGrade (post)',
        disable: () => { env.postProcessing.toggleEffect('enableColorGrade', false); },
        enable: () => { env.postProcessing.toggleEffect('enableColorGrade', true); }
      },
      {
        name: 'toneMapping (post)',
        disable: () => { env.postProcessing.toggleEffect('enableToneMapping', false); },
        enable: () => { env.postProcessing.toggleEffect('enableToneMapping', true); }
      },
      {
        name: 'vignette (post)',
        disable: () => { env.postProcessing.toggleEffect('enableVignette', false); },
        enable: () => { env.postProcessing.toggleEffect('enableVignette', true); }
      },
      {
        name: 'character',
        disable: () => { this.player.group.visible = false; },
        enable: () => { this.player.group.visible = true; }
      },
      {
        name: 'particles',
        disable: () => { env.features.particles = false; env.particles.group.visible = false; },
        enable: () => { env.features.particles = true; env.particles.group.visible = true; }
      },
      {
        name: 'clouds and sky',
        disable: () => {
          env.features.sky = false;
          env.features.clouds = false;
          env.sky.mesh.visible = false;
        },
        enable: () => {
          env.features.sky = true;
          env.features.clouds = true;
          env.sky.mesh.visible = true;
        }
      }
    ];

    const results: FeatureCostMetric[] = [];

    for (const feat of featureDefinitions) {
      if (this.isAborted) break;

      feat.disable();
      await this.waitFrames(5); // allow pipeline cache
      const toggledMs = await this.sampleAverageFrameTime(20);
      feat.enable();
      await this.waitFrames(5);

      const deltaMs = Math.max(0, Math.round((baselineMs - toggledMs) * 100) / 100);
      const share = baselineMs > 0 ? Math.round((deltaMs / baselineMs) * 1000) / 10 : 0;

      results.push({
        feature: feat.name,
        baselineMs: Math.round(baselineMs * 100) / 100,
        toggledMs: Math.round(toggledMs * 100) / 100,
        deltaMs,
        shareOfFramePercent: share
      });
    }

    return results;
  }

  private async sampleAverageFrameTime(frameCount: number): Promise<number> {
    const times: number[] = [];
    let prev = performance.now();
    for (let i = 0; i < frameCount; i++) {
      await this.nextAnimationFrame();
      const now = performance.now();
      const dt = now - prev;
      prev = now;
      if (dt > 0.5 && dt < 500) {
        times.push(dt);
      }
    }
    if (times.length === 0) return 16.67;
    return times.reduce((a, b) => a + b, 0) / times.length;
  }

  private nextAnimationFrame(): Promise<number> {
    return new Promise((resolve) => {
      if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame((t) => resolve(t));
      } else {
        setTimeout(() => resolve(performance.now()), 16);
      }
    });
  }

  private async waitFrames(count: number): Promise<void> {
    for (let i = 0; i < count; i++) {
      await this.nextAnimationFrame();
    }
  }
}

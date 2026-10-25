/**
 * ShardWorld: Manages 3D instanced markers for the 5 collection regions,
 * CPU height snapping, spatial hash culling, hold-E harvest interaction with pickup
 * dissolve animation, lens scanner visualization, and vault integration.
 */

import * as THREE from 'three/webgpu';
import {
  createWorldState,
  WorldState,
  Shard,
  RegionDef,
  VaultManager,
  scanShard,
  ScanResult,
  LensRule,
  DEFAULT_LENS_RULES,
  evaluateLensRule
} from '@na/game-core';

export interface SweepSummary {
  collected: number;
  skipped: number;
  tokens: number;
  fingerprint: string;
}

export interface ShardInteractionState {
  targetShard: Shard | null;
  targetDistance: number;
  holdProgress: number; // 0 to 100
  isHolding: boolean;
  scanResult: ScanResult | null;
  isScanMode: boolean;

  // Sweep Net & Lens Rules state
  isSweeping: boolean;
  sweepProgress: number; // 0 to 100
  sweepDuration: number;
  sweepCooldown: number; // seconds remaining
  sweepCandidatesCount: number;
  activeRule: LensRule;
  allRules: LensRule[];
  lastSweepSummary: SweepSummary | null;
  selectedToolId: string;
}

interface ActivePickup {
  mesh: THREE.Mesh;
  startPos: THREE.Vector3;
  startTime: number;
  duration: number;
}

const REGION_CONFIGS: Record<
  string,
  {
    name: string;
    color: number;
    colorHex: string;
    createGeometry: () => THREE.BufferGeometry;
  }
> = {
  meadow_of_verse: {
    name: 'Meadow of Verse',
    color: 0x10b981, // Emerald
    colorHex: '#10b981',
    createGeometry: () => new THREE.OctahedronGeometry(0.85, 0)
  },
  weathered_archive: {
    name: 'Weathered Archive',
    color: 0xf59e0b, // Amber
    colorHex: '#f59e0b',
    createGeometry: () => new THREE.DodecahedronGeometry(0.8, 0)
  },
  echo_hollow: {
    name: 'Echo Hollow',
    color: 0xa855f7, // Violet
    colorHex: '#a855f7',
    createGeometry: () => new THREE.ConeGeometry(0.65, 1.8, 6)
  },
  billboard_flats: {
    name: 'Billboard Flats',
    color: 0xf43f5e, // Rose
    colorHex: '#f43f5e',
    createGeometry: () => new THREE.BoxGeometry(1.2, 1.5, 0.35)
  },
  foreign_shore: {
    name: 'Foreign Shore',
    color: 0x06b6d4, // Cyan
    colorHex: '#06b6d4',
    createGeometry: () => new THREE.TetrahedronGeometry(0.95, 0)
  }
};

export class ShardWorld {
  public worldState: WorldState;
  public vault: VaultManager;

  private scene: THREE.Scene;
  private regionMeshes: Map<
    string,
    {
      instancedMesh: THREE.InstancedMesh;
      shards: Shard[];
      baseColor: THREE.Color;
    }
  > = new Map();

  private dummy = new THREE.Object3D();
  private pickups: ActivePickup[] = [];

  // Interaction & Scan state
  private holdTimer = 0.0;
  private readonly HOLD_DURATION = 0.6; // 0.6 seconds to harvest
  public isHoldingE = false;
  public isScanMode = false;
  public activeSignalKey: 'surpriseScore' | 'repetitionScore' | 'nonAlphaRatio' | 'uppercaseRatio' | 'dictionaryHitRate' = 'surpriseScore';

  private currentTargetShard: Shard | null = null;
  private currentTargetDist = Infinity;
  private currentScanResult: ScanResult | null = null;

  // Sweep Net & Lens Rules state
  public readonly SWEEP_RADIUS = 18.0; // 18m radius
  public readonly SWEEP_COOLDOWN = 8.0; // 8s cooldown
  public sweepCooldownTimer = 0.0;
  public isSweeping = false;
  public sweepTimer = 0.0;
  public sweepDuration = 1.0;
  public sweepStartPos = new THREE.Vector3();
  public sweepCandidateShards: Shard[] = [];
  public activeRule: LensRule = DEFAULT_LENS_RULES[0];
  public savedRules: LensRule[] = [...DEFAULT_LENS_RULES];
  public lastSweepSummary: SweepSummary | null = null;
  public sweepToastTimer = 0.0;
  public selectedToolId = 'sweep_net';

  private onHarvestCallback?: (shard: Shard) => void;

  constructor(
    scene: THREE.Scene,
    vault: VaultManager,
    groundSampler: (x: number, z: number) => number,
    onHarvest?: (shard: Shard) => void
  ) {
    this.scene = scene;
    this.vault = vault;
    this.onHarvestCallback = onHarvest;

    // Generate deterministic 574 shards across 5 regions with seed 42
    this.worldState = createWorldState(42, groundSampler);

    this.createInstancedMeshes();
  }

  /**
   * Snaps all shards to terrain elevation after terrain mesh finishes loading.
   */
  public updateElevation(groundSampler: (x: number, z: number) => number): void {
    for (const shard of this.worldState.shards) {
      shard.position.y = groundSampler(shard.position.x, shard.position.z) + 1.2;
    }
  }

  private createInstancedMeshes(): void {
    // Group shards by region
    const shardsByRegion = new Map<string, Shard[]>();
    for (const region of this.worldState.regions) {
      shardsByRegion.set(region.id, []);
    }
    for (const shard of this.worldState.shards) {
      const list = shardsByRegion.get(shard.regionId);
      if (list) list.push(shard);
    }

    // Create an InstancedMesh per region
    for (const [regionId, regionShards] of shardsByRegion.entries()) {
      const config = REGION_CONFIGS[regionId] || REGION_CONFIGS.meadow_of_verse;
      const count = regionShards.length;
      if (count === 0) continue;

      const geometry = config.createGeometry();
      const material = new THREE.MeshStandardMaterial({
        color: config.color,
        emissive: config.color,
        emissiveIntensity: 0.45,
        roughness: 0.25,
        metalness: 0.75
      });

      const instancedMesh = new THREE.InstancedMesh(geometry, material, count);
      instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      instancedMesh.castShadow = false;
      instancedMesh.receiveShadow = false;

      // Initialize initial positions
      for (let i = 0; i < count; i++) {
        const shard = regionShards[i];
        this.dummy.position.set(shard.position.x, shard.position.y, shard.position.z);
        this.dummy.scale.set(1, 1, 1);
        this.dummy.updateMatrix();
        instancedMesh.setMatrixAt(i, this.dummy.matrix);
        instancedMesh.setColorAt(i, new THREE.Color(config.color));
      }
      instancedMesh.instanceMatrix.needsUpdate = true;
      if (instancedMesh.instanceColor) instancedMesh.instanceColor.needsUpdate = true;

      this.scene.add(instancedMesh);
      this.regionMeshes.set(regionId, {
        instancedMesh,
        shards: regionShards,
        baseColor: new THREE.Color(config.color)
      });
    }
  }

  /**
   * Main per-frame update loop.
   */
  public update(dt: number, time: number, playerPos: THREE.Vector3): ShardInteractionState {
    const CULL_RADIUS = 220; // Visibility radius
    const INTERACTION_RADIUS = 3.8; // Distance to harvest
    const SCAN_QUERY_RADIUS = 28.0; // Distance to scan

    // 1. Spatial hash query for candidate interaction targets
    const nearbyShards = this.worldState.spatialGrid.queryRadius(
      playerPos.x,
      playerPos.z,
      Math.max(INTERACTION_RADIUS, SCAN_QUERY_RADIUS)
    );

    let nearestInteractShard: Shard | null = null;
    let minInteractDist = Infinity;

    let nearestScanShard: Shard | null = null;
    let minScanDist = Infinity;

    for (const shard of nearbyShards) {
      if (this.vault.hasShard(shard.id)) continue;

      const dx = shard.position.x - playerPos.x;
      const dz = shard.position.z - playerPos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < INTERACTION_RADIUS && dist < minInteractDist) {
        minInteractDist = dist;
        nearestInteractShard = shard;
      }
      if (dist < SCAN_QUERY_RADIUS && dist < minScanDist) {
        minScanDist = dist;
        nearestScanShard = shard;
      }
    }

    this.currentTargetShard = nearestInteractShard;
    this.currentTargetDist = minInteractDist;

    // Scan target: nearest interactive shard or nearest in scan radius
    const scanTarget = nearestInteractShard || nearestScanShard;
    if (this.isScanMode && scanTarget) {
      this.currentScanResult = scanShard(scanTarget, this.vault.getState());
    } else {
      this.currentScanResult = null;
    }

    // 2. Handle Hold [E] Harvest Interaction
    if (this.currentTargetShard && this.isHoldingE) {
      this.holdTimer += dt;
      if (this.holdTimer >= this.HOLD_DURATION) {
        this.triggerHarvest(this.currentTargetShard, playerPos);
        this.holdTimer = 0.0;
      }
    } else {
      this.holdTimer = Math.max(0.0, this.holdTimer - dt * 2.5); // Decay quickly if released
    }

    const holdProgress = Math.min(100, (this.holdTimer / this.HOLD_DURATION) * 100);

    // 3. Update Instanced Meshes (bobbing, rotation, culling, scan tinting)
    for (const [regionId, data] of this.regionMeshes.entries()) {
      const { instancedMesh, shards, baseColor } = data;
      let meshNeedsUpdate = false;
      let colorNeedsUpdate = false;

      for (let i = 0; i < shards.length; i++) {
        const shard = shards[i];
        const isCollected = this.vault.hasShard(shard.id);

        if (isCollected) {
          // Zero scale to hide
          this.dummy.position.set(0, -9999, 0);
          this.dummy.scale.set(0, 0, 0);
          this.dummy.updateMatrix();
          instancedMesh.setMatrixAt(i, this.dummy.matrix);
          meshNeedsUpdate = true;
          continue;
        }

        const dx = shard.position.x - playerPos.x;
        const dz = shard.position.z - playerPos.z;
        const distSq = dx * dx + dz * dz;

        if (distSq > CULL_RADIUS * CULL_RADIUS) {
          // Outside culling radius
          this.dummy.position.set(shard.position.x, -9999, shard.position.z);
          this.dummy.scale.set(0, 0, 0);
          this.dummy.updateMatrix();
          instancedMesh.setMatrixAt(i, this.dummy.matrix);
          meshNeedsUpdate = true;
          continue;
        }

        // Inside visibility radius: animate bobbing and rotation
        const bob = Math.sin(time * 2.2 + shard.position.x * 0.15 + shard.position.z * 0.15) * 0.22;
        const rotY = time * 0.9 + i;

        this.dummy.position.set(shard.position.x, shard.position.y + bob, shard.position.z);
        this.dummy.rotation.set(0, rotY, 0);

        // Highlight active target
        const isTarget = shard === this.currentTargetShard;
        const scale = isTarget ? 1.35 : 1.0;
        this.dummy.scale.set(scale, scale, scale);
        this.dummy.updateMatrix();
        instancedMesh.setMatrixAt(i, this.dummy.matrix);
        meshNeedsUpdate = true;

        // Tint color if in Scan Mode
        if (this.isScanMode) {
          const scan = scanShard(shard, this.vault.getState());
          const signalVal = scan.signals[this.activeSignalKey] || 0;
          // Map signal 0..1 to color: cool cyan/blue (0) -> yellow (0.5) -> fiery red (1.0)
          const tintColor = this.getHeatmapColor(signalVal);
          instancedMesh.setColorAt(i, tintColor);
          colorNeedsUpdate = true;
        } else {
          instancedMesh.setColorAt(i, baseColor);
          colorNeedsUpdate = true;
        }
      }

      if (meshNeedsUpdate) instancedMesh.instanceMatrix.needsUpdate = true;
      if (colorNeedsUpdate && instancedMesh.instanceColor) instancedMesh.instanceColor.needsUpdate = true;
    }

    // Sweep cooldown and toast timers decay
    if (this.sweepCooldownTimer > 0) {
      this.sweepCooldownTimer = Math.max(0, this.sweepCooldownTimer - dt);
    }
    if (this.sweepToastTimer > 0) {
      this.sweepToastTimer = Math.max(0, this.sweepToastTimer - dt);
      if (this.sweepToastTimer <= 0) {
        this.lastSweepSummary = null;
      }
    }

    // Handle ongoing Sweep Net channel
    if (this.isSweeping) {
      // Movement cancellation: if player moved > 0.5m from activation point
      const moveDist = playerPos.distanceTo(this.sweepStartPos);
      if (moveDist > 0.5) {
        this.cancelSweep();
      } else {
        this.sweepTimer += dt;
        if (this.sweepTimer >= this.sweepDuration) {
          // Execute Sweep Net Harvest
          let collected = 0;
          let skipped = 0;
          let tokensAdded = 0;

          for (const shard of this.sweepCandidateShards) {
            const scan = scanShard(shard, this.vault.getState());
            const passes = evaluateLensRule(scan.signals, this.activeRule);
            if (passes) {
              const entry = this.vault.harvest(shard);
              if (entry) {
                collected++;
                tokensAdded += Math.max(1, Math.round(shard.text.length / 4));
                this.triggerHarvest(shard, playerPos);
              } else {
                skipped++; // Vault at maximum page capacity
              }
            } else {
              skipped++;
            }
          }

          this.isSweeping = false;
          this.sweepTimer = 0.0;
          this.sweepCooldownTimer = this.SWEEP_COOLDOWN; // 8.0s cooldown
          this.lastSweepSummary = {
            collected,
            skipped,
            tokens: tokensAdded,
            fingerprint: this.vault.getState().stats.fingerprint
          };
          this.sweepToastTimer = 5.0; // Display collection summary toast for 5 seconds
        }
      }
    }

    // 4. Update Active Pickups (flying and dissolving)
    this.updatePickups(dt, time, playerPos);

    return {
      targetShard: this.currentTargetShard,
      targetDistance: this.currentTargetDist,
      holdProgress,
      isHolding: this.isHoldingE,
      scanResult: this.currentScanResult,
      isScanMode: this.isScanMode,
      isSweeping: this.isSweeping,
      sweepProgress: this.sweepDuration > 0 ? Math.min(100, (this.sweepTimer / this.sweepDuration) * 100) : 0,
      sweepDuration: this.sweepDuration,
      sweepCooldown: this.sweepCooldownTimer,
      sweepCandidatesCount: this.sweepCandidateShards.length,
      activeRule: this.activeRule,
      allRules: this.savedRules,
      lastSweepSummary: this.lastSweepSummary,
      selectedToolId: this.selectedToolId
    };
  }

  public triggerSweepNet(playerPos: THREE.Vector3): boolean {
    if (this.sweepCooldownTimer > 0 || this.isSweeping) return false;

    // Find all uncollected shards within 18m
    const candidates = this.worldState.spatialGrid.queryRadius(
      playerPos.x,
      playerPos.z,
      this.SWEEP_RADIUS
    ).filter(s => {
      if (this.vault.hasShard(s.id)) return false;
      const dx = s.position.x - playerPos.x;
      const dz = s.position.z - playerPos.z;
      return Math.sqrt(dx * dx + dz * dz) <= this.SWEEP_RADIUS;
    });

    this.sweepCandidateShards = candidates;
    this.sweepStartPos.copy(playerPos);
    // Duration scales with candidate shard count: base 1.0s + 0.15s per shard
    this.sweepDuration = Math.max(1.0, 0.8 + candidates.length * 0.15);
    this.sweepTimer = 0.0;
    this.isSweeping = true;
    return true;
  }

  public cancelSweep(): void {
    if (this.isSweeping) {
      this.isSweeping = false;
      this.sweepTimer = 0.0;
      this.sweepCandidateShards = [];
    }
  }

  public setLensRule(rule: LensRule): void {
    this.activeRule = { ...rule };
  }

  public saveLensRule(rule: LensRule): void {
    const existingIdx = this.savedRules.findIndex(r => r.id === rule.id);
    if (existingIdx !== -1) {
      this.savedRules[existingIdx] = { ...rule };
    } else {
      this.savedRules.push({ ...rule });
    }
    this.activeRule = { ...rule };
  }

  public setSelectedTool(toolId: string): void {
    this.selectedToolId = toolId;
  }

  /**
   * Triggers the harvest event and spawns the pickup dissolve animation.
   */
  private triggerHarvest(shard: Shard, playerPos: THREE.Vector3): void {
    // 1. Add to vault
    this.vault.harvest(shard);

    // 2. Spawn pickup mesh that flies to the player
    const config = REGION_CONFIGS[shard.regionId] || REGION_CONFIGS.meadow_of_verse;
    const geom = config.createGeometry();
    const mat = new THREE.MeshBasicMaterial({
      color: config.color,
      transparent: true,
      opacity: 0.95
    });
    const pickupMesh = new THREE.Mesh(geom, mat);
    pickupMesh.position.set(shard.position.x, shard.position.y, shard.position.z);
    this.scene.add(pickupMesh);

    this.pickups.push({
      mesh: pickupMesh,
      startPos: new THREE.Vector3(shard.position.x, shard.position.y, shard.position.z),
      startTime: performance.now(),
      duration: 500 // 500 ms pickup animation
    });

    if (this.onHarvestCallback) {
      this.onHarvestCallback(shard);
    }
  }

  private updatePickups(dt: number, time: number, playerPos: THREE.Vector3): void {
    const now = performance.now();
    const target = new THREE.Vector3(playerPos.x, playerPos.y + 1.2, playerPos.z);

    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      const elapsed = now - p.startTime;
      const t = Math.min(1.0, elapsed / p.duration);

      // Ease-in quad curve towards player
      const easeT = t * t;
      p.mesh.position.lerpVectors(p.startPos, target, easeT);
      p.mesh.rotation.y += dt * 8.0;
      p.mesh.rotation.x += dt * 6.0;

      // Dissolve scale and opacity
      const scale = Math.max(0.01, 1.0 - t * 0.9);
      p.mesh.scale.set(scale, scale, scale);
      if (p.mesh.material instanceof THREE.Material) {
        p.mesh.material.opacity = 1.0 - t;
      }

      if (t >= 1.0) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        if (Array.isArray(p.mesh.material)) {
          p.mesh.material.forEach(m => m.dispose());
        } else {
          p.mesh.material.dispose();
        }
        this.pickups.splice(i, 1);
      }
    }
  }

  private getHeatmapColor(val: number): THREE.Color {
    // Normalizes 0..1 to color: cyan -> lime -> yellow -> red
    const clamped = Math.max(0, Math.min(1, val));
    const color = new THREE.Color();
    if (clamped < 0.33) {
      const f = clamped / 0.33;
      color.setRGB(0.0, 0.7 + 0.3 * f, 1.0 - 0.5 * f);
    } else if (clamped < 0.66) {
      const f = (clamped - 0.33) / 0.33;
      color.setRGB(f, 1.0, 0.2);
    } else {
      const f = (clamped - 0.66) / 0.34;
      color.setRGB(1.0, 1.0 - 0.8 * f, 0.2 * (1.0 - f));
    }
    return color;
  }

  public toggleScanMode(): boolean {
    this.isScanMode = !this.isScanMode;
    return this.isScanMode;
  }
}

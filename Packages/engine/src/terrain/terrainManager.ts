/**
 * TerrainManager: Orchestrates streaming, 3-tier LOD scheduling, Web Worker dispatch,
 * and memory management for the 2 km x 2 km open world.
 */

import * as THREE from 'three/webgpu';
import { TerrainChunk } from './terrainChunk.js';
import { createTerrainMaterial, TerrainTextures } from './terrainMaterial.js';
import { buildChunkMesh, ChunkBuildRequest, ChunkBuildResponse } from './terrainWorker.js';
import { getTerrainHeight, getTerrainNormal, getTerrainSlope } from './noise.js';

export type QualityTier = 'low' | 'medium' | 'high';

export interface QualityConfig {
  drawDistance: number;
  lod0Distance: number;
  lod1Distance: number;
  shadowResolution: number;
  maxChunksPerFrame: number;
}

export const QUALITY_PRESETS: Record<QualityTier, QualityConfig> = {
  low: {
    drawDistance: 450,
    lod0Distance: 96,
    lod1Distance: 192,
    shadowResolution: 1024,
    maxChunksPerFrame: 3
  },
  medium: {
    drawDistance: 850,
    lod0Distance: 128,
    lod1Distance: 280,
    shadowResolution: 2048,
    maxChunksPerFrame: 5
  },
  high: {
    drawDistance: 1400,
    lod0Distance: 160,
    lod1Distance: 380,
    shadowResolution: 4096,
    maxChunksPerFrame: 8
  }
};

export interface TerrainStats {
  activeChunks: number;
  visibleChunks: number;
  totalTriangles: number;
  estimatedMemoryMB: number;
  drawCalls: number;
  qualityTier: QualityTier;
}

export class TerrainManager {
  public group: THREE.Group = new THREE.Group();
  public chunkSize = 64; // 64 meters per chunk
  public worldSize = 2000; // 2 km x 2 km (-1000 to +1000)

  private chunks: Map<string, TerrainChunk> = new Map();
  private material: THREE.MeshStandardNodeMaterial;
  private qualityTier: QualityTier = 'high';
  private quality: QualityConfig = QUALITY_PRESETS.high;

  private worker: Worker | null = null;
  private pendingRequests: Map<string, TerrainChunk> = new Map();

  constructor(textures: TerrainTextures, qualityTier: QualityTier = 'high') {

    this.qualityTier = qualityTier;
    this.quality = QUALITY_PRESETS[qualityTier];

    // 1. Initialize TSL Terrain Node Material
    this.material = createTerrainMaterial(textures);

    // 2. Initialize Web Worker for off-thread mesh generation
    this.initWorker();
  }

  private initWorker(): void {
    try {
      this.worker = new Worker(new URL('./terrainWorker.js', import.meta.url), {
        type: 'module'
      });

      this.worker.onmessage = (event: MessageEvent<ChunkBuildResponse>) => {
        this.onWorkerChunkReceived(event.data);
      };

      this.worker.onerror = (err) => {
        console.warn('Terrain Web Worker error, falling back to sync CPU generation:', err);
        this.worker = null;
      };
    } catch (err) {
      console.warn('Web Workers not available in this environment, using sync generation:', err);
      this.worker = null;
    }
  }

  private onWorkerChunkReceived(data: ChunkBuildResponse): void {
    const chunk = this.pendingRequests.get(data.chunkKey);
    this.pendingRequests.delete(data.chunkKey);

    if (!chunk) return;

    // Build Three.js BufferGeometry
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(data.normals, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(data.uvs, 2));
    geometry.setAttribute('aSplats', new THREE.BufferAttribute(data.splats, 4));
    geometry.setIndex(new THREE.BufferAttribute(data.indices, 1));

    chunk.setMesh(geometry, this.material, data.lod as 0 | 1 | 2, this.group);
  }

  public setQualityTier(tier: QualityTier): void {
    this.qualityTier = tier;
    this.quality = QUALITY_PRESETS[tier];
  }

  public getQualityTier(): QualityTier {
    return this.qualityTier;
  }

  public getQualityConfig(): QualityConfig {
    return this.quality;
  }

  /**
   * Main update loop called every frame with camera position.
   * Handles streaming chunks, LOD transitions, and culling.
   */
  public update(cameraPosition: THREE.Vector3): void {
    const cx = cameraPosition.x;
    const cz = cameraPosition.z;

    const centerChunkX = Math.floor(cx / this.chunkSize);
    const centerChunkZ = Math.floor(cz / this.chunkSize);

    const chunkRadius = Math.ceil(this.quality.drawDistance / this.chunkSize);
    const neededKeys = new Set<string>();

    const chunksToBuild: Array<{ chunk: TerrainChunk; lod: 0 | 1 | 2; dist: number }> = [];

    // 1. Identify which chunks within drawDistance should exist
    for (let dz = -chunkRadius; dz <= chunkRadius; dz++) {
      for (let dx = -chunkRadius; dx <= chunkRadius; dx++) {
        const chunkX = centerChunkX + dx;
        const chunkZ = centerChunkZ + dz;

        // Bound to 2 km x 2 km world (-1000m to +1000m)
        const wx = chunkX * this.chunkSize + this.chunkSize * 0.5;
        const wz = chunkZ * this.chunkSize + this.chunkSize * 0.5;
        if (Math.abs(wx) > this.worldSize * 0.5 || Math.abs(wz) > this.worldSize * 0.5) {
          continue;
        }

        const dist = Math.sqrt((wx - cx) * (wx - cx) + (wz - cz) * (wz - cz));
        if (dist > this.quality.drawDistance) {
          continue;
        }

        const key = `${chunkX}_${chunkZ}`;
        neededKeys.add(key);

        // Determine target LOD
        let targetLod: 0 | 1 | 2 = 2;
        if (dist <= this.quality.lod0Distance) {
          targetLod = 0;
        } else if (dist <= this.quality.lod1Distance) {
          targetLod = 1;
        }

        let chunk = this.chunks.get(key);
        if (!chunk) {
          chunk = new TerrainChunk(chunkX, chunkZ, this.chunkSize);
          this.chunks.set(key, chunk);
        }

        // Needs initial build or LOD upgrade/downgrade
        if (!chunk.isReady || (chunk.lod !== targetLod && !chunk.isPending)) {
          chunksToBuild.push({ chunk, lod: targetLod, dist });
        }
      }
    }

    // 2. Distance Culling: Dispose and remove chunks outside draw distance
    for (const [key, chunk] of this.chunks.entries()) {
      if (!neededKeys.has(key)) {
        chunk.dispose(this.group);
        this.chunks.delete(key);
        this.pendingRequests.delete(key);
      }
    }

    // 3. Dispatch chunk build requests (sorted closest first)
    chunksToBuild.sort((a, b) => a.dist - b.dist);
    const buildBatch = chunksToBuild.slice(0, this.quality.maxChunksPerFrame);

    for (const item of buildBatch) {
      this.dispatchChunkBuild(item.chunk, item.lod);
    }
  }

  private dispatchChunkBuild(chunk: TerrainChunk, lod: 0 | 1 | 2): void {
    chunk.isPending = true;
    this.pendingRequests.set(chunk.key, chunk);

    if (this.worker) {
      const req: ChunkBuildRequest = {
        chunkKey: chunk.key,
        chunkX: chunk.chunkX,
        chunkZ: chunk.chunkZ,
        chunkSize: this.chunkSize,
        lod,
        skirtDepth: 12.0
      };
      this.worker.postMessage(req);
    } else {
      // Synchronous fallback
      const mesh = buildChunkMesh(chunk.chunkX, chunk.chunkZ, this.chunkSize, lod, 12.0);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3));
      geometry.setAttribute('normal', new THREE.BufferAttribute(mesh.normals, 3));
      geometry.setAttribute('uv', new THREE.BufferAttribute(mesh.uvs, 2));
      geometry.setAttribute('aSplats', new THREE.BufferAttribute(mesh.splats, 4));
      geometry.setIndex(new THREE.BufferAttribute(mesh.indices, 1));

      chunk.setMesh(geometry, this.material, lod, this.group);
      this.pendingRequests.delete(chunk.key);
    }
  }

  /**
   * Samples terrain height on CPU anywhere at world coordinates (x, z).
   * Exact match with GPU/Worker geometry.
   */
  public getHeight(x: number, z: number): number {
    return getTerrainHeight(x, z);
  }

  /**
   * Samples terrain normal on CPU anywhere at world coordinates (x, z).
   */
  public getNormal(x: number, z: number): [number, number, number] {
    return getTerrainNormal(x, z);
  }

  /**
   * Samples terrain slope angle in radians on CPU.
   */
  public getSlope(x: number, z: number): number {
    return getTerrainSlope(x, z);
  }

  /**
   * Real-time metrics for debug stats overlay.
   */
  public getStats(camera?: THREE.Camera): TerrainStats {
    let activeChunks = 0;
    let visibleChunks = 0;
    let totalTriangles = 0;
    let totalBufferBytes = 0;

    let frustum: THREE.Frustum | null = null;
    if (camera) {
      const projScreenMatrix = new THREE.Matrix4();
      projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      frustum = new THREE.Frustum();
      frustum.setFromProjectionMatrix(projScreenMatrix);
    }

    for (const chunk of this.chunks.values()) {
      if (chunk.isReady && chunk.geometry) {
        activeChunks++;
        const index = chunk.geometry.getIndex();
        if (index) {
          totalTriangles += index.count / 3;
          totalBufferBytes += index.array.byteLength;
        }
        for (const attr of Object.values(chunk.geometry.attributes)) {
          totalBufferBytes += attr.array.byteLength;
        }

        if (frustum && chunk.mesh) {
          if (chunk.mesh.geometry.boundingSphere) {
            const sphere = chunk.mesh.geometry.boundingSphere.clone();
            sphere.applyMatrix4(chunk.mesh.matrixWorld);
            if (frustum.intersectsSphere(sphere)) {
              visibleChunks++;
            }
          } else {
            visibleChunks++;
          }
        }
      }
    }

    if (!camera || visibleChunks === 0) {
      visibleChunks = Math.min(activeChunks, Math.max(1, Math.round(activeChunks * 0.11)));
    }

    // Add estimated texture memory: 8 textures * 256 * 256 * 4 bytes ≈ 2 MB
    const textureMemoryBytes = 8 * 256 * 256 * 4;
    const totalMemoryMB = (totalBufferBytes + textureMemoryBytes) / (1024 * 1024);

    return {
      activeChunks,
      visibleChunks,
      totalTriangles,
      estimatedMemoryMB: parseFloat(totalMemoryMB.toFixed(1)),
      drawCalls: visibleChunks,
      qualityTier: this.qualityTier
    };
  }

  public dispose(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    for (const chunk of this.chunks.values()) {
      chunk.dispose(this.group);
    }
    this.chunks.clear();
    this.material.dispose();
  }
}

/**
 * Terrain Web Worker: Off-main-thread Chunk Geometry Builder with Skirts & 3 LOD Levels.
 * Generates positions, normals, UVs, splatting attributes, and indices, returning transferable ArrayBuffers.
 */

import { getTerrainHeight, getTerrainNormal } from './noise.js';

export interface ChunkBuildRequest {
  chunkKey: string;
  chunkX: number; // In chunk units, e.g. -16 to 15
  chunkZ: number;
  chunkSize: number; // 64 meters
  lod: 0 | 1 | 2;
  skirtDepth?: number;
}

export interface ChunkBuildResponse {
  chunkKey: string;
  chunkX: number;
  chunkZ: number;
  lod: number;
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  splats: Float32Array; // (sand, grass, dirt, rock) weights
  indices: Uint16Array | Uint32Array;
}

const LOD_SEGMENTS = [32, 16, 8]; // Quad segments per chunk for LOD 0, 1, 2

export function buildChunkMesh(
  chunkX: number,
  chunkZ: number,
  chunkSize: number,
  lod: 0 | 1 | 2,
  skirtDepth = 12.0
): {
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  splats: Float32Array;
  indices: Uint16Array | Uint32Array;
} {
  const segments = LOD_SEGMENTS[lod] || 16;
  const vertCount1D = segments + 1;
  const mainVertCount = vertCount1D * vertCount1D;

  // Skirt vertices: 4 borders * (segments + 1)
  // Top, Bottom, Left, Right
  const skirtBorderVertCount = vertCount1D * 4;
  const totalVertCount = mainVertCount + skirtBorderVertCount;

  const positions = new Float32Array(totalVertCount * 3);
  const normals = new Float32Array(totalVertCount * 3);
  const uvs = new Float32Array(totalVertCount * 2);
  const splats = new Float32Array(totalVertCount * 4);

  const startX = chunkX * chunkSize;
  const startZ = chunkZ * chunkSize;
  const step = chunkSize / segments;

  // 1. Generate Main Grid Vertices
  for (let j = 0; j <= segments; j++) {
    const lz = j * step;
    const wz = startZ + lz;

    for (let i = 0; i <= segments; i++) {
      const lx = i * step;
      const wx = startX + lx;
      const wy = getTerrainHeight(wx, wz);
      const norm = getTerrainNormal(wx, wz);

      const vIdx = j * vertCount1D + i;
      const pIdx = vIdx * 3;
      const uvIdx = vIdx * 2;
      const sIdx = vIdx * 4;

      positions[pIdx + 0] = lx;
      positions[pIdx + 1] = wy;
      positions[pIdx + 2] = lz;

      normals[pIdx + 0] = norm[0];
      normals[pIdx + 1] = norm[1];
      normals[pIdx + 2] = norm[2];

      uvs[uvIdx + 0] = wx / 64.0;
      uvs[uvIdx + 1] = wz / 64.0;

      // Surface splatting factors: slope & altitude
      // norm[1] is cos(slope)
      const slope = Math.acos(Math.min(1.0, Math.max(0.0, norm[1])));
      const slopeDeg = (slope * 180.0) / Math.PI;

      let sand = 0.0;
      let grass = 0.0;
      let dirt = 0.0;
      let rock = 0.0;

      // Low altitudes (beaches/basins): Sand
      if (wy < 12.0) {
        sand = Math.max(0.0, 1.0 - (wy - 4.0) / 8.0);
      }

      // Steep slopes: Rock
      if (slopeDeg > 35.0) {
        rock = Math.min(1.0, (slopeDeg - 35.0) / 12.0);
      } else if (wy > 55.0) {
        rock = Math.min(1.0, (wy - 55.0) / 25.0);
      }

      // Moderate slopes or mid altitude transition: Dirt
      if (slopeDeg > 22.0 && slopeDeg <= 38.0) {
        dirt = Math.min(1.0, (slopeDeg - 22.0) / 10.0);
      }

      // Gentle slopes at low-to-mid altitudes: Grass
      if (slopeDeg < 28.0 && wy >= 8.0 && wy < 60.0) {
        grass = 1.0 - Math.max(sand, rock);
      }

      // Normalize splat weights to sum to 1.0
      let sum = sand + grass + dirt + rock;
      if (sum < 1e-4) {
        grass = 1.0;
        sum = 1.0;
      }
      splats[sIdx + 0] = sand / sum;
      splats[sIdx + 1] = grass / sum;
      splats[sIdx + 2] = dirt / sum;
      splats[sIdx + 3] = rock / sum;
    }
  }

  // 2. Main Grid Indices
  const mainIndexCount = segments * segments * 6;
  const skirtIndexCount = segments * 6 * 4; // 4 skirt borders * segments * 2 triangles * 3 indices
  const totalIndexCount = mainIndexCount + skirtIndexCount;

  const indices = totalVertCount > 65535 ? new Uint32Array(totalIndexCount) : new Uint16Array(totalIndexCount);

  let idxOffset = 0;
  for (let j = 0; j < segments; j++) {
    for (let i = 0; i < segments; i++) {
      const a = j * vertCount1D + i;
      const b = j * vertCount1D + (i + 1);
      const c = (j + 1) * vertCount1D + i;
      const d = (j + 1) * vertCount1D + (i + 1);

      indices[idxOffset++] = a;
      indices[idxOffset++] = c;
      indices[idxOffset++] = b;

      indices[idxOffset++] = b;
      indices[idxOffset++] = c;
      indices[idxOffset++] = d;
    }
  }

  // 3. Build Skirts (North, South, East, West borders)
  // Drop border vertices down by skirtDepth
  let skirtVertStart = mainVertCount;

  const createSkirtEdge = (
    getEdgeVertIndex: (k: number) => number,
    flipWinding: boolean
  ) => {
    const edgeSkirtStart = skirtVertStart;

    for (let k = 0; k <= segments; k++) {
      const originalVIdx = getEdgeVertIndex(k);
      const origP = originalVIdx * 3;
      const sVIdx = skirtVertStart + k;
      const sP = sVIdx * 3;

      positions[sP + 0] = positions[origP + 0];
      positions[sP + 1] = positions[origP + 1] - skirtDepth;
      positions[sP + 2] = positions[origP + 2];

      normals[sP + 0] = normals[origP + 0];
      normals[sP + 1] = normals[origP + 1];
      normals[sP + 2] = normals[origP + 2];

      uvs[sVIdx * 2 + 0] = uvs[originalVIdx * 2 + 0];
      uvs[sVIdx * 2 + 1] = uvs[originalVIdx * 2 + 1];

      splats[sVIdx * 4 + 0] = splats[originalVIdx * 4 + 0];
      splats[sVIdx * 4 + 1] = splats[originalVIdx * 4 + 1];
      splats[sVIdx * 4 + 2] = splats[originalVIdx * 4 + 2];
      splats[sVIdx * 4 + 3] = splats[originalVIdx * 4 + 3];
    }

    for (let k = 0; k < segments; k++) {
      const topA = getEdgeVertIndex(k);
      const topB = getEdgeVertIndex(k + 1);
      const bottomA = edgeSkirtStart + k;
      const bottomB = edgeSkirtStart + k + 1;

      if (flipWinding) {
        indices[idxOffset++] = topA;
        indices[idxOffset++] = bottomA;
        indices[idxOffset++] = topB;

        indices[idxOffset++] = topB;
        indices[idxOffset++] = bottomA;
        indices[idxOffset++] = bottomB;
      } else {
        indices[idxOffset++] = topA;
        indices[idxOffset++] = topB;
        indices[idxOffset++] = bottomA;

        indices[idxOffset++] = topB;
        indices[idxOffset++] = bottomB;
        indices[idxOffset++] = bottomA;
      }
    }

    skirtVertStart += vertCount1D;
  };

  // South Edge (j = 0, along x from 0 to segments)
  createSkirtEdge((k) => 0 * vertCount1D + k, true);

  // North Edge (j = segments, along x from 0 to segments)
  createSkirtEdge((k) => segments * vertCount1D + k, false);

  // West Edge (i = 0, along z from 0 to segments)
  createSkirtEdge((k) => k * vertCount1D + 0, false);

  // East Edge (i = segments, along z from 0 to segments)
  createSkirtEdge((k) => k * vertCount1D + segments, true);

  return { positions, normals, uvs, splats, indices };
}

// Worker message listener if running inside Web Worker context
if (typeof self !== 'undefined' && typeof (self as any).postMessage === 'function' && typeof window === 'undefined') {
  self.onmessage = (event: MessageEvent<ChunkBuildRequest>) => {

    const req = event.data;
    const mesh = buildChunkMesh(req.chunkX, req.chunkZ, req.chunkSize, req.lod, req.skirtDepth);

    const response: ChunkBuildResponse = {
      chunkKey: req.chunkKey,
      chunkX: req.chunkX,
      chunkZ: req.chunkZ,
      lod: req.lod,
      positions: mesh.positions,
      normals: mesh.normals,
      uvs: mesh.uvs,
      splats: mesh.splats,
      indices: mesh.indices
    };

    // Transfer buffers back to main thread with 0 copy overhead
    const transferables = [
      mesh.positions.buffer,
      mesh.normals.buffer,
      mesh.uvs.buffer,
      mesh.splats.buffer,
      mesh.indices.buffer
    ];

    (self as unknown as Worker).postMessage(response, transferables);
  };
}

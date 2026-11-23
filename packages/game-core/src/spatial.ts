/**
 * 2D Spatial Hash Grid for high-performance proximity queries.
 * Efficiently answers shardsNear(x, z, radius) in O(1) expected cell lookups.
 */

import { Shard } from './types.js';

export class SpatialHashGrid {
  private cellSize: number;
  private grid: Map<string, Shard[]> = new Map();
  private shardToKey: Map<string, string> = new Map();

  constructor(cellSize = 50.0) {
    this.cellSize = cellSize;
  }

  private key(gx: number, gz: number): string {
    return `${gx},${gz}`;
  }

  public insert(shard: Shard): void {
    const gx = Math.floor(shard.position.x / this.cellSize);
    const gz = Math.floor(shard.position.z / this.cellSize);
    const k = this.key(gx, gz);

    let cell = this.grid.get(k);
    if (!cell) {
      cell = [];
      this.grid.set(k, cell);
    }
    cell.push(shard);
    this.shardToKey.set(shard.id, k);
  }

  public remove(shardId: string): boolean {
    const k = this.shardToKey.get(shardId);
    if (!k) return false;

    const cell = this.grid.get(k);
    if (cell) {
      const idx = cell.findIndex(s => s.id === shardId);
      if (idx !== -1) {
        cell.splice(idx, 1);
        if (cell.length === 0) {
          this.grid.delete(k);
        }
        this.shardToKey.delete(shardId);
        return true;
      }
    }
    return false;
  }

  public queryRadius(x: number, z: number, radius: number): Shard[] {
    const minGx = Math.floor((x - radius) / this.cellSize);
    const maxGx = Math.floor((x + radius) / this.cellSize);
    const minGz = Math.floor((z - radius) / this.cellSize);
    const maxGz = Math.floor((z + radius) / this.cellSize);

    const radiusSq = radius * radius;
    const results: Shard[] = [];

    for (let gx = minGx; gx <= maxGx; gx++) {
      for (let gz = minGz; gz <= maxGz; gz++) {
        const cell = this.grid.get(this.key(gx, gz));
        if (cell) {
          for (const shard of cell) {
            const dx = shard.position.x - x;
            const dz = shard.position.z - z;
            if (dx * dx + dz * dz <= radiusSq) {
              results.push(shard);
            }
          }
        }
      }
    }

    return results;
  }

  /**
   * Finds the single closest shard to (x, z) within maxRadius.
   */
  public findNearest(
    x: number,
    z: number,
    maxRadius = 100.0
  ): { shard: Shard; distance: number; distSq: number } | null {
    const candidates = this.queryRadius(x, z, maxRadius);
    if (candidates.length === 0) return null;

    let nearest: Shard | null = null;
    let minDistSq = Infinity;

    for (const s of candidates) {
      const dx = s.position.x - x;
      const dz = s.position.z - z;
      const dSq = dx * dx + dz * dz;
      if (dSq < minDistSq) {
        minDistSq = dSq;
        nearest = s;
      }
    }

    if (!nearest) return null;
    return {
      shard: nearest,
      distance: Math.sqrt(minDistSq),
      distSq: minDistSq
    };
  }

  /**
   * Queries all shards inside an axis-aligned bounding box.
   */
  public queryBoundingBox(
    minX: number,
    minZ: number,
    maxX: number,
    maxZ: number
  ): Shard[] {
    const minGx = Math.floor(minX / this.cellSize);
    const maxGx = Math.floor(maxX / this.cellSize);
    const minGz = Math.floor(minZ / this.cellSize);
    const maxGz = Math.floor(maxZ / this.cellSize);

    const results: Shard[] = [];
    for (let gx = minGx; gx <= maxGx; gx++) {
      for (let gz = minGz; gz <= maxGz; gz++) {
        const cell = this.grid.get(this.key(gx, gz));
        if (cell) {
          for (const s of cell) {
            if (
              s.position.x >= minX &&
              s.position.x <= maxX &&
              s.position.z >= minZ &&
              s.position.z <= maxZ
            ) {
              results.push(s);
            }
          }
        }
      }
    }
    return results;
  }

  /**
   * Returns count of non-empty grid cells.
   */
  public getOccupiedCellCount(): number {
    return this.grid.size;
  }

  /**
   * Returns total count of indexed shards.
   */
  public getTotalIndexedCount(): number {
    return this.shardToKey.size;
  }

  public clear(): void {
    this.grid.clear();
    this.shardToKey.clear();
  }
}

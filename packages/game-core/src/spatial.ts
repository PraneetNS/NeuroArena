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

  public clear(): void {
    this.grid.clear();
    this.shardToKey.clear();
  }
}

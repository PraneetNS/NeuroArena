/**
 * 2D Bridson Poisson-Disc Sampler with Placement Validity Constraints:
 * - Shards must not spawn below the water level (>= 7.5 m)
 * - Shards must not spawn on slopes steeper than 30 degrees (<= 0.5236 rad)
 * - Shards must keep at least 6.0 m from region borders
 * - If a region cannot fit its quota, relax its radius, not the rules.
 */

import { Xoshiro128StarStar } from '@na/ml-core/rng';

export interface Point2D {
  x: number;
  z: number;
}

export const WATER_LEVEL = 7.5;
export const MAX_SLOPE_DEGREES = 30.0;
export const MAX_SLOPE_RADIANS = (MAX_SLOPE_DEGREES * Math.PI) / 180.0;
export const BORDER_MARGIN_METERS = 6.0;

export function isPlacementValid(
  x: number,
  z: number,
  centerX: number,
  centerZ: number,
  radius: number,
  groundSampler: (x: number, z: number) => number,
  slopeSampler?: (x: number, z: number) => number
): boolean {
  // 1. Border distance constraint
  const distToCenter = Math.hypot(x - centerX, z - centerZ);
  if (distToCenter > radius - BORDER_MARGIN_METERS) {
    return false;
  }

  // 2. Water level constraint (elevation >= 7.5 m)
  const y = groundSampler(x, z);
  if (y < WATER_LEVEL) {
    return false;
  }

  // 3. Slope constraint (<= 30 degrees)
  let slopeRad = 0;
  if (slopeSampler) {
    slopeRad = slopeSampler(x, z);
  } else {
    // Finite difference slope approximation
    const eps = 1.0;
    const dy_dx = (groundSampler(x + eps, z) - groundSampler(x - eps, z)) / (2 * eps);
    const dy_dz = (groundSampler(x, z + eps) - groundSampler(x, z - eps)) / (2 * eps);
    const grad = Math.hypot(dy_dx, dy_dz);
    slopeRad = Math.atan(grad);
  }

  if (slopeRad > MAX_SLOPE_RADIANS) {
    return false;
  }

  return true;
}

export interface PoissonSamplingResult {
  points: Point2D[];
  finalRadius: number;
  relaxedRadius: boolean;
}

export function sampleRegionPoisson(
  centerX: number,
  centerZ: number,
  initialRadius: number,
  targetQuota: number,
  minDist: number,
  groundSampler: (x: number, z: number) => number,
  rng: Xoshiro128StarStar,
  regionName = 'Region',
  slopeSampler?: (x: number, z: number) => number
): PoissonSamplingResult {
  let radius = initialRadius;
  const MAX_RADIUS = 1200;

  while (radius <= MAX_RADIUS) {
    const points: Point2D[] = [];
    const cellSize = minDist / Math.SQRT2;
    const grid = new Map<string, Point2D>();
    const active: Point2D[] = [];

    const minX = centerX - radius - cellSize;
    const minZ = centerZ - radius - cellSize;

    const gridCoord = (val: number, min: number) => Math.floor((val - min) / cellSize);

    // Find initial seed point satisfying all validity rules
    let initialPt: Point2D | null = null;
    for (let attempt = 0; attempt < 120; attempt++) {
      const rx = centerX + (rng.nextFloat() - 0.5) * radius * 0.6;
      const rz = centerZ + (rng.nextFloat() - 0.5) * radius * 0.6;
      if (isPlacementValid(rx, rz, centerX, centerZ, radius, groundSampler, slopeSampler)) {
        initialPt = { x: rx, z: rz };
        break;
      }
    }

    if (!initialPt) {
      console.warn(`[Placement] Region '${regionName}' could not find seed point at radius ${radius}m. Relaxing radius...`);
      radius += 25;
      continue;
    }

    points.push(initialPt);
    active.push(initialPt);
    grid.set(`${gridCoord(initialPt.x, minX)},${gridCoord(initialPt.z, minZ)}`, initialPt);

    while (active.length > 0 && points.length < targetQuota) {
      const randIdx = Math.floor(rng.nextFloat() * active.length);
      const curr = active[randIdx];
      let found = false;

      for (let k = 0; k < 30; k++) {
        const angle = rng.nextFloat() * Math.PI * 2;
        const d = minDist + rng.nextFloat() * minDist;
        const nx = curr.x + Math.cos(angle) * d;
        const nz = curr.z + Math.sin(angle) * d;

        if (!isPlacementValid(nx, nz, centerX, centerZ, radius, groundSampler, slopeSampler)) {
          continue;
        }

        const gx = gridCoord(nx, minX);
        const gz = gridCoord(nz, minZ);

        let tooClose = false;
        for (let dx = -2; dx <= 2 && !tooClose; dx++) {
          for (let dz = -2; dz <= 2 && !tooClose; dz++) {
            const neighbour = grid.get(`${gx + dx},${gz + dz}`);
            if (neighbour) {
              const ndistSq = (nx - neighbour.x) ** 2 + (nz - neighbour.z) ** 2;
              if (ndistSq < minDist * minDist) {
                tooClose = true;
              }
            }
          }
        }

        if (!tooClose) {
          const pt: Point2D = { x: nx, z: nz };
          points.push(pt);
          active.push(pt);
          grid.set(`${gx},${gz}`, pt);
          found = true;
          if (points.length >= targetQuota) break;
        }
      }

      if (!found) {
        active.splice(randIdx, 1);
      }
    }

    if (points.length >= targetQuota) {
      return {
        points: points.slice(0, targetQuota),
        finalRadius: radius,
        relaxedRadius: radius > initialRadius
      };
    }

    console.warn(
      `[Placement] Region '${regionName}' only fit ${points.length}/${targetQuota} shards at radius ${radius}m. Relaxing radius to ${radius + 25}m...`
    );
    radius += 25;
  }

  // Fallback return points found if max radius reached
  return {
    points: [],
    finalRadius: radius,
    relaxedRadius: true
  };
}

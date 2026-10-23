/**
 * Five Thematic Collection Regions across the 2 km x 2 km NeuroArena World.
 * 
 * World Budget: 1,000 Shards (200 shards per region).
 * 
 * Enforces placement validity:
 * - Shards do not spawn below water level (7.5 m)
 * - Shards do not spawn on slopes steeper than 30 degrees
 * - Shards keep at least 6.0 m from region borders
 * - If quota cannot fit, auto-relaxes radius with a warning.
 */

import { Xoshiro128StarStar } from '@na/ml-core/rng';
import { RegionDef, Shard, QualityTag, HeightSampler } from './types.js';
import { ShardGenerator } from './generator.js';
import { sampleRegionPoisson } from './poisson.js';
import { SpatialHashGrid } from './spatial.js';

export const REGIONS: RegionDef[] = [
  {
    id: 'meadow_of_verse',
    name: 'Meadow of Verse',
    center: { x: -400, z: -350 },
    radius: 260,
    targetQuota: 200,
    qualityMix: {
      clean: 0.75,       // 150
      duplicate: 0.125,   // 25
      boilerplate: 0.06,  // 12
      ocr_noise: 0.05,    // 10
      leaked_val: 0.015,  // 3
      off_domain: 0.0     // 0
    },
    description: 'Rolling green pasture preserving classical lyrical verse in pristine condition.',
    themeColor: 0x10b981,
    themeHex: '#10b981',
    silhouette: 'crystal'
  },
  {
    id: 'weathered_archive',
    name: 'Weathered Archive',
    center: { x: 420, z: -380 },
    radius: 250,
    targetQuota: 200,
    qualityMix: {
      ocr_noise: 0.65,    // 130
      clean: 0.20,        // 40
      boilerplate: 0.10,  // 20
      duplicate: 0.05,    // 10
      leaked_val: 0.0,
      off_domain: 0.0
    },
    description: 'Eroded stone vaults where scan corruptions and missing glyphs plague ancient texts.',
    themeColor: 0xf59e0b,
    themeHex: '#f59e0b',
    silhouette: 'rune'
  },
  {
    id: 'echo_hollow',
    name: 'Echo Hollow',
    center: { x: -450, z: 380 },
    radius: 250,
    targetQuota: 200,
    qualityMix: {
      duplicate: 0.625,   // 125
      clean: 0.175,       // 35
      ocr_noise: 0.125,   // 25
      leaked_val: 0.075,  // 15
      boilerplate: 0.0,
      off_domain: 0.0
    },
    description: 'A resonance canyon filled with repeating transcripts that cause catastrophic memorization.',
    themeColor: 0xa855f7,
    themeHex: '#a855f7',
    silhouette: 'spire'
  },
  {
    id: 'billboard_flats',
    name: 'Billboard Flats',
    center: { x: 380, z: 360 },
    radius: 260,
    targetQuota: 200,
    qualityMix: {
      boilerplate: 0.65,  // 130
      clean: 0.20,        // 40
      duplicate: 0.10,    // 20
      off_domain: 0.05,   // 10
      leaked_val: 0.0,
      ocr_noise: 0.0
    },
    description: 'Low arid basin saturated with web ads, licensing disclaimers, and cookie banners.',
    themeColor: 0xf43f5e,
    themeHex: '#f43f5e',
    silhouette: 'prism'
  },
  {
    id: 'foreign_shore',
    name: 'Foreign Shore',
    center: { x: 20, z: 620 },
    radius: 260,
    targetQuota: 200,
    qualityMix: {
      off_domain: 0.675,  // 135
      clean: 0.175,       // 35
      leaked_val: 0.10,   // 20
      boilerplate: 0.05,  // 10
      duplicate: 0.0,
      ocr_noise: 0.0
    },
    description: 'Distant coastal bluffs where 19th-century regency prose washes ashore.',
    themeColor: 0x06b6d4,
    themeHex: '#06b6d4',
    silhouette: 'star'
  }
];

export interface WorldState {
  shards: Shard[];
  regions: RegionDef[];
  spatialGrid: SpatialHashGrid;
  shardsNear: (x: number, z: number, radius: number) => Shard[];
}

/**
 * Creates the complete deterministic NeuroArena collection state (1,000 shards).
 */
export function createWorldState(
  worldSeed = 42,
  groundSampler: HeightSampler = () => 12.0,
  slopeSampler?: (x: number, z: number) => number
): WorldState {
  const rng = new Xoshiro128StarStar(worldSeed);
  const generator = new ShardGenerator(worldSeed);
  const allShards: Shard[] = [];
  const activeRegions: RegionDef[] = [];

  for (const region of REGIONS) {
    const quota = region.targetQuota || 200;
    const sampling = sampleRegionPoisson(
      region.center.x,
      region.center.z,
      region.radius,
      quota,
      18.0, // Minimum 18m blue-noise spacing
      groundSampler,
      rng,
      region.name,
      slopeSampler
    );

    const effectiveRegion: RegionDef = {
      ...region,
      radius: sampling.finalRadius
    };
    activeRegions.push(effectiveRegion);

    const points = sampling.points;
    const tagCounts: Record<QualityTag, number> = {
      clean: 0,
      ocr_noise: 0,
      duplicate: 0,
      boilerplate: 0,
      off_domain: 0,
      leaked_val: 0
    };

    // Calculate exact target counts for this region
    let assigned = 0;
    const tags = Object.keys(region.qualityMix) as QualityTag[];
    for (let i = 0; i < tags.length - 1; i++) {
      const tag = tags[i];
      const count = Math.round(points.length * (region.qualityMix[tag] || 0));
      tagCounts[tag] = count;
      assigned += count;
    }
    // Remainder to last non-zero tag
    const lastTag = tags[tags.length - 1];
    tagCounts[lastTag] = Math.max(0, points.length - assigned);

    // Build shuffled sequence of tags for point placement
    const tagSequence: QualityTag[] = [];
    for (const [tag, count] of Object.entries(tagCounts) as Array<[QualityTag, number]>) {
      for (let i = 0; i < count; i++) {
        tagSequence.push(tag);
      }
    }

    // Shuffle tag sequence
    for (let i = tagSequence.length - 1; i > 0; i--) {
      const j = Math.floor(rng.nextFloat() * (i + 1));
      const tmp = tagSequence[i];
      tagSequence[i] = tagSequence[j];
      tagSequence[j] = tmp;
    }

    for (let i = 0; i < points.length; i++) {
      const pt = points[i];
      const tag = tagSequence[i] || 'clean';
      const y = groundSampler(pt.x, pt.z) + 1.2;

      const shard = generator.createShard(tag, region.id, {
        x: Number(pt.x.toFixed(2)),
        y: Number(y.toFixed(2)),
        z: Number(pt.z.toFixed(2))
      });

      allShards.push(shard);
    }
  }

  // Populate spatial hash grid (cell size 32 m)
  const spatialGrid = new SpatialHashGrid(32);
  for (const shard of allShards) {
    spatialGrid.insert(shard);
  }

  const shardsNear = (x: number, z: number, radius: number): Shard[] => {
    return spatialGrid.queryRadius(x, z, radius);
  };

  return {
    shards: allShards,
    regions: activeRegions,
    spatialGrid,
    shardsNear
  };
}

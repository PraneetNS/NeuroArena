/**
 * geoMatchmaker.js
 * Multi-region latency-aware matchmaking coordinator.
 * Partitions queues across regional server hubs and enforces strict ping bounds (<80ms).
 */

'use strict';

class GeoMatchmaker {
  constructor(options = {}) {
    this.regions = options.regions || ['us-east', 'eu-central', 'ap-east'];
    this.maxPingThresholdMs = options.maxPingThresholdMs || 80;
    this.expansionTimeoutMs = options.expansionTimeoutMs || 15000;
    this.queue = new Map(); // region -> PlayerQueueItem[]

    for (const region of this.regions) {
      this.queue.set(region, []);
    }
  }

  /**
   * Enqueues a player with regional ping matrix.
   * @param {{ id: string, mmr: number, pingMatrix: Object.<string, number>, joinedAt: number }} player
   */
  enqueuePlayer(player) {
    const entry = {
      ...player,
      joinedAt: player.joinedAt || Date.now()
    };

    const bestRegion = this.determineOptimalRegion(entry.pingMatrix);
    const regionQueue = this.queue.get(bestRegion) || this.queue.get('us-east');
    regionQueue.push(entry);

    return { enqueuedRegion: bestRegion, position: regionQueue.length };
  }

  /**
   * Selects region with lowest latency.
   */
  determineOptimalRegion(pingMatrix) {
    let bestRegion = this.regions[0];
    let lowestPing = Infinity;

    for (const [region, ping] of Object.entries(pingMatrix || {})) {
      if (this.regions.includes(region) && ping < lowestPing) {
        lowestPing = ping;
        bestRegion = region;
      }
    }

    return bestRegion;
  }

  /**
   * Finds matched pairs within a region honoring MMR delta and maximum allowed ping.
   */
  findMatchesForRegion(region, baseMmrWindow = 100) {
    const regionQueue = this.queue.get(region) || [];
    if (regionQueue.length < 2) return [];

    const now = Date.now();
    const matched = [];
    const remaining = [];

    // Sort by join time
    regionQueue.sort((a, b) => a.joinedAt - b.joinedAt);

    const used = new Set();

    for (let i = 0; i < regionQueue.length; i++) {
      if (used.has(regionQueue[i].id)) continue;
      const p1 = regionQueue[i];
      const waitTime = now - p1.joinedAt;
      
      // Dynamic MMR window expansion over wait time
      const expandedMmrWindow = baseMmrWindow + Math.floor(waitTime / 1000) * 15;
      let bestOpponent = null;
      let lowestMmrDiff = Infinity;

      for (let j = i + 1; j < regionQueue.length; j++) {
        if (used.has(regionQueue[j].id)) continue;
        const p2 = regionQueue[j];

        const p1Ping = p1.pingMatrix?.[region] ?? 50;
        const p2Ping = p2.pingMatrix?.[region] ?? 50;

        // Ensure both players satisfy latency constraint
        if (p1Ping > this.maxPingThresholdMs || p2Ping > this.maxPingThresholdMs) {
          continue;
        }

        const mmrDiff = Math.abs(p1.mmr - p2.mmr);
        if (mmrDiff <= expandedMmrWindow && mmrDiff < lowestMmrDiff) {
          lowestMmrDiff = mmrDiff;
          bestOpponent = p2;
        }
      }

      if (bestOpponent) {
        used.add(p1.id);
        used.add(bestOpponent.id);
        matched.push({
          matchId: `match_${region}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          region,
          player1: p1,
          player2: bestOpponent,
          averageMmr: Math.round((p1.mmr + bestOpponent.mmr) / 2),
          mmrDifference: Math.abs(p1.mmr - bestOpponent.mmr),
          avgLatencyMs: Math.round(((p1.pingMatrix?.[region] || 40) + (bestOpponent.pingMatrix?.[region] || 40)) / 2)
        });
      } else {
        remaining.push(p1);
      }
    }

    this.queue.set(region, remaining);
    return matched;
  }
}

module.exports = GeoMatchmaker;

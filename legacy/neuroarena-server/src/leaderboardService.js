/**
 * Scalable Global Leaderboard & Tier League Service.
 * Implements Redis Sorted Set (ZSET) semantics with tier divisions (Bronze, Silver, Gold, Platinum, Diamond, Grandmaster).
 */
class LeaderboardService {
  constructor() {
    this.scores = new Map(); // userId -> { score, username, tier, updatedAt }
  }

  updatePlayerScore(userId, username, score) {
    const tier = this.calculateTier(score);
    this.scores.set(userId, {
      userId,
      username,
      score,
      tier,
      updatedAt: Date.now()
    });
    return { userId, score, tier };
  }

  calculateTier(score) {
    if (score >= 2500) return 'GRANDMASTER';
    if (score >= 2000) return 'DIAMOND';
    if (score >= 1600) return 'PLATINUM';
    if (score >= 1200) return 'GOLD';
    if (score >= 800) return 'SILVER';
    return 'BRONZE';
  }

  getTopPlayers(limit = 10) {
    return Array.from(this.scores.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((entry, rank) => ({
        rank: rank + 1,
        userId: entry.userId,
        username: entry.username,
        score: entry.score,
        tier: entry.tier
      }));
  }

  getPlayerRank(userId) {
    const sorted = Array.from(this.scores.values()).sort((a, b) => b.score - a.score);
    const index = sorted.findIndex(e => e.userId === userId);
    if (index === -1) return null;
    return {
      rank: index + 1,
      totalPlayers: sorted.length,
      ...sorted[index]
    };
  }

  applySeasonalDecay(decayFactor = 0.85, softResetBase = 1200) {
    // Soft reset: newScore = base + (oldScore - base) * factor
    for (const [userId, entry] of this.scores.entries()) {
      const adjusted = Math.round(softResetBase + (entry.score - softResetBase) * decayFactor);
      entry.score = Math.max(0, adjusted);
      entry.tier = this.calculateTier(entry.score);
    }
  }
}

module.exports = { LeaderboardService };

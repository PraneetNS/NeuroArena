/**
 * SeasonalRankedEngine.js
 * Full Seasonal Ranked System, Glicko-2 MMR Engine, Soft Resets & Cross-Platform Progression.
 * 
 * Features:
 * - 6-8 week season cycle with soft MMR reset (regression toward 1500 mean).
 * - 5 Competitive Rank Tiers: Bronze -> Silver -> Gold -> Platinum -> Architect.
 * - Visible rank-up / rank-down moment detection wired to high-impact Juice Feedback parameters.
 * - End-of-season cosmetic/title reward disbursement via cross-platform account profiles.
 * - Historical Top 100 season snapshots archived for permanent leaderboard hall of fame.
 * - 100% Cross-Progression parity: identical state across Web PWA, Android, and iOS.
 */

const { Glicko2Engine } = require("../glicko2Matchmaking");

const RANK_TIERS = {
  BRONZE: {
    name: "BRONZE",
    minRating: 0,
    maxRating: 999,
    tierIndex: 0,
    colorHex: "#CD7F32",
    title: "Bronze Catalyst",
    rewardCosmetic: null,
    rewardShards: 50
  },
  SILVER: {
    name: "SILVER",
    minRating: 1000,
    maxRating: 1399,
    tierIndex: 1,
    colorHex: "#C0C0C0",
    title: "Silver Optimizer",
    rewardCosmetic: "glider_silver_matrix",
    rewardShards: 100
  },
  GOLD: {
    name: "GOLD",
    minRating: 1400,
    maxRating: 1799,
    tierIndex: 2,
    colorHex: "#FFD700",
    title: "Gold Gradient",
    rewardCosmetic: "skin_gold_shader",
    rewardShards: 200
  },
  PLATINUM: {
    name: "PLATINUM",
    minRating: 1800,
    maxRating: 2199,
    tierIndex: 3,
    colorHex: "#E5E4E2",
    title: "Platinum Backprop",
    rewardCosmetic: "suit_platinum_holo",
    rewardShards: 350
  },
  ARCHITECT: {
    name: "ARCHITECT",
    minRating: 2200,
    maxRating: 9999,
    tierIndex: 4,
    colorHex: "#38BDF8",
    title: "Sovereign Architect",
    rewardCosmetic: "wings_architect_void",
    rewardShards: 600
  }
};

class SeasonalRankedEngine {
  constructor(redisConfig = null) {
    this.redis = redisConfig;
    this.glicko = new Glicko2Engine(0.5);

    // Active Season Metadata (Default: 6-Week Cadence)
    this.activeSeason = {
      seasonId: "season_1",
      seasonNumber: 1,
      seasonName: "Season 1: Foundation of Weights",
      durationWeeks: 6,
      startedAtUtc: new Date().toISOString(),
      endsAtUtc: new Date(Date.now() + 42 * 24 * 3600 * 1000).toISOString()
    };

    // In-memory player profile store (backed by Redis / Supabase)
    // accountId -> profile
    this.profiles = new Map();

    // In-memory seasonal leaderboard archive (seasonId -> snapshot)
    this.archivedSeasons = new Map();
  }

  /**
   * Determine Rank Tier based on Glicko-2 rating
   */
  calculateTier(rating) {
    const r = Math.max(0, rating);
    if (r >= RANK_TIERS.ARCHITECT.minRating) return RANK_TIERS.ARCHITECT;
    if (r >= RANK_TIERS.PLATINUM.minRating) return RANK_TIERS.PLATINUM;
    if (r >= RANK_TIERS.GOLD.minRating) return RANK_TIERS.GOLD;
    if (r >= RANK_TIERS.SILVER.minRating) return RANK_TIERS.SILVER;
    return RANK_TIERS.BRONZE;
  }

  /**
   * Get or create a unified cross-platform player ranked profile
   */
  async getPlayerProfile(accountId, playerName = "Duelist", characterBuild = "scholar") {
    if (!accountId) throw new Error("Missing accountId for player profile lookup.");

    let profile = this.profiles.get(accountId);
    if (!profile && this.redis) {
      const cached = await this.redis.get(`ranked:profile:${accountId}`);
      if (cached) {
        try {
          profile = JSON.parse(cached);
          this.profiles.set(accountId, profile);
        } catch (e) {}
      }
    }

    if (!profile) {
      const initialTier = this.calculateTier(1500);
      profile = {
        accountId,
        playerName,
        characterBuild,
        seasonId: this.activeSeason.seasonId,
        rating: 1500,
        rd: 350,
        volatility: 0.06,
        tier: initialTier.name,
        highestTierAchieved: initialTier.name,
        wins: 0,
        losses: 0,
        draws: 0,
        totalMatches: 0,
        quantumShards: 100,
        guildId: null,
        activeTitle: "Novice Gradient",
        unlockedTitles: ["Novice Gradient"],
        unlockedCosmetics: ["default_avatar_scholar"],
        lastMatchAtUtc: null,
        updatedAtUtc: new Date().toISOString()
      };
      this.profiles.set(accountId, profile);
    }

    return profile;
  }

  /**
   * Process 1v1 Ranked Match outcome with Glicko-2 rating updates & visible tier changes.
   * @param {string} accountIdA
   * @param {string} accountIdB
   * @param {number} outcomeScoreA (1 = A won, 0 = B won / A lost, 0.5 = Draw)
   */
  async processRankedMatch(playerAInfo, playerBInfo, outcomeScoreA) {
    const profileA = await this.getPlayerProfile(playerAInfo.accountId, playerAInfo.name, playerAInfo.build);
    const profileB = await this.getPlayerProfile(playerBInfo.accountId, playerBInfo.name, playerBInfo.build);

    const oldRatingA = profileA.rating;
    const oldTierA = this.calculateTier(oldRatingA);
    const oldRatingB = profileB.rating;
    const oldTierB = this.calculateTier(oldRatingB);

    const outcomeScoreB = 1 - outcomeScoreA;

    // 1. Calculate new Glicko-2 ratings for both players
    const updatedA = this.glicko.updateRating(
      { rating: profileA.rating, rd: profileA.rd, vol: profileA.volatility },
      [{ rating: profileB.rating, rd: profileB.rd, score: outcomeScoreA }]
    );

    const updatedB = this.glicko.updateRating(
      { rating: profileB.rating, rd: profileB.rd, vol: profileB.volatility },
      [{ rating: profileA.rating, rd: profileA.rd, score: outcomeScoreB }]
    );

    // 2. Determine new tiers
    const newTierA = this.calculateTier(updatedA.rating);
    const newTierB = this.calculateTier(updatedB.rating);

    // 3. Evaluate Visible Tier Changes and Juice Triggers
    const tierChangeA = this._evaluateTierTransition(oldTierA, newTierA);
    const tierChangeB = this._evaluateTierTransition(oldTierB, newTierB);

    // 4. Update Profile A
    profileA.rating = updatedA.rating;
    profileA.rd = updatedA.rd;
    profileA.volatility = updatedA.volatility;
    profileA.tier = newTierA.name;
    profileA.totalMatches += 1;
    if (outcomeScoreA === 1) profileA.wins += 1;
    else if (outcomeScoreA === 0) profileA.losses += 1;
    else profileA.draws += 1;

    if (newTierA.tierIndex > (RANK_TIERS[profileA.highestTierAchieved]?.tierIndex || 0)) {
      profileA.highestTierAchieved = newTierA.name;
    }
    profileA.lastMatchAtUtc = new Date().toISOString();
    profileA.updatedAtUtc = profileA.lastMatchAtUtc;

    // 5. Update Profile B
    profileB.rating = updatedB.rating;
    profileB.rd = updatedB.rd;
    profileB.volatility = updatedB.volatility;
    profileB.tier = newTierB.name;
    profileB.totalMatches += 1;
    if (outcomeScoreB === 1) profileB.wins += 1;
    else if (outcomeScoreB === 0) profileB.losses += 1;
    else profileB.draws += 1;

    if (newTierB.tierIndex > (RANK_TIERS[profileB.highestTierAchieved]?.tierIndex || 0)) {
      profileB.highestTierAchieved = newTierB.name;
    }
    profileB.lastMatchAtUtc = new Date().toISOString();
    profileB.updatedAtUtc = profileB.lastMatchAtUtc;

    // Persist to Redis if available
    if (this.redis) {
      await this.redis.set(`ranked:profile:${profileA.accountId}`, JSON.stringify(profileA));
      await this.redis.set(`ranked:profile:${profileB.accountId}`, JSON.stringify(profileB));
      if (typeof this.redis.zAdd === "function") {
        await this.redis.zAdd(`ranked:leaderboard:${this.activeSeason.seasonId}`, profileA.accountId, profileA.rating);
        await this.redis.zAdd(`ranked:leaderboard:${this.activeSeason.seasonId}`, profileB.accountId, profileB.rating);
      } else if (typeof this.redis.zadd === "function") {
        await this.redis.zadd(`ranked:leaderboard:${this.activeSeason.seasonId}`, profileA.rating, profileA.accountId);
        await this.redis.zadd(`ranked:leaderboard:${this.activeSeason.seasonId}`, profileB.rating, profileB.accountId);
      }
    }

    return {
      seasonId: this.activeSeason.seasonId,
      playerA: {
        accountId: profileA.accountId,
        oldRating: oldRatingA,
        newRating: profileA.rating,
        deltaRating: profileA.rating - oldRatingA,
        oldTier: oldTierA.name,
        newTier: newTierA.name,
        tierChange: tierChangeA
      },
      playerB: {
        accountId: profileB.accountId,
        oldRating: oldRatingB,
        newRating: profileB.rating,
        deltaRating: profileB.rating - oldRatingB,
        oldTier: oldTierB.name,
        newTier: newTierB.name,
        tierChange: tierChangeB
      }
    };
  }

  /**
   * Helper to detect and craft high-impact rank-up Juice payload
   */
  _evaluateTierTransition(oldTier, newTier) {
    if (newTier.tierIndex > oldTier.tierIndex) {
      return {
        type: "RANK_UP",
        fromTier: oldTier.name,
        toTier: newTier.name,
        juiceFeedback: {
          hitStopDurationMs: 65, // 4 frames @ 60 FPS
          cameraShakeIntensity: 0.50,
          cameraShakeDurationSec: 0.60,
          particleBurstCount: 150,
          hapticPulse: "SuccessBurst",
          tierColorHex: newTier.colorHex,
          tierTitle: newTier.title,
          stingerSFX: "sfx_rank_up_grand_fanfare"
        }
      };
    } else if (newTier.tierIndex < oldTier.tierIndex) {
      return {
        type: "RANK_DOWN",
        fromTier: oldTier.name,
        toTier: newTier.name,
        juiceFeedback: {
          hitStopDurationMs: 0,
          cameraShakeIntensity: 0.20,
          cameraShakeDurationSec: 0.30,
          particleBurstCount: 30,
          hapticPulse: "HeavyRumble",
          tierColorHex: newTier.colorHex,
          stingerSFX: "sfx_rank_down_subdued"
        }
      };
    }
    return { type: "NONE" };
  }

  /**
   * Get Season Standings (Active or Archived)
   */
  getLeaderboard(limit = 100) {
    return Array.from(this.profiles.values())
      .sort((a, b) => b.rating - a.rating || b.wins - a.wins)
      .slice(0, limit)
      .map((p, idx) => ({
        rank: idx + 1,
        accountId: p.accountId,
        playerName: p.playerName,
        characterBuild: p.characterBuild,
        rating: p.rating,
        tier: p.tier,
        wins: p.wins,
        losses: p.losses,
        draws: p.draws,
        winRate: p.totalMatches > 0 ? Number(((p.wins / p.totalMatches) * 100).toFixed(1)) : 0.0,
        activeTitle: p.activeTitle,
        highestTierAchieved: p.highestTierAchieved
      }));
  }

  /**
   * Get Active Season Details
   */
  getSeasonStatus() {
    const now = Date.now();
    const ends = new Date(this.activeSeason.endsAtUtc).getTime();
    const msRemaining = Math.max(0, ends - now);
    const daysRemaining = Math.ceil(msRemaining / (24 * 3600 * 1000));

    return {
      ...this.activeSeason,
      serverTimeUtc: new Date().toISOString(),
      daysRemaining,
      secondsRemaining: Math.floor(msRemaining / 1000),
      totalRankedPlayers: this.profiles.size
    };
  }

  /**
   * End Season, Archive Top 100 Leaderboard, Disburse Rewards & Soft MMR Reset
   */
  async rolloverSeason(nextSeasonId = null, nextSeasonName = null) {
    const currentSeasonId = this.activeSeason.seasonId;
    const top100Snapshot = this.getLeaderboard(100);

    // 1. Archive Current Season Leaderboard
    const archivedSnapshot = {
      seasonId: currentSeasonId,
      seasonNumber: this.activeSeason.seasonNumber,
      seasonName: this.activeSeason.seasonName,
      durationWeeks: this.activeSeason.durationWeeks,
      startedAt: this.activeSeason.startedAtUtc,
      endedAt: new Date().toISOString(),
      totalParticipants: this.profiles.size,
      top100: top100Snapshot
    };
    this.archivedSeasons.set(currentSeasonId, archivedSnapshot);

    // 2. Disburse End-of-Season Rewards to Player Accounts based on highest achieved tier
    const rewardAudit = [];
    for (const [accountId, profile] of this.profiles.entries()) {
      const highestTier = RANK_TIERS[profile.highestTierAchieved] || RANK_TIERS.BRONZE;
      const grantedCosmetics = [];
      const grantedTitles = [];

      // Grant Tier Title
      if (highestTier.title && !profile.unlockedTitles.includes(highestTier.title)) {
        profile.unlockedTitles.push(highestTier.title);
        profile.activeTitle = highestTier.title;
        grantedTitles.push(highestTier.title);
      }

      // Grant Tier Cosmetic
      if (highestTier.rewardCosmetic && !profile.unlockedCosmetics.includes(highestTier.rewardCosmetic)) {
        profile.unlockedCosmetics.push(highestTier.rewardCosmetic);
        grantedCosmetics.push(highestTier.rewardCosmetic);
      }

      // Grant Quantum Shards
      const shardsAwarded = highestTier.rewardShards || 50;
      profile.quantumShards += shardsAwarded;

      // 3. Soft MMR Reset (Regression toward 1500 mean)
      // newRating = 1500 + (oldRating - 1500) * 0.65
      const softResetRating = Math.round(1500 + (profile.rating - 1500) * 0.65);
      profile.rating = Math.max(800, softResetRating);
      profile.rd = 250; // Moderate RD reset to allow quick early placement
      profile.tier = this.calculateTier(profile.rating).name;
      profile.highestTierAchieved = profile.tier;
      profile.seasonId = nextSeasonId || `season_${this.activeSeason.seasonNumber + 1}`;
      profile.updatedAtUtc = new Date().toISOString();

      rewardAudit.push({
        accountId,
        highestTier: highestTier.name,
        shardsAwarded,
        grantedCosmetics,
        grantedTitles,
        newRating: profile.rating,
        newTier: profile.tier
      });

      if (this.redis) {
        await this.redis.set(`ranked:profile:${accountId}`, JSON.stringify(profile));
      }
    }

    // 4. Initialize Next Season
    const nextNum = this.activeSeason.seasonNumber + 1;
    this.activeSeason = {
      seasonId: nextSeasonId || `season_${nextNum}`,
      seasonNumber: nextNum,
      seasonName: nextSeasonName || `Season ${nextNum}: Convergence League`,
      durationWeeks: 6,
      startedAtUtc: new Date().toISOString(),
      endsAtUtc: new Date(Date.now() + 42 * 24 * 3600 * 1000).toISOString()
    };

    return {
      success: true,
      archivedSeason: archivedSnapshot,
      nextSeason: this.activeSeason,
      totalPlayersRewarded: rewardAudit.length,
      rewardAuditSummary: rewardAudit.slice(0, 10)
    };
  }

  /**
   * Retrieve Historical Season Archive
   */
  getArchivedSeason(seasonId) {
    return this.archivedSeasons.get(seasonId) || null;
  }
}

module.exports = {
  SeasonalRankedEngine,
  RANK_TIERS
};

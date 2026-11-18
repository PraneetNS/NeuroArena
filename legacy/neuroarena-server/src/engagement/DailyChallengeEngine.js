/**
 * DailyChallengeEngine.js
 * Procedural Daily Challenge Generator & Server-Authoritative Verification Engine.
 * 
 * Generates an identical deterministic objective globally for each UTC day,
 * enforces server-side verification of completion telemetry, tracks persistent
 * streaks with escalating non-predatory rewards, and handles resets.
 */

class DailyChallengeEngine {
  constructor(redisConfig = null) {
    this.redis = redisConfig;
    this.playerStreaks = new Map(); // playerId -> { currentStreak, bestStreak, lastCompletedDateKey, totalCompleted }
    this.completedDays = new Map(); // `${playerId}:${dateKey}` -> completionRecord

    // Catalog of objective templates spanning 6 biomes and competitive duels
    this.objectiveCatalog = [
      {
        id: "daily_biome1_sgd_converge",
        title: "The Outlier Titan: Strict Convergence",
        biome: "LinearSteppes",
        biomeIndex: 0,
        boss: "The Outlier Titan",
        description: "Defeat The Outlier Titan with validation MSE < 0.05 using SGD or Momentum.",
        type: "BOSS_DEFEAT",
        requirements: { bossId: "outlier_titan", maxMse: 0.05, allowedOptimizers: ["sgd", "momentum"] },
        baseReward: { computeCredits: 100, seasonXp: 75, quantumShards: 0 }
      },
      {
        id: "daily_biome2_binary_cross_entropy",
        title: "The Hyperplane Hydra: Decision Boundary",
        biome: "BinaryMarshlands",
        biomeIndex: 1,
        boss: "The Hyperplane Hydra",
        description: "Defeat The Hyperplane Hydra with Binary Cross-Entropy and Accuracy >= 95%.",
        type: "BOSS_DEFEAT",
        requirements: { bossId: "hyperplane_hydra", minAccuracy: 0.95, requiredLoss: "binary_crossentropy" },
        baseReward: { computeCredits: 120, seasonXp: 85, quantumShards: 2 }
      },
      {
        id: "daily_biome3_l1_lasso_colossus",
        title: "The Overfit Colossus: L1 Regularization",
        biome: "VarianceTundra",
        biomeIndex: 2,
        boss: "The Overfit Colossus",
        description: "Beat Overfit Colossus using only L1 Lasso regularization with validation MSE < 0.03.",
        type: "BOSS_DEFEAT",
        requirements: { bossId: "overfit_colossus", regularization: "L1", maxMse: 0.03 },
        baseReward: { computeCredits: 150, seasonXp: 100, quantumShards: 5 }
      },
      {
        id: "daily_biome4_bagging_ensemble",
        title: "The Dendrogram Dragon: Bagging Vanguard",
        biome: "BranchingCanopy",
        biomeIndex: 3,
        boss: "The Dendrogram Dragon",
        description: "Defeat The Dendrogram Dragon using a 5-tree Bagging ensemble with Gini impurity < 0.10.",
        type: "BOSS_DEFEAT",
        requirements: { bossId: "dendrogram_dragon", minTrees: 5, maxGini: 0.10 },
        baseReward: { computeCredits: 180, seasonXp: 110, quantumShards: 5 }
      },
      {
        id: "daily_biome5_xor_manifold",
        title: "The Non-Linear Overlord: Citadel Convergence",
        biome: "DeepSynapseCitadel",
        biomeIndex: 4,
        boss: "The Non-Linear Overlord",
        description: "Solve the XOR manifold against The Non-Linear Overlord in under 20 epochs with 100% accuracy.",
        type: "BOSS_DEFEAT",
        requirements: { bossId: "nonlinear_overlord", maxEpochs: 20, minAccuracy: 1.0 },
        baseReward: { computeCredits: 200, seasonXp: 125, quantumShards: 8 }
      },
      {
        id: "daily_biome6_semantic_retrieval",
        title: "The High-Dimensional Void: Cosine Resonance",
        biome: "SemanticExpanse",
        biomeIndex: 5,
        boss: "The High-Dimensional Void",
        description: "Retrieve Top-K semantic embedding concepts with average Cosine Similarity >= 0.85.",
        type: "BOSS_DEFEAT",
        requirements: { bossId: "high_dim_void", minCosineSimilarity: 0.85 },
        baseReward: { computeCredits: 220, seasonXp: 140, quantumShards: 10 }
      },
      {
        id: "daily_duel_low_mse",
        title: "Esports Arena: Precision Duel Victory",
        biome: "CompetitiveArena",
        biomeIndex: -1,
        boss: "Live Player Duel",
        description: "Win a 1v1 live duel on held-out test distribution with validation MSE < 0.50.",
        type: "DUEL_VICTORY",
        requirements: { requireWin: true, maxMse: 0.50 },
        baseReward: { computeCredits: 250, seasonXp: 150, quantumShards: 10 }
      },
      {
        id: "daily_duel_high_accuracy",
        title: "Esports Arena: Grand Prix Domination",
        biome: "CompetitiveArena",
        biomeIndex: -1,
        boss: "Live Player Duel",
        description: "Win a 1v1 live duel with validation classification accuracy >= 90%.",
        type: "DUEL_VICTORY",
        requirements: { requireWin: true, minAccuracy: 0.90 },
        baseReward: { computeCredits: 250, seasonXp: 150, quantumShards: 10 }
      }
    ];
  }

  /**
   * Generates a standard UTC date string: YYYY-MM-DD
   */
  getUtcDateKey(date = new Date()) {
    const d = new Date(date);
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Deterministic pseudo-random number generator based on UTC date string
   */
  hashDateKey(dateKey) {
    let hash = 0;
    for (let i = 0; i < dateKey.length; i++) {
      hash = ((hash << 5) - hash) + dateKey.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  /**
   * Get the global daily challenge objective for a given dateKey
   */
  getDailyObjective(dateKey = this.getUtcDateKey()) {
    const hash = this.hashDateKey(dateKey);
    const index = hash % this.objectiveCatalog.length;
    const template = this.objectiveCatalog[index];

    return {
      dateKey,
      ...template,
      expiresAtUtc: this.getNextDailyResetUtc(dateKey).toISOString(),
      secondsUntilReset: this.getSecondsUntilDailyReset()
    };
  }

  /**
   * Calculate UTC timestamp of next 00:00:00 UTC
   */
  getNextDailyResetUtc(dateKey = this.getUtcDateKey()) {
    const [y, m, d] = dateKey.split('-').map(Number);
    const nextDay = new Date(Date.UTC(y, m - 1, d + 1, 0, 0, 0, 0));
    return nextDay;
  }

  /**
   * Seconds remaining until the next UTC midnight
   */
  getSecondsUntilDailyReset(now = new Date()) {
    const next = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1,
      0, 0, 0, 0
    ));
    return Math.max(0, Math.floor((next.getTime() - now.getTime()) / 1000));
  }

  /**
   * Calculates difference in integer calendar days between two UTC date keys (YYYY-MM-DD)
   */
  getDaysBetween(dateKeyA, dateKeyB) {
    const [y1, m1, d1] = dateKeyA.split('-').map(Number);
    const [y2, m2, d2] = dateKeyB.split('-').map(Number);
    const t1 = Date.UTC(y1, m1 - 1, d1);
    const t2 = Date.UTC(y2, m2 - 1, d2);
    return Math.round((t2 - t1) / (24 * 60 * 60 * 1000));
  }

  /**
   * Get player's streak profile
   */
  async getPlayerStreak(playerId) {
    if (this.playerStreaks.has(playerId)) {
      return this.playerStreaks.get(playerId);
    }

    if (this.redis) {
      const cached = await this.redis.get(`player:streak:${playerId}`);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          this.playerStreaks.set(playerId, parsed);
          return parsed;
        } catch (e) {}
      }
    }

    const newProfile = {
      playerId,
      currentStreak: 0,
      bestStreak: 0,
      lastCompletedDateKey: null,
      totalCompleted: 0
    };
    this.playerStreaks.set(playerId, newProfile);
    return newProfile;
  }

  /**
   * Calculate escalating non-predatory rewards based on current streak count
   * Non-predatory guarantee: strictly escalates rewards without punishing players
   * on missed days (owned items/progress are never lost).
   */
  calculateEscalatingReward(baseReward, streak) {
    const safeStreak = Math.max(1, streak);
    // Multiplier grows gracefully: +15% per streak day up to +300% at 20+ days
    const multiplier = 1 + Math.min(20, safeStreak - 1) * 0.15;

    const reward = {
      computeCredits: Math.round(baseReward.computeCredits * multiplier),
      seasonXp: Math.round(baseReward.seasonXp * multiplier),
      quantumShards: baseReward.quantumShards + Math.floor(safeStreak / 3) * 2,
      streakBonusTier: safeStreak >= 30 ? "Grandmaster" : safeStreak >= 14 ? "Platinum" : safeStreak >= 7 ? "Gold" : safeStreak >= 3 ? "Silver" : "Bronze"
    };

    // Special milestone cosmetic/title unlocks (at day 7, 14, 30)
    if (safeStreak === 7) reward.milestoneTitle = "🔥 Week Titan";
    if (safeStreak === 14) reward.milestoneTitle = "⚡ Fortnight Sage";
    if (safeStreak === 30) reward.milestoneTitle = "👑 Convergence Paragon";

    return reward;
  }

  /**
   * Check if player already completed today's daily challenge
   */
  async hasCompletedToday(playerId, dateKey = this.getUtcDateKey()) {
    const key = `${playerId}:${dateKey}`;
    if (this.redis) {
      const completed = await this.redis.get(`daily:completed:${key}`);
      if (completed) return true;
    }
    return this.completedDays.has(key);
  }

  /**
   * Server-authoritative submission verification for the Daily Challenge
   * Validates objective metrics, updates persistent streak, and disburses rewards.
   */
  async verifyDailyChallenge(playerId, submission = {}) {
    const currentDateKey = this.getUtcDateKey();
    const targetDateKey = submission.dateKey || currentDateKey;

    // 1. Time-window validity check (must match current UTC date)
    if (targetDateKey !== currentDateKey) {
      return {
        success: false,
        error: "STALE_DATE_KEY",
        message: `Submission date key ${targetDateKey} does not match active UTC date ${currentDateKey}`
      };
    }

    // 2. Duplicate completion check
    const completionKey = `${playerId}:${currentDateKey}`;
    const alreadyCompleted = await this.hasCompletedToday(playerId, currentDateKey);
    if (alreadyCompleted) {
      const streak = await this.getPlayerStreak(playerId);
      return {
        success: false,
        error: "ALREADY_COMPLETED_TODAY",
        message: "You have already claimed today's daily challenge reward.",
        streak
      };
    }

    // 3. Retrieve authoritative daily objective
    const objective = this.getDailyObjective(currentDateKey);
    const { metrics = {} } = submission;
    const reqs = objective.requirements;

    // 4. Validate objective criteria
    if (objective.type === "BOSS_DEFEAT") {
      if (reqs.bossId && submission.bossId !== reqs.bossId) {
        return {
          success: false,
          error: "OBJECTIVE_CRITERIA_FAILED",
          message: `Target boss mismatch. Expected ${reqs.bossId}, got ${submission.bossId}`
        };
      }
      if (reqs.maxMse !== undefined && (metrics.mse === undefined || metrics.mse > reqs.maxMse)) {
        return {
          success: false,
          error: "OBJECTIVE_CRITERIA_FAILED",
          message: `Validation MSE too high. Required <= ${reqs.maxMse}, reported ${metrics.mse}`
        };
      }
      if (reqs.minAccuracy !== undefined && (metrics.accuracy === undefined || metrics.accuracy < reqs.minAccuracy)) {
        return {
          success: false,
          error: "OBJECTIVE_CRITERIA_FAILED",
          message: `Accuracy below threshold. Required >= ${reqs.minAccuracy}, reported ${metrics.accuracy}`
        };
      }
      if (reqs.regularization && metrics.regularization !== reqs.regularization) {
        return {
          success: false,
          error: "OBJECTIVE_CRITERIA_FAILED",
          message: `Required regularization ${reqs.regularization}, but used ${metrics.regularization || 'None'}`
        };
      }
      if (reqs.maxEpochs !== undefined && (metrics.epochs === undefined || metrics.epochs > reqs.maxEpochs)) {
        return {
          success: false,
          error: "OBJECTIVE_CRITERIA_FAILED",
          message: `Took too many epochs. Required <= ${reqs.maxEpochs}, reported ${metrics.epochs}`
        };
      }
      if (reqs.minCosineSimilarity !== undefined && (metrics.cosineSimilarity === undefined || metrics.cosineSimilarity < reqs.minCosineSimilarity)) {
        return {
          success: false,
          error: "OBJECTIVE_CRITERIA_FAILED",
          message: `Cosine similarity too low. Required >= ${reqs.minCosineSimilarity}, reported ${metrics.cosineSimilarity}`
        };
      }
    } else if (objective.type === "DUEL_VICTORY") {
      if (!submission.wonDuel) {
        return {
          success: false,
          error: "OBJECTIVE_CRITERIA_FAILED",
          message: "Duel victory required to fulfill this daily objective."
        };
      }
      if (reqs.maxMse !== undefined && (metrics.mse === undefined || metrics.mse > reqs.maxMse)) {
        return {
          success: false,
          error: "OBJECTIVE_CRITERIA_FAILED",
          message: `Duel test set MSE too high. Required <= ${reqs.maxMse}, reported ${metrics.mse}`
        };
      }
      if (reqs.minAccuracy !== undefined && (metrics.accuracy === undefined || metrics.accuracy < reqs.minAccuracy)) {
        return {
          success: false,
          error: "OBJECTIVE_CRITERIA_FAILED",
          message: `Duel test set accuracy too low. Required >= ${reqs.minAccuracy}, reported ${metrics.accuracy}`
        };
      }
    }

    // 5. Update persistent streak
    const streakProfile = await this.getPlayerStreak(playerId);
    let newStreak = 1;

    if (streakProfile.lastCompletedDateKey) {
      const daysSince = this.getDaysBetween(streakProfile.lastCompletedDateKey, currentDateKey);
      if (daysSince === 1) {
        // Consecutive day: increment streak
        newStreak = streakProfile.currentStreak + 1;
      } else if (daysSince === 0) {
        // Same day fallback protection
        newStreak = streakProfile.currentStreak;
      } else {
        // Missed one or more days: reset current streak to 1
        // (Note: Non-predatory guarantee - bestStreak and all inventory are preserved)
        newStreak = 1;
      }
    }

    streakProfile.currentStreak = newStreak;
    streakProfile.bestStreak = Math.max(streakProfile.bestStreak, newStreak);
    streakProfile.lastCompletedDateKey = currentDateKey;
    streakProfile.totalCompleted += 1;

    // 6. Calculate escalating reward
    const reward = this.calculateEscalatingReward(objective.baseReward, newStreak);

    // 7. Persist completion record & streak in Redis and memory
    const completionRecord = {
      playerId,
      dateKey: currentDateKey,
      objectiveId: objective.id,
      completedAt: new Date().toISOString(),
      reward,
      streak: newStreak
    };

    this.completedDays.set(completionKey, completionRecord);
    this.playerStreaks.set(playerId, streakProfile);

    if (this.redis) {
      // 48 hour TTL on daily completion token to prevent re-claims across timezone boundaries
      await this.redis.set(`daily:completed:${completionKey}`, JSON.stringify(completionRecord), 48 * 3600);
      await this.redis.set(`player:streak:${playerId}`, JSON.stringify(streakProfile));
    }

    return {
      success: true,
      objectiveId: objective.id,
      objectiveTitle: objective.title,
      dateKey: currentDateKey,
      streak: newStreak,
      bestStreak: streakProfile.bestStreak,
      reward,
      completedAt: completionRecord.completedAt
    };
  }
}

module.exports = { DailyChallengeEngine };

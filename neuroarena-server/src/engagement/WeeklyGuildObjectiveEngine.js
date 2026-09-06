/**
 * WeeklyGuildObjectiveEngine.js
 * Server-Authoritative Weekly Guild Aggregate Contribution & Objective Engine.
 * 
 * Reuses the existing GuildEngine XP contribution system to aggregate collective
 * member progress towards a weekly global guild goal, unlocking guild-wide rewards.
 */

class WeeklyGuildObjectiveEngine {
  constructor(redisConfig = null) {
    this.redis = redisConfig;
    this.weeklyGuildStates = new Map(); // `${guildId}:${weekKey}` -> { currentXp, targetGoal, completed, claimedMembers }
    this.defaultTargetGoal = 20000; // 20k XP aggregate per week
  }

  /**
   * Generates ISO 8601 UTC week key: YYYY-Www
   */
  getUtcWeekKey(date = new Date()) {
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    // Set to nearest Thursday: current date + 4 - current day number (Sunday is 0, make it 7)
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
  }

  /**
   * Get timestamp for next Sunday 23:59:59 UTC (weekly reset)
   */
  getNextWeeklyResetUtc(now = new Date()) {
    const d = new Date(now);
    const day = d.getUTCDay(); // 0 is Sunday
    const daysUntilNextSunday = day === 0 ? 7 : (7 - day);
    const resetDate = new Date(Date.UTC(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate() + daysUntilNextSunday,
      0, 0, 0, 0
    ));
    return resetDate;
  }

  /**
   * Seconds remaining until the next weekly reset
   */
  getSecondsUntilWeeklyReset(now = new Date()) {
    const resetDate = this.getNextWeeklyResetUtc(now);
    return Math.max(0, Math.floor((resetDate.getTime() - now.getTime()) / 1000));
  }

  /**
   * Get or initialize weekly guild state
   */
  async getWeeklyState(guildId, weekKey = this.getUtcWeekKey()) {
    const stateKey = `${guildId}:${weekKey}`;

    if (this.weeklyGuildStates.has(stateKey)) {
      return this.weeklyGuildStates.get(stateKey);
    }
    
    if (this.redis) {
      const cached = await this.redis.get(`guild:weekly:${stateKey}`);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          parsed.claimedMembers = new Set(parsed.claimedMembers || []);
          this.weeklyGuildStates.set(stateKey, parsed);
          return parsed;
        } catch (e) {}
      }
    }

    const newState = {
      guildId,
      weekKey,
      objectiveTitle: "Distributed Cluster Computing Synthesis",
      description: "Aggregate 20,000 Guild XP across all faction members this week.",
      currentXp: 0,
      targetGoal: this.defaultTargetGoal,
      isCompleted: false,
      completedAt: null,
      claimedMembers: new Set(),
      rewards: {
        guildFlopsYieldMultiplier: 1.25, // +25% FLOPs yield guild-wide buff
        treasuryGold: 1000,
        bonusTrophies: 100,
        memberReward: {
          computeCredits: 300,
          quantumShards: 15,
          seasonXp: 200
        }
      }
    };

    this.weeklyGuildStates.set(stateKey, newState);
    return newState;
  }

  /**
   * Record EXP contribution from a guild member towards the weekly objective
   */
  async recordGuildContribution(guildId, playerId, expAmount, weekKey = this.getUtcWeekKey()) {
    const state = await this.getWeeklyState(guildId, weekKey);
    state.currentXp += expAmount;

    let justUnlocked = false;
    if (state.currentXp >= state.targetGoal && !state.isCompleted) {
      state.isCompleted = true;
      state.completedAt = new Date().toISOString();
      justUnlocked = true;
    }

    const stateKey = `${guildId}:${weekKey}`;
    this.weeklyGuildStates.set(stateKey, state);

    if (this.redis) {
      // 14 days TTL to keep history
      const serializable = {
        ...state,
        claimedMembers: Array.from(state.claimedMembers)
      };
      await this.redis.set(`guild:weekly:${stateKey}`, JSON.stringify(serializable), 14 * 86400);
    }

    return {
      guildId,
      weekKey,
      currentXp: state.currentXp,
      targetGoal: state.targetGoal,
      progressRatio: Math.min(1.0, state.currentXp / state.targetGoal),
      isCompleted: state.isCompleted,
      justUnlocked
    };
  }

  /**
   * Claim weekly objective reward for a specific member
   */
  async claimMemberWeeklyReward(guildId, playerId, weekKey = this.getUtcWeekKey()) {
    const state = await this.getWeeklyState(guildId, weekKey);

    if (!state.isCompleted) {
      return {
        success: false,
        error: "OBJECTIVE_NOT_COMPLETED",
        message: `Guild weekly objective is not yet reached (${state.currentXp}/${state.targetGoal} XP)`
      };
    }

    if (state.claimedMembers.has(playerId)) {
      return {
        success: false,
        error: "ALREADY_CLAIMED",
        message: "You have already claimed this week's guild objective reward."
      };
    }

    state.claimedMembers.add(playerId);

    const stateKey = `${guildId}:${weekKey}`;
    this.weeklyGuildStates.set(stateKey, state);

    if (this.redis) {
      const serializable = {
        ...state,
        claimedMembers: Array.from(state.claimedMembers)
      };
      await this.redis.set(`guild:weekly:${stateKey}`, JSON.stringify(serializable), 14 * 86400);
    }

    return {
      success: true,
      guildId,
      weekKey,
      reward: state.rewards.memberReward,
      guildBuff: {
        multiplier: state.rewards.guildFlopsYieldMultiplier,
        name: "CLUSTER_OVERCLOCK_ACTIVE"
      }
    };
  }

  /**
   * Get guild weekly objective summary for client HUD / UI
   */
  async getWeeklySummary(guildId, playerId = null, weekKey = this.getUtcWeekKey()) {
    const state = await this.getWeeklyState(guildId, weekKey);
    const hasClaimed = playerId ? state.claimedMembers.has(playerId) : false;

    return {
      guildId,
      weekKey,
      objectiveTitle: state.objectiveTitle,
      description: state.description,
      currentXp: state.currentXp,
      targetGoal: state.targetGoal,
      progressPercent: Math.min(100, Math.round((state.currentXp / state.targetGoal) * 100)),
      isCompleted: state.isCompleted,
      completedAt: state.completedAt,
      hasClaimed,
      rewards: state.rewards,
      secondsUntilReset: this.getSecondsUntilWeeklyReset(),
      expiresAtUtc: this.getNextWeeklyResetUtc().toISOString()
    };
  }
}

module.exports = { WeeklyGuildObjectiveEngine };

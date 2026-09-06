/**
 * RecurringEngagementManager.js
 * Central Coordinator for NeuroArena Recurring Engagement Layer.
 * 
 * Orchestrates Daily Challenges, Persistent Streaks, Guild Weekly Objectives,
 * Live-Ops Remote Config Modifiers, and Redis UTC scheduling.
 */

const { DailyChallengeEngine } = require("./DailyChallengeEngine");
const { WeeklyGuildObjectiveEngine } = require("./WeeklyGuildObjectiveEngine");
const { RemoteConfigEngine } = require("./RemoteConfigEngine");

class RecurringEngagementManager {
  constructor(redisConfig = null) {
    this.redis = redisConfig;
    this.dailyEngine = new DailyChallengeEngine(redisConfig);
    this.weeklyGuildEngine = new WeeklyGuildObjectiveEngine(redisConfig);
    this.remoteConfigEngine = new RemoteConfigEngine(redisConfig);
  }

  /**
   * Get full player engagement hub state (daily objective, streak, weekly guild progress, live-ops modifier)
   */
  async getPlayerEngagementSummary(playerId, guildId = null) {
    const currentDateKey = this.dailyEngine.getUtcDateKey();
    const dailyObjective = this.dailyEngine.getDailyObjective(currentDateKey);
    const hasCompletedDaily = await this.dailyEngine.hasCompletedToday(playerId, currentDateKey);
    const streakProfile = await this.dailyEngine.getPlayerStreak(playerId);
    const activeModifier = await this.remoteConfigEngine.getActiveModifier();

    let weeklyGuildSummary = null;
    if (guildId) {
      weeklyGuildSummary = await this.weeklyGuildEngine.getWeeklySummary(guildId, playerId);
    }

    return {
      serverTimeUtc: new Date().toISOString(),
      daily: {
        currentDateKey,
        objective: dailyObjective,
        hasCompletedToday: hasCompletedDaily,
        streak: streakProfile.currentStreak,
        bestStreak: streakProfile.bestStreak,
        lastCompletedDateKey: streakProfile.lastCompletedDateKey,
        totalCompleted: streakProfile.totalCompleted,
        secondsUntilDailyReset: this.dailyEngine.getSecondsUntilDailyReset()
      },
      weeklyGuild: weeklyGuildSummary,
      activeModifier
    };
  }
}

module.exports = { RecurringEngagementManager };

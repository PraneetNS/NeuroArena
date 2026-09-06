/**
 * RemoteConfigEngine.js
 * Live-Ops Remote Configuration & Modifier Weekend Engine.
 * 
 * Enables zero-downtime, sub-minute dynamic live-ops modifier toggling
 * (e.g. 2x Harvest Yield, Rotating Boss Surge, PvP Rating Boost)
 * without requiring client redeployment or server restarts.
 */

class RemoteConfigEngine {
  constructor(redisConfig = null) {
    this.redis = redisConfig;
    this.configVersion = 1;
    this.lastUpdatedAt = new Date().toISOString();

    // Default configuration with live-ops event slot
    this.config = {
      version: 1,
      maintenanceMode: false,
      featureFlags: {
        dailyChallengesEnabled: true,
        weeklyGuildObjectivesEnabled: true,
        pvpDuelsEnabled: true,
        federatedLearningEnabled: true
      },
      liveOpsEventSlot: {
        id: "modifier_harvest_weekend",
        title: "2x Harvest Yield & Compute Surge Weekend",
        type: "HARVEST_MULTIPLIER",
        active: false,
        multiplier: 2.0,
        rotatingBoss: "The Overfit Colossus (Empowered)",
        description: "All dataset token harvesting and training compute rewards are doubled worldwide!",
        bannerColor: "#F59E0B",
        startTimeUtc: null,
        endTimeUtc: null,
        metadata: {
          bonusDropRate: 1.5,
          bossLootMultiplier: 2.0
        }
      },
      economyTweaks: {
        baseHarvestYield: 1.0,
        duelVictoryExp: 150,
        streakBonusCap: 3.0
      }
    };
  }

  /**
   * Get active remote configuration payload for clients & server services
   */
  async getRemoteConfig() {
    if (this.redis) {
      const cached = await this.redis.get("remote:config:active");
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch (e) {}
      }
    }
    return {
      ...this.config,
      serverTimeUtc: new Date().toISOString()
    };
  }

  /**
   * Get the active live-ops event slot modifier
   */
  async getActiveModifier() {
    const cfg = await this.getRemoteConfig();
    if (cfg.liveOpsEventSlot && cfg.liveOpsEventSlot.active) {
      return cfg.liveOpsEventSlot;
    }
    return null;
  }

  /**
   * Toggle or update live-ops modifier in real-time (<5 minutes, instantaneous)
   */
  async setLiveOpsModifier(options = {}) {
    this.configVersion += 1;
    this.lastUpdatedAt = new Date().toISOString();

    this.config.version = this.configVersion;
    this.config.lastUpdatedAt = this.lastUpdatedAt;

    this.config.liveOpsEventSlot = {
      ...this.config.liveOpsEventSlot,
      ...options,
      updatedAt: this.lastUpdatedAt
    };

    if (this.redis) {
      await this.redis.set("remote:config:active", JSON.stringify({
        ...this.config,
        serverTimeUtc: this.lastUpdatedAt
      }));
    }

    return {
      success: true,
      version: this.configVersion,
      liveOpsEventSlot: this.config.liveOpsEventSlot,
      updatedAt: this.lastUpdatedAt
    };
  }

  /**
   * Update arbitrary remote configuration settings
   */
  async updateConfig(partialConfig = {}) {
    this.configVersion += 1;
    this.lastUpdatedAt = new Date().toISOString();

    this.config = {
      ...this.config,
      ...partialConfig,
      version: this.configVersion,
      lastUpdatedAt: this.lastUpdatedAt
    };

    if (this.redis) {
      await this.redis.set("remote:config:active", JSON.stringify({
        ...this.config,
        serverTimeUtc: this.lastUpdatedAt
      }));
    }

    return {
      success: true,
      version: this.configVersion,
      config: this.config
    };
  }
}

module.exports = { RemoteConfigEngine };

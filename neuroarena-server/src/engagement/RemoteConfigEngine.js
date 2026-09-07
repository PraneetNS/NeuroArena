/**
 * RemoteConfigEngine.js
 * Live-Ops Remote Configuration, Dynamic Balance Tuning & Rollback Engine.
 * 
 * Enables zero-downtime, sub-minute dynamic balance tuning and live-ops modifier toggling
 * (e.g. Harvest Yield Multipliers, Boss HP/Damage, Daily Challenge Tuning, Duel Modifier-Weekend Flags)
 * without requiring client redeployment or server restarts.
 * 
 * Schema v3 Compliance:
 * Validates all remote config pushes against Schema v3 rules to guarantee save compatibility.
 */

const DEFAULT_CONFIG = {
  version: 1,
  schemaCompatibilityVersion: 3,
  lastUpdatedAt: new Date().toISOString(),
  maintenanceMode: false,

  // 1. Economy & Harvest Yield Multipliers
  harvestBalance: {
    baseYieldMultiplier: 1.0,
    crystalSpawnMultiplier: 1.0,
    shardDropRateMultiplier: 1.0,
    burstHarvestDurationSec: 30.0,
    burstHarvestMultiplier: 2.0
  },

  // 2. Boss HP / Damage & Encounter Tuning
  bossTuning: {
    overfit_hydra: {
      maxHp: 500,
      attackDamage: 25,
      phaseThreshold: 0.50,
      enrageTimerSec: 90,
      rewardCrystals: 100
    },
    variance_golem: {
      maxHp: 850,
      attackDamage: 40,
      phaseThreshold: 0.40,
      enrageTimerSec: 120,
      rewardCrystals: 200
    },
    gradient_titan: {
      maxHp: 1500,
      attackDamage: 65,
      phaseThreshold: 0.33,
      enrageTimerSec: 150,
      rewardCrystals: 350
    },
    deep_synapse_core: {
      maxHp: 2500,
      attackDamage: 90,
      phaseThreshold: 0.25,
      enrageTimerSec: 180,
      rewardCrystals: 600
    }
  },

  // 3. Daily Challenge & Recurring Engagement Parameters
  dailyChallengeTuning: {
    baseRewardCrystals: 150,
    bonusMasteryExp: 300,
    targetMseThreshold: 0.08,
    maxAllowedSteps: 100,
    streakMultiplierCap: 3.0,
    streakGracePeriodHours: 36
  },

  // 4. Duel Modifier-Weekend & PvP Flags
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

  // 5. Global Feature Flags
  featureFlags: {
    dailyChallengesEnabled: true,
    weeklyGuildObjectivesEnabled: true,
    pvpDuelsEnabled: true,
    federatedLearningEnabled: true,
    telemetryEnabled: true
  }
};

class RemoteConfigEngine {
  constructor(redisConfig = null) {
    this.redis = redisConfig;
    this.configVersion = 1;
    this.lastUpdatedAt = new Date().toISOString();

    // Active configuration
    this.config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));

    // Audit Trail & Version History (Rollback Path)
    this.history = [
      {
        version: 1,
        author: "system_bootstrap",
        changeReason: "Initial baseline configuration (Schema v3)",
        timestamp: this.lastUpdatedAt,
        configSnapshot: JSON.parse(JSON.stringify(this.config))
      }
    ];
  }

  /**
   * Schema v3 Save Compatibility & Balance Validation Pipeline
   * Throws an Error if any balance value violates safety bounds or schema compatibility.
   */
  validateConfigPayload(candidate) {
    if (!candidate || typeof candidate !== "object") {
      throw new Error("Invalid configuration: payload must be a non-null object.");
    }

    // 1. Validate Harvest Multipliers (Must be positive numbers between 0.1 and 10.0)
    if (candidate.harvestBalance) {
      const hb = candidate.harvestBalance;
      if (typeof hb.baseYieldMultiplier === "number") {
        if (hb.baseYieldMultiplier < 0.1 || hb.baseYieldMultiplier > 10.0) {
          throw new Error("Invalid harvestBalance.baseYieldMultiplier: must be between 0.1 and 10.0.");
        }
      }
      if (typeof hb.crystalSpawnMultiplier === "number" && (hb.crystalSpawnMultiplier <= 0 || hb.crystalSpawnMultiplier > 10.0)) {
        throw new Error("Invalid harvestBalance.crystalSpawnMultiplier: must be between 0.1 and 10.0.");
      }
    }

    // 2. Validate Boss Tuning (HP, Damage, Timers must be positive numbers)
    if (candidate.bossTuning) {
      for (const [bossId, stats] of Object.entries(candidate.bossTuning)) {
        if (typeof stats.maxHp === "number" && (stats.maxHp <= 0 || stats.maxHp > 100000)) {
          throw new Error(`Invalid bossTuning for '${bossId}': maxHp must be between 1 and 100000.`);
        }
        if (typeof stats.attackDamage === "number" && (stats.attackDamage < 0 || stats.attackDamage > 5000)) {
          throw new Error(`Invalid bossTuning for '${bossId}': attackDamage must be between 0 and 5000.`);
        }
        if (typeof stats.enrageTimerSec === "number" && (stats.enrageTimerSec < 10 || stats.enrageTimerSec > 3600)) {
          throw new Error(`Invalid bossTuning for '${bossId}': enrageTimerSec must be between 10 and 3600.`);
        }
      }
    }

    // 3. Validate Daily Challenge Tuning
    if (candidate.dailyChallengeTuning) {
      const dc = candidate.dailyChallengeTuning;
      if (typeof dc.baseRewardCrystals === "number" && (dc.baseRewardCrystals < 0 || dc.baseRewardCrystals > 10000)) {
        throw new Error("Invalid dailyChallengeTuning.baseRewardCrystals: must be between 0 and 10000.");
      }
      if (typeof dc.targetMseThreshold === "number" && (dc.targetMseThreshold <= 0 || dc.targetMseThreshold > 10.0)) {
        throw new Error("Invalid dailyChallengeTuning.targetMseThreshold: must be between 0.0001 and 10.0.");
      }
      if (typeof dc.streakMultiplierCap === "number" && (dc.streakMultiplierCap < 1.0 || dc.streakMultiplierCap > 20.0)) {
        throw new Error("Invalid dailyChallengeTuning.streakMultiplierCap: must be between 1.0 and 20.0.");
      }
    }

    // 4. Validate Live-Ops Modifier Slot
    if (candidate.liveOpsEventSlot) {
      const mod = candidate.liveOpsEventSlot;
      if (mod.active && typeof mod.multiplier === "number" && (mod.multiplier < 1.0 || mod.multiplier > 10.0)) {
        throw new Error("Invalid liveOpsEventSlot.multiplier: must be between 1.0 and 10.0.");
      }
    }

    // 5. Enforce Schema v3 Compatibility Marker
    if (candidate.schemaCompatibilityVersion && candidate.schemaCompatibilityVersion !== 3) {
      throw new Error(`Schema version mismatch: Candidate targets v${candidate.schemaCompatibilityVersion}, but active server requires Schema v3.`);
    }

    return true;
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
   * Publish a new remote config or balance update after Schema v3 validation.
   */
  async publishConfig(partialConfig = {}, author = "system_admin", changeReason = "Balance update") {
    // 1. Deep merge candidate with active config
    const candidate = {
      ...this.config,
      ...partialConfig,
      harvestBalance: {
        ...this.config.harvestBalance,
        ...(partialConfig.harvestBalance || {})
      },
      bossTuning: {
        ...this.config.bossTuning,
        ...(partialConfig.bossTuning || {})
      },
      dailyChallengeTuning: {
        ...this.config.dailyChallengeTuning,
        ...(partialConfig.dailyChallengeTuning || {})
      },
      liveOpsEventSlot: {
        ...this.config.liveOpsEventSlot,
        ...(partialConfig.liveOpsEventSlot || {})
      },
      featureFlags: {
        ...this.config.featureFlags,
        ...(partialConfig.featureFlags || {})
      }
    };

    // 2. Validate against Schema v3 rules
    this.validateConfigPayload(candidate);

    // 3. Increment Version & Update Timestamps
    this.configVersion += 1;
    this.lastUpdatedAt = new Date().toISOString();

    candidate.version = this.configVersion;
    candidate.lastUpdatedAt = this.lastUpdatedAt;
    candidate.schemaCompatibilityVersion = 3;

    this.config = candidate;

    // 4. Record Snapshot into Version History (Rollback Path)
    const snapshot = {
      version: this.configVersion,
      author: String(author),
      changeReason: String(changeReason),
      timestamp: this.lastUpdatedAt,
      configSnapshot: JSON.parse(JSON.stringify(this.config))
    };
    this.history.unshift(snapshot);
    if (this.history.length > 50) this.history.pop();

    // 5. Update Redis Cache if configured
    if (this.redis) {
      await this.redis.set("remote:config:active", JSON.stringify({
        ...this.config,
        serverTimeUtc: this.lastUpdatedAt
      }));
    }

    return {
      success: true,
      version: this.configVersion,
      updatedAt: this.lastUpdatedAt,
      config: this.config
    };
  }

  /**
   * One-Action Rollback to a previous configuration version
   */
  async rollbackToVersion(targetVersion, author = "system_admin") {
    const targetSnapshot = this.history.find(h => h.version === Number(targetVersion));
    if (!targetSnapshot) {
      throw new Error(`Rollback failed: Version ${targetVersion} not found in configuration history.`);
    }

    // Clone target snapshot
    const restoredConfig = JSON.parse(JSON.stringify(targetSnapshot.configSnapshot));

    // Validate restored configuration against Schema v3
    this.validateConfigPayload(restoredConfig);

    // Increment version for forward-audit safety
    this.configVersion += 1;
    this.lastUpdatedAt = new Date().toISOString();

    restoredConfig.version = this.configVersion;
    restoredConfig.lastUpdatedAt = this.lastUpdatedAt;
    restoredConfig.schemaCompatibilityVersion = 3;

    this.config = restoredConfig;

    // Record rollback action in history
    const rollbackRecord = {
      version: this.configVersion,
      author: String(author),
      changeReason: `Rollback to Version ${targetVersion} (Original from: ${targetSnapshot.timestamp})`,
      timestamp: this.lastUpdatedAt,
      configSnapshot: JSON.parse(JSON.stringify(this.config))
    };
    this.history.unshift(rollbackRecord);
    if (this.history.length > 50) this.history.pop();

    if (this.redis) {
      await this.redis.set("remote:config:active", JSON.stringify({
        ...this.config,
        serverTimeUtc: this.lastUpdatedAt
      }));
    }

    return {
      success: true,
      rolledBackTo: Number(targetVersion),
      newVersion: this.configVersion,
      updatedAt: this.lastUpdatedAt,
      config: this.config
    };
  }

  /**
   * Get version history audit trail
   */
  getHistory() {
    return this.history.map(h => ({
      version: h.version,
      author: h.author,
      changeReason: h.changeReason,
      timestamp: h.timestamp
    }));
  }

  /**
   * Toggle or update live-ops modifier in real-time (<5 minutes, instantaneous)
   */
  async setLiveOpsModifier(options = {}, author = "liveops_admin") {
    const liveOpsSlot = {
      ...this.config.liveOpsEventSlot,
      ...options,
      updatedAt: new Date().toISOString()
    };
    return this.publishConfig({ liveOpsEventSlot: liveOpsSlot }, author, `Live-Ops Modifier Toggle (${options.active ? 'Activated' : 'Deactivated'})`);
  }

  /**
   * Reset to defaults (used for unit tests)
   */
  reset() {
    this.configVersion = 1;
    this.lastUpdatedAt = new Date().toISOString();
    this.config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    this.history = [
      {
        version: 1,
        author: "system_bootstrap",
        changeReason: "Initial baseline configuration (Schema v3)",
        timestamp: this.lastUpdatedAt,
        configSnapshot: JSON.parse(JSON.stringify(this.config))
      }
    ];
  }
}

module.exports = { RemoteConfigEngine, DEFAULT_CONFIG };

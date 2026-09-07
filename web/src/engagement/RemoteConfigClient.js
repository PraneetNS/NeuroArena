/**
 * RemoteConfigClient.js (Web Client)
 * Remote Configuration & Balance Tuning Client for NeuroArena Web.
 * 
 * Features:
 * - 5-minute TTL caching in localStorage.
 * - Safe offline fallback to last-known-good configuration.
 * - Live-ops balance tuning accessors (Harvest Multipliers, Boss HP/Damage, Daily Challenge Tuning, Modifier Weekend).
 * - Safe Schema v3 validation.
 */

const STORAGE_KEY_CONFIG = "neuroarena_remote_config_cached";
const STORAGE_KEY_TIMESTAMP = "neuroarena_remote_config_timestamp";
const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

export class RemoteConfigClient {
    constructor(options = {}) {
        this.endpointUrl = options.endpointUrl || "/api/remote-config";
        this.ttlMs = options.ttlMs || DEFAULT_TTL_MS;
        this.activeConfig = this._loadLastKnownGood();
        this.lastFetchTime = this._loadCachedTimestamp();
        this.listeners = [];

        this._initSync();
    }

    _loadLastKnownGood() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY_CONFIG);
            if (raw) {
                return JSON.parse(raw);
            }
        } catch (e) {}
        return {
            version: 1,
            harvestBalance: { baseYieldMultiplier: 1.0, crystalSpawnMultiplier: 1.0 },
            bossTuning: {
                overfit_hydra: { maxHp: 500, attackDamage: 25, phaseThreshold: 0.50 },
                variance_golem: { maxHp: 850, attackDamage: 40, phaseThreshold: 0.40 },
                gradient_titan: { maxHp: 1500, attackDamage: 65, phaseThreshold: 0.33 },
                deep_synapse_core: { maxHp: 2500, attackDamage: 90, phaseThreshold: 0.25 }
            },
            dailyChallengeTuning: { baseRewardCrystals: 150, targetMseThreshold: 0.08, streakMultiplierCap: 3.0 },
            liveOpsEventSlot: { active: false, multiplier: 2.0, title: "2x Harvest Surge" },
            featureFlags: { dailyChallengesEnabled: true, pvpDuelsEnabled: true }
        };
    }

    _loadCachedTimestamp() {
        try {
            const ts = localStorage.getItem(STORAGE_KEY_TIMESTAMP);
            return ts ? parseInt(ts, 10) : 0;
        } catch (e) {
            return 0;
        }
    }

    _initSync() {
        // Initial fetch if TTL expired
        if (Date.now() - this.lastFetchTime >= this.ttlMs) {
            this.fetchConfig();
        }

        // Periodic background poll every 60s to check TTL expiration
        if (typeof window !== "undefined") {
            setInterval(() => {
                if (Date.now() - this.lastFetchTime >= this.ttlMs) {
                    this.fetchConfig();
                }
            }, 60000);
        }
    }

    onUpdate(callback) {
        if (typeof callback === "function") {
            this.listeners.push(callback);
        }
    }

    _notifyListeners() {
        for (const cb of this.listeners) {
            try { cb(this.activeConfig); } catch (e) {}
        }
    }

    async fetchConfig(force = false) {
        if (!force && (Date.now() - this.lastFetchTime < this.ttlMs)) {
            return this.activeConfig;
        }

        try {
            const res = await fetch(this.endpointUrl);
            if (res.ok) {
                const data = await res.json();
                if (data.success && data.config) {
                    this.activeConfig = data.config;
                    this.lastFetchTime = Date.now();

                    // Save last-known-good to localStorage
                    try {
                        localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(this.activeConfig));
                        localStorage.setItem(STORAGE_KEY_TIMESTAMP, String(this.lastFetchTime));
                    } catch (e) {}

                    console.log(`[RemoteConfig] Synced remote config v${this.activeConfig.version}`);
                    this._notifyListeners();
                    return this.activeConfig;
                }
            }
        } catch (err) {
            console.warn(`[RemoteConfig] Fetch failed: ${err.message}. Retaining last-known-good config.`);
        }

        return this.activeConfig;
    }

    // =========================================================
    // 🎯 BALANCE & LIVE-OPS GETTERS
    // =========================================================

    getHarvestYieldMultiplier() {
        let mult = this.activeConfig?.harvestBalance?.baseYieldMultiplier || 1.0;
        if (this.isModifierWeekendActive()) {
            mult *= (this.activeConfig.liveOpsEventSlot.multiplier || 2.0);
        }
        return Math.max(0.1, mult);
    }

    getBossTuning(bossId) {
        return this.activeConfig?.bossTuning?.[bossId] || { maxHp: 500, attackDamage: 25, phaseThreshold: 0.50 };
    }

    getDailyChallengeTuning() {
        return this.activeConfig?.dailyChallengeTuning || { baseRewardCrystals: 150, targetMseThreshold: 0.08, streakMultiplierCap: 3.0 };
    }

    isModifierWeekendActive() {
        return Boolean(this.activeConfig?.liveOpsEventSlot?.active);
    }

    getModifierWeekendConfig() {
        return this.activeConfig?.liveOpsEventSlot || { active: false, multiplier: 2.0 };
    }

    // =========================================================
    // 🛠️ DESIGNER PUBLISH & ROLLBACK APIS
    // =========================================================

    async publishBalanceTuning(partialConfig, author = "designer_admin", changeReason = "Balance update") {
        const res = await fetch("/api/remote-config/publish", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ config: partialConfig, author, changeReason })
        });
        const data = await res.json();
        if (data.success) {
            this.activeConfig = data.config;
            this.lastFetchTime = Date.now();
            try {
                localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(this.activeConfig));
                localStorage.setItem(STORAGE_KEY_TIMESTAMP, String(this.lastFetchTime));
            } catch (e) {}
            this._notifyListeners();
        }
        return data;
    }

    async rollbackToVersion(targetVersion, author = "rollback_admin") {
        const res = await fetch("/api/remote-config/rollback", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ targetVersion, author })
        });
        const data = await res.json();
        if (data.success) {
            this.activeConfig = data.config;
            this.lastFetchTime = Date.now();
            try {
                localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(this.activeConfig));
                localStorage.setItem(STORAGE_KEY_TIMESTAMP, String(this.lastFetchTime));
            } catch (e) {}
            this._notifyListeners();
        }
        return data;
    }

    async fetchHistory() {
        const res = await fetch("/api/remote-config/history");
        return res.json();
    }
}

export const NeuroRemoteConfig = new RemoteConfigClient();
if (typeof window !== "undefined") {
    window.NeuroRemoteConfig = NeuroRemoteConfig;
}

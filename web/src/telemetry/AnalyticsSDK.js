/**
 * AnalyticsSDK.js (Web Client)
 * Lightweight, privacy-conscious event analytics SDK for NeuroArena Web.
 * Emits structured events with zero PII, anonymous guest IDs, offline buffering,
 * and automatic flush via fetch/sendBeacon.
 */

function generateId(prefix = "id") {
    let str = "";
    for (let i = 0; i < 16; i++) {
        str += Math.floor(Math.random() * 16).toString(16);
    }
    return `${prefix}_${str}`;
}

export class AnalyticsSDK {
    constructor(options = {}) {
        this.ingestEndpoint = options.ingestEndpoint || "/api/telemetry/events";
        this.clientVersion = options.clientVersion || "2.0.0";
        this.platform = "web";
        this.optedOut = localStorage.getItem("neuroarena_analytics_optout") === "true";
        this.maxBatchSize = options.maxBatchSize || 20;
        this.flushIntervalMs = options.flushIntervalMs || 25000;
        
        this.queue = [];
        this.sessionId = generateId("sess");
        this.sessionStartTime = performance.now();
        this.anonymousPlayerId = this._getOrCreateAnonId();
        this.playerId = this.anonymousPlayerId;
        this.isGuest = true;

        this._initFlushLoop();
        this._initLifecycleHooks();
    }

    _getOrCreateAnonId() {
        let anonId = localStorage.getItem("neuroarena_anon_id");
        if (!anonId) {
            anonId = generateId("anon");
            try {
                localStorage.setItem("neuroarena_anon_id", anonId);
            } catch (e) {}
        }
        return anonId;
    }

    setPlayerIdentity(playerId, isGuest = false) {
        if (playerId) {
            this.playerId = playerId;
            this.isGuest = isGuest;
        }
    }

    setOptOut(optOut) {
        this.optedOut = Boolean(optOut);
        try {
            localStorage.setItem("neuroarena_analytics_optout", this.optedOut ? "true" : "false");
        } catch (e) {}
        if (this.optedOut) {
            this.queue = [];
        }
        console.log(`[NeuroAnalytics] Opt-out updated: ${this.optedOut}`);
    }

    _initFlushLoop() {
        if (typeof window !== "undefined") {
            setInterval(() => {
                if (this.queue.length > 0) {
                    this.flush();
                }
            }, this.flushIntervalMs);
        }
    }

    _initLifecycleHooks() {
        if (typeof window === "undefined") return;

        // Auto-emit session start
        this.trackSessionStart(this.isGuest, this.clientVersion);

        // Auto-emit session end and flush before unload
        window.addEventListener("beforeunload", () => {
            const durationSec = (performance.now() - this.sessionStartTime) / 1000;
            this.trackSessionEnd(durationSec);
            this.flushSync();
        });

        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "hidden") {
                this.flush();
            }
        });
    }

    track(eventName, payload = {}) {
        if (this.optedOut) return;

        const event = {
            eventName,
            playerId: this.playerId,
            sessionId: this.sessionId,
            isGuest: this.isGuest,
            clientPlatform: this.platform,
            clientVersion: this.clientVersion,
            timestamp: new Date().toISOString(),
            payload
        };

        this.queue.push(event);

        if (this.queue.length >= this.maxBatchSize) {
            this.flush();
        }
    }

    // =========================================================
    // 🎯 STRUCTURED EVENT EMITTERS
    // =========================================================

    trackSessionStart(isGuest = true, version = "2.0.0") {
        this.track("session_start", { is_guest: isGuest, version });
    }

    trackSessionEnd(durationSec = 0) {
        this.track("session_end", { duration_sec: Math.max(0, Number(durationSec.toFixed(2))) });
    }

    trackTutorialStep(stepIndex, stepName, completed = true, durationSec = 0) {
        this.track("tutorial_step", {
            step_index: stepIndex,
            step_name: stepName,
            completed: Boolean(completed),
            duration_sec: Number(durationSec.toFixed(2))
        });
    }

    trackTutorialCompleted(totalDurationSec = 0) {
        this.track("tutorial_completed", {
            status: "success",
            total_duration_sec: Number(totalDurationSec.toFixed(2))
        });
    }

    trackBiomeEnter(biomeIndex, biomeName) {
        this.track("biome_enter", {
            biome_index: biomeIndex,
            biome_name: biomeName
        });
    }

    trackBiomeExit(biomeIndex, biomeName, timeSpentSec = 0, completed = false) {
        this.track("biome_exit", {
            biome_index: biomeIndex,
            biome_name: biomeName,
            time_spent_sec: Number(timeSpentSec.toFixed(2)),
            completed: Boolean(completed)
        });
    }

    trackBossAttempt(bossId, bossName, biomeIndex, attemptNumber = 1) {
        this.track("boss_attempt", {
            boss_id: bossId,
            boss_name: bossName,
            biome_index: biomeIndex,
            attempt_number: attemptNumber
        });
    }

    trackBossResult(bossId, bossName, won = false, durationSec = 0, damageDealt = 0) {
        this.track("boss_result", {
            boss_id: bossId,
            boss_name: bossName,
            won: Boolean(won),
            duration_sec: Number(durationSec.toFixed(2)),
            damage_dealt: damageDealt
        });
    }

    trackDuelStart(matchId, opponentId, isBot = false) {
        this.track("duel_start", {
            match_id: matchId,
            opponent_id: opponentId,
            is_bot: Boolean(isBot)
        });
    }

    trackDuelResult(matchId, outcome, ratingChange = 0, matchDurationSec = 0) {
        this.track("duel_result", {
            match_id: matchId,
            outcome,
            rating_change: ratingChange,
            duration_sec: Number(matchDurationSec.toFixed(2))
        });
    }

    trackRewardClaim(rewardId, rewardType, amount = 1) {
        this.track("reward_claim", {
            reward_id: rewardId,
            reward_type: rewardType,
            amount
        });
    }

    trackPurchase(itemId, currency = "crystals", price = 0, success = true) {
        this.track("purchase", {
            item_id: itemId,
            currency,
            price,
            success: Boolean(success)
        });
    }

    trackCrashOrError(errorType, message, stack = "") {
        this.track("crash_error", {
            error_type: errorType || "UnhandledError",
            message: String(message || "").substring(0, 300),
            stack: String(stack || "").substring(0, 800)
        });
    }

    // =========================================================
    // 🚀 BATCH FLUSH LOGIC
    // =========================================================

    async flush() {
        if (this.queue.length === 0) return;

        const batch = [...this.queue];
        this.queue = [];

        try {
            const res = await fetch(this.ingestEndpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ events: batch })
            });
            if (!res.ok) {
                console.warn("[NeuroAnalytics] Telemetry flush returned non-200 status:", res.status);
            }
        } catch (err) {
            // Re-queue up to 50 events on network failure
            this.queue = [...batch.slice(-50), ...this.queue];
        }
    }

    flushSync() {
        if (this.queue.length === 0) return;
        const payload = JSON.stringify({ events: this.queue });
        this.queue = [];

        if (navigator && typeof navigator.sendBeacon === "function") {
            const blob = new Blob([payload], { type: "application/json" });
            navigator.sendBeacon(this.ingestEndpoint, blob);
        }
    }
}

// Instantiate singleton and attach to global window
export const NeuroAnalytics = new AnalyticsSDK();
if (typeof window !== "undefined") {
    window.NeuroAnalytics = NeuroAnalytics;
}

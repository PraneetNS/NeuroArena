/**
 * AdaptiveCoachingClient.js
 * 
 * Web Client Adaptive Difficulty & Opt-in Coaching Layer.
 * Interacts with /api/coaching server APIs while maintaining an offline-first
 * deterministic fallback engine for local practice sessions.
 * 
 * Guarantees:
 * 1. Zero answers spoiled.
 * 2. Opt-in coaching hint escalation after >= 2 boss failures.
 * 3. Inspectable transparency audit logs ("Why was this run easier?").
 * 4. Strict room-type guard rejecting application in Duel or Ranked matches.
 */

class AdaptiveCoachingClient {
  constructor(baseUrl = "") {
    this.baseUrl = baseUrl || (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");
    this.localStruggleState = {
      consecutiveBossFailures: {}, // biomeIndex -> count
      overfittingAlertCount: 0,
      convergencePlateauCount: 0
    };
    this.localAuditLogs = [];
  }

  /**
   * Asserts room eligibility: strictly forbids adaptive coaching in Duel and Ranked matches.
   */
  assertRoomEligibility(roomType = "practice", isRanked = false) {
    const normalizedType = String(roomType || "").toLowerCase();
    if (normalizedType === "duel_room" || normalizedType === "duel" || isRanked === true || normalizedType === "ranked_coop" || normalizedType === "ranked") {
      const err = new Error("ADAPTIVE_COACHING_FORBIDDEN_IN_RANKED");
      err.code = "FORBIDDEN_IN_RANKED";
      err.roomType = roomType;
      err.isRanked = isRanked;
      throw err;
    }
  }

  /**
   * Records a struggle signal in local state and relays to server.
   */
  async recordStruggleSignal(playerId, biomeIndex, signalType, metadata = {}, roomType = "practice", isRanked = false) {
    this.assertRoomEligibility(roomType, isRanked);
    const safeBiome = Math.max(0, Math.min(5, Number(biomeIndex) || 0));

    if (!this.localStruggleState.consecutiveBossFailures[safeBiome]) {
      this.localStruggleState.consecutiveBossFailures[safeBiome] = 0;
    }

    if (signalType === "BOSS_ATTEMPT_FAILED") {
      this.localStruggleState.consecutiveBossFailures[safeBiome] += 1;
    } else if (signalType === "BOSS_ATTEMPT_WON") {
      this.localStruggleState.consecutiveBossFailures[safeBiome] = 0;
    } else if (signalType === "OVERFITTING_ALERT") {
      this.localStruggleState.overfittingAlertCount += 1;
    } else if (signalType === "SLOW_CONVERGENCE" || signalType === "CONVERGENCE_PLATEAU") {
      this.localStruggleState.convergencePlateauCount += 1;
    }

    try {
      if (typeof fetch !== "undefined") {
        await fetch(`${this.baseUrl}/api/coaching/signal`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerId, biomeIndex: safeBiome, signalType, metadata, roomType, isRanked })
        });
      }
    } catch (_) {
      // Local state fallback preserved
    }

    return this.localStruggleState;
  }

  /**
   * Computes or fetches the bounded difficulty envelope for a practice attempt.
   */
  async getAdaptiveEnvelope(playerId, biomeIndex = 0, roomType = "practice", isRanked = false, runId = null) {
    this.assertRoomEligibility(roomType, isRanked);
    const safeBiome = Math.max(0, Math.min(5, Number(biomeIndex) || 0));
    const activeRunId = runId || `RUN-${Date.now()}`;

    try {
      if (typeof fetch !== "undefined") {
        const resp = await fetch(`${this.baseUrl}/api/coaching/adaptive-variant/${safeBiome}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerId, roomType, isRanked, runId: activeRunId })
        });
        if (resp.ok) {
          const data = await resp.json();
          if (data.adaptation) {
            this.localAuditLogs.unshift(data.adaptation);
            return data.adaptation;
          }
        }
      }
    } catch (_) {
      // Fall through to offline calculation
    }

    // Local deterministic fallback
    const failures = this.localStruggleState.consecutiveBossFailures[safeBiome] || 0;
    const overfits = this.localStruggleState.overfittingAlertCount;
    const plateaus = this.localStruggleState.convergencePlateauCount;

    let noiseScaleMultiplier = 1.0;
    let outlierScaleMultiplier = 1.0;
    let bossHpMultiplier = 1.0;
    let bossDamageMultiplier = 1.0;
    let targetLossRelaxation = 1.0;
    const activeReasons = [];

    if (failures >= 3) {
      noiseScaleMultiplier = Math.max(0.75, 1.0 - (failures - 2) * 0.05);
      outlierScaleMultiplier = Math.max(0.70, 1.0 - (failures - 2) * 0.08);
      bossHpMultiplier = Math.max(0.85, 1.0 - (failures - 2) * 0.04);
      bossDamageMultiplier = Math.max(0.85, 1.0 - (failures - 2) * 0.03);
      targetLossRelaxation = Math.min(1.15, 1.0 + (failures - 2) * 0.03);
      activeReasons.push(`STUCK_ON_BOSS_${failures}X`);
    } else if (failures === 2) {
      noiseScaleMultiplier = 0.96;
      outlierScaleMultiplier = 0.95;
      bossHpMultiplier = 0.96;
      targetLossRelaxation = 1.04;
      activeReasons.push("BOSS_FAILURES_2X");
    }

    if (overfits >= 3) {
      noiseScaleMultiplier = Math.min(noiseScaleMultiplier, 0.85);
      activeReasons.push(`OVERFITTING_TELEMETRY_${overfits}X`);
    }

    if (plateaus >= 4) {
      outlierScaleMultiplier = Math.min(outlierScaleMultiplier, 0.80);
      targetLossRelaxation = Math.min(1.18, targetLossRelaxation * 1.05);
      activeReasons.push(`SLOW_CONVERGENCE_${plateaus}X`);
    }

    const isAdapted = activeReasons.length > 0;
    const explanation = isAdapted
      ? `Difficulty envelope adjusted for practice run: Noise reduced by ${Math.round((1 - noiseScaleMultiplier) * 100)}%, outliers reduced by ${Math.round((1 - outlierScaleMultiplier) * 100)}%, boss health tuned by ${Math.round((1 - bossHpMultiplier) * 100)}% due to [${activeReasons.join(", ")}]. Theoretical solvability maintained.`
      : "Standard unadjusted difficulty envelope.";

    const fallbackEnvelope = {
      isAdapted,
      runId: activeRunId,
      playerId,
      biomeIndex: safeBiome,
      modifiers: {
        noiseScaleMultiplier: Number(Math.max(0.75, Math.min(1.0, noiseScaleMultiplier)).toFixed(3)),
        outlierScaleMultiplier: Number(Math.max(0.70, Math.min(1.0, outlierScaleMultiplier)).toFixed(3)),
        bossHpMultiplier: Number(Math.max(0.85, Math.min(1.0, bossHpMultiplier)).toFixed(3)),
        bossDamageMultiplier: Number(Math.max(0.85, Math.min(1.0, bossDamageMultiplier)).toFixed(3)),
        targetLossRelaxation: Number(Math.max(1.0, Math.min(1.20, targetLossRelaxation)).toFixed(3))
      },
      struggleProfile: {
        consecutiveBossFailures: failures,
        overfittingAlertCount: overfits,
        convergencePlateauCount: plateaus
      },
      reasons: activeReasons,
      explanation
    };

    this.localAuditLogs.unshift(fallbackEnvelope);
    return fallbackEnvelope;
  }

  /**
   * Requests a coaching hint for a biome after >= 2 failed attempts.
   */
  async requestCoachingHint(playerId, biomeIndex = 0, optIn = false, roomType = "practice", isRanked = false) {
    this.assertRoomEligibility(roomType, isRanked);
    const safeBiome = Math.max(0, Math.min(5, Number(biomeIndex) || 0));

    try {
      if (typeof fetch !== "undefined") {
        const resp = await fetch(`${this.baseUrl}/api/coaching/hint`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerId, biomeIndex: safeBiome, optIn, roomType, isRanked })
        });
        if (resp.ok) {
          return await resp.json();
        }
      }
    } catch (_) {
      // Local fallback
    }

    const failures = this.localStruggleState.consecutiveBossFailures[safeBiome] || 0;
    if (failures < 2) {
      return {
        isAvailable: false,
        hintTier: 0,
        failuresRequired: 2,
        currentFailures: failures,
        message: "Coaching hints unlock after 2 consecutive failed attempts in practice mode."
      };
    }

    if (!optIn) {
      return {
        isAvailable: true,
        optedIn: false,
        hintTier: failures >= 3 ? 2 : 1,
        message: `Coach analysis available for Biome ${safeBiome + 1} (${failures} failed attempts recorded). Opt-in to reveal conceptual diagnostics.`,
        actionPrompt: "Reveal Coaching Hint"
      };
    }

    // Conceptual guidance (never spoils answers)
    return {
      isAvailable: true,
      optedIn: true,
      hintTier: failures >= 3 ? 2 : 1,
      biomeIndex: safeBiome,
      category: "REGULARIZATION",
      conceptName: "L2 Ridge Penalty / Weight Decay",
      hintText: "Validation error is rising while training error nears zero. Introducing L2 regularization (weight decay) penalizes large weights, enforcing a smoother curve without memorizing noise.",
      guidanceAction: "Apply L2 regularization to restrain higher-order polynomial coefficients.",
      isAnswerSpoiled: false
    };
  }

  /**
   * Retrieves player-inspectable transparency audit log ("Why was this run easier?").
   */
  async getTransparencyAuditLog(playerId, runId = null) {
    try {
      if (typeof fetch !== "undefined") {
        const url = runId
          ? `${this.baseUrl}/api/coaching/transparency/${playerId}?runId=${encodeURIComponent(runId)}`
          : `${this.baseUrl}/api/coaching/transparency/${playerId}`;
        const resp = await fetch(url);
        if (resp.ok) {
          const data = await resp.json();
          if (data.auditLog) return data.auditLog;
        }
      }
    } catch (_) {
      // Local fallback
    }

    if (runId) {
      return this.localAuditLogs.find(l => l.runId === runId) || null;
    }
    return this.localAuditLogs;
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    AdaptiveCoachingClient
  };
}

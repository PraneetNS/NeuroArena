/**
 * AdaptiveCoachingEngine.js
 * 
 * Extends the Real-Time Mathematical Training Narration commentary pipeline into
 * a bounded adaptive-difficulty and opt-in coaching layer.
 * 
 * Core Guarantees:
 * 1. Bounded Range: Adjusts difficulty envelope strictly within [0.70, 1.00] for noise/outliers/stats.
 *    No rubber-banded auto-wins; datasets remain mathematically rigorous and solvable.
 * 2. Zero Answer Spoilers: Hints diagnose mathematical symptoms (high variance, step oscillation, regularization),
 *    never revealing exact solution weights, intercepts, or coordinates.
 * 3. Opt-In Only: Coaching hint escalation is offered after >= 2 boss failures, but only unlocked when player opts in.
 * 4. Transparency Audit Trail: All modifications are logged and inspectable on request ("Why was this run easier?").
 * 5. Strict Ranked Guard: Adaptive difficulty and coaching are strictly isolated from DuelRoom and ranked matches.
 */

class AdaptiveCoachingEngine {
  constructor() {
    // Map<playerId, Map<biomeIndex, StruggleProfile>>
    this.playerProfiles = new Map();
    // Map<playerId, Array<TransparencyLogEntry>>
    this.auditLogs = new Map();
  }

  /**
   * Server-side room-type security guard.
   * Enforces that adaptive difficulty and coaching can NEVER be executed in ranked or duel matches.
   */
  assertRoomEligibility(roomType = "practice", isRanked = false) {
    const normalizedType = String(roomType || "").toLowerCase();
    if (normalizedType === "duel_room" || normalizedType === "duel" || isRanked === true || normalizedType === "ranked_coop" || normalizedType === "ranked" || normalizedType === "coop_room" || normalizedType === "coop") {
      const err = new Error("ADAPTIVE_COACHING_FORBIDDEN_IN_RANKED");
      err.code = "FORBIDDEN_IN_RANKED";
      err.roomType = roomType;
      err.isRanked = isRanked;
      throw err;
    }
  }

  /**
   * Gets or initializes the struggle profile for a player and biome.
   */
  getOrCreateProfile(playerId, biomeIndex = 0) {
    const safePlayerId = String(playerId || "guest_player");
    const safeBiome = Math.max(0, Math.min(5, Number(biomeIndex) || 0));

    if (!this.playerProfiles.has(safePlayerId)) {
      this.playerProfiles.set(safePlayerId, new Map());
    }

    const biomeMap = this.playerProfiles.get(safePlayerId);
    if (!biomeMap.has(safeBiome)) {
      biomeMap.set(safeBiome, {
        playerId: safePlayerId,
        biomeIndex: safeBiome,
        consecutiveBossFailures: 0,
        totalBossAttempts: 0,
        overfittingAlertCount: 0,
        convergencePlateauCount: 0,
        recentLossHistory: [],
        lastAttemptTimestamp: null
      });
    }

    return biomeMap.get(safeBiome);
  }

  /**
   * Ingests real-time training telemetry signals to update player struggle metrics.
   */
  recordTelemetrySignal(playerId, biomeIndex, signalType, metadata = {}, roomType = "practice", isRanked = false) {
    this.assertRoomEligibility(roomType, isRanked);
    const profile = this.getOrCreateProfile(playerId, biomeIndex);
    profile.lastAttemptTimestamp = new Date().toISOString();

    switch (signalType) {
      case "BOSS_ATTEMPT_FAILED":
        profile.consecutiveBossFailures += 1;
        profile.totalBossAttempts += 1;
        break;

      case "BOSS_ATTEMPT_WON":
        // Successful clear resets consecutive struggle count
        profile.consecutiveBossFailures = 0;
        profile.totalBossAttempts += 1;
        break;

      case "OVERFITTING_ALERT":
        profile.overfittingAlertCount += 1;
        break;

      case "CONVERGENCE_PLATEAU":
      case "SLOW_CONVERGENCE":
        profile.convergencePlateauCount += 1;
        break;

      case "EPOCH_LOSS":
        if (typeof metadata.loss === "number") {
          profile.recentLossHistory.push(metadata.loss);
          if (profile.recentLossHistory.length > 30) {
            profile.recentLossHistory.shift();
          }
        }
        break;

      default:
        break;
    }

    return profile;
  }

  /**
   * Computes bounded difficulty envelope adjustments based on telemetry struggle signals.
   * Returns modifiers applied to procedural generation along with an inspectable transparency log.
   */
  computeAdaptiveEnvelope(playerId, biomeIndex = 0, options = {}) {
    const { roomType = "practice", isRanked = false, runId = `RUN-${Date.now()}` } = options;
    this.assertRoomEligibility(roomType, isRanked);

    const profile = this.getOrCreateProfile(playerId, biomeIndex);
    const failures = profile.consecutiveBossFailures;
    const overfits = profile.overfittingAlertCount;
    const plateaus = profile.convergencePlateauCount;

    let noiseScaleMultiplier = 1.0;
    let outlierScaleMultiplier = 1.0;
    let bossHpMultiplier = 1.0;
    let bossDamageMultiplier = 1.0;
    let targetLossRelaxation = 1.0;
    const activeReasons = [];

    // Struggle Signal 1: Repeated Boss Failures (e.g. 3x in a row)
    if (failures >= 3) {
      noiseScaleMultiplier = Math.max(0.75, 1.0 - (failures - 2) * 0.05); // e.g. 3 fails -> 0.95, 4 fails -> 0.90, max 0.75
      outlierScaleMultiplier = Math.max(0.70, 1.0 - (failures - 2) * 0.08); // e.g. 3 fails -> 0.92, 4 fails -> 0.84, max 0.70
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

    // Struggle Signal 2: Persistent Overfitting Telemetry Alerts (> 3 alerts)
    if (overfits >= 3) {
      // High variance in data points is triggering memorization; slightly tame extreme noise variance
      noiseScaleMultiplier = Math.min(noiseScaleMultiplier, 0.85);
      activeReasons.push(`OVERFITTING_TELEMETRY_${overfits}X`);
    }

    // Struggle Signal 3: Convergence Plateaus / Slow Gradient Descent (> 4 alerts)
    if (plateaus >= 4) {
      outlierScaleMultiplier = Math.min(outlierScaleMultiplier, 0.80);
      targetLossRelaxation = Math.min(1.18, targetLossRelaxation * 1.05);
      activeReasons.push(`SLOW_CONVERGENCE_${plateaus}X`);
    }

    const isAdapted = activeReasons.length > 0;

    // Hard bounds clamping to enforce non-rubberbanding guarantee
    noiseScaleMultiplier = Number(Math.max(0.75, Math.min(1.0, noiseScaleMultiplier)).toFixed(3));
    outlierScaleMultiplier = Number(Math.max(0.70, Math.min(1.0, outlierScaleMultiplier)).toFixed(3));
    bossHpMultiplier = Number(Math.max(0.85, Math.min(1.0, bossHpMultiplier)).toFixed(3));
    bossDamageMultiplier = Number(Math.max(0.85, Math.min(1.0, bossDamageMultiplier)).toFixed(3));
    targetLossRelaxation = Number(Math.max(1.0, Math.min(1.20, targetLossRelaxation)).toFixed(3));

    const explanation = isAdapted
      ? `Difficulty envelope adjusted for practice run: Noise reduced by ${Math.round((1 - noiseScaleMultiplier) * 100)}%, outliers reduced by ${Math.round((1 - outlierScaleMultiplier) * 100)}%, boss health tuned by ${Math.round((1 - bossHpMultiplier) * 100)}% due to [${activeReasons.join(", ")}]. Theoretical solvability maintained.`
      : "Standard unadjusted difficulty envelope.";

    const envelopeResult = {
      isAdapted,
      runId,
      playerId,
      biomeIndex,
      modifiers: {
        noiseScaleMultiplier,
        outlierScaleMultiplier,
        bossHpMultiplier,
        bossDamageMultiplier,
        targetLossRelaxation
      },
      struggleProfile: {
        consecutiveBossFailures: failures,
        overfittingAlertCount: overfits,
        convergencePlateauCount: plateaus
      },
      reasons: activeReasons,
      explanation
    };

    // Record transparency audit log
    this._recordTransparencyLog(playerId, {
      runId,
      playerId,
      biomeIndex,
      timestamp: new Date().toISOString(),
      isAdapted,
      reasons: activeReasons,
      modifiers: envelopeResult.modifiers,
      explanation
    });

    return envelopeResult;
  }

  /**
   * Coaching Escalation Engine:
   * After 2 failed attempts at a boss, offers an opt-in non-spoilery hint tier.
   * Strictly verifies player opt-in and room eligibility.
   */
  getCoachingHint(playerId, biomeIndex = 0, optIn = false, options = {}) {
    const { roomType = "practice", isRanked = false } = options;
    this.assertRoomEligibility(roomType, isRanked);

    const profile = this.getOrCreateProfile(playerId, biomeIndex);
    const failures = profile.consecutiveBossFailures;
    const overfits = profile.overfittingAlertCount;

    // Hint tier is unlocked only after >= 2 failed attempts
    if (failures < 2) {
      return {
        isAvailable: false,
        hintTier: 0,
        failuresRequired: 2,
        currentFailures: failures,
        message: "Coaching hints unlock after 2 consecutive failed attempts in practice mode."
      };
    }

    // If player has not explicitly opted in, return offer banner without spoiler
    if (!optIn) {
      return {
        isAvailable: true,
        optedIn: false,
        hintTier: failures >= 3 ? 2 : 1,
        message: `Coach analysis available for Biome ${biomeIndex + 1} (${failures} failed attempts recorded). Opt-in to reveal conceptual diagnostics.`,
        actionPrompt: "Reveal Coaching Hint"
      };
    }

    // Formulate Non-Spoilery Mathematical Diagnostic Hint
    const hintTier = failures >= 3 ? 2 : 1;
    const diagnostic = this._generateConceptHint(biomeIndex, hintTier, {
      overfits,
      failures,
      plateaus: profile.convergencePlateauCount
    });

    return {
      isAvailable: true,
      optedIn: true,
      hintTier,
      biomeIndex,
      category: diagnostic.category,
      conceptName: diagnostic.conceptName,
      hintText: diagnostic.hintText,
      guidanceAction: diagnostic.guidanceAction,
      isAnswerSpoiled: false // Guaranteed: No numeric parameters or direct solutions
    };
  }

  /**
   * Generates conceptual, non-spoilery guidance per biome.
   */
  _generateConceptHint(biomeIndex, hintTier, telemetryContext) {
    switch (biomeIndex) {
      case 0: { // Linear Steppes
        if (hintTier >= 2) {
          return {
            category: "GRADIENT_DYNAMICS",
            conceptName: "Learning Rate & Outlier Sensitivity",
            hintText: "The Outlier Titan injects high-residual leverage points. If your loss oscillates wildly, reduce your gradient step size or dampen updates on samples with abnormal residual distances.",
            guidanceAction: "Consider moderate step scales to prevent explosive parameter shifts on outlier points."
          };
        }
        return {
          category: "SLOPE_ALIGNMENT",
          conceptName: "First-Order Descent Alignment",
          hintText: "Observe the direction of parameter updates: if w is reversing sign repeatedly, the optimizer is overshooting the valley axis.",
          guidanceAction: "Observe gradient signs across epochs before committing larger parameter steps."
        };
      }

      case 1: { // Binary Marshlands
        if (hintTier >= 2) {
          return {
            category: "DECISION_MARGIN",
            conceptName: "Logistic Sigmoid Saturation",
            hintText: "Near the class boundary, extreme logit magnitudes cause vanishing gradients in logistic loss. Keep activation weights balanced so misclassified boundary instances can pull the hyperplane.",
            guidanceAction: "Ensure the decision intercept allows both positive and negative classifications before pushing steep slope weights."
          };
        }
        return {
          category: "LOG_LOSS_PENALTY",
          conceptName: "Cross-Entropy Asymmetry",
          hintText: "Confidently predicting the wrong class incurs exponential cross-entropy penalties. Focus on centering the decision threshold.",
          guidanceAction: "Adjust the bias parameter to separate the overlapping cluster means."
        };
      }

      case 2: { // Variance Tundra
        if (hintTier >= 2) {
          return {
            category: "REGULARIZATION",
            conceptName: "L2 Ridge Penalty / Weight Decay",
            hintText: "The Overfit Colossus flourishes when polynomial degrees grow unchecked. High-magnitude coefficients fit local noise at the expense of held-out validation loss. Introducing L2 regularization (weight decay) penalizes large weights, enforcing a smoother curve.",
            guidanceAction: "Apply L2 regularization to restrain higher-order polynomial coefficients."
          };
        }
        return {
          category: "VARIANCE_DIAGNOSTIC",
          conceptName: "Training vs. Validation Divergence",
          hintText: "Validation error is rising while training error nears zero. The model is memorizing tundra ice spikes instead of discovering the underlying polynomial trend.",
          guidanceAction: "Inspect the validation loss curve to detect the onset of overfitting."
        };
      }

      case 3: { // Branching Canopy
        if (hintTier >= 2) {
          return {
            category: "INFORMATION_GAIN",
            conceptName: "Gini Impurity & Orthogonal Splitting",
            hintText: "Splits positioned directly on high-density cluster cores fail to partition class mixtures cleanly. Position tree thresholds along the low-density valleys between feature clusters.",
            guidanceAction: "Seek split coordinates that minimize child node Gini impurity."
          };
        }
        return {
          category: "TREE_DEPTH",
          conceptName: "Recursive Partitioning Variance",
          hintText: "Deep branch splits isolate individual outlier leaves, destroying generalization. Constrain maximum split depth.",
          guidanceAction: "Focus on primary feature axes with high variance separation."
        };
      }

      case 4: { // Deep Synapse Citadel
        if (hintTier >= 2) {
          return {
            category: "NON_LINEAR_CAPACITY",
            conceptName: "Hidden Layer Activation & XOR Manifold",
            hintText: "A single linear hyperplane cannot separate XOR quadrant geometry. Ensure your network routes through non-linear hidden activations (such as ReLU) to bend the coordinate manifold into a linearly separable space.",
            guidanceAction: "Utilize non-linear activations to project input features into higher-dimensional separability."
          };
        }
        return {
          category: "HIDDEN_REPRESENTATION",
          conceptName: "Backpropagation Signal Flow",
          hintText: "Saturated sigmoid neurons in hidden layers cause gradient starvation. Ensure activations remain in their active dynamic range.",
          guidanceAction: "Monitor layer activation distributions during forward propagation."
        };
      }

      case 5: // Semantic Expanse
      default: {
        if (hintTier >= 2) {
          return {
            category: "EMBEDDING_GEOMETRY",
            conceptName: "Cosine Similarity vs. Euclidean Magnitude",
            hintText: "Frequent co-occurrence tokens inflate vector norms without improving semantic orientation. Normalizing word vectors to unit hyperspheres ensures cosine distance reflects conceptual similarity rather than word frequency.",
            guidanceAction: "Normalize vector magnitudes when computing semantic cluster analogies."
          };
        }
        return {
          category: "LATENT_DIMENSIONS",
          conceptName: "Vector Offset Analogies",
          hintText: "Semantic relationships form parallel offset vectors in the latent subspace (King - Man + Woman = Queen). Look for consistent geometric displacement vectors.",
          guidanceAction: "Align relational offset vectors across related token pairs."
        };
      }
    }
  }

  /**
   * Internal transparency log recording.
   */
  _recordTransparencyLog(playerId, entry) {
    if (!this.auditLogs.has(playerId)) {
      this.auditLogs.set(playerId, []);
    }
    const list = this.auditLogs.get(playerId);
    list.push(entry);
    if (list.length > 50) {
      list.shift();
    }
  }

  /**
   * Returns player-inspectable audit trail ("Why was this run easier?").
   */
  getTransparencyAuditLog(playerId, runId = null) {
    const list = this.auditLogs.get(String(playerId || "guest_player")) || [];
    if (runId) {
      return list.find(e => e.runId === runId) || null;
    }
    return [...list].reverse(); // latest first
  }
}

module.exports = {
  AdaptiveCoachingEngine
};

const crypto = require("crypto");
const { SeededPRNG } = require("../ml/ProceduralVariantEngine");
const { AuthoritativeValidator } = require("../security/AuthoritativeValidator");
const { auditLogger } = require("../security/AuditLogger");

/**
 * CustomChallengeEngine
 * Lightweight Mod-Tools & Creator-Driven Live-Service Engine.
 * 
 * Defines core challenge schemas, allowed function families, and constrained difficulty envelopes.
 */
class CustomChallengeEngine {
  constructor() {
    this.challenges = new Map();

    // Valid Function Families
    this.ALLOWED_FAMILIES = [
      "LINEAR_REGRESSION",
      "LOGISTIC_CLASSIFICATION",
      "POLYNOMIAL_REGRESSION",
      "DECISION_TREE_ENSEMBLE"
    ];

    // Official Move-Set Archetypes
    this.ALLOWED_MOVE_SETS = [
      "GRADIENT_AVALANCHE",
      "RESIDUAL_SHOCKWAVE",
      "MOMENTUM_SURGE",
      "SIGMOID_BREATH",
      "BCE_POISON_POOLS",
      "DUAL_HYPERPLANE_CLEAVE",
      "POLYNOMIAL_OSCILLATION",
      "BLIZZARD_OVERFIT",
      "LASSO_SPARSE_SHARDS",
      "GINI_BRANCH_CLEAVE",
      "ENSEMBLE_ROAR",
      "PRUNING_GALE"
    ];

    this._seedInitialCuratedChallenges();
  }

  /**
   * Publish Flow (Automated Validation -> Instant Listing, No Manual Review Bottleneck)
   */
  publishChallenge(candidate, authorId = "player_creator", authorName = "Community Architect") {
    const validation = this.validateCandidateChallenge(candidate);
    if (!validation.isValid) {
      throw new Error(`PUBLISH_REJECTED: ${validation.reason}`);
    }

    const { sanitized } = validation;
    const challengeId = `ch_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

    const challenge = {
      challengeId,
      title: sanitized.title,
      description: sanitized.description,
      author: { id: authorId, name: authorName },
      functionFamily: sanitized.functionFamily,
      datasetParams: sanitized.datasetParams,
      bossTemplate: sanitized.bossTemplate,
      seed: sanitized.seed,
      dataset: sanitized.dataset,
      solvabilityCertificate: sanitized.solvabilityCertificate,
      createdAt: new Date().toISOString(),
      stats: {
        plays: 0,
        completions: 0,
        upvotes: 0,
        downvotes: 0,
        voters: {}
      }
    };

    this.challenges.set(challengeId, challenge);
    return {
      success: true,
      challengeId,
      challenge: this._formatChallengeSummary(challenge)
    };
  }

  _formatChallengeSummary(ch) {
    return {
      challengeId: ch.challengeId,
      title: ch.title,
      description: ch.description,
      author: ch.author,
      functionFamily: ch.functionFamily,
      bossTemplate: ch.bossTemplate,
      solvabilityCertificate: {
        isSolvable: ch.solvabilityCertificate.isSolvable,
        metric: ch.solvabilityCertificate.metric,
        targetThreshold: ch.solvabilityCertificate.targetMseThreshold || ch.solvabilityCertificate.targetAccuracyThreshold || 0.05
      },
      stats: {
        plays: ch.stats.plays,
        completions: ch.stats.completions,
        upvotes: ch.stats.upvotes,
        downvotes: ch.stats.downvotes,
        netRating: ch.stats.upvotes - ch.stats.downvotes
      },
      createdAt: ch.createdAt
    };
  }

  _seedInitialCuratedChallenges() {
    this.publishChallenge({
      title: "The Gauss-Markov Gauntlet",
      description: "Steep slope regression with strict low-noise bounds and punishing residual shockwaves.",
      functionFamily: "LINEAR_REGRESSION",
      datasetParams: { sampleCount: 36, noiseSigma: 0.08, outlierRate: 0.03, slopeW: 2.8, interceptB: 1.2 },
      bossTemplate: {
        bossName: "Markov Sentinel",
        maxHp: 1200,
        attackDamage: 45,
        enrageTimerSec: 120,
        moveSetPattern: "RESIDUAL_SHOCKWAVE"
      }
    }, "creator_01", "Ada Master");

    this.publishChallenge({
      title: "Logistic Razor Cleave",
      description: "Tight margin classification test designed to punish inaccurate decision hyperplanes.",
      functionFamily: "LOGISTIC_CLASSIFICATION",
      datasetParams: { sampleCount: 42, noiseSigma: 0.10, marginDistance: 0.65, overlapRate: 0.02 },
      bossTemplate: {
        bossName: "Hyperplane Warden",
        maxHp: 1600,
        attackDamage: 55,
        enrageTimerSec: 140,
        moveSetPattern: "DUAL_HYPERPLANE_CLEAVE"
      }
    }, "creator_02", "Euler Pioneer");

    this.publishChallenge({
      title: "Runge Cubic Tempest",
      description: "High-variance cubic curve requiring regularized precision under extreme blizzard conditions.",
      functionFamily: "POLYNOMIAL_REGRESSION",
      datasetParams: { sampleCount: 38, noiseSigma: 0.14, polyDegree: 3, c0: 0.2, c1: -1.5, c2: 0.6, c3: -0.18 },
      bossTemplate: {
        bossName: "Cubic Colossus",
        maxHp: 2200,
        attackDamage: 70,
        enrageTimerSec: 160,
        moveSetPattern: "POLYNOMIAL_OSCILLATION"
      }
    }, "creator_03", "Runge Phenom");
  }

  /**
   * Server-Paginated Browsable Community Challenges
   */
  getPaginatedChallenges({
    page = 1,
    limit = 6,
    sort = "popular",
    functionFamily = null
  } = {}) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(50, parseInt(limit, 10) || 6));

    let items = Array.from(this.challenges.values());

    if (functionFamily && functionFamily !== "ALL") {
      items = items.filter(c => c.functionFamily === functionFamily);
    }

    switch (sort) {
      case "rating":
      case "top_rated":
        items.sort((a, b) => (b.stats.upvotes - b.stats.downvotes) - (a.stats.upvotes - a.stats.downvotes));
        break;
      case "completions":
        items.sort((a, b) => b.stats.completions - a.stats.completions);
        break;
      case "newest":
        items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        break;
      case "popular":
      default:
        items.sort((a, b) => {
          const popA = (a.stats.upvotes - a.stats.downvotes) * 2 + a.stats.completions * 3 + a.stats.plays;
          const popB = (b.stats.upvotes - b.stats.downvotes) * 2 + b.stats.completions * 3 + b.stats.plays;
          return popB - popA;
        });
        break;
    }

    const total = items.length;
    const totalPages = Math.ceil(total / limitNum) || 1;
    const startIndex = (pageNum - 1) * limitNum;
    const paginatedItems = items.slice(startIndex, startIndex + limitNum).map(c => this._formatChallengeSummary(c));

    return {
      success: true,
      total,
      page: pageNum,
      totalPages,
      limit: limitNum,
      challenges: paginatedItems
    };
  }

  getChallengeById(challengeId) {
    const ch = this.challenges.get(challengeId);
    if (!ch) return null;
    ch.stats.plays++;
    return ch;
  }

  /**
   * Community Rating (Thumbs Up / Down) with per-player deduplication
   */
  rateChallenge(challengeId, playerId, vote) {
    const ch = this.challenges.get(challengeId);
    if (!ch) {
      return { success: false, error: "CHALLENGE_NOT_FOUND" };
    }

    if (vote !== "UP" && vote !== "DOWN") {
      return { success: false, error: "INVALID_VOTE_TYPE", reason: "Vote must be 'UP' or 'DOWN'." };
    }

    const prevVote = ch.stats.voters[playerId];
    if (prevVote === vote) {
      return {
        success: true,
        alreadyVoted: true,
        upvotes: ch.stats.upvotes,
        downvotes: ch.stats.downvotes,
        netRating: ch.stats.upvotes - ch.stats.downvotes
      };
    }

    if (prevVote === "UP") ch.stats.upvotes--;
    if (prevVote === "DOWN") ch.stats.downvotes--;

    if (vote === "UP") ch.stats.upvotes++;
    if (vote === "DOWN") ch.stats.downvotes++;
    ch.stats.voters[playerId] = vote;

    return {
      success: true,
      vote,
      upvotes: ch.stats.upvotes,
      downvotes: ch.stats.downvotes,
      netRating: ch.stats.upvotes - ch.stats.downvotes
    };
  }

  /**
   * Validate Candidate Challenge Parameters & Analytical Solvability
   */
  validateCandidateChallenge(candidate) {
    if (!candidate || typeof candidate !== "object") {
      return { isValid: false, code: "INVALID_PAYLOAD", reason: "Candidate payload must be an object." };
    }

    const { functionFamily, datasetParams, bossTemplate, title, description } = candidate;

    if (!title || typeof title !== "string" || title.trim().length < 3 || title.trim().length > 64) {
      return { isValid: false, code: "INVALID_TITLE", reason: "Challenge title must be a string between 3 and 64 characters." };
    }

    if (!this.ALLOWED_FAMILIES.includes(functionFamily)) {
      return { isValid: false, code: "UNSUPPORTED_FAMILY", reason: `Function family '${functionFamily}' is unsupported.` };
    }

    if (!datasetParams || typeof datasetParams !== "object") {
      return { isValid: false, code: "INVALID_DATASET_PARAMS", reason: "Missing dataset configuration parameters." };
    }

    const sampleCount = Number(datasetParams.sampleCount) || 30;
    if (sampleCount < 20 || sampleCount > 60) {
      return {
        isValid: false,
        code: "REJECTED_TRIVIAL_DATASET",
        reason: `Sample count (${sampleCount}) is outside the safe difficulty envelope [20, 60]. Cannot trivialize or overwhelm scoring.`
      };
    }

    const noiseSigma = Number(datasetParams.noiseSigma);
    if (isNaN(noiseSigma) || noiseSigma < 0.02 || noiseSigma > 0.40) {
      return {
        isValid: false,
        code: "REJECTED_TRIVIAL_DATASET",
        reason: `Noise sigma (${noiseSigma}) must fall within safe bounds [0.02, 0.40]. Zero-noise flatlines are forbidden.`
      };
    }

    const outlierRate = Number(datasetParams.outlierRate !== undefined ? datasetParams.outlierRate : 0.04);
    if (isNaN(outlierRate) || outlierRate < 0.0 || outlierRate > 0.15) {
      return { isValid: false, code: "INVALID_OUTLIER_RATE", reason: `Outlier rate (${outlierRate}) must be between 0.0 and 0.15.` };
    }

    if (!bossTemplate || typeof bossTemplate !== "object") {
      return { isValid: false, code: "INVALID_BOSS_TEMPLATE", reason: "Boss stat template is required." };
    }

    const bossName = String(bossTemplate.bossName || "Custom Boss").trim();
    if (bossName.length < 3 || bossName.length > 32) {
      return { isValid: false, code: "INVALID_BOSS_NAME", reason: "Boss name must be between 3 and 32 characters." };
    }

    const maxHp = Number(bossTemplate.maxHp);
    if (isNaN(maxHp) || maxHp < 300 || maxHp > 4000) {
      return { isValid: false, code: "INVALID_BOSS_HP", reason: `Boss Max HP (${maxHp}) must fall within the bounded envelope [300, 4000].` };
    }

    const attackDamage = Number(bossTemplate.attackDamage);
    if (isNaN(attackDamage) || attackDamage < 15 || attackDamage > 120) {
      return { isValid: false, code: "INVALID_BOSS_DAMAGE", reason: `Boss Attack Damage (${attackDamage}) must fall within the bounded envelope [15, 120].` };
    }

    const enrageTimerSec = Number(bossTemplate.enrageTimerSec);
    if (isNaN(enrageTimerSec) || enrageTimerSec < 60 || enrageTimerSec > 240) {
      return { isValid: false, code: "INVALID_BOSS_ENRAGE", reason: `Boss Enrage Timer (${enrageTimerSec}s) must fall within safe limits [60s, 240s].` };
    }

    const moveSetPattern = bossTemplate.moveSetPattern || "GRADIENT_AVALANCHE";
    if (!this.ALLOWED_MOVE_SETS.includes(moveSetPattern)) {
      return { isValid: false, code: "INVALID_BOSS_MOVESET", reason: `Move-set '${moveSetPattern}' is unrecognized.` };
    }

    const prngSeed = candidate.seed || `MOD_${Date.now()}_${Math.floor(Math.random() * 99999)}`;
    const prng = new SeededPRNG(prngSeed);

    const generated = this._generateDatasetAndProof(functionFamily, datasetParams, prng);
    if (!generated.solvability.isSolvable) {
      return {
        isValid: false,
        code: "REJECTED_UNSOLVABLE",
        reason: generated.solvability.reason || "Candidate dataset failed mathematical solvability check.",
        details: generated.solvability
      };
    }

    return {
      isValid: true,
      sanitized: {
        title: title.trim(),
        description: (description || "").trim(),
        functionFamily,
        datasetParams: { sampleCount, noiseSigma, outlierRate, ...generated.datasetParams },
        bossTemplate: { bossName, maxHp, attackDamage, enrageTimerSec, moveSetPattern },
        seed: prngSeed,
        dataset: generated.dataset,
        solvabilityCertificate: generated.solvability
      }
    };
  }

  /**
   * Analytical Solvability Prover matching Prompt 9 Procedural Generator
   * Computes closed-form OLS optimal inlier MSE for Linear Steppes and class separability.
   */
  _generateDatasetAndProof(functionFamily, params, prng) {
    const sampleCount = Number(params.sampleCount) || 30;
    const noiseSigma = Number(params.noiseSigma) || 0.10;
    const outlierRate = Number(params.outlierRate !== undefined ? params.outlierRate : 0.04);

    switch (functionFamily) {
      case "LINEAR_REGRESSION": {
        const slopeW = Number(params.slopeW !== undefined ? params.slopeW : prng.range(1.5, 3.2));
        const interceptB = Number(params.interceptB !== undefined ? params.interceptB : prng.range(-2.0, 2.0));

        const samples = [];
        for (let i = 0; i < sampleCount; i++) {
          const x = Number(prng.range(-4.0, 4.0).toFixed(3));
          const isOutlier = prng.next() < outlierRate;
          let y = slopeW * x + interceptB + prng.gaussian(0, noiseSigma * 2.0);
          if (isOutlier) {
            y += (prng.next() > 0.5 ? 1 : -1) * prng.range(5.0, 8.0);
          }
          samples.push({ id: i, x, y: Number(y.toFixed(3)), isOutlier });
        }

        const inliers = samples.filter(s => !s.isOutlier);
        if (inliers.length < 10) {
          return { solvability: { isSolvable: false, reason: "Insufficient inlier count for reliable mathematical regression." } };
        }

        const meanX = inliers.reduce((sum, s) => sum + s.x, 0) / inliers.length;
        const meanY = inliers.reduce((sum, s) => sum + s.y, 0) / inliers.length;

        let num = 0, den = 0;
        for (const s of inliers) {
          num += (s.x - meanX) * (s.y - meanY);
          den += Math.pow(s.x - meanX, 2);
        }

        if (Math.abs(den) < 0.05) {
          return { solvability: { isSolvable: false, reason: "Feature X distribution has degenerate variance (< 0.05)." } };
        }

        const optimalW = num / den;
        const optimalB = meanY - optimalW * meanX;

        let mse = 0;
        for (const s of inliers) {
          const pred = optimalW * s.x + optimalB;
          mse += Math.pow(pred - s.y, 2);
        }
        mse /= inliers.length;

        const maxMseThreshold = 0.05;
        const isSolvable = mse <= maxMseThreshold;

        return {
          dataset: samples,
          datasetParams: { slopeW, interceptB },
          solvability: {
            isSolvable,
            metric: "MSE",
            theoreticalMinMse: Number(mse.toFixed(4)),
            targetMseThreshold: Number((mse * 1.5).toFixed(4)),
            solvabilityCeiling: maxMseThreshold,
            optimalParameters: { w: Number(optimalW.toFixed(4)), b: Number(optimalB.toFixed(4)) },
            reason: isSolvable ? null : `Optimal inlier MSE (${mse.toFixed(4)}) exceeds mathematical solvability threshold (${maxMseThreshold.toFixed(4)}). Dataset is too noisy.`
          }
        };
      }

      case "LOGISTIC_CLASSIFICATION": {
        const boundaryShape = params.boundaryShape || "linear_hyperplane";
        const margin = Number(params.marginDistance || 0.50);
        const overlapRate = Number(params.overlapRate !== undefined ? params.overlapRate : 0.04);

        const samples = [];
        for (let i = 0; i < sampleCount; i++) {
          const x1 = Number(prng.range(-3.5, 3.5).toFixed(3));
          const x2 = Number(prng.range(-3.5, 3.5).toFixed(3));
          let rawScore = 0.8 * x1 + 0.6 * x2 - 0.2;
          if (boundaryShape === "circular_boundary") {
            rawScore = Math.sqrt(x1 * x1 + x2 * x2) - 2.0;
          }

          let classLabel = rawScore >= 0 ? 1 : 0;
          const isOverlap = prng.next() < overlapRate;
          if (isOverlap) classLabel = classLabel === 1 ? 0 : 1;

          samples.push({ id: i, x1, x2, classLabel, isOverlap });
        }

        const nonOverlap = samples.filter(s => !s.isOverlap);
        const theoreticalAccuracy = nonOverlap.length / samples.length;
        const targetAccuracyThreshold = 0.90;
        const isSolvable = theoreticalAccuracy >= targetAccuracyThreshold;

        return {
          dataset: samples,
          datasetParams: { boundaryShape, marginDistance: margin, overlapRate },
          solvability: {
            isSolvable,
            metric: "ACCURACY",
            theoreticalAccuracy: Number(theoreticalAccuracy.toFixed(4)),
            targetAccuracyThreshold,
            reason: isSolvable ? null : `Theoretical classification accuracy (${(theoreticalAccuracy * 100).toFixed(1)}%) is below the minimum required solvability bound of 90.0%.`
          }
        };
      }

      case "POLYNOMIAL_REGRESSION": {
        const polyDegree = params.polyDegree === 3 ? 3 : 2;
        const c0 = Number(params.c0 !== undefined ? params.c0 : 0.5);
        const c1 = Number(params.c1 !== undefined ? params.c1 : -1.2);
        const c2 = Number(params.c2 !== undefined ? params.c2 : 0.4);
        const c3 = polyDegree === 3 ? Number(params.c3 !== undefined ? params.c3 : -0.15) : 0;

        const samples = [];
        for (let i = 0; i < sampleCount; i++) {
          const x = Number(prng.range(-3.0, 3.0).toFixed(3));
          const noise = prng.gaussian(0, noiseSigma);
          const y = c0 + c1 * x + c2 * Math.pow(x, 2) + c3 * Math.pow(x, 3) + noise;
          samples.push({ id: i, x, y: Number(y.toFixed(3)) });
        }

        const isSolvable = noiseSigma <= 0.28;
        return {
          dataset: samples,
          datasetParams: { polyDegree, c0, c1, c2, c3 },
          solvability: {
            isSolvable,
            metric: "MSE",
            theoreticalMinMse: Number((noiseSigma * noiseSigma).toFixed(4)),
            targetMseThreshold: Number((noiseSigma * noiseSigma * 1.5).toFixed(4)),
            reason: isSolvable ? null : `Polynomial variance noise sigma (${noiseSigma.toFixed(3)}) exceeds polynomial solvability ceiling (0.280).`
          }
        };
      }

      case "DECISION_TREE_ENSEMBLE":
      default: {
        const splitThresholdX1 = Number(params.splitThresholdX1 !== undefined ? params.splitThresholdX1 : 0.0);
        const splitThresholdX2 = Number(params.splitThresholdX2 !== undefined ? params.splitThresholdX2 : 0.0);

        const samples = [];
        let class1Count = 0;
        for (let i = 0; i < sampleCount; i++) {
          const x1 = Number(prng.range(-3.0, 3.0).toFixed(3));
          const x2 = Number(prng.range(-3.0, 3.0).toFixed(3));
          const classLabel = (x1 > splitThresholdX1 && x2 > splitThresholdX2) ? 1 : 0;
          if (classLabel === 1) class1Count++;
          samples.push({ id: i, x1, x2, classLabel });
        }

        const ratio = class1Count / sampleCount;
        const isSolvable = ratio >= 0.15 && ratio <= 0.85;

        return {
          dataset: samples,
          datasetParams: { splitThresholdX1, splitThresholdX2 },
          solvability: {
            isSolvable,
            metric: "GINI",
            theoreticalPurity: 0.95,
            splitBalanceRatio: Number(ratio.toFixed(3)),
            reason: isSolvable ? null : `Decision boundary is heavily skewed (${(ratio * 100).toFixed(1)}% class 1).`
          }
        };
      }
    }
  }
}

module.exports = {
  CustomChallengeEngine
};

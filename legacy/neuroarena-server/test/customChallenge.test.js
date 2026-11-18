const assert = require("assert");
const { CustomChallengeEngine } = require("../src/community/CustomChallengeEngine");
const { auditLogger } = require("../src/security/AuditLogger");

console.log("▶ Testing Creator-Driven Custom Biome Challenges, Mod-Tools & Anti-Cheat Pipeline...");

function runTests() {
  const engine = new CustomChallengeEngine();

  // ==========================================
  // 1. Parameter Bounds & Exploit Rejection
  // ==========================================
  console.log("  1. Testing constrained authoring envelope & exploit prevention...");

  // Exploit A: Trivial sample count (< 20 samples to cheese scoring)
  const trivialSamplePayload = {
    title: "Trivial 5-Sample Gauntlet",
    functionFamily: "LINEAR_REGRESSION",
    datasetParams: { sampleCount: 5, noiseSigma: 0.05, outlierRate: 0.0 },
    bossTemplate: {
      bossName: "Trivial Boss",
      maxHp: 500,
      attackDamage: 20,
      enrageTimerSec: 90,
      moveSetPattern: "GRADIENT_AVALANCHE"
    }
  };
  const trivialSampleCheck = engine.validateCandidateChallenge(trivialSamplePayload);
  assert.strictEqual(trivialSampleCheck.isValid, false);
  assert.strictEqual(trivialSampleCheck.code, "REJECTED_TRIVIAL_DATASET");
  assert.ok(trivialSampleCheck.reason.includes("outside the safe difficulty envelope [20, 60]"),
    "Must explicitly explain sample count bound violation");

  // Exploit B: Zero noise / flatline exploit (< 0.02)
  const zeroNoisePayload = {
    title: "Zero Noise Flatline Exploit",
    functionFamily: "LINEAR_REGRESSION",
    datasetParams: { sampleCount: 30, noiseSigma: 0.001, outlierRate: 0.0 },
    bossTemplate: {
      bossName: "Flatline Boss",
      maxHp: 600,
      attackDamage: 25,
      enrageTimerSec: 90,
      moveSetPattern: "GRADIENT_AVALANCHE"
    }
  };
  const zeroNoiseCheck = engine.validateCandidateChallenge(zeroNoisePayload);
  assert.strictEqual(zeroNoiseCheck.isValid, false);
  assert.strictEqual(zeroNoiseCheck.code, "REJECTED_TRIVIAL_DATASET");
  assert.ok(zeroNoiseCheck.reason.includes("Zero-noise flatlines are forbidden"),
    "Must reject zero-noise flatline exploit with clear reason");

  // Exploit C: Out-of-bounds boss stat (e.g. 5 HP or 99999 HP)
  const extremeBossPayload = {
    title: "1-HP Cheese Boss",
    functionFamily: "LINEAR_REGRESSION",
    datasetParams: { sampleCount: 25, noiseSigma: 0.05, outlierRate: 0.02 },
    bossTemplate: {
      bossName: "Fragile Boss",
      maxHp: 5, // Below 300 min
      attackDamage: 20,
      enrageTimerSec: 90,
      moveSetPattern: "GRADIENT_AVALANCHE"
    }
  };
  const extremeBossCheck = engine.validateCandidateChallenge(extremeBossPayload);
  assert.strictEqual(extremeBossCheck.isValid, false);
  assert.strictEqual(extremeBossCheck.code, "INVALID_BOSS_HP");
  assert.ok(extremeBossCheck.reason.includes("[300, 4000]"), "Must enforce boss HP envelope bounds");

  console.log("  ✅ Bounded Authoring Envelope & Anti-Exploit Guards Verified!");

  // ==========================================
  // 2. Solvability Check & Clear Rejection
  // ==========================================
  console.log("  2. Testing mathematical solvability check and explicit rejection reasons...");

  // Extremely noisy dataset where closed-form OLS optimal MSE exceeds 0.05
  const unsolvablePayload = {
    title: "Unsolvable Chaos Storm",
    functionFamily: "LINEAR_REGRESSION",
    datasetParams: {
      sampleCount: 40,
      noiseSigma: 0.38, // High noise causes inlier MSE to blow past 0.05
      outlierRate: 0.12,
      slopeW: 2.0,
      interceptB: 0.5
    },
    bossTemplate: {
      bossName: "Chaos Lord",
      maxHp: 1500,
      attackDamage: 40,
      enrageTimerSec: 120,
      moveSetPattern: "RESIDUAL_SHOCKWAVE"
    }
  };

  const unsolvableCheck = engine.validateCandidateChallenge(unsolvablePayload);
  assert.strictEqual(unsolvableCheck.isValid, false);
  assert.strictEqual(unsolvableCheck.code, "REJECTED_UNSOLVABLE");
  assert.ok(unsolvableCheck.reason.includes("exceeds mathematical solvability threshold"),
    "Rejection reason must explicitly state why the dataset is unsolvable");
  assert.ok(unsolvableCheck.details.theoreticalMinMse > 0.05,
    "Calculated theoretical MSE must exceed 0.05 ceiling");

  // Attempting to publish an unsolvable challenge throws with clear reason (no silent drop or publish)
  assert.throws(() => {
    engine.publishChallenge(unsolvablePayload, "hacker_01", "Exploiter");
  }, /PUBLISH_REJECTED.*solvability threshold/);

  console.log("  ✅ Solvability Rejection with Clear Reason Verified (No Silent Drops/Publishes)!");

  // ==========================================
  // 3. Automated Publish Flow
  // ==========================================
  console.log("  3. Testing automated validation and instant publish flow...");

  const validPayload = {
    title: "The Gradient Gauntlet",
    description: "A finely tuned linear gradient challenge with moderate noise and momentum waves.",
    functionFamily: "LINEAR_REGRESSION",
    datasetParams: {
      sampleCount: 32,
      noiseSigma: 0.05,
      outlierRate: 0.0,
      slopeW: 2.5,
      interceptB: -1.0
    },
    bossTemplate: {
      bossName: "Vector Titan",
      maxHp: 1100,
      attackDamage: 35,
      enrageTimerSec: 100,
      moveSetPattern: "MOMENTUM_SURGE"
    },
    seed: "SEED_VALID_GAUNTLET_101"
  };

  const published = engine.publishChallenge(validPayload, "architect_42", "Master Ada");
  assert.strictEqual(published.success, true);
  assert.ok(published.challengeId.startsWith("ch_"));
  assert.strictEqual(published.challenge.title, "The Gradient Gauntlet");
  assert.strictEqual(published.challenge.solvabilityCertificate.isSolvable, true);
  assert.ok(published.challenge.solvabilityCertificate.targetThreshold <= 0.08);
  assert.strictEqual(published.challenge.stats.plays, 0);
  assert.strictEqual(published.challenge.stats.completions, 0);

  console.log(`  ✅ Challenge Published Cleanly! ID: ${published.challengeId}`);

  // ==========================================
  // 4. Server-Paginated Browsing & Filtering
  // ==========================================
  console.log("  4. Testing server-side pagination, sorting, and family filters...");

  // Initial seed has 3 + 1 published = 4 challenges
  const page1 = engine.getPaginatedChallenges({ page: 1, limit: 2, sort: "popular" });
  assert.strictEqual(page1.success, true);
  assert.strictEqual(page1.challenges.length, 2);
  assert.strictEqual(page1.total, 4);
  assert.strictEqual(page1.totalPages, 2);
  assert.strictEqual(page1.page, 1);

  const page2 = engine.getPaginatedChallenges({ page: 2, limit: 2, sort: "popular" });
  assert.strictEqual(page2.challenges.length, 2);
  assert.strictEqual(page2.page, 2);

  // Filter by functionFamily = "LINEAR_REGRESSION"
  const linearOnly = engine.getPaginatedChallenges({ functionFamily: "LINEAR_REGRESSION" });
  assert.ok(linearOnly.challenges.every(c => c.functionFamily === "LINEAR_REGRESSION"));
  assert.strictEqual(linearOnly.challenges.length, 2); // Gauss-Markov + Gradient Gauntlet

  console.log("  ✅ Server-Side Pagination & Filters Verified!");

  // ==========================================
  // 5. Community Rating (Thumbs Up / Down)
  // ==========================================
  console.log("  5. Testing community rating and vote deduplication...");

  const targetId = published.challengeId;

  // Upvote
  const vote1 = engine.rateChallenge(targetId, "player_alpha", "UP");
  assert.strictEqual(vote1.success, true);
  assert.strictEqual(vote1.upvotes, 1);
  assert.strictEqual(vote1.downvotes, 0);
  assert.strictEqual(vote1.netRating, 1);

  // Duplicate upvote does not double-count
  const voteDup = engine.rateChallenge(targetId, "player_alpha", "UP");
  assert.strictEqual(voteDup.alreadyVoted, true);
  assert.strictEqual(voteDup.upvotes, 1);

  // Switch to downvote
  const voteSwitch = engine.rateChallenge(targetId, "player_alpha", "DOWN");
  assert.strictEqual(voteSwitch.upvotes, 0);
  assert.strictEqual(voteSwitch.downvotes, 1);
  assert.strictEqual(voteSwitch.netRating, -1);

  // Another player upvotes
  const vote2 = engine.rateChallenge(targetId, "player_beta", "UP");
  assert.strictEqual(vote2.upvotes, 1);
  assert.strictEqual(vote2.downvotes, 1);
  assert.strictEqual(vote2.netRating, 0);

  console.log("  ✅ Community Ratings & Deduplication Verified!");

  // ==========================================
  // 6. Authoritative Scoring & Anti-Cheat Pipeline Parity
  // ==========================================
  console.log("  6. Testing exact anti-cheat & scoring pipeline on community challenge...");

  const fullChallenge = engine.getChallengeById(targetId);
  assert.ok(fullChallenge);
  assert.strictEqual(fullChallenge.stats.plays, 1, "Plays counter must increment when fetched for playing");

  // A. Anti-cheat check: impossible training speed (< 2500ms)
  auditLogger.clear();
  const impossibleSpeedSubmission = {
    playerId: "cheater_99",
    playerName: "SpeedHacker",
    initialW: 0,
    initialB: 0,
    targetW: 2.5,
    targetB: -1.0,
    learningRate: 0.05,
    epochs: 50,
    elapsedMs: 600, // < 2500ms
    reportedMse: 0.02
  };

  const cheatSpeedResult = engine.evaluateChallengeSubmission(targetId, impossibleSpeedSubmission);
  assert.strictEqual(cheatSpeedResult.success, false);
  assert.strictEqual(cheatSpeedResult.penaltyApplied, true);
  assert.strictEqual(cheatSpeedResult.score, 0);
  assert.ok(cheatSpeedResult.reason.includes("Implausible training speed"));
  assert.strictEqual(auditLogger.getAnomalies().length, 1);
  assert.strictEqual(auditLogger.getAnomalies()[0].reason, "IMPOSSIBLE_TRAINING_SPEED");

  // B. Anti-cheat check: weight replay mismatch (client faked weights)
  const weightMismatchSubmission = {
    playerId: "cheater_98",
    playerName: "Faker",
    initialW: 0,
    initialB: 0,
    targetW: 99.5, // Fabricated weight
    targetB: -88.0,
    learningRate: 0.05,
    epochs: 50,
    elapsedMs: 3500,
    reportedMse: 0.001
  };

  const cheatWeightResult = engine.evaluateChallengeSubmission(targetId, weightMismatchSubmission);
  assert.strictEqual(cheatWeightResult.success, false);
  assert.strictEqual(cheatWeightResult.penaltyApplied, true);
  assert.strictEqual(cheatWeightResult.score, 0);
  assert.ok(cheatWeightResult.reason.includes("WEIGHT_REPLAY_MISMATCH"));

  // C. Honest legitimate training run
  // Replay actual SGD locally for epochs to obtain genuine converged weights
  const dataset = fullChallenge.dataset;
  let simW = 0.0;
  let simB = 0.0;
  const lr = 0.04;
  const epochs = 120;
  const N = dataset.length;

  for (let ep = 0; ep < epochs; ep++) {
    let gradW = 0, gradB = 0;
    for (let i = 0; i < N; i++) {
      const pred = simW * dataset[i].x + simB;
      const err = pred - dataset[i].y;
      gradW += (2 / N) * err * dataset[i].x;
      gradB += (2 / N) * err;
    }
    simW -= lr * gradW;
    simB -= lr * gradB;
  }

  let finalMse = 0;
  for (let i = 0; i < N; i++) {
    finalMse += Math.pow(simW * dataset[i].x + simB - dataset[i].y, 2);
  }
  finalMse /= N;

  const honestSubmission = {
    playerId: "honest_champ",
    playerName: "Ada Honest",
    initialW: 0.0,
    initialB: 0.0,
    targetW: Number(simW.toFixed(4)),
    targetB: Number(simB.toFixed(4)),
    learningRate: lr,
    epochs,
    elapsedMs: 4200,
    reportedMse: Number(finalMse.toFixed(4))
  };

  const honestResult = engine.evaluateChallengeSubmission(targetId, honestSubmission);
  assert.strictEqual(honestResult.success, true);
  assert.strictEqual(honestResult.verified, true);
  assert.strictEqual(honestResult.bossDefeated, true);
  assert.ok(honestResult.score >= 1000, `Honest score must include victory bonus (got ${honestResult.score})`);
  assert.ok(honestResult.signature && honestResult.signature.length === 64, "Must generate cryptographic parameter signature");
  assert.strictEqual(honestResult.rewards.computeCredits, 150);
  assert.strictEqual(honestResult.challengeStats.completions, 1, "Completions must increment upon honest victory");

  console.log(`  ✅ Unified Anti-Cheat & Scoring Verified! Score: ${honestResult.score}, Signature: ${honestResult.signature.slice(0, 16)}...`);
  console.log("🎉 All Creator-Driven Custom Challenge & Mod-Tools Tests Passed Cleanly!");
}

runTests();

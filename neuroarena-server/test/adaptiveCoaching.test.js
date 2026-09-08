const assert = require("assert");
const { AdaptiveCoachingEngine } = require("../src/ml/AdaptiveCoachingEngine");
const { ProceduralVariantEngine } = require("../src/ml/ProceduralVariantEngine");

function runAdaptiveCoachingTests() {
  console.log("▶ Testing Adaptive Difficulty, Coaching Escalation & Transparency Audit Engine...");

  const coachingEngine = new AdaptiveCoachingEngine();
  const proceduralEngine = new ProceduralVariantEngine();
  const playerId = "player_test_struggle_8842";
  const biomeIndex = 2; // Biome 3: The Variance Tundra (Overfit Colossus)

  // 1. Initial State: Baseline unadjusted envelope
  console.log("  1. Testing initial baseline (no struggle recorded)...");
  const baselineEnvelope = coachingEngine.computeAdaptiveEnvelope(playerId, biomeIndex, {
    roomType: "practice",
    isRanked: false
  });
  assert.strictEqual(baselineEnvelope.isAdapted, false, "Baseline should not be adapted");
  assert.strictEqual(baselineEnvelope.modifiers.noiseScaleMultiplier, 1.0);
  assert.strictEqual(baselineEnvelope.modifiers.bossHpMultiplier, 1.0);
  console.log("  ✅ Baseline Unadjusted Envelope Verified!");

  // 2. Telemetry Ingestion: 3x consecutive boss failures + overfitting alerts
  console.log("  2. Ingesting struggle signals (3x failed boss attempts + overfitting telemetry)...");
  coachingEngine.recordTelemetrySignal(playerId, biomeIndex, "BOSS_ATTEMPT_FAILED", {}, "practice", false);
  coachingEngine.recordTelemetrySignal(playerId, biomeIndex, "BOSS_ATTEMPT_FAILED", {}, "practice", false);
  coachingEngine.recordTelemetrySignal(playerId, biomeIndex, "BOSS_ATTEMPT_FAILED", {}, "practice", false);
  coachingEngine.recordTelemetrySignal(playerId, biomeIndex, "OVERFITTING_ALERT", {}, "practice", false);
  coachingEngine.recordTelemetrySignal(playerId, biomeIndex, "OVERFITTING_ALERT", {}, "practice", false);
  coachingEngine.recordTelemetrySignal(playerId, biomeIndex, "OVERFITTING_ALERT", {}, "practice", false);

  const profile = coachingEngine.getOrCreateProfile(playerId, biomeIndex);
  assert.strictEqual(profile.consecutiveBossFailures, 3, "Profile should record 3 failures");
  assert.strictEqual(profile.overfittingAlertCount, 3, "Profile should record 3 overfitting alerts");
  console.log("  ✅ Struggle Signals Successfully Recorded in Telemetry Profile!");

  // 3. 3x Failure Bounded Envelope Calculation
  console.log("  3. Testing 3x failure bounded difficulty envelope modulation...");
  const adaptedEnvelope = coachingEngine.computeAdaptiveEnvelope(playerId, biomeIndex, {
    roomType: "practice",
    isRanked: false,
    runId: "RUN_PRACTICE_001"
  });
  assert.strictEqual(adaptedEnvelope.isAdapted, true, "Envelope should be adapted after 3 failures");
  assert.ok(adaptedEnvelope.modifiers.noiseScaleMultiplier <= 0.85, "Noise scale should be reduced");
  assert.ok(adaptedEnvelope.modifiers.noiseScaleMultiplier >= 0.75, "Noise scale must respect 0.75 hard minimum");
  assert.ok(adaptedEnvelope.modifiers.outlierScaleMultiplier <= 0.92, "Outlier scale should be reduced");
  assert.ok(adaptedEnvelope.modifiers.bossHpMultiplier <= 0.96, "Boss HP should be tuned");
  assert.ok(adaptedEnvelope.reasons.some(r => r.includes("STUCK_ON_BOSS_3X")), "Should cite 3x failure reason");
  console.log(`  ✅ Bounded Envelope Verified: Noise=${adaptedEnvelope.modifiers.noiseScaleMultiplier}, HP=${adaptedEnvelope.modifiers.bossHpMultiplier}`);

  // 4. Procedural Variant Generation with Bounded Adaptation & Solvability
  console.log("  4. Generating biome variant with adaptive modifiers and verifying mathematical solvability...");
  const seed = "NEURO-STRUGGLE-TEST";
  const baselineVariant = proceduralEngine.generateBiomeVariant(biomeIndex, seed);
  const adaptedVariant = proceduralEngine.generateBiomeVariant(biomeIndex, seed, 10, adaptedEnvelope.modifiers);

  assert.ok(adaptedVariant.solvabilityCertificate.isSolvable, "Adapted variant must remain 100% mathematically solvable");
  assert.ok(adaptedVariant.bossVariant.maxHp < baselineVariant.bossVariant.maxHp, "Adapted boss HP should be lower than baseline");
  console.log(`  ✅ Solvability Certificate Confirmed! (Boss HP: ${baselineVariant.bossVariant.maxHp} -> ${adaptedVariant.bossVariant.maxHp})`);

  // 5. Hard Non-Rubberbanding Bounds Clamp (Even with 20 failures)
  console.log("  5. Testing non-rubberbanding hard bounds under extreme struggle (20 failures)...");
  for (let i = 0; i < 17; i++) {
    coachingEngine.recordTelemetrySignal(playerId, biomeIndex, "BOSS_ATTEMPT_FAILED", {}, "practice", false);
  }
  const extremeEnvelope = coachingEngine.computeAdaptiveEnvelope(playerId, biomeIndex, { roomType: "practice" });
  assert.strictEqual(extremeEnvelope.modifiers.noiseScaleMultiplier, 0.75, "Noise scale must clamp at 0.75 (no auto-win)");
  assert.strictEqual(extremeEnvelope.modifiers.outlierScaleMultiplier, 0.70, "Outlier scale must clamp at 0.70 (never 0)");
  assert.strictEqual(extremeEnvelope.modifiers.bossHpMultiplier, 0.85, "Boss HP must clamp at 0.85");
  assert.strictEqual(extremeEnvelope.modifiers.bossDamageMultiplier, 0.85, "Boss Damage must clamp at 0.85");
  console.log("  ✅ Anti-Rubberbanding Hard Bounds Guarantee Verified!");

  // 6. Coaching Escalation: Opt-in Hint Tiers (Zero Spoilers)
  console.log("  6. Testing Coaching Escalation (Opt-in Hint Tier after >= 2 failures)...");
  // Before Opt-In: Offer available without spoilery text
  const hintOffer = coachingEngine.getCoachingHint(playerId, biomeIndex, false, { roomType: "practice" });
  assert.strictEqual(hintOffer.isAvailable, true);
  assert.strictEqual(hintOffer.optedIn, false);
  assert.strictEqual(hintOffer.hintText, undefined, "Hint text must not be sent before opt-in");

  // After Opt-In: Reveals diagnostic concept guidance (Biome 2: L2 Regularization / Weight Decay)
  const hintUnlocked = coachingEngine.getCoachingHint(playerId, biomeIndex, true, { roomType: "practice" });
  assert.strictEqual(hintUnlocked.isAvailable, true);
  assert.strictEqual(hintUnlocked.optedIn, true);
  assert.strictEqual(hintUnlocked.category, "REGULARIZATION");
  assert.strictEqual(hintUnlocked.conceptName, "L2 Ridge Penalty / Weight Decay");
  assert.strictEqual(hintUnlocked.isAnswerSpoiled, false);
  assert.ok(hintUnlocked.hintText.includes("L2 regularization"), "Hint should teach L2 regularization concept");
  console.log(`  ✅ Non-Spoilery Coaching Hint Unlocked: "${hintUnlocked.conceptName}"!`);

  // 7. Transparency Audit Log: "Why was this run easier?"
  console.log("  7. Testing player transparency audit logs ('Why was this run easier?')...");
  const auditLogs = coachingEngine.getTransparencyAuditLog(playerId);
  assert.ok(auditLogs.length > 0, "Audit logs must be recorded");
  const latestLog = auditLogs[0];
  assert.strictEqual(latestLog.playerId, playerId);
  assert.ok(latestLog.isAdapted);
  assert.ok(latestLog.explanation.includes("Difficulty envelope adjusted"));
  assert.ok(typeof latestLog.modifiers.noiseScaleMultiplier === "number");
  console.log(`  ✅ Transparency Audit Entry Verified: "${latestLog.explanation.slice(0, 70)}..."`);

  // 8. Server-Side Room-Type Guard: Strict Ranked / Duel Isolation
  console.log("  8. Testing server-side room-type guards (Rejection in DuelRoom and Ranked matches)...");
  
  // Test DuelRoom rejection on envelope
  assert.throws(() => {
    coachingEngine.computeAdaptiveEnvelope(playerId, biomeIndex, { roomType: "duel_room", isRanked: false });
  }, /ADAPTIVE_COACHING_FORBIDDEN_IN_RANKED/, "Must reject duel_room envelope requests");

  // Test Ranked match rejection on envelope
  assert.throws(() => {
    coachingEngine.computeAdaptiveEnvelope(playerId, biomeIndex, { roomType: "practice", isRanked: true });
  }, /ADAPTIVE_COACHING_FORBIDDEN_IN_RANKED/, "Must reject isRanked envelope requests");

  // Test DuelRoom rejection on hint
  assert.throws(() => {
    coachingEngine.getCoachingHint(playerId, biomeIndex, true, { roomType: "duel_room" });
  }, /ADAPTIVE_COACHING_FORBIDDEN_IN_RANKED/, "Must reject duel_room hint requests");

  // Test Telemetry signal rejection in ranked
  assert.throws(() => {
    coachingEngine.recordTelemetrySignal(playerId, biomeIndex, "BOSS_ATTEMPT_FAILED", {}, "duel_room", true);
  }, /ADAPTIVE_COACHING_FORBIDDEN_IN_RANKED/, "Must reject telemetry ingestion in ranked duel");

  console.log("  ✅ Server-Side Room Guard Authoritative Enforcement Verified!");
  console.log("🎉 All Adaptive Difficulty, Coaching Escalation & Transparency Tests Passed Cleanly!");
}

if (require.main === module) {
  runAdaptiveCoachingTests();
}

module.exports = {
  runAdaptiveCoachingTests
};

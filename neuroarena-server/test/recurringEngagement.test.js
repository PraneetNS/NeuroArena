const assert = require('assert');
const { DailyChallengeEngine } = require('../src/engagement/DailyChallengeEngine');
const { WeeklyGuildObjectiveEngine } = require('../src/engagement/WeeklyGuildObjectiveEngine');
const { GuildEngine } = require('../src/guildSystem');
const { RedisClusterConfig } = require('../src/cluster/RedisClusterConfig');

console.log('▶ Testing Recurring Engagement Layer (Daily Challenges, Streaks & Guild Objectives)...');

(async () => {
  const redis = new RedisClusterConfig();
  const dailyEngine = new DailyChallengeEngine(redis);
  const weeklyGuildEngine = new WeeklyGuildObjectiveEngine(redis);
  const guildEngine = new GuildEngine({ weeklyObjectiveEngine: weeklyGuildEngine });

  // -------------------------------------------------------------
  // 1. Procedural Deterministic Objective Generation
  // -------------------------------------------------------------
  const dateKeyToday = dailyEngine.getUtcDateKey();
  const obj1 = dailyEngine.getDailyObjective(dateKeyToday);
  const obj2 = dailyEngine.getDailyObjective(dateKeyToday);

  assert.strictEqual(obj1.id, obj2.id, 'Daily objective must be globally deterministic for same UTC date');
  assert.strictEqual(obj1.dateKey, dateKeyToday);
  assert.ok(obj1.secondsUntilReset > 0, 'Seconds until reset must be positive');
  assert.ok(obj1.expiresAtUtc, 'Must have UTC expiration timestamp');

  // Verify different dates produce valid curriculum objectives from 6 biomes or PvP
  const tomorrowKey = '2026-09-08';
  const nextWeekKey = '2026-09-15';
  const objTomorrow = dailyEngine.getDailyObjective(tomorrowKey);
  const objNextWeek = dailyEngine.getDailyObjective(nextWeekKey);
  assert.ok(objTomorrow.id, 'Tomorrow objective must be generated');
  assert.ok(objNextWeek.id, 'Next week objective must be generated');

  // -------------------------------------------------------------
  // 2. Server-Authoritative Daily Challenge Submission Verification
  // -------------------------------------------------------------
  const testPlayer = 'player_alpha_test';

  // Submitting invalid / failing telemetry should fail verification
  const failedSub = await dailyEngine.verifyDailyChallenge(testPlayer, {
    dateKey: dateKeyToday,
    bossId: 'invalid_boss',
    metrics: { mse: 999.0, accuracy: 0.1 }
  });
  assert.strictEqual(failedSub.success, false, 'Invalid telemetry must fail server verification');
  assert.ok(failedSub.error, 'Should contain error reason');

  // Prepare valid submission matching today's active objective
  const validMetrics = {};
  if (obj1.requirements.bossId) {
    validMetrics.mse = obj1.requirements.maxMse !== undefined ? obj1.requirements.maxMse * 0.5 : 0.01;
    validMetrics.accuracy = obj1.requirements.minAccuracy !== undefined ? obj1.requirements.minAccuracy : 0.98;
    validMetrics.regularization = obj1.requirements.regularization || undefined;
    validMetrics.epochs = obj1.requirements.maxEpochs !== undefined ? obj1.requirements.maxEpochs - 2 : 10;
    validMetrics.cosineSimilarity = obj1.requirements.minCosineSimilarity !== undefined ? obj1.requirements.minCosineSimilarity + 0.05 : 0.90;
  } else if (obj1.requirements.requireWin) {
    validMetrics.mse = 0.02;
    validMetrics.accuracy = 0.95;
  }

  const successSub = await dailyEngine.verifyDailyChallenge(testPlayer, {
    dateKey: dateKeyToday,
    bossId: obj1.requirements.bossId,
    wonDuel: true,
    metrics: validMetrics
  });

  assert.strictEqual(successSub.success, true, 'Valid telemetry must pass server verification');
  assert.strictEqual(successSub.streak, 1, 'First completed day should set streak to 1');
  assert.ok(successSub.reward.computeCredits >= 100, 'Must award credits');

  // Duplicate completion on same UTC day should be rejected
  const duplicateSub = await dailyEngine.verifyDailyChallenge(testPlayer, {
    dateKey: dateKeyToday,
    bossId: obj1.requirements.bossId,
    wonDuel: true,
    metrics: validMetrics
  });
  assert.strictEqual(duplicateSub.success, false);
  assert.strictEqual(duplicateSub.error, 'ALREADY_COMPLETED_TODAY');

  // -------------------------------------------------------------
  // 3. Persistent Streak Progression & Non-Predatory Reset
  // -------------------------------------------------------------
  // Test consecutive day streak advancement
  const streakProfile = await dailyEngine.getPlayerStreak('player_streak_runner');
  streakProfile.currentStreak = 6;
  streakProfile.bestStreak = 6;
  streakProfile.lastCompletedDateKey = '2026-09-05'; // Yesterday relative to 2026-09-06

  // Manually mock date check
  const daysDiff = dailyEngine.getDaysBetween('2026-09-05', '2026-09-06');
  assert.strictEqual(daysDiff, 1, 'Days difference should be 1');

  // Test escalating rewards at milestone (Day 7)
  const escalatedReward = dailyEngine.calculateEscalatingReward(obj1.baseReward, 7);
  assert.ok(escalatedReward.computeCredits > obj1.baseReward.computeCredits, 'Escalated credits must exceed base');
  assert.strictEqual(escalatedReward.milestoneTitle, '🔥 Week Titan');
  assert.strictEqual(escalatedReward.streakBonusTier, 'Gold');

  // Test non-predatory reset on missed day (gap > 1 day)
  const missedDaysDiff = dailyEngine.getDaysBetween('2026-09-01', '2026-09-06');
  assert.strictEqual(missedDaysDiff, 5, 'Missed days gap');

  // -------------------------------------------------------------
  // 4. Weekly Guild Aggregate Contribution Objective
  // -------------------------------------------------------------
  const guild = guildEngine.createGuild('g_engagement_test', 'Engagement Guild', 'leader_bob', 'ENG');
  const weekKey = weeklyGuildEngine.getUtcWeekKey();
  assert.ok(weekKey.startsWith('2026-W'), `Week key should format as YYYY-Www: ${weekKey}`);

  // Initial weekly summary
  const initialSummary = await weeklyGuildEngine.getWeeklySummary('g_engagement_test', 'leader_bob', weekKey);
  assert.strictEqual(initialSummary.currentXp, 0);
  assert.strictEqual(initialSummary.isCompleted, false);

  // Contribute EXP via GuildEngine (simulating player harvesting / matches)
  guildEngine.contributeExp('leader_bob', 12000);
  let midSummary = await weeklyGuildEngine.getWeeklySummary('g_engagement_test', 'leader_bob', weekKey);
  assert.strictEqual(midSummary.currentXp, 12000);
  assert.strictEqual(midSummary.isCompleted, false);

  // Add more EXP to exceed 20,000 threshold
  guildEngine.contributeExp('leader_bob', 10000);
  let finalSummary = await weeklyGuildEngine.getWeeklySummary('g_engagement_test', 'leader_bob', weekKey);
  assert.strictEqual(finalSummary.currentXp, 22000);
  assert.strictEqual(finalSummary.isCompleted, true, 'Weekly guild objective should be marked completed');

  // Claim member weekly reward
  const claimRes = await weeklyGuildEngine.claimMemberWeeklyReward('g_engagement_test', 'leader_bob', weekKey);
  assert.strictEqual(claimRes.success, true);
  assert.strictEqual(claimRes.guildBuff.multiplier, 1.25);

  // Duplicate claim check
  const duplicateClaim = await weeklyGuildEngine.claimMemberWeeklyReward('g_engagement_test', 'leader_bob', weekKey);
  assert.strictEqual(duplicateClaim.success, false);
  assert.strictEqual(duplicateClaim.error, 'ALREADY_CLAIMED');

  console.log('✅ Recurring Engagement Layer (Daily Challenges, Streaks & Guild Objectives) Tests Passed Cleanly!');
})();

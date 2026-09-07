const assert = require('assert');
const { AnalyticsIngestEngine } = require('../src/telemetry/AnalyticsIngestEngine');
const { ServerMetricsRegistry } = require('../src/metrics');

console.log('▶ Testing Privacy-Conscious Event Analytics Pipeline...');

// 1. Instantiate Clean Test Registry & Engine
const testMetrics = new ServerMetricsRegistry();
const engine = new AnalyticsIngestEngine();

// ==========================================
// TEST 1: Privacy & PII Sanitization
// ==========================================
console.log('  1. Testing Zero-PII sanitization & guest player anonymization...');
const taintedEvent = {
  eventName: 'session_start',
  email: 'player@example.com', // Tainted PII
  ip: '192.168.1.100',          // Tainted PII
  password: 'supersecretpassword', // Tainted PII
  isGuest: true,
  payload: {
    client_build: '2.0.0-web',
    email: 'nested_tainted@example.com'
  }
};

const sanitized = engine.sanitizeEvent(taintedEvent);
assert.strictEqual(sanitized.eventName, 'session_start');
assert.strictEqual(sanitized.isGuest, true);
assert.ok(sanitized.playerId.startsWith('anon_'), 'Guest player must be assigned an anonymous ID');
assert.ok(sanitized.sessionId.startsWith('sess_'), 'Session ID must be auto-generated');
assert.strictEqual(sanitized.email, undefined, 'PII email must be stripped');
assert.strictEqual(sanitized.ip, undefined, 'PII IP must be stripped');
assert.strictEqual(sanitized.password, undefined, 'PII password must be stripped');
assert.strictEqual(sanitized.payload.email, undefined, 'Nested PII email must be stripped');
console.log('  ✅ PII Sanitization & Anonymization Verified!');

// ==========================================
// TEST 2: Tutorial Funnel & Drop-Off Computation
// ==========================================
console.log('  2. Testing FTUE Tutorial Step Funnel & Drop-Off Analytics...');
engine.reset();

// Simulate 100 new players starting the tutorial
// 100 do step 1 (harvest)
// 80 do step 2 (live fit)
// 60 do step 3 (challenge)
// 50 reach first aha moment
// 45 fully complete tutorial (45% completion rate)
for (let i = 1; i <= 100; i++) {
  const pid = `test_player_${i}`;
  const sid = `test_session_${i}`;

  // Everyone starts
  engine.ingestEvent({
    eventName: 'session_start',
    playerId: pid,
    sessionId: sid,
    isGuest: true
  });

  // Step 1: 100 players
  engine.ingestEvent({
    eventName: 'tutorial_step_harvest_completed',
    playerId: pid,
    sessionId: sid,
    payload: { step_index: 1, step_name: 'harvest_crystal', duration_sec: 12.5 }
  });

  // Step 2: 80 players
  if (i <= 80) {
    engine.ingestEvent({
      eventName: 'tutorial_step_livefit_viewed',
      playerId: pid,
      sessionId: sid,
      payload: { step_index: 2, step_name: 'live_fit_preview', duration_sec: 8.2 }
    });
  }

  // Step 3: 60 players
  if (i <= 60) {
    engine.ingestEvent({
      eventName: 'tutorial_step_challenge_completed',
      playerId: pid,
      sessionId: sid,
      payload: { step_index: 3, step_name: 'mini_challenge_lab', duration_sec: 25.0 }
    });
  }

  // Step 4: 50 players reach aha
  if (i <= 50) {
    engine.ingestEvent({
      eventName: 'ftue_first_aha_reached',
      playerId: pid,
      sessionId: sid,
      payload: { step_index: 4, step_name: 'first_aha_moment', duration_sec: 45.0 }
    });
  }

  // Step 5: 45 players complete full tutorial
  if (i <= 45) {
    engine.ingestEvent({
      eventName: 'tutorial_completed',
      playerId: pid,
      sessionId: sid,
      payload: { status: 'success', total_duration_sec: 55.0 }
    });
  }
}

const funnelStats = engine.computeTutorialFunnel();
assert.strictEqual(funnelStats.totalStarters, 100, 'Total starters should be 100');
assert.strictEqual(funnelStats.completedTutorialCount, 45, 'Completed count should be 45');
assert.strictEqual(funnelStats.overallCompletionRate, 45.0, 'Overall completion rate should be 45.0%');

// Check step breakdown
assert.strictEqual(funnelStats.steps[0].playersCompleted, 100);
assert.strictEqual(funnelStats.steps[0].overallConversionRate, 100.0);
assert.strictEqual(funnelStats.steps[1].playersCompleted, 80);
assert.strictEqual(funnelStats.steps[1].overallConversionRate, 80.0);
assert.strictEqual(funnelStats.steps[1].dropOffRate, 20.0); // 100 -> 80 (20% drop)
assert.strictEqual(funnelStats.steps[2].playersCompleted, 60);
assert.strictEqual(funnelStats.steps[2].overallConversionRate, 60.0);
assert.strictEqual(funnelStats.steps[2].dropOffRate, 25.0); // 80 -> 60 (25% drop)
assert.strictEqual(funnelStats.steps[4].playersCompleted, 45);
assert.strictEqual(funnelStats.steps[4].overallConversionRate, 45.0);

console.log(`  ✅ Tutorial Funnel Calculation Verified! (Overall Conversion: ${funnelStats.overallCompletionRate}%)`);

// ==========================================
// TEST 3: D1 / D7 / D30 Player Retention Cohorts
// ==========================================
console.log('  3. Testing D1/D7/D30 Player Retention Cohort Calculation...');
engine.reset();

// Setup synthetic multi-day cohort:
// 10 players joined 2 days ago (Day -2)
// 6 of them returned on Day -1 (D1 retention = 60%)
// 10 players joined 8 days ago (Day -8)
// 4 returned on Day -1 (D7 retention = 40%)

const now = new Date();
const formatDate = (daysAgo) => {
  const d = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
  return d.toISOString();
};

// Cohort A: Joined 2 days ago (D1 eligible)
for (let i = 1; i <= 10; i++) {
  const pid = `cohort_d1_player_${i}`;
  // Day 0
  engine.ingestEvent({
    eventName: 'session_start',
    playerId: pid,
    sessionId: `sess_d0_${i}`,
    timestamp: formatDate(2)
  });

  // 6 of 10 return on Day 1
  if (i <= 6) {
    engine.ingestEvent({
      eventName: 'session_start',
      playerId: pid,
      sessionId: `sess_d1_${i}`,
      timestamp: formatDate(1) // 1 day after join
    });
  }
}

// Cohort B: Joined 8 days ago (D7 eligible)
for (let i = 1; i <= 10; i++) {
  const pid = `cohort_d7_player_${i}`;
  // Day 0
  engine.ingestEvent({
    eventName: 'session_start',
    playerId: pid,
    sessionId: `sess_d0_7_${i}`,
    timestamp: formatDate(8)
  });

  // 6 of 10 return on Day 1 (7 days ago)
  if (i <= 6) {
    engine.ingestEvent({
      eventName: 'session_start',
      playerId: pid,
      sessionId: `sess_d1_7_${i}`,
      timestamp: formatDate(7) // 1 day after Day -8 join
    });
  }

  // 4 of 10 return on Day 7 (which is 1 day ago)
  if (i <= 4) {
    engine.ingestEvent({
      eventName: 'session_start',
      playerId: pid,
      sessionId: `sess_d7_${i}`,
      timestamp: formatDate(1) // 7 days after Day -8 join
    });
  }
}

const retentionStats = engine.computeRetention();
assert.strictEqual(retentionStats.totalPlayers, 20);
assert.strictEqual(retentionStats.d1RetentionRate, 60.0, `D1 Retention rate must be 60.0% (got ${retentionStats.d1RetentionRate}%)`);
assert.strictEqual(retentionStats.d7RetentionRate, 40.0, `D7 Retention rate must be 40.0% (got ${retentionStats.d7RetentionRate}%)`);
console.log(`  ✅ Player Retention Verified! (D1: ${retentionStats.d1RetentionRate}%, D7: ${retentionStats.d7RetentionRate}%)`);

// ==========================================
// TEST 4: Biome-by-Biome Completion & Boss Win Rates
// ==========================================
console.log('  4. Testing Biome Progression & Boss Battle Telemetry...');
engine.reset();

// Biome 1: 50 enter, 40 complete (80% completion rate), 30 boss attempts, 24 boss wins (80% win rate)
for (let i = 1; i <= 50; i++) {
  const pid = `biome_p_${i}`;
  engine.ingestEvent({
    eventName: 'biome_enter',
    playerId: pid,
    payload: { biome_index: 0, biome_name: 'Linear Steppes' }
  });

  if (i <= 40) {
    engine.ingestEvent({
      eventName: 'biome_exit',
      playerId: pid,
      payload: { biome_index: 0, biome_name: 'Linear Steppes', completed: true, time_spent_sec: 120 }
    });
  }

  if (i <= 30) {
    engine.ingestEvent({
      eventName: 'boss_attempt',
      playerId: pid,
      payload: { biome_name: 'Linear Steppes', boss_id: 'boss_overfit_hydra', boss_name: 'Overfit Hydra' }
    });
  }

  if (i <= 24) {
    engine.ingestEvent({
      eventName: 'boss_result',
      playerId: pid,
      payload: { biome_name: 'Linear Steppes', boss_id: 'boss_overfit_hydra', won: true, duration_sec: 45.2, damage_dealt: 100 }
    });
  }
}

const biomes = engine.computeBiomeProgression();
const steppes = biomes.find(b => b.biomeName === 'Linear Steppes');
assert.ok(steppes, 'Linear Steppes stats must exist');
assert.strictEqual(steppes.playerEntries, 50);
assert.strictEqual(steppes.playerCompletions, 40);
assert.strictEqual(steppes.completionRate, 80.0);
assert.strictEqual(steppes.bossAttempts, 30);
assert.strictEqual(steppes.bossWins, 24);
assert.strictEqual(steppes.bossWinRate, 80.0);
console.log(`  ✅ Biome Progression Verified! (Completion: ${steppes.completionRate}%, Boss Win Rate: ${steppes.bossWinRate}%)`);

// ==========================================
// TEST 5: Crash & Unhandled Exception Telemetry
// ==========================================
console.log('  5. Testing Crash & Error Boundary Telemetry...');
engine.ingestEvent({
  eventName: 'crash_error',
  playerId: 'error_user_1',
  clientPlatform: 'unity',
  payload: {
    error_type: 'NullReferenceException',
    message: 'Object reference not set to an instance of an object',
    stack: 'at NeuroArena.Core.NeuralNetwork.Forward() in NeuralNetwork.cs:line 42'
  }
});

const summary = engine.getDashboardSummary();
assert.strictEqual(summary.summaryKpis.totalCrashesLogged, 1);
assert.strictEqual(summary.recentErrors[0].errorType, 'NullReferenceException');
assert.strictEqual(summary.recentErrors[0].platform, 'unity');
console.log('  ✅ Error Boundary Telemetry Verified!');

// ==========================================
// TEST 6: Batch Ingestion API Support
// ==========================================
console.log('  6. Testing Batch Ingestion API format...');
const batchResult = engine.ingestBatch([
  { eventName: 'duel_start', playerId: 'p1', payload: { match_id: 'm1', opponent_id: 'bot_1', is_bot: true } },
  { eventName: 'duel_result', playerId: 'p1', payload: { match_id: 'm1', outcome: 'win', rating_change: 25, duration_sec: 40 } },
  { eventName: 'reward_claim', playerId: 'p1', payload: { reward_id: 'rew_daily', reward_type: 'crystals', amount: 50 } },
  { eventName: 'purchase', playerId: 'p1', payload: { item_id: 'skin_neon', currency: 'crystals', price: 100, success: true } }
]);
assert.strictEqual(batchResult.ingested, 4);
console.log('  ✅ Batch Telemetry Ingestion Verified!');

// ==========================================
// TEST 7: Prometheus Metrics Formatter Validation
// ==========================================
console.log('  7. Testing Prometheus Metrics Output Format...');
const { metrics } = require('../src/metrics');
const promOutput = metrics.exportPrometheusFormat();
assert.ok(promOutput.includes('neuroarena_telemetry_events_total'), 'Prometheus output must include telemetry counter');
assert.ok(promOutput.includes('neuroarena_tutorial_steps_completed_total'), 'Prometheus output must include tutorial counter');
assert.ok(promOutput.includes('neuroarena_session_duration_seconds_bucket'), 'Prometheus output must include session histogram');
console.log('  ✅ Prometheus & OTel Metrics Format Verified!');

console.log('🎉 All Event Analytics Pipeline Tests Passed Cleanly!');

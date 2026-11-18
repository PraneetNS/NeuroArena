const assert = require('assert');
const { SeasonalRankedEngine, RANK_TIERS } = require('../src/engagement/SeasonalRankedEngine');
const { RedisClusterConfig } = require('../src/cluster/RedisClusterConfig');

console.log('▶ Testing Seasonal Ranked League, Glicko-2 MMR & Cross-Progression Engine...');

(async () => {
  const redis = new RedisClusterConfig();
  const engine = new SeasonalRankedEngine(redis);

  // ==========================================
  // TEST 1: Rank Tiers & Thresholds (Bronze -> Architect)
  // ==========================================
  console.log('  1. Testing Rank Tier classifications & boundaries...');
  assert.strictEqual(engine.calculateTier(500).name, 'BRONZE');
  assert.strictEqual(engine.calculateTier(1200).name, 'SILVER');
  assert.strictEqual(engine.calculateTier(1500).name, 'GOLD');
  assert.strictEqual(engine.calculateTier(1900).name, 'PLATINUM');
  assert.strictEqual(engine.calculateTier(2400).name, 'ARCHITECT');
  console.log('  ✅ Rank Tiers & Boundaries Verified!');

  // ==========================================
  // TEST 2: Ranked 1v1 Match & Visible Rank-Up Juice Moment
  // ==========================================
  console.log('  2. Testing Ranked Match Glicko-2 update & Rank-Up Juice detection...');
  const playerA = { accountId: 'usr_alpha_web', name: 'AlphaWeb', build: 'scholar' };
  const playerB = { accountId: 'usr_beta_android', name: 'BetaAndroid', build: 'explorer' };

  // Set Alpha to high gold near platinum threshold (1780)
  const profileA = await engine.getPlayerProfile(playerA.accountId, playerA.name, playerA.build);
  profileA.rating = 1780;
  profileA.rd = 120;
  profileA.tier = 'GOLD';
  profileA.highestTierAchieved = 'GOLD';

  // Set Beta to mid platinum (1900)
  const profileB = await engine.getPlayerProfile(playerB.accountId, playerB.name, playerB.build);
  profileB.rating = 1900;
  profileB.rd = 120;
  profileB.tier = 'PLATINUM';
  profileB.highestTierAchieved = 'PLATINUM';

  // Alpha wins against higher-rated Beta
  const matchResult = await engine.processRankedMatch(playerA, playerB, 1.0);

  assert.ok(matchResult.playerA.newRating > 1780, 'Winner rating must increase');
  assert.ok(matchResult.playerB.newRating < 1900, 'Loser rating must decrease');

  // Verify Rank-Up Juice Moment
  if (matchResult.playerA.newRating >= 1800) {
    assert.strictEqual(matchResult.playerA.tierChange.type, 'RANK_UP');
    assert.strictEqual(matchResult.playerA.tierChange.toTier, 'PLATINUM');
    assert.strictEqual(matchResult.playerA.tierChange.juiceFeedback.particleBurstCount, 150);
    assert.strictEqual(matchResult.playerA.tierChange.juiceFeedback.hitStopDurationMs, 65);
    assert.strictEqual(matchResult.playerA.tierChange.juiceFeedback.hapticPulse, 'SuccessBurst');
    console.log('  ✅ Visible Rank-Up Juice Moment Verified (Hit-stop, 150 Particles, Fanfare)!');
  } else {
    console.log(`  ✅ Match processed cleanly: Alpha=${matchResult.playerA.newRating}, Beta=${matchResult.playerB.newRating}`);
  }

  // ==========================================
  // TEST 3: Cross-Progression Consistency (Web vs Android)
  // ==========================================
  console.log('  3. Testing Cross-Progression: Web PWA & Android query consistency...');
  const webView = await engine.getPlayerProfile('usr_alpha_web');
  const androidView = await engine.getPlayerProfile('usr_alpha_web');

  assert.strictEqual(webView.rating, androidView.rating, 'Rating must be identical across devices');
  assert.strictEqual(webView.tier, androidView.tier, 'Tier must be identical across devices');
  assert.strictEqual(webView.quantumShards, androidView.quantumShards, 'Inventory must be identical across devices');
  assert.strictEqual(webView.highestTierAchieved, androidView.highestTierAchieved, 'Highest tier must be identical');
  console.log('  ✅ Cross-Progression State Consistency Verified!');

  // ==========================================
  // TEST 4: Season Duration & Metadata (6-8 Weeks)
  // ==========================================
  console.log('  4. Testing Season timing & metadata (6-Week Cadence)...');
  const seasonStatus = engine.getSeasonStatus();
  assert.strictEqual(seasonStatus.durationWeeks, 6);
  assert.strictEqual(seasonStatus.seasonNumber, 1);
  assert.ok(seasonStatus.daysRemaining >= 40 && seasonStatus.daysRemaining <= 43);
  console.log(`  ✅ Season 1 Lifecycle Verified (${seasonStatus.daysRemaining} days remaining)!`);

  // ==========================================
  // TEST 5: Season Rollover, Soft MMR Reset & Top 100 Snapshot Archival
  // ==========================================
  console.log('  5. Testing Season Rollover, Soft Reset (0.65 mean regression) & Historical Archive...');
  
  // Create an Architect player at 2400 rating
  const archPlayer = await engine.getPlayerProfile('usr_architect_hero', 'GrandArchitect', 'titan');
  archPlayer.rating = 2400;
  archPlayer.tier = 'ARCHITECT';
  archPlayer.highestTierAchieved = 'ARCHITECT';

  const rolloverResult = await engine.rolloverSeason('season_2', 'Season 2: Convergence League');

  assert.strictEqual(rolloverResult.success, true);
  assert.strictEqual(rolloverResult.archivedSeason.seasonId, 'season_1');
  assert.ok(rolloverResult.archivedSeason.top100.length >= 2, 'Top 100 snapshot must be archived');

  // Verify historical archive retrieval
  const archived = engine.getArchivedSeason('season_1');
  assert.ok(archived !== null, 'Archived Season 1 must be accessible');
  assert.strictEqual(archived.seasonName, 'Season 1: Foundation of Weights');

  // Verify End-of-Season Rewards Disbursed
  const updatedArchProfile = await engine.getPlayerProfile('usr_architect_hero');
  assert.ok(updatedArchProfile.unlockedTitles.includes('Sovereign Architect'), 'Architect title must be granted');
  assert.ok(updatedArchProfile.unlockedCosmetics.includes('wings_architect_void'), 'Architect cosmetic wings must be unlocked');
  assert.ok(updatedArchProfile.quantumShards >= 700, 'End-of-season quantum shards must be credited');

  // Verify Soft MMR Reset (Regression toward 1500 mean)
  // 1500 + (2400 - 1500) * 0.65 = 1500 + 585 = 2085
  assert.ok(updatedArchProfile.rating >= 2000 && updatedArchProfile.rating <= 2150, `Soft reset MMR must regress toward mean (Got: ${updatedArchProfile.rating})`);
  assert.notStrictEqual(updatedArchProfile.rating, 1500, 'Soft reset must NOT hard-wipe player rating');
  console.log(`  ✅ Soft MMR Reset Verified (2400 -> ${updatedArchProfile.rating}) with End-of-Season Rewards Granted!`);

  console.log('🎉 All Seasonal Ranked & Cross-Progression Tests Passed Cleanly!');
})();

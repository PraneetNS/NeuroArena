const assert = require('assert');
const { RemoteConfigEngine } = require('../src/engagement/RemoteConfigEngine');
const { RedisClusterConfig } = require('../src/cluster/RedisClusterConfig');

console.log('▶ Testing Live-Ops Remote Config, Balance Tuning & Rollback Engine...');

(async () => {
  const redis = new RedisClusterConfig();
  const remoteConfig = new RemoteConfigEngine(redis);

  // ==========================================
  // TEST 1: Initial Baseline Configuration
  // ==========================================
  console.log('  1. Testing initial baseline balance values (Schema v3)...');
  const config = await remoteConfig.getRemoteConfig();
  assert.strictEqual(config.version, 1);
  assert.strictEqual(config.schemaCompatibilityVersion, 3);
  assert.strictEqual(config.harvestBalance.baseYieldMultiplier, 1.0);
  assert.strictEqual(config.bossTuning.overfit_hydra.maxHp, 500);
  assert.strictEqual(config.dailyChallengeTuning.baseRewardCrystals, 150);
  assert.strictEqual(config.liveOpsEventSlot.active, false);
  console.log('  ✅ Baseline Configuration Verified!');

  // ==========================================
  // TEST 2: Dynamic Balance Tuning Push (<5 minutes / instantaneous)
  // ==========================================
  console.log('  2. Testing live numeric balance tuning push (Harvest 2.5x, Boss HP 750, Reward 250)...');
  const startTime = Date.now();
  const publishResult = await remoteConfig.publishConfig(
    {
      harvestBalance: { baseYieldMultiplier: 2.5 },
      bossTuning: { overfit_hydra: { maxHp: 750, attackDamage: 35 } },
      dailyChallengeTuning: { baseRewardCrystals: 250 }
    },
    'lead_designer',
    'Weekend balance tuning buff'
  );
  const elapsedMs = Date.now() - startTime;

  assert.strictEqual(publishResult.success, true);
  assert.strictEqual(publishResult.version, 2);
  assert.ok(elapsedMs < 100, `Balance update latency was ${elapsedMs}ms (<5min SLA)`);

  const updatedConfig = await remoteConfig.getRemoteConfig();
  assert.strictEqual(updatedConfig.version, 2);
  assert.strictEqual(updatedConfig.harvestBalance.baseYieldMultiplier, 2.5);
  assert.strictEqual(updatedConfig.bossTuning.overfit_hydra.maxHp, 750);
  assert.strictEqual(updatedConfig.dailyChallengeTuning.baseRewardCrystals, 250);
  console.log(`  ✅ Live Balance Update Verified in ${elapsedMs}ms!`);

  // ==========================================
  // TEST 3: Schema v3 Save-Compatibility Validation (Rejects Corrupt/Out-of-Bounds Configs)
  // ==========================================
  console.log('  3. Testing Schema v3 validation bounds to prevent save corruption...');

  // A. Negative harvest multiplier must be rejected
  assert.throws(() => {
    remoteConfig.validateConfigPayload({
      harvestBalance: { baseYieldMultiplier: -1.5 }
    });
  }, /Invalid harvestBalance\.baseYieldMultiplier/, 'Negative harvest multiplier must be rejected');

  // B. Impossible Boss HP must be rejected
  assert.throws(() => {
    remoteConfig.validateConfigPayload({
      bossTuning: { overfit_hydra: { maxHp: -500 } }
    });
  }, /Invalid bossTuning/, 'Negative boss HP must be rejected');

  // C. Negative crystal rewards must be rejected
  assert.throws(() => {
    remoteConfig.validateConfigPayload({
      dailyChallengeTuning: { baseRewardCrystals: -100 }
    });
  }, /Invalid dailyChallengeTuning/, 'Negative crystal rewards must be rejected');

  // D. Mismatched schema version must be rejected
  assert.throws(() => {
    remoteConfig.validateConfigPayload({
      schemaCompatibilityVersion: 999
    });
  }, /Schema version mismatch/, 'Mismatched schema version must be rejected');

  console.log('  ✅ Schema v3 Validation & Save Compatibility Protection Verified!');

  // ==========================================
  // TEST 4: Live-Ops Modifier Weekend Toggling
  // ==========================================
  console.log('  4. Testing 2x Modifier Weekend Live-Ops Flag Toggling...');
  const toggleResult = await remoteConfig.setLiveOpsModifier({
    active: true,
    title: '2x Harvest Yield & Compute Surge Weekend',
    multiplier: 2.0,
    rotatingBoss: 'The Overfit Colossus (Empowered)',
    bannerColor: '#F59E0B'
  });

  assert.strictEqual(toggleResult.success, true);
  assert.strictEqual(toggleResult.version, 3);

  const activeMod = await remoteConfig.getActiveModifier();
  assert.ok(activeMod !== null);
  assert.strictEqual(activeMod.active, true);
  assert.strictEqual(activeMod.multiplier, 2.0);
  console.log('  ✅ Live-Ops Modifier Toggle Verified!');

  // ==========================================
  // TEST 5: One-Action Rollback to Target Version
  // ==========================================
  console.log('  5. Testing 1-action rollback to Version 1 (Baseline)...');
  const rollbackResult = await remoteConfig.rollbackToVersion(1, 'lead_ops');

  assert.strictEqual(rollbackResult.success, true);
  assert.strictEqual(rollbackResult.rolledBackTo, 1);
  assert.strictEqual(rollbackResult.newVersion, 4);

  const rolledBackConfig = await remoteConfig.getRemoteConfig();
  assert.strictEqual(rolledBackConfig.version, 4);
  assert.strictEqual(rolledBackConfig.harvestBalance.baseYieldMultiplier, 1.0, 'Harvest multiplier should be rolled back to 1.0');
  assert.strictEqual(rolledBackConfig.bossTuning.overfit_hydra.maxHp, 500, 'Boss HP should be rolled back to 500');
  assert.strictEqual(rolledBackConfig.liveOpsEventSlot.active, false, 'Modifier slot should be rolled back to inactive');
  console.log('  ✅ 1-Action Rollback to Version 1 Verified!');

  // ==========================================
  // TEST 6: Version History Audit Trail
  // ==========================================
  console.log('  6. Testing version history audit trail...');
  const history = remoteConfig.getHistory();
  assert.ok(history.length >= 4, 'History must contain at least 4 version records');
  assert.strictEqual(history[0].version, 4);
  assert.ok(history[0].changeReason.includes('Rollback to Version 1'));
  console.log(`  ✅ Version History Audit Trail Verified (${history.length} snapshots recorded)!`);

  console.log('🎉 All Remote Config & Live-Ops Balance Tuning Tests Passed Cleanly!');
})();

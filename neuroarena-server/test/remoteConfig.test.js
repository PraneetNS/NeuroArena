const assert = require('assert');
const { RemoteConfigEngine } = require('../src/engagement/RemoteConfigEngine');
const { RedisClusterConfig } = require('../src/cluster/RedisClusterConfig');

console.log('▶ Testing Live-Ops Remote Config & Modifier Weekend Engine...');

(async () => {
  const redis = new RedisClusterConfig();
  const remoteConfig = new RemoteConfigEngine(redis);

  // 1. Initial Remote Config Fetch
  const config = await remoteConfig.getRemoteConfig();
  assert.strictEqual(config.version, 1);
  assert.strictEqual(config.featureFlags.dailyChallengesEnabled, true);
  assert.strictEqual(config.liveOpsEventSlot.active, false);

  // 2. Active Modifier should be null when inactive
  const initialMod = await remoteConfig.getActiveModifier();
  assert.strictEqual(initialMod, null, 'Inactive modifier should return null');

  // 3. Toggle Live-Ops Modifier in real time (<5 minutes / instantaneous)
  const startTime = Date.now();
  const toggleResult = await remoteConfig.setLiveOpsModifier({
    active: true,
    title: "2x Harvest Yield & Compute Surge Weekend",
    multiplier: 2.0,
    rotatingBoss: "The Overfit Colossus (Empowered)",
    bannerColor: "#F59E0B"
  });
  const elapsedMs = Date.now() - startTime;

  assert.strictEqual(toggleResult.success, true);
  assert.strictEqual(toggleResult.liveOpsEventSlot.active, true);
  assert.strictEqual(toggleResult.liveOpsEventSlot.multiplier, 2.0);
  assert.ok(elapsedMs < 100, `Toggle latency was ${elapsedMs}ms, well within 5-minute SLA`);

  // 4. Verify Active Modifier Query
  const activeMod = await remoteConfig.getActiveModifier();
  assert.ok(activeMod !== null, 'Active modifier must now be present');
  assert.strictEqual(activeMod.multiplier, 2.0);
  assert.strictEqual(activeMod.rotatingBoss, "The Overfit Colossus (Empowered)");

  // 5. Turn Modifier Off
  const turnOffResult = await remoteConfig.setLiveOpsModifier({ active: false });
  assert.strictEqual(turnOffResult.liveOpsEventSlot.active, false);
  const turnedOffMod = await remoteConfig.getActiveModifier();
  assert.strictEqual(turnedOffMod, null);

  console.log(`✅ Live-Ops Remote Config & Modifier Weekend Tests Passed Cleanly! (Toggled in ${elapsedMs}ms)`);
})();

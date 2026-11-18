const assert = require('assert');
const { SeededPRNG, ProceduralVariantEngine } = require('../src/ml/ProceduralVariantEngine');
const { DailyChallengeEngine } = require('../src/engagement/DailyChallengeEngine');

console.log('▶ Testing 6-Biome Procedural Variant, Dataset Solvability & Boss Move-Set Engine...');

(async () => {
  const engine = new ProceduralVariantEngine();
  const dailyEngine = new DailyChallengeEngine();

  // ==========================================
  // TEST 1: Seeded PRNG Determinism & Bit-Exact Replayability
  // ==========================================
  console.log('  1. Testing byte-identical determinism on identical seeds...');
  const seedA = "NEURO-8842";
  const seedB = "NEURO-8842";
  const seedC = "RANDOM-9999";

  const prng1 = new SeededPRNG(seedA);
  const prng2 = new SeededPRNG(seedB);
  const prng3 = new SeededPRNG(seedC);

  const seq1 = [prng1.next(), prng1.range(1, 10), prng1.int(10, 50), prng1.gaussian(0, 1)];
  const seq2 = [prng2.next(), prng2.range(1, 10), prng2.int(10, 50), prng2.gaussian(0, 1)];
  const seq3 = [prng3.next(), prng3.range(1, 10), prng3.int(10, 50), prng3.gaussian(0, 1)];

  assert.deepStrictEqual(seq1, seq2, "PRNG output must be byte-identical for identical seeds");
  assert.notDeepStrictEqual(seq1, seq3, "PRNG output must differ for different seeds");
  console.log('  ✅ Seeded PRNG Determinism Verified!');

  // ==========================================
  // TEST 2: Procedural Biome Variants across all 6 Biomes
  // ==========================================
  console.log('  2. Testing procedural variant generation across all 6 biomes...');
  for (let biomeIdx = 0; biomeIdx < 6; biomeIdx++) {
    const run1 = engine.generateBiomeVariant(biomeIdx, "TOURNAMENT-SEED-2026");
    const run2 = engine.generateBiomeVariant(biomeIdx, "TOURNAMENT-SEED-2026");

    const { generatedAtUtc: t1, ...data1 } = run1;
    const { generatedAtUtc: t2, ...data2 } = run2;

    assert.strictEqual(run1.biomeIndex, biomeIdx);
    assert.strictEqual(run1.success, true);
    assert.ok(run1.dataset.samples.length >= 8, `Biome ${biomeIdx} must contain empirical samples`);
    assert.deepStrictEqual(data1, data2, `Biome ${biomeIdx} must be byte-identical on replay`);
    assert.ok(run1.solvabilityCertificate.isSolvable, `Biome ${biomeIdx} must be certified mathematically solvable`);
  }
  console.log('  ✅ 6-Biome Curriculum Procedural Generation Verified!');

  // ==========================================
  // TEST 3: Mathematical Solvability & Target Loss Validation
  // ==========================================
  console.log('  3. Testing mathematical solvability bounds and target loss certification...');
  const steppesVariant = engine.generateBiomeVariant(0, "SOLVABILITY-TEST-SEED");
  assert.strictEqual(steppesVariant.solvabilityCertificate.isSolvable, true);
  assert.ok(steppesVariant.solvabilityCertificate.theoreticalMinMse <= 0.05, "Theoretical minimum MSE must be <= 0.05");
  assert.ok(steppesVariant.solvabilityCertificate.targetMseThreshold <= 0.08, "Target MSE threshold must be reachable");
  assert.ok(steppesVariant.dataset.parameters.noiseSigma <= 0.25, "Noise must remain within difficulty envelope");

  // Binary Marshlands classification separability check
  const marshlandsVariant = engine.generateBiomeVariant(1, "SEPARABILITY-TEST-SEED");
  assert.strictEqual(marshlandsVariant.solvabilityCertificate.isSolvable, true);
  assert.ok(marshlandsVariant.solvabilityCertificate.theoreticalAccuracy >= 0.90, "Theoretical accuracy must be >= 90%");
  console.log('  ✅ Mathematical Solvability & Loss Reachability Verified!');

  // ==========================================
  // TEST 4: Boss Stat & Move-Set Variants (2-3 Alternate Attack Patterns per Boss)
  // ==========================================
  console.log('  4. Testing boss move-set variation and stat tuning per seed...');
  const bossPatterns = new Set();
  const bossHps = new Set();

  for (let i = 0; i < 20; i++) {
    const v = engine.generateBiomeVariant(2, `BOSS-TEST-SEED-${i}`); // Biome 2: Overfit Colossus
    bossPatterns.add(v.bossVariant.selectedMoveSet.variantId);
    bossHps.add(v.bossVariant.maxHp);
    assert.strictEqual(v.bossVariant.bossId, 'overfit_colossus');
    assert.ok(v.bossVariant.maxHp >= 1350 && v.bossVariant.maxHp <= 1750, 'Boss HP must stay within +-15% envelope');
    assert.ok(v.bossVariant.attackDamage >= 55 && v.bossVariant.attackDamage <= 75, 'Boss Damage must stay within +-10% envelope');
  }

  assert.ok(bossPatterns.size >= 2, `Boss must exhibit multiple alternate move-sets (Found: ${bossPatterns.size})`);
  assert.ok(bossHps.size > 5, `Boss HP must dynamically vary with seed (Found: ${bossHps.size} distinct values)`);
  console.log(`  ✅ Boss Move-Set Variants Verified (${bossPatterns.size} distinct patterns observed)!`);

  // ==========================================
  // TEST 5: Poisson-Disc Terrain Scatter Layout Variation
  // ==========================================
  console.log('  5. Testing Poisson-disc terrain scatter parameter variation...');
  const terrain1 = engine.generateBiomeVariant(0, "SEED-ALPHA").terrainVariant;
  const terrain2 = engine.generateBiomeVariant(0, "SEED-BETA").terrainVariant;

  assert.strictEqual(terrain1.domainRadius, 40.0);
  assert.strictEqual(terrain1.exclusionZones.length, 3);
  assert.notStrictEqual(terrain1.poissonSeed, terrain2.poissonSeed, "Different seeds must generate different Poisson scatter seeds");
  console.log('  ✅ Poisson-Disc Terrain Layout Variation Verified!');

  // ==========================================
  // TEST 6: Daily Seed Synchronization Mode
  // ==========================================
  console.log('  6. Testing Daily Seed synchronization mode (DAILY-YYYYMMDD)...');
  const fixedDate = new Date('2026-09-08T12:00:00Z');
  const dailySeed = engine.getDailySeed(fixedDate);
  assert.strictEqual(dailySeed, 'DAILY-20260908');

  const player1Daily = engine.generateBiomeVariant(0, dailySeed);
  const player2Daily = engine.generateBiomeVariant(0, dailySeed);

  const { generatedAtUtc: p1Time, ...p1Data } = player1Daily;
  const { generatedAtUtc: p2Time, ...p2Data } = player2Daily;

  assert.deepStrictEqual(p1Data, p2Data, "All players on the same day must receive the exact identical daily variant");
  console.log(`  ✅ Daily Seed Mode Verified (${dailySeed})!`);

  console.log('🎉 All Procedural Biome Variant & Solvability Tests Passed Cleanly!');
})();

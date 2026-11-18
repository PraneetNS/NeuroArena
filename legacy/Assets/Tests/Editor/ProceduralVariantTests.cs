using System;
using NUnit.Framework;
using UnityEngine;
using NeuroArena.Core;

namespace NeuroArena.Tests
{
    public class ProceduralVariantTests
    {
        [Test]
        public void TestSeededPRNGDeterminism()
        {
            var prng1 = new ProceduralBiomeVariantGenerator.FastMulberryPRNG("NEURO-8842");
            var prng2 = new ProceduralBiomeVariantGenerator.FastMulberryPRNG("NEURO-8842");

            for (int i = 0; i < 20; i++)
            {
                Assert.AreEqual(prng1.Next(), prng2.Next(), 0.00001f, $"Step {i} must be identical across runs.");
            }
        }

        [Test]
        public void TestProceduralBiomeVariantsAcross6Biomes()
        {
            string seed = "DAILY-20260908";
            for (int biomeIndex = 0; biomeIndex < 6; biomeIndex++)
            {
                var variant1 = ProceduralBiomeVariantGenerator.Generate(biomeIndex, seed);
                var variant2 = ProceduralBiomeVariantGenerator.Generate(biomeIndex, seed);

                Assert.AreEqual(biomeIndex, variant1.biomeIndex);
                Assert.AreEqual(variant1.bossVariant.maxHp, variant2.bossVariant.maxHp);
                Assert.AreEqual(variant1.bossVariant.attackDamage, variant2.bossVariant.attackDamage);
                Assert.AreEqual(variant1.bossVariant.selectedMoveSet.variantId, variant2.bossVariant.selectedMoveSet.variantId);
                Assert.AreEqual(variant1.terrainVariant.poissonSeed, variant2.terrainVariant.poissonSeed);
                Assert.IsTrue(variant1.linearDataset.isCertifiedSolvable);
            }
        }

        [Test]
        public void TestBossMoveSetVariation()
        {
            var moveSets = new System.Collections.Generic.HashSet<string>();
            for (int i = 0; i < 15; i++)
            {
                var v = ProceduralBiomeVariantGenerator.Generate(2, $"BOSS_SEED_{i}");
                moveSets.Add(v.bossVariant.selectedMoveSet.variantId);
            }
            Assert.GreaterOrEqual(moveSets.Count, 2, "Boss must select multiple distinct move-set patterns across seeds.");
        }

        [Test]
        public void TestDailySeedFormat()
        {
            DateTime testDate = new DateTime(2026, 9, 8, 12, 0, 0, DateTimeKind.Utc);
            string dailySeed = ProceduralBiomeVariantGenerator.GetDailySeed(testDate);
            Assert.AreEqual("DAILY-20260908", dailySeed);
        }
    }
}

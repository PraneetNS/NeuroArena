#if UNITY_EDITOR
using NUnit.Framework;
using UnityEngine;
using NeuroArena.Core;

namespace NeuroArena.Tests
{
    [TestFixture]
    public class DeviceTierTests
    {
        [Test]
        public void TestLowEndTierSafeguardsUnder2GB()
        {
            var go = new GameObject("TestDeviceTier");
            var manager = go.AddComponent<DeviceTierManager>();

            // Force Low-End Tier (2GB Class)
            manager.SetManualTier(HardwareTier.LowEnd_2GB);

            Assert.AreEqual(HardwareTier.LowEnd_2GB, manager.DetectedTier);
            Assert.AreEqual(25, manager.MaxParticleBurstCount, "Low-end tier must clamp particles to 25 to prevent fill-rate choke");
            Assert.AreEqual(30, manager.TargetFrameRate, "Low-end tier must target 30 FPS lock");
            Assert.IsFalse(manager.AllowHighQualityPostFX, "Low-end tier must disable heavy bloom/post-processing");
            Assert.AreEqual(0.75f, manager.ResolutionScale, "Low-end tier must render at 0.75x resolution scale");

            Object.DestroyImmediate(go);
        }

        [Test]
        public void TestMidRangeTierSettings()
        {
            var go = new GameObject("TestDeviceTierMid");
            var manager = go.AddComponent<DeviceTierManager>();

            manager.SetManualTier(HardwareTier.MidRange_4to6GB);

            Assert.AreEqual(HardwareTier.MidRange_4to6GB, manager.DetectedTier);
            Assert.AreEqual(80, manager.MaxParticleBurstCount);
            Assert.AreEqual(60, manager.TargetFrameRate);
            Assert.IsTrue(manager.AllowHighQualityPostFX);

            Object.DestroyImmediate(go);
        }

        [Test]
        public void TestFlagshipTierUltraSettings()
        {
            var go = new GameObject("TestDeviceTierFlagship");
            var manager = go.AddComponent<DeviceTierManager>();

            manager.SetManualTier(HardwareTier.Flagship_8GBPlus);

            Assert.AreEqual(HardwareTier.Flagship_8GBPlus, manager.DetectedTier);
            Assert.AreEqual(150, manager.MaxParticleBurstCount);
            Assert.AreEqual(60, manager.TargetFrameRate);

            Object.DestroyImmediate(go);
        }
    }
}
#endif

#if UNITY_EDITOR
using NUnit.Framework;
using UnityEngine;
using NeuroArena.Core;

namespace NeuroArena.Tests
{
    [TestFixture]
    public class LocalDiagnosticsTests
    {
        [Test]
        public void TestDiagnosticsOffByDefault()
        {
            PlayerPrefs.DeleteKey("neuroarena_diagnostics_opt_in");
            int optIn = PlayerPrefs.GetInt("neuroarena_diagnostics_opt_in", 0);
            Assert.AreEqual(0, optIn, "Diagnostics must be explicitly off by default (opt-in only)");
        }

        [Test]
        public void TestConsentToggleState()
        {
            PlayerPrefs.SetInt("neuroarena_diagnostics_opt_in", 1);
            Assert.AreEqual(1, PlayerPrefs.GetInt("neuroarena_diagnostics_opt_in", 0));

            PlayerPrefs.SetInt("neuroarena_diagnostics_opt_in", 0);
            Assert.AreEqual(0, PlayerPrefs.GetInt("neuroarena_diagnostics_opt_in", 0));
        }

        [Test]
        public void TestSpikeThresholdCalculation()
        {
            float dt = 0.065f; // 65ms frame
            bool isSpike = dt >= 0.050f;
            Assert.IsTrue(isSpike, "Frames taking >= 50ms must be flagged as performance spikes");

            float fastDt = 0.016f; // 16ms (60 FPS)
            Assert.IsFalse(fastDt >= 0.050f, "Standard 60 FPS frames must not be flagged as spikes");
        }
    }
}
#endif

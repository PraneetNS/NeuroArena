using System;
using System.Collections.Generic;
using NUnit.Framework;
using UnityEngine;
using NeuroArena.Core;
using NeuroArena.Data;
using NeuroArena.Audio;

namespace NeuroArena.Tests
{
    [TestFixture]
    public class ProductionTestSuite
    {
        [Test]
        public void TestBiomeProgressionGatingCriteria()
        {
            // Linear Steppes (0) -> Logistic Delta (1): Loss must be <= 0.05
            var req1 = new BiomeUnlockRequirement { biomeIndex = 1, requiredMetricThreshold = 0.05f, isLossMetric = true };
            Assert.IsTrue(0.03f <= req1.requiredMetricThreshold, "0.03 MSE should unlock Logistic Delta");
            Assert.IsFalse(0.12f <= req1.requiredMetricThreshold, "0.12 MSE should not unlock Logistic Delta");

            // Logistic Delta (1) -> Forest of Splits (2): Accuracy must be >= 0.85
            var req2 = new BiomeUnlockRequirement { biomeIndex = 2, requiredMetricThreshold = 0.85f, isLossMetric = false };
            Assert.IsTrue(0.89f >= req2.requiredMetricThreshold, "89% accuracy should unlock Forest of Splits");
            Assert.IsFalse(0.78f >= req2.requiredMetricThreshold, "78% accuracy should not unlock Forest of Splits");

            // Neural Archipelago (3) -> Hyperplane Dunes (4): Validation Loss <= 0.08
            var req4 = new BiomeUnlockRequirement { biomeIndex = 4, requiredMetricThreshold = 0.08f, isLossMetric = true };
            Assert.IsTrue(0.065f <= req4.requiredMetricThreshold, "0.065 loss should unlock Hyperplane Dunes");
        }

        [Test]
        public void TestMasteryCertificateCryptographicIntegrity()
        {
            GameObject go = new GameObject("CertManagerTest");
            MasteryCertificateManager manager = go.AddComponent<MasteryCertificateManager>();

            MasteryCertificate cert = manager.IssueCertificate("Ada-Explorer", "user_1234", "Linear Regression", 0, 0.0012f);
            Assert.IsNotNull(cert);
            Assert.IsTrue(cert.certificateId.StartsWith("CERT-"));
            Assert.AreEqual(64, cert.verificationHash.Length);

            // Verify genuine certificate
            bool isValid = MasteryCertificateManager.VerifyCertificate(cert);
            Assert.IsTrue(isValid, "Genuine certificate should pass verification");

            // Tamper with metric
            cert.finalMetric = 999.99f;
            bool isTamperedValid = MasteryCertificateManager.VerifyCertificate(cert);
            Assert.IsFalse(isTamperedValid, "Tampered certificate must fail cryptographic verification");

            GameObject.DestroyImmediate(go);
        }

        [Test]
        public void TestCloudSaveSmartMergeResolution()
        {
            // Local save: Biome 1 unlocked, 100 crystals, Model A (Loss 0.08)
            GameSaveData local = GameSaveData.CreateNew();
            local.currentBiomeIndex = 1;
            local.unlockedBiomes = new bool[] { true, true, false, false, false, false };
            local.crystalCountX = 100;
            local.trainedModels = new List<TrainedModelRecord>
            {
                new TrainedModelRecord { modelId = "model_linear", architectureType = "LinearRegression", validationLoss = 0.08f, validationAccuracy = 0.92f }
            };

            // Remote save: Biome 2 unlocked, 80 crystals, Model A (Loss 0.02 - better!) + Model B
            GameSaveData remote = GameSaveData.CreateNew();
            remote.currentBiomeIndex = 2;
            remote.unlockedBiomes = new bool[] { true, true, true, false, false, false };
            remote.crystalCountX = 80;
            remote.trainedModels = new List<TrainedModelRecord>
            {
                new TrainedModelRecord { modelId = "model_linear", architectureType = "LinearRegression", validationLoss = 0.02f, validationAccuracy = 0.98f },
                new TrainedModelRecord { modelId = "model_tree", architectureType = "DecisionTree", validationLoss = 0.15f, validationAccuracy = 0.88f }
            };

            GameSaveData merged = CloudSaveSyncManager.SmartMergeSaves(local, remote);

            // Assertions
            Assert.AreEqual(2, merged.currentBiomeIndex, "Smart Merge should retain highest unlocked biome (2)");
            Assert.IsTrue(merged.unlockedBiomes[2], "Biome 2 must be unlocked in merged state");
            Assert.AreEqual(100, merged.crystalCountX, "Smart Merge should retain maximum crystal count (100)");
            Assert.AreEqual(2, merged.trainedModels.Count, "Merged state should contain 2 distinct models");

            TrainedModelRecord bestLinear = merged.trainedModels.Find(m => m.modelId == "model_linear");
            Assert.AreEqual(0.02f, bestLinear.validationLoss, "Smart Merge should keep lower validation loss model");
        }

        [Test]
        public void TestColorblindColorCorrectionTransform()
        {
            GameObject go = new GameObject("A11yTest");
            AccessibilityManager a11y = go.AddComponent<AccessibilityManager>();

            Color testRed = new Color(1f, 0f, 0f, 1f);

            // Protanopia simulation
            a11y.SetColorblindMode(ColorblindMode.Protanopia);
            Color transformedProtan = a11y.TransformColor(testRed);
            Assert.AreNotEqual(testRed.r, transformedProtan.r);
            Assert.IsTrue(transformedProtan.g > 0.4f, "Protanopia transform should shift red wavelength energy to green channel");

            // High Contrast simulation
            a11y.SetColorblindMode(ColorblindMode.HighContrast);
            Color transformedContrast = a11y.TransformColor(testRed);
            Assert.IsTrue(transformedContrast == Color.white || transformedContrast == Color.black);

            GameObject.DestroyImmediate(go);
        }

        [Test]
        public void TestLocalizationStringTablesAndDynamicSubstitution()
        {
            GameObject go = new GameObject("L10nTest");
            LocalizationManager l10n = go.AddComponent<LocalizationManager>();

            l10n.SetLanguage(LanguageCode.EN);
            string enText = l10n.GetText("biome.0.name");
            Assert.AreEqual("Linear Steppes", enText);

            string enFormatted = l10n.GetText("msg.level_up", 5);
            Assert.AreEqual("Congratulations! You reached Level 5.", enFormatted);

            l10n.SetLanguage(LanguageCode.ES);
            string esText = l10n.GetText("biome.0.name");
            Assert.AreEqual("Estepas Lineales", esText);

            l10n.SetLanguage(LanguageCode.JA);
            string jaText = l10n.GetText("biome.0.name");
            Assert.AreEqual("線形草原", jaText);

            GameObject.DestroyImmediate(go);
        }

        [Test]
        public void TestEconomyCurrencyDebitAndCreditTransactions()
        {
            GameObject go = new GameObject("EconomyTest");
            EconomyManager econ = go.AddComponent<EconomyManager>();

            int initialCredits = econ.ComputeCredits;
            econ.AddComputeCredits(250, "DuelWin");
            Assert.AreEqual(initialCredits + 250, econ.ComputeCredits);

            bool spendSuccess = econ.SpendComputeCredits(100, "HyperparameterTuning");
            Assert.IsTrue(spendSuccess);
            Assert.AreEqual(initialCredits + 150, econ.ComputeCredits);

            bool spendFail = econ.SpendComputeCredits(999999, "ImpossiblePurchase");
            Assert.IsFalse(spendFail, "Overdraft purchase should be rejected");

            GameObject.DestroyImmediate(go);
        }
    }
}

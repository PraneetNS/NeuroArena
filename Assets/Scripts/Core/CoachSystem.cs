using System;
using UnityEngine;
using NeuroArena.Data;

namespace NeuroArena.Core
{
    public struct CoachPreflightTip
    {
        public string biomeName;
        public string paradigmTitle;
        public string keyDataPrinciple;
        public string curationGuidance;
        public string whatToAvoid;
    }

    public struct CoachDiagnosisResult
    {
        public string failureCategory;
        public string computedDiagnosis;
        public string actionableRemedy;
        public string formulaQuote;
    }

    /// <summary>
    /// Persistent Coach System: Guides players before their first training run in each biome
    /// and provides computed, data-driven post-attempt failure diagnostics.
    /// </summary>
    public static class CoachSystem
    {
        public static readonly CoachPreflightTip[] BiomePreflightTips = new CoachPreflightTip[]
        {
            new CoachPreflightTip
            {
                biomeName = "Biome 1: Linear Steppes",
                paradigmTitle = "1D Continuous Linear Regression",
                keyDataPrinciple = "Wide Spatial Domain Coverage [Span >= 7.0]",
                curationGuidance = "Harvest feature crystals across the entire biome from far left (X = -4) to far right (X = +4) to ensure your model learns the true global slope.",
                whatToAvoid = "Avoid clustering all your samples in one narrow corner; models cannot extrapolate accurately into empty space."
            },
            new CoachPreflightTip
            {
                biomeName = "Biome 2: Binary Marshlands",
                paradigmTitle = "Logistic Regression & Sigmoid Classification",
                keyDataPrinciple = "50/50 Class Balance (Purple vs Azure)",
                curationGuidance = "Collect an equal quantity of Class 0 (Purple Spores) and Class 1 (Azure Spores) along the decision boundary.",
                whatToAvoid = "Avoid severe class imbalance (e.g. 90% Purple / 10% Azure); the model will simply predict the majority class and fail on the minority."
            },
            new CoachPreflightTip
            {
                biomeName = "Biome 3: Variance Tundra",
                paradigmTitle = "Polynomial Regression & Regularization (L1/L2)",
                keyDataPrinciple = "Validation Split & Complexity Discipline",
                curationGuidance = "Reserve at least 20% of your samples for validation snow echoes. Equip L2 Ridge runes to penalize large, erratic polynomial weights.",
                whatToAvoid = "Avoid using a degree-8 polynomial on only 5 training samples; high polynomial capacity will overfit noise and diverge on test curves."
            },
            new CoachPreflightTip
            {
                biomeName = "Biome 4: Branching Canopy",
                paradigmTitle = "Decision Trees & Bagging Ensembles",
                keyDataPrinciple = "Orthogonal Axis Cuts & Diverse Subsampling",
                curationGuidance = "Gather samples spanning multiple coordinate quadrants. Combine 5 bootstrapped trees into a Bagging Party for robust consensus.",
                whatToAvoid = "Avoid unpruned trees with depth > 6 on sparse data, which creates brittle single-sample leaves."
            },
            new CoachPreflightTip
            {
                biomeName = "Biome 5: Deep Citadel",
                paradigmTitle = "Multi-Layer Perceptron & Non-Linear Activation",
                keyDataPrinciple = "XOR Symmetry & Non-Linear Separability",
                curationGuidance = "Collect all 4 quadrants of the XOR manifold. Use ReLU/Tanh activations to bend decision boundaries around non-linear clusters.",
                whatToAvoid = "Avoid linear activations (y = w*x + b) for XOR puzzles; single-layer linear models cannot separate diagonal parity states."
            },
            new CoachPreflightTip
            {
                biomeName = "Biome 6: Semantic Expanse",
                paradigmTitle = "Vector Embeddings & Cosine Similarity",
                keyDataPrinciple = "Contextual Co-occurrence Windowing",
                curationGuidance = "Harvest related semantic runes (e.g. frost, ice, cold) in close proximity to maximize their continuous dot-product alignment.",
                whatToAvoid = "Avoid isolated concept tokens with zero co-occurrence context; vector arithmetic requires shared semantic manifolds."
            }
        };

        public static CoachPreflightTip GetTipForBiome(int biomeIndex)
        {
            int idx = Mathf.Clamp(biomeIndex, 0, BiomePreflightTips.Length - 1);
            return BiomePreflightTips[idx];
        }

        /// <summary>
        /// Reads actual Dataset Health, loss curves, and empirical metrics to generate a computed, non-scripted failure reason.
        /// </summary>
        public static CoachDiagnosisResult DiagnoseFailure(
            DatasetStatistics stats,
            DatasetHealthMetrics health,
            float trainLoss,
            float valLoss,
            int biomeIndex,
            string optimizerType)
        {
            // 1. Check for Optimizer Oscillation (e.g. Vanilla SGD on steep ravines)
            if (optimizerType == "SGD" && trainLoss > 1.2f)
            {
                return new CoachDiagnosisResult
                {
                    failureCategory = "Gradient Oscillation (SGD Step Instability)",
                    computedDiagnosis = $"Vanilla SGD bounced across steep coordinate canyon walls with unscaled gradients. Loss plateaued at J = {trainLoss:F3}.",
                    actionableRemedy = "Equip ⚡ RMSprop or 🔱 Adam in the Weapons Arsenal to adapt per-parameter learning rates and damp oscillations.",
                    formulaQuote = "w ← w - α·(∇J / (√v + ε))"
                };
            }

            // 2. Check for Overfitting (Low Train Loss, High Validation/Test Loss)
            if (trainLoss < 0.15f && valLoss > 1.20f)
            {
                return new CoachDiagnosisResult
                {
                    failureCategory = "Overfitting (High Variance)",
                    computedDiagnosis = $"Your model achieved near-perfect training loss (J_train = {trainLoss:F3}), but validation loss exploded to J_val = {valLoss:F3}. The model memorized training points rather than learning the underlying function.",
                    actionableRemedy = "Reduce polynomial degree, equip L2 Ridge Rune (λ = 0.10), or collect at least 4 more diverse samples across the biome.",
                    formulaQuote = "J_reg = J_train + λ·Σ(w_i²)"
                };
            }

            // 3. Check for Severe Outlier Corruption
            if (health.outlierCount >= 2)
            {
                return new CoachDiagnosisResult
                {
                    failureCategory = "Outlier Pull & Parameter Distortion",
                    computedDiagnosis = $"{health.outlierCount} extreme outlier token(s) corrupted your loss surface, pulling the fitted slope far away from the true relationship.",
                    actionableRemedy = "Discard the outlier points from your Data Satchel or harvest 5 clean feature crystals to dilute the anomaly.",
                    formulaQuote = "Cleanliness Score: " + health.cleanlinessScore.ToString("F0") + "%"
                };
            }

            // 4. Check for Severe Class Imbalance (Classification)
            if (stats.isClassification && Mathf.Abs(stats.class0Ratio - stats.class1Ratio) >= 0.45f)
            {
                float maj = Mathf.Max(stats.class0Ratio, stats.class1Ratio) * 100f;
                float min = Mathf.Min(stats.class0Ratio, stats.class1Ratio) * 100f;
                return new CoachDiagnosisResult
                {
                    failureCategory = "Class Imbalance Bias",
                    computedDiagnosis = $"Your dataset is severely imbalanced ({maj:F0}% vs {min:F0}%). The decision boundary shifted toward the majority class.",
                    actionableRemedy = "Collect more minority class spores until both classes reach roughly 50/50 balance in the Inventory Drawer.",
                    formulaQuote = "Balance Score: " + health.balanceScore.ToString("F0") + "%"
                };
            }

            // 5. Check for Narrow Feature Domain (Undercoverage)
            float domainSpan = stats.maxX - stats.minX;
            if (domainSpan < 4.0f && stats.sampleCount >= 3)
            {
                return new CoachDiagnosisResult
                {
                    failureCategory = "Narrow Domain Extrapolation Failure",
                    computedDiagnosis = $"Harvested data only spans [{stats.minX:F1}, {stats.maxX:F1}] (span = {domainSpan:F1}). The test distribution contains points outside this range where the model makes ungrounded extrapolations.",
                    actionableRemedy = "Travel to the outer edges of the biome to collect tokens at X < -3.0 and X > +3.0.",
                    formulaQuote = "Coverage Score: " + health.coverageScore.ToString("F0") + "%"
                };
            }

            // 6. Default Underfitting / Insufficient Samples
            return new CoachDiagnosisResult
            {
                failureCategory = "Underfitting / High Bias",
                computedDiagnosis = $"Both training loss (J = {trainLoss:F3}) and test error are high. The model lacks sufficient capacity or sample volume (N = {stats.sampleCount}).",
                actionableRemedy = "Harvest at least 6 paired tokens and consider increasing model capacity or training for more epochs.",
                formulaQuote = "J(w, b) = (1/2N)·Σ(y_hat - y)²"
            };
        }

        public enum ConsultTutorialStage
        {
            NotStarted,
            OpenVaultPrompt,
            PerformQueryPrompt,
            Completed
        }

        public static string GetConsultOnboardingDialogue(ConsultTutorialStage stage)
        {
            switch (stage)
            {
                case ConsultTutorialStage.OpenVaultPrompt:
                    return "Incredible victory, Architect! Your newly trained model is archived in the Vault. Let's inspect its inner mechanics! Tap 'MY MODELS' on your HUD.";
                case ConsultTutorialStage.PerformQueryPrompt:
                    return "Enter X = 8.5 to run genuine mathematical inference and observe how continuous functions extrapolate into uncharted territory!";
                case ConsultTutorialStage.Completed:
                    return "Notice how the model extends its straight line into empty space? That's Extrapolation Error in action! You now know how continuous models reason outside their data domain.";
                default:
                    return "";
            }
        }
    }
}

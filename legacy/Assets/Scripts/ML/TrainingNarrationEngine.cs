using System;
using UnityEngine;

namespace NeuroArena.ML
{
    public struct NarrationSnippet
    {
        public int epoch;
        public string category;
        public string plainEnglishText;
        public string telemetryBadge;
    }

    /// <summary>
    /// Pure C# Mathematical Narration Engine: Inspects live training telemetry
    /// at every epoch and computes real-time plain-English commentary grounded strictly in numbers.
    /// </summary>
    public static class TrainingNarrationEngine
    {
        public static NarrationSnippet GenerateEpochNarration(
            float currentW, float prevW,
            float currentB, float prevB,
            float currentLoss, float prevLoss,
            float trainLoss, float valLoss,
            float gradW, float prevGradW,
            int epoch)
        {
            float deltaW = currentW - prevW;
            float deltaB = currentB - prevB;
            float deltaLoss = prevLoss - currentLoss;
            float relLossDrop = prevLoss > 1e-6f ? deltaLoss / prevLoss : 0f;

            // 1. Initial Step / High Gradient Push (Epoch 1-5)
            if (epoch <= 5 && Mathf.Abs(deltaW) > 0.12f)
            {
                return new NarrationSnippet
                {
                    epoch = epoch,
                    category = "ROTATION",
                    plainEnglishText = $"The decision line is rotating rapidly (Δw = {(deltaW >= 0 ? "+" : "")}{deltaW:F2}) to align with the primary data slope.",
                    telemetryBadge = $"w = {currentW:F2}"
                };
            }

            // 2. Overfitting Divergence Detection (Validation error rising while training drops)
            if (valLoss > 0.60f && trainLoss < 0.20f && (valLoss - trainLoss) > 0.45f)
            {
                float gap = valLoss - trainLoss;
                return new NarrationSnippet
                {
                    epoch = epoch,
                    category = "OVERFITTING",
                    plainEnglishText = $"Overfitting starting: training error is low (J_train = {trainLoss:F3}) but validation error rose (J_val = {valLoss:F3}, gap = +{gap:F2}). Model is memorizing noise.",
                    telemetryBadge = $"Gap = +{gap:F2}"
                };
            }

            // 3. Gradient Sign Reversal / Oscillation Detection
            if (epoch > 5 && Mathf.Sign(gradW) != Mathf.Sign(prevGradW) && Mathf.Abs(gradW) > 0.25f)
            {
                return new NarrationSnippet
                {
                    epoch = epoch,
                    category = "OSCILLATION",
                    plainEnglishText = $"Gradient reversed sign (∇w = {prevGradW:F2} ➔ {gradW:F2}): the optimizer is bouncing across steep coordinate canyon walls.",
                    telemetryBadge = "Step Reversal"
                };
            }

            // 4. Bias / Vertical Translation Shift
            if (Mathf.Abs(deltaB) > 0.08f && Mathf.Abs(deltaW) < 0.05f)
            {
                return new NarrationSnippet
                {
                    epoch = epoch,
                    category = "TRANSLATION",
                    plainEnglishText = $"The intercept is shifting vertically (b = {(deltaB >= 0 ? "+" : "")}{deltaB:F2} ➔ {currentB:F2}) to center the average prediction on the target cluster.",
                    telemetryBadge = $"b = {currentB:F2}"
                };
            }

            // 5. Plateau / Diminishing Returns Detection
            if (epoch > 15 && relLossDrop < 0.005f && relLossDrop >= 0f)
            {
                return new NarrationSnippet
                {
                    epoch = epoch,
                    category = "PLATEAU",
                    plainEnglishText = $"Learning has plateaued: loss improved by only {deltaLoss:F4} (<0.5%) this epoch. Parameter step sizes are settling.",
                    telemetryBadge = $"ΔJ = -{deltaLoss:F4}"
                };
            }

            // 6. Optimal Stationary Convergence
            if (epoch > 20 && currentLoss < 0.08f && Mathf.Abs(gradW) < 0.05f)
            {
                return new NarrationSnippet
                {
                    epoch = epoch,
                    category = "CONVERGENCE",
                    plainEnglishText = $"Convergence achieved: gradient magnitude is near zero (|∇J| = {Mathf.Abs(gradW):F3}). Model has settled into a stable local minimum.",
                    telemetryBadge = $"J = {currentLoss:F4}"
                };
            }

            // 7. Standard Progressive Optimization Step
            return new NarrationSnippet
            {
                epoch = epoch,
                category = "STEP",
                plainEnglishText = $"Downhill step: loss reduced from {prevLoss:F3} to {currentLoss:F3} (ΔJ = -{deltaLoss:F3}) as parameters update along the negative gradient.",
                telemetryBadge = $"w = {currentW:F2}, b = {currentB:F2}"
            };
        }
    }
}

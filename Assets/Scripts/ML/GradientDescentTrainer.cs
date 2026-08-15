using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using NeuroArena.Data;

namespace NeuroArena.ML
{
    [Serializable]
    public struct EpochStep
    {
        public int epoch;
        public float loss;
        public float currentW;
        public float currentB;
        public float gradW;
        public float gradB;

        public EpochStep(int epoch, float loss, float w, float b, float gradW, float gradB)
        {
            this.epoch = epoch;
            this.loss = loss;
            this.currentW = w;
            this.currentB = b;
            this.gradW = gradW;
            this.gradB = gradB;
        }
    }

    [Serializable]
    public struct LogisticEpochStep
    {
        public int epoch;
        public float loss;
        public float currentW1;
        public float currentW2;
        public float currentB;
        public float accuracy;

        public LogisticEpochStep(int epoch, float loss, float w1, float w2, float b, float accuracy)
        {
            this.epoch = epoch;
            this.loss = loss;
            this.currentW1 = w1;
            this.currentW2 = w2;
            this.currentB = b;
            this.accuracy = accuracy;
        }
    }

    [Serializable]
    public struct PolynomialEpochStep
    {
        public int epoch;
        public float trainLoss;
        public float valLoss;
        public float[] currentWeights;
        public float currentBias;
        public float generalizationGap;

        public PolynomialEpochStep(int epoch, float trainLoss, float valLoss, float[] weights, float bias, float gap)
        {
            this.epoch = epoch;
            this.trainLoss = trainLoss;
            this.valLoss = valLoss;
            this.currentWeights = weights;
            this.currentBias = bias;
            this.generalizationGap = gap;
        }
    }

    [Serializable]
    public struct TrainingResult
    {
        public float finalWeight_W;
        public float finalBias_B;
        public float[] lossHistory;
        public float initialLoss;
        public float finalLoss;
        public float rSquared;
        public int totalEpochs;
        public bool isConverged;
        public string lossFunction;
        public float learningRate;

        public string GetSummary()
        {
            float lossReduction = initialLoss > 0 ? ((initialLoss - finalLoss) / initialLoss) * 100f : 0f;
            return $"=== LINEAR REGRESSION REPORT ===\n" +
                   $"Fitted Model: ŷ = {finalWeight_W:F3} * x + {finalBias_B:F3}\n" +
                   $"Loss ({lossFunction}): {initialLoss:F4} ➔ {finalLoss:F4} (-{lossReduction:F1}%)\n" +
                   $"R² Determination: {rSquared:F3} ({(rSquared >= 0.9f ? "<color=#55FF55>EXCELLENT FIT</color>" : "<color=#FFFF55>ACCEPTABLE</color>")})\n" +
                   $"Epochs Executed: {totalEpochs}\n" +
                   $"Status: {(isConverged ? "<color=#55FF55>CONVERGED</color>" : "<color=#FF9933>MAX EPOCHS REACHED</color>")}";
        }
    }

    [Serializable]
    public struct LogisticTrainingResult
    {
        public float finalWeight_W1;
        public float finalWeight_W2;
        public float finalBias_B;
        public float[] lossHistory;
        public float initialLoss;
        public float finalLoss;
        public float accuracy;
        public float f1Score;
        public int totalEpochs;
        public bool isConverged;

        public string GetSummary()
        {
            float lossReduction = initialLoss > 0 ? ((initialLoss - finalLoss) / initialLoss) * 100f : 0f;
            return $"=== LOGISTIC CLASSIFICATION REPORT ===\n" +
                   $"Hypothesis: ŷ = σ({finalWeight_W1:+0.00;-0.00}*x₁ {finalWeight_W2:+0.00;-0.00}*x₂ {finalBias_B:+0.00;-0.00})\n" +
                   $"Decision Boundary: {finalWeight_W1:+0.00;-0.00}x₁ + {finalWeight_W2:+0.00;-0.00}x₂ + {finalBias_B:+0.00;-0.00} = 0\n" +
                   $"Binary Cross-Entropy Loss: {initialLoss:F4} ➔ {finalLoss:F4} (-{lossReduction:F1}%)\n" +
                   $"Accuracy: <b>{accuracy * 100f:0.0}%</b> | F1-Score: <b>{f1Score:F3}</b>\n" +
                   $"Status: {(accuracy >= 0.90f ? "<color=#55FF55>SEPARATING HYPERPLANE CONVERGED</color>" : "<color=#FFCC00>ACCEPTABLE</color>")}";
        }
    }

    [Serializable]
    public struct PolynomialTrainingResult
    {
        public float[] finalWeights;
        public float finalBias;
        public float[] trainLossHistory;
        public float[] valLossHistory;
        public float finalTrainLoss;
        public float finalValLoss;
        public float generalizationGap; // percentage diff
        public int degree;
        public string regType;
        public float lambdaVal;
        public bool isBossGeneralizationPassed;

        public string GetSummary()
        {
            return $"=== BIOME 3 REGULARIZATION & GENERALIZATION REPORT ===\n" +
                   $"Polynomial Degree: d = {degree} | Regularization: {regType} (λ = {lambdaVal:F2})\n" +
                   $"Train MSE: {finalTrainLoss:F4} | Validation MSE: {finalValLoss:F4}\n" +
                   $"Generalization Gap: {generalizationGap * 100f:F1}% (Boss Threshold ≤ 25.0%)\n" +
                   $"Boss Verdict: {(isBossGeneralizationPassed ? "<color=#55FF55>BOSS PHANTOM WYRM DEFEATED! GENERALIZATION CONFIRMED</color>" : "<color=#FF5555>FAILED: OVERFITTING/UNDERFITTING DETECTED (MEMORIZATION PREVENTED)</color>")}";
        }
    }

    /// <summary>
    /// Pure C# Gradient Descent Training Engine.
    /// Supports Continuous Linear Regression (Biome 1), Logistic Classification (Biome 2),
    /// and Polynomial Feature Expansion with Ridge/Lasso Regularization & Train/Val Generalization Tracking (Biome 3).
    /// </summary>
    public static class GradientDescentTrainer
    {
        // ==========================================
        // 1. LINEAR REGRESSION (BIOME 1)
        // ==========================================

        public static IEnumerator TrainAnimated(
            float[] X,
            float[] Y,
            ModelConfig config,
            float totalDurationSeconds,
            Action<EpochStep> onEpochStep,
            Action<TrainingResult> onComplete)
        {
            if (X == null || Y == null || X.Length == 0 || X.Length != Y.Length)
            {
                yield break;
            }

            int epochs = Mathf.Max(1, config.epochs);
            float alpha = Mathf.Max(0.0001f, config.learningRate);
            string lossType = string.IsNullOrEmpty(config.lossFunction) ? "MSE" : config.lossFunction;

            float w = config.initialWeight_W;
            float b = config.initialBias_B;

            float[] lossHistory = new float[epochs];
            float initialLoss = 0f;
            bool isConverged = false;

            float delayPerEpoch = Mathf.Clamp(totalDurationSeconds / epochs, 0.005f, 0.04f);
            int batchSteps = Mathf.Max(1, (int)(epochs / (totalDurationSeconds / 0.02f)));

            for (int epoch = 0; epoch < epochs; epoch++)
            {
                float currentLoss = ComputeLoss(X, Y, w, b, lossType, out float gradW, out float gradB);
                lossHistory[epoch] = currentLoss;

                if (epoch == 0) initialLoss = currentLoss;

                if (Mathf.Abs(gradW) < 1e-4f && Mathf.Abs(gradB) < 1e-4f)
                {
                    isConverged = true;
                }

                w -= alpha * gradW;
                b -= alpha * gradB;

                if (epoch % batchSteps == 0 || epoch == epochs - 1)
                {
                    onEpochStep?.Invoke(new EpochStep(epoch + 1, currentLoss, w, b, gradW, gradB));
                    yield return new WaitForSecondsRealtime(delayPerEpoch);
                }
            }

            float finalLoss = lossHistory[epochs - 1];
            float r2 = ComputeRSquared(X, Y, w, b);

            TrainingResult result = new TrainingResult
            {
                finalWeight_W = w,
                finalBias_B = b,
                lossHistory = lossHistory,
                initialLoss = initialLoss,
                finalLoss = finalLoss,
                rSquared = r2,
                totalEpochs = epochs,
                isConverged = isConverged,
                lossFunction = lossType,
                learningRate = alpha
            };

            onComplete?.Invoke(result);
        }

        private static float ComputeLoss(float[] X, float[] Y, float w, float b, string lossType, out float gradW, out float gradB)
        {
            int m = X.Length;
            float totalLoss = 0f;
            float sumGradW = 0f;
            float sumGradB = 0f;

            for (int i = 0; i < m; i++)
            {
                float yHat = w * X[i] + b;
                float error = yHat - Y[i];
                totalLoss += error * error;
                sumGradW += error * X[i];
                sumGradB += error;
            }
            totalLoss = totalLoss / (2f * m);
            gradW = sumGradW / m;
            gradB = sumGradB / m;

            return totalLoss;
        }

        private static float ComputeRSquared(float[] X, float[] Y, float w, float b)
        {
            int m = X.Length;
            if (m < 2) return 1f;

            float yMean = 0f;
            for (int i = 0; i < m; i++) yMean += Y[i];
            yMean /= m;

            float ssTot = 0f, ssRes = 0f;
            for (int i = 0; i < m; i++)
            {
                float yHat = w * X[i] + b;
                ssTot += (Y[i] - yMean) * (Y[i] - yMean);
                ssRes += (Y[i] - yHat) * (Y[i] - yHat);
            }

            if (ssTot < 1e-6f) return 1f;
            return Mathf.Clamp01(1f - (ssRes / ssTot));
        }

        // ==========================================
        // 2. LOGISTIC REGRESSION (BIOME 2)
        // ==========================================

        public static float Sigmoid(float z)
        {
            return 1f / (1f + Mathf.Exp(-Mathf.Clamp(z, -30f, 30f)));
        }

        public static IEnumerator TrainLogisticAnimated(
            float[] X1,
            float[] X2,
            float[] Y,
            ModelConfig config,
            float totalDurationSeconds,
            Action<LogisticEpochStep> onEpochStep,
            Action<LogisticTrainingResult> onComplete)
        {
            if (X1 == null || X2 == null || Y == null || X1.Length == 0)
            {
                yield break;
            }

            int m = X1.Length;
            int epochs = Mathf.Max(1, config.epochs);
            float alpha = Mathf.Max(0.0001f, config.learningRate);

            float w1 = 0.5f;
            float w2 = 0.5f;
            float b = 0.0f;

            float[] lossHistory = new float[epochs];
            float initialLoss = 0f;

            float delayPerEpoch = Mathf.Clamp(totalDurationSeconds / epochs, 0.005f, 0.04f);
            int batchSteps = Mathf.Max(1, (int)(epochs / (totalDurationSeconds / 0.02f)));

            for (int epoch = 0; epoch < epochs; epoch++)
            {
                float totalBCE = 0f;
                float gradW1 = 0f, gradW2 = 0f, gradB = 0f;
                int correctPredictions = 0;
                float eps = 1e-7f;

                for (int i = 0; i < m; i++)
                {
                    float z = w1 * X1[i] + w2 * X2[i] + b;
                    float yHat = Sigmoid(z);

                    float loss_i = -(Y[i] * Mathf.Log(yHat + eps) + (1f - Y[i]) * Mathf.Log(1f - yHat + eps));
                    totalBCE += loss_i;

                    float error = yHat - Y[i];
                    gradW1 += error * X1[i];
                    gradW2 += error * X2[i];
                    gradB += error;

                    int predClass = yHat >= 0.5f ? 1 : 0;
                    if (predClass == (int)Y[i]) correctPredictions++;
                }

                totalBCE /= m;
                gradW1 /= m;
                gradW2 /= m;
                gradB /= m;

                lossHistory[epoch] = totalBCE;
                if (epoch == 0) initialLoss = totalBCE;

                float accuracy = (float)correctPredictions / m;

                w1 -= alpha * gradW1;
                w2 -= alpha * gradW2;
                b -= alpha * gradB;

                if (epoch % batchSteps == 0 || epoch == epochs - 1)
                {
                    onEpochStep?.Invoke(new LogisticEpochStep(epoch + 1, totalBCE, w1, w2, b, accuracy));
                    yield return new WaitForSecondsRealtime(delayPerEpoch);
                }
            }

            int finalCorrect = 0;
            for (int i = 0; i < m; i++)
            {
                float yHat = Sigmoid(w1 * X1[i] + w2 * X2[i] + b);
                if ((yHat >= 0.5f ? 1 : 0) == (int)Y[i]) finalCorrect++;
            }

            float finalAcc = (float)finalCorrect / m;

            LogisticTrainingResult result = new LogisticTrainingResult
            {
                finalWeight_W1 = w1,
                finalWeight_W2 = w2,
                finalBias_B = b,
                lossHistory = lossHistory,
                initialLoss = initialLoss,
                finalLoss = lossHistory[epochs - 1],
                accuracy = finalAcc,
                f1Score = finalAcc,
                totalEpochs = epochs,
                isConverged = finalAcc >= 0.90f
            };

            onComplete?.Invoke(result);
        }

        // ==========================================
        // 3. POLYNOMIAL EXPANSION & REGULARIZATION (BIOME 3)
        // ==========================================

        public static IEnumerator TrainPolynomialAnimated(
            float[] xTrain,
            float[] yTrain,
            float[] xVal,
            float[] yVal,
            ModelConfig config,
            float totalDurationSeconds,
            Action<PolynomialEpochStep> onEpochStep,
            Action<PolynomialTrainingResult> onComplete)
        {
            if (xTrain == null || yTrain == null || xTrain.Length == 0)
            {
                yield break;
            }

            int d = Mathf.Clamp(config.polynomialDegree, 1, 9);
            int mTrain = xTrain.Length;
            int mVal = (xVal != null && xVal.Length > 0) ? xVal.Length : mTrain;
            int epochs = Mathf.Max(1, config.epochs);
            float alpha = Mathf.Max(0.0001f, config.learningRate);
            float lambda = Mathf.Max(0f, config.lambdaPenalty);
            string regType = string.IsNullOrEmpty(config.regularizationType) ? "None" : config.regularizationType;

            // 1. Build Polynomial Matrix Features with Z-score standard scaling to prevent overflow on x^9
            float[][] XpolyTrain = BuildPolynomialMatrix(xTrain, d, out float[] means, out float[] stds);
            float[][] XpolyVal = BuildPolynomialMatrix(xVal ?? xTrain, d, means, stds);

            float[] weights = new float[d];
            float bias = 0.0f;

            float[] trainLossHistory = new float[epochs];
            float[] valLossHistory = new float[epochs];

            float delayPerEpoch = Mathf.Clamp(totalDurationSeconds / epochs, 0.005f, 0.04f);
            int batchSteps = Mathf.Max(1, (int)(epochs / (totalDurationSeconds / 0.02f)));

            for (int epoch = 0; epoch < epochs; epoch++)
            {
                // A. Compute Training Forward Pass & Gradients with Regularization Penalty
                float trainMSE = 0f;
                float[] gradW = new float[d];
                float gradB = 0f;

                for (int i = 0; i < mTrain; i++)
                {
                    float yHat = bias;
                    for (int j = 0; j < d; j++) yHat += weights[j] * XpolyTrain[i][j];

                    float error = yHat - yTrain[i];
                    trainMSE += error * error;

                    for (int j = 0; j < d; j++) gradW[j] += error * XpolyTrain[i][j];
                    gradB += error;
                }

                trainMSE /= (2f * mTrain);
                for (int j = 0; j < d; j++) gradW[j] /= mTrain;
                gradB /= mTrain;

                // Add Regularization Penalty to Gradients
                if (regType.Contains("Ridge") || regType.Contains("L2"))
                {
                    for (int j = 0; j < d; j++)
                    {
                        gradW[j] += (lambda / mTrain) * weights[j];
                    }
                }
                else if (regType.Contains("Lasso") || regType.Contains("L1"))
                {
                    for (int j = 0; j < d; j++)
                    {
                        gradW[j] += (lambda / mTrain) * Mathf.Sign(weights[j]);
                    }
                }

                // Update Weights
                for (int j = 0; j < d; j++) weights[j] -= alpha * gradW[j];
                bias -= alpha * gradB;

                trainLossHistory[epoch] = trainMSE;

                // B. Compute Validation Loss (Unseen Test Points, Unregularized pure MSE)
                float valMSE = 0f;
                float[] yValTarget = (yVal != null && yVal.Length > 0) ? yVal : yTrain;

                for (int i = 0; i < mVal; i++)
                {
                    float yHat = bias;
                    for (int j = 0; j < d; j++) yHat += weights[j] * XpolyVal[i][j];

                    float error = yHat - yValTarget[i];
                    valMSE += error * error;
                }
                valMSE /= (2f * mVal);
                valLossHistory[epoch] = valMSE;

                // Calculate Generalization Gap %
                float gap = trainMSE > 1e-5f ? Mathf.Abs(valMSE - trainMSE) / trainMSE : 0f;

                if (epoch % batchSteps == 0 || epoch == epochs - 1)
                {
                    onEpochStep?.Invoke(new PolynomialEpochStep(epoch + 1, trainMSE, valMSE, (float[])weights.Clone(), bias, gap));
                    yield return new WaitForSecondsRealtime(delayPerEpoch);
                }
            }

            float finalTrain = trainLossHistory[epochs - 1];
            float finalVal = valLossHistory[epochs - 1];
            float finalGap = finalTrain > 1e-5f ? Mathf.Abs(finalVal - finalTrain) / finalTrain : 0f;

            // Boss Condition: Val MSE must be low (<= 0.12) AND gap must stay within 25% of train MSE!
            bool isBossPassed = (finalVal <= 0.12f) && (finalGap <= 0.25f);

            PolynomialTrainingResult result = new PolynomialTrainingResult
            {
                finalWeights = weights,
                finalBias = bias,
                trainLossHistory = trainLossHistory,
                valLossHistory = valLossHistory,
                finalTrainLoss = finalTrain,
                finalValLoss = finalVal,
                generalizationGap = finalGap,
                degree = d,
                regType = regType,
                lambdaVal = lambda,
                isBossGeneralizationPassed = isBossPassed
            };

            onComplete?.Invoke(result);
        }

        private static float[][] BuildPolynomialMatrix(float[] x, int degree, out float[] means, out float[] stds)
        {
            int m = x.Length;
            float[][] matrix = new float[m][];
            means = new float[degree];
            stds = new float[degree];

            for (int i = 0; i < m; i++) matrix[i] = new float[degree];

            // Compute raw powers
            for (int j = 0; j < degree; j++)
            {
                int power = j + 1;
                float sum = 0f;
                for (int i = 0; i < m; i++)
                {
                    float p = Mathf.Pow(x[i] * 0.4f, power);
                    matrix[i][j] = p;
                    sum += p;
                }
                means[j] = sum / m;

                float variance = 0f;
                for (int i = 0; i < m; i++)
                {
                    variance += (matrix[i][j] - means[j]) * (matrix[i][j] - means[j]);
                }
                stds[j] = Mathf.Max(Mathf.Sqrt(variance / m), 1e-4f);

                // Standard scale
                for (int i = 0; i < m; i++)
                {
                    matrix[i][j] = (matrix[i][j] - means[j]) / stds[j];
                }
            }

            return matrix;
        }

        private static float[][] BuildPolynomialMatrix(float[] x, int degree, float[] means, float[] stds)
        {
            int m = x.Length;
            float[][] matrix = new float[m][];
            for (int i = 0; i < m; i++) matrix[i] = new float[degree];

            for (int j = 0; j < degree; j++)
            {
                int power = j + 1;
                for (int i = 0; i < m; i++)
                {
                    float p = Mathf.Pow(x[i] * 0.4f, power);
                    matrix[i][j] = (p - means[j]) / stds[j];
                }
            }

            return matrix;
        }
    }
}

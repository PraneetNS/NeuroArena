using System;
using UnityEngine;

namespace NeuroArena.Data
{
    /// <summary>
    /// Captures the complete model specification, formula, hyperparameters,
    /// polynomial capacity (degrees 1-9), and L1/L2 regularization penalties.
    /// </summary>
    [Serializable]
    public struct ModelConfig
    {
        public string modelName;
        public string formulaExpression;
        public string lossFunction;
        public float learningRate;
        public int epochs;
        public float initialWeight_W;
        public float initialBias_B;

        // Biome 3: Capacity & Regularization
        public int polynomialDegree;           // 1 to 9
        public string regularizationType;      // "None", "Ridge_L2", "Lasso_L1"
        public float lambdaPenalty;            // lambda in [0.0, 10.0]
        public float trainValSplitRatio;       // e.g. 0.70 (70% train, 30% val)

        public bool isLockedAndValid;
        public string timestamp;

        public static ModelConfig DefaultLinearRegression => new ModelConfig
        {
            modelName = "LinearRegression_V1",
            formulaExpression = "y = w * x + b",
            lossFunction = "MSE",
            learningRate = 0.02f,
            epochs = 100,
            initialWeight_W = 0.0f,
            initialBias_B = 0.0f,
            polynomialDegree = 1,
            regularizationType = "None",
            lambdaPenalty = 0.0f,
            trainValSplitRatio = 0.75f,
            isLockedAndValid = true,
            timestamp = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss")
        };

        public static ModelConfig DefaultPolynomialRegression => new ModelConfig
        {
            modelName = "PolynomialRegularized_Biome3",
            formulaExpression = "y = w0 + w1*x + w2*x^2 + ... + wd*x^d",
            lossFunction = "MSE",
            learningRate = 0.03f,
            epochs = 120,
            initialWeight_W = 0.0f,
            initialBias_B = 0.0f,
            polynomialDegree = 4,
            regularizationType = "Ridge_L2",
            lambdaPenalty = 0.5f,
            trainValSplitRatio = 0.70f,
            isLockedAndValid = true,
            timestamp = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss")
        };

        public string ToSummaryString()
        {
            return $"Model: {modelName}\n" +
                   $"Expression: {formulaExpression}\n" +
                   $"Polynomial Degree: {polynomialDegree}\n" +
                   $"Regularization: {regularizationType} (λ = {lambdaPenalty:F3})\n" +
                   $"Loss Function: {lossFunction}\n" +
                   $"Learning Rate (α): {learningRate:F4} | Epochs: {epochs}\n" +
                   $"Status: {(isLockedAndValid ? "<color=#55FF55>READY FOR TRAINING</color>" : "<color=#FF5555>INVALID</color>")}";
        }

        public string ToJson()
        {
            return JsonUtility.ToJson(this, true);
        }
    }
}

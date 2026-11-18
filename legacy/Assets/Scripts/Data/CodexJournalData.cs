using System;
using System.Collections.Generic;
using UnityEngine;

namespace NeuroArena.Data
{
    [Serializable]
    public class CodexEntry
    {
        public int biomeIndex;
        public string title;
        public string subtitle;
        public string mathematicalFormulation;
        public string plainEnglishExplanation;
        public string practicalApplications;
        public string masterySkinName;
        public bool isUnlocked;
    }

    /// <summary>
    /// Master Curriculum Database for the Codex / Journal.
    /// Provides exact mathematical formulas and plain-English explanations for all 6 biomes.
    /// </summary>
    public static class CodexCurriculumDatabase
    {
        public static List<CodexEntry> GetCurriculumEntries()
        {
            return new List<CodexEntry>
            {
                new CodexEntry
                {
                    biomeIndex = 0,
                    title = "Linear Regression & Gradient Descent",
                    subtitle = "Biome 1: The Linear Steppes",
                    mathematicalFormulation = "Hypothesis: y = w·x + b\nMSE Loss: J(w, b) = (1/2N) ∑ (ŷᵢ - yᵢ)²\nGradient: ∂J/∂w = (1/N) ∑ (ŷᵢ - yᵢ)·xᵢ\nUpdate Rule: w ← w - η·(∂J/∂w)",
                    plainEnglishExplanation = "Draws the single best straight line through scattered data points by measuring how far off the line's predictions are (the Mean Squared Error), and nudging the slope and offset downhill against the slope of the error surface.",
                    practicalApplications = "Stock price forecasting, real estate valuations, trend analysis, physical simulation calibration.",
                    masterySkinName = "Obsidian Gradient",
                    isUnlocked = true
                },
                new CodexEntry
                {
                    biomeIndex = 1,
                    title = "Logistic Classification & Sigmoid Gate",
                    subtitle = "Biome 2: The Binary Marshlands",
                    mathematicalFormulation = "Sigmoid Gate: σ(z) = 1 / (1 + e⁻ᶻ), where z = w·x + b\nBinary Cross-Entropy Loss:\nJ(w, b) = - (1/N) ∑ [ yᵢ ln(ŷᵢ) + (1 - yᵢ) ln(1 - ŷᵢ) ]",
                    plainEnglishExplanation = "Squashes linear outputs into a continuous probability between 0% and 100%. If probability ≥ 0.50, the sample belongs to Class 1; otherwise, Class 0. Separates classes via a glowing decision hyperplane.",
                    practicalApplications = "Spam detection, medical disease diagnosis, fraud detection, pass/fail quality assurance.",
                    masterySkinName = "Bioluminescent Neon",
                    isUnlocked = false
                },
                new CodexEntry
                {
                    biomeIndex = 2,
                    title = "Polynomial Features & Ridge/Lasso Regularization",
                    subtitle = "Biome 3: The Variance Tundra",
                    mathematicalFormulation = "Expansion: Φ(x) = [1, x, x², ..., xᵈ]\nRidge (L₂ Penalty): J(w) = MSE + λ ∑ wⱼ²\nLasso (L₁ Penalty): J(w) = MSE + λ ∑ |wⱼ|",
                    plainEnglishExplanation = "Expands a single feature into higher-order curves (degrees 1-9) to fit complex terrain. Regularization introduces a budget penalty (λ) that penalizes overly wild polynomial oscillations, preventing overfitting on unseen test data.",
                    practicalApplications = "Atmospheric climate modeling, automated feature selection, robotic trajectory smoothing.",
                    masterySkinName = "Glacial Crystalline",
                    isUnlocked = false
                },
                new CodexEntry
                {
                    biomeIndex = 3,
                    title = "Recursive Decision Trees & Information Gain",
                    subtitle = "Biome 4: The Branching Canopy",
                    mathematicalFormulation = "Gini Impurity: I(S) = 1 - ∑ pₖ²\nEntropy: H(S) = - ∑ pₖ log₂(pₖ)\nSplit Gain: ΔI = I(Parent) - (N_L/N)·I(Left) - (N_R/N)·I(Right)",
                    plainEnglishExplanation = "Constructs a flowchart of threshold questions (e.g. Is height > 1.2m?). At each fork, it finds the exact cut that isolates distinct classes with maximum purity, carving out orthogonal decision regions across the landscape.",
                    practicalApplications = "Credit scoring, medical triage flowcharts, customer churn segmentation, game AI behavior trees.",
                    masterySkinName = "Verdant Canopy",
                    isUnlocked = false
                },
                new CodexEntry
                {
                    biomeIndex = 4,
                    title = "Multi-Layer Perceptrons & Analytical Backprop",
                    subtitle = "Biome 5: The Deep Synapse Citadel",
                    mathematicalFormulation = "Forward: a⁽¹⁾ = ReLU(W⁽¹⁾x + b⁽¹⁾), ŷ = σ(W⁽²⁾a⁽¹⁾ + b⁽²⁾)\nOutput Delta: δ⁽²⁾ = (ŷ - y)\nHidden Delta: δ⁽¹⁾ = (W⁽²⁾ᵀ δ⁽²⁾) ⊙ ReLU'(z⁽¹⁾)\nWeight Gradient: ∂J/∂W⁽¹⁾ = δ⁽¹⁾ (x)ᵀ",
                    plainEnglishExplanation = "Chains hidden layers of artificial neurons together with non-linear activation gates (ReLU/Tanh). Backpropagation propagates errors backward layer-by-layer via the calculus chain rule, enabling networks to bend around non-linear XOR paradoxes.",
                    practicalApplications = "Computer vision, speech recognition, autonomous vehicle perception, neural game agents.",
                    masterySkinName = "Cyber-Matrix",
                    isUnlocked = false
                },
                new CodexEntry
                {
                    biomeIndex = 5,
                    title = "Word Embeddings, PPMI & Cosine Retrieval",
                    subtitle = "Biome 6: The Semantic Expanse",
                    mathematicalFormulation = "PPMI: max(0, log₂[ P(w, c) / (P(w)·P(c)) ])\nCosine Similarity: Sim(u, v) = (u · v) / (‖u‖ · ‖v‖)\nVector Analogy: v_target = v_A - v_B + v_C",
                    plainEnglishExplanation = "Transforms discrete text tags into continuous spatial coordinates where geometric closeness encodes semantic meaning. Powers modern vector search, analogy reasoning (King - Man + Woman = Queen), and RAG LLM retrieval.",
                    practicalApplications = "RAG search engines, semantic recommendation systems, semantic code search, language translation.",
                    masterySkinName = "Astral Hologram",
                    isUnlocked = false
                }
            };
        }
    }
}

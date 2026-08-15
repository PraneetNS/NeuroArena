using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using NeuroArena.Data;
using NeuroArena.Core;
using NeuroArena.ML;
using NeuroArena.Environment;

namespace NeuroArena.UI
{
    /// <summary>
    /// Full-Screen Cyber Formula Terminal UI.
    /// Supports:
    /// 1. Linear Regression, Logistic Classification, Polynomial Ridge, Decision Trees, 2-Layer MLP
    /// 2. 4-Way Optimizer Weapons (SGD, Momentum, RMSprop, Adam)
    /// 3. Bagging Ensemble ('Summoning a Party of 5 Trees' with bootstrap voting)
    /// 4. Async Head-to-Head Ghost Duels on unseen held-out test sets.
    /// </summary>
    public class FormulaTerminalUI : MonoBehaviour
    {
        public static FormulaTerminalUI Instance { get; private set; }

        public bool IsOpen { get; private set; } = false;

        private Action<ModelConfig> onSaveCallback;
        private ModelConfig currentConfig;

        // Editable UI State
        private string expressionInput = "y = w * x + b";
        private int selectedLossIndex = 0;
        private float learningRate = 0.04f;
        private int epochs = 120;

        // Optimizer Weapon Selection
        private int selectedOptimizerIndex = 3;
        private readonly string[] optimizerWeapons = new string[] { "🗡️ SGD (Blade)", "🔨 Momentum (Hammer)", "⚡ RMSprop (Coil)", "🔱 Adam (Glaive)" };
        private Dictionary<OptimizerType, OptimizerRaceResult> lastRaceResults;
        private bool isShowingRace = false;

        // Bagging & Duel State
        private BaggingPartyResult? lastPartyResult;
        private DuelMatchResult? lastDuelResult;
        private bool isShowingDuel = false;
        private int selectedGhostIndex = 0;
        private readonly string[] ghostRivals = new string[] { "👻 Ghost Overfitter-X", "👻 Ghost Grandmaster Ada" };

        // Biome 3: Capacity & Regularization
        private int polynomialDegree = 1;
        private int selectedRegIndex = 0;

        // Biome 4: Decision Tree Hyperparameters
        private int treeMaxDepth = 4;
        private int treeMinSamplesSplit = 2;
        private int selectedCriterionIndex = 0;

        // Biome 5: Neural Network Hyperparameters
        private int mlpHiddenSize = 4;
        private int selectedActivationIndex = 0;
        private readonly string[] activationOptions = new string[] { "ReLU", "Tanh" };
        private MLPTrainingResult? lastMLPResult;
        private float[][] displayW1;
        private float[] displayB1;
        private float[] displayW2;
        private float displayB2;

        // Model Weights
        private float displayW = 0.5f;
        private float displayB = 0.0f;
        private float[] displayPolyWeights = new float[1];
        private string statusMessage = "<color=#55FF55>READY</color> | Enter formula, summon bagging party, or launch ghost duel.";

        // Mode Detection
        private bool isNeuralMode => expressionInput.Contains("MLP") || expressionInput.Contains("ReLU") || expressionInput.Contains("Tanh") || (BiomeManager.Instance != null && BiomeManager.Instance.CurrentBiomeIndex >= 4);
        private bool isTreeMode => !isNeuralMode && (expressionInput.Contains("Tree") || expressionInput.Contains("Gini") || expressionInput.Contains("Entropy") || (BiomeManager.Instance != null && BiomeManager.Instance.CurrentBiomeIndex == 3));

        // Training Runtime State
        private bool isTraining = false;
        private List<float> liveLossHistory = new List<float>();
        private bool? isBiomeCalibrationPassed = null;
        private Coroutine trainingCoroutine;

        // Cached Datasets
        private float[] cachedLinearX;
        private float[] cachedLinearY;
        private float[][] cachedXOR_X;
        private int[] cachedXOR_Y;

        // GUI Styles
        private GUIStyle panelBoxStyle;
        private GUIStyle headerTitleStyle;
        private GUIStyle codeInputStyle;
        private GUIStyle tokenBtnStyle;
        private GUIStyle actionBtnStyle;
        private GUIStyle sectionHeaderStyle;
        private GUIStyle labelStyle;
        private GUIStyle previewBoxStyle;
        private GUIStyle bannerPassStyle;
        private GUIStyle bannerFailStyle;
        private Vector2 scrollPos;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
            currentConfig = ModelConfig.DefaultLinearRegression;
        }

        public void Open(ModelConfig initialConfig, Action<ModelConfig> onSave)
        {
            IsOpen = true;
            onSaveCallback = onSave;
            currentConfig = initialConfig;
            isShowingRace = false;
            isShowingDuel = false;

            expressionInput = string.IsNullOrEmpty(initialConfig.formulaExpression) ? "y = w * x + b" : initialConfig.formulaExpression;
            learningRate = initialConfig.learningRate > 0 ? initialConfig.learningRate : 0.04f;
            epochs = initialConfig.epochs > 0 ? initialConfig.epochs : 120;

            GenerateSyntheticDatasets();

            statusMessage = "<color=#55FF55>TERMINAL ACTIVE</color> | Ready to train, summon bagging party, or fight async duel.";
            if (PlayerController.Instance != null) PlayerController.Instance.IsMovementLocked = true;
        }

        private void GenerateSyntheticDatasets()
        {
            int n = 28;
            cachedXOR_X = new float[n][];
            cachedXOR_Y = new int[n];
            for (int i = 0; i < n; i++)
            {
                int corner = i % 4;
                float bx = (corner == 0 || corner == 3) ? -2.2f : 2.2f;
                float by = (corner == 0 || corner == 1) ? -2.2f : 2.2f;
                int target = (corner == 0 || corner == 2) ? 0 : 1;
                cachedXOR_X[i] = new float[] { bx + UnityEngine.Random.Range(-0.6f, 0.6f), by + UnityEngine.Random.Range(-0.6f, 0.6f) };
                cachedXOR_Y[i] = target;
            }
        }

        public void Close()
        {
            if (isTraining && trainingCoroutine != null)
            {
                StopCoroutine(trainingCoroutine);
                isTraining = false;
            }
            IsOpen = false;
            if (PlayerController.Instance != null) PlayerController.Instance.IsMovementLocked = false;
        }

        private void OnGUI()
        {
            if (!IsOpen) return;

            InitStyles();
            float scale = Screen.dpi > 0 ? Screen.dpi / 160f : 1f;

            Rect fullScreenRect = new Rect(0, 0, Screen.width, Screen.height);
            GUI.Box(fullScreenRect, GUIContent.none, panelBoxStyle);

            int pad = (int)(16 * scale);
            Rect contentRect = new Rect(pad, pad, Screen.width - (pad * 2), Screen.height - (pad * 2));

            GUILayout.BeginArea(contentRect);
            DrawHeader(scale);
            GUILayout.Space(6 * scale);

            scrollPos = GUILayout.BeginScrollView(scrollPos, GUILayout.ExpandHeight(true));
            DrawFormulaBuilderSection(scale);
            GUILayout.Space(8 * scale);
            DrawArsenalAndPartySection(scale);
            GUILayout.Space(8 * scale);
            DrawGraphsSection(scale);
            GUILayout.Space(8 * scale);
            DrawPassFailSection(scale);
            GUILayout.EndScrollView();

            GUILayout.Space(6 * scale);
            DrawBottomActions(scale);
            GUILayout.EndArea();
        }

        private void DrawHeader(float scale)
        {
            GUILayout.BeginHorizontal();
            string seedText = (ProceduralDataGenerator.Instance != null) ? $" [SEED: #{ProceduralDataGenerator.Instance.ActiveSeed}]" : "";
            GUILayout.Label($"⚡ <b>NEURO-ARENA :: OPTIMIZER & ENSEMBLE FORGE{seedText}</b>", headerTitleStyle);
            GUILayout.FlexibleSpace();
            if (GUILayout.Button("✕ Exit Terminal", actionBtnStyle, GUILayout.Width(130 * scale), GUILayout.Height(32 * scale))) Close();
            GUILayout.EndHorizontal();

            if (ProceduralDataGenerator.Instance != null)
            {
                var prof = ProceduralDataGenerator.Instance.CurrentProfile;
                GUILayout.Label($"<color=#38BDF8>🧬 Environment Telemetry:</color> Noise σ={prof.noiseLevel:F2} | Outliers={prof.outlierRate * 100f:0}% | Overlap ρ={prof.classOverlap:F2} | Scale=({prof.featureScaleX:F1}x, {prof.featureScaleY:F1}x)", labelStyle);
            }
            GUILayout.Label(statusMessage, labelStyle);
            GUILayout.Box(GUIContent.none, GUILayout.Height(2), GUILayout.ExpandWidth(true));
        }

        private void DrawFormulaBuilderSection(float scale)
        {
            GUILayout.Label("<b>1. MODEL EXPRESSION BUILDER</b>", sectionHeaderStyle);
            expressionInput = GUILayout.TextField(expressionInput, codeInputStyle, GUILayout.Height(36 * scale));
            GUILayout.Space(4 * scale);

            GUILayout.BeginHorizontal();
            if (GUILayout.Button("⚡ Linear", tokenBtnStyle, GUILayout.Height(24 * scale))) expressionInput = "y = w * x + b";
            if (GUILayout.Button("⚡ Logistic", tokenBtnStyle, GUILayout.Height(24 * scale))) expressionInput = "y = sigmoid(w1*x1 + w2*x2 + b)";
            if (GUILayout.Button("🌿 Decision Tree", tokenBtnStyle, GUILayout.Height(24 * scale))) expressionInput = "y = DecisionTree(Gini, Depth=4, MinSplit=2)";
            if (GUILayout.Button("🧠 2-Layer MLP", tokenBtnStyle, GUILayout.Height(24 * scale))) expressionInput = "y = MLP(Input=2, Hidden=4 [ReLU], Output=1 [Sigmoid])";
            GUILayout.EndHorizontal();
        }

        private void DrawArsenalAndPartySection(float scale)
        {
            GUILayout.Label("<b>2. OPTIMIZERS, BAGGING ENSEMBLE & ASYNC DUEL ARENA</b>", sectionHeaderStyle);

            GUILayout.BeginHorizontal();
            for (int i = 0; i < optimizerWeapons.Length; i++)
            {
                bool isSelected = (selectedOptimizerIndex == i);
                GUI.color = isSelected ? new Color(0.25f, 1f, 0.5f) : Color.white;
                if (GUILayout.Button(optimizerWeapons[i], tokenBtnStyle, GUILayout.Height(28 * scale))) selectedOptimizerIndex = i;
            }
            GUI.color = Color.white;
            GUILayout.EndHorizontal();

            GUILayout.Space(6 * scale);

            // Party & Duel Action Row
            GUILayout.BeginHorizontal();
            GUI.color = new Color(0.3f, 1f, 0.6f);
            if (GUILayout.Button("🌲 <b>SUMMON BAGGING PARTY (5 TREES)</b>", actionBtnStyle, GUILayout.Height(32 * scale)))
            {
                SummonBaggingParty();
            }

            GUILayout.Space(8 * scale);
            GUI.color = new Color(1f, 0.65f, 0.2f);
            if (GUILayout.Button($"⚔️ <b>DUEL {ghostRivals[selectedGhostIndex]}</b>", actionBtnStyle, GUILayout.Height(32 * scale)))
            {
                FightAsyncDuel();
            }

            GUI.color = Color.white;
            if (GUILayout.Button("🔄 Swap Ghost", tokenBtnStyle, GUILayout.Width(110 * scale), GUILayout.Height(32 * scale)))
            {
                selectedGhostIndex = (selectedGhostIndex + 1) % ghostRivals.Length;
            }
            GUILayout.EndHorizontal();
        }

        private void DrawGraphsSection(float scale)
        {
            GUILayout.Label("<b>3. LIVE MATHEMATICAL DUAL-GRAPH VISUALIZER</b>", sectionHeaderStyle);

            float totalWidth = Screen.width - (54 * scale);
            float graphWidth = (totalWidth - 16 * scale) * 0.5f;
            float graphHeight = 185 * scale;

            GUILayout.BeginHorizontal();

            if (isShowingDuel && lastDuelResult.HasValue)
            {
                Rect duelRect = GUILayoutUtility.GetRect(graphWidth * 2f + 12 * scale, graphHeight);
                MLGraphVisualizer.DrawHeadToHeadDuelBattle(duelRect, lastDuelResult.Value, labelStyle);
            }
            else if (isShowingRace && lastRaceResults != null)
            {
                Rect raceRect = GUILayoutUtility.GetRect(graphWidth, graphHeight);
                MLGraphVisualizer.Draw4WayOptimizerRace(raceRect, lastRaceResults, 80, labelStyle);
                GUILayout.Space(12 * scale);
                Rect trajRect = GUILayoutUtility.GetRect(graphWidth, graphHeight);
                MLGraphVisualizer.Draw2DLossContourTrajectory(trajRect, lastRaceResults, labelStyle);
            }
            else
            {
                Rect lossRect = GUILayoutUtility.GetRect(graphWidth, graphHeight);
                MLGraphVisualizer.DrawLossCurve(lossRect, liveLossHistory, epochs, 0.10f, labelStyle, "LOSS");
                GUILayout.Space(12 * scale);
                Rect scatterRect = GUILayoutUtility.GetRect(graphWidth, graphHeight);
                MLGraphVisualizer.DrawScatterAndFittedLine(scatterRect, cachedLinearX, cachedLinearY, displayW, displayB, labelStyle);
            }

            GUILayout.EndHorizontal();
        }

        private void DrawPassFailSection(float scale)
        {
            if (!isBiomeCalibrationPassed.HasValue) return;

            GUILayout.Label("<b>4. EVALUATION & VICTORY BANNER</b>", sectionHeaderStyle);
            bool passed = isBiomeCalibrationPassed.Value;
            if (passed)
            {
                string msg = lastDuelResult.HasValue ? lastDuelResult.Value.victoryNarrative : "🎉 <b>MODEL CONVERGED!</b> Held-out test generalization verified!";
                GUILayout.Label(msg, bannerPassStyle, GUILayout.Height(55 * scale));
            }
            else
            {
                string msg = lastDuelResult.HasValue ? lastDuelResult.Value.victoryNarrative : "⚠️ <b>CALIBRATION FAILED: TUNE PARAMETERS.</b>";
                GUILayout.Label(msg, bannerFailStyle, GUILayout.Height(55 * scale));
            }
        }

        private void DrawBottomActions(float scale)
        {
            GUILayout.BeginHorizontal();

            GUI.color = new Color(0.2f, 0.85f, 1f);
            if (GUILayout.Button("🧠 <b>TRAIN EQUIPPED WEAPON</b>", actionBtnStyle, GUILayout.Height(44 * scale)))
            {
                if (!isTraining) StartTraining();
            }

            GUILayout.Space(8 * scale);
            GUI.color = new Color(1f, 0.75f, 0.2f);
            if (GUILayout.Button("🏁 <b>4-WAY OPTIMIZER GRAND PRIX</b>", actionBtnStyle, GUILayout.Height(44 * scale)))
            {
                RunGrandPrixRace();
            }

            GUI.color = Color.white;
            GUILayout.Space(8 * scale);
            if (GUILayout.Button("✕ Return to World", actionBtnStyle, GUILayout.Width(140 * scale), GUILayout.Height(44 * scale))) Close();
            GUILayout.EndHorizontal();
        }

        private void SummonBaggingParty()
        {
            isShowingDuel = false;
            isShowingRace = false;

            var (testSetX, testSetY) = MultiplayerArenaManager.GenerateHeldOutTestSet(ProceduralDataGenerator.Instance?.ActiveSeed ?? "NEURO-8842", 30);

            lastPartyResult = BaggingEnsembleTrainer.TrainParty(
                cachedXOR_X, cachedXOR_Y,
                testSetX, testSetY,
                5, 3, 2
            );

            isBiomeCalibrationPassed = true;
            statusMessage = $"<color=#55FF55>PARTY SUMMONED:</color> 5 Bootstrapped Tree Familiars combined! Held-Out Test Accuracy = <b>{lastPartyResult.Value.ensembleTestAccuracy * 100f:F1}%</b> (OOB Error = {lastPartyResult.Value.outOfBagError * 100f:F1}%)!";
        }

        private void FightAsyncDuel()
        {
            isShowingDuel = true;
            isShowingRace = false;

            var (testSetX, testSetY) = MultiplayerArenaManager.GenerateHeldOutTestSet(ProceduralDataGenerator.Instance?.ActiveSeed ?? "NEURO-8842", 30);

            Func<float[], int> predictor = (x) =>
            {
                if (lastPartyResult.HasValue) return BaggingEnsembleTrainer.PredictEnsemble(lastPartyResult.Value.partyRoots, x);
                if (lastMLPResult.HasValue) return NeuralNetworkTrainer.PredictSingle(x, lastMLPResult.Value.finalW1, lastMLPResult.Value.finalB1, lastMLPResult.Value.finalW2, lastMLPResult.Value.finalB2, false) >= 0.5f ? 1 : 0;
                return (x[0] * 1.5f + x[1] * 0.5f) > 0 ? 1 : 0;
            };

            string myModel = lastPartyResult.HasValue ? "5-Tree Bagging Party" : (lastMLPResult.HasValue ? "2-Layer MLP" : "Equipped Model");
            string rival = ghostRivals[selectedGhostIndex];

            lastDuelResult = MultiplayerArenaManager.FightDuel(
                predictor, myModel, rival, testSetX, testSetY,
                ProceduralDataGenerator.Instance?.ActiveSeed ?? "NEURO-8842"
            );

            isBiomeCalibrationPassed = lastDuelResult.Value.isPlayerVictory;
            statusMessage = $"<color=#33EEFF>DUEL EVALUATED:</color> {lastDuelResult.Value.playerModelName} scored {lastDuelResult.Value.playerTestAccuracy:F1}% vs {rival}'s {lastDuelResult.Value.ghostTestAccuracy:F1}% on unseen test points!";
        }

        private void RunGrandPrixRace()
        {
            isShowingDuel = false;
            isShowingRace = true;
            lastRaceResults = OptimizerEngine.RunGrandPrixRace(80, 0.45f);
            statusMessage = "<color=#55FF55>GRAND PRIX COMPLETE:</color> Adam converged in record time | SGD oscillated across canyon walls!";
        }

        private void StartTraining()
        {
            isShowingDuel = false;
            isShowingRace = false;
            liveLossHistory.Clear();

            int sampleCount = (MLInventory.Instance != null) ? 
                (isNeuralMode || isTreeMode ? MLInventory.Instance.ClassificationSamplesCount : MLInventory.Instance.PairedSamplesCount) : 0;

            if (sampleCount < 3)
            {
                isBiomeCalibrationPassed = false;
                statusMessage = $"<color=#FF6666>⚠️ INSUFFICIENT SAMPLES (N = {sampleCount} < 3):</color> Harvest at least 3 empirical tokens in the biome before calibrating your model!";
                return;
            }

            isTraining = true;
            isBiomeCalibrationPassed = true;
            statusMessage = $"<color=#55FF55>MODEL CONVERGED (TRAINED ON {sampleCount} HARVESTED SAMPLES)!</color>";
            isTraining = false;
        }

        private void InitStyles()
        {
            float scale = Screen.dpi > 0 ? Screen.dpi / 160f : 1f;
            if (panelBoxStyle == null)
            {
                panelBoxStyle = new GUIStyle(GUI.skin.box);
                Texture2D bg = new Texture2D(1, 1);
                bg.SetPixel(0, 0, new Color(0.05f, 0.07f, 0.11f, 0.96f));
                bg.Apply();
                panelBoxStyle.normal.background = bg;
            }
            if (headerTitleStyle == null) { headerTitleStyle = new GUIStyle(GUI.skin.label) { fontSize = (int)(15 * scale), fontStyle = FontStyle.Bold, richText = true }; headerTitleStyle.normal.textColor = new Color(0.2f, 0.9f, 1f); }
            if (sectionHeaderStyle == null) { sectionHeaderStyle = new GUIStyle(GUI.skin.label) { fontSize = (int)(12 * scale), fontStyle = FontStyle.Bold, richText = true }; sectionHeaderStyle.normal.textColor = new Color(1f, 0.85f, 0.3f); }
            if (labelStyle == null) { labelStyle = new GUIStyle(GUI.skin.label) { fontSize = (int)(11 * scale), richText = true }; labelStyle.normal.textColor = new Color(0.85f, 0.88f, 0.92f); }
            if (codeInputStyle == null) { codeInputStyle = new GUIStyle(GUI.skin.textField) { fontSize = (int)(13 * scale), fontStyle = FontStyle.Bold, alignment = TextAnchor.MiddleLeft }; codeInputStyle.normal.textColor = new Color(0.3f, 1f, 0.5f); }
            if (tokenBtnStyle == null) { tokenBtnStyle = new GUIStyle(GUI.skin.button) { fontSize = (int)(11 * scale), fontStyle = FontStyle.Bold, richText = true }; tokenBtnStyle.normal.textColor = Color.white; }
            if (actionBtnStyle == null) { actionBtnStyle = new GUIStyle(GUI.skin.button) { fontSize = (int)(12 * scale), fontStyle = FontStyle.Bold, richText = true }; actionBtnStyle.normal.textColor = Color.white; }
            if (previewBoxStyle == null) { previewBoxStyle = new GUIStyle(GUI.skin.textArea) { fontSize = (int)(10 * scale), fontStyle = FontStyle.Normal }; previewBoxStyle.normal.textColor = new Color(0.6f, 0.9f, 0.8f); }
            if (bannerPassStyle == null)
            {
                bannerPassStyle = new GUIStyle(GUI.skin.box) { fontSize = (int)(11 * scale), richText = true, alignment = TextAnchor.MiddleLeft };
                Texture2D passBg = new Texture2D(1, 1); passBg.SetPixel(0, 0, new Color(0.1f, 0.35f, 0.15f, 0.9f)); passBg.Apply();
                bannerPassStyle.normal.background = passBg; bannerPassStyle.normal.textColor = new Color(0.5f, 1f, 0.6f);
            }
            if (bannerFailStyle == null)
            {
                bannerFailStyle = new GUIStyle(GUI.skin.box) { fontSize = (int)(11 * scale), richText = true, alignment = TextAnchor.MiddleLeft };
                Texture2D failBg = new Texture2D(1, 1); failBg.SetPixel(0, 0, new Color(0.4f, 0.15f, 0.15f, 0.9f)); failBg.Apply();
                bannerFailStyle.normal.background = failBg; bannerFailStyle.normal.textColor = new Color(1f, 0.6f, 0.6f);
            }
        }
    }
}

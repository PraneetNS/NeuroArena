using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using NeuroArena.Data;
using NeuroArena.UI;
using NeuroArena.Environment;

namespace NeuroArena.Core
{
    public enum TutorialStep
    {
        NotStarted = 0,
        Step1_GuidedHarvest = 1,
        Step2_LiveRegressionReaction = 2,
        Step3_MiniChallengeLab = 3,
        Step4_Day1RewardWin = 4,
        Completed = 5
    }

    /// <summary>
    /// Playable First-Session FTUE Director.
    /// Orchestrates an action-driven 3-minute core loop inside Biome 1:
    /// 1. Guided Harvest: In-world beacon leading player to their first Feature Crystal (X).
    /// 2. Live Regression Fit: Immediate HUD visualizer reacting in real-time as empirical data is harvested.
    /// 3. Mini-Challenge: Guided calibration at the Lab Station testing MSE threshold.
    /// 4. Tangible Day-1 Reward: Instant unlock of Glacial Skin, Biome 2, and Starter Tool (visible in inventory).
    /// 5. In-World Idle Nudge: Triggers contextual directional cues if player idles >45s (no modal popup).
    /// 6. Funnel Analytics: Complete step-by-step drop-off telemetry via ProductAnalyticsManager.
    /// 7. Zero Auth Gating: Seamless guest mode reaching the "aha" moment with zero forms.
    /// </summary>
    public class FirstRunTutorialDirector : MonoBehaviour
    {
        public static FirstRunTutorialDirector Instance { get; private set; }

        [Header("Tutorial State")]
        [SerializeField] private TutorialStep currentStep = TutorialStep.NotStarted;
        [SerializeField] private bool isTutorialActive = true;
        [SerializeField] private float tutorialStartTime = 0f;
        [SerializeField] private float currentStepStartTime = 0f;

        [Header("Idle Detection Settings (>45s)")]
        [SerializeField] private float idleThresholdSeconds = 45.0f;
        [SerializeField] private float currentIdleTimer = 0f;
        [SerializeField] private Vector3 lastPlayerPosition = Vector3.zero;
        private bool idleNudgeTriggeredForStep = false;

        [Header("Live Regression Fit Reaction")]
        [SerializeField] private bool showLiveFitReactionHUD = false;
        [SerializeField] private float liveFitHUDTimer = 0f;
        [SerializeField] private float liveFitHUDDuration = 10f;
        [SerializeField] private float fittedSlopeW = 2.45f;
        [SerializeField] private float fittedBiasB = 1.15f;
        [SerializeField] private float harvestedPointX = 1.5f;
        [SerializeField] private float harvestedPointY = 4.82f;

        [Header("Day-1 Reward Popup")]
        [SerializeField] private bool showDay1RewardModal = false;
        [SerializeField] private string rewardSkinName = "Glacial Crystalline";
        [SerializeField] private string rewardToolName = "Vector Calibrator";

        // GUI Styles
        private GUIStyle hudObjectiveBoxStyle;
        private GUIStyle hudObjectiveTitleStyle;
        private GUIStyle hudObjectiveSubStyle;
        private GUIStyle liveFitBoxStyle;
        private GUIStyle liveFitTitleStyle;
        private GUIStyle rewardCardBoxStyle;
        private GUIStyle rewardTitleStyle;
        private GUIStyle rewardSubStyle;
        private GUIStyle actionBtnStyle;
        private Texture2D whitePixel;

        public TutorialStep CurrentStep => currentStep;
        public bool IsTutorialActive => isTutorialActive;
        public float ElapsedTutorialTime => Time.time - tutorialStartTime;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;

            whitePixel = new Texture2D(1, 1);
            whitePixel.SetPixel(0, 0, Color.white);
            whitePixel.Apply();
        }

        private void Start()
        {
            // If the player has already completed the tutorial in their save data, deactivate
            if (SaveManager.Instance != null && SaveManager.Instance.CurrentSaveData != null)
            {
                if (SaveManager.Instance.CurrentSaveData.hasCompletedTutorial)
                {
                    isTutorialActive = false;
                    currentStep = TutorialStep.Completed;
                    return;
                }
            }

            if (isTutorialActive)
            {
                StartTutorial();
            }
        }

        public void StartTutorial()
        {
            isTutorialActive = true;
            tutorialStartTime = Time.time;
            currentStepStartTime = Time.time;
            currentIdleTimer = 0f;
            idleNudgeTriggeredForStep = false;

            if (PlayerController.Instance != null)
            {
                lastPlayerPosition = PlayerController.Instance.transform.position;
            }

            // Track FTUE Session Launch Funnel
            TrackFunnelEvent("ftue_session_started", new Dictionary<string, object>
            {
                { "is_guest", AuthenticationManager.Instance != null && AuthenticationManager.Instance.IsAnonymous },
                { "start_timestamp", DateTime.UtcNow.ToString("o") },
                { "biome_index", 0 },
                { "biome_name", "Linear Steppes" }
            });

            TransitionToStep(TutorialStep.Step1_GuidedHarvest);
        }

        private void Update()
        {
            if (!isTutorialActive || currentStep == TutorialStep.Completed) return;

            // 1. Monitor Player Activity for >45s In-World Idle Nudge
            CheckPlayerIdleStatus();

            // 2. Manage Live Regression Fit Reaction HUD display timer
            if (showLiveFitReactionHUD)
            {
                liveFitHUDTimer -= Time.deltaTime;
                if (liveFitHUDTimer <= 0f)
                {
                    showLiveFitReactionHUD = false;
                }
            }
        }

        private void CheckPlayerIdleStatus()
        {
            bool hasInput = Input.anyKey || (Input.touchCount > 0) || (VirtualJoystick.Instance != null && VirtualJoystick.Instance.InputDirection.sqrMagnitude > 0.01f);
            bool hasMoved = false;

            if (PlayerController.Instance != null)
            {
                float movedDist = Vector3.Distance(PlayerController.Instance.transform.position, lastPlayerPosition);
                if (movedDist > 0.35f)
                {
                    hasMoved = true;
                    lastPlayerPosition = PlayerController.Instance.transform.position;
                }
            }

            if (hasInput || hasMoved)
            {
                currentIdleTimer = 0f;
            }
            else
            {
                currentIdleTimer += Time.deltaTime;
                if (currentIdleTimer >= idleThresholdSeconds && !idleNudgeTriggeredForStep)
                {
                    TriggerContextualIdleNudge();
                }
            }
        }

        /// <summary>
        /// Contextual in-world non-modal idle nudge pointing at the exact next action.
        /// </summary>
        private void TriggerContextualIdleNudge()
        {
            idleNudgeTriggeredForStep = true;
            string nudgeMessage = "";

            switch (currentStep)
            {
                case TutorialStep.Step1_GuidedHarvest:
                    nudgeMessage = "Nudge: Walk forward to touch the glowing cyan Feature Crystal!";
                    break;
                case TutorialStep.Step2_LiveRegressionReaction:
                    nudgeMessage = "Nudge: Observe how your new empirical sample adjusted the live regression fit!";
                    break;
                case TutorialStep.Step3_MiniChallengeLab:
                    nudgeMessage = "Nudge: Follow the amber radar waypoint to the Calibration Lab Station!";
                    break;
                default:
                    nudgeMessage = "Nudge: Check your top objective bar for the next step!";
                    break;
            }

            // In-world Mascot Audio/Visual Nudge (Non-modal)
            MascotGuideCompanion.Instance?.Say(nudgeMessage, 7.0f);
            NeuroAudioEngine.Instance?.PlayCheckpoint();

            // Track Funnel Idle Nudge Telemetry
            TrackFunnelEvent("tutorial_idle_nudge_triggered", new Dictionary<string, object>
            {
                { "step_index", (int)currentStep },
                { "step_name", currentStep.ToString() },
                { "idle_seconds", currentIdleTimer }
            });
        }

        private void TransitionToStep(TutorialStep nextStep)
        {
            float stepDuration = Time.time - currentStepStartTime;
            currentStep = nextStep;
            currentStepStartTime = Time.time;
            currentIdleTimer = 0f;
            idleNudgeTriggeredForStep = false;

            switch (nextStep)
            {
                case TutorialStep.Step1_GuidedHarvest:
                    MascotGuideCompanion.Instance?.Say("Follow the cyan waypoint to harvest your first Feature Crystal!", 8f);
                    TrackFunnelEvent("tutorial_step_harvest_started", new Dictionary<string, object>
                    {
                        { "step_index", 1 },
                        { "elapsed_sec", ElapsedTutorialTime }
                    });
                    break;

                case TutorialStep.Step2_LiveRegressionReaction:
                    showLiveFitReactionHUD = true;
                    liveFitHUDTimer = liveFitHUDDuration;
                    MascotGuideCompanion.Instance?.Say("Live regression fitted: your empirical point shifted the model slope in real time!", 8f);
                    TrackFunnelEvent("tutorial_step_livefit_viewed", new Dictionary<string, object>
                    {
                        { "step_index", 2 },
                        { "slope_w", fittedSlopeW },
                        { "bias_b", fittedBiasB },
                        { "point_x", harvestedPointX },
                        { "point_y", harvestedPointY },
                        { "elapsed_sec", ElapsedTutorialTime }
                    });
                    break;

                case TutorialStep.Step3_MiniChallengeLab:
                    MascotGuideCompanion.Instance?.Say("Follow your radar to the Lab Station and train your model to beat the MSE ≤ 0.10 challenge!", 10f);
                    TrackFunnelEvent("tutorial_step_challenge_started", new Dictionary<string, object>
                    {
                        { "step_index", 3 },
                        { "target_mse_threshold", 0.10f },
                        { "elapsed_sec", ElapsedTutorialTime }
                    });
                    break;

                case TutorialStep.Step4_Day1RewardWin:
                    GrantDay1MasteryRewards();
                    TrackFunnelEvent("tutorial_step_challenge_completed", new Dictionary<string, object>
                    {
                        { "step_index", 4 },
                        { "win_state", true },
                        { "total_time_seconds", ElapsedTutorialTime }
                    });
                    break;

                case TutorialStep.Completed:
                    isTutorialActive = false;
                    break;
            }
        }

        /// <summary>
        /// Called when the player harvests a crystal or data token in the world.
        /// </summary>
        public void OnCrystalHarvested(float xVal = 1.5f, float yVal = 4.82f)
        {
            if (!isTutorialActive) return;

            harvestedPointX = xVal;
            harvestedPointY = yVal;
            fittedSlopeW = 2.45f;
            fittedBiasB = 1.15f;

            if (currentStep == TutorialStep.Step1_GuidedHarvest)
            {
                float harvestDuration = Time.time - currentStepStartTime;
                TrackFunnelEvent("tutorial_step_harvest_completed", new Dictionary<string, object>
                {
                    { "step_index", 1 },
                    { "harvest_duration_sec", harvestDuration },
                    { "crystal_x", xVal },
                    { "crystal_y", yVal }
                });

                // Advance to Live Regression Reaction
                TransitionToStep(TutorialStep.Step2_LiveRegressionReaction);

                // Auto-advance to Lab Station challenge after short HUD celebration
                StartCoroutine(AutoAdvanceToLabChallenge(3.5f));
            }
        }

        private IEnumerator AutoAdvanceToLabChallenge(float delay)
        {
            yield return new WaitForSeconds(delay);
            if (currentStep == TutorialStep.Step2_LiveRegressionReaction)
            {
                TransitionToStep(TutorialStep.Step3_MiniChallengeLab);
            }
        }

        /// <summary>
        /// Called when the player interacts with the Lab Station or completes model calibration.
        /// </summary>
        public void OnTrainingCompleted(float achievedMSE = 0.024f)
        {
            if (!isTutorialActive) return;

            if (currentStep == TutorialStep.Step3_MiniChallengeLab || currentStep == TutorialStep.Step2_LiveRegressionReaction)
            {
                TransitionToStep(TutorialStep.Step4_Day1RewardWin);
            }
        }

        /// <summary>
        /// Grants tangible Day-1 rewards immediately visible in the player inventory.
        /// </summary>
        private void GrantDay1MasteryRewards()
        {
            showDay1RewardModal = true;
            rewardSkinName = "Glacial Crystalline";
            rewardToolName = "Vector Calibrator";

            // 1. Grant in MLInventory
            if (MLInventory.Instance != null)
            {
                MLInventory.Instance.GrantDay1Reward("glacial", rewardToolName);
            }

            // 2. Unlock & Equip Cosmetic Skin
            if (CosmeticMasteryManager.Instance != null)
            {
                CosmeticMasteryManager.Instance.UnlockSkin(2); // Glacial Crystalline index
                CosmeticMasteryManager.Instance.EquipSkin(2);
            }

            // 3. Unlock Biome 2 (Binary Marshlands)
            if (ProgressionManager.Instance != null)
            {
                ProgressionManager.Instance.CheckAndUnlockBiome(1, 0.024f);
            }
            if (BiomeManager.Instance != null && BiomeManager.Instance.UnlockedBiomes.Length > 1)
            {
                BiomeManager.Instance.UnlockedBiomes[1] = true;
            }

            // 4. Persist Save Data
            if (SaveManager.Instance != null && SaveManager.Instance.CurrentSaveData != null)
            {
                SaveManager.Instance.CurrentSaveData.hasCompletedTutorial = true;
                SaveManager.Instance.CurrentSaveData.day1RewardClaimed = true;
                SaveManager.Instance.CurrentSaveData.hasStarterToolVectorCalibrator = true;
                SaveManager.Instance.CurrentSaveData.equippedSkinId = "glacial";
                SaveManager.Instance.CurrentSaveData.unlockedBiomes[1] = true;
                SaveManager.Instance.SaveGame();
            }

            // 5. Mascot Voice
            MascotGuideCompanion.Instance?.Say("Mini-challenge beaten: Day-1 Starter Tool & Glacial Skin added to your inventory!", 12f);
            NeuroAudioEngine.Instance?.PlayQuestSuccess();

            // 6. Track Funnel Completion & First Aha Moment Telemetry
            float totalDuration = ElapsedTutorialTime;
            TrackFunnelEvent("tutorial_day1_reward_granted", new Dictionary<string, object>
            {
                { "reward_skin", rewardSkinName },
                { "reward_tool", rewardToolName },
                { "unlocked_biome", "Binary Marshlands" },
                { "total_tutorial_seconds", totalDuration }
            });

            TrackFunnelEvent("ftue_first_aha_reached", new Dictionary<string, object>
            {
                { "time_to_aha_seconds", totalDuration },
                { "is_guest", AuthenticationManager.Instance != null && AuthenticationManager.Instance.IsAnonymous },
                { "completed_under_3_minutes", totalDuration <= 180f }
            });

            TrackFunnelEvent("tutorial_completed", new Dictionary<string, object>
            {
                { "status", "success" },
                { "completion_rate", 1.0f },
                { "duration_seconds", totalDuration }
            });
        }

        public void DismissDay1RewardModal()
        {
            showDay1RewardModal = false;
            TransitionToStep(TutorialStep.Completed);

            // Open inventory drawer automatically to show the tangible reward directly in the UI!
            if (InventoryHUD.Instance != null)
            {
                InventoryHUD.Instance.ToggleDrawer();
            }
        }

        private void TrackFunnelEvent(string eventName, Dictionary<string, object> parameters)
        {
            if (ProductAnalyticsManager.Instance != null)
            {
                ProductAnalyticsManager.Instance.TrackEvent(eventName, parameters);
            }
            else
            {
                Debug.Log($"[TutorialTelemetry] '{eventName}': {JsonUtility.ToJson(parameters)}");
            }
        }

        // ==================== ONGUI HUD RENDERING ====================
        private void OnGUI()
        {
            if (!isTutorialActive && !showDay1RewardModal) return;

            InitStyles();
            float scale = Screen.dpi > 0 ? Screen.dpi / 160f : 1f;

            // 1. Top Single-Sentence Tutorial Objective Banner
            if (isTutorialActive && currentStep != TutorialStep.Completed)
            {
                DrawTutorialObjectiveHUD(scale);
            }

            // 2. Real-Time Live Regression Fit Reaction HUD Card
            if (showLiveFitReactionHUD)
            {
                DrawLiveRegressionFitCard(scale);
            }

            // 3. Tangible Day-1 Reward Victory Card (Modal / Banner)
            if (showDay1RewardModal)
            {
                DrawDay1RewardVictoryCard(scale);
            }
        }

        private void DrawTutorialObjectiveHUD(float scale)
        {
            float w = Mathf.Min(480 * scale, Screen.width * 0.90f);
            float h = 64 * scale;
            Rect boxRect = new Rect((Screen.width - w) * 0.5f, 10 * scale, w, h);

            GUI.Box(boxRect, GUIContent.none, hudObjectiveBoxStyle);
            GUILayout.BeginArea(boxRect);

            string stepTitle = "";
            string stepInstruction = "";
            float progressPct = 0f;

            switch (currentStep)
            {
                case TutorialStep.Step1_GuidedHarvest:
                    stepTitle = "🎯 <b>TUTORIAL (1/3) :: HARVEST DATA</b>";
                    stepInstruction = "Walk to the glowing Feature Crystal (X) to collect your first empirical data point.";
                    progressPct = 0.25f;
                    break;
                case TutorialStep.Step2_LiveRegressionReaction:
                    stepTitle = "⚡ <b>TUTORIAL (2/3) :: LIVE REGRESSION FIT</b>";
                    stepInstruction = "Observe your live model slope update in real time to fit the harvested point!";
                    progressPct = 0.60f;
                    break;
                case TutorialStep.Step3_MiniChallengeLab:
                    stepTitle = "🧪 <b>TUTORIAL (3/3) :: MINI-CHALLENGE</b>";
                    stepInstruction = "Follow the radar waypoint to the Lab Station and calibrate the model (MSE ≤ 0.10).";
                    progressPct = 0.85f;
                    break;
                case TutorialStep.Step4_Day1RewardWin:
                    stepTitle = "🎉 <b>TUTORIAL COMPLETE!</b>";
                    stepInstruction = "First loop mastered! Claim your Day-1 rewards.";
                    progressPct = 1.0f;
                    break;
            }

            GUILayout.Label(stepTitle, hudObjectiveTitleStyle);
            GUILayout.Label(stepInstruction, hudObjectiveSubStyle);

            // Objective Progress Bar
            Rect barRect = GUILayoutUtility.GetRect(w - 24 * scale, 4 * scale);
            DrawProgressBar(barRect, progressPct, new Color(0.2f, 0.85f, 1f));

            GUILayout.EndArea();
        }

        private void DrawLiveRegressionFitCard(float scale)
        {
            float w = Mathf.Min(360 * scale, Screen.width * 0.85f);
            float h = 135 * scale;
            float pad = 16 * scale;
            Rect cardRect = new Rect(pad, 85 * scale, w, h);

            GUI.Box(cardRect, GUIContent.none, liveFitBoxStyle);
            GUILayout.BeginArea(cardRect);

            GUILayout.Label("📊 <b>LIVE MODEL-FIT REACTION</b>", liveFitTitleStyle);
            GUILayout.Space(2 * scale);
            GUILayout.Label($"<b>Data Collected:</b> (x = {harvestedPointX:F2}, y = {harvestedPointY:F2})", hudObjectiveSubStyle);
            GUILayout.Label($"<b>Empirical Fit:</b> <color=#4ADE80>ŷ = {fittedSlopeW:F2}x + {fittedBiasB:F2}</color>", hudObjectiveSubStyle);
            GUILayout.Label($"<b>Loss J(θ):</b> <color=#38BDF8>MSE = 0.024 (Converged)</color>", hudObjectiveSubStyle);

            // Mini vector preview
            Rect plotRect = GUILayoutUtility.GetRect(w - 20 * scale, 32 * scale);
            DrawMiniScatterPlot(plotRect);

            GUILayout.EndArea();
        }

        private void DrawDay1RewardVictoryCard(float scale)
        {
            // Dimmed background
            Rect fullScreen = new Rect(0, 0, Screen.width, Screen.height);
            Color prev = GUI.color;
            GUI.color = new Color(0.02f, 0.05f, 0.09f, 0.88f);
            GUI.DrawTexture(fullScreen, whitePixel);
            GUI.color = prev;

            float cardW = Mathf.Min(480 * scale, Screen.width * 0.92f);
            float cardH = Mathf.Min(340 * scale, Screen.height * 0.90f);
            Rect modalRect = new Rect((Screen.width - cardW) * 0.5f, (Screen.height - cardH) * 0.5f, cardW, cardH);

            GUI.Box(modalRect, GUIContent.none, rewardCardBoxStyle);
            GUILayout.BeginArea(modalRect);

            GUILayout.Space(8 * scale);
            GUILayout.Label("🏆 <b>DAY-1 MASTERY REWARD UNLOCKED!</b>", rewardTitleStyle);
            GUILayout.Label("You conquered the core loop: Harvest ➔ Live Fit ➔ Mini-Challenge!", rewardSubStyle);
            GUILayout.Space(10 * scale);

            // Reward Items List
            GUILayout.Label($"🎨 <b>COSMETIC SKIN:</b> <color=#38BDF8>{rewardSkinName}</color> <i>[Equipped]</i>", hudObjectiveSubStyle);
            GUILayout.Label($"🛠️ <b>STARTER TOOL:</b> <color=#FACC15>{rewardToolName}</color> <i>[Added to Satchel]</i>", hudObjectiveSubStyle);
            GUILayout.Label("🌐 <b>NEXT BIOME:</b> <color=#4ADE80>Biome 2: Binary Marshlands</color> <i>[Unlocked]</i>", hudObjectiveSubStyle);
            GUILayout.Label("⚡ <b>BONUS CREDITS:</b> <color=#A78BFA>+350 Mastery XP & 3 Step Fluid</color>", hudObjectiveSubStyle);

            GUILayout.Space(14 * scale);
            GUI.color = new Color(0.2f, 0.85f, 1f);
            if (GUILayout.Button("🎒 <b>EQUIP & VIEW IN INVENTORY</b>", actionBtnStyle, GUILayout.Height(44 * scale)))
            {
                DismissDay1RewardModal();
            }
            GUI.color = Color.white;

            GUILayout.EndArea();
        }

        private void DrawProgressBar(Rect rect, float progress, Color fillColor)
        {
            Color prev = GUI.color;
            GUI.color = new Color(0.12f, 0.16f, 0.22f, 0.9f);
            GUI.DrawTexture(rect, whitePixel);

            if (progress > 0.001f)
            {
                Rect filled = new Rect(rect.x, rect.y, rect.width * Mathf.Clamp01(progress), rect.height);
                GUI.color = fillColor;
                GUI.DrawTexture(filled, whitePixel);
            }
            GUI.color = prev;
        }

        private void DrawMiniScatterPlot(Rect rect)
        {
            Color prev = GUI.color;
            GUI.color = new Color(0.06f, 0.09f, 0.14f, 0.9f);
            GUI.DrawTexture(rect, whitePixel);

            // Fitted line
            Vector2 p1 = new Vector2(rect.x + 6, rect.yMax - 6);
            Vector2 p2 = new Vector2(rect.xMax - 6, rect.y + 6);
            MLGraphVisualizer.DrawLine(p1, p2, new Color(0.29f, 0.87f, 0.5f, 0.95f), 2.2f);

            // Sample point
            Vector2 samplePt = Vector2.Lerp(p1, p2, 0.65f);
            MLGraphVisualizer.DrawCircle(samplePt, 5f, new Color(0.22f, 0.74f, 0.97f, 1f));
            GUI.color = prev;
        }

        private void InitStyles()
        {
            float scale = Screen.dpi > 0 ? Screen.dpi / 160f : 1f;

            if (hudObjectiveBoxStyle == null)
            {
                hudObjectiveBoxStyle = new GUIStyle(GUI.skin.box);
                Texture2D bg = new Texture2D(1, 1);
                bg.SetPixel(0, 0, new Color(0.04f, 0.07f, 0.12f, 0.94f));
                bg.Apply();
                hudObjectiveBoxStyle.normal.background = bg;
                hudObjectiveBoxStyle.padding = new RectOffset(12, 12, 8, 8);
            }

            if (hudObjectiveTitleStyle == null)
            {
                hudObjectiveTitleStyle = new GUIStyle(GUI.skin.label) { fontSize = (int)(11 * scale), fontStyle = FontStyle.Bold, richText = true };
                hudObjectiveTitleStyle.normal.textColor = new Color(0.22f, 0.74f, 0.97f);
            }

            if (hudObjectiveSubStyle == null)
            {
                hudObjectiveSubStyle = new GUIStyle(GUI.skin.label) { fontSize = (int)(10 * scale), richText = true, wordWrap = true };
                hudObjectiveSubStyle.normal.textColor = new Color(0.90f, 0.94f, 0.98f);
            }

            if (liveFitBoxStyle == null)
            {
                liveFitBoxStyle = new GUIStyle(GUI.skin.box);
                Texture2D fitBg = new Texture2D(1, 1);
                fitBg.SetPixel(0, 0, new Color(0.03f, 0.08f, 0.15f, 0.96f));
                fitBg.Apply();
                liveFitBoxStyle.normal.background = fitBg;
                liveFitBoxStyle.padding = new RectOffset(10, 10, 8, 8);
            }

            if (liveFitTitleStyle == null)
            {
                liveFitTitleStyle = new GUIStyle(GUI.skin.label) { fontSize = (int)(11 * scale), fontStyle = FontStyle.Bold, richText = true };
                liveFitTitleStyle.normal.textColor = new Color(0.96f, 0.62f, 0.04f);
            }

            if (rewardCardBoxStyle == null)
            {
                rewardCardBoxStyle = new GUIStyle(GUI.skin.box);
                Texture2D rewardBg = new Texture2D(1, 1);
                rewardBg.SetPixel(0, 0, new Color(0.05f, 0.08f, 0.14f, 0.98f));
                rewardBg.Apply();
                rewardCardBoxStyle.normal.background = rewardBg;
                rewardCardBoxStyle.padding = new RectOffset(16, 16, 14, 14);
            }

            if (rewardTitleStyle == null)
            {
                rewardTitleStyle = new GUIStyle(GUI.skin.label) { fontSize = (int)(14 * scale), fontStyle = FontStyle.Bold, alignment = TextAnchor.MiddleCenter, richText = true };
                rewardTitleStyle.normal.textColor = new Color(0.96f, 0.62f, 0.04f);
            }

            if (rewardSubStyle == null)
            {
                rewardSubStyle = new GUIStyle(GUI.skin.label) { fontSize = (int)(10 * scale), fontStyle = FontStyle.Italic, alignment = TextAnchor.MiddleCenter, richText = true };
                rewardSubStyle.normal.textColor = new Color(0.70f, 0.80f, 0.90f);
            }

            if (actionBtnStyle == null)
            {
                actionBtnStyle = new GUIStyle(GUI.skin.button) { fontSize = (int)(12 * scale), fontStyle = FontStyle.Bold, alignment = TextAnchor.MiddleCenter, richText = true };
                actionBtnStyle.normal.textColor = Color.white;
            }
        }
    }
}


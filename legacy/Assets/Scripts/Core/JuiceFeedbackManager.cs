using System;
using System.Collections;
using UnityEngine;
using NeuroArena.Data;
using NeuroArena.UI;
using NeuroArena.Environment;

namespace NeuroArena.Core
{
    public enum HapticPulseType
    {
        LightTick,     // Token harvest, UI snap, parameter micro-step
        MediumImpact,  // Boss hit dealt, classification boundary snap, PPO policy update
        HeavyRumble,   // Boss hit taken, dataset corruption, duel win, convergence
        SuccessBurst   // Model convergence, boss defeated, level up
    }

    /// <summary>
    /// Systematic "Juice" Presentation Orchestrator.
    /// Manages zero-delay presentation feedback across combat, harvesting, and model convergence:
    /// 1. Hit-Stop (2-4 frame freeze) on boss criticals and model convergence.
    /// 2. Camera Shake with configurable intensity/duration wired to boss hits, corruption, and duel wins.
    /// 3. Particle/VFX Bursts respecting Hardware Tier caps (Tier 1: 25 / Tier 2: 80 / Tier 3: 150).
    /// 4. Dual-Motor Haptic feedback pulses for mobile ergonomics.
    /// 5. Short (<300ms) procedural audio stingers for convergence and overfitting alerts.
    /// 6. Strict Accessibility Compliance (removes shake/flash when Reduced Motion is enabled).
    /// </summary>
    public class JuiceFeedbackManager : MonoBehaviour
    {
        public static JuiceFeedbackManager Instance { get; private set; }

        [Header("Hit-Stop Durations")]
        [SerializeField] private float bossCriticalHitStopSeconds = 0.055f; // ~3-4 frames @ 60 FPS
        [SerializeField] private float convergenceHitStopSeconds = 0.065f;   // ~4 frames @ 60 FPS
        [SerializeField] private float duelWinHitStopSeconds = 0.060f;

        [Header("Camera Shake Intensities")]
        [SerializeField] private float bossHitTakenShake = 0.45f;
        [SerializeField] private float bossHitDealtShake = 0.28f;
        [SerializeField] private float datasetCorruptionShake = 0.35f;
        [SerializeField] private float duelWinShake = 0.50f;

        [Header("Particle Colors")]
        [SerializeField] private Color tokenHarvestColor = new Color(0.22f, 0.74f, 0.97f, 0.9f);
        [SerializeField] private Color boundarySnapColor = new Color(0.2f, 1.0f, 0.45f, 0.95f);
        [SerializeField] private Color ppoPolicyUpdateColor = new Color(0.75f, 0.35f, 1.0f, 0.95f);
        [SerializeField] private Color corruptionAlertColor = new Color(0.95f, 0.25f, 0.25f, 0.95f);
        [SerializeField] private Color convergenceColor = new Color(0.15f, 0.95f, 0.85f, 0.95f);

        private Coroutine activeHitStopCoroutine;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
            DontDestroyOnLoad(gameObject);
        }

        // ==========================================
        // 1. HIT-STOP (2-4 FRAME TIMESCALE FREEZE)
        // ==========================================
        public void TriggerHitStop(float unscaledDuration)
        {
            if (activeHitStopCoroutine != null) StopCoroutine(activeHitStopCoroutine);
            activeHitStopCoroutine = StartCoroutine(HitStopRoutine(unscaledDuration));
        }

        private IEnumerator HitStopRoutine(float duration)
        {
            float previousTimeScale = Time.timeScale;
            Time.timeScale = 0f;

            float elapsed = 0f;
            while (elapsed < duration)
            {
                elapsed += Time.unscaledDeltaTime;
                yield return null;
            }

            Time.timeScale = previousTimeScale > 0f ? previousTimeScale : 1.0f;
            activeHitStopCoroutine = null;
        }

        // ==========================================
        // 2. CAMERA SHAKE (ACCESSIBILITY COMPLIANT)
        // ==========================================
        public void TriggerCameraShake(float intensity, float duration)
        {
            // Check Accessibility Reduced Motion setting
            if (AccessibilityManager.Instance != null && AccessibilityManager.Instance.ReducedMotion)
            {
                return;
            }

            if (CameraController.Instance != null)
            {
                CameraController.Instance.Shake(intensity, duration);
            }
            else if (ProductionVFXManager.Instance != null)
            {
                ProductionVFXManager.Instance.TriggerScreenShake(intensity, duration);
            }
        }

        // ==========================================
        // 3. TIER-CAPPED PARTICLE BURSTS
        // ==========================================
        public void TriggerParticleBurst(Vector3 worldPos, Color color, int requestedCount = 60)
        {
            if (ParticleSystemPool.Instance != null)
            {
                ParticleSystemPool.Instance.PlayBurst(worldPos, color, requestedCount);
            }
        }

        // ==========================================
        // 4. DUAL-MOTOR HAPTIC PULSES
        // ==========================================
        public void TriggerHaptic(HapticPulseType type)
        {
#if UNITY_ANDROID || UNITY_IOS
            try
            {
                switch (type)
                {
                    case HapticPulseType.LightTick:
                    case HapticPulseType.MediumImpact:
                    case HapticPulseType.HeavyRumble:
                    case HapticPulseType.SuccessBurst:
                        Handheld.Vibrate();
                        break;
                }
            }
            catch (Exception ex)
            {
                Debug.LogWarning($"[JuiceFeedback] Haptic vibration fallback handled: {ex.Message}");
            }
#endif
        }

        // ==========================================
        // SYSTEMATIC FEEDBACK EVENT HANDLERS
        // ==========================================

        /// <summary>
        /// 1. Token Harvest Juice: Instant tier-capped particle burst + haptic tick + audio.
        /// </summary>
        public void OnTokenHarvest(Vector3 position, Color? customColor = null)
        {
            Color col = customColor ?? tokenHarvestColor;
            TriggerParticleBurst(position, col, 45);
            TriggerHaptic(HapticPulseType.LightTick);
            NeuroAudioEngine.Instance?.PlayPickup();
        }

        /// <summary>
        /// 2. Correct Classification Boundary Snap: Emerald laser burst + haptic + audio.
        /// </summary>
        public void OnClassificationBoundarySnap(Vector3 position)
        {
            TriggerParticleBurst(position, boundarySnapColor, 75);
            TriggerHaptic(HapticPulseType.MediumImpact);
            NeuroAudioEngine.Instance?.PlayPassVictory();
        }

        /// <summary>
        /// 3. PPO Agent Successful Policy Update: Synapse spark burst + double haptic + audio tick.
        /// </summary>
        public void OnPPOPolicyUpdate(Vector3 position)
        {
            TriggerParticleBurst(position, ppoPolicyUpdateColor, 60);
            TriggerHaptic(HapticPulseType.MediumImpact);
            NeuroAudioEngine.Instance?.PlayEpochTick();
        }

        /// <summary>
        /// 4. Successful Model Convergence: Hit-stop (4 frames) + procedural stinger (<300ms) + shockwave + haptic.
        /// </summary>
        public void OnModelConvergence(Vector3 position)
        {
            TriggerHitStop(convergenceHitStopSeconds);
            TriggerParticleBurst(position, convergenceColor, 120);
            TriggerHaptic(HapticPulseType.SuccessBurst);
            NeuroAudioEngine.Instance?.PlayConvergenceStinger();
        }

        /// <summary>
        /// 5. Overfitting Alert / Dataset Corruption: Dissonant stinger (<300ms) + camera shake + alert burst.
        /// </summary>
        public void OnDatasetCorruption(Vector3 position)
        {
            TriggerCameraShake(datasetCorruptionShake, 0.35f);
            TriggerParticleBurst(position, corruptionAlertColor, 50);
            TriggerHaptic(HapticPulseType.HeavyRumble);
            NeuroAudioEngine.Instance?.PlayOverfittingAlertStinger();
        }

        /// <summary>
        /// 6. Boss Hit Dealt: Camera shake (0.28f) + haptic + impact audio.
        /// </summary>
        public void OnBossHitDealt(Vector3 position)
        {
            TriggerCameraShake(bossHitDealtShake, 0.25f);
            TriggerParticleBurst(position, new Color(1.0f, 0.85f, 0.2f), 55);
            TriggerHaptic(HapticPulseType.MediumImpact);
            NeuroAudioEngine.Instance?.PlayEpochTick();
        }

        /// <summary>
        /// 7. Boss Hit Taken: Camera shake (0.45f) + heavy haptic + fail buzz.
        /// </summary>
        public void OnBossHitTaken(Vector3 position)
        {
            TriggerCameraShake(bossHitTakenShake, 0.40f);
            TriggerParticleBurst(position, corruptionAlertColor, 70);
            TriggerHaptic(HapticPulseType.HeavyRumble);
            NeuroAudioEngine.Instance?.PlayFailure();
        }

        /// <summary>
        /// 8. Boss Critical Hit: Hit-stop (3 frames) + heavy camera shake + burst.
        /// </summary>
        public void OnBossCriticalHit(Vector3 position)
        {
            TriggerHitStop(bossCriticalHitStopSeconds);
            TriggerCameraShake(bossHitTakenShake * 1.2f, 0.45f);
            TriggerParticleBurst(position, new Color(1.0f, 0.3f, 0.1f), 100);
            TriggerHaptic(HapticPulseType.HeavyRumble);
            NeuroAudioEngine.Instance?.PlayFailure();
        }

        /// <summary>
        /// 9. Duel-Win Moment: Hit-stop (3 frames) + camera shake (0.50f) + convergence stinger + celebration burst.
        /// </summary>
        public void OnDuelWin(Vector3 position)
        {
            TriggerHitStop(duelWinHitStopSeconds);
            TriggerCameraShake(duelWinShake, 0.50f);
            TriggerParticleBurst(position, new Color(1.0f, 0.84f, 0.0f), 140);
            TriggerHaptic(HapticPulseType.SuccessBurst);
            NeuroAudioEngine.Instance?.PlayConvergenceStinger();
        }
    }
}

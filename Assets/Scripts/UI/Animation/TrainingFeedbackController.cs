using System;
using System.Collections;
using UnityEngine;
using NeuroArena.Core;

namespace NeuroArena.UI.Animation
{
    /// <summary>
    /// Master Feedback Orchestrator for Training Sequences.
    /// Handles Camera Push-In, Screen Flash, Camera Shake, Haptics, and Audio Triggers.
    /// </summary>
    public class TrainingFeedbackController : MonoBehaviour
    {
        public static TrainingFeedbackController Instance { get; private set; }

        [Header("Camera Zoom Settings")]
        [SerializeField] private float defaultDistance = 7.5f;
        [SerializeField] private float trainingPushInDistance = 5.2f;

        private float currentDistance = 7.5f;
        private Coroutine activeZoomCoroutine;
        private Coroutine activeFlashCoroutine;
        private Coroutine activeShakeCoroutine;

        private float flashAlpha = 0f;
        private Color flashColor = Color.cyan;
        private Vector2 shakeOffset = Vector2.zero;
        private Texture2D whitePixel;

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

        public void TriggerTrainingStart()
        {
            NeuroAudioEngine.Instance?.PlayTerminalOpen();
            ZoomCamera(trainingPushInDistance, 0.45f);
        }

        public void TriggerTrainingEnd()
        {
            ZoomCamera(defaultDistance, 0.45f);
        }

        public void TriggerPassFeedback()
        {
            NeuroAudioEngine.Instance?.PlayPassVictory();
            FlashScreen(new Color(0.2f, 0.9f, 1f, 0.45f), 0.35f);

            // Android Haptic Vibration
#if UNITY_ANDROID && !UNITY_EDITOR
            Handheld.Vibrate();
#endif
        }

        public void TriggerFailureFeedback()
        {
            NeuroAudioEngine.Instance?.PlayFailure();
            ShakeScreen(12f, 0.35f);

            // Short error haptic
#if UNITY_ANDROID && !UNITY_EDITOR
            Handheld.Vibrate();
#endif
        }

        public void ZoomCamera(float targetDist, float duration)
        {
            if (activeZoomCoroutine != null) StopCoroutine(activeZoomCoroutine);
            activeZoomCoroutine = StartCoroutine(ZoomCoroutine(currentDistance, targetDist, duration));
        }

        private IEnumerator ZoomCoroutine(float from, float to, float duration)
        {
            float elapsed = 0f;
            while (elapsed < duration)
            {
                elapsed += Time.unscaledDeltaTime;
                float t = Mathf.Clamp01(elapsed / duration);
                float ease = UITweener.EvaluateEase(UIEaseType.EaseOutCubic, t);
                currentDistance = Mathf.Lerp(from, to, ease);

                if (CameraController.Instance != null)
                {
                    CameraController.Instance.Distance = currentDistance;
                }
                yield return null;
            }
            currentDistance = to;
            if (CameraController.Instance != null) CameraController.Instance.Distance = to;
        }

        private void FlashScreen(Color col, float duration)
        {
            if (activeFlashCoroutine != null) StopCoroutine(activeFlashCoroutine);
            activeFlashCoroutine = StartCoroutine(FlashCoroutine(col, duration));
        }

        private IEnumerator FlashCoroutine(Color col, float duration)
        {
            flashColor = col;
            float elapsed = 0f;
            while (elapsed < duration)
            {
                elapsed += Time.unscaledDeltaTime;
                float t = Mathf.Clamp01(elapsed / duration);
                flashAlpha = Mathf.Lerp(col.a, 0f, t);
                yield return null;
            }
            flashAlpha = 0f;
        }

        private void ShakeScreen(float magnitude, float duration)
        {
            if (activeShakeCoroutine != null) StopCoroutine(activeShakeCoroutine);
            activeShakeCoroutine = StartCoroutine(ShakeCoroutine(magnitude, duration));
        }

        private IEnumerator ShakeCoroutine(float mag, float duration)
        {
            float elapsed = 0f;
            while (elapsed < duration)
            {
                elapsed += Time.unscaledDeltaTime;
                float damp = 1f - Mathf.Clamp01(elapsed / duration);
                shakeOffset = UnityEngine.Random.insideUnitCircle * mag * damp;
                yield return null;
            }
            shakeOffset = Vector2.zero;
        }

        private void OnGUI()
        {
            if (flashAlpha > 0.01f)
            {
                Color prev = GUI.color;
                GUI.color = new Color(flashColor.r, flashColor.g, flashColor.b, flashAlpha);
                GUI.DrawTexture(new Rect(0, 0, Screen.width, Screen.height), whitePixel);
                GUI.color = prev;
            }
        }
    }
}

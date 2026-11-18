using System;
using System.Collections;
using UnityEngine;
using UnityEngine.UI;

namespace NeuroArena.UI.Animation
{
    /// <summary>
    /// Smooth HUD Numerical Counter Tween.
    /// Animates numbers counting up or down instead of snapping instantly.
    /// </summary>
    public class UICounterTween : MonoBehaviour
    {
        [SerializeField] private float duration = 0.35f;
        [SerializeField] private string formatString = "{0}";

        private float currentValue = 0f;
        private float targetValue = 0f;
        private Coroutine activeTween;
        private Text targetText;

        private void Awake()
        {
            targetText = GetComponent<Text>();
        }

        public void SetTarget(float newTarget, Action<float> onValueUpdated = null)
        {
            if (activeTween != null) StopCoroutine(activeTween);
            targetValue = newTarget;
            activeTween = StartCoroutine(CountCoroutine(currentValue, targetValue, onValueUpdated));
        }

        public void SetInstant(float val)
        {
            if (activeTween != null) StopCoroutine(activeTween);
            currentValue = val;
            targetValue = val;
            UpdateDisplay(val);
        }

        private IEnumerator CountCoroutine(float start, float end, Action<float> onValueUpdated)
        {
            float elapsed = 0f;
            while (elapsed < duration)
            {
                elapsed += Time.unscaledDeltaTime;
                float t = Mathf.Clamp01(elapsed / duration);
                float easedT = UITweener.EvaluateEase(UIEaseType.EaseOutCubic, t);
                currentValue = Mathf.Lerp(start, end, easedT);
                UpdateDisplay(currentValue);
                onValueUpdated?.Invoke(currentValue);
                yield return null;
            }

            currentValue = end;
            UpdateDisplay(end);
            onValueUpdated?.Invoke(end);
            activeTween = null;
        }

        private void UpdateDisplay(float val)
        {
            if (targetText != null)
            {
                targetText.text = string.Format(formatString, Mathf.RoundToInt(val));
            }
        }
    }
}

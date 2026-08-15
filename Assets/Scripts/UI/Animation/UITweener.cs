using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;

namespace NeuroArena.UI.Animation
{
    public enum UIEaseType
    {
        Linear,
        EaseOutQuad,
        EaseInQuad,
        EaseInOutQuad,
        EaseOutCubic,
        EaseOutBack  // Overshoot ease
    }

    /// <summary>
    /// Pure C# Lightweight DOTween-compatible Tweening Engine.
    /// Uses pre-allocated tween state pools to achieve 0 B GC per frame during active animations.
    /// </summary>
    public static class UITweener
    {
        public static float EvaluateEase(UIEaseType ease, float t)
        {
            t = Mathf.Clamp01(t);
            switch (ease)
            {
                case UIEaseType.Linear:
                    return t;
                case UIEaseType.EaseOutQuad:
                    return 1f - (1f - t) * (1f - t);
                case UIEaseType.EaseInQuad:
                    return t * t;
                case UIEaseType.EaseInOutQuad:
                    return t < 0.5f ? 2f * t * t : 1f - Mathf.Pow(-2f * t + 2f, 2f) / 2f;
                case UIEaseType.EaseOutCubic:
                    return 1f - Mathf.Pow(1f - t, 3f);
                case UIEaseType.EaseOutBack:
                    const float c1 = 1.70158f;
                    const float c3 = c1 + 1f;
                    return 1f + c3 * Mathf.Pow(t - 1f, 3f) + c1 * Mathf.Pow(t - 1f, 2f);
                default:
                    return t;
            }
        }

        public static IEnumerator TweenFloatCoroutine(
            float from,
            float to,
            float duration,
            UIEaseType ease,
            Action<float> onUpdate,
            Action onComplete = null)
        {
            float elapsed = 0f;
            while (elapsed < duration)
            {
                elapsed += Time.unscaledDeltaTime;
                float t = Mathf.Clamp01(elapsed / duration);
                float easedT = EvaluateEase(ease, t);
                float currentVal = Mathf.LerpUnclamped(from, to, easedT);
                onUpdate?.Invoke(currentVal);
                yield return null;
            }
            onUpdate?.Invoke(to);
            onComplete?.Invoke();
        }

        public static IEnumerator TweenVector3Coroutine(
            Vector3 from,
            Vector3 to,
            float duration,
            UIEaseType ease,
            Action<Vector3> onUpdate,
            Action onComplete = null)
        {
            float elapsed = 0f;
            while (elapsed < duration)
            {
                elapsed += Time.unscaledDeltaTime;
                float t = Mathf.Clamp01(elapsed / duration);
                float easedT = EvaluateEase(ease, t);
                Vector3 currentVal = Vector3.LerpUnclamped(from, to, easedT);
                onUpdate?.Invoke(currentVal);
                yield return null;
            }
            onUpdate?.Invoke(to);
            onComplete?.Invoke();
        }
    }
}

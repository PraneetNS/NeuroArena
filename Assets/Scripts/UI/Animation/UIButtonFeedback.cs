using System.Collections;
using UnityEngine;
using UnityEngine.EventSystems;

namespace NeuroArena.UI.Animation
{
    /// <summary>
    /// Tactile Button Press Micro-Scale Feedback.
    /// Scales down on pointer press (0.94x) and springs back with overshoot on release.
    /// </summary>
    public class UIButtonFeedback : MonoBehaviour, IPointerDownHandler, IPointerUpHandler
    {
        [SerializeField] private float pressScale = 0.94f;
        [SerializeField] private float duration = 0.18f;

        private Vector3 originalScale = Vector3.one;
        private Coroutine activeAnim;

        private void Awake()
        {
            originalScale = transform.localScale;
        }

        public void OnPointerDown(PointerEventData eventData)
        {
            if (activeAnim != null) StopCoroutine(activeAnim);
            activeAnim = StartCoroutine(ScaleCoroutine(transform.localScale, originalScale * pressScale, UIEaseType.EaseOutQuad, duration * 0.5f));
        }

        public void OnPointerUp(PointerEventData eventData)
        {
            if (activeAnim != null) StopCoroutine(activeAnim);
            activeAnim = StartCoroutine(ScaleCoroutine(transform.localScale, originalScale, UIEaseType.EaseOutBack, duration));
        }

        private IEnumerator ScaleCoroutine(Vector3 from, Vector3 to, UIEaseType ease, float dur)
        {
            float elapsed = 0f;
            while (elapsed < dur)
            {
                elapsed += Time.unscaledDeltaTime;
                float t = Mathf.Clamp01(elapsed / dur);
                float easedT = UITweener.EvaluateEase(ease, t);
                transform.localScale = Vector3.LerpUnclamped(from, to, easedT);
                yield return null;
            }
            transform.localScale = to;
            activeAnim = null;
        }
    }
}

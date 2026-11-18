using System;
using System.Collections;
using UnityEngine;

namespace NeuroArena.UI.Animation
{
    /// <summary>
    /// Reusable UI Transition Component.
    /// Provides consistent, polished Enter/Exit motion (scale + fade with EaseOutBack overshoot)
    /// for all current and future UI panels without boilerplate.
    /// </summary>
    [RequireComponent(typeof(CanvasGroup))]
    public class UITransition : MonoBehaviour
    {
        [Header("Transition Settings")]
        [SerializeField] private float duration = 0.28f;
        [SerializeField] private Vector3 startScale = new Vector3(0.85f, 0.85f, 0.85f);
        [SerializeField] private Vector3 endScale = Vector3.one;
        [SerializeField] private UIEaseType enterEase = UIEaseType.EaseOutBack;
        [SerializeField] private UIEaseType exitEase = UIEaseType.EaseInQuad;

        private CanvasGroup canvasGroup;
        private Coroutine activeTransition;

        private void Awake()
        {
            canvasGroup = GetComponent<CanvasGroup>();
            if (canvasGroup == null) canvasGroup = gameObject.AddComponent<CanvasGroup>();
        }

        public void PlayEnter(Action onComplete = null)
        {
            gameObject.SetActive(true);
            if (activeTransition != null) StopCoroutine(activeTransition);
            activeTransition = StartCoroutine(EnterCoroutine(onComplete));
        }

        public void PlayExit(Action onComplete = null)
        {
            if (activeTransition != null) StopCoroutine(activeTransition);
            activeTransition = StartCoroutine(ExitCoroutine(() =>
            {
                gameObject.SetActive(false);
                onComplete?.Invoke();
            }));
        }

        private IEnumerator EnterCoroutine(Action onComplete)
        {
            transform.localScale = startScale;
            canvasGroup.alpha = 0f;
            canvasGroup.interactable = false;
            canvasGroup.blocksRaycasts = false;

            float elapsed = 0f;
            while (elapsed < duration)
            {
                elapsed += Time.unscaledDeltaTime;
                float t = Mathf.Clamp01(elapsed / duration);

                float scaleT = UITweener.EvaluateEase(enterEase, t);
                transform.localScale = Vector3.LerpUnclamped(startScale, endScale, scaleT);

                float alphaT = UITweener.EvaluateEase(UIEaseType.EaseOutCubic, t);
                canvasGroup.alpha = Mathf.Lerp(0f, 1f, alphaT);

                yield return null;
            }

            transform.localScale = endScale;
            canvasGroup.alpha = 1f;
            canvasGroup.interactable = true;
            canvasGroup.blocksRaycasts = true;
            activeTransition = null;
            onComplete?.Invoke();
        }

        private IEnumerator ExitCoroutine(Action onComplete)
        {
            canvasGroup.interactable = false;
            canvasGroup.blocksRaycasts = false;

            Vector3 targetExitScale = endScale * 0.90f;
            float elapsed = 0f;
            while (elapsed < duration * 0.8f)
            {
                elapsed += Time.unscaledDeltaTime;
                float t = Mathf.Clamp01(elapsed / (duration * 0.8f));

                float scaleT = UITweener.EvaluateEase(exitEase, t);
                transform.localScale = Vector3.Lerp(endScale, targetExitScale, scaleT);

                canvasGroup.alpha = Mathf.Lerp(1f, 0f, scaleT);
                yield return null;
            }

            canvasGroup.alpha = 0f;
            activeTransition = null;
            onComplete?.Invoke();
        }
    }
}

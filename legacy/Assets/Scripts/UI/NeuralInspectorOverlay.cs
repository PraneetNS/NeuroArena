using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace NeuroArena.UI
{
    public class NeuralInspectorOverlay : MonoBehaviour
    {
        [Header("Inspector Settings")]
        [SerializeField] private bool showOverlay = true;
        [SerializeField] private KeyCode toggleKey = KeyCode.F3;
        [SerializeField] private CanvasGroup overlayCanvasGroup;

        [Header("Telemetry Labels")]
        [SerializeField] private Text fpsText;
        [SerializeField] private Text lossText;
        [SerializeField] private Text learningRateText;
        [SerializeField] private Text memoryUsageText;
        [SerializeField] private Text activeWeightsText;

        private float _deltaTime = 0.0f;
        private List<float> _lossHistory = new List<float>();

        private void Update()
        {
            if (Input.GetKeyDown(toggleKey))
            {
                showOverlay = !showOverlay;
                if (overlayCanvasGroup != null)
                {
                    overlayCanvasGroup.alpha = showOverlay ? 1.0f : 0.0f;
                    overlayCanvasGroup.interactable = showOverlay;
                    overlayCanvasGroup.blocksRaycasts = showOverlay;
                }
            }

            if (!showOverlay) return;

            _deltaTime += (Time.unscaledDeltaTime - _deltaTime) * 0.1f;
            float fps = 1.0f / _deltaTime;

            if (fpsText != null)
                fpsText.text = $"FPS: {fps:F1}";

            if (memoryUsageText != null)
            {
                long mem = System.GC.GetTotalMemory(false) / (1024 * 1024);
                memoryUsageText.text = $"Managed Mem: {mem} MB";
            }
        }

        public void UpdateNeuralStats(float currentLoss, float lr, int totalParameters)
        {
            if (lossText != null) lossText.text = $"Current Loss (MSE): {currentLoss:F5}";
            if (learningRateText != null) learningRateText.text = $"Optimizer LR: {lr:E3}";
            if (activeWeightsText != null) activeWeightsText.text = $"Active Tensor Params: {totalParameters:N0}";

            _lossHistory.Add(currentLoss);
            if (_lossHistory.Count > 100) _lossHistory.RemoveAt(0);
        }
    }
}

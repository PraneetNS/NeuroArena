using UnityEngine;

namespace NeuroArena.UI
{
    [RequireComponent(typeof(RectTransform))]
    public class TensorDebugGraph : MonoBehaviour
    {
        [SerializeField] private Color graphColor = new Color(0.2f, 0.8f, 1.0f, 0.9f);
        [SerializeField] private float[] dataPoints = new float[64];
        [SerializeField] private float maxValue = 1.0f;
        [SerializeField] private float minValue = 0.0f;

        public void PushValue(float val)
        {
            for (int i = 0; i < dataPoints.Length - 1; i++)
            {
                dataPoints[i] = dataPoints[i + 1];
            }
            dataPoints[dataPoints.Length - 1] = val;
        }

        public void Clear()
        {
            for (int i = 0; i < dataPoints.Length; i++)
                dataPoints[i] = 0f;
        }

        public float GetAverage()
        {
            if (dataPoints.Length == 0) return 0f;
            float sum = 0f;
            for (int i = 0; i < dataPoints.Length; i++) sum += dataPoints[i];
            return sum / dataPoints.Length;
        }
    }
}

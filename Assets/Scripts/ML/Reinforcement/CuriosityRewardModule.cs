using UnityEngine;

namespace NeuroArena.ML.Reinforcement
{
    public class CuriosityRewardModule : MonoBehaviour
    {
        [Header("Curiosity Parameters")]
        [SerializeField] private float curiosityWeight = 0.05f;
        [SerializeField] private int featureDim = 8;

        public float CalculateIntrinsicReward(float[] predictedNextState, float[] actualNextState)
        {
            if (predictedNextState == null || actualNextState == null) return 0f;
            int len = Mathf.Min(predictedNextState.Length, actualNextState.Length);
            
            float predictionErrorSqr = 0f;
            for (int i = 0; i < len; i++)
            {
                float diff = predictedNextState[i] - actualNextState[i];
                predictionErrorSqr += diff * diff;
            }

            float intrinsicReward = (0.5f * predictionErrorSqr) * curiosityWeight;
            return Mathf.Clamp(intrinsicReward, 0f, 1.0f);
        }
    }
}

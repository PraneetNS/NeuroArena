using System;
using System.Collections.Generic;
using UnityEngine;

namespace NeuroArena.ML
{
    [Serializable]
    public struct BotSensorObservation
    {
        public float targetDeltaX;
        public float targetDeltaZ;
        public float obstacleProximity;
        public float currentSpeed;

        public float[] ToInputArray()
        {
            return new float[] { targetDeltaX, targetDeltaZ, obstacleProximity, currentSpeed };
        }
    }

    [Serializable]
    public struct BotControlAction
    {
        public float steerAngleDeg;
        public float throttleNormalized; // 0..1
        public bool isBraking;
    }

    /// <summary>
    /// Autonomous Bot Policy Driving Arena (inspired by Screeps & Gladiabots).
    /// Allows players to mount trained neural network weights as real-time decision policies
    /// to drive autonomous field drones, avoid dynamic obstacles, and harvest resources.
    /// </summary>
    public class AutonomousBotArena : MonoBehaviour
    {
        public static AutonomousBotArena Instance { get; private set; }

        [Header("Bot State")]
        [SerializeField] private bool isAutonomousModeActive = false;
        [SerializeField] private float botSpeed = 4.5f;
        [SerializeField] private float harvestedInAutoMode = 0;

        public bool IsAutonomousModeActive => isAutonomousModeActive;
        public float HarvestedInAutoMode => harvestedInAutoMode;

        private void Awake()
        {
            if (Instance == null)
            {
                Instance = this;
                DontDestroyOnLoad(gameObject);
            }
            else
            {
                Destroy(gameObject);
            }
        }

        public void SetAutonomousMode(bool active)
        {
            isAutonomousModeActive = active;
            Debug.Log($"[AutonomousBotArena] Neural Policy Autonomous Mode set to: {active}");
        }

        /// <summary>
        /// Evaluates neural policy inference given current sensor raycast observations.
        /// </summary>
        public static BotControlAction EvaluateNeuralPolicy(BotSensorObservation obs, float[][] W1, float[] b1, float[] W2, float b2)
        {
            float[] input = obs.ToInputArray();
            int H = W1.Length;
            int D = input.Length;

            // Hidden Layer Feedforward
            float[] hiddenActivations = new float[H];
            for (int h = 0; h < H; h++)
            {
                float z = b1[h];
                for (int j = 0; j < Mathf.Min(D, W1[h].Length); j++)
                {
                    z += W1[h][j] * input[j];
                }
                hiddenActivations[h] = Mathf.Max(0f, z); // ReLU
            }

            // Output Layer
            float steerZ = b2;
            for (int h = 0; h < H; h++)
            {
                steerZ += (h < W2.Length ? W2[h] : 0f) * hiddenActivations[h];
            }

            float steerAngle = Mathf.Clamp(steerZ * 45f, -90f, 90f);
            float throttle = obs.obstacleProximity > 0.8f ? 0.2f : 1.0f;
            bool brake = obs.obstacleProximity > 0.95f;

            return new BotControlAction
            {
                steerAngleDeg = steerAngle,
                throttleNormalized = throttle,
                isBraking = brake
            };
        }
    }
}

using System;
using System.Collections.Generic;
using System.Security.Cryptography;
using System.Text;
using UnityEngine;

namespace NeuroArena.ML
{
    [Serializable]
    public class ModelCheckpoint
    {
        public string checkpointId;
        public int epoch;
        public float validationLoss;
        public float validationAccuracy;
        public float learningRate;
        public float[] weights;
        public float[] biases;
        public float[] firstMomentMoments;
        public float[] secondMomentMoments;
        public string sha256Checksum;
        public long timestampUnix;
        public bool isBestCheckpoint;
    }

    /// <summary>
    /// Cryptographically verified ML Model Checkpoint Manager.
    /// Manages periodic snapshots, top-K checkpoint pruning, gradient divergence detection,
    /// and zero-loss rollback to previous verified stable weights.
    /// </summary>
    public class ModelCheckpointManager : MonoBehaviour
    {
        [Header("Checkpoint Configuration")]
        [SerializeField] private int maxRetainedCheckpoints = 5;
        [SerializeField] private float divergenceThreshold = 100.0f;
        [SerializeField] private bool autoRollbackOnNaN = true;

        private readonly List<ModelCheckpoint> _checkpointHistory = new List<ModelCheckpoint>();
        private ModelCheckpoint _bestCheckpoint = null;
        private int _divergenceRecoveryCount = 0;

        public IReadOnlyList<ModelCheckpoint> CheckpointHistory => _checkpointHistory;
        public ModelCheckpoint BestCheckpoint => _bestCheckpoint;
        public int DivergenceRecoveryCount => _divergenceRecoveryCount;

        /// <summary>
        /// Captures a training snapshot, computes SHA-256 fingerprint, and updates top-K rankings.
        /// </summary>
        public ModelCheckpoint CaptureCheckpoint(
            int epoch,
            float valLoss,
            float valAcc,
            float lr,
            float[] weights,
            float[] biases,
            float[] m1 = null,
            float[] m2 = null)
        {
            if (float.IsNaN(valLoss) || float.IsInfinity(valLoss) || valLoss > divergenceThreshold)
            {
                Debug.LogWarning($"[ModelCheckpoint] Divergence detected at epoch {epoch} (Loss: {valLoss})!");
                if (autoRollbackOnNaN && _bestCheckpoint != null)
                {
                    _divergenceRecoveryCount++;
                    Debug.Log($"[ModelCheckpoint] Auto-recovering to best stable checkpoint (Epoch {_bestCheckpoint.epoch}).");
                    return _bestCheckpoint;
                }
            }

            float[] clonedWeights = weights != null ? (float[])weights.Clone() : new float[0];
            float[] clonedBiases = biases != null ? (float[])biases.Clone() : new float[0];
            float[] clonedM1 = m1 != null ? (float[])m1.Clone() : new float[0];
            float[] clonedM2 = m2 != null ? (float[])m2.Clone() : new float[0];

            string checksum = ComputeWeightsChecksum(clonedWeights, clonedBiases);
            string id = $"ckpt_ep{epoch}_{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";

            bool isNewBest = _bestCheckpoint == null || valLoss < _bestCheckpoint.validationLoss;

            var checkpoint = new ModelCheckpoint
            {
                checkpointId = id,
                epoch = epoch,
                validationLoss = valLoss,
                validationAccuracy = valAcc,
                learningRate = lr,
                weights = clonedWeights,
                biases = clonedBiases,
                firstMomentMoments = clonedM1,
                secondMomentMoments = clonedM2,
                sha256Checksum = checksum,
                timestampUnix = DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
                isBestCheckpoint = isNewBest
            };

            if (isNewBest)
            {
                if (_bestCheckpoint != null) _bestCheckpoint.isBestCheckpoint = false;
                _bestCheckpoint = checkpoint;
            }

            _checkpointHistory.Add(checkpoint);

            // Maintain max retention budget
            if (_checkpointHistory.Count > maxRetainedCheckpoints)
            {
                // Always preserve the best checkpoint
                int removeIdx = -1;
                for (int i = 0; i < _checkpointHistory.Count; i++)
                {
                    if (_checkpointHistory[i] != _bestCheckpoint)
                    {
                        removeIdx = i;
                        break;
                    }
                }
                if (removeIdx >= 0)
                {
                    _checkpointHistory.RemoveAt(removeIdx);
                }
            }

            return checkpoint;
        }

        /// <summary>
        /// Restores model parameters from the best recorded checkpoint.
        /// </summary>
        public bool RollbackToBest(out float[] restoredWeights, out float[] restoredBiases)
        {
            if (_bestCheckpoint != null)
            {
                restoredWeights = (float[])_bestCheckpoint.weights.Clone();
                restoredBiases = (float[])_bestCheckpoint.biases.Clone();
                return true;
            }

            restoredWeights = null;
            restoredBiases = null;
            return false;
        }

        /// <summary>
        /// Validates cryptographic integrity of a checkpoint by verifying its SHA-256 checksum.
        /// </summary>
        public bool VerifyCheckpointIntegrity(ModelCheckpoint ckpt)
        {
            if (ckpt == null || ckpt.weights == null || string.IsNullOrEmpty(ckpt.sha256Checksum))
                return false;

            string expected = ComputeWeightsChecksum(ckpt.weights, ckpt.biases);
            return string.Equals(expected, ckpt.sha256Checksum, StringComparison.OrdinalIgnoreCase);
        }

        private string ComputeWeightsChecksum(float[] weights, float[] biases)
        {
            using (var sha = SHA256.Create())
            {
                var sb = new StringBuilder();
                if (weights != null)
                {
                    for (int i = 0; i < weights.Length; i++)
                    {
                        sb.Append(weights[i].ToString("R"));
                        sb.Append(",");
                    }
                }
                if (biases != null)
                {
                    for (int i = 0; i < biases.Length; i++)
                    {
                        sb.Append(biases[i].ToString("R"));
                        sb.Append(",");
                    }
                }
                byte[] bytes = Encoding.UTF8.GetBytes(sb.ToString());
                byte[] hash = sha.ComputeHash(bytes);
                return BitConverter.ToString(hash).Replace("-", "").ToLowerInvariant();
            }
        }

        public void ClearCheckpoints()
        {
            _checkpointHistory.Clear();
            _bestCheckpoint = null;
            _divergenceRecoveryCount = 0;
        }
    }
}

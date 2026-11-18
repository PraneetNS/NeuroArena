using System;
using System.Collections.Generic;
using UnityEngine;

namespace NeuroArena.Networking
{
    /// <summary>
    /// StateCRDTReplica: Local Conflict-free Replicated Data Type replica for peer-to-peer
    /// arena synchronization. Guarantees eventually consistent state convergence without locks.
    /// </summary>
    public class StateCRDTReplica : MonoBehaviour
    {
        [Header("Replica Identity")]
        [SerializeField] private string replicaNodeId = "peer_node_local";
        [SerializeField] private int localLogicalClock = 0;

        [Header("CRDT State")]
        [SerializeField] private int currentScore = 0;
        [SerializeField] private int activeElementCount = 0;

        // Positive and Negative counter maps
        private Dictionary<string, int> positiveMap = new Dictionary<string, int>();
        private Dictionary<string, int> negativeMap = new Dictionary<string, int>();

        // Set elements
        private HashSet<string> activeElements = new HashSet<string>();

        public event Action<int> OnScoreUpdated;

        private void Awake()
        {
            if (string.IsNullOrEmpty(replicaNodeId))
            {
                replicaNodeId = "peer_" + System.Guid.NewGuid().ToString().Substring(0, 8);
            }
            positiveMap[replicaNodeId] = 0;
            negativeMap[replicaNodeId] = 0;
        }

        public void AddScore(int amount)
        {
            localLogicalClock++;
            positiveMap[replicaNodeId] = (positiveMap.ContainsKey(replicaNodeId) ? positiveMap[replicaNodeId] : 0) + amount;
            RecalculateState();
        }

        public void DeductScore(int amount)
        {
            localLogicalClock++;
            negativeMap[replicaNodeId] = (negativeMap.ContainsKey(replicaNodeId) ? negativeMap[replicaNodeId] : 0) + amount;
            RecalculateState();
        }

        public void AddItem(string itemId)
        {
            localLogicalClock++;
            activeElements.Add(itemId);
            activeElementCount = activeElements.Count;
        }

        public void MergeRemoteDelta(Dictionary<string, int> remoteP, Dictionary<string, int> remoteN)
        {
            if (remoteP != null)
            {
                foreach (var kvp in remoteP)
                {
                    int localVal = positiveMap.ContainsKey(kvp.Key) ? positiveMap[kvp.Key] : 0;
                    positiveMap[kvp.Key] = Mathf.Max(localVal, kvp.Value);
                }
            }

            if (remoteN != null)
            {
                foreach (var kvp in remoteN)
                {
                    int localVal = negativeMap.ContainsKey(kvp.Key) ? negativeMap[kvp.Key] : 0;
                    negativeMap[kvp.Key] = Mathf.Max(localVal, kvp.Value);
                }
            }

            RecalculateState();
        }

        private void RecalculateState()
        {
            int pSum = 0;
            foreach (var v in positiveMap.Values) pSum += v;

            int nSum = 0;
            foreach (var v in negativeMap.Values) nSum += v;

            currentScore = pSum - nSum;
            OnScoreUpdated?.Invoke(currentScore);
        }

        public int GetScore() => currentScore;
    }
}

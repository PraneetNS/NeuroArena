using System;
using System.Collections.Generic;
using System.Security.Cryptography;
using System.Text;
using UnityEngine;

namespace NeuroArena.Security
{
    /// <summary>
    /// GameplayExecutionTrace: Client-side cryptographic state recorder. Accumulates per-tick
    /// kinematic telemetry, generates rolling SHA-256 commitments, and computes match Merkle roots.
    /// </summary>
    public class GameplayExecutionTrace : MonoBehaviour
    {
        [System.Serializable]
        public struct StateTickTransition
        {
            public int tick;
            public Vector3 position;
            public Vector3 velocity;
            public Vector3 action;
            public Vector3 nextPosition;
            public string commitmentHash;
        }

        [Header("Telemetry Accumulator")]
        [SerializeField] private string currentMatchId = "match_local_01";
        [SerializeField] private int currentTick = 0;
        [SerializeField] private string currentMerkleRoot;
        [SerializeField] private int loggedTransitionsCount = 0;

        private readonly List<StateTickTransition> transitions = new List<StateTickTransition>();

        public string CurrentMerkleRoot => currentMerkleRoot;
        public IReadOnlyList<StateTickTransition> Transitions => transitions;

        /// <summary>
        /// Records a verified physical step transition and hashes commitment
        /// </summary>
        public void RecordTransition(Vector3 pos, Vector3 vel, Vector3 action, Vector3 nextPos)
        {
            currentTick++;
            string commitment = ComputeHash($"{currentTick}|{pos:F3}|{vel:F3}|{action:F3}|{nextPos:F3}");

            var transition = new StateTickTransition
            {
                tick = currentTick,
                position = pos,
                velocity = vel,
                action = action,
                nextPosition = nextPos,
                commitmentHash = commitment
            };

            transitions.Add(transition);
            loggedTransitionsCount = transitions.Count;

            // Periodically compute Merkle root every 60 frames
            if (transitions.Count % 60 == 0)
            {
                currentMerkleRoot = ComputeMerkleRoot();
            }
        }

        public string ComputeMerkleRoot()
        {
            if (transitions.Count == 0) return string.Empty;

            List<string> currentLevel = new List<string>();
            foreach (var t in transitions) currentLevel.Add(t.commitmentHash);

            using (var sha = SHA256.Create())
            {
                while (currentLevel.Count > 1)
                {
                    var nextLevel = new List<string>();
                    for (int i = 0; i < currentLevel.Count; i += 2)
                    {
                        if (i + 1 < currentLevel.Count)
                        {
                            byte[] bytes = Encoding.UTF8.GetBytes(currentLevel[i] + currentLevel[i + 1]);
                            nextLevel.Add(BitConverter.ToString(sha.ComputeHash(bytes)).Replace("-", "").ToLowerInvariant());
                        }
                        else
                        {
                            nextLevel.Add(currentLevel[i]);
                        }
                    }
                    currentLevel = nextLevel;
                }
            }

            return currentLevel[0];
        }

        private static string ComputeHash(string input)
        {
            using (var sha = SHA256.Create())
            {
                byte[] bytes = Encoding.UTF8.GetBytes(input);
                byte[] hash = sha.ComputeHash(bytes);
                return BitConverter.ToString(hash).Replace("-", "").ToLowerInvariant();
            }
        }
    }
}

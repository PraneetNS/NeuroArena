using System;
using System.Collections.Generic;
using UnityEngine;

namespace NeuroArena.AI
{
    /// <summary>
    /// HypergraphSquadCoordinator: Clusters dynamic multi-agent squads into higher-order hyperedges
    /// based on convex spatial clustering and tactical role complementarity.
    /// </summary>
    public class HypergraphSquadCoordinator : MonoBehaviour
    {
        [System.Serializable]
        public class HyperedgeSquad
        {
            public string squadId;
            public List<Transform> memberAgents = new List<Transform>();
            public Vector3 squadCentroid;
            public float formationRadius;
            public float synergyRating;
        }

        [Header("Squad Clustering")]
        [SerializeField] private float hyperedgeDistanceThreshold = 18.0f;
        [SerializeField] private int minSquadSize = 3;
        [SerializeField] private int maxSquadSize = 6;

        [Header("Active Hyperedges")]
        [SerializeField] private List<HyperedgeSquad> activeSquads = new List<HyperedgeSquad>();

        public IReadOnlyList<HyperedgeSquad> ActiveSquads => activeSquads;

        /// <summary>
        /// Partitions an agent pool into spatial hyperedges
        /// </summary>
        public void ReclusterHyperedges(IReadOnlyList<Transform> allAgents)
        {
            activeSquads.Clear();
            if (allAgents == null || allAgents.Count == 0) return;

            var unassigned = new HashSet<Transform>(allAgents);
            int squadIndex = 1;

            foreach (var seed in allAgents)
            {
                if (!unassigned.Contains(seed)) continue;

                var currentSquad = new HyperedgeSquad
                {
                    squadId = $"squad_hyper_{squadIndex++}",
                    memberAgents = new List<Transform> { seed }
                };
                unassigned.Remove(seed);

                // Find nearby agents within hyperedge proximity
                foreach (var candidate in allAgents)
                {
                    if (unassigned.Contains(candidate) &&
                        Vector3.Distance(seed.position, candidate.position) <= hyperedgeDistanceThreshold)
                    {
                        currentSquad.memberAgents.Add(candidate);
                        unassigned.Remove(candidate);

                        if (currentSquad.memberAgents.Count >= maxSquadSize) break;
                    }
                }

                // Compute centroid and radius
                Vector3 sum = Vector3.zero;
                foreach (var member in currentSquad.memberAgents)
                {
                    sum += member.position;
                }
                currentSquad.squadCentroid = sum / currentSquad.memberAgents.Count;

                float maxR = 0f;
                foreach (var member in currentSquad.memberAgents)
                {
                    float dist = Vector3.Distance(currentSquad.squadCentroid, member.position);
                    if (dist > maxR) maxR = dist;
                }
                currentSquad.formationRadius = maxR;
                currentSquad.synergyRating = Mathf.Clamp01(1.0f - (maxR / hyperedgeDistanceThreshold));

                activeSquads.Add(currentSquad);
            }
        }
    }
}

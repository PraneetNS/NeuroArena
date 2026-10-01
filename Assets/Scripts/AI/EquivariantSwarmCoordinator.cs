using System;
using System.Collections.Generic;
using UnityEngine;

namespace NeuroArena.AI
{
    /// <summary>
    /// EquivariantSwarmCoordinator: Implements an E(n)-Equivariant Graph Neural Network (EGNN)
    /// layer for 3D multi-agent flocking and combat coordination.
    /// Guarantees exact rotational, translational, and reflectional equivariance for spatial coordinates:
    ///   x_i^{(l+1)} = x_i^{(l)} + C \sum_{j \in N(i)} (x_i^{(l)} - x_j^{(l)}) \phi_x(h_i^{(l)}, h_j^{(l)}, ||x_i - x_j||^2)
    /// </summary>
    public class EquivariantSwarmCoordinator : MonoBehaviour
    {
        [Header("Swarm Configuration")]
        [SerializeField] private float perceptionRadius = 15.0f;
        [SerializeField] private float coordinationWeight = 0.8f;
        [SerializeField] private int featureDim = 8;

        private float[] invariantFeatures;
        private Rigidbody rb;

        private void Awake()
        {
            rb = GetComponent<Rigidbody>();
            invariantFeatures = new float[featureDim];
            for (int i = 0; i < featureDim; i++)
            {
                invariantFeatures[i] = UnityEngine.Random.Range(0.1f, 1.0f);
            }
        }

        /// <summary>
        /// Computes equivariant coordinate update step based on neighboring swarm agents
        /// </summary>
        public Vector3 ComputeEquivariantDisplacement(List<EquivariantSwarmCoordinator> neighbors)
        {
            if (neighbors == null || neighbors.Count == 0) return Vector3.zero;

            Vector3 coordinateDelta = Vector3.zero;
            Vector3 myPos = transform.position;

            foreach (var neighbor in neighbors)
            {
                if (neighbor == this) continue;

                Vector3 diff = myPos - neighbor.transform.position;
                float distSq = diff.sqrMagnitude;
                if (distSq > perceptionRadius * perceptionRadius || distSq < 0.0001f) continue;

                // Equivariant scalar weight \phi_x depends ONLY on invariant distance and features
                float featureDot = 0f;
                for (int i = 0; i < featureDim; i++)
                {
                    featureDot += invariantFeatures[i] * neighbor.invariantFeatures[i];
                }
                float scalarWeight = Mathf.Exp(-distSq * 0.1f) * Mathf.Sin(featureDot);

                // Equivariant vector aggregation: scale the coordinate difference vector
                coordinateDelta += diff.normalized * scalarWeight;
            }

            return coordinateDelta * coordinationWeight;
        }

        private void FixedUpdate()
        {
            // In live play, swarm coordinates query neighbors in radius
            Collider[] hits = UnityEngine.Physics.OverlapSphere(transform.position, perceptionRadius);
            List<EquivariantSwarmCoordinator> nearbyAgents = new List<EquivariantSwarmCoordinator>();

            for (int i = 0; i < hits.Length; i++)
            {
                var agent = hits[i].GetComponent<EquivariantSwarmCoordinator>();
                if (agent != null && agent != this)
                {
                    nearbyAgents.Add(agent);
                }
            }

            if (nearbyAgents.Count > 0)
            {
                Vector3 disp = ComputeEquivariantDisplacement(nearbyAgents);
                if (rb != null)
                {
                    rb.AddForce(disp * 10f, ForceMode.Acceleration);
                }
                else
                {
                    transform.position += disp * Time.fixedDeltaTime;
                }
            }
        }
    }
}

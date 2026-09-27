using System;
using System.Collections.Generic;
using UnityEngine;

namespace NeuroArena.AI
{
    /// <summary>
    /// Swarm Flocking Sensor Engine in Unity C#.
    /// Implements Craig Reynolds Boids principles (Separation, Alignment, Cohesion)
    /// augmented with external Graph Neural Network (GNN) guidance forces,
    /// dynamic hazard avoidance, and sensory perception envelopes.
    /// </summary>
    public class SwarmFlockingSensorEngine : MonoBehaviour
    {
        [Header("Swarm Kinematics")]
        [SerializeField] private float maxSpeed = 12.0f;
        [SerializeField] private float maxSteerForce = 8.0f;
        [SerializeField] private float neighborPerceptionRadius = 15.0f;
        [SerializeField] private float separationDistance = 4.0f;

        [Header("Flocking Rule Weights")]
        [Range(0f, 3f)] [SerializeField] private float separationWeight = 1.8f;
        [Range(0f, 3f)] [SerializeField] private float alignmentWeight = 1.2f;
        [Range(0f, 3f)] [SerializeField] private float cohesionWeight = 1.0f;
        [Range(0f, 5f)] [SerializeField] private float gnnGuidanceWeight = 2.0f;
        [Range(0f, 5f)] [SerializeField] private float obstacleAvoidanceWeight = 3.0f;

        [Header("Sensory Rays")]
        [SerializeField] private int sensorRayCount = 7;
        [SerializeField] private float sensorRayLength = 10.0f;
        [SerializeField] private LayerMask obstacleLayerMask;

        // Dynamic motion state
        private Vector3 _velocity;
        private Vector3 _currentGnnForce = Vector3.zero;
        private readonly List<SwarmFlockingSensorEngine> _activeNeighbors = new List<SwarmFlockingSensorEngine>();

        public Vector3 Velocity => _velocity;
        public float Speed => _velocity.magnitude;

        private void Awake()
        {
            // Initial random heading
            _velocity = UnityEngine.Random.insideUnitSphere * (maxSpeed * 0.5f);
            _velocity.y = 0; // Maintain planar bias initially
        }

        /// <summary>
        /// Injects guidance acceleration from server-side GNN or local neuromorphic policy.
        /// </summary>
        /// <param name="gnnAcceleration">3D steering acceleration vector</param>
        public void ApplyGNNSteeringForce(Vector3 gnnAcceleration)
        {
            _currentGnnForce = Vector3.ClampMagnitude(gnnAcceleration, maxSteerForce);
        }

        /// <summary>
        /// Updates the flocking and sensory steering step given a collection of nearby swarm mates.
        /// </summary>
        /// <param name="allSwarmAgents">All active agents in the swarm sector</param>
        /// <param name="dt">Simulation delta time</param>
        public void StepSwarm(IReadOnlyList<SwarmFlockingSensorEngine> allSwarmAgents, float dt)
        {
            FindNeighbors(allSwarmAgents);

            Vector3 separationForce = ComputeSeparation();
            Vector3 alignmentForce = ComputeAlignment();
            Vector3 cohesionForce = ComputeCohesion();
            Vector3 obstacleForce = ComputeObstacleAvoidance();

            // Total net acceleration
            Vector3 totalAcceleration = (separationForce * separationWeight) +
                                       (alignmentForce * alignmentWeight) +
                                       (cohesionForce * cohesionWeight) +
                                       (obstacleForce * obstacleAvoidanceWeight) +
                                       (_currentGnnForce * gnnGuidanceWeight);

            totalAcceleration = Vector3.ClampMagnitude(totalAcceleration, maxSteerForce);

            // Euler kinematic integration
            _velocity += totalAcceleration * dt;
            _velocity = Vector3.ClampMagnitude(_velocity, maxSpeed);

            transform.position += _velocity * dt;

            // Orient towards velocity vector if moving
            if (_velocity.sqrMagnitude > 0.01f)
            {
                transform.rotation = Quaternion.Slerp(transform.rotation, Quaternion.LookRotation(_velocity), dt * 6.0f);
            }
        }

        private void FindNeighbors(IReadOnlyList<SwarmFlockingSensorEngine> allSwarmAgents)
        {
            _activeNeighbors.Clear();
            float rSq = neighborPerceptionRadius * neighborPerceptionRadius;
            Vector3 myPos = transform.position;

            for (int i = 0; i < allSwarmAgents.Count; i++)
            {
                SwarmFlockingSensorEngine other = allSwarmAgents[i];
                if (other == null || other == this) continue;

                float dSq = (other.transform.position - myPos).sqrMagnitude;
                if (dSq <= rSq)
                {
                    _activeNeighbors.Add(other);
                }
            }
        }

        private Vector3 ComputeSeparation()
        {
            Vector3 steer = Vector3.zero;
            int count = 0;
            Vector3 myPos = transform.position;

            for (int i = 0; i < _activeNeighbors.Count; i++)
            {
                Vector3 diff = myPos - _activeNeighbors[i].transform.position;
                float dist = diff.magnitude;

                if (dist > 0.001f && dist < separationDistance)
                {
                    // Weight inversely proportional to distance
                    steer += (diff.normalized / dist);
                    count++;
                }
            }

            if (count > 0)
            {
                steer /= count;
                steer = steer.normalized * maxSpeed - _velocity;
                steer = Vector3.ClampMagnitude(steer, maxSteerForce);
            }

            return steer;
        }

        private Vector3 ComputeAlignment()
        {
            Vector3 avgVelocity = Vector3.zero;
            int count = _activeNeighbors.Count;
            if (count == 0) return Vector3.zero;

            for (int i = 0; i < count; i++)
            {
                avgVelocity += _activeNeighbors[i].Velocity;
            }

            avgVelocity /= count;
            Vector3 steer = avgVelocity.normalized * maxSpeed - _velocity;
            return Vector3.ClampMagnitude(steer, maxSteerForce);
        }

        private Vector3 ComputeCohesion()
        {
            Vector3 centerOfMass = Vector3.zero;
            int count = _activeNeighbors.Count;
            if (count == 0) return Vector3.zero;

            for (int i = 0; i < count; i++)
            {
                centerOfMass += _activeNeighbors[i].transform.position;
            }

            centerOfMass /= count;
            Vector3 desired = centerOfMass - transform.position;
            Vector3 steer = desired.normalized * maxSpeed - _velocity;
            return Vector3.ClampMagnitude(steer, maxSteerForce);
        }

        private Vector3 ComputeObstacleAvoidance()
        {
            Vector3 avoidanceSteer = Vector3.zero;
            Vector3 forward = transform.forward;
            float goldenAngle = 2.39996323f; // Golden ratio spiral distribution

            for (int i = 0; i < sensorRayCount; i++)
            {
                float t = (float)i / sensorRayCount;
                float inclination = Mathf.Acos(1f - 2f * t) * 0.4f; // Narrow frontal cone
                float azimuth = goldenAngle * i;

                Vector3 dir = transform.rotation * new Vector3(
                    Mathf.Sin(inclination) * Mathf.Cos(azimuth),
                    Mathf.Sin(inclination) * Mathf.Sin(azimuth),
                    Mathf.Cos(inclination)
                );

                if (Physics.Raycast(transform.position, dir, out RaycastHit hit, sensorRayLength, obstacleLayerMask))
                {
                    // Deflect away from collision normal
                    float penetration = 1.0f - (hit.distance / sensorRayLength);
                    avoidanceSteer += hit.normal * (penetration * maxSteerForce * 1.5f);
                }
            }

            return avoidanceSteer;
        }

        private void OnDrawGizmosSelected()
        {
            Gizmos.color = new Color(0f, 0.8f, 1f, 0.25f);
            Gizmos.DrawWireSphere(transform.position, neighborPerceptionRadius);

            Gizmos.color = new Color(1f, 0.2f, 0.2f, 0.35f);
            Gizmos.DrawWireSphere(transform.position, separationDistance);
        }
    }
}

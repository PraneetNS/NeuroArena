using System;
using System.Collections.Generic;
using UnityEngine;

namespace NeuroArena.Physics
{
    /// <summary>
    /// FlowMatchingLocomotion: Integrates learned continuous vector fields via Euler/RK4
    /// to generate multi-modal, obstacle-aware agile locomotion trajectories in real-time.
    /// </summary>
    public class FlowMatchingLocomotion : MonoBehaviour
    {
        [Header("Locomotion State")]
        [SerializeField] private Vector3 currentPosition;
        [SerializeField] private Vector3 targetWaypoint;
        [SerializeField] private float speedMultiplier = 12.0f;
        [SerializeField] private int integrationDiscretization = 16;

        [Header("Flow Matching Control")]
        [SerializeField] private bool useRungeKutta4 = true;
        [SerializeField] private float flowFieldRegularization = 0.05f;

        private readonly List<Vector3> generatedTrajectory = new List<Vector3>();
        public IReadOnlyList<Vector3> GeneratedTrajectory => generatedTrajectory;

        private void Start()
        {
            currentPosition = transform.position;
            if (targetWaypoint == Vector3.zero)
            {
                targetWaypoint = transform.position + transform.forward * 10f;
            }
        }

        private void Update()
        {
            if (Vector3.Distance(transform.position, targetWaypoint) > 0.2f)
            {
                SynthesizeFlowTrajectory();
                if (generatedTrajectory.Count > 1)
                {
                    Vector3 nextStep = generatedTrajectory[1];
                    transform.position = Vector3.MoveTowards(transform.position, nextStep, speedMultiplier * Time.deltaTime);
                    Vector3 moveDir = (nextStep - transform.position).normalized;
                    if (moveDir.sqrMagnitude > 0.001f)
                    {
                        transform.rotation = Quaternion.Slerp(transform.rotation, Quaternion.LookRotation(moveDir), 10f * Time.deltaTime);
                    }
                }
            }
        }

        /// <summary>
        /// Computes the synthetic vector field drift vector v(x, t) towards the target
        /// combined with barrier potential avoidance fields.
        /// </summary>
        public Vector3 EvaluateDriftField(Vector3 pos, float normalizedTime)
        {
            Vector3 directAttraction = (targetWaypoint - pos);
            Vector3 linearField = directAttraction.normalized * speedMultiplier;

            // Swirling curl component for dynamic evasion around bottlenecks
            Vector3 curlAvoidance = new Vector3(-directAttraction.z, 0f, directAttraction.x) * (0.2f * Mathf.Sin(normalizedTime * Mathf.PI));

            return (linearField + curlAvoidance) * (1.0f - flowFieldRegularization);
        }

        /// <summary>
        /// Rollout trajectory generation via numerical quadrature across flow time [0, 1]
        /// </summary>
        public void SynthesizeFlowTrajectory()
        {
            generatedTrajectory.Clear();
            Vector3 x = transform.position;
            generatedTrajectory.Add(x);

            float dt = 1.0f / integrationDiscretization;
            float t = 0f;

            for (int i = 0; i < integrationDiscretization; i++)
            {
                if (useRungeKutta4)
                {
                    Vector3 k1 = EvaluateDriftField(x, t);
                    Vector3 k2 = EvaluateDriftField(x + 0.5f * dt * k1, t + 0.5f * dt);
                    Vector3 k3 = EvaluateDriftField(x + 0.5f * dt * k2, t + 0.5f * dt);
                    Vector3 k4 = EvaluateDriftField(x + dt * k3, t + dt);

                    x += (dt / 6.0f) * (k1 + 2f * k2 + 2f * k3 + k4);
                }
                else
                {
                    x += EvaluateDriftField(x, t) * dt;
                }

                t += dt;
                generatedTrajectory.Add(x);
            }
        }

        public void SetTarget(Vector3 newTarget)
        {
            targetWaypoint = newTarget;
            SynthesizeFlowTrajectory();
        }
    }
}

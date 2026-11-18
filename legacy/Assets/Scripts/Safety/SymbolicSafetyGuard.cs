using System;
using UnityEngine;

namespace NeuroArena.Safety
{
    /// <summary>
    /// SymbolicSafetyGuard: Real-time runtime safety barrier shield. Intercepts raw unconstrained
    /// neural network actions and projects them onto the admissible safe control polytope.
    /// </summary>
    public class SymbolicSafetyGuard : MonoBehaviour
    {
        [Header("Safety Envelope Limits")]
        [SerializeField] private float maxSafeSpeed = 20.0f;
        [SerializeField] private float minArenaRadius = 45.0f;
        [SerializeField] private float obstacleSafetyMargin = 2.5f;

        [Header("Shield Telemetry")]
        [SerializeField] private bool isActionIntervened = false;
        [SerializeField] private int interventionCount = 0;
        [SerializeField] private Vector3 filteredControlAction;

        public bool IsActionIntervened => isActionIntervened;
        public int InterventionCount => interventionCount;

        /// <summary>
        /// Projects proposed raw neural action onto safety invariant set
        /// </summary>
        public Vector3 ProjectSafeAction(Vector3 currentPos, Vector3 currentVel, Vector3 proposedAction, float dt)
        {
            isActionIntervened = false;
            Vector3 safeAction = proposedAction;

            // 1. Check predicted speed violation: ||v + a*dt|| <= maxSafeSpeed
            Vector3 predictedVel = currentVel + proposedAction * dt;
            if (predictedVel.magnitude > maxSafeSpeed)
            {
                // Scale back acceleration to respect speed ceiling
                Vector3 maxAllowedVel = predictedVel.normalized * maxSafeSpeed;
                safeAction = (maxAllowedVel - currentVel) / dt;
                isActionIntervened = true;
            }

            // 2. Check arena perimeter boundary constraint
            Vector3 predictedPos = currentPos + predictedVel * dt;
            float radialDist = new Vector2(predictedPos.x, predictedPos.z).magnitude;
            if (radialDist > minArenaRadius)
            {
                // Force radial inward restorative acceleration
                Vector3 inwardDir = -new Vector3(predictedPos.x, 0f, predictedPos.z).normalized;
                safeAction += inwardDir * 15.0f;
                isActionIntervened = true;
            }

            if (isActionIntervened)
            {
                interventionCount++;
            }

            filteredControlAction = safeAction;
            return safeAction;
        }
    }
}

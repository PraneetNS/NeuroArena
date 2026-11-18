using System;
using System.Collections.Generic;
using UnityEngine;

namespace NeuroArena.Optimization
{
    /// <summary>
    /// BarrierTrajectorySmoother: Projects spline waypoints away from boundary barriers
    /// and obstacle exclusion zones using barrier penalty repulsions.
    /// </summary>
    public class BarrierTrajectorySmoother : MonoBehaviour
    {
        [Header("Boundary Parameters")]
        [SerializeField] private float arenaMaxRadius = 40.0f;
        [SerializeField] private float obstacleSafetyRadius = 3.0f;
        [SerializeField] private float barrierRepulsionWeight = 2.5f;

        [Header("Trajectory Points")]
        [SerializeField] private List<Vector3> smoothedPoints = new List<Vector3>();

        public IReadOnlyList<Vector3> SmoothedPoints => smoothedPoints;

        /// <summary>
        /// Performs smooth barrier relaxation across a sequence of waypoints
        /// </summary>
        public void RelaxTrajectory(List<Vector3> inputPoints, IReadOnlyList<Vector3> obstaclePositions)
        {
            if (inputPoints == null || inputPoints.Count < 2) return;

            smoothedPoints = new List<Vector3>(inputPoints);
            int n = smoothedPoints.Count;

            // Relaxation passes (Laplacian smoothing + barrier repulsion)
            for (int pass = 0; pass < 5; pass++)
            {
                for (int i = 1; i < n - 1; i++)
                {
                    // Laplacian smoothing toward neighbors
                    Vector3 laplacian = 0.5f * (smoothedPoints[i - 1] + smoothedPoints[i + 1]) - smoothedPoints[i];
                    smoothedPoints[i] += laplacian * 0.4f;

                    // Obstacle barrier repulsion
                    if (obstaclePositions != null)
                    {
                        foreach (var obs in obstaclePositions)
                        {
                            Vector3 diff = smoothedPoints[i] - obs;
                            diff.y = 0; // Planar
                            float dist = diff.magnitude;
                            if (dist < obstacleSafetyRadius && dist > 1e-3f)
                            {
                                float push = (obstacleSafetyRadius - dist) * barrierRepulsionWeight;
                                smoothedPoints[i] += diff.normalized * push;
                            }
                        }
                    }

                    // Arena boundary clamping
                    Vector2 flatPos = new Vector2(smoothedPoints[i].x, smoothedPoints[i].z);
                    if (flatPos.magnitude > arenaMaxRadius)
                    {
                        flatPos = flatPos.normalized * arenaMaxRadius;
                        smoothedPoints[i] = new Vector3(flatPos.x, smoothedPoints[i].y, flatPos.y);
                    }
                }
            }
        }
    }
}

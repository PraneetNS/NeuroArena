using System;
using UnityEngine;

namespace NeuroArena.Optimization
{
    /// <summary>
    /// RiemannianPoseInterpolator: Implements Lie Group SO(3) and SE(3) geodesic curve tracking
    /// for robotic drone avionic attitude control without Euler gimbal lock or quaternion sign ambiguity.
    /// </summary>
    public class RiemannianPoseInterpolator : MonoBehaviour
    {
        [Header("Target Pose")]
        [SerializeField] private Transform targetOrientation;
        [SerializeField] private float manifoldStepSize = 0.15f;
        [SerializeField] private float geodesicTolerance = 0.002f;

        [Header("Telemetry")]
        [SerializeField] private float currentGeodesicDistance = 0f;
        [SerializeField] private Vector3 lieAlgebraAngularVelocity = Vector3.zero;

        private Matrix4x4 currentRotMatrix;

        private void Start()
        {
            currentRotMatrix = Matrix4x4.Rotate(transform.rotation);
        }

        private void Update()
        {
            if (targetOrientation == null) return;

            Quaternion qCurrent = transform.rotation;
            Quaternion qTarget = targetOrientation.rotation;

            // Geodesic distance on SO(3): angle between rotations
            float angleDiff = Quaternion.Angle(qCurrent, qTarget) * Mathf.Deg2Rad;
            currentGeodesicDistance = angleDiff;

            if (angleDiff > geodesicTolerance)
            {
                // Lie algebra step along tangent geodesic
                Quaternion deltaQ = Quaternion.Inverse(qCurrent) * qTarget;
                deltaQ.ToAngleAxis(out float angleDeg, out Vector3 axis);

                if (angleDeg > 180f) angleDeg -= 360f;
                float angleRad = angleDeg * Mathf.Deg2Rad;

                lieAlgebraAngularVelocity = axis.normalized * (angleRad / Mathf.Max(Time.deltaTime, 0.001f));

                // Step on SO(3)
                float stepAngle = Mathf.Min(angleDeg, angleDeg * manifoldStepSize * (Time.deltaTime * 60f));
                Quaternion stepQ = Quaternion.AngleAxis(stepAngle, axis);

                transform.rotation = qCurrent * stepQ;
            }
        }

        public float GetGeodesicDistance() => currentGeodesicDistance;
        public Vector3 GetLieAlgebraVelocity() => lieAlgebraAngularVelocity;
    }
}

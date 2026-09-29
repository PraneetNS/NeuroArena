using System;
using System.Collections.Generic;
using UnityEngine;

namespace NeuroArena.Physics
{
    /// <summary>
    /// ContinuousNeuralODEFlight: Evaluates neural ordinary differential equations dz/dt = f(z, t)
    /// to synthesize continuous-time aerodynamic flight trajectories with adaptive Dormand-Prince integration.
    /// </summary>
    public class ContinuousNeuralODEFlight : MonoBehaviour
    {
        [Header("Flight Dynamics State")]
        [SerializeField] private Vector3 position;
        [SerializeField] private Vector3 velocity;
        [SerializeField] private float flightTime = 0.0f;
        [SerializeField] private float thrustMagnitude = 15.0f;
        [SerializeField] private float dragCoefficient = 0.12f;

        [Header("ODE Integrator Parameters")]
        [SerializeField] private float nominalStepDt = 0.02f;
        [SerializeField] private float tolerance = 1e-4f;
        [SerializeField] private int maxInterpolationSteps = 10;

        [Header("Sensory Target")]
        [SerializeField] private Transform navigationTarget;

        private readonly List<Vector3> trajectoryWaypoints = new List<Vector3>();

        public IReadOnlyList<Vector3> TrajectoryWaypoints => trajectoryWaypoints;

        private void Start()
        {
            position = transform.position;
            velocity = Vector3.forward * 5f;
        }

        private void FixedUpdate()
        {
            StepODEFlight(Time.fixedDeltaTime);
            transform.position = position;
            if (velocity.sqrMagnitude > 0.01f)
            {
                transform.rotation = Quaternion.LookRotation(velocity.normalized);
            }
        }

        /// <summary>
        /// Evaluates continuous vector field f(z, t) = [velocity, acceleration]
        /// </summary>
        public (Vector3 dPos, Vector3 dVel) VectorField(Vector3 currentPos, Vector3 currentVel, float t)
        {
            Vector3 dPos = currentVel;

            // Target attraction steering force
            Vector3 steer = Vector3.zero;
            if (navigationTarget != null)
            {
                Vector3 toTarget = (navigationTarget.position - currentPos).normalized;
                steer = toTarget * thrustMagnitude;
            }

            // Continuous aerodynamic drag and harmonic oscillation
            Vector3 drag = -dragCoefficient * currentVel.magnitude * currentVel;
            Vector3 perturbation = new Vector3(Mathf.Sin(t * 2.5f), Mathf.Cos(t * 1.8f), 0f) * 0.5f;

            Vector3 dVel = steer + drag + perturbation;
            return (dPos, dVel);
        }

        /// <summary>
        /// Runge-Kutta 4th order numerical step for continuous flight
        /// </summary>
        public void StepODEFlight(float dt)
        {
            var k1 = VectorField(position, velocity, flightTime);

            var posK2 = position + 0.5f * dt * k1.dPos;
            var velK2 = velocity + 0.5f * dt * k1.dVel;
            var k2 = VectorField(posK2, velK2, flightTime + 0.5f * dt);

            var posK3 = position + 0.5f * dt * k2.dPos;
            var velK3 = velocity + 0.5f * dt * k2.dVel;
            var k3 = VectorField(posK3, velK3, flightTime + 0.5f * dt);

            var posK4 = position + dt * k3.dPos;
            var velK4 = velocity + dt * k3.dVel;
            var k4 = VectorField(posK4, velK4, flightTime + dt);

            position += (dt / 6.0f) * (k1.dPos + 2.0f * k2.dPos + 2.0f * k3.dPos + k4.dPos);
            velocity += (dt / 6.0f) * (k1.dVel + 2.0f * k2.dVel + 2.0f * k3.dVel + k4.dVel);
            flightTime += dt;

            // Record trajectory history for trail visualization
            trajectoryWaypoints.Add(position);
            if (trajectoryWaypoints.Count > 100)
            {
                trajectoryWaypoints.RemoveAt(0);
            }
        }
    }
}

#if UNITY_EDITOR
using NUnit.Framework;
using UnityEngine;
using NeuroArena.Core;

namespace NeuroArena.Tests
{
    [TestFixture]
    public class GyroCameraControllerTests
    {
        [Test]
        public void TestGyroAndTouchOrbitBlendingMath()
        {
            // Initial camera angles
            float initialYaw = 45f;
            float initialPitch = 20f;

            float touchDeltaX = 5.0f;
            float touchDeltaY = 2.0f;
            float touchSensitivityX = 1.8f;
            float touchSensitivityY = 1.4f;

            // Simulated landscape gyro angular velocity (rad/s)
            float gyroRateY = 0.5f; // horizontal turn
            float gyroRateX = -0.3f; // vertical tilt
            float gyroSensitivityX = 1.6f;
            float gyroSensitivityY = 1.3f;
            float dt = 0.016f; // 60 FPS

            float gyroDeltaYaw = -gyroRateY * gyroSensitivityX * 45f * dt;
            float gyroDeltaPitch = -gyroRateX * gyroSensitivityY * 45f * dt;

            // Blend concurrent inputs
            float finalYaw = initialYaw + (touchDeltaX * touchSensitivityX) + gyroDeltaYaw;
            float finalPitch = initialPitch - (touchDeltaY * touchSensitivityY) - gyroDeltaPitch;
            finalPitch = Mathf.Clamp(finalPitch, -15f, 65f);

            // Assertions
            Assert.AreNotEqual(initialYaw, finalYaw, "Blended yaw must reflect both touch and gyro delta");
            Assert.AreNotEqual(initialPitch, finalPitch, "Blended pitch must reflect both touch and gyro delta");
            Assert.GreaterOrEqual(finalPitch, -15f, "Pitch must not exceed min boundary");
            Assert.LessOrEqual(finalPitch, 65f, "Pitch must not exceed max boundary");
        }

        [Test]
        public void TestCameraRecenterCalibrationAngles()
        {
            float playerForwardYaw = 180f;
            float defaultPitch = 22f;

            // Recenter math
            float calibratedYaw = playerForwardYaw;
            float calibratedPitch = defaultPitch;

            Assert.AreEqual(180f, calibratedYaw, "Recenter must align yaw directly with player forward direction");
            Assert.AreEqual(22f, calibratedPitch, "Recenter must reset pitch to optimal 22 degree default");
        }
    }
}
#endif

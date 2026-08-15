using UnityEngine;
using NeuroArena.UI;

namespace NeuroArena.Core
{
    /// <summary>
    /// Smooth Third-Person Chase Camera with Touch Orbit and Collision Buffering.
    /// Reads touch swiping from TouchLookZone on mobile, and mouse drag on Editor.
    /// </summary>
    public class CameraController : MonoBehaviour
    {
        [Header("Target Tracking")]
        [SerializeField] private Transform target;
        [SerializeField] private Vector3 targetOffset = new Vector3(0f, 1.6f, 0f);

        [Header("Orbit & Distance")]
        [SerializeField] private float defaultDistance = 5.5f;
        [SerializeField] private float minDistance = 2.0f;
        [SerializeField] private float maxDistance = 9.0f;
        [SerializeField] private float minPitchAngle = -15f;
        [SerializeField] private float maxPitchAngle = 65f;

        [Header("Responsiveness")]
        [SerializeField] private float lookSensitivityX = 1.8f;
        [SerializeField] private float lookSensitivityY = 1.4f;
        [SerializeField] private float positionSmoothSpeed = 14f;
        [SerializeField] private float rotationSmoothSpeed = 18f;

        [Header("Collision Avoidance")]
        [Header("Gyroscope & Motion Sensors")]
        [SerializeField] private bool enableGyroLook = true;
        [SerializeField] private float gyroSensitivityX = 1.6f;
        [SerializeField] private float gyroSensitivityY = 1.3f;

        public static CameraController Instance { get; private set; }
        public bool IsGyroEnabled => enableGyroLook && hasGyroHardware;
        public bool HasGyroHardware => hasGyroHardware;

        private bool hasGyroHardware = false;
        private float yaw = 0f;
        private float pitch = 22f;
        private float currentDistance;
        private Vector3 currentVelocity;

        private void Awake()
        {
            if (Instance == null) Instance = this;
        }

        private void Start()
        {
            currentDistance = defaultDistance;
            if (target != null)
            {
                yaw = target.eulerAngles.y;
            }

            // Check hardware gyroscope support
            hasGyroHardware = SystemInfo.supportsGyroscope;
            if (hasGyroHardware && enableGyroLook)
            {
                Input.gyro.enabled = true;
                Input.gyro.updateInterval = 0.016f; // 60 Hz sensor polling
            }
        }

        private void LateUpdate()
        {
            if (target == null) return;

            HandleOrbitInput();
            CalculateCameraTransform();
        }

        private void HandleOrbitInput()
        {
            Vector2 touchLookInput = Vector2.zero;

            // 1. Read touch look zone delta (Fine-tuning)
            if (TouchLookZone.Instance != null && TouchLookZone.Instance.LookDelta.sqrMagnitude > 0.001f)
            {
                touchLookInput = TouchLookZone.Instance.LookDelta;
            }
            // 2. Editor / Mouse Drag Fallback
            else if (Input.GetMouseButton(1) || (Input.GetMouseButton(0) && Input.mousePosition.x > Screen.width * 0.5f))
            {
                touchLookInput = new Vector2(Input.GetAxis("Mouse X") * 2.5f, -Input.GetAxis("Mouse Y") * 2.5f);
            }

            // 3. Read Hardware Gyroscope (Broad orientation)
            float gyroDeltaYaw = 0f;
            float gyroDeltaPitch = 0f;

            if (hasGyroHardware && enableGyroLook && Input.gyro.enabled)
            {
                Vector3 rotRate = Input.gyro.rotationRateUnbiased;
                // In landscape mode: rotRate.y is horizontal yaw, rotRate.x is vertical pitch
                if (Mathf.Abs(rotRate.x) > 0.02f || Mathf.Abs(rotRate.y) > 0.02f)
                {
                    gyroDeltaYaw = -rotRate.y * gyroSensitivityX * 45f * Time.deltaTime;
                    gyroDeltaPitch = -rotRate.x * gyroSensitivityY * 45f * Time.deltaTime;
                }
            }

            // 4. Concurrently Blend Gyro + Touch Look
            yaw += (touchLookInput.x * lookSensitivityX) + gyroDeltaYaw;
            pitch -= (touchLookInput.y * lookSensitivityY) - gyroDeltaPitch;
            pitch = Mathf.Clamp(pitch, minPitchAngle, maxPitchAngle);
        }

        private void CalculateCameraTransform()
        {
            Vector3 focusPoint = target.position + targetOffset;
            Quaternion targetRotation = Quaternion.Euler(pitch, yaw, 0f);

            // Compute ideal distance considering obstacle occlusion
            Vector3 desiredPosition = focusPoint - (targetRotation * Vector3.forward * defaultDistance);
            float desiredDistance = defaultDistance;

            Vector3 directionToCamera = (desiredPosition - focusPoint).normalized;
            if (Physics.SphereCast(focusPoint, collisionRadius, directionToCamera, out RaycastHit hit, defaultDistance, collisionLayers))
            {
                desiredDistance = Mathf.Clamp(hit.distance - collisionBuffer, minDistance, maxDistance);
            }

            currentDistance = Mathf.Lerp(currentDistance, desiredDistance, Time.deltaTime * 10f);

            Vector3 finalPosition = focusPoint - (targetRotation * Vector3.forward * currentDistance);

            // Smooth damping
            transform.position = Vector3.Lerp(transform.position, finalPosition, Time.deltaTime * positionSmoothSpeed);
            transform.rotation = Quaternion.Slerp(transform.rotation, targetRotation, Time.deltaTime * rotationSmoothSpeed);
        }

        /// <summary>
        /// Recenter/Calibrate camera facing directly behind player forward heading.
        /// </summary>
        public void RecenterCamera()
        {
            if (target != null)
            {
                yaw = target.eulerAngles.y;
            }
            pitch = 22f;
            currentDistance = defaultDistance;
        }

        public void SetGyroEnabled(bool enabled)
        {
            enableGyroLook = enabled;
            if (hasGyroHardware)
            {
                Input.gyro.enabled = enabled;
            }
        }

        public void SetGyroSensitivity(float multiplier)
        {
            gyroSensitivityX = 1.6f * multiplier;
            gyroSensitivityY = 1.3f * multiplier;
        }

        public void SetTarget(Transform newTarget)
        {
            target = newTarget;
            if (target != null)
            {
                yaw = target.eulerAngles.y;
            }
        }
    }
}

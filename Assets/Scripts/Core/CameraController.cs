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
        [SerializeField] private LayerMask collisionLayers = ~0;
        [SerializeField] private float collisionRadius = 0.25f;
        [SerializeField] private float collisionBuffer = 0.2f;

        private float yaw = 0f;
        private float pitch = 22f;
        private float currentDistance;
        private Vector3 currentVelocity;

        private void Start()
        {
            currentDistance = defaultDistance;
            if (target != null)
            {
                yaw = target.eulerAngles.y;
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
            Vector2 lookInput = Vector2.zero;

            // 1. Read touch look zone delta
            if (TouchLookZone.Instance != null && TouchLookZone.Instance.LookDelta.sqrMagnitude > 0.001f)
            {
                lookInput = TouchLookZone.Instance.LookDelta;
            }
            // 2. Editor / Mouse Drag Fallback (Right Click or Left Click Drag on right side)
            else if (Input.GetMouseButton(1) || (Input.GetMouseButton(0) && Input.mousePosition.x > Screen.width * 0.5f))
            {
                lookInput = new Vector2(Input.GetAxis("Mouse X") * 2.5f, -Input.GetAxis("Mouse Y") * 2.5f);
            }

            yaw += lookInput.x * lookSensitivityX;
            pitch -= lookInput.y * lookSensitivityY;
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

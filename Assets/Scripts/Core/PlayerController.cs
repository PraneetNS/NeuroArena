using UnityEngine;
using NeuroArena.UI;

namespace NeuroArena.Core
{
    /// <summary>
    /// Third-Person Mobile Player Controller.
    /// Handles directional movement via Virtual Touch Joystick (or Keyboard fallback),
    /// camera-relative movement vectors, smooth rotation, and slope/gravity physics.
    /// </summary>
    [RequireComponent(typeof(CharacterController))]
    public class PlayerController : MonoBehaviour
    {
        [Header("Movement Dynamics")]
        [SerializeField] private float moveSpeed = 7.5f;
        [SerializeField] private float sprintMultiplier = 1.35f;
        [SerializeField] private float acceleration = 12f;
        [SerializeField] private float deceleration = 15f;
        [SerializeField] private float rotationSmoothTime = 0.12f;

        [Header("Physics & Gravity")]
        [SerializeField] private float gravity = -20f;
        [SerializeField] private float groundedGravity = -2.5f;
        [SerializeField] private float groundCheckRadius = 0.28f;
        [SerializeField] private LayerMask groundLayer = ~0;

        [Header("References")]
        [SerializeField] private Transform cameraTransform;

        public static PlayerController Instance { get; private set; }
        public bool IsMovementLocked { get; set; } = false;

        private CharacterController characterController;
        private Vector3 currentVelocity;
        private Vector3 currentMoveVelocity;
        private float verticalVelocity;
        private float turnSmoothVelocity;

        public Vector3 Velocity => characterController != null ? characterController.velocity : Vector3.zero;
        public bool IsGrounded => characterController != null && characterController.isGrounded;

        private void Awake()
        {
            Instance = this;
            characterController = GetComponent<CharacterController>();
            if (cameraTransform == null && Camera.main != null)
            {
                cameraTransform = Camera.main.transform;
            }
        }

        private void Update()
        {
            if (IsMovementLocked) return;

            Vector2 inputVector = GetInputVector();
            HandleMovement(inputVector);
            HandleGravity();
        }

        private Vector2 GetInputVector()
        {
            Vector2 input = Vector2.zero;

            // 1. Read mobile touch joystick if available
            if (VirtualJoystick.Instance != null && VirtualJoystick.Instance.InputDirection.sqrMagnitude > 0.001f)
            {
                input = VirtualJoystick.Instance.InputDirection;
            }
            else
            {
                // 2. Fallback to Keyboard / Gamepad axis in Editor/PC
                float h = Input.GetAxisRaw("Horizontal");
                float v = Input.GetAxisRaw("Vertical");
                input = new Vector2(h, v).normalized;
            }

            return input;
        }

        private void HandleMovement(Vector2 input)
        {
            Vector3 targetDirection = Vector3.zero;

            if (input.sqrMagnitude > 0.01f)
            {
                // Compute movement relative to the camera's horizontal facing angle
                Vector3 camForward = cameraTransform != null ? cameraTransform.forward : Vector3.forward;
                Vector3 camRight = cameraTransform != null ? cameraTransform.right : Vector3.right;
                camForward.y = 0f;
                camRight.y = 0f;
                camForward.Normalize();
                camRight.Normalize();

                targetDirection = (camRight * input.x + camForward * input.y).normalized;

                // Smooth rotation towards movement direction
                float targetAngle = Mathf.Atan2(targetDirection.x, targetDirection.z) * Mathf.Rad2Deg;
                float smoothAngle = Mathf.SmoothDampAngle(transform.eulerAngles.y, targetAngle, ref turnSmoothVelocity, rotationSmoothTime);
                transform.rotation = Quaternion.Euler(0f, smoothAngle, 0f);
            }

            // Smooth acceleration / deceleration
            float targetSpeed = input.magnitude * moveSpeed;
            Vector3 targetVelocity = targetDirection * targetSpeed;

            float blendRate = targetSpeed > 0.01f ? acceleration : deceleration;
            currentMoveVelocity = Vector3.MoveTowards(currentMoveVelocity, targetVelocity, blendRate * Time.deltaTime);

            // Apply horizontal displacement
            Vector3 displacement = currentMoveVelocity * Time.deltaTime;
            displacement.y = verticalVelocity * Time.deltaTime;

            characterController.Move(displacement);
        }

        private void HandleGravity()
        {
            if (characterController.isGrounded)
            {
                if (verticalVelocity < 0f)
                {
                    verticalVelocity = groundedGravity;
                }
            }
            else
            {
                verticalVelocity += gravity * Time.deltaTime;
            }
        }

        public void SetCameraTransform(Transform cam)
        {
            cameraTransform = cam;
        }
    }
}

using System;
using UnityEngine;

namespace NeuroArena.Character
{
    public enum CharacterAnimState
    {
        Idle,
        Walk,
        Run,
        Jump,
        PickupGesture
    }

    /// <summary>
    /// Stylized Low-Poly Rigged Humanoid Base Character & Animation State Controller.
    /// Compatible with Mixamo and Synty Studios POLYGON humanoid skeletal avatars.
    /// Drives smooth blend transitions between Idle, Walk, Run, Jump, and Pickup gestures.
    /// </summary>
    public class CharacterAnimationController : MonoBehaviour
    {
        [Header("Animation State Telemetry")]
        [SerializeField] private CharacterAnimState currentState = CharacterAnimState.Idle;
        [SerializeField] private float moveSpeed = 0f;
        [SerializeField] private bool isGrounded = true;
        [SerializeField] private bool isPickingUp = false;

        [Header("Bone References (Mecanim Compatible Hierarchy)")]
        public Transform hips;
        public Transform spine;
        public Transform head;
        public Transform leftArm;
        public Transform rightArm;
        public Transform leftForearm;
        public Transform rightForearm;
        public Transform leftLeg;
        public Transform rightLeg;
        public Transform leftCalf;
        public Transform rightCalf;

        [Header("Animation Tuning")]
        [Range(1f, 15f)] public float walkSpeedThreshold = 2.5f;
        [Range(1f, 20f)] public float runSpeedThreshold = 6.0f;
        public float animBlendSpeed = 10f;

        private float animTime = 0f;
        private float pickupTimer = 0f;
        private Vector3 initialHipsPos;
        private Quaternion initialSpineRot;
        private Quaternion initialHeadRot;

        public CharacterAnimState CurrentState => currentState;

        private void Start()
        {
            if (hips != null) initialHipsPos = hips.localPosition;
            if (spine != null) initialSpineRot = spine.localRotation;
            if (head != null) initialHeadRot = head.localRotation;
        }

        public void SetMovementState(float speed, bool grounded)
        {
            moveSpeed = speed;
            isGrounded = grounded;

            if (isPickingUp)
            {
                currentState = CharacterAnimState.PickupGesture;
            }
            else if (!isGrounded)
            {
                currentState = CharacterAnimState.Jump;
            }
            else if (moveSpeed > runSpeedThreshold)
            {
                currentState = CharacterAnimState.Run;
            }
            else if (moveSpeed > 0.1f)
            {
                currentState = CharacterAnimState.Walk;
            }
            else
            {
                currentState = CharacterAnimState.Idle;
            }
        }

        public void TriggerPickupGesture(float duration = 0.6f)
        {
            isPickingUp = true;
            pickupTimer = duration;
            currentState = CharacterAnimState.PickupGesture;
        }

        private void Update()
        {
            float dt = Time.deltaTime;
            animTime += dt;

            if (isPickingUp)
            {
                pickupTimer -= dt;
                if (pickupTimer <= 0f)
                {
                    isPickingUp = false;
                }
            }

            EvaluateProceduralSkeletalMotion(dt);
        }

        private void EvaluateProceduralSkeletalMotion(float dt)
        {
            if (hips == null || leftArm == null || rightArm == null || leftLeg == null || rightLeg == null)
                return;

            switch (currentState)
            {
                case CharacterAnimState.Idle:
                    // Subtle breathing and idle posture sway
                    float breathe = Mathf.Sin(animTime * 2.2f) * 0.03f;
                    hips.localPosition = initialHipsPos + new Vector3(0f, breathe, 0f);
                    spine.localRotation = initialSpineRot * Quaternion.Euler(Mathf.Sin(animTime * 2.2f) * 2f, 0f, 0f);
                    leftArm.localRotation = Quaternion.Euler(Mathf.Sin(animTime * 1.5f) * 4f, 0f, 15f);
                    rightArm.localRotation = Quaternion.Euler(-Mathf.Sin(animTime * 1.5f) * 4f, 0f, -15f);
                    leftLeg.localRotation = Quaternion.identity;
                    rightLeg.localRotation = Quaternion.identity;
                    break;

                case CharacterAnimState.Walk:
                    // Natural walking gait cycle (opposite phase limbs)
                    float walkPhase = animTime * 7.5f;
                    float legSwingW = Mathf.Sin(walkPhase) * 28f;
                    float armSwingW = Mathf.Sin(walkPhase) * 32f;
                    float bounceW = Mathf.Abs(Mathf.Sin(walkPhase)) * 0.05f;

                    hips.localPosition = initialHipsPos + new Vector3(0f, bounceW, 0f);
                    leftLeg.localRotation = Quaternion.Euler(legSwingW, 0f, 0f);
                    rightLeg.localRotation = Quaternion.Euler(-legSwingW, 0f, 0f);
                    leftArm.localRotation = Quaternion.Euler(-armSwingW, 0f, 12f);
                    rightArm.localRotation = Quaternion.Euler(armSwingW, 0f, -12f);
                    break;

                case CharacterAnimState.Run:
                    // Energetic sprint gait cycle with forward spine lean
                    float runPhase = animTime * 12.5f;
                    float legSwingR = Mathf.Sin(runPhase) * 48f;
                    float armSwingR = Mathf.Sin(runPhase) * 55f;
                    float bounceR = Mathf.Abs(Mathf.Sin(runPhase)) * 0.12f;

                    hips.localPosition = initialHipsPos + new Vector3(0f, bounceR, 0f);
                    spine.localRotation = initialSpineRot * Quaternion.Euler(14f, Mathf.Sin(runPhase) * 4f, 0f);
                    leftLeg.localRotation = Quaternion.Euler(legSwingR, 0f, 0f);
                    rightLeg.localRotation = Quaternion.Euler(-legSwingR, 0f, 0f);
                    leftArm.localRotation = Quaternion.Euler(-armSwingR, 0f, 18f);
                    rightArm.localRotation = Quaternion.Euler(armSwingR, 0f, -18f);
                    break;

                case CharacterAnimState.Jump:
                    // Mid-air tuck & reach pose
                    hips.localPosition = initialHipsPos + new Vector3(0f, 0.15f, 0f);
                    leftLeg.localRotation = Quaternion.Euler(-25f, 0f, -5f);
                    rightLeg.localRotation = Quaternion.Euler(15f, 0f, 5f);
                    leftArm.localRotation = Quaternion.Euler(-65f, 0f, 35f);
                    rightArm.localRotation = Quaternion.Euler(-65f, 0f, -35f);
                    break;

                case CharacterAnimState.PickupGesture:
                    // Reach down right arm to harvest crystal token
                    hips.localPosition = initialHipsPos + new Vector3(0f, -0.18f, 0f);
                    spine.localRotation = initialSpineRot * Quaternion.Euler(28f, 12f, 0f);
                    rightArm.localRotation = Quaternion.Euler(60f, 15f, -10f);
                    if (rightForearm != null) rightForearm.localRotation = Quaternion.Euler(35f, 0f, 0f);
                    leftArm.localRotation = Quaternion.Euler(-15f, 0f, 20f);
                    break;
            }
        }
    }
}

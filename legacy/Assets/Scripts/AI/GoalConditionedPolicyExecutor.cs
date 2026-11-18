using System;
using UnityEngine;

namespace NeuroArena.AI
{
    /// <summary>
    /// GoalConditionedPolicyExecutor: Executes hierarchical goal-conditioned policies
    /// in Unity, periodically setting sub-goal waypoints and guiding locomotion.
    /// </summary>
    public class GoalConditionedPolicyExecutor : MonoBehaviour
    {
        [Header("Hierarchy Parameters")]
        [SerializeField] private float subGoalUpdateInterval = 1.0f;
        [SerializeField] private float goalArrivalTolerance = 1.2f;

        [Header("Navigation State")]
        [SerializeField] private Vector3 currentGlobalGoal;
        [SerializeField] private Vector3 currentSubGoal;
        [SerializeField] private float distanceToSubGoal;
        [SerializeField] private bool subGoalAchieved;

        private float nextSubGoalUpdateTime;
        private Rigidbody agentRigidbody;

        public event Action<Vector3> OnSubGoalReached;

        private void Start()
        {
            agentRigidbody = GetComponent<Rigidbody>();
            currentGlobalGoal = transform.position + transform.forward * 20f;
            currentSubGoal = ComputeIntermediateSubGoal();
        }

        private void Update()
        {
            if (Time.time >= nextSubGoalUpdateTime || subGoalAchieved)
            {
                currentSubGoal = ComputeIntermediateSubGoal();
                nextSubGoalUpdateTime = Time.time + subGoalUpdateInterval;
                subGoalAchieved = false;
            }

            distanceToSubGoal = Vector3.Distance(transform.position, currentSubGoal);
            if (distanceToSubGoal <= goalArrivalTolerance && !subGoalAchieved)
            {
                subGoalAchieved = true;
                OnSubGoalReached?.Invoke(currentSubGoal);
            }
        }

        private void FixedUpdate()
        {
            if (agentRigidbody == null) return;

            // Worker policy: directional force toward sub-goal
            Vector3 direction = (currentSubGoal - transform.position).normalized;
            agentRigidbody.AddForce(direction * 12f, ForceMode.Acceleration);

            // Align rotation toward movement direction
            if (direction.sqrMagnitude > 0.01f)
            {
                Quaternion targetRot = Quaternion.LookRotation(new Vector3(direction.x, 0, direction.z));
                transform.rotation = Quaternion.Slerp(transform.rotation, targetRot, Time.fixedDeltaTime * 6f);
            }
        }

        public void SetGlobalGoal(Vector3 newTarget)
        {
            currentGlobalGoal = newTarget;
            currentSubGoal = ComputeIntermediateSubGoal();
            subGoalAchieved = false;
        }

        private Vector3 ComputeIntermediateSubGoal()
        {
            // Project step along vector towards global goal
            Vector3 toTarget = currentGlobalGoal - transform.position;
            float stepDist = Mathf.Min(toTarget.magnitude, 5.0f);
            return transform.position + toTarget.normalized * stepDist;
        }
    }
}

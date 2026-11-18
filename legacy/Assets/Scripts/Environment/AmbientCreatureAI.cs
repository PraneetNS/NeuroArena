using UnityEngine;

namespace NeuroArena.Environment
{
    public enum CreatureState
    {
        Idle,
        Wander,
        Flee
    }

    /// <summary>
    /// Lightweight Finite State Machine for Non-Hostile Ambient Wildlife.
    /// Features:
    /// - 3 States: Idle (resting/foraging), Wander (local pathing), Flee (panics away from player at 2.5x speed).
    /// - Terrain elevation clamping via StylizedBiomeTerrain.
    /// - Procedural micro-animations (wing flap, hopping, hover bob, shard orbit).
    /// - Staggered perception checks (0.2s interval) and zero GC allocations.
    /// </summary>
    public class AmbientCreatureAI : MonoBehaviour
    {
        [Header("State")]
        [SerializeField] private CreatureState currentState = CreatureState.Idle;
        public CreatureState CurrentState => currentState;

        [Header("Movement & Speeds")]
        [SerializeField] private float walkSpeed = 1.8f;
        [SerializeField] private float fleeSpeed = 4.6f;
        [SerializeField] private float rotationSpeed = 8.0f;
        [SerializeField] private float wanderRadius = 8.0f;

        [Header("Perception")]
        [SerializeField] private float fleeRadius = 6.5f;
        [SerializeField] private float safeDistance = 11.0f;

        [Header("Archetype Animation Profile")]
        [SerializeField] private WildlifeArchetype archetype = WildlifeArchetype.DuneStriderFinch;

        private Transform playerTransform;
        private StylizedBiomeTerrain terrain;

        private Vector3 spawnOrigin;
        private Vector3 currentTargetPos;
        private float stateTimer;
        private float perceptionCheckTimer;
        private const float PERCEPTION_INTERVAL = 0.2f;

        // Sub-transforms cached for procedural micro-animations
        private Transform wingL;
        private Transform wingR;
        private Transform wispCore;
        private Transform dorsalNode;

        public void Initialize(WildlifeArchetype creatureArchetype, StylizedBiomeTerrain activeTerrain, Transform targetPlayer = null)
        {
            archetype = creatureArchetype;
            terrain = activeTerrain;
            playerTransform = targetPlayer;
            spawnOrigin = transform.position;

            CacheProceduralParts();
            SetState(CreatureState.Idle);
        }

        private void Start()
        {
            if (terrain == null) terrain = FindFirstObjectByType<StylizedBiomeTerrain>();
            if (playerTransform == null)
            {
                GameObject player = GameObject.FindWithTag("Player");
                if (player != null) playerTransform = player.transform;
            }
            if (spawnOrigin == Vector3.zero) spawnOrigin = transform.position;

            CacheProceduralParts();
        }

        private void CacheProceduralParts()
        {
            wingL = transform.Find("FinchBody/Wing_L");
            wingR = transform.Find("FinchBody/Wing_R");
            wispCore = transform.Find("WispCore");
            dorsalNode = transform.Find("ToadBody/DorsalSporeNode");
        }

        private void Update()
        {
            float dt = Time.deltaTime;

            // 1. Throttled Perception Check (Low CPU)
            perceptionCheckTimer -= dt;
            if (perceptionCheckTimer <= 0f)
            {
                perceptionCheckTimer = PERCEPTION_INTERVAL;
                CheckPlayerThreat();
            }

            // 2. FSM Execution
            switch (currentState)
            {
                case CreatureState.Idle:
                    UpdateIdle(dt);
                    break;
                case CreatureState.Wander:
                    UpdateWander(dt);
                    break;
                case CreatureState.Flee:
                    UpdateFlee(dt);
                    break;
            }

            // 3. Terrain Height Clamping & Procedural Micro-Animations
            ClampToTerrainAndAnimate(dt);
        }

        private void CheckPlayerThreat()
        {
            if (playerTransform == null) return;

            float distToPlayer = Vector3.Distance(transform.position, playerTransform.position);

            if (distToPlayer < fleeRadius)
            {
                if (currentState != CreatureState.Flee)
                {
                    SetState(CreatureState.Flee);
                }
            }
            else if (currentState == CreatureState.Flee && distToPlayer > safeDistance)
            {
                SetState(CreatureState.Idle);
            }
        }

        public void SetState(CreatureState newState)
        {
            currentState = newState;

            switch (newState)
            {
                case CreatureState.Idle:
                    stateTimer = Random.Range(1.8f, 4.2f);
                    break;

                case CreatureState.Wander:
                    stateTimer = 6.0f; // Max wander time before picking a new action
                    PickRandomWanderTarget();
                    break;

                case CreatureState.Flee:
                    UpdateFleeDestination();
                    break;
            }
        }

        private void UpdateIdle(float dt)
        {
            stateTimer -= dt;
            if (stateTimer <= 0f)
            {
                SetState(CreatureState.Wander);
            }
        }

        private void UpdateWander(float dt)
        {
            stateTimer -= dt;
            MoveTowardsTarget(currentTargetPos, walkSpeed, dt);

            float distToTarget = Vector3.Distance(
                new Vector3(transform.position.x, 0f, transform.position.z),
                new Vector3(currentTargetPos.x, 0f, currentTargetPos.z)
            );

            if (distToTarget < 0.6f || stateTimer <= 0f)
            {
                SetState(CreatureState.Idle);
            }
        }

        private void UpdateFlee(float dt)
        {
            UpdateFleeDestination();
            MoveTowardsTarget(currentTargetPos, fleeSpeed, dt);
        }

        private void PickRandomWanderTarget()
        {
            Vector2 randomCircle = Random.insideUnitCircle * wanderRadius;
            Vector3 target = spawnOrigin + new Vector3(randomCircle.x, 0f, randomCircle.y);

            if (terrain != null)
            {
                target.y = terrain.GetHeightAt(target.x, target.z);
            }

            currentTargetPos = target;
        }

        private void UpdateFleeDestination()
        {
            if (playerTransform != null)
            {
                Vector3 awayDir = (transform.position - playerTransform.position);
                awayDir.y = 0f;
                if (awayDir.sqrMagnitude < 0.01f) awayDir = transform.forward;
                awayDir.Normalize();

                Vector3 target = transform.position + awayDir * 12.0f;
                if (terrain != null)
                {
                    target.y = terrain.GetHeightAt(target.x, target.z);
                }
                currentTargetPos = target;
            }
            else
            {
                PickRandomWanderTarget();
            }
        }

        private void MoveTowardsTarget(Vector3 target, float speed, float dt)
        {
            Vector3 diff = target - transform.position;
            diff.y = 0f;
            if (diff.sqrMagnitude > 0.05f)
            {
                Vector3 moveDir = diff.normalized;
                Quaternion targetRot = Quaternion.LookRotation(moveDir, Vector3.up);
                transform.rotation = Quaternion.Slerp(transform.rotation, targetRot, rotationSpeed * dt);
                transform.position += moveDir * (speed * dt);
            }
        }

        private void ClampToTerrainAndAnimate(float dt)
        {
            float groundY = 0f;
            if (terrain != null)
            {
                groundY = terrain.GetHeightAt(transform.position.x, transform.position.z);
            }

            float isMoving = (currentState == CreatureState.Wander || currentState == CreatureState.Flee) ? 1f : 0f;
            float animSpeedMultiplier = (currentState == CreatureState.Flee) ? 2.5f : 1.0f;

            switch (archetype)
            {
                case WildlifeArchetype.DuneStriderFinch:
                    {
                        // Flapping wings when moving/fleeing
                        if (wingL != null && wingR != null)
                        {
                            float flap = Mathf.Sin(Time.time * 18f * animSpeedMultiplier) * 35f * isMoving;
                            wingL.localRotation = Quaternion.Euler(0f, 0f, -flap);
                            wingR.localRotation = Quaternion.Euler(0f, 0f, flap);
                        }
                        transform.position = new Vector3(transform.position.x, groundY, transform.position.z);
                    }
                    break;

                case WildlifeArchetype.LuminescentSporeToad:
                    {
                        // Parabolic hop motion during movement
                        float hopOffset = 0f;
                        if (isMoving > 0.1f)
                        {
                            hopOffset = Mathf.Abs(Mathf.Sin(Time.time * 6f * animSpeedMultiplier)) * 0.35f;
                        }
                        transform.position = new Vector3(transform.position.x, groundY + hopOffset, transform.position.z);

                        // Pulsing dorsal spore node
                        if (dorsalNode != null)
                        {
                            float pulse = 1.0f + Mathf.Sin(Time.time * 4f) * 0.15f;
                            dorsalNode.localScale = new Vector3(0.4f, 0.35f, 0.4f) * pulse;
                        }
                    }
                    break;

                case WildlifeArchetype.FrostScarabBeetle:
                case WildlifeArchetype.CanopyGlider:
                    {
                        // Skittering wobble
                        float wobble = Mathf.Sin(Time.time * 12f * animSpeedMultiplier) * 4f * isMoving;
                        transform.position = new Vector3(transform.position.x, groundY, transform.position.z);
                        transform.rotation *= Quaternion.Euler(0f, wobble, 0f);
                    }
                    break;

                case WildlifeArchetype.CyberPulseManta:
                    {
                        // Hovering wave flight above ground
                        float hover = 0.6f + Mathf.Sin(Time.time * 3f) * 0.2f;
                        transform.position = new Vector3(transform.position.x, groundY + hover, transform.position.z);
                    }
                    break;

                case WildlifeArchetype.AstralVectorWisp:
                    {
                        // Levitating float and spinning orbit
                        float hover = 0.75f + Mathf.Sin(Time.time * 2.5f) * 0.25f;
                        transform.position = new Vector3(transform.position.x, groundY + hover, transform.position.z);
                        if (wispCore != null)
                        {
                            wispCore.Rotate(Vector3.up, 60f * dt * animSpeedMultiplier, Space.Self);
                        }
                    }
                    break;
            }
        }
    }
}

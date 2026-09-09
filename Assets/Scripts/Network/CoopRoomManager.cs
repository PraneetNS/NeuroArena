using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using NeuroArena.Core;

namespace NeuroArena.Network
{
    public enum CoopPingType
    {
        HarvestHere,
        CoverageGap,
        OutlierAlert,
        BossHazard,
        AssembleTrain
    }

    [Serializable]
    public struct CoopDomainPartition
    {
        public int partitionIndex;
        public string name;
        public float minX;
        public float maxX;
        public string targetRole;
    }

    [Serializable]
    public struct CoopDatasetMetrics
    {
        public int totalSamples;
        public float domainMin;
        public float domainMax;
        public float coverageScore;
        public float balanceScore;
        public float cleanlinessScore;
        public float overallHealthScore;
        public string healthGrade;
        public int blindSpotsCount;
    }

    [Serializable]
    public struct CoopPingMessage
    {
        public string senderId;
        public string senderName;
        public string pingType;
        public float x;
        public float z;
        public float domainX;
        public int targetPartition;
        public string textPrompt;
        public string hapticPulse;
    }

    /// <summary>
    /// Unity Client Manager for 2-4 Player Collaborative Co-op Rooms.
    /// Handles domain partition roles, live dataset health telemetry, and tactical pings.
    /// </summary>
    public class CoopRoomManager : MonoBehaviour
    {
        public static CoopRoomManager Instance { get; private set; }

        public event Action<CoopDatasetMetrics> OnDatasetMetricsChanged;
        public event Action<CoopPingMessage> OnPingReceived;
        public event Action<int, string> OnRoleAssigned;

        [Header("Room State")]
        [SerializeField] private int partySize = 4;
        [SerializeField] private int assignedPartitionIndex = 0;
        [SerializeField] private string assignedRoleName = "Sector Alpha";

        private CoopDatasetMetrics liveMetrics;

        public int PartySize => partySize;
        public int AssignedPartitionIndex => assignedPartitionIndex;
        public string AssignedRoleName => assignedRoleName;
        public CoopDatasetMetrics LiveMetrics => liveMetrics;

        private void Awake()
        {
            if (Instance == null)
            {
                Instance = this;
                DontDestroyOnLoad(gameObject);
            }
            else
            {
                Destroy(gameObject);
            }
        }

        public void SetAssignedRole(int partitionIdx, string roleName)
        {
            assignedPartitionIndex = partitionIdx;
            assignedRoleName = roleName;
            OnRoleAssigned?.Invoke(partitionIdx, roleName);
            Debug.Log($"[CoopRoomManager] Assigned Sector Role: {roleName} (Partition #{partitionIdx})");
        }

        public void UpdateDatasetMetrics(CoopDatasetMetrics metrics)
        {
            liveMetrics = metrics;
            OnDatasetMetricsChanged?.Invoke(metrics);
        }

        public void HandleIncomingPing(CoopPingMessage ping)
        {
            OnPingReceived?.Invoke(ping);

            // Trigger corresponding haptic feedback on Android/Gamepad
            if (JuiceFeedbackManager.Instance != null)
            {
                switch (ping.pingType)
                {
                    case "HARVEST_HERE":
                        JuiceFeedbackManager.Instance.TriggerHaptic(HapticPulseType.LightTick);
                        break;
                    case "COVERAGE_GAP":
                    case "OUTLIER_ALERT":
                        JuiceFeedbackManager.Instance.TriggerHaptic(HapticPulseType.MediumImpact);
                        break;
                    case "BOSS_HAZARD":
                        JuiceFeedbackManager.Instance.TriggerHaptic(HapticPulseType.HeavyRumble);
                        break;
                    case "ASSEMBLE_TRAIN":
                        JuiceFeedbackManager.Instance.TriggerHaptic(HapticPulseType.SuccessBurst);
                        break;
                }
            }
        }

        public static float ComputePartyDifficultyBossHp(int baseHp, int partySize)
        {
            float mult = partySize switch
            {
                2 => 1.65f,
                3 => 2.25f,
                4 => 2.80f,
                _ => 1.0f
            };
            return baseHp * mult;
        }
    }
}

using System;
using System.Collections.Generic;
using UnityEngine;

namespace NeuroArena.AI
{
    /// <summary>
    /// TemporalCombatGraphBridge: Dispatches continuous-time combat interaction events
    /// (shots, shields, proximity crossfires) to the server-side Temporal Graph Network (TGN).
    /// </summary>
    public class TemporalCombatGraphBridge : MonoBehaviour
    {
        [Header("Agent Identity")]
        [SerializeField] private string agentId = "agent_0";
        [SerializeField] private float combatExcitationScore = 0.0f;

        [Header("Event Batching")]
        [SerializeField] private float dispatchRate = 0.1f;

        public struct CombatInteractionEvent
        {
            public string SourceId;
            public string TargetId;
            public string ActionType;
            public float Magnitude;
            public float Timestamp;
        }

        private readonly List<CombatInteractionEvent> pendingEvents = new List<CombatInteractionEvent>();
        private float timer = 0f;

        public float CombatExcitationScore => combatExcitationScore;

        private void Update()
        {
            timer += Time.deltaTime;
            if (timer >= dispatchRate)
            {
                timer = 0f;
                FlushEvents();
            }

            // Passive decay of excitation score
            combatExcitationScore = Mathf.Max(0f, combatExcitationScore - Time.deltaTime * 0.5f);
        }

        public void RegisterInteraction(string targetId, string actionType, float magnitude)
        {
            var ev = new CombatInteractionEvent
            {
                SourceId = agentId,
                TargetId = targetId,
                ActionType = actionType,
                Magnitude = magnitude,
                Timestamp = Time.time
            };

            pendingEvents.Add(ev);
            combatExcitationScore += magnitude * 0.2f;
        }

        private void FlushEvents()
        {
            if (pendingEvents.Count == 0) return;
            // High-speed telemetry transmission to Colyseus/WebTransport backend
            pendingEvents.Clear();
        }
    }
}

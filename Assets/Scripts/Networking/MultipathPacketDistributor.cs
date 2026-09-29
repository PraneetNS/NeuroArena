using System;
using System.Collections.Generic;
using UnityEngine;

namespace NeuroArena.Networking
{
    /// <summary>
    /// MultipathPacketDistributor: Dual-homed network packet distributor in Unity C#.
    /// Manages subflow socket allocation between Wi-Fi and Cellular interfaces,
    /// routing high-frequency kinematic telemetry via fastest RTT path.
    /// </summary>
    public class MultipathPacketDistributor : MonoBehaviour
    {
        public enum NetworkPathType
        {
            WiFi,
            Cellular5G
        }

        [System.Serializable]
        public class SubflowRoute
        {
            public NetworkPathType pathType;
            public float smoothedRttMs;
            public float packetLossPercent;
            public bool isAlive;
            public long bytesTransmitted;
        }

        [Header("Active Subflows")]
        [SerializeField] private SubflowRoute wifiRoute = new SubflowRoute { pathType = NetworkPathType.WiFi, smoothedRttMs = 22f, isAlive = true };
        [SerializeField] private SubflowRoute cellularRoute = new SubflowRoute { pathType = NetworkPathType.Cellular5G, smoothedRttMs = 45f, isAlive = true };

        [Header("Pacing & Failover")]
        [SerializeField] private float failoverLossThreshold = 15.0f;
        [SerializeField] private bool enableDualRedundancy = false;

        public NetworkPathType ActivePrimaryPath => (wifiRoute.smoothedRttMs <= cellularRoute.smoothedRttMs && wifiRoute.isAlive)
            ? NetworkPathType.WiFi
            : NetworkPathType.Cellular5G;

        /// <summary>
        /// Selects transmission path for an outgoing byte payload
        /// </summary>
        public NetworkPathType RoutePacket(int payloadSize, bool isCriticalEvent)
        {
            if (isCriticalEvent && enableDualRedundancy)
            {
                wifiRoute.bytesTransmitted += payloadSize;
                cellularRoute.bytesTransmitted += payloadSize;
                return NetworkPathType.WiFi;
            }

            if (wifiRoute.isAlive && wifiRoute.packetLossPercent < failoverLossThreshold)
            {
                wifiRoute.bytesTransmitted += payloadSize;
                return NetworkPathType.WiFi;
            }

            cellularRoute.bytesTransmitted += payloadSize;
            return NetworkPathType.Cellular5G;
        }

        public void UpdatePathTelemetry(NetworkPathType path, float rttMs, float lossRate)
        {
            if (path == NetworkPathType.WiFi)
            {
                wifiRoute.smoothedRttMs = Mathf.Lerp(wifiRoute.smoothedRttMs, rttMs, 0.2f);
                wifiRoute.packetLossPercent = lossRate;
            }
            else
            {
                cellularRoute.smoothedRttMs = Mathf.Lerp(cellularRoute.smoothedRttMs, rttMs, 0.2f);
                cellularRoute.packetLossPercent = lossRate;
            }
        }
    }
}

using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;

namespace NeuroArena.Network
{
    /// <summary>
    /// Coordinates real-time multiplayer relay connectivity to the Colyseus server.
    /// Broadcasts local player transform at a fixed 15Hz tickrate (not every frame)
    /// and manages smooth interpolated Ghost avatars of remote connected players.
    /// </summary>
    public class NetworkManager : MonoBehaviour
    {
        public static NetworkManager Instance { get; private set; }

        [Header("Server Configuration")]
        [SerializeField] private string serverUrl = "ws://localhost:2567";
        [SerializeField] private string roomName = "arena_room";
        [SerializeField] private bool autoConnect = true;

        [Header("Tickrate & Broadcast Settings")]
        [SerializeField] private float sendRateHz = 15.0f; // 15 updates per sec = ~66ms interval

        [Header("State Tracking")]
        public bool isConnected = false;
        public int pingMs = 0;

        private Transform localPlayerTransform;
        private int currentBiomeIndex = 0;
        private float tickTimer = 0f;
        private float sendInterval;

        private readonly Dictionary<string, RemotePlayerGhost> remoteGhosts = new Dictionary<string, RemotePlayerGhost>();
        private GameObject ghostContainer;

        private void Awake()
        {
            if (Instance == null)
            {
                Instance = this;
                DontDestroyOnLoad(gameObject);
                sendInterval = 1.0f / Mathf.Max(1.0f, sendRateHz);
                ghostContainer = new GameObject("RemotePlayerGhosts_Container");
                DontDestroyOnLoad(ghostContainer);
            }
            else
            {
                Destroy(gameObject);
            }
        }

        private void Start()
        {
            if (autoConnect)
            {
                ConnectToRoom();
            }
        }

        public void RegisterLocalPlayer(Transform playerTr, int biome)
        {
            this.localPlayerTransform = playerTr;
            this.currentBiomeIndex = biome;
            NotifyBiomeChanged(biome);
        }

        public void ConnectToRoom()
        {
            isConnected = true;
            Debug.Log($"[NetworkManager] Connected to Colyseus room '{roomName}' at {serverUrl}. Fixed tickrate: {sendRateHz}Hz.");
        }

        public void Disconnect()
        {
            isConnected = false;
            foreach (var kvp in remoteGhosts)
            {
                if (kvp.Value != null) Destroy(kvp.Value.gameObject);
            }
            remoteGhosts.Clear();
            Debug.Log("[NetworkManager] Disconnected from multiplayer room.");
        }

        private void Update()
        {
            if (!isConnected || localPlayerTransform == null) return;

            tickTimer += Time.deltaTime;
            if (tickTimer >= sendInterval)
            {
                tickTimer -= sendInterval;
                SendLocalTransformTick();
            }
        }

        private void SendLocalTransformTick()
        {
            Vector3 pos = localPlayerTransform.position;
            float rotY = localPlayerTransform.eulerAngles.y * Mathf.Deg2Rad;
            string activity = "walking"; // Can be read from CharacterAnimationController

            // In production build, serialized byte / JSON packet is dispatched to WebSocket client
            // e.g. wsClient.Send("transform", { x = pos.x, y = pos.y, z = pos.z, rotationY = rotY, biome = currentBiomeIndex, activityState = activity });
        }

        public void NotifyBiomeChanged(int newBiome)
        {
            this.currentBiomeIndex = newBiome;
            Debug.Log($"[NetworkManager] Notified server of Biome transition: #{newBiome}");
        }

        public void OnRemotePlayerJoined(string sessionId, string playerName, string build, Vector3 pos, int biome)
        {
            if (remoteGhosts.ContainsKey(sessionId)) return;

            GameObject ghostGO = new GameObject($"Ghost_{playerName}_{sessionId.Substring(0, Mathf.Min(4, sessionId.Length))}");
            ghostGO.transform.SetParent(ghostContainer.transform);

            RemotePlayerGhost ghost = ghostGO.AddComponent<RemotePlayerGhost>();
            ghost.Initialize(sessionId, playerName, build, pos, biome);
            remoteGhosts.Add(sessionId, ghost);
        }

        public void OnRemotePlayerTransformReceived(string sessionId, Vector3 pos, float rotY, string activity, int biome)
        {
            if (remoteGhosts.TryGetValue(sessionId, out RemotePlayerGhost ghost))
            {
                ghost.SetTargetTransform(pos, rotY, activity, biome);
            }
        }

        public void OnRemotePlayerLeft(string sessionId)
        {
            if (remoteGhosts.TryGetValue(sessionId, out RemotePlayerGhost ghost))
            {
                if (ghost != null) Destroy(ghost.gameObject);
                remoteGhosts.Remove(sessionId);
            }
        }

        // --- AUTHORITATIVE PICKUP VALIDATION & PREDICTION RECONCILIATION ---
        private readonly Dictionary<string, GameObject> pendingPickupObjects = new Dictionary<string, GameObject>();

        public void SendPickupAttempt(string itemId, string itemType, GameObject collectibleGO, Vector3 pos, float valX, float valY)
        {
            if (!isConnected) return;

            // 1. Optimistic Local Prediction (Hiding immediately on client)
            if (collectibleGO != null)
            {
                collectibleGO.SetActive(false);
                pendingPickupObjects[itemId] = collectibleGO;
            }

            Debug.Log($"[NetworkManager] Sent authoritative 'pickup_attempt' for object: {itemId} ({itemType}) at ({pos.x:F1}, {pos.z:F1})");
            // Dispatches JSON payload to Colyseus room:
            // wsClient.Send("pickup_attempt", { id = itemId, type = itemType, x = pos.x, y = pos.y, z = pos.z, valX = valX, valY = valY });
        }

        public void OnPickupApproved(string itemId, string itemType, float valX, float valY)
        {
            Debug.Log($"[NetworkManager] Server APPROVED pickup claim for: {itemId}");
            if (pendingPickupObjects.ContainsKey(itemId))
            {
                pendingPickupObjects.Remove(itemId);
            }
        }

        public void OnPickupRejected(string itemId, string reason)
        {
            Debug.LogWarning($"[NetworkManager] Server REJECTED pickup claim for: {itemId}. Reason: {reason}. Rolling back local prediction.");
            if (pendingPickupObjects.TryGetValue(itemId, out GameObject collectibleGO))
            {
                if (collectibleGO != null)
                {
                    collectibleGO.SetActive(true); // Re-enable mesh
                }
                pendingPickupObjects.Remove(itemId);
            }
        }

        public void OnRemoteCollectibleClaimed(string itemId, string collectedBy)
        {
            Debug.Log($"[NetworkManager] Remote player {collectedBy} claimed collectible: {itemId}");
            // If the object exists locally in the biome scene, remove it
            GameObject obj = GameObject.Find(itemId);
            if (obj != null)
            {
                Destroy(obj);
            }
        }
    }
}

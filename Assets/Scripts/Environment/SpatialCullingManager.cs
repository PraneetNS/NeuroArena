using System.Collections.Generic;
using UnityEngine;
using NeuroArena.Core;

namespace NeuroArena.Environment
{
    /// <summary>
    /// Stage 86 (Props) & Stage 87 (Creatures) Spatial Partitioning & Distance-Based Culling / Pooling Engine.
    /// Divides expansive 2-4 km² terrain into 64m grid cells.
    /// Dynamically activates entities inside the player's view bubble and deactivates distant objects
    /// with zero runtime heap allocations.
    /// Scaled by Stage 45 DeviceTier (Low-End 2GB vs Flagship).
    /// </summary>
    public class SpatialCullingManager : MonoBehaviour
    {
        public static SpatialCullingManager Instance { get; private set; }

        [Header("Grid & Culling Settings")]
        [SerializeField] private float cellSize = 64.0f;
        [SerializeField] private float defaultCullRadius = 85.0f;
        [SerializeField] private float updateInterval = 0.15f;

        private float activeCullRadius = 85.0f;
        private Transform playerTransform;
        private float updateTimer = 0f;
        private Vector3 lastPlayerPos = new Vector3(9999f, 9999f, 9999f);

        // Spatial Hash: CellCoord -> List of registered GameObjects
        private readonly Dictionary<Vector2Int, List<GameObject>> gridCells = new Dictionary<Vector2Int, List<GameObject>>();
        private readonly HashSet<Vector2Int> activeCells = new HashSet<Vector2Int>();
        private readonly HashSet<Vector2Int> newlyActiveCells = new HashSet<Vector2Int>();

        public float ActiveCullRadius => activeCullRadius;
        public int TotalRegisteredObjects { get; private set; } = 0;

        private void Awake()
        {
            if (Instance == null)
            {
                Instance = this;
            }
            else if (Instance != this)
            {
                Destroy(gameObject);
                return;
            }

            ApplyDeviceTierSettings();
        }

        private void Start()
        {
            FindPlayer();
            ApplyDeviceTierSettings();
        }

        public void ApplyDeviceTierSettings()
        {
            if (DeviceTierManager.Instance != null)
            {
                switch (DeviceTierManager.Instance.DetectedTier)
                {
                    case HardwareTier.LowEnd_2GB:
                        activeCullRadius = 45.0f; // Stage 45 aggressive clamp
                        break;
                    case HardwareTier.MidRange_4to6GB:
                        activeCullRadius = 85.0f;
                        break;
                    case HardwareTier.Flagship_8GBPlus:
                        activeCullRadius = 140.0f;
                        break;
                }
            }
            else
            {
                activeCullRadius = defaultCullRadius;
            }
        }

        public void SetCustomCullRadius(float radius)
        {
            activeCullRadius = Mathf.Max(20.0f, radius);
            ForceRefreshCulling();
        }

        public void RegisterObject(GameObject go)
        {
            if (go == null) return;

            Vector2Int cell = WorldToCell(go.transform.position);
            if (!gridCells.TryGetValue(cell, out List<GameObject> list))
            {
                list = new List<GameObject>(16);
                gridCells[cell] = list;
            }

            list.Add(go);
            TotalRegisteredObjects++;

            // Initial state based on whether cell is currently active
            if (playerTransform != null)
            {
                Vector2Int playerCell = WorldToCell(playerTransform.position);
                float distSq = (new Vector2(go.transform.position.x, go.transform.position.z) - 
                                new Vector2(playerTransform.position.x, playerTransform.position.z)).sqrMagnitude;
                go.SetActive(distSq <= (activeCullRadius * activeCullRadius));
            }
        }

        public void Clear()
        {
            gridCells.Clear();
            activeCells.Clear();
            newlyActiveCells.Clear();
            TotalRegisteredObjects = 0;
            lastPlayerPos = new Vector3(9999f, 9999f, 9999f);
        }

        private void Update()
        {
            updateTimer -= Time.deltaTime;
            if (updateTimer <= 0f)
            {
                updateTimer = updateInterval;
                UpdateCulling();
            }
        }

        private void UpdateCulling()
        {
            if (playerTransform == null)
            {
                FindPlayer();
                if (playerTransform == null) return;
            }

            Vector3 currentPos = playerTransform.position;
            // Skip check if player hasn't moved significantly (> 4m)
            if ((currentPos - lastPlayerPos).sqrMagnitude < 16.0f)
            {
                return;
            }
            lastPlayerPos = currentPos;

            Vector2Int centerCell = WorldToCell(currentPos);
            int cellRadius = Mathf.CeilToInt(activeCullRadius / cellSize);
            float sqrCullDist = activeCullRadius * activeCullRadius;
            Vector2 playerPos2D = new Vector2(currentPos.x, currentPos.z);

            newlyActiveCells.Clear();

            // Collect cells in radius
            for (int x = -cellRadius; x <= cellRadius; x++)
            {
                for (int y = -cellRadius; y <= cellRadius; y++)
                {
                    Vector2Int cell = new Vector2Int(centerCell.x + x, centerCell.y + y);
                    newlyActiveCells.Add(cell);

                    if (gridCells.TryGetValue(cell, out List<GameObject> list))
                    {
                        for (int i = 0; i < list.Count; i++)
                        {
                            GameObject obj = list[i];
                            if (obj == null) continue;

                            Vector2 objPos2D = new Vector2(obj.transform.position.x, obj.transform.position.z);
                            bool inRange = (objPos2D - playerPos2D).sqrMagnitude <= sqrCullDist;
                            if (obj.activeSelf != inRange)
                            {
                                obj.SetActive(inRange);
                            }
                        }
                    }
                }
            }

            // Deactivate cells that were active but are now out of view range
            foreach (Vector2Int oldCell in activeCells)
            {
                if (!newlyActiveCells.Contains(oldCell))
                {
                    if (gridCells.TryGetValue(oldCell, out List<GameObject> list))
                    {
                        for (int i = 0; i < list.Count; i++)
                        {
                            if (list[i] != null && list[i].activeSelf)
                            {
                                list[i].SetActive(false);
                            }
                        }
                    }
                }
            }

            activeCells.Clear();
            foreach (Vector2Int c in newlyActiveCells)
            {
                activeCells.Add(c);
            }
        }

        public void ForceRefreshCulling()
        {
            lastPlayerPos = new Vector3(9999f, 9999f, 9999f);
            UpdateCulling();
        }

        private Vector2Int WorldToCell(Vector3 worldPos)
        {
            return new Vector2Int(
                Mathf.FloorToInt(worldPos.x / cellSize),
                Mathf.FloorToInt(worldPos.z / cellSize)
            );
        }

        private void FindPlayer()
        {
            GameObject player = GameObject.FindWithTag("Player");
            if (player != null)
            {
                playerTransform = player.transform;
            }
            else
            {
                Camera cam = Camera.main;
                if (cam != null) playerTransform = cam.transform;
            }
        }
    }
}

using System;
using System.Collections.Generic;
using UnityEngine;

namespace NeuroArena.Environment
{
    /// <summary>
    /// Type of hazard erupting along Voronoi cell fractures.
    /// </summary>
    public enum FractureHazardType
    {
        None = 0,
        MagmaFissure = 1,       // High thermal damage over time, low traction
        CryoChasm = 2,          // Movement speed reduction by 60%, frozen terrain
        IonDisruptionField = 3  // Scrambles agent sensors and gradient sensors
    }

    /// <summary>
    /// Represents a discrete Voronoi partition cell within the arena biome.
    /// </summary>
    [Serializable]
    public class VoronoiCell
    {
        public int CellId;
        public Vector2 SitePosition;
        public float ElevationOffset = 0f;
        public FractureHazardType ActiveHazard = FractureHazardType.None;
        public float HazardIntensity = 0f;
        public bool IsFractured = false;
        public List<int> NeighborCellIds = new List<int>();
    }

    /// <summary>
    /// Procedural Voronoi Biome Fracture and Dynamic Hazard Deformer.
    /// Partitions the arena into Lloyd-relaxed Voronoi cells and fractures boundaries during
    /// high-energy match phases, testing agent spatial navigation and MARL tactical adaptability.
    /// </summary>
    public class VoronoiBiomeDeformer : MonoBehaviour
    {
        public static VoronoiBiomeDeformer Instance { get; private set; }

        [Header("Voronoi Partitioning")]
        [SerializeField] private int cellCount = 16;
        [SerializeField] private Vector2 arenaBounds = new Vector2(100f, 100f);
        [SerializeField] private int lloydRelaxationIterations = 2;

        [Header("Fracture Dynamics")]
        [SerializeField] private float maxVerticalFaultDisplacement = 1.8f;
        [SerializeField] private float fractureTransitionSpeed = 2.5f;
        [SerializeField] private float hazardDamagePerSecond = 15f;

        private List<VoronoiCell> _cells = new List<VoronoiCell>();
        private bool _isDeforming = false;
        private float _globalInstability = 0f;

        public IReadOnlyList<VoronoiCell> Cells => _cells;
        public float GlobalInstability => _globalInstability;

        public event Action<int, FractureHazardType> OnCellHazardChanged;
        public event Action<float> OnArenaInstabilityChanged;

        private void Awake()
        {
            if (Instance == null) Instance = this;
            else Destroy(gameObject);

            GenerateVoronoiTopology();
        }

        /// <summary>
        /// Generates initial cell partition sites with Lloyd relaxation for organic tessellation.
        /// </summary>
        public void GenerateVoronoiTopology()
        {
            _cells.Clear();
            var rand = new System.Random(1337);

            // 1. Initial random seed sites
            for (int i = 0; i < cellCount; i++)
            {
                float x = ((float)rand.NextDouble() - 0.5f) * arenaBounds.x;
                float y = ((float)rand.NextDouble() - 0.5f) * arenaBounds.y;

                _cells.Add(new VoronoiCell
                {
                    CellId = i,
                    SitePosition = new Vector2(x, y),
                    ElevationOffset = 0f,
                    ActiveHazard = FractureHazardType.None
                });
            }

            // 2. Approximate Lloyd relaxation iterations for balanced cell sizes
            for (int iter = 0; iter < lloydRelaxationIterations; iter++)
            {
                RelaxVoronoiSites();
            }

            // 3. Connect nearest neighbor adjacencies
            ComputeAdjacencies();
        }

        private void RelaxVoronoiSites()
        {
            int sampleGrid = 20;
            Vector2[] centroids = new Vector2[cellCount];
            int[] counts = new int[cellCount];

            float stepX = arenaBounds.x / sampleGrid;
            float stepY = arenaBounds.y / sampleGrid;

            for (int gx = 0; gx < sampleGrid; gx++)
            {
                for (int gy = 0; gy < sampleGrid; gy++)
                {
                    Vector2 pt = new Vector2(
                        -arenaBounds.x * 0.5f + (gx + 0.5f) * stepX,
                        -arenaBounds.y * 0.5f + (gy + 0.5f) * stepY
                    );

                    int nearest = GetClosestCellIndex(pt);
                    centroids[nearest] += pt;
                    counts[nearest]++;
                }
            }

            for (int i = 0; i < cellCount; i++)
            {
                if (counts[i] > 0)
                {
                    _cells[i].SitePosition = centroids[i] / counts[i];
                }
            }
        }

        private void ComputeAdjacencies()
        {
            for (int i = 0; i < cellCount; i++)
            {
                _cells[i].NeighborCellIds.Clear();
                for (int j = 0; j < cellCount; j++)
                {
                    if (i == j) continue;
                    float dist = Vector2.Distance(_cells[i].SitePosition, _cells[j].SitePosition);
                    if (dist < arenaBounds.x / Mathf.Sqrt(cellCount) * 1.8f)
                    {
                        _cells[i].NeighborCellIds.Add(j);
                    }
                }
            }
        }

        /// <summary>
        /// Finds the closest Voronoi cell index for any world (X, Z) coordinate.
        /// </summary>
        public int GetClosestCellIndex(Vector2 xzPos)
        {
            int closest = 0;
            float minSqrDist = float.MaxValue;

            for (int i = 0; i < _cells.Count; i++)
            {
                float sqrDist = (xzPos - _cells[i].SitePosition).sqrMagnitude;
                if (sqrDist < minSqrDist)
                {
                    minSqrDist = sqrDist;
                    closest = i;
                }
            }
            return closest;
        }

        /// <summary>
        /// Triggers a localized fracture event across a cell and its fault line boundaries.
        /// </summary>
        public void TriggerTectonicFault(int centerCellId, FractureHazardType hazardType, float targetDisplacement)
        {
            if (centerCellId < 0 || centerCellId >= _cells.Count) return;

            VoronoiCell center = _cells[centerCellId];
            center.IsFractured = true;
            center.ActiveHazard = hazardType;
            center.HazardIntensity = 1.0f;
            center.ElevationOffset = Mathf.Clamp(targetDisplacement, -maxVerticalFaultDisplacement, maxVerticalFaultDisplacement);

            OnCellHazardChanged?.Invoke(centerCellId, hazardType);

            // Propagate fracture partially to adjacent neighbors
            foreach (int neighborId in center.NeighborCellIds)
            {
                VoronoiCell neighbor = _cells[neighborId];
                if (!neighbor.IsFractured)
                {
                    neighbor.IsFractured = true;
                    neighbor.ActiveHazard = hazardType;
                    neighbor.HazardIntensity = 0.5f;
                    neighbor.ElevationOffset = center.ElevationOffset * -0.5f; // Counter-fault step
                    OnCellHazardChanged?.Invoke(neighborId, hazardType);
                }
            }

            _globalInstability = Mathf.Clamp01(_globalInstability + 0.25f);
            OnArenaInstabilityChanged?.Invoke(_globalInstability);
        }

        /// <summary>
        /// Samples terrain vertical offset and active hazard at a world position.
        /// </summary>
        public (float elevationOffset, FractureHazardType hazard, float hazardDamage) SamplePoint(Vector3 worldPos)
        {
            Vector2 xz = new Vector2(worldPos.x, worldPos.z);
            int cellIdx = GetClosestCellIndex(xz);
            VoronoiCell cell = _cells[cellIdx];

            float distToSite = Vector2.Distance(xz, cell.SitePosition);
            float weight = Mathf.Clamp01(1f - (distToSite / 25f));

            float damage = (cell.ActiveHazard != FractureHazardType.None) ? (hazardDamagePerSecond * cell.HazardIntensity) : 0f;
            return (cell.ElevationOffset * weight, cell.ActiveHazard, damage);
        }

        /// <summary>
        /// Resets all fractures and returns arena to stable equilibrium.
        /// </summary>
        public void StabilizeArena()
        {
            for (int i = 0; i < _cells.Count; i++)
            {
                _cells[i].IsFractured = false;
                _cells[i].ActiveHazard = FractureHazardType.None;
                _cells[i].ElevationOffset = 0f;
                _cells[i].HazardIntensity = 0f;
                OnCellHazardChanged?.Invoke(i, FractureHazardType.None);
            }
            _globalInstability = 0f;
            OnArenaInstabilityChanged?.Invoke(0f);
        }
    }
}

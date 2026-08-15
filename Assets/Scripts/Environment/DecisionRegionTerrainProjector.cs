using System;
using System.Collections.Generic;
using UnityEngine;
using NeuroArena.ML;

namespace NeuroArena.Environment
{
    /// <summary>
    /// Projects 2D axis-aligned decision region patches onto the 3D terrain ground.
    /// Evaluates the decision tree across a discrete spatial grid and colors ground tiles.
    /// </summary>
    public class DecisionRegionTerrainProjector : MonoBehaviour
    {
        public static DecisionRegionTerrainProjector Instance { get; private set; }

        [Header("Grid Projection Settings")]
        [SerializeField] private int gridSize = 16;
        [SerializeField] private float terrainWidth = 36f;
        [SerializeField] private float patchHeight = 0.05f;

        private GameObject gridRoot;
        private Vector3 arenaCenter;
        private GameObject[,] patchObjects;

        private readonly Color[] classColors = new Color[]
        {
            new Color(0.15f, 0.75f, 1.0f, 0.45f), // Class 0: Azure Cyan
            new Color(0.80f, 0.2f, 0.90f, 0.45f), // Class 1: Purple
            new Color(1.0f, 0.75f, 0.2f, 0.45f)   // Class 2: Amber Yellow
        };

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
        }

        public void Initialize(Vector3 center)
        {
            arenaCenter = center;
            CreateTerrainPatchGrid();
        }

        private void CreateTerrainPatchGrid()
        {
            if (gridRoot != null) Destroy(gridRoot);

            gridRoot = new GameObject("DecisionRegion_TerrainGrid");
            gridRoot.transform.SetParent(transform);
            gridRoot.transform.position = arenaCenter;

            patchObjects = new GameObject[gridSize, gridSize];
            float step = terrainWidth / gridSize;

            for (int gz = 0; gz < gridSize; gz++)
            {
                for (int gx = 0; gx < gridSize; gx++)
                {
                    float localX = -terrainWidth * 0.5f + (gx + 0.5f) * step;
                    float localZ = -terrainWidth * 0.5f + (gz + 0.5f) * step;

                    GameObject patch = GameObject.CreatePrimitive(PrimitiveType.Quad);
                    patch.name = $"Patch_{gx}_{gz}";
                    patch.transform.SetParent(gridRoot.transform);
                    patch.transform.localPosition = new Vector3(localX, 0.08f, localZ);
                    patch.transform.localScale = new Vector3(step * 0.95f, step * 0.95f, 1f);
                    patch.transform.rotation = Quaternion.Euler(90f, 0f, 0f);
                    Destroy(patch.GetComponent<Collider>());

                    Renderer r = patch.GetComponent<Renderer>();
                    if (r != null)
                    {
                        Material mat = new Material(Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard"));
                        mat.color = new Color(0.2f, 0.3f, 0.35f, 0.2f);
                        r.material = mat;
                    }

                    patchObjects[gx, gz] = patch;
                }
            }
        }

        public void UpdateDecisionRegions(DecisionTreeNode root)
        {
            if (root == null || patchObjects == null) return;

            float step = terrainWidth / gridSize;

            for (int gz = 0; gz < gridSize; gz++)
            {
                for (int gx = 0; gx < gridSize; gx++)
                {
                    // Map grid indices to feature coordinates x1, x2 in [-5, 5]
                    float x1 = Mathf.Lerp(-5f, 5f, (float)gx / (gridSize - 1));
                    float x2 = Mathf.Lerp(-5f, 5f, (float)gz / (gridSize - 1));

                    int predClass = root.Predict(new float[] { x1, x2 });

                    if (patchObjects[gx, gz] != null)
                    {
                        Renderer r = patchObjects[gx, gz].GetComponent<Renderer>();
                        if (r != null)
                        {
                            Color c = (predClass >= 0 && predClass < classColors.Length) ? classColors[predClass] : Color.white;
                            r.material.color = c;
                        }
                    }
                }
            }
        }
    }
}

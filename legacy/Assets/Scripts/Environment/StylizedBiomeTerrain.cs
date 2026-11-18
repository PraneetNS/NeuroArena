using System.Collections.Generic;
using UnityEngine;

namespace NeuroArena.Environment
{
    /// <summary>
    /// Expansive 2-4 km² Stylized Low-Poly Modeled Mesh Terrain Generator with Built-in LOD.
    /// Replaces small flat arenas with a massive 2.56 km² (1600m x 1600m) geographic expanse
    /// featuring organic elevation variation, rolling dunes, glacial crags, basalt terraces,
    /// and built-in focal/vista LOD grid subdivision for mobile budget efficiency.
    /// </summary>
    [RequireComponent(typeof(MeshFilter), typeof(MeshRenderer), typeof(MeshCollider))]
    public class StylizedBiomeTerrain : MonoBehaviour
    {
        [Header("Expansive Terrain Dimensions (2.56 km²)")]
        [SerializeField] private float terrainSize = 1600f; // 1.6 km x 1.6 km = 2.56 km²
        [SerializeField] private int gridResolutionX = 96;
        [SerializeField] private int gridResolutionZ = 96;

        [Header("Heightmap & Geographic Parameters")]
        [SerializeField] private float maxElevation = 18.0f;
        [SerializeField] private float plateauRadius = 24.0f;
        [SerializeField] private float ridgeHeight = 35.0f;

        [Header("Active Biome")]
        [SerializeField] private int currentBiome = 0;

        private MeshFilter meshFilter;
        private MeshCollider meshCollider;
        private MeshRenderer meshRenderer;

        public float TerrainSize => terrainSize;
        public float PlayableAreaKm2 => (terrainSize * terrainSize) / 1000000.0f;

        private void Awake()
        {
            meshFilter = GetComponent<MeshFilter>();
            meshCollider = GetComponent<MeshCollider>();
            meshRenderer = GetComponent<MeshRenderer>();
        }

        private void Start()
        {
            GenerateBiomeTerrain(currentBiome);
        }

        public void GenerateBiomeTerrain(int biomeIndex)
        {
            currentBiome = Mathf.Clamp(biomeIndex, 0, 5);

            Mesh mesh = new Mesh { name = $"StylizedExpansiveTerrain_Biome_{currentBiome}" };
            mesh.indexFormat = UnityEngine.Rendering.IndexFormat.UInt32;

            float halfSize = terrainSize * 0.5f;

            // Generate Non-linear / Multi-LOD grid coordinates
            // Tighter vertex spacing near center focal area (0-150m), broader spacing at outer perimeter (150m-800m)
            float[] xCoords = GenerateAdaptiveLODCoords(gridResolutionX, halfSize);
            float[] zCoords = GenerateAdaptiveLODCoords(gridResolutionZ, halfSize);

            int resX = xCoords.Length;
            int resZ = zCoords.Length;

            // Compute elevations
            float[,] heightMap = new float[resX, resZ];
            for (int z = 0; z < resZ; z++)
            {
                for (int x = 0; x < resX; x++)
                {
                    heightMap[x, z] = CalculateElevation(xCoords[x], zCoords[z], currentBiome);
                }
            }

            // Generate Faceted Low-Poly Quads (Unshared Vertices for Flat Shading)
            List<Vector3> vertices = new List<Vector3>();
            List<Vector3> normals = new List<Vector3>();
            List<Color> colors = new List<Color>();
            List<Vector2> uvs = new List<Vector2>();
            List<int> triangles = new List<int>();

            for (int z = 0; z < resZ - 1; z++)
            {
                for (int x = 0; x < resX - 1; x++)
                {
                    float x0 = xCoords[x];
                    float x1 = xCoords[x + 1];
                    float z0 = zCoords[z];
                    float z1 = zCoords[z + 1];

                    float y00 = heightMap[x, z];
                    float y10 = heightMap[x + 1, z];
                    float y01 = heightMap[x, z + 1];
                    float y11 = heightMap[x + 1, z + 1];

                    Vector3 v00 = new Vector3(x0, y00, z0);
                    Vector3 v10 = new Vector3(x1, y10, z0);
                    Vector3 v01 = new Vector3(x0, y01, z1);
                    Vector3 v11 = new Vector3(x1, y11, z1);

                    // Triangle 1: (v00, v01, v10)
                    AddFacetedTriangle(v00, v01, v10, vertices, normals, colors, uvs, triangles, currentBiome);

                    // Triangle 2: (v10, v01, v11)
                    AddFacetedTriangle(v10, v01, v11, vertices, normals, colors, uvs, triangles, currentBiome);
                }
            }

            mesh.vertices = vertices.ToArray();
            mesh.normals = normals.ToArray();
            mesh.colors = colors.ToArray();
            mesh.uv = uvs.ToArray();
            mesh.triangles = triangles.ToArray();
            mesh.RecalculateBounds();

            if (meshFilter != null) meshFilter.sharedMesh = mesh;
            if (meshCollider != null) meshCollider.sharedMesh = mesh;

            ApplyBiomeTerrainMaterial(currentBiome);
            Debug.Log($"[StylizedBiomeTerrain] Generated {PlayableAreaKm2:F2} km² Expansive Terrain for Biome {currentBiome + 1} with {vertices.Count / 3} Faceted Polys (Built-in LOD Grid)!");
        }

        /// <summary>
        /// Generates non-linear adaptive LOD coordinates with higher density in the central playable zone
        /// and wider spacing toward the 800m perimeter.
        /// </summary>
        private float[] GenerateAdaptiveLODCoords(int resolution, float halfSize)
        {
            float[] coords = new float[resolution + 1];
            for (int i = 0; i <= resolution; i++)
            {
                float t = (float)i / resolution; // 0 to 1
                float centered = (t - 0.5f) * 2f; // -1 to 1

                // Cubic warping for continuous center-density LOD
                float sign = Mathf.Sign(centered);
                float absVal = Mathf.Abs(centered);
                float warped = sign * Mathf.Pow(absVal, 1.45f);

                coords[i] = warped * halfSize;
            }
            return coords;
        }

        private void AddFacetedTriangle(
            Vector3 v0, Vector3 v1, Vector3 v2,
            List<Vector3> verts, List<Vector3> norms, List<Color> cols, List<Vector2> uvs, List<int> tris,
            int biome)
        {
            Vector3 normal = Vector3.Cross(v1 - v0, v2 - v0).normalized;
            float slopeAngle = Vector3.Angle(normal, Vector3.up);

            Color triColor = GetBiomeTerrainColor(biome, (v0.y + v1.y + v2.y) / 3f, slopeAngle);

            int startIdx = verts.Count;
            verts.Add(v0);
            verts.Add(v1);
            verts.Add(v2);

            norms.Add(normal);
            norms.Add(normal);
            norms.Add(normal);

            cols.Add(triColor);
            cols.Add(triColor);
            cols.Add(triColor);

            uvs.Add(new Vector2(v0.x / terrainSize, v0.z / terrainSize));
            uvs.Add(new Vector2(v1.x / terrainSize, v1.z / terrainSize));
            uvs.Add(new Vector2(v2.x / terrainSize, v2.z / terrainSize));

            tris.Add(startIdx);
            tris.Add(startIdx + 1);
            tris.Add(startIdx + 2);
        }

        public float CalculateElevation(float wx, float wz, int biome)
        {
            float distFromCenter = Mathf.Sqrt(wx * wx + wz * wz);
            float centerFlatWeight = Mathf.SmoothStep(0f, 1f, Mathf.InverseLerp(plateauRadius, plateauRadius + 15f, distFromCenter));

            float elevation = 0f;
            switch (biome)
            {
                case 0: // Biome 1: The Linear Steppes (Expansive Rolling Sand Dunes & Meso Slabs)
                    float dune1 = Mathf.Sin(wx * 0.012f + wz * 0.008f) * 6.5f;
                    float dune2 = Mathf.Cos(wz * 0.016f) * 4.2f;
                    float detailDune = Mathf.Sin(wx * 0.045f) * 1.5f;
                    elevation = (dune1 + dune2 + detailDune) * centerFlatWeight;
                    break;

                case 1: // Biome 2: The Binary Marshlands (Vast Wetland Basin with Sunken Dips)
                    float marshNoise = Mathf.PerlinNoise(wx * 0.018f + 250f, wz * 0.018f + 250f);
                    float marshDips = Mathf.Sin(wx * 0.035f) * Mathf.Cos(wz * 0.035f) * 3.5f;
                    elevation = ((marshNoise - 0.48f) * 8.5f + marshDips) * centerFlatWeight;
                    break;

                case 2: // Biome 3: The Variance Tundra (Massive Glacial Ice Ridges & Sawtooth Peaks)
                    float foldedIce = Mathf.Abs(Mathf.PerlinNoise(wx * 0.015f + 300f, wz * 0.015f + 300f) - 0.5f) * 2.0f;
                    float glacialSaw = Mathf.Sin(wx * 0.028f + wz * 0.022f) * 5.2f;
                    elevation = (foldedIce * 14.5f + glacialSaw) * centerFlatWeight;
                    break;

                case 3: // Biome 4: The Branching Canopy (Vast Rolling Forest Valleys & Elevated Tiers)
                    float canopyHills = Mathf.Sin(wx * 0.009f) * Mathf.Cos(wz * 0.009f) * 8.5f;
                    float canopyDetail = Mathf.PerlinNoise(wx * 0.022f + 400f, wz * 0.022f + 400f) * 4.5f;
                    elevation = (canopyHills + canopyDetail) * centerFlatWeight;
                    break;

                case 4: // Biome 5: The Deep Synapse Citadel (Quantized Architectural Basalt Terraces)
                    float ringPattern = Mathf.Cos(distFromCenter * 0.08f) * 7.5f;
                    float rawElev = (ringPattern + Mathf.PerlinNoise(wx * 0.014f + 600f, wz * 0.014f + 600f) * 5.0f);
                    elevation = (Mathf.Round(rawElev / 2.0f) * 2.0f) * centerFlatWeight;
                    break;

                case 5: // Biome 6: The Semantic Expanse (Deep Cosmic Abyss with Levitating Island Dais)
                    bool isPlatform = distFromCenter < 32f || 
                                     (Mathf.Sin(wx * 0.035f) * Mathf.Cos(wz * 0.035f) > 0.28f);
                    if (isPlatform)
                    {
                        elevation = (2.5f + Mathf.Sin(wx * 0.01f + wz * 0.01f) * 1.2f);
                    }
                    else
                    {
                        elevation = -120f; // Deep void drop for cosmic starfield abyss
                    }
                    break;
            }

            // Natural outer boundary containment mountain ridge (except for cosmic void in Biome 6)
            if (biome != 5)
            {
                float boundaryDist = Mathf.Max(Mathf.Abs(wx), Mathf.Abs(wz));
                float outerStart = terrainSize * 0.5f - 120f;
                float outerEnd = terrainSize * 0.5f;
                if (boundaryDist > outerStart)
                {
                    float ridgeT = Mathf.InverseLerp(outerStart, outerEnd, boundaryDist);
                    elevation += ridgeT * ridgeHeight;
                }
            }

            return elevation;
        }

        private Color GetBiomeTerrainColor(int biome, float avgHeight, float slopeAngle)
        {
            bool isCliff = slopeAngle > 35f;

            switch (biome)
            {
                case 0: // Biome 1: Linear Steppes (Amber / Earth)
                    if (isCliff) return new Color(0.47f, 0.21f, 0.06f);
                    return Color.Lerp(new Color(0.85f, 0.55f, 0.15f), new Color(0.96f, 0.75f, 0.25f), Mathf.InverseLerp(0f, 12f, avgHeight));

                case 1: // Biome 2: Binary Marshlands (Teal / Violet)
                    if (isCliff) return new Color(0.35f, 0.18f, 0.58f);
                    return Color.Lerp(new Color(0.08f, 0.52f, 0.48f), new Color(0.12f, 0.72f, 0.65f), Mathf.InverseLerp(-4f, 8f, avgHeight));

                case 2: // Biome 3: Variance Tundra (Ice-Blue / Frost)
                    if (isCliff) return new Color(0.12f, 0.28f, 0.42f);
                    return Color.Lerp(new Color(0.42f, 0.78f, 0.95f), new Color(0.85f, 0.95f, 1.0f), Mathf.InverseLerp(0f, 16f, avgHeight));

                case 3: // Biome 4: Branching Canopy (Emerald / Gold)
                    if (isCliff) return new Color(0.04f, 0.25f, 0.18f);
                    return Color.Lerp(new Color(0.06f, 0.58f, 0.38f), new Color(0.15f, 0.78f, 0.45f), Mathf.InverseLerp(0f, 12f, avgHeight));

                case 4: // Biome 5: Deep Synapse Citadel (Neon Purple / Cyan)
                    if (isCliff) return new Color(0.10f, 0.08f, 0.18f);
                    return Color.Lerp(new Color(0.45f, 0.18f, 0.75f), new Color(0.15f, 0.65f, 0.82f), Mathf.InverseLerp(0f, 12f, avgHeight));

                case 5: // Biome 6: Semantic Expanse (Starlit White / Holographic Indigo)
                    if (isCliff) return new Color(0.25f, 0.28f, 0.55f);
                    return Color.Lerp(new Color(0.65f, 0.70f, 0.92f), new Color(0.95f, 0.96f, 1.0f), Mathf.InverseLerp(0f, 6f, avgHeight));

                default:
                    return new Color(0.25f, 0.45f, 0.35f);
            }
        }

        private void ApplyBiomeTerrainMaterial(int biome)
        {
            if (meshRenderer == null) return;
            Shader shader = Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard");
            if (shader != null)
            {
                Material mat = new Material(shader);
                mat.color = Color.white;
                meshRenderer.sharedMaterial = mat;
            }
        }

        public float GetHeightAt(float worldX, float worldZ)
        {
            return CalculateElevation(worldX, worldZ, currentBiome);
        }
    }
}

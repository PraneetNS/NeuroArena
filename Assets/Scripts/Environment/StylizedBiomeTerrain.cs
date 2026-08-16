using System.Collections.Generic;
using UnityEngine;

namespace NeuroArena.Environment
{
    /// <summary>
    /// Stylized Low-Poly Modeled Mesh Terrain Generator.
    /// Replaces flat ground with faceted, low-poly geometry (Synty POLYGON aesthetic)
    /// featuring organic elevation variation, plateaus, cliffs, natural ramp paths,
    /// and per-biome vertex colors matching Stage 18 palettes.
    /// </summary>
    [RequireComponent(typeof(MeshFilter), typeof(MeshRenderer), typeof(MeshCollider))]
    public class StylizedBiomeTerrain : MonoBehaviour
    {
        [Header("Terrain Dimensions")]
        [SerializeField] private int gridResolutionX = 64;
        [SerializeField] private int gridResolutionZ = 64;
        [SerializeField] private float terrainSize = 100f; // Total width/length

        [Header("Heightmap Parameters")]
        [SerializeField] private float maxElevation = 6.5f;
        [SerializeField] private float noiseScale = 0.035f;
        [SerializeField] private float plateauRadius = 14f;
        [SerializeField] private float ridgeHeight = 8.0f;

        [Header("Active Biome")]
        [SerializeField] private int currentBiome = 0;

        private MeshFilter meshFilter;
        private MeshCollider meshCollider;
        private MeshRenderer meshRenderer;

        public float TerrainSize => terrainSize;

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

            Mesh mesh = new Mesh { name = $"StylizedTerrain_Biome_{currentBiome}" };
            mesh.indexFormat = UnityEngine.Rendering.IndexFormat.UInt32;

            float cellStep = terrainSize / gridResolutionX;
            float halfSize = terrainSize * 0.5f;

            // Generate raw elevation grid
            float[,] heightMap = new float[gridResolutionX + 1, gridResolutionZ + 1];
            for (int z = 0; z <= gridResolutionZ; z++)
            {
                for (int x = 0; x <= gridResolutionX; x++)
                {
                    float wx = x * cellStep - halfSize;
                    float wz = z * cellStep - halfSize;
                    heightMap[x, z] = CalculateElevation(wx, wz, currentBiome);
                }
            }

            // Generate Faceted Low-Poly Quads (Unshared Vertices for Flat Shading)
            List<Vector3> vertices = new List<Vector3>();
            List<Vector3> normals = new List<Vector3>();
            List<Color> colors = new List<Color>();
            List<Vector2> uvs = new List<Vector2>();
            List<int> triangles = new List<int>();

            for (int z = 0; z < gridResolutionZ; z++)
            {
                for (int x = 0; x < gridResolutionX; x++)
                {
                    float x0 = x * cellStep - halfSize;
                    float x1 = (x + 1) * cellStep - halfSize;
                    float z0 = z * cellStep - halfSize;
                    float z1 = (z + 1) * cellStep - halfSize;

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
            float centerFlatWeight = Mathf.SmoothStep(0f, 1f, Mathf.InverseLerp(plateauRadius, plateauRadius + 10f, distFromCenter));

            float elevation = 0f;
            switch (biome)
            {
                case 0: // Biome 1: The Linear Steppes (Rolling Terraced Plains)
                    float n1 = Mathf.PerlinNoise(wx * noiseScale + 120f, wz * noiseScale + 120f);
                    elevation = (n1 * maxElevation) * centerFlatWeight;
                    if (distFromCenter > 22f) elevation = Mathf.Round(elevation / 0.8f) * 0.8f; // Terraced steps
                    break;

                case 1: // Biome 2: The Binary Marshlands (Sunken Basin with Mound Islands)
                    float n2 = Mathf.PerlinNoise(wx * noiseScale * 1.5f + 250f, wz * noiseScale * 1.5f + 250f);
                    elevation = ((n2 - 0.45f) * (maxElevation * 1.2f)) * centerFlatWeight;
                    break;

                case 2: // Biome 3: The Variance Tundra (Jagged Glacial Ridges & Crags)
                    float n3a = Mathf.PerlinNoise(wx * 0.05f + 300f, wz * 0.05f + 300f);
                    float n3b = Mathf.PerlinNoise(wx * 0.1f + 500f, wz * 0.1f + 500f) * 0.5f;
                    elevation = ((n3a + n3b) * maxElevation * 1.4f) * centerFlatWeight;
                    break;

                case 3: // Biome 4: The Branching Canopy (Lush Tiered Terraces)
                    float n4 = Mathf.PerlinNoise(wx * noiseScale * 0.8f + 400f, wz * noiseScale * 0.8f + 400f);
                    elevation = (Mathf.Floor(n4 * 5f) * 1.2f) * centerFlatWeight;
                    break;

                case 4: // Biome 5: The Deep Synapse Citadel (Hexagonal Basalt Elevation Rings)
                    float ringPhase = Mathf.Cos(distFromCenter * 0.25f);
                    elevation = (ringPhase * 2.5f + Mathf.PerlinNoise(wx * 0.06f, wz * 0.06f) * 3f) * centerFlatWeight;
                    break;

                case 5: // Biome 6: The Semantic Expanse (Celestial Star Plateau)
                    float n6 = Mathf.PerlinNoise(wx * 0.02f + 700f, wz * 0.02f + 700f);
                    elevation = (n6 * 2.0f) * centerFlatWeight;
                    break;
            }

            // Natural outer boundary containment ridge
            float boundaryDist = Mathf.Max(Mathf.Abs(wx), Mathf.Abs(wz));
            if (boundaryDist > (terrainSize * 0.5f - 8f))
            {
                float ridgeT = Mathf.InverseLerp(terrainSize * 0.5f - 8f, terrainSize * 0.5f, boundaryDist);
                elevation += ridgeT * ridgeHeight;
            }

            return elevation;
        }

        private Color GetBiomeTerrainColor(int biome, float avgHeight, float slopeAngle)
        {
            bool isCliff = slopeAngle > 35f;

            switch (biome)
            {
                case 0: // Biome 1: Linear Steppes (Amber / Earth)
                    if (isCliff) return new Color(0.47f, 0.21f, 0.06f); // Dark Earth Ochre
                    return Color.Lerp(new Color(0.85f, 0.55f, 0.15f), new Color(0.96f, 0.75f, 0.25f), Mathf.InverseLerp(0f, 6f, avgHeight));

                case 1: // Biome 2: Binary Marshlands (Teal / Violet)
                    if (isCliff) return new Color(0.35f, 0.18f, 0.58f); // Violet Stone
                    return Color.Lerp(new Color(0.08f, 0.52f, 0.48f), new Color(0.12f, 0.72f, 0.65f), Mathf.InverseLerp(-2f, 4f, avgHeight));

                case 2: // Biome 3: Variance Tundra (Ice-Blue / Frost)
                    if (isCliff) return new Color(0.12f, 0.28f, 0.42f); // Dark Ice Slate
                    return Color.Lerp(new Color(0.42f, 0.78f, 0.95f), new Color(0.85f, 0.95f, 1.0f), Mathf.InverseLerp(0f, 8f, avgHeight));

                case 3: // Biome 4: Branching Canopy (Emerald / Gold)
                    if (isCliff) return new Color(0.04f, 0.25f, 0.18f); // Deep Pine Bark
                    return Color.Lerp(new Color(0.06f, 0.58f, 0.38f), new Color(0.15f, 0.78f, 0.45f), Mathf.InverseLerp(0f, 6f, avgHeight));

                case 4: // Biome 5: Deep Synapse Citadel (Neon Purple / Cyan)
                    if (isCliff) return new Color(0.10f, 0.08f, 0.18f); // Obsidian Basalt
                    return Color.Lerp(new Color(0.45f, 0.18f, 0.75f), new Color(0.15f, 0.65f, 0.82f), Mathf.InverseLerp(0f, 6f, avgHeight));

                case 5: // Biome 6: Semantic Expanse (Starlit White / Holographic Indigo)
                    if (isCliff) return new Color(0.25f, 0.28f, 0.55f); // Indigo Void
                    return Color.Lerp(new Color(0.65f, 0.70f, 0.92f), new Color(0.95f, 0.96f, 1.0f), Mathf.InverseLerp(0f, 4f, avgHeight));

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
                mat.color = Color.white; // Driven by vertex colors
                meshRenderer.sharedMaterial = mat;
            }
        }

        public float GetHeightAt(float worldX, float worldZ)
        {
            return CalculateElevation(worldX, worldZ, currentBiome);
        }
    }
}

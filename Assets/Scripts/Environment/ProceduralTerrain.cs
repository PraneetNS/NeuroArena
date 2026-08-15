using UnityEngine;

namespace NeuroArena.Environment
{
    /// <summary>
    /// Generates a stylized 3D test arena with rolling elevation hills,
    /// test ramps, platforms, and boundary colliders for mobile movement verification.
    /// </summary>
    [RequireComponent(typeof(MeshFilter), typeof(MeshRenderer), typeof(MeshCollider))]
    public class ProceduralTerrain : MonoBehaviour
    {
        [Header("Grid Dimensions")]
        [SerializeField] private int width = 80;
        [SerializeField] private int length = 80;
        [SerializeField] private float cellSize = 1.25f;

        [Header("Heightmap Parameters")]
        [SerializeField] private float hillHeight = 3.5f;
        [SerializeField] private float noiseFrequency = 0.04f;
        [SerializeField] private float terraceStep = 1.0f;

        private void Awake()
        {
            GenerateArenaMesh();
            SpawnObstaclesAndRamps();
        }

        public void GenerateArenaMesh()
        {
            MeshFilter filter = GetComponent<MeshFilter>();
            MeshCollider col = GetComponent<MeshCollider>();
            MeshRenderer rend = GetComponent<MeshRenderer>();

            Mesh mesh = new Mesh { name = "ProceduralArenaMesh" };

            int xVerts = width + 1;
            int zVerts = length + 1;
            Vector3[] vertices = new Vector3[xVerts * zVerts];
            Vector2[] uvs = new Vector2[vertices.Length];
            Color[] colors = new Color[vertices.Length];
            int[] triangles = new int[width * length * 6];

            float xOffset = (width * cellSize) * 0.5f;
            float zOffset = (length * cellSize) * 0.5f;

            for (int z = 0, i = 0; z <= length; z++)
            {
                for (int x = 0; x <= width; x++, i++)
                {
                    float worldX = x * cellSize - xOffset;
                    float worldZ = z * cellSize - zOffset;

                    // Distance from center for flat starting zone
                    float distFromCenter = Mathf.Sqrt(worldX * worldX + worldZ * worldZ);
                    float centerBlend = Mathf.SmoothStep(0f, 1f, Mathf.InverseLerp(12f, 35f, distFromCenter));

                    // Perlin noise rolling terrain
                    float noise = Mathf.PerlinNoise((worldX + 500f) * noiseFrequency, (worldZ + 500f) * noiseFrequency);
                    float height = (noise - 0.35f) * hillHeight * centerBlend;

                    // Stepped terraces at outskirts
                    if (distFromCenter > 25f)
                    {
                        height = Mathf.Round(height / terraceStep) * terraceStep;
                    }

                    // Border boundary ridges
                    if (x <= 2 || x >= width - 2 || z <= 2 || z >= length - 2)
                    {
                        height += 6.0f;
                    }

                    vertices[i] = new Vector3(worldX, height, worldZ);
                    uvs[i] = new Vector2((float)x / width * 10f, (float)z / length * 10f);

                    // Vertex coloring for slope/elevation
                    float t = Mathf.InverseLerp(-1f, 5f, height);
                    colors[i] = Color.Lerp(new Color(0.12f, 0.45f, 0.32f), new Color(0.22f, 0.28f, 0.38f), t);
                }
            }

            int vert = 0;
            int tris = 0;
            for (int z = 0; z < length; z++)
            {
                for (int x = 0; x < width; x++)
                {
                    triangles[tris + 0] = vert + 0;
                    triangles[tris + 1] = vert + width + 1;
                    triangles[tris + 2] = vert + 1;
                    triangles[tris + 3] = vert + 1;
                    triangles[tris + 4] = vert + width + 1;
                    triangles[tris + 5] = vert + width + 2;

                    vert++;
                    tris += 6;
                }
                vert++;
            }

            mesh.vertices = vertices;
            mesh.uv = uvs;
            mesh.colors = colors;
            mesh.triangles = triangles;
            mesh.RecalculateNormals();
            mesh.RecalculateBounds();

            filter.sharedMesh = mesh;
            col.sharedMesh = mesh;

            if (rend.sharedMaterial == null)
            {
                Shader shader = Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard") ?? Shader.Find("Diffuse");
                if (shader != null)
                {
                    Material mat = new Material(shader);
                    mat.color = new Color(0.25f, 0.35f, 0.30f);
                    rend.sharedMaterial = mat;
                }
            }
        }

        private void SpawnObstaclesAndRamps()
        {
            Transform obstaclesRoot = new GameObject("ArenaObstacles").transform;
            obstaclesRoot.SetParent(transform);

            // Spawn geometric test pillars & ramps
            Vector3[] pillarPositions = new Vector3[]
            {
                new Vector3(-8f, 1f, 10f),
                new Vector3(12f, 1.5f, 6f),
                new Vector3(-14f, 1f, -12f),
                new Vector3(8f, 2f, -10f),
                new Vector3(0f, 0.75f, 18f)
            };

            for (int i = 0; i < pillarPositions.Length; i++)
            {
                GameObject pillar = GameObject.CreatePrimitive(PrimitiveType.Cube);
                pillar.name = $"TestPillar_{i + 1}";
                pillar.transform.SetParent(obstaclesRoot);
                pillar.transform.position = pillarPositions[i];
                pillar.transform.localScale = new Vector3(2.5f, 2.5f, 2.5f);
                
                Renderer r = pillar.GetComponent<Renderer>();
                if (r != null)
                {
                    Shader s = Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard");
                    if (s != null)
                    {
                        Material mat = new Material(s);
                        mat.color = new Color(0.3f, 0.45f, 0.65f);
                        r.material = mat;
                    }
                }
            }

            // Spawn a test ramp
            GameObject ramp = GameObject.CreatePrimitive(PrimitiveType.Cube);
            ramp.name = "TestRamp";
            ramp.transform.SetParent(obstaclesRoot);
            ramp.transform.position = new Vector3(6f, 1f, 16f);
            ramp.transform.localScale = new Vector3(3f, 0.4f, 6f);
            ramp.transform.rotation = Quaternion.Euler(-18f, 0f, 0f);
        }
    }
}

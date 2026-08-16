using System.Collections.Generic;
using UnityEngine;

namespace NeuroArena.Environment
{
    /// <summary>
    /// Scatters stylized low-poly nature props (trees, boulders, spore clusters, crystal shards)
    /// across the active biome terrain according to Stage 18 color themes.
    /// </summary>
    public class BiomeFoliageScatterer : MonoBehaviour
    {
        [Header("Foliage Density")]
        [SerializeField] private int treeCount = 28;
        [SerializeField] private int rockCount = 35;
        [SerializeField] private int crystalClusterCount = 14;

        [Header("Exclusion Zones")]
        [SerializeField] private float playerSpawnClearRadius = 8.0f;
        [SerializeField] private Vector3 labStationPos = new Vector3(14f, 0f, 14f);
        [SerializeField] private float labStationClearRadius = 6.0f;

        private GameObject currentFoliageRoot;

        public void PopulateBiomeEnvironment(int biomeIndex, StylizedBiomeTerrain terrain)
        {
            if (currentFoliageRoot != null)
            {
                Destroy(currentFoliageRoot);
            }

            currentFoliageRoot = new GameObject($"BiomeFoliage_Biome_{biomeIndex}");
            currentFoliageRoot.transform.SetParent(transform, false);

            float halfSize = terrain != null ? terrain.TerrainSize * 0.45f : 40f;

            // 1. Scatter Low-Poly Trees
            StylizedLowPolyMeshes.TreeStyle style = GetTreeStyleForBiome(biomeIndex);
            Color[] treeColors = GetTreePalette(biomeIndex);

            for (int i = 0; i < treeCount; i++)
            {
                Vector2 samplePos = GetRandomScatterPosition(halfSize);
                if (IsPositionExcluded(samplePos)) continue;

                float y = terrain != null ? terrain.GetHeightAt(samplePos.x, samplePos.y) : 0f;
                Vector3 worldPos = new Vector3(samplePos.x, y, samplePos.y);

                GameObject tree = StylizedLowPolyMeshes.CreateLowPolyTree(
                    style, i * 73 + 11, treeColors[0], treeColors[1], treeColors[2]);
                tree.transform.SetParent(currentFoliageRoot.transform, false);
                tree.transform.position = worldPos;
                tree.transform.rotation = Quaternion.Euler(0f, Random.Range(0f, 360f), 0f);
                float s = Random.Range(0.85f, 1.35f);
                tree.transform.localScale = new Vector3(s, s, s);
            }

            // 2. Scatter Low-Poly Boulders & Rocks
            Color rockColor = GetRockColor(biomeIndex);
            for (int i = 0; i < rockCount; i++)
            {
                Vector2 samplePos = GetRandomScatterPosition(halfSize);
                if (IsPositionExcluded(samplePos)) continue;

                float y = terrain != null ? terrain.GetHeightAt(samplePos.x, samplePos.y) : 0f;
                Vector3 worldPos = new Vector3(samplePos.x, y, samplePos.y);

                GameObject rock = new GameObject($"LowPolyBoulder_{i + 1}");
                rock.transform.SetParent(currentFoliageRoot.transform, false);
                rock.transform.position = worldPos;
                rock.transform.rotation = Quaternion.Euler(Random.Range(-10f, 10f), Random.Range(0f, 360f), Random.Range(-10f, 10f));

                Vector3 rockScale = new Vector3(
                    Random.Range(1.2f, 2.8f),
                    Random.Range(1.0f, 2.2f),
                    Random.Range(1.2f, 2.8f)
                );

                MeshFilter mf = rock.AddComponent<MeshFilter>();
                MeshRenderer mr = rock.AddComponent<MeshRenderer>();
                MeshCollider mc = rock.AddComponent<MeshCollider>();

                Mesh rockMesh = StylizedLowPolyMeshes.CreateLowPolyRockMesh(i * 127 + 5, rockScale);
                mf.sharedMesh = rockMesh;
                mc.sharedMesh = rockMesh;

                Shader shader = Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard");
                Material mat = new Material(shader);
                mat.color = rockColor * Random.Range(0.88f, 1.12f);
                mr.sharedMaterial = mat;
            }

            // 3. Scatter Energy Formations / Crystals
            Color crystalColor = treeColors[2];
            for (int i = 0; i < crystalClusterCount; i++)
            {
                Vector2 samplePos = GetRandomScatterPosition(halfSize);
                if (IsPositionExcluded(samplePos)) continue;

                float y = terrain != null ? terrain.GetHeightAt(samplePos.x, samplePos.y) : 0f;
                Vector3 worldPos = new Vector3(samplePos.x, y + 0.35f, samplePos.y);

                GameObject crystal = GameObject.CreatePrimitive(PrimitiveType.Cube);
                crystal.name = $"BiomeCrystalNode_{i + 1}";
                crystal.transform.SetParent(currentFoliageRoot.transform, false);
                crystal.transform.position = worldPos;
                crystal.transform.rotation = Quaternion.Euler(Random.Range(15f, 35f), Random.Range(0f, 360f), Random.Range(10f, 25f));
                crystal.transform.localScale = new Vector3(0.45f, Random.Range(1.5f, 3.2f), 0.45f);

                Renderer r = crystal.GetComponent<Renderer>();
                if (r != null)
                {
                    Shader s = Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard");
                    Material mat = new Material(s);
                    mat.color = crystalColor;
                    mat.EnableKeyword("_EMISSION");
                    mat.SetColor("_EmissionColor", crystalColor * 1.8f);
                    r.sharedMaterial = mat;
                }
            }
        }

        private Vector2 GetRandomScatterPosition(float halfSize)
        {
            float r = Random.Range(6.0f, halfSize);
            float theta = Random.Range(0f, Mathf.PI * 2f);
            return new Vector2(Mathf.Cos(theta) * r, Mathf.Sin(theta) * r);
        }

        private bool IsPositionExcluded(Vector2 pos)
        {
            if (pos.magnitude < playerSpawnClearRadius) return true;
            if (Vector2.Distance(pos, new Vector2(labStationPos.x, labStationPos.z)) < labStationClearRadius) return true;
            return false;
        }

        private StylizedLowPolyMeshes.TreeStyle GetTreeStyleForBiome(int biomeIndex)
        {
            switch (biomeIndex)
            {
                case 0: return StylizedLowPolyMeshes.TreeStyle.ConiferPine;
                case 1: return StylizedLowPolyMeshes.TreeStyle.SporeMushroom;
                case 2: return StylizedLowPolyMeshes.TreeStyle.ConiferPine; // Frosted Pines
                case 3: return StylizedLowPolyMeshes.TreeStyle.LushDeciduous;
                case 4: return StylizedLowPolyMeshes.TreeStyle.CyberPillarTree;
                case 5: return StylizedLowPolyMeshes.TreeStyle.AstralPrismPillar;
                default: return StylizedLowPolyMeshes.TreeStyle.ConiferPine;
            }
        }

        private Color[] GetTreePalette(int biomeIndex)
        {
            // Returns [TrunkColor, FoliageColor, AccentColor] matching Stage 18
            switch (biomeIndex)
            {
                case 0: // Biome 1: The Linear Steppes (Amber / Earth)
                    return new Color[] {
                        new Color(0.42f, 0.24f, 0.12f), // Earth Trunk
                        new Color(0.85f, 0.58f, 0.12f), // Amber Foliage
                        new Color(0.98f, 0.75f, 0.14f)  // Warm Gold Crystal
                    };
                case 1: // Biome 2: The Binary Marshlands (Teal / Violet)
                    return new Color[] {
                        new Color(0.18f, 0.12f, 0.28f), // Deep Violet Stem
                        new Color(0.08f, 0.65f, 0.58f), // Teal Spore Cap
                        new Color(0.55f, 0.36f, 0.96f)  // Glowing Purple Gills
                    };
                case 2: // Biome 3: The Variance Tundra (Ice-Blue / Frost)
                    return new Color[] {
                        new Color(0.18f, 0.26f, 0.35f), // Slate Frost Trunk
                        new Color(0.38f, 0.75f, 0.95f), // Ice-Blue Foliage
                        new Color(0.72f, 0.90f, 0.98f)  // Frost Glaze Accent
                    };
                case 3: // Biome 4: The Branching Canopy (Emerald / Gold)
                    return new Color[] {
                        new Color(0.28f, 0.18f, 0.08f), // Rich Bark
                        new Color(0.06f, 0.72f, 0.45f), // Emerald Canopy
                        new Color(0.98f, 0.75f, 0.14f)  // Golden Sap
                    };
                case 4: // Biome 5: The Deep Synapse Citadel (Neon Purple / Cyan)
                    return new Color[] {
                        new Color(0.10f, 0.08f, 0.16f), // Obsidian Basalt
                        new Color(0.66f, 0.33f, 0.97f), // Neon Purple Conduit
                        new Color(0.13f, 0.83f, 0.93f)  // Cyber Cyan Light
                    };
                case 5: // Biome 6: The Semantic Expanse (Starlit White / Holographic)
                    return new Color[] {
                        new Color(0.92f, 0.94f, 0.98f), // Starlight White
                        new Color(0.51f, 0.55f, 0.97f), // Holographic Indigo
                        new Color(0.22f, 0.74f, 0.97f)  // Prismatic Azure
                    };
                default:
                    return new Color[] { Color.gray, Color.green, Color.yellow };
            }
        }

        private Color GetRockColor(int biomeIndex)
        {
            switch (biomeIndex)
            {
                case 0: return new Color(0.48f, 0.38f, 0.28f); // Sandstone Earth
                case 1: return new Color(0.22f, 0.26f, 0.32f); // Wet Marsh Stone
                case 2: return new Color(0.35f, 0.48f, 0.62f); // Glacial Ice Granite
                case 3: return new Color(0.24f, 0.35f, 0.26f); // Mossy Forest Rock
                case 4: return new Color(0.12f, 0.10f, 0.18f); // Obsidian Basalt
                case 5: return new Color(0.65f, 0.68f, 0.85f); // Astral Starlit Slate
                default: return Color.gray;
            }
        }
    }
}

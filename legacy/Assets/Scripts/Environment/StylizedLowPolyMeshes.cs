using System.Collections.Generic;
using UnityEngine;

namespace NeuroArena.Environment
{
    /// <summary>
    /// Procedural Mesh Generator for Synty/Quaternius styled Low-Poly Nature Assets:
    /// - Faceted Low-Poly Boulders & Rock Clusters
    /// - Stylized Low-Poly Conifer, Deciduous, and Spore Trees
    /// - Low-Poly Ice/Resin Crystal Spikes
    /// - Low-Poly Grass & Shrub Clumps
    /// </summary>
    public static class StylizedLowPolyMeshes
    {
        public enum TreeStyle
        {
            ConiferPine,      // Biomes 1, 3
            SporeMushroom,    // Biome 2
            LushDeciduous,    // Biome 4
            CyberPillarTree,  // Biome 5
            AstralPrismPillar // Biome 6
        }

        #region Low-Poly Rock Generator
        /// <summary>
        /// Creates a faceted low-poly boulder mesh with randomized perturbations.
        /// </summary>
        public static Mesh CreateLowPolyRockMesh(int seed, Vector3 scale)
        {
            Random.InitState(seed);
            Mesh mesh = new Mesh { name = $"LowPolyRock_{seed}" };

            // Base icosahedron / perturbed sphere subdivision
            List<Vector3> verts = new List<Vector3>();
            List<int> tris = new List<int>();

            float t = (1.0f + Mathf.Sqrt(5.0f)) / 2.0f;
            Vector3[] baseVerts = new Vector3[]
            {
                new Vector3(-1,  t,  0).normalized,
                new Vector3( 1,  t,  0).normalized,
                new Vector3(-1, -t,  0).normalized,
                new Vector3( 1, -t,  0).normalized,
                new Vector3( 0, -1,  t).normalized,
                new Vector3( 0,  1,  t).normalized,
                new Vector3( 0, -1, -t).normalized,
                new Vector3( 0,  1, -t).normalized,
                new Vector3( t,  0, -1).normalized,
                new Vector3( t,  0,  1).normalized,
                new Vector3(-t,  0, -1).normalized,
                new Vector3(-t,  0,  1).normalized
            };

            int[] baseTris = new int[]
            {
                0, 11, 5,   0, 5, 1,    0, 1, 7,    0, 7, 10,   0, 10, 11,
                1, 5, 9,    5, 11, 4,   11, 10, 2,  10, 7, 6,   7, 1, 8,
                3, 9, 4,    3, 4, 2,    3, 2, 6,    3, 6, 8,    3, 8, 9,
                4, 9, 5,    2, 4, 11,   6, 2, 10,   8, 6, 7,    9, 8, 1
            };

            // Flatten faces to create distinct faceted low-poly look (flat shading)
            for (int i = 0; i < baseTris.Length; i += 3)
            {
                Vector3 v0 = baseVerts[baseTris[i]];
                Vector3 v1 = baseVerts[baseTris[i + 1]];
                Vector3 v2 = baseVerts[baseTris[i + 2]];

                // Displace vertices with noise
                v0 = DisplaceRockVertex(v0, scale, seed);
                v1 = DisplaceRockVertex(v1, scale, seed);
                v2 = DisplaceRockVertex(v2, scale, seed);

                int idx = verts.Count;
                verts.Add(v0);
                verts.Add(v1);
                verts.Add(v2);

                tris.Add(idx);
                tris.Add(idx + 1);
                tris.Add(idx + 2);
            }

            mesh.vertices = verts.ToArray();
            mesh.triangles = tris.ToArray();
            mesh.RecalculateNormals();
            mesh.RecalculateBounds();
            return mesh;
        }

        private static Vector3 DisplaceRockVertex(Vector3 v, Vector3 scale, int seed)
        {
            float noise = Mathf.PerlinNoise(v.x * 2.5f + seed, v.z * 2.5f + seed);
            float disp = 0.75f + noise * 0.5f;
            Vector3 result = new Vector3(v.x * scale.x, v.y * scale.y, v.z * scale.z) * disp;
            // Flatten bottom so rocks sit flat on ground
            if (result.y < -scale.y * 0.35f) result.y = -scale.y * 0.35f;
            return result;
        }
        #endregion

        #region Stylized Low-Poly Tree Generator
        /// <summary>
        /// Builds a stylized low-poly tree GameObject complete with trunk, faceted foliage layers, and colliders.
        /// </summary>
        public static GameObject CreateLowPolyTree(TreeStyle style, int seed, Color trunkColor, Color foliageColor, Color accentColor)
        {
            GameObject treeGO = new GameObject($"StylizedTree_{style}_{seed}");
            Random.InitState(seed);

            switch (style)
            {
                case TreeStyle.ConiferPine:
                    BuildConiferPine(treeGO, trunkColor, foliageColor);
                    break;
                case TreeStyle.SporeMushroom:
                    BuildSporeMushroom(treeGO, trunkColor, foliageColor, accentColor);
                    break;
                case TreeStyle.LushDeciduous:
                    BuildLushDeciduous(treeGO, trunkColor, foliageColor);
                    break;
                case TreeStyle.CyberPillarTree:
                    BuildCyberPillar(treeGO, trunkColor, accentColor);
                    break;
                case TreeStyle.AstralPrismPillar:
                    BuildAstralPrism(treeGO, foliageColor, accentColor);
                    break;
            }

            return treeGO;
        }

        private static void BuildConiferPine(GameObject parent, Color trunkColor, Color foliageColor)
        {
            // Trunk
            GameObject trunk = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            trunk.name = "Trunk";
            trunk.transform.SetParent(parent.transform, false);
            trunk.transform.localPosition = new Vector3(0f, 1.8f, 0f);
            trunk.transform.localScale = new Vector3(0.45f, 1.8f, 0.45f);
            ApplyColor(trunk, trunkColor);

            // 3-Tiered Faceted Foliage Cones
            float[] tierHeights = new float[] { 2.6f, 4.2f, 5.6f };
            float[] tierScales = new float[] { 3.2f, 2.4f, 1.6f };

            for (int i = 0; i < 3; i++)
            {
                GameObject cone = CreateFacetedCone($"Foliage_Tier_{i}", 6, tierScales[i], 1.8f);
                cone.transform.SetParent(parent.transform, false);
                cone.transform.localPosition = new Vector3(0f, tierHeights[i], 0f);
                cone.transform.localRotation = Quaternion.Euler(0f, i * 30f, 0f);
                ApplyColor(cone, foliageColor * (0.85f + i * 0.15f));
            }
        }

        private static void BuildLushDeciduous(GameObject parent, Color trunkColor, Color foliageColor)
        {
            // Trunk
            GameObject trunk = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            trunk.name = "Trunk";
            trunk.transform.SetParent(parent.transform, false);
            trunk.transform.localPosition = new Vector3(0f, 2.0f, 0f);
            trunk.transform.localScale = new Vector3(0.55f, 2.0f, 0.55f);
            ApplyColor(trunk, trunkColor);

            // Faceted spherical canopy clumps (Synty style)
            Vector3[] clumpOffsets = new Vector3[]
            {
                new Vector3(0f, 4.5f, 0f),
                new Vector3(-0.8f, 3.8f, 0.6f),
                new Vector3(0.9f, 3.9f, -0.5f),
                new Vector3(0.3f, 4.2f, 0.8f)
            };
            float[] clumpRadii = new float[] { 2.4f, 1.7f, 1.8f, 1.6f };

            for (int i = 0; i < clumpOffsets.Length; i++)
            {
                GameObject clump = new GameObject($"Canopy_{i}");
                clump.transform.SetParent(parent.transform, false);
                clump.transform.localPosition = clumpOffsets[i];

                MeshFilter mf = clump.AddComponent<MeshFilter>();
                MeshRenderer mr = clump.AddComponent<MeshRenderer>();
                mf.sharedMesh = CreateLowPolyRockMesh(i * 100 + 7, Vector3.one * clumpRadii[i]);
                ApplyColor(clump, foliageColor * (0.9f + i * 0.08f));
            }
        }

        private static void BuildSporeMushroom(GameObject parent, Color stemColor, Color capColor, Color sporeColor)
        {
            // Curving Stem
            GameObject stem = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            stem.name = "SporeStem";
            stem.transform.SetParent(parent.transform, false);
            stem.transform.localPosition = new Vector3(0f, 1.8f, 0f);
            stem.transform.localScale = new Vector3(0.5f, 1.8f, 0.5f);
            stem.transform.localRotation = Quaternion.Euler(5f, 0f, 3f);
            ApplyColor(stem, stemColor);

            // Cap
            GameObject cap = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            cap.name = "SporeCap";
            cap.transform.SetParent(parent.transform, false);
            cap.transform.localPosition = new Vector3(0f, 3.6f, 0f);
            cap.transform.localScale = new Vector3(3.2f, 1.1f, 3.2f);
            ApplyColor(cap, capColor);

            // Emissive Spore Gills / Ring
            GameObject ring = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            ring.name = "EmissiveSporeGills";
            ring.transform.SetParent(parent.transform, false);
            ring.transform.localPosition = new Vector3(0f, 3.1f, 0f);
            ring.transform.localScale = new Vector3(2.4f, 0.1f, 2.4f);
            ApplyColor(ring, sporeColor, emissive: true);
        }

        private static void BuildCyberPillar(GameObject parent, Color stoneColor, Color neonColor)
        {
            // Basalt Hexagonal Monolith
            GameObject pillar = CreateFacetedCone("CyberPillar", 6, 1.6f, 7.0f);
            pillar.transform.SetParent(parent.transform, false);
            pillar.transform.localPosition = new Vector3(0f, 0f, 0f);
            ApplyColor(pillar, stoneColor);

            // Neon Conduit insets
            GameObject conduit = GameObject.CreatePrimitive(PrimitiveType.Cube);
            conduit.name = "NeonConduit";
            conduit.transform.SetParent(parent.transform, false);
            conduit.transform.localPosition = new Vector3(0f, 3.5f, 0f);
            conduit.transform.localScale = new Vector3(0.2f, 6.0f, 1.7f);
            ApplyColor(conduit, neonColor, emissive: true);
        }

        private static void BuildAstralPrism(GameObject parent, Color prismColor, Color haloColor)
        {
            // Floating Astral Crystal
            GameObject prism = GameObject.CreatePrimitive(PrimitiveType.Cube);
            prism.name = "AstralPrism";
            prism.transform.SetParent(parent.transform, false);
            prism.transform.localPosition = new Vector3(0f, 3.2f, 0f);
            prism.transform.localScale = new Vector3(1.2f, 4.5f, 1.2f);
            prism.transform.localRotation = Quaternion.Euler(45f, 45f, 0f);
            ApplyColor(prism, prismColor, emissive: true);

            // Ground Energy Base
            GameObject baseRing = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            baseRing.name = "AstralBaseRing";
            baseRing.transform.SetParent(parent.transform, false);
            baseRing.transform.localPosition = new Vector3(0f, 0.1f, 0f);
            baseRing.transform.localScale = new Vector3(2.8f, 0.15f, 2.8f);
            ApplyColor(baseRing, haloColor);
        }
        #endregion

        #region Helper Primitives & Materials
        private static GameObject CreateFacetedCone(string name, int sides, float radius, float height)
        {
            GameObject go = new GameObject(name);
            MeshFilter mf = go.AddComponent<MeshFilter>();
            MeshRenderer mr = go.AddComponent<MeshRenderer>();
            MeshCollider mc = go.AddComponent<MeshCollider>();

            Mesh mesh = new Mesh { name = $"{name}_Mesh" };
            List<Vector3> verts = new List<Vector3>();
            List<int> tris = new List<int>();

            Vector3 apex = new Vector3(0f, height, 0f);
            Vector3 bottomCenter = Vector3.zero;

            Vector3[] baseCircle = new Vector3[sides];
            for (int i = 0; i < sides; i++)
            {
                float angle = (float)i / sides * Mathf.PI * 2f;
                baseCircle[i] = new Vector3(Mathf.Cos(angle) * radius, 0f, Mathf.Sin(angle) * radius);
            }

            // Faceted Side Triangles (Flat shaded)
            for (int i = 0; i < sides; i++)
            {
                int next = (i + 1) % sides;
                int idx = verts.Count;
                verts.Add(apex);
                verts.Add(baseCircle[i]);
                verts.Add(baseCircle[next]);

                tris.Add(idx);
                tris.Add(idx + 1);
                tris.Add(idx + 2);
            }

            // Bottom base cap
            for (int i = 0; i < sides; i++)
            {
                int next = (i + 1) % sides;
                int idx = verts.Count;
                verts.Add(bottomCenter);
                verts.Add(baseCircle[next]);
                verts.Add(baseCircle[i]);

                tris.Add(idx);
                tris.Add(idx + 1);
                tris.Add(idx + 2);
            }

            mesh.vertices = verts.ToArray();
            mesh.triangles = tris.ToArray();
            mesh.RecalculateNormals();
            mesh.RecalculateBounds();

            mf.sharedMesh = mesh;
            mc.sharedMesh = mesh;
            return go;
        }

        #region Modeled Collectible & Structure Mesh Generators
        /// <summary>
        /// Creates a faceted hexagonal bipyramid quartz crystal mesh.
        /// </summary>
        public static Mesh CreateCrystalMesh(float radius = 0.45f, float height = 1.3f)
        {
            Mesh mesh = new Mesh { name = "LowPolyCrystalMesh" };
            List<Vector3> verts = new List<Vector3>();
            List<int> tris = new List<int>();

            int sides = 6;
            Vector3 topApex = new Vector3(0f, height * 0.5f, 0f);
            Vector3 bottomApex = new Vector3(0f, -height * 0.5f, 0f);

            Vector3[] midUpper = new Vector3[sides];
            Vector3[] midLower = new Vector3[sides];

            for (int i = 0; i < sides; i++)
            {
                float angle = (float)i / sides * Mathf.PI * 2f;
                float r = radius * (1.0f + 0.15f * Mathf.Sin(angle * 3f)); // Organic facet asymmetry
                midUpper[i] = new Vector3(Mathf.Cos(angle) * r, height * 0.15f, Mathf.Sin(angle) * r);
                midLower[i] = new Vector3(Mathf.Cos(angle) * r, -height * 0.15f, Mathf.Sin(angle) * r);
            }

            // Top Cap Triangles (Flat Shaded)
            for (int i = 0; i < sides; i++)
            {
                int next = (i + 1) % sides;
                int idx = verts.Count;
                verts.Add(topApex);
                verts.Add(midUpper[i]);
                verts.Add(midUpper[next]);
                tris.Add(idx); tris.Add(idx + 1); tris.Add(idx + 2);
            }

            // Middle Prism Quads (2 triangles each)
            for (int i = 0; i < sides; i++)
            {
                int next = (i + 1) % sides;
                int idx = verts.Count;
                verts.Add(midUpper[i]);
                verts.Add(midLower[i]);
                verts.Add(midUpper[next]);
                tris.Add(idx); tris.Add(idx + 1); tris.Add(idx + 2);

                idx = verts.Count;
                verts.Add(midUpper[next]);
                verts.Add(midLower[i]);
                verts.Add(midLower[next]);
                tris.Add(idx); tris.Add(idx + 1); tris.Add(idx + 2);
            }

            // Bottom Cap Triangles
            for (int i = 0; i < sides; i++)
            {
                int next = (i + 1) % sides;
                int idx = verts.Count;
                verts.Add(bottomApex);
                verts.Add(midLower[next]);
                verts.Add(midLower[i]);
                tris.Add(idx); tris.Add(idx + 1); tris.Add(idx + 2);
            }

            mesh.vertices = verts.ToArray();
            mesh.triangles = tris.ToArray();
            mesh.RecalculateNormals();
            mesh.RecalculateBounds();
            return mesh;
        }

        /// <summary>
        /// Creates an angular sharp diamond shard mesh.
        /// </summary>
        public static Mesh CreateShardMesh(float width = 0.5f, float height = 1.2f, float depth = 0.35f)
        {
            Mesh mesh = new Mesh { name = "LowPolyShardMesh" };
            List<Vector3> verts = new List<Vector3>();
            List<int> tris = new List<int>();

            Vector3 top = new Vector3(0.05f, height * 0.5f, 0f);
            Vector3 btm = new Vector3(-0.05f, -height * 0.5f, 0f);
            Vector3 left = new Vector3(-width * 0.5f, 0.1f, 0f);
            Vector3 right = new Vector3(width * 0.5f, -0.1f, 0f);
            Vector3 front = new Vector3(0f, 0f, depth * 0.5f);
            Vector3 back = new Vector3(0f, 0f, -depth * 0.5f);

            void AddTri(Vector3 v1, Vector3 v2, Vector3 v3)
            {
                int idx = verts.Count;
                verts.Add(v1); verts.Add(v2); verts.Add(v3);
                tris.Add(idx); tris.Add(idx + 1); tris.Add(idx + 2);
            }

            // Front 4 facets
            AddTri(top, left, front);
            AddTri(top, front, right);
            AddTri(btm, front, left);
            AddTri(btm, right, front);

            // Back 4 facets
            AddTri(top, back, left);
            AddTri(top, right, back);
            AddTri(btm, left, back);
            AddTri(btm, back, right);

            mesh.vertices = verts.ToArray();
            mesh.triangles = tris.ToArray();
            mesh.RecalculateNormals();
            mesh.RecalculateBounds();
            return mesh;
        }

        /// <summary>
        /// Creates a bevelled low-poly cyber rune tablet mesh.
        /// </summary>
        public static Mesh CreateRuneTabletMesh(float w = 0.7f, float h = 1.0f, float d = 0.25f)
        {
            Mesh mesh = new Mesh { name = "LowPolyRuneTabletMesh" };
            List<Vector3> verts = new List<Vector3>();
            List<int> tris = new List<int>();

            float hw = w * 0.5f;
            float hh = h * 0.5f;
            float hd = d * 0.5f;
            float b = 0.08f; // Bevel offset

            // 8 Front Face vertices (Chamfered Octagonal Front)
            Vector3[] fVerts = new Vector3[]
            {
                new Vector3(-hw + b,  hh,      hd),
                new Vector3( hw - b,  hh,      hd),
                new Vector3( hw,      hh - b,  hd),
                new Vector3( hw,     -hh + b,  hd),
                new Vector3( hw - b, -hh,      hd),
                new Vector3(-hw + b, -hh,      hd),
                new Vector3(-hw,     -hh + b,  hd),
                new Vector3(-hw,      hh - b,  hd)
            };

            // 8 Back Face vertices
            Vector3[] bVerts = new Vector3[8];
            for (int i = 0; i < 8; i++)
            {
                bVerts[i] = new Vector3(fVerts[i].x * 0.9f, fVerts[i].y * 0.9f, -hd);
            }

            // Front Fan Triangles
            Vector3 fCenter = new Vector3(0f, 0f, hd);
            for (int i = 0; i < 8; i++)
            {
                int next = (i + 1) % 8;
                int idx = verts.Count;
                verts.Add(fCenter);
                verts.Add(fVerts[i]);
                verts.Add(fVerts[next]);
                tris.Add(idx); tris.Add(idx + 1); tris.Add(idx + 2);
            }

            // Side Bevel Quads
            for (int i = 0; i < 8; i++)
            {
                int next = (i + 1) % 8;
                int idx = verts.Count;
                verts.Add(fVerts[i]);
                verts.Add(bVerts[i]);
                verts.Add(fVerts[next]);
                tris.Add(idx); tris.Add(idx + 1); tris.Add(idx + 2);

                idx = verts.Count;
                verts.Add(fVerts[next]);
                verts.Add(bVerts[i]);
                verts.Add(bVerts[next]);
                tris.Add(idx); tris.Add(idx + 1); tris.Add(idx + 2);
            }

            // Back Fan Triangles
            Vector3 bCenter = new Vector3(0f, 0f, -hd);
            for (int i = 0; i < 8; i++)
            {
                int next = (i + 1) % 8;
                int idx = verts.Count;
                verts.Add(bCenter);
                verts.Add(bVerts[next]);
                verts.Add(bVerts[i]);
                tris.Add(idx); tris.Add(idx + 1); tris.Add(idx + 2);
            }

            mesh.vertices = verts.ToArray();
            mesh.triangles = tris.ToArray();
            mesh.RecalculateNormals();
            mesh.RecalculateBounds();
            return mesh;
        }

        /// <summary>
        /// Creates a faceted octagonal platform mesh for the Lab Station.
        /// </summary>
        public static Mesh CreateOctagonalPlatformMesh(float radius = 5.0f, float height = 0.45f)
        {
            Mesh mesh = new Mesh { name = "OctagonalLabPlatformMesh" };
            List<Vector3> verts = new List<Vector3>();
            List<int> tris = new List<int>();

            int sides = 8;
            Vector3 topCenter = new Vector3(0f, height * 0.5f, 0f);
            Vector3 btmCenter = new Vector3(0f, -height * 0.5f, 0f);

            Vector3[] topRing = new Vector3[sides];
            Vector3[] btmRing = new Vector3[sides];

            for (int i = 0; i < sides; i++)
            {
                float angle = (float)i / sides * Mathf.PI * 2f + (Mathf.PI / 8f);
                topRing[i] = new Vector3(Mathf.Cos(angle) * radius, height * 0.5f, Mathf.Sin(angle) * radius);
                btmRing[i] = new Vector3(Mathf.Cos(angle) * (radius * 1.12f), -height * 0.5f, Mathf.Sin(angle) * (radius * 1.12f));
            }

            // Top Cap Fan
            for (int i = 0; i < sides; i++)
            {
                int next = (i + 1) % sides;
                int idx = verts.Count;
                verts.Add(topCenter);
                verts.Add(topRing[i]);
                verts.Add(topRing[next]);
                tris.Add(idx); tris.Add(idx + 1); tris.Add(idx + 2);
            }

            // Chamfered Sides
            for (int i = 0; i < sides; i++)
            {
                int next = (i + 1) % sides;
                int idx = verts.Count;
                verts.Add(topRing[i]);
                verts.Add(btmRing[i]);
                verts.Add(topRing[next]);
                tris.Add(idx); tris.Add(idx + 1); tris.Add(idx + 2);

                idx = verts.Count;
                verts.Add(topRing[next]);
                verts.Add(btmRing[i]);
                verts.Add(btmRing[next]);
                tris.Add(idx); tris.Add(idx + 1); tris.Add(idx + 2);
            }

            mesh.vertices = verts.ToArray();
            mesh.triangles = tris.ToArray();
            mesh.RecalculateNormals();
            mesh.RecalculateBounds();
            return mesh;
        }
        #endregion

using System;
using System.Collections.Generic;
using UnityEngine;

namespace NeuroArena.Environment
{
    /// <summary>
    /// Generates hand-crafted and template-based landmarks (Ancient Ruins, Monolith Clusters, Research Outposts)
    /// for each of the 6 biomes in NeuroArena.
    /// Provides spatial exclusion footprints to prevent procedural scatter overlap.
    /// </summary>
    public static class BiomeLandmarkGenerator
    {
        public struct LandmarkPlacement
        {
            public string name;
            public Vector2 localPos2D;
            public float exclusionRadius;
            public Action<Transform, Vector3, int, StylizedBiomeTerrain> buildAction;

            public LandmarkPlacement(string name, Vector2 localPos2D, float exclusionRadius, Action<Transform, Vector3, int, StylizedBiomeTerrain> buildAction)
            {
                this.name = name;
                this.localPos2D = localPos2D;
                this.exclusionRadius = exclusionRadius;
                this.buildAction = buildAction;
            }
        }

        /// <summary>
        /// Retrieves the landmark templates for the given biome.
        /// </summary>
        public static List<LandmarkPlacement> GetLandmarkPlacements(int biomeIndex)
        {
            List<LandmarkPlacement> landmarks = new List<LandmarkPlacement>();

            switch (biomeIndex)
            {
                case 0: // Biome 1: The Linear Steppes
                    landmarks.Add(new LandmarkPlacement("Linear_AncientRuinArch", new Vector2(-22f, 18f), 6.5f, BuildAncientRuinArch));
                    landmarks.Add(new LandmarkPlacement("Linear_MonolithTriad", new Vector2(24f, -18f), 6.0f, BuildMonolithCluster));
                    landmarks.Add(new LandmarkPlacement("Linear_TelemetryOutpost", new Vector2(-16f, -24f), 7.0f, BuildResearchOutpost));
                    break;

                case 1: // Biome 2: The Binary Marshlands
                    landmarks.Add(new LandmarkPlacement("Marsh_SubmergedAltar", new Vector2(-20f, 22f), 6.5f, BuildAncientRuinArch));
                    landmarks.Add(new LandmarkPlacement("Marsh_BioluminescentPillars", new Vector2(22f, 18f), 6.0f, BuildMonolithCluster));
                    landmarks.Add(new LandmarkPlacement("Marsh_HydroOutpost", new Vector2(-18f, -20f), 7.0f, BuildResearchOutpost));
                    break;

                case 2: // Biome 3: The Variance Tundra
                    landmarks.Add(new LandmarkPlacement("Tundra_GlacialShrine", new Vector2(20f, 22f), 6.5f, BuildAncientRuinArch));
                    landmarks.Add(new LandmarkPlacement("Tundra_FrostSpireRing", new Vector2(-22f, -18f), 6.0f, BuildMonolithCluster));
                    landmarks.Add(new LandmarkPlacement("Tundra_CryoObservatory", new Vector2(18f, -22f), 7.0f, BuildResearchOutpost));
                    break;

                case 3: // Biome 4: The Branching Canopy
                    landmarks.Add(new LandmarkPlacement("Canopy_ElderTreeShrine", new Vector2(-24f, 16f), 6.5f, BuildAncientRuinArch));
                    landmarks.Add(new LandmarkPlacement("Canopy_DecisionMonoliths", new Vector2(20f, -20f), 6.0f, BuildMonolithCluster));
                    landmarks.Add(new LandmarkPlacement("Canopy_BotanicalOutpost", new Vector2(-18f, -22f), 7.0f, BuildResearchOutpost));
                    break;

                case 4: // Biome 5: The Deep Synapse Citadel
                    landmarks.Add(new LandmarkPlacement("Citadel_BasaltGateway", new Vector2(-22f, -20f), 7.0f, BuildAncientRuinArch));
                    landmarks.Add(new LandmarkPlacement("Citadel_MatrixObeliskCluster", new Vector2(22f, 20f), 6.5f, BuildMonolithCluster));
                    landmarks.Add(new LandmarkPlacement("Citadel_NeuralCoreOutpost", new Vector2(-20f, 22f), 7.5f, BuildResearchOutpost));
                    break;

                case 5: // Biome 6: The Semantic Expanse
                    landmarks.Add(new LandmarkPlacement("Semantic_AstralDaisRuin", new Vector2(0f, 25f), 7.0f, BuildAncientRuinArch));
                    landmarks.Add(new LandmarkPlacement("Semantic_VectorPillars", new Vector2(-20f, -15f), 6.0f, BuildMonolithCluster));
                    landmarks.Add(new LandmarkPlacement("Semantic_CosmicObservatory", new Vector2(20f, -15f), 7.5f, BuildResearchOutpost));
                    break;

                default:
                    landmarks.Add(new LandmarkPlacement("Default_Ruin", new Vector2(-20f, 20f), 6.0f, BuildAncientRuinArch));
                    landmarks.Add(new LandmarkPlacement("Default_Monoliths", new Vector2(20f, -20f), 6.0f, BuildMonolithCluster));
                    break;
            }

            return landmarks;
        }

        /// <summary>
        /// Spawns all landmark structures for the active biome and returns their exclusion footprints.
        /// </summary>
        public static List<PoissonDiscSampler.ExclusionZone> SpawnBiomeLandmarks(
            int biomeIndex,
            Transform parent,
            StylizedBiomeTerrain terrain)
        {
            List<PoissonDiscSampler.ExclusionZone> exclusions = new List<PoissonDiscSampler.ExclusionZone>();
            List<LandmarkPlacement> placements = GetLandmarkPlacements(biomeIndex);

            for (int i = 0; i < placements.Count; i++)
            {
                LandmarkPlacement lp = placements[i];
                float height = terrain != null ? terrain.GetHeightAt(lp.localPos2D.x, lp.localPos2D.y) : 0f;
                Vector3 worldPos = new Vector3(lp.localPos2D.x, height, lp.localPos2D.y);

                lp.buildAction?.Invoke(parent, worldPos, biomeIndex, terrain);
                exclusions.Add(new PoissonDiscSampler.ExclusionZone(lp.localPos2D, lp.exclusionRadius));
            }

            return exclusions;
        }

        #region Landmark Builders (Ruins, Monoliths, Research Outposts)

        /// <summary>
        /// 1. Ancient Ruin Template: Broken columns, weathered stone arch, and central ancient rune dais.
        /// </summary>
        private static void BuildAncientRuinArch(Transform parent, Vector3 position, int biomeIndex, StylizedBiomeTerrain terrain)
        {
            BiomeScatterConfig cfg = BiomeScatterConfig.GetPreset(biomeIndex);
            GameObject root = new GameObject($"Landmark_AncientRuin_Biome_{biomeIndex + 1}");
            root.transform.SetParent(parent, false);
            root.transform.position = position;

            // Octagonal stone foundation
            GameObject dais = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            dais.name = "RuinFoundation";
            dais.transform.SetParent(root.transform, false);
            dais.transform.localPosition = new Vector3(0f, 0.15f, 0f);
            dais.transform.localScale = new Vector3(8.5f, 0.3f, 8.5f);
            ApplyMaterial(dais, cfg.rockColor, metallic: 0.1f, smoothness: 0.3f);

            // Left Standing Pillar
            GameObject pillarL = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            pillarL.name = "StandingPillar_Left";
            pillarL.transform.SetParent(root.transform, false);
            pillarL.transform.localPosition = new Vector3(-2.8f, 2.5f, 0f);
            pillarL.transform.localScale = new Vector3(0.9f, 2.5f, 0.9f);
            ApplyMaterial(pillarL, cfg.rockColor * 1.05f, metallic: 0.15f, smoothness: 0.4f);

            // Right Standing Pillar
            GameObject pillarR = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            pillarR.name = "StandingPillar_Right";
            pillarR.transform.SetParent(root.transform, false);
            pillarR.transform.localPosition = new Vector3(2.8f, 2.5f, 0f);
            pillarR.transform.localScale = new Vector3(0.9f, 2.5f, 0.9f);
            ApplyMaterial(pillarR, cfg.rockColor * 1.05f, metallic: 0.15f, smoothness: 0.4f);

            // Broken Arch Top Beam
            GameObject archBeam = GameObject.CreatePrimitive(PrimitiveType.Cube);
            archBeam.name = "ArchArchitrave";
            archBeam.transform.SetParent(root.transform, false);
            archBeam.transform.localPosition = new Vector3(0f, 5.2f, 0f);
            archBeam.transform.localScale = new Vector3(7.2f, 0.7f, 1.3f);
            archBeam.transform.localRotation = Quaternion.Euler(0f, 0f, 3f); // Weathered tilt
            ApplyMaterial(archBeam, cfg.rockColor * 0.95f, metallic: 0.1f, smoothness: 0.35f);

            // Fallen Broken Column Segment
            GameObject fallenCol = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            fallenCol.name = "FallenColumnPiece";
            fallenCol.transform.SetParent(root.transform, false);
            fallenCol.transform.localPosition = new Vector3(1.5f, 0.45f, 1.8f);
            fallenCol.transform.localRotation = Quaternion.Euler(85f, 30f, 0f);
            fallenCol.transform.localScale = new Vector3(0.85f, 1.6f, 0.85f);
            ApplyMaterial(fallenCol, cfg.rockColor * 0.9f, metallic: 0.1f, smoothness: 0.25f);

            // Central Glowing Rune Altar
            GameObject altar = GameObject.CreatePrimitive(PrimitiveType.Cube);
            altar.name = "AncientRuneAltar";
            altar.transform.SetParent(root.transform, false);
            altar.transform.localPosition = new Vector3(0f, 0.75f, 0f);
            altar.transform.localScale = new Vector3(1.4f, 1.1f, 1.4f);
            ApplyMaterial(altar, cfg.accentColor, metallic: 0.4f, smoothness: 0.85f, emission: cfg.accentColor, emissionIntensity: 1.8f);
        }

        /// <summary>
        /// 2. Monolith Cluster Template: 3-5 towering standing obelisks surrounding a floating resonant power shard.
        /// </summary>
        private static void BuildMonolithCluster(Transform parent, Vector3 position, int biomeIndex, StylizedBiomeTerrain terrain)
        {
            BiomeScatterConfig cfg = BiomeScatterConfig.GetPreset(biomeIndex);
            GameObject root = new GameObject($"Landmark_MonolithCluster_Biome_{biomeIndex + 1}");
            root.transform.SetParent(parent, false);
            root.transform.position = position;

            int pillarCount = 4;
            float radius = 3.5f;

            for (int i = 0; i < pillarCount; i++)
            {
                float angle = (float)i / pillarCount * Mathf.PI * 2f;
                Vector3 localPillarPos = new Vector3(Mathf.Cos(angle) * radius, 0f, Mathf.Sin(angle) * radius);

                GameObject pillar = GameObject.CreatePrimitive(PrimitiveType.Cube);
                pillar.name = $"MonolithObelisk_{i + 1}";
                pillar.transform.SetParent(root.transform, false);
                pillar.transform.localPosition = localPillarPos + new Vector3(0f, 2.8f + (i % 2) * 0.8f, 0f);

                // Slight inward mystical tilt
                Vector3 inwardDir = -localPillarPos.normalized;
                Quaternion tiltRot = Quaternion.LookRotation(inwardDir, Vector3.up) * Quaternion.Euler(10f, (i * 45f), 0f);
                pillar.transform.localRotation = tiltRot;
                pillar.transform.localScale = new Vector3(1.1f, 5.6f + (i % 2) * 1.5f, 1.1f);

                ApplyMaterial(pillar, cfg.rockColor * 0.8f, metallic: 0.35f, smoothness: 0.65f);

                // Monolith Glowing Inset Rune Stripe
                GameObject runeStripe = GameObject.CreatePrimitive(PrimitiveType.Cube);
                runeStripe.name = "RuneConduit";
                runeStripe.transform.SetParent(pillar.transform, false);
                runeStripe.transform.localPosition = new Vector3(0f, 0f, 0.48f);
                runeStripe.transform.localScale = new Vector3(0.2f, 0.85f, 0.1f);
                ApplyMaterial(runeStripe, cfg.accentColor, metallic: 0.1f, smoothness: 0.95f, emission: cfg.accentColor, emissionIntensity: 2.2f);
            }

            // Central Floating Resonant Core
            GameObject core = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            core.name = "ResonantCore";
            core.transform.SetParent(root.transform, false);
            core.transform.localPosition = new Vector3(0f, 2.6f, 0f);
            core.transform.localScale = new Vector3(1.2f, 1.2f, 1.2f);
            ApplyMaterial(core, cfg.accentColor, metallic: 0.6f, smoothness: 0.95f, emission: cfg.accentColor, emissionIntensity: 2.5f);

            // Ground Rune Ring
            GameObject ring = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            ring.name = "ResonantRuneRing";
            ring.transform.SetParent(root.transform, false);
            ring.transform.localPosition = new Vector3(0f, 0.05f, 0f);
            ring.transform.localScale = new Vector3(7.5f, 0.1f, 7.5f);
            ApplyMaterial(ring, cfg.rockColor * 0.6f, metallic: 0.2f, smoothness: 0.5f);
        }

        /// <summary>
        /// 3. Research Outpost Template: Geodesic dome laboratory pod, telemetry antenna dish, and power solar panels.
        /// </summary>
        private static void BuildResearchOutpost(Transform parent, Vector3 position, int biomeIndex, StylizedBiomeTerrain terrain)
        {
            BiomeScatterConfig cfg = BiomeScatterConfig.GetPreset(biomeIndex);
            GameObject root = new GameObject($"Landmark_ResearchOutpost_Biome_{biomeIndex + 1}");
            root.transform.SetParent(parent, false);
            root.transform.position = position;

            Color labMetal = new Color(0.22f, 0.26f, 0.35f);
            Color labWhite = new Color(0.88f, 0.92f, 0.96f);
            Color beaconCyan = new Color(0.15f, 0.85f, 0.95f);

            // Raised Octagonal Platform Base
            GameObject baseDeck = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            baseDeck.name = "OutpostDeck";
            baseDeck.transform.SetParent(root.transform, false);
            baseDeck.transform.localPosition = new Vector3(0f, 0.3f, 0f);
            baseDeck.transform.localScale = new Vector3(9.0f, 0.5f, 9.0f);
            ApplyMaterial(baseDeck, labMetal, metallic: 0.75f, smoothness: 0.85f);

            // Main Geodesic Dome / Habitat Pod
            GameObject dome = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            dome.name = "ObservationDome";
            dome.transform.SetParent(root.transform, false);
            dome.transform.localPosition = new Vector3(-1.2f, 1.8f, 0.5f);
            dome.transform.localScale = new Vector3(4.5f, 3.2f, 4.5f);
            ApplyMaterial(dome, labWhite, metallic: 0.3f, smoothness: 0.88f);

            // Dome Observation Port / Window
            GameObject window = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            window.name = "ObservationPort";
            window.transform.SetParent(dome.transform, false);
            window.transform.localPosition = new Vector3(0.35f, 0.1f, 0.35f);
            window.transform.localRotation = Quaternion.Euler(45f, 45f, 0f);
            window.transform.localScale = new Vector3(0.45f, 0.1f, 0.45f);
            ApplyMaterial(window, beaconCyan, metallic: 0.1f, smoothness: 0.98f, emission: beaconCyan, emissionIntensity: 1.5f);

            // Comms / Telemetry Spire Mast
            GameObject mast = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            mast.name = "TelemetryMast";
            mast.transform.SetParent(root.transform, false);
            mast.transform.localPosition = new Vector3(2.6f, 3.2f, -1.8f);
            mast.transform.localScale = new Vector3(0.22f, 3.2f, 0.22f);
            ApplyMaterial(mast, labMetal, metallic: 0.85f, smoothness: 0.9f);

            // Parabolic Dish on Mast
            GameObject dish = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            dish.name = "TelemetryDish";
            dish.transform.SetParent(mast.transform, false);
            dish.transform.localPosition = new Vector3(0f, 0.95f, 0f);
            dish.transform.localRotation = Quaternion.Euler(35f, 45f, 0f);
            dish.transform.localScale = new Vector3(5.5f, 0.8f, 5.5f);
            ApplyMaterial(dish, labWhite, metallic: 0.4f, smoothness: 0.9f);

            // Beacon Light
            GameObject beacon = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            beacon.name = "OutpostBeacon";
            beacon.transform.SetParent(dish.transform, false);
            beacon.transform.localPosition = new Vector3(0f, 0.6f, 0f);
            beacon.transform.localScale = new Vector3(0.3f, 0.3f, 0.3f);
            ApplyMaterial(beacon, beaconCyan, metallic: 0.1f, smoothness: 0.95f, emission: beaconCyan, emissionIntensity: 2.5f);

            // Solar Array Wing
            GameObject solarPanel = GameObject.CreatePrimitive(PrimitiveType.Cube);
            solarPanel.name = "SolarHarvesterPanel";
            solarPanel.transform.SetParent(root.transform, false);
            solarPanel.transform.localPosition = new Vector3(2.5f, 1.2f, 2.2f);
            solarPanel.transform.localRotation = Quaternion.Euler(25f, 30f, 0f);
            solarPanel.transform.localScale = new Vector3(2.2f, 0.1f, 1.4f);
            ApplyMaterial(solarPanel, new Color(0.08f, 0.15f, 0.32f), metallic: 0.9f, smoothness: 0.95f, emission: new Color(0.1f, 0.3f, 0.6f), emissionIntensity: 0.8f);
        }

        private static void ApplyMaterial(GameObject go, Color color, float metallic = 0.1f, float smoothness = 0.6f, Color? emission = null, float emissionIntensity = 1.5f)
        {
            Renderer rend = go.GetComponent<Renderer>();
            if (rend != null)
            {
                rend.sharedMaterial = StylizedMaterialFactory.GetStylizedPropMaterial(
                    go.name, color, metallic, smoothness, emission, emissionIntensity);
            }
        }
        #endregion
    }
}

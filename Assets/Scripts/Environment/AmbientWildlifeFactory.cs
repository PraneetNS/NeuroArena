using UnityEngine;

namespace NeuroArena.Environment
{
    public enum WildlifeArchetype
    {
        DuneStriderFinch,    // Biome 1: The Linear Steppes (Avian)
        LuminescentSporeToad, // Biome 2: The Binary Marshlands (Amphibian)
        FrostScarabBeetle,   // Biome 3: The Variance Tundra (Crystalline / Insectoid)
        CanopyGlider,        // Biome 4: The Branching Canopy (Arboreal)
        CyberPulseManta,     // Biome 5: The Deep Synapse Citadel (Cybernetic)
        AstralVectorWisp     // Biome 6: The Semantic Expanse (Levitating Astral)
    }

    /// <summary>
    /// Builds ultra-lightweight, low-poly (15-35 tris) stylized ambient creatures
    /// configured for procedural micro-animations (wing flapping, hopping, leg skittering, wisp orbits).
    /// </summary>
    public static class AmbientWildlifeFactory
    {
        public static WildlifeArchetype GetArchetypeForBiome(int biomeIndex)
        {
            switch (biomeIndex)
            {
                case 0: return WildlifeArchetype.DuneStriderFinch;
                case 1: return WildlifeArchetype.LuminescentSporeToad;
                case 2: return WildlifeArchetype.FrostScarabBeetle;
                case 3: return WildlifeArchetype.CanopyGlider;
                case 4: return WildlifeArchetype.CyberPulseManta;
                case 5: return WildlifeArchetype.AstralVectorWisp;
                default: return WildlifeArchetype.DuneStriderFinch;
            }
        }

        public static GameObject CreateWildlife(WildlifeArchetype archetype, int seed, Transform parent = null)
        {
            GameObject creature = new GameObject($"AmbientCreature_{archetype}_{seed}");
            if (parent != null) creature.transform.SetParent(parent, false);

            SphereCollider col = creature.AddComponent<SphereCollider>();
            col.radius = 0.45f;
            col.center = new Vector3(0f, 0.4f, 0f);

            switch (archetype)
            {
                case WildlifeArchetype.DuneStriderFinch:
                    BuildDuneStriderFinch(creature, seed);
                    break;
                case WildlifeArchetype.LuminescentSporeToad:
                    BuildLuminescentSporeToad(creature, seed);
                    break;
                case WildlifeArchetype.FrostScarabBeetle:
                    BuildFrostScarabBeetle(creature, seed);
                    break;
                case WildlifeArchetype.CanopyGlider:
                    BuildCanopyGlider(creature, seed);
                    break;
                case WildlifeArchetype.CyberPulseManta:
                    BuildCyberPulseManta(creature, seed);
                    break;
                case WildlifeArchetype.AstralVectorWisp:
                    BuildAstralVectorWisp(creature, seed);
                    break;
            }

            return creature;
        }

        #region Archetype Procedural Builders

        /// <summary>
        /// Biome 1: Low-poly Avian Finch (Body, Beak, Flapping Wings, Slender Legs)
        /// </summary>
        private static void BuildDuneStriderFinch(GameObject root, int seed)
        {
            Color bodyColor = new Color(0.85f, 0.58f, 0.15f); // Amber plumage
            Color accentColor = new Color(0.98f, 0.78f, 0.22f); // Gold feathers
            Color beakColor = new Color(0.25f, 0.18f, 0.12f);

            // Body
            GameObject body = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            body.name = "FinchBody";
            body.transform.SetParent(root.transform, false);
            body.transform.localPosition = new Vector3(0f, 0.45f, 0f);
            body.transform.localScale = new Vector3(0.45f, 0.38f, 0.65f);
            ApplyMaterial(body, bodyColor);

            // Beak
            GameObject beak = GameObject.CreatePrimitive(PrimitiveType.Cube);
            beak.name = "FinchBeak";
            beak.transform.SetParent(body.transform, false);
            beak.transform.localPosition = new Vector3(0f, 0.1f, 0.65f);
            beak.transform.localScale = new Vector3(0.2f, 0.15f, 0.4f);
            ApplyMaterial(beak, beakColor);

            // Left Wing
            GameObject wingL = GameObject.CreatePrimitive(PrimitiveType.Cube);
            wingL.name = "Wing_L";
            wingL.transform.SetParent(body.transform, false);
            wingL.transform.localPosition = new Vector3(-0.35f, 0.1f, 0f);
            wingL.transform.localScale = new Vector3(0.45f, 0.08f, 0.5f);
            ApplyMaterial(wingL, accentColor);

            // Right Wing
            GameObject wingR = GameObject.CreatePrimitive(PrimitiveType.Cube);
            wingR.name = "Wing_R";
            wingR.transform.SetParent(body.transform, false);
            wingR.transform.localPosition = new Vector3(0.35f, 0.1f, 0f);
            wingR.transform.localScale = new Vector3(0.45f, 0.08f, 0.5f);
            ApplyMaterial(wingR, accentColor);
        }

        /// <summary>
        /// Biome 2: Low-poly Amphibian Spore-Toad (Squat Body, Glowing Eyes, Hind Hoppers)
        /// </summary>
        private static void BuildLuminescentSporeToad(GameObject root, int seed)
        {
            Color skinColor = new Color(0.12f, 0.52f, 0.45f); // Deep Teal
            Color glowColor = new Color(0.65f, 0.25f, 0.95f); // Violet Bioluminescence

            // Squat Body
            GameObject body = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            body.name = "ToadBody";
            body.transform.SetParent(root.transform, false);
            body.transform.localPosition = new Vector3(0f, 0.3f, 0f);
            body.transform.localScale = new Vector3(0.6f, 0.4f, 0.55f);
            ApplyMaterial(body, skinColor);

            // Glowing Dorsal Spore Node
            GameObject dorsalNode = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            dorsalNode.name = "DorsalSporeNode";
            dorsalNode.transform.SetParent(body.transform, false);
            dorsalNode.transform.localPosition = new Vector3(0f, 0.35f, -0.1f);
            dorsalNode.transform.localScale = new Vector3(0.4f, 0.35f, 0.4f);
            ApplyMaterial(dorsalNode, glowColor, metallic: 0.1f, smoothness: 0.95f, emission: glowColor, emissionIntensity: 2.0f);

            // Left Eye
            GameObject eyeL = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            eyeL.name = "Eye_L";
            eyeL.transform.SetParent(body.transform, false);
            eyeL.transform.localPosition = new Vector3(-0.25f, 0.28f, 0.3f);
            eyeL.transform.localScale = new Vector3(0.2f, 0.2f, 0.2f);
            ApplyMaterial(eyeL, glowColor, emission: glowColor, emissionIntensity: 1.8f);

            // Right Eye
            GameObject eyeR = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            eyeR.name = "Eye_R";
            eyeR.transform.SetParent(body.transform, false);
            eyeR.transform.localPosition = new Vector3(0.25f, 0.28f, 0.3f);
            eyeR.transform.localScale = new Vector3(0.2f, 0.2f, 0.2f);
            ApplyMaterial(eyeR, glowColor, emission: glowColor, emissionIntensity: 1.8f);
        }

        /// <summary>
        /// Biome 3: Low-poly Crystalline Insectoid Scarab (Faceted Chitin, Crystal Antennae)
        /// </summary>
        private static void BuildFrostScarabBeetle(GameObject root, int seed)
        {
            Color shellColor = new Color(0.25f, 0.45f, 0.65f); // Ice Slate
            Color crystalGlow = new Color(0.65f, 0.90f, 1.0f);  // Glacial Ice Shimmer

            // Faceted Carapace
            GameObject carapace = GameObject.CreatePrimitive(PrimitiveType.Cube);
            carapace.name = "ScarabCarapace";
            carapace.transform.SetParent(root.transform, false);
            carapace.transform.localPosition = new Vector3(0f, 0.25f, 0f);
            carapace.transform.localRotation = Quaternion.Euler(15f, 0f, 0f);
            carapace.transform.localScale = new Vector3(0.55f, 0.3f, 0.7f);
            ApplyMaterial(carapace, shellColor, metallic: 0.5f, smoothness: 0.85f);

            // Crystal Horn / Antenna
            GameObject horn = GameObject.CreatePrimitive(PrimitiveType.Cube);
            horn.name = "FrostHorn";
            horn.transform.SetParent(carapace.transform, false);
            horn.transform.localPosition = new Vector3(0f, 0.25f, 0.45f);
            horn.transform.localRotation = Quaternion.Euler(-30f, 0f, 0f);
            horn.transform.localScale = new Vector3(0.12f, 0.45f, 0.12f);
            ApplyMaterial(horn, crystalGlow, metallic: 0.3f, smoothness: 0.95f, emission: crystalGlow, emissionIntensity: 1.8f);
        }

        /// <summary>
        /// Biome 4: Low-poly Arboreal Canopy Glider (Slender Body, Patagium Flaps, Bushy Tail)
        /// </summary>
        private static void BuildCanopyGlider(GameObject root, int seed)
        {
            Color furColor = new Color(0.48f, 0.30f, 0.15f); // Rich Chestnut
            Color gliderColor = new Color(0.15f, 0.68f, 0.38f); // Emerald Patagium

            // Body
            GameObject body = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            body.name = "GliderBody";
            body.transform.SetParent(root.transform, false);
            body.transform.localPosition = new Vector3(0f, 0.35f, 0f);
            body.transform.localScale = new Vector3(0.35f, 0.3f, 0.65f);
            ApplyMaterial(body, furColor);

            // Gliding Patagium Wing Flaps
            GameObject wings = GameObject.CreatePrimitive(PrimitiveType.Cube);
            wings.name = "GliderPatagium";
            wings.transform.SetParent(body.transform, false);
            wings.transform.localPosition = new Vector3(0f, 0.05f, 0f);
            wings.transform.localScale = new Vector3(1.2f, 0.05f, 0.5f);
            ApplyMaterial(wings, gliderColor);

            // Tail
            GameObject tail = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            tail.name = "GliderTail";
            tail.transform.SetParent(body.transform, false);
            tail.transform.localPosition = new Vector3(0f, 0.1f, -0.55f);
            tail.transform.localRotation = Quaternion.Euler(35f, 0f, 0f);
            tail.transform.localScale = new Vector3(0.18f, 0.45f, 0.18f);
            ApplyMaterial(tail, furColor * 0.9f);
        }

        /// <summary>
        /// Biome 5: Low-poly Cyber Pulse-Manta (Floating Geometric Diamond, Pulsing Neon Ribbons)
        /// </summary>
        private static void BuildCyberPulseManta(GameObject root, int seed)
        {
            Color chassisColor = new Color(0.10f, 0.08f, 0.16f); // Obsidian Basalt
            Color neonCyan = new Color(0.12f, 0.85f, 0.95f);     // Cyber Cyan Conduit

            // Diamond Wing Chassis
            GameObject wing = GameObject.CreatePrimitive(PrimitiveType.Cube);
            wing.name = "MantaChassis";
            wing.transform.SetParent(root.transform, false);
            wing.transform.localPosition = new Vector3(0f, 0.65f, 0f);
            wing.transform.localRotation = Quaternion.Euler(0f, 45f, 0f);
            wing.transform.localScale = new Vector3(0.75f, 0.08f, 0.75f);
            ApplyMaterial(wing, chassisColor, metallic: 0.85f, smoothness: 0.9f);

            // Central Pulsing Power Core
            GameObject core = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            core.name = "MantaPulseCore";
            core.transform.SetParent(wing.transform, false);
            core.transform.localPosition = new Vector3(0f, 0.1f, 0f);
            core.transform.localScale = new Vector3(0.35f, 0.45f, 0.35f);
            ApplyMaterial(core, neonCyan, metallic: 0.2f, smoothness: 0.95f, emission: neonCyan, emissionIntensity: 2.2f);
        }

        /// <summary>
        /// Biome 6: Low-poly Astral Vector-Wisp (Levitating Core Sphere, Orbiting Vector Shards)
        /// </summary>
        private static void BuildAstralVectorWisp(GameObject root, int seed)
        {
            Color coreColor = new Color(0.92f, 0.95f, 1.0f);    // Starlight White
            Color auraColor = new Color(0.45f, 0.55f, 0.98f);   // Prismatic Indigo

            // Floating Central Orb
            GameObject core = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            core.name = "WispCore";
            core.transform.SetParent(root.transform, false);
            core.transform.localPosition = new Vector3(0f, 0.75f, 0f);
            core.transform.localScale = new Vector3(0.45f, 0.45f, 0.45f);
            ApplyMaterial(core, coreColor, metallic: 0.3f, smoothness: 0.98f, emission: coreColor, emissionIntensity: 2.5f);

            // 3 Orbiting Vector Shards
            int shardCount = 3;
            for (int i = 0; i < shardCount; i++)
            {
                float angle = (float)i / shardCount * Mathf.PI * 2f;
                GameObject shard = GameObject.CreatePrimitive(PrimitiveType.Cube);
                shard.name = $"OrbitShard_{i + 1}";
                shard.transform.SetParent(core.transform, false);
                shard.transform.localPosition = new Vector3(Mathf.Cos(angle) * 0.7f, 0f, Mathf.Sin(angle) * 0.7f);
                shard.transform.localRotation = Quaternion.Euler(45f, 45f, (i * 30f));
                shard.transform.localScale = new Vector3(0.25f, 0.45f, 0.15f);
                ApplyMaterial(shard, auraColor, metallic: 0.2f, smoothness: 0.95f, emission: auraColor, emissionIntensity: 1.8f);
            }
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

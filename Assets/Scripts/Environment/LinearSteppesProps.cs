using UnityEngine;
using NeuroArena.Data;

namespace NeuroArena.Environment
{
    /// <summary>
    /// Spawns landmark props (Monoliths, Geysers, Lab Station Platform)
    /// and scatters real numeric ML collectibles across The Linear Steppes biome.
    /// </summary>
    public class LinearSteppesProps : MonoBehaviour
    {
        [Header("Landmark Spawning")]
        [SerializeField] private bool spawnLandmarks = true;

        [Header("Collectible Dataset Generation")]
        [SerializeField] private int collectibleCount = 28;
        [SerializeField] private float trueSlope_W = 2.45f;
        [SerializeField] private float trueBias_B = 1.15f;
        [SerializeField] private float noiseSigma = 0.38f;

        private void Start()
        {
            if (spawnLandmarks)
            {
                SpawnBiomeLandmarks();
            }

            SpawnLinearDatasetCollectibles();
        }

        private void SpawnBiomeLandmarks()
        {
            Transform propsRoot = new GameObject("LinearSteppes_Landmarks").transform;
            propsRoot.SetParent(transform);

            // 1. Lab Station Platform (Center-East)
            CreateLabStationPlatform(propsRoot, new Vector3(14f, 0.2f, 14f));

            // 2. Ancient Monolith Obelisks
            CreateMonolith(propsRoot, new Vector3(-18f, 0f, 12f), "Monolith_Alpha", new Color(0.2f, 0.8f, 1f));
            CreateMonolith(propsRoot, new Vector3(20f, 0f, -16f), "Monolith_Beta", new Color(0.3f, 1f, 0.5f));
            CreateMonolith(propsRoot, new Vector3(-12f, 0f, -20f), "Monolith_Gamma", new Color(1f, 0.6f, 0.2f));

            // 3. Energy Geysers
            CreateEnergyGeyser(propsRoot, new Vector3(-6f, 0f, -14f), new Color(1f, 0.4f, 0.1f));
            CreateEnergyGeyser(propsRoot, new Vector3(16f, 0f, -6f), new Color(0.2f, 0.9f, 0.9f));
        }

        private void CreateLabStationPlatform(Transform parent, Vector3 position)
        {
            GameObject platform = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            platform.name = "LabStation_Platform";
            platform.tag = "LabStation";
            platform.transform.SetParent(parent);
            platform.transform.position = position;
            platform.transform.localScale = new Vector3(8f, 0.35f, 8f);

            // Add LabStation trigger manager
            LabStation labStation = platform.AddComponent<LabStation>();

            Renderer rend = platform.GetComponent<Renderer>();
            if (rend != null)
            {
                Material mat = new Material(Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard"));
                mat.color = new Color(0.12f, 0.16f, 0.24f);
                rend.material = mat;
            }

            // Central Terminal Pillar
            GameObject terminal = GameObject.CreatePrimitive(PrimitiveType.Cube);
            terminal.name = "FormulaTerminal_Pillar";
            terminal.transform.SetParent(platform.transform);
            terminal.transform.localPosition = new Vector3(0f, 2.5f, 0f);
            terminal.transform.localScale = new Vector3(0.25f, 5f, 0.25f);

            Renderer termRend = terminal.GetComponent<Renderer>();
            if (termRend != null)
            {
                Material termMat = new Material(Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard"));
                termMat.color = new Color(0.1f, 0.85f, 0.95f);
                termRend.material = termMat;
            }

            // Hologram Ring
            GameObject ring = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            ring.name = "Lab_HoloRing";
            ring.transform.SetParent(platform.transform);
            ring.transform.localPosition = new Vector3(0f, 5.2f, 0f);
            ring.transform.localScale = new Vector3(0.6f, 0.05f, 0.6f);
            Destroy(ring.GetComponent<Collider>());

            Renderer ringRend = ring.GetComponent<Renderer>();
            if (ringRend != null)
            {
                Material ringMat = new Material(Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard"));
                ringMat.color = new Color(0.2f, 1f, 0.7f, 0.6f);
                ringRend.material = ringMat;
            }
        }

        private void CreateMonolith(Transform parent, Vector3 position, string name, Color glow)
        {
            GameObject monolith = GameObject.CreatePrimitive(PrimitiveType.Cube);
            monolith.name = name;
            monolith.transform.SetParent(parent);
            monolith.transform.position = position + Vector3.up * 4.5f;
            monolith.transform.localScale = new Vector3(1.6f, 9.0f, 1.6f);
            monolith.transform.rotation = Quaternion.Euler(0f, Random.Range(0f, 360f), 0f);

            Renderer rend = monolith.GetComponent<Renderer>();
            if (rend != null)
            {
                Material mat = new Material(Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard"));
                mat.color = new Color(0.18f, 0.20f, 0.28f);
                rend.material = mat;
            }

            // Glowing Rune core
            GameObject core = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            core.name = "Monolith_RuneCore";
            core.transform.SetParent(monolith.transform);
            core.transform.localPosition = new Vector3(0f, 0.25f, 0f);
            core.transform.localScale = new Vector3(1.2f, 0.35f, 1.2f);
            Destroy(core.GetComponent<Collider>());

            Renderer coreRend = core.GetComponent<Renderer>();
            if (coreRend != null)
            {
                Material coreMat = new Material(Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard"));
                coreMat.color = glow;
                coreRend.material = coreMat;
            }
        }

        private void CreateEnergyGeyser(Transform parent, Vector3 position, Color glow)
        {
            GameObject geyser = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            geyser.name = "EnergyGeyser";
            geyser.transform.SetParent(parent);
            geyser.transform.position = position + Vector3.up * 0.25f;
            geyser.transform.localScale = new Vector3(3.2f, 0.5f, 3.2f);

            Renderer rend = geyser.GetComponent<Renderer>();
            if (rend != null)
            {
                Material mat = new Material(Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard"));
                mat.color = new Color(0.15f, 0.15f, 0.2f);
                rend.material = mat;
            }
        }

        private void SpawnLinearDatasetCollectibles()
        {
            Transform collectiblesRoot = new GameObject("LinearSteppes_Collectibles").transform;
            collectiblesRoot.SetParent(transform);

            for (int i = 0; i < collectibleCount; i++)
            {
                // Real numeric feature X in [-5.0, 5.0]
                float rawX = Random.Range(-5.0f, 5.0f);
                // Gaussian noise
                float noise = (Random.value + Random.value + Random.value - 1.5f) * noiseSigma;
                // True target Y
                float rawY = trueSlope_W * rawX + trueBias_B + noise;

                // Random world spawn position around the terrain
                float angle = Random.Range(0f, Mathf.PI * 2f);
                float radius = Random.Range(6f, 32f);
                Vector3 worldPos = new Vector3(Mathf.Cos(angle) * radius, 1.2f, Mathf.Sin(angle) * radius);

                // Alternate between Feature Crystals, Target Shards, Paired Samples, and Hyperparameters
                MLResourceType type;
                int roll = i % 5;
                if (roll == 0 || roll == 1) type = MLResourceType.FeatureCrystal_X;
                else if (roll == 2) type = MLResourceType.TargetShard_Y;
                else if (roll == 3) type = MLResourceType.PairedDataTuple;
                else type = (i % 2 == 0) ? MLResourceType.WeightResidue_W : MLResourceType.StepFluid_Alpha;

                // Create 3D collectible shape
                PrimitiveType primType = (type == MLResourceType.FeatureCrystal_X) ? PrimitiveType.Cube :
                                        (type == MLResourceType.TargetShard_Y) ? PrimitiveType.Sphere :
                                        PrimitiveType.Cylinder;

                GameObject itemGO = GameObject.CreatePrimitive(primType);
                itemGO.name = $"MLItem_{type}_{i + 1}";
                itemGO.transform.SetParent(collectiblesRoot);
                itemGO.transform.position = worldPos;
                itemGO.transform.localScale = new Vector3(0.65f, 0.85f, 0.65f);

                MLCollectible collectible = itemGO.AddComponent<MLCollectible>();
                float paramVal = (type == MLResourceType.StepFluid_Alpha) ? 0.01f : Random.Range(0.5f, 2.5f);
                collectible.Initialize(type, rawX, rawY, paramVal);
            }
        }
    }
}

using UnityEngine;

namespace NeuroArena.Network
{
    /// <summary>
    /// Represents a lightweight holographic 'Ghost' avatar of a remote player in the shared biome.
    /// Uses client-side interpolation (Hermite/Lerp) between received 15-20Hz network snapshots.
    /// </summary>
    public class RemotePlayerGhost : MonoBehaviour
    {
        [Header("State Identity")]
        public string playerId;
        public string playerName = "Architect";
        public string characterBuild = "explorer";
        public int currentBiome = 0;
        public string activityState = "idle";

        [Header("Interpolation Settings")]
        [SerializeField] private float interpolationSpeed = 12.0f;
        [SerializeField] private float snapThreshold = 6.0f;

        private Vector3 targetPosition;
        private Quaternion targetRotation = Quaternion.identity;
        private Transform nameplateTransform;
        private TextMesh nameplateText;
        private Renderer ghostRenderer;

        public void Initialize(string id, string name, string build, Vector3 initialPos, int biome)
        {
            this.playerId = id;
            this.playerName = name;
            this.characterBuild = build;
            this.currentBiome = biome;

            transform.position = initialPos;
            targetPosition = initialPos;

            BuildGhostVisuals();
            CreateNameplate();
        }

        public void SetTargetTransform(Vector3 pos, float rotY, string activity, int biome)
        {
            this.targetPosition = pos;
            this.targetRotation = Quaternion.Euler(0f, rotY * Mathf.Rad2Deg, 0f);
            this.activityState = activity;
            this.currentBiome = biome;

            // Teleport / snap if distance is too large (e.g. fast-travel)
            if (Vector3.Distance(transform.position, targetPosition) > snapThreshold)
            {
                transform.position = targetPosition;
                transform.rotation = targetRotation;
            }
        }

        private void Update()
        {
            // Smooth client-side interpolation
            transform.position = Vector3.Lerp(transform.position, targetPosition, Time.deltaTime * interpolationSpeed);
            transform.rotation = Quaternion.Slerp(transform.rotation, targetRotation, Time.deltaTime * interpolationSpeed);

            // Reflect Activity State (Training Glow & Aura Ring)
            bool isTraining = activityState == "training";
            if (trainingAura != null)
            {
                trainingAura.SetActive(isTraining);
                if (isTraining)
                {
                    trainingAura.transform.Rotate(0f, 180f * Time.deltaTime, 0f);
                }
            }

            // Orient Nameplate toward Main Camera
            if (nameplateTransform != null && Camera.main != null)
            {
                nameplateTransform.rotation = Camera.main.transform.rotation;
                string statusTag = isTraining ? " <color=#facc15>[🧠 TRAINING]</color>" : "";
                string icon = (characterBuild == "scholar") ? "📜" : (characterBuild == "engineer") ? "⚙️" : "🧭";
                nameplateText.text = $"{icon} {playerName}{statusTag}";
            }
        }

        private GameObject trainingAura;

        private void BuildGhostVisuals()
        {
            // Attach Humanoid Character Rig with chosen archetype proportions
            HumanoidCharacterRig rig = gameObject.AddComponent<HumanoidCharacterRig>();
            CharacterBuildType buildType = (characterBuild == "scholar") ? CharacterBuildType.Scholar :
                                          (characterBuild == "engineer") ? CharacterBuildType.Engineer :
                                          CharacterBuildType.Explorer;
            rig.SetCharacterBuild(buildType);

            // Add Training Energy Aura Halo Ring (Ground-level)
            trainingAura = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            trainingAura.name = "GhostTrainingAuraRing";
            trainingAura.transform.SetParent(transform, false);
            trainingAura.transform.localPosition = new Vector3(0f, 0.05f, 0f);
            trainingAura.transform.localScale = new Vector3(2.2f, 0.04f, 2.2f);
            Collider cAura = trainingAura.GetComponent<Collider>();
            if (cAura != null) DestroyImmediate(cAura);

            Renderer auraRend = trainingAura.GetComponent<Renderer>();
            if (auraRend != null)
            {
                Color auraCol = new Color(1.0f, 0.8f, 0.1f, 0.85f);
                Material matAura = new Material(Shader.Find("Standard") ?? Shader.Find("Universal Render Pipeline/Lit"));
                matAura.color = auraCol;
                matAura.SetColor("_EmissionColor", auraCol * 2.2f);
                matAura.EnableKeyword("_EMISSION");
                auraRend.sharedMaterial = matAura;
            }
            trainingAura.SetActive(false);
        }

        private void CreateNameplate()
        {
            GameObject plateGO = new GameObject("GhostNameplate");
            plateGO.transform.SetParent(transform, false);
            plateGO.transform.localPosition = new Vector3(0f, 2.45f, 0f);
            nameplateTransform = plateGO.transform;

            nameplateText = plateGO.AddComponent<TextMesh>();
            nameplateText.color = new Color(0.85f, 0.95f, 1.0f);

            string icon = (characterBuild == "scholar") ? "📜" : (characterBuild == "engineer") ? "⚙️" : "🧭";
            nameplateText.text = $"{icon} {playerName}";
        }
    }
}

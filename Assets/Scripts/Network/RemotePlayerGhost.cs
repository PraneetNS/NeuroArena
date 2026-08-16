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

            // Orient Nameplate toward Main Camera
            if (nameplateTransform != null && Camera.main != null)
            {
                nameplateTransform.rotation = Camera.main.transform.rotation;
            }
        }

        private void BuildGhostVisuals()
        {
            // Create low-poly ghost silhouette primitive
            GameObject body = GameObject.CreatePrimitive(PrimitiveType.Capsule);
            body.name = "GhostBody";
            body.transform.SetParent(transform, false);
            body.transform.localPosition = new Vector3(0f, 1.0f, 0f);
            body.transform.localScale = (characterBuild == "scholar") ? new Vector3(0.7f, 1.2f, 0.7f) :
                                       (characterBuild == "engineer") ? new Vector3(0.9f, 0.85f, 0.9f) :
                                       new Vector3(1.0f, 1.0f, 1.0f);

            Collider c = body.GetComponent<Collider>();
            if (c != null) DestroyImmediate(c);

            ghostRenderer = body.GetComponent<Renderer>();
            if (ghostRenderer != null)
            {
                Color ghostCol = (characterBuild == "scholar") ? new Color(0.75f, 0.5f, 1.0f, 0.65f) :
                                 (characterBuild == "engineer") ? new Color(0.1f, 0.9f, 0.6f, 0.65f) :
                                 new Color(0.2f, 0.8f, 1.0f, 0.65f);

                // Holographic translucent material
                Material mat = new Material(Shader.Find("Standard") ?? Shader.Find("Universal Render Pipeline/Lit"));
                mat.color = ghostCol;
                mat.SetFloat("_Mode", 3); // Transparent
                mat.SetInt("_SrcBlend", (int)UnityEngine.Rendering.BlendMode.SrcAlpha);
                mat.SetInt("_DstBlend", (int)UnityEngine.Rendering.BlendMode.OneMinusSrcAlpha);
                mat.SetInt("_ZWrite", 0);
                mat.DisableKeyword("_ALPHATEST_ON");
                mat.EnableKeyword("_ALPHABLEND_ON");
                mat.DisableKeyword("_ALPHAPREMULTIPLY_ON");
                mat.renderQueue = 3000;
                mat.SetColor("_EmissionColor", ghostCol * 0.8f);
                mat.EnableKeyword("_EMISSION");

                ghostRenderer.sharedMaterial = mat;
            }
        }

        private void CreateNameplate()
        {
            GameObject plateGO = new GameObject("GhostNameplate");
            plateGO.transform.SetParent(transform, false);
            plateGO.transform.localPosition = new Vector3(0f, 2.25f, 0f);
            nameplateTransform = plateGO.transform;

            nameplateText = plateGO.AddComponent<TextMesh>();
            nameplateText.alignment = TextAlignment.Center;
            nameplateText.anchor = TextAnchor.MiddleCenter;
            nameplateText.fontSize = 24;
            nameplateText.characterSize = 0.08f;
            nameplateText.color = new Color(0.85f, 0.95f, 1.0f);

            string icon = (characterBuild == "scholar") ? "📜" : (characterBuild == "engineer") ? "⚙️" : "🧭";
            nameplateText.text = $"{icon} {playerName}";
        }
    }
}

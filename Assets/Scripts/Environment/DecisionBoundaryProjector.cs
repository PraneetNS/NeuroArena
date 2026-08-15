using UnityEngine;
using NeuroArena.ML;

namespace NeuroArena.Environment
{
    /// <summary>
    /// Projects the trained Logistic Regression decision boundary
    /// (w1 * X + w2 * Z + b = 0) as a physical 3D glowing energy hyperplane wall
    /// across the Marshlands terrain.
    /// </summary>
    public class DecisionBoundaryProjector : MonoBehaviour
    {
        public static DecisionBoundaryProjector Instance { get; private set; }

        [Header("Hyperplane Wall Parameters")]
        [SerializeField] private float wallLength = 36f;
        [SerializeField] private float wallHeight = 4.5f;
        [SerializeField] private float wallThickness = 0.35f;
        [SerializeField] private Color beamColor = new Color(0.2f, 1f, 0.6f, 0.75f);

        private GameObject wallObject;
        private Vector3 plateauCenter;
        private float currentW1 = 0.5f;
        private float currentW2 = 0.5f;
        private float currentB = 0.0f;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
        }

        public void Initialize(Vector3 center)
        {
            plateauCenter = center;
            CreateWallMesh();
            UpdateWallTransform(0.5f, 0.5f, 0.0f);
        }

        private void CreateWallMesh()
        {
            if (wallObject != null) return;

            wallObject = GameObject.CreatePrimitive(PrimitiveType.Cube);
            wallObject.name = "Hyperplane_EnergyWall";
            wallObject.transform.SetParent(transform);
            wallObject.transform.localScale = new Vector3(wallThickness, wallHeight, wallLength);
            Destroy(wallObject.GetComponent<Collider>()); // Non-blocking laser hologram

            Renderer rend = wallObject.GetComponent<Renderer>();
            if (rend != null)
            {
                Material mat = new Material(Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard"));
                mat.color = beamColor;
                rend.material = mat;
            }
        }

        public void UpdateWallTransform(float w1, float w2, float b)
        {
            currentW1 = w1;
            currentW2 = w2;
            currentB = b;

            if (wallObject == null) return;

            // Line equation: w1 * X + w2 * Z + b = 0
            // Normal vector n = (w1, w2)
            // Angle of the line: perpendicular to normal -> angle theta = atan2(-w1, w2)
            float angleDeg = Mathf.Atan2(-w1, w2) * Mathf.Rad2Deg;

            // Offset from center along normal: dist = -b / sqrt(w1^2 + w2^2)
            float norm = Mathf.Sqrt(w1 * w1 + w2 * w2);
            float dist = norm > 1e-4f ? (-b / norm) * 2.5f : 0f;

            Vector3 normal3D = norm > 1e-4f ? new Vector3(w1 / norm, 0f, w2 / norm) : Vector3.forward;
            Vector3 worldPos = plateauCenter + normal3D * dist + Vector3.up * (wallHeight * 0.5f);

            wallObject.transform.position = worldPos;
            wallObject.transform.rotation = Quaternion.Euler(0f, angleDeg, 0f);
        }
    }
}

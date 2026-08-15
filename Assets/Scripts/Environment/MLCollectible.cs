using UnityEngine;
using NeuroArena.Data;
using NeuroArena.Core;
using NeuroArena.UI;

namespace NeuroArena.Environment
{
    /// <summary>
    /// 3D Collectible object carrying real numerical ML feature values, 2D coordinates, and parameters.
    /// Triggers when touched by the player and transfers data to MLInventory.
    /// </summary>
    [RequireComponent(typeof(SphereCollider))]
    public class MLCollectible : MonoBehaviour
    {
        [Header("ML Resource Payload")]
        [SerializeField] private MLResourceType resourceType = MLResourceType.FeatureCrystal_X;
        [SerializeField] private float featureValueX1 = 1.0f;
        [SerializeField] private float featureValueX2 = 1.0f;
        [SerializeField] private float targetValueY = 1.0f;
        [SerializeField] private float parameterValue = 0.01f;

        [Header("Animation & Visuals")]
        [SerializeField] private float bobbingSpeed = 2.4f;
        [SerializeField] private float bobbingHeight = 0.22f;
        [SerializeField] private float rotationSpeed = 65f;
        [SerializeField] private Color glowColor = Color.cyan;

        private Vector3 startPosition;
        private bool isCollected = false;
        private float collectAnimationTimer = 0f;

        private void Start()
        {
            startPosition = transform.position;
            SphereCollider col = GetComponent<SphereCollider>();
            col.isTrigger = true;
            col.radius = 0.9f;

            ApplyVisualStyling();
        }

        private void Update()
        {
            if (isCollected)
            {
                collectAnimationTimer += Time.deltaTime * 5f;
                transform.localScale = Vector3.Lerp(transform.localScale, Vector3.zero, collectAnimationTimer);
                transform.position += Vector3.up * (2.5f * Time.deltaTime);

                if (transform.localScale.magnitude < 0.05f)
                {
                    Destroy(gameObject);
                }
                return;
            }

            float newY = startPosition.y + Mathf.Sin(Time.time * bobbingSpeed) * bobbingHeight;
            transform.position = new Vector3(startPosition.x, newY, startPosition.z);
            transform.Rotate(Vector3.up, rotationSpeed * Time.deltaTime, Space.World);
        }

        private void OnTriggerEnter(Collider other)
        {
            if (isCollected) return;

            PlayerController player = other.GetComponent<PlayerController>() ?? other.GetComponentInParent<PlayerController>();
            if (player != null || other.CompareTag("Player"))
            {
                Collect();
            }
        }

        public void Initialize(MLResourceType type, float xVal1, float yVal, float paramVal = 0.01f, float xVal2 = 0f)
        {
            resourceType = type;
            featureValueX1 = xVal1;
            featureValueX2 = xVal2;
            targetValueY = yVal;
            parameterValue = paramVal;
            ApplyVisualStyling();
        }

        private void ApplyVisualStyling()
        {
            Renderer rend = GetComponent<Renderer>();
            switch (resourceType)
            {
                case MLResourceType.FeatureCrystal_X:
                    glowColor = new Color(0.2f, 0.9f, 1.0f); // Cyan
                    break;
                case MLResourceType.TargetShard_Y:
                    glowColor = new Color(1.0f, 0.45f, 0.15f); // Amber
                    break;
                case MLResourceType.PairedDataTuple:
                    glowColor = new Color(0.35f, 1.0f, 0.45f); // Emerald
                    break;
                case MLResourceType.WeightResidue_W:
                    glowColor = new Color(0.85f, 0.3f, 0.95f); // Magenta
                    break;
                case MLResourceType.BiasSpark_B:
                    glowColor = new Color(1.0f, 0.9f, 0.2f); // Gold
                    break;
                case MLResourceType.StepFluid_Alpha:
                    glowColor = new Color(0.2f, 0.5f, 1.0f); // Cobalt
                    break;
                case MLResourceType.Class0_PurpleSpore:
                    glowColor = new Color(0.8f, 0.15f, 0.95f); // Neon Purple
                    break;
                case MLResourceType.Class1_AzureSpore:
                    glowColor = new Color(0.15f, 0.75f, 1.0f); // Bright Azure
                    break;
                case MLResourceType.SigmoidMembrane_Sigma:
                    glowColor = new Color(0.3f, 1.0f, 0.7f); // Mint Green
                    break;
                case MLResourceType.CrossEntropyVial:
                    glowColor = new Color(1.0f, 0.25f, 0.4f); // Crimson
                    break;
            }

            if (rend != null)
            {
                Material mat = new Material(Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard"));
                mat.color = glowColor;
                rend.material = mat;
            }
        }

        private void Collect()
        {
            isCollected = true;

            string popupMessage = "";
            switch (resourceType)
            {
                case MLResourceType.FeatureCrystal_X:
                    MLInventory.Instance?.AddFeatureValue(featureValueX1);
                    popupMessage = $"+Feature Crystal (X = {featureValueX1:F2})";
                    break;
                case MLResourceType.TargetShard_Y:
                    MLInventory.Instance?.AddTargetValue(targetValueY);
                    popupMessage = $"+Target Shard (Y = {targetValueY:F2})";
                    break;
                case MLResourceType.PairedDataTuple:
                    MLInventory.Instance?.AddDataPair(featureValueX1, targetValueY);
                    popupMessage = $"+Data Sample (x={featureValueX1:F2}, y={targetValueY:F2})";
                    break;
                case MLResourceType.Class0_PurpleSpore:
                    MLInventory.Instance?.AddClassificationSample(featureValueX1, featureValueX2, 0.0f);
                    popupMessage = $"+Class 0 Purple Spore (x1={featureValueX1:F1}, x2={featureValueX2:F1}, y=0)";
                    break;
                case MLResourceType.Class1_AzureSpore:
                    MLInventory.Instance?.AddClassificationSample(featureValueX1, featureValueX2, 1.0f);
                    popupMessage = $"+Class 1 Azure Spore (x1={featureValueX1:F1}, x2={featureValueX2:F1}, y=1)";
                    break;
                case MLResourceType.SigmoidMembrane_Sigma:
                    MLInventory.Instance?.AddResource(MLResourceType.SigmoidMembrane_Sigma);
                    popupMessage = $"+Sigmoid Membrane (σ(z) = 1/(1+e^-z))";
                    break;
                case MLResourceType.CrossEntropyVial:
                    MLInventory.Instance?.AddResource(MLResourceType.CrossEntropyVial);
                    popupMessage = $"+Cross-Entropy Vial (BCE Loss)";
                    break;
                case MLResourceType.WeightResidue_W:
                    MLInventory.Instance?.AddResource(MLResourceType.WeightResidue_W);
                    popupMessage = $"+Weight Residue (w = {parameterValue:F2})";
                    break;
                case MLResourceType.BiasSpark_B:
                    MLInventory.Instance?.AddResource(MLResourceType.BiasSpark_B);
                    popupMessage = $"+Bias Spark (b = {parameterValue:F2})";
                    break;
                case MLResourceType.StepFluid_Alpha:
                    MLInventory.Instance?.AddResource(MLResourceType.StepFluid_Alpha);
                    popupMessage = $"+Step Fluid (α = {parameterValue:F3})";
                    break;
            }

            FloatingTextPopup.Create(transform.position, popupMessage, glowColor);
        }
    }
}

using UnityEngine;
using NeuroArena.Data;
using NeuroArena.Core;
using NeuroArena.UI;

namespace NeuroArena.Environment
{
    /// <summary>
    /// 3D Modeled Collectible Artifact (Crystal, Shard, Rune Tablet, Vial).
    /// Replaces primitive geometric cubes/spheres with faceted low-poly meshes,
    /// smooth organic idle animation (rotate + bob + wobble), and a real particle glow.
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
        [SerializeField] private float bobbingSpeed = 2.2f;
        [SerializeField] private float bobbingHeight = 0.24f;
        [SerializeField] private float rotationSpeed = 55f;
        [SerializeField] private Color glowColor = Color.cyan;

        private Vector3 startPosition;
        private bool isCollected = false;
        private float collectAnimationTimer = 0f;
        private float randomTimeOffset = 0f;
        private ParticleSystem glowParticles;

        private void Awake()
        {
            randomTimeOffset = Random.Range(0f, Mathf.PI * 2f);
        }

        private void Start()
        {
            startPosition = transform.position;
            SphereCollider col = GetComponent<SphereCollider>();
            col.isTrigger = true;
            col.radius = 1.1f;

            ApplyVisualStylingAndMesh();
            CreateGlowParticleSystem();
        }

        private void Update()
        {
            if (isCollected)
            {
                collectAnimationTimer += Time.deltaTime * 5f;
                transform.localScale = Vector3.Lerp(transform.localScale, Vector3.zero, collectAnimationTimer);
                transform.position += Vector3.up * (3.0f * Time.deltaTime);

                if (transform.localScale.magnitude < 0.05f)
                {
                    Destroy(gameObject);
                }
                return;
            }

            // Smooth Idle Motion: Bobbing + Yaw Spin + Organic Pitch Sway
            float t = Time.time + randomTimeOffset;
            float newY = startPosition.y + Mathf.Sin(t * bobbingSpeed) * bobbingHeight;
            transform.position = new Vector3(startPosition.x, newY, startPosition.z);

            float wobblePitch = Mathf.Sin(t * 1.6f) * 6f;
            float wobbleRoll = Mathf.Cos(t * 1.4f) * 6f;
            transform.rotation = Quaternion.Euler(wobblePitch, (t * rotationSpeed) % 360f, wobbleRoll);
        }

        private void OnTriggerEnter(Collider other)
        {
            if (isCollected) return;

            PlayerController player = other.GetComponent<PlayerController>() ?? other.GetComponentInParent<PlayerController>();
            if (player != null || other.CompareTag("Player"))
            {
                if (player != null) player.TriggerPickupAnimation(0.5f);
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
            ApplyVisualStylingAndMesh();
        }

        private void ApplyVisualStylingAndMesh()
        {
            MeshFilter mf = GetComponent<MeshFilter>();
            if (mf == null) mf = gameObject.AddComponent<MeshFilter>();

            MeshRenderer mr = GetComponent<MeshRenderer>();
            if (mr == null) mr = gameObject.AddComponent<MeshRenderer>();

            // Assign Modeled Low-Poly Mesh according to ML Resource Type
            switch (resourceType)
            {
                case MLResourceType.FeatureCrystal_X:
                    mf.sharedMesh = StylizedLowPolyMeshes.CreateCrystalMesh(radius: 0.45f, height: 1.35f);
                    transform.localScale = Vector3.one * 0.9f;
                    break;

                case MLResourceType.TargetShard_Y:
                    mf.sharedMesh = StylizedLowPolyMeshes.CreateShardMesh(width: 0.55f, height: 1.30f, depth: 0.40f);
                    transform.localScale = Vector3.one * 0.95f;
                    break;

                case MLResourceType.PairedDataTuple:
                    mf.sharedMesh = StylizedLowPolyMeshes.CreateRuneTabletMesh(w: 0.75f, h: 1.05f, d: 0.28f);
                    transform.localScale = Vector3.one * 0.9f;
                    break;

                case MLResourceType.WeightResidue_W:
                case MLResourceType.BiasSpark_B:
                    mf.sharedMesh = StylizedLowPolyMeshes.CreateCrystalMesh(radius: 0.5f, height: 1.0f);
                    transform.localScale = Vector3.one * 0.85f;
                    break;

                default:
                    mf.sharedMesh = StylizedLowPolyMeshes.CreateCrystalMesh(radius: 0.42f, height: 1.25f);
                    transform.localScale = Vector3.one * 0.85f;
                    break;
            }

            // Assign PBR URP Lit Material with Metallic Luster & HDR Emission
            Material pbrMat = StylizedMaterialFactory.GetCollectibleMaterial(resourceType);
            mr.sharedMaterial = pbrMat;

            if (pbrMat.HasProperty("_EmissionColor"))
            {
                glowColor = pbrMat.GetColor("_EmissionColor");
            }
            else if (pbrMat.HasProperty("_BaseColor"))
            {
                glowColor = pbrMat.GetColor("_BaseColor");
            }
        }

        private void CreateGlowParticleSystem()
        {
            if (glowParticles != null) return;

            GameObject particleGO = new GameObject("GlowSparkles");
            particleGO.transform.SetParent(transform, false);
            particleGO.transform.localPosition = Vector3.zero;

            glowParticles = particleGO.AddComponent<ParticleSystem>();
            var main = glowParticles.main;
            main.startLifetime = 1.2f;
            main.startSpeed = 0.45f;
            main.startSize = 0.15f;
            main.startColor = new ParticleSystem.MinMaxGradient(glowColor, Color.white);
            main.maxParticles = 12;
            main.simulationSpace = ParticleSystemSimulationSpace.World;
            main.playOnAwake = true;

            var emission = glowParticles.emission;
            emission.rateOverTime = 8f;

            var shape = glowParticles.shape;
            shape.shapeType = ParticleSystemShapeType.Sphere;
            shape.radius = 0.45f;

            var colorOverLifetime = glowParticles.colorOverLifetime;
            colorOverLifetime.enabled = true;
            Gradient grad = new Gradient();
            grad.SetKeys(
                new GradientColorKey[] { new GradientColorKey(glowColor, 0.0f), new GradientColorKey(Color.white, 0.5f), new GradientColorKey(glowColor, 1.0f) },
                new GradientAlphaKey[] { new GradientAlphaKey(0.0f, 0.0f), new GradientAlphaKey(0.9f, 0.3f), new GradientAlphaKey(0.0f, 1.0f) }
            );
            colorOverLifetime.color = grad;

            var sizeOverLifetime = glowParticles.sizeOverLifetime;
            sizeOverLifetime.enabled = true;
            AnimationCurve curve = new AnimationCurve();
            curve.AddKey(0.0f, 0.3f);
            curve.AddKey(0.5f, 1.0f);
            curve.AddKey(1.0f, 0.1f);
            sizeOverLifetime.size = new ParticleSystem.MinMaxCurve(1.0f, curve);

            ParticleSystemRenderer rend = particleGO.GetComponent<ParticleSystemRenderer>();
            if (rend != null)
            {
                Shader s = Shader.Find("Universal Render Pipeline/Particles/Unlit") ?? Shader.Find("Particles/Standard Unlit") ?? Shader.Find("Standard");
                Material pMat = new Material(s);
                pMat.color = glowColor;
                rend.material = pMat;
            }
        }

        private void Collect()
        {
            isCollected = true;
            if (glowParticles != null)
            {
                var em = glowParticles.emission;
                em.rateOverTime = 0f;
            }

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

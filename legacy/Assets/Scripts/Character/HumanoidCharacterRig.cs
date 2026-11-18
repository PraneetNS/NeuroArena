using System;
using UnityEngine;

    public enum CharacterBuildType
    {
        Explorer, // Rounder / Stout build with heavy field exploration armor
        Scholar,  // Taller / Slender build with mathematical robe plates
        Engineer  // Compact / Agile build with dual power conduits and utility visor
    }

    /// <summary>
    /// Procedural Low-Poly Rigged Humanoid Base Generator.
    /// Builds a stylized Synty/Mixamo compatible Humanoid character mesh hierarchy with:
    /// - Faceted Cybernetic Helmet & Glowing Visor
    /// - Torso Armor with Energy Core
    /// - Articulated Arms, Forearms & Hands
    /// - Articulated Thighs, Calves & Boots
    /// </summary>
    [RequireComponent(typeof(CharacterAnimationController))]
    public class HumanoidCharacterRig : MonoBehaviour
    {
        [Header("Character Build Silhouette")]
        public CharacterBuildType characterBuild = CharacterBuildType.Explorer;

        [Header("Materials & Colors")]
        public Color primaryArmorColor = new Color(0.12f, 0.16f, 0.24f); // Slate Navy
        public Color accentColor = new Color(0.08f, 0.74f, 0.95f);       // Cyan Neon
        public Color emissiveVisorColor = new Color(0.13f, 0.83f, 0.93f); // Glowing Azure

        private CharacterAnimationController animController;

        private void Awake()
        {
            animController = GetComponent<CharacterAnimationController>();
            BuildRigHierarchy();
        }

        public void SetCharacterBuild(CharacterBuildType newBuild)
        {
            characterBuild = newBuild;
            // Clear existing children except animController refs
            foreach (Transform child in transform)
            {
                Destroy(child.gameObject);
            }
            BuildRigHierarchy();
        }

        public void BuildRigHierarchy()
        {
            float widthScale = characterBuild == CharacterBuildType.Explorer ? 1.25f : (characterBuild == CharacterBuildType.Scholar ? 0.85f : 1.0f);
            float heightScale = characterBuild == CharacterBuildType.Scholar ? 1.2f : (characterBuild == CharacterBuildType.Engineer ? 0.9f : 1.0f);

            // Root Hips
            GameObject hipsGO = CreateBoneNode("Hips", transform, new Vector3(0f, 0.95f * heightScale, 0f));
            animController.hips = hipsGO.transform;

            // Spine / Torso
            Vector3 torsoSize = new Vector3(0.55f * widthScale, 0.6f * heightScale, 0.35f * widthScale);
            GameObject spineGO = CreateBoneNode("Spine", hipsGO.transform, new Vector3(0f, 0.35f * heightScale, 0f));
            animController.spine = spineGO.transform;
            CreateMeshPart("TorsoMesh", spineGO.transform, PrimitiveType.Cube, new Vector3(0f, 0.15f * heightScale, 0f), torsoSize, primaryArmorColor);
            CreateMeshPart("CoreRune", spineGO.transform, PrimitiveType.Cylinder, new Vector3(0f, 0.2f * heightScale, 0.18f * widthScale), new Vector3(0.18f * widthScale, 0.05f, 0.18f * widthScale), accentColor, true);

            // Head & Visor
            Vector3 headSize = characterBuild == CharacterBuildType.Explorer ? new Vector3(0.42f, 0.36f, 0.42f) : (characterBuild == CharacterBuildType.Scholar ? new Vector3(0.32f, 0.44f, 0.32f) : new Vector3(0.36f, 0.34f, 0.36f));
            GameObject headGO = CreateBoneNode("Head", spineGO.transform, new Vector3(0f, 0.55f * heightScale, 0f));
            animController.head = headGO.transform;
            CreateMeshPart("HelmetMesh", headGO.transform, PrimitiveType.Cube, Vector3.zero, headSize, primaryArmorColor);
            CreateMeshPart("VisorMesh", headGO.transform, PrimitiveType.Cube, new Vector3(0f, 0.02f, headSize.z * 0.48f), new Vector3(headSize.x * 0.85f, 0.14f * heightScale, 0.12f), emissiveVisorColor, true);

            // Left Arm
            float armSpacing = 0.38f * widthScale;
            GameObject lArmGO = CreateBoneNode("LeftUpperArm", spineGO.transform, new Vector3(-armSpacing, 0.35f * heightScale, 0f));
            animController.leftArm = lArmGO.transform;
            CreateMeshPart("LArmMesh", lArmGO.transform, PrimitiveType.Cube, new Vector3(0f, -0.18f * heightScale, 0f), new Vector3(0.18f * widthScale, 0.32f * heightScale, 0.18f * widthScale), primaryArmorColor);
            GameObject lForearmGO = CreateBoneNode("LeftForearm", lArmGO.transform, new Vector3(0f, -0.35f * heightScale, 0f));
            animController.leftForearm = lForearmGO.transform;
            CreateMeshPart("LForearmMesh", lForearmGO.transform, PrimitiveType.Cube, new Vector3(0f, -0.15f * heightScale, 0f), new Vector3(0.15f * widthScale, 0.28f * heightScale, 0.15f * widthScale), accentColor);

            // Right Arm
            GameObject rArmGO = CreateBoneNode("RightUpperArm", spineGO.transform, new Vector3(armSpacing, 0.35f * heightScale, 0f));
            animController.rightArm = rArmGO.transform;
            CreateMeshPart("RArmMesh", rArmGO.transform, PrimitiveType.Cube, new Vector3(0f, -0.18f * heightScale, 0f), new Vector3(0.18f * widthScale, 0.32f * heightScale, 0.18f * widthScale), primaryArmorColor);
            GameObject rForearmGO = CreateBoneNode("RightForearm", rArmGO.transform, new Vector3(0f, -0.35f * heightScale, 0f));
            animController.rightForearm = rForearmGO.transform;
            CreateMeshPart("RForearmMesh", rForearmGO.transform, PrimitiveType.Cube, new Vector3(0f, -0.15f * heightScale, 0f), new Vector3(0.15f * widthScale, 0.28f * heightScale, 0.15f * widthScale), accentColor);

            // Left Leg
            float legSpacing = 0.18f * widthScale;
            GameObject lLegGO = CreateBoneNode("LeftThigh", hipsGO.transform, new Vector3(-legSpacing, -0.1f * heightScale, 0f));
            animController.leftLeg = lLegGO.transform;
            CreateMeshPart("LThighMesh", lLegGO.transform, PrimitiveType.Cube, new Vector3(0f, -0.22f * heightScale, 0f), new Vector3(0.2f * widthScale, 0.4f * heightScale, 0.2f * widthScale), primaryArmorColor);
            GameObject lCalfGO = CreateBoneNode("LeftCalf", lLegGO.transform, new Vector3(0f, -0.42f * heightScale, 0f));
            animController.leftCalf = lCalfGO.transform;
            CreateMeshPart("LCalfMesh", lCalfGO.transform, PrimitiveType.Cube, new Vector3(0f, -0.2f * heightScale, 0f), new Vector3(0.18f * widthScale, 0.38f * heightScale, 0.18f * widthScale), primaryArmorColor);
            CreateMeshPart("LBootMesh", lCalfGO.transform, PrimitiveType.Cube, new Vector3(0f, -0.4f * heightScale, 0.06f), new Vector3(0.2f * widthScale, 0.12f, 0.3f), accentColor);

            // Right Leg
            GameObject rLegGO = CreateBoneNode("RightThigh", hipsGO.transform, new Vector3(legSpacing, -0.1f * heightScale, 0f));
            animController.rightLeg = rLegGO.transform;
            CreateMeshPart("RThighMesh", rLegGO.transform, PrimitiveType.Cube, new Vector3(0f, -0.22f * heightScale, 0f), new Vector3(0.2f * widthScale, 0.4f * heightScale, 0.2f * widthScale), primaryArmorColor);
            GameObject rCalfGO = CreateBoneNode("RightCalf", rLegGO.transform, new Vector3(0f, -0.42f * heightScale, 0f));
            animController.rightCalf = rCalfGO.transform;
            CreateMeshPart("RCalfMesh", rCalfGO.transform, PrimitiveType.Cube, new Vector3(0f, -0.2f * heightScale, 0f), new Vector3(0.18f * widthScale, 0.38f * heightScale, 0.18f * widthScale), primaryArmorColor);
            CreateMeshPart("RBootMesh", rCalfGO.transform, PrimitiveType.Cube, new Vector3(0f, -0.4f * heightScale, 0.06f), new Vector3(0.2f * widthScale, 0.12f, 0.3f), accentColor);
        }

        private GameObject CreateBoneNode(string name, Transform parent, Vector3 localPos)
        {
            GameObject node = new GameObject(name);
            node.transform.SetParent(parent, false);
            node.transform.localPosition = localPos;
            return node;
        }

        private GameObject CreateMeshPart(string name, Transform parent, PrimitiveType primType, Vector3 localPos, Vector3 localScale, Color color, bool emissive = false)
        {
            GameObject part = GameObject.CreatePrimitive(primType);
            part.name = name;
            part.transform.SetParent(parent, false);
            part.transform.localPosition = localPos;
            part.transform.localScale = localScale;

            // Remove default collider so it doesn't interfere with character controller
            Collider c = part.GetComponent<Collider>();
            if (c != null) DestroyImmediate(c);

            Renderer rend = part.GetComponent<Renderer>();
            if (rend != null)
            {
                Material mat = new Material(Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard"));
                mat.color = color;
                if (emissive)
                {
                    mat.EnableKeyword("_EMISSION");
                    mat.SetColor("_EmissionColor", color * 1.5f);
                }
                rend.sharedMaterial = mat;
            }

            return part;
        }
    }
}

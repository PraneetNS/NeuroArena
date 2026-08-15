using System;
using UnityEngine;

namespace NeuroArena.Character
{
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

        public void BuildRigHierarchy()
        {
            // Root Hips
            GameObject hipsGO = CreateBoneNode("Hips", transform, new Vector3(0f, 0.95f, 0f));
            animController.hips = hipsGO.transform;

            // Spine / Torso
            GameObject spineGO = CreateBoneNode("Spine", hipsGO.transform, new Vector3(0f, 0.35f, 0f));
            animController.spine = spineGO.transform;
            CreateMeshPart("TorsoMesh", spineGO.transform, PrimitiveType.Cube, new Vector3(0f, 0.15f, 0f), new Vector3(0.55f, 0.6f, 0.35f), primaryArmorColor);
            CreateMeshPart("CoreRune", spineGO.transform, PrimitiveType.Cylinder, new Vector3(0f, 0.2f, 0.18f), new Vector3(0.18f, 0.05f, 0.18f), accentColor, true);

            // Head & Visor
            GameObject headGO = CreateBoneNode("Head", spineGO.transform, new Vector3(0f, 0.55f, 0f));
            animController.head = headGO.transform;
            CreateMeshPart("HelmetMesh", headGO.transform, PrimitiveType.Cube, Vector3.zero, new Vector3(0.38f, 0.38f, 0.38f), primaryArmorColor);
            CreateMeshPart("VisorMesh", headGO.transform, PrimitiveType.Cube, new Vector3(0f, 0.02f, 0.18f), new Vector3(0.32f, 0.14f, 0.12f), emissiveVisorColor, true);

            // Left Arm
            GameObject lArmGO = CreateBoneNode("LeftUpperArm", spineGO.transform, new Vector3(-0.38f, 0.35f, 0f));
            animController.leftArm = lArmGO.transform;
            CreateMeshPart("LArmMesh", lArmGO.transform, PrimitiveType.Cube, new Vector3(0f, -0.18f, 0f), new Vector3(0.18f, 0.32f, 0.18f), primaryArmorColor);
            GameObject lForearmGO = CreateBoneNode("LeftForearm", lArmGO.transform, new Vector3(0f, -0.35f, 0f));
            animController.leftForearm = lForearmGO.transform;
            CreateMeshPart("LForearmMesh", lForearmGO.transform, PrimitiveType.Cube, new Vector3(0f, -0.15f, 0f), new Vector3(0.15f, 0.28f, 0.15f), accentColor);

            // Right Arm
            GameObject rArmGO = CreateBoneNode("RightUpperArm", spineGO.transform, new Vector3(0.38f, 0.35f, 0f));
            animController.rightArm = rArmGO.transform;
            CreateMeshPart("RArmMesh", rArmGO.transform, PrimitiveType.Cube, new Vector3(0f, -0.18f, 0f), new Vector3(0.18f, 0.32f, 0.18f), primaryArmorColor);
            GameObject rForearmGO = CreateBoneNode("RightForearm", rArmGO.transform, new Vector3(0f, -0.35f, 0f));
            animController.rightForearm = rForearmGO.transform;
            CreateMeshPart("RForearmMesh", rForearmGO.transform, PrimitiveType.Cube, new Vector3(0f, -0.15f, 0f), new Vector3(0.15f, 0.28f, 0.15f), accentColor);

            // Left Leg
            GameObject lLegGO = CreateBoneNode("LeftThigh", hipsGO.transform, new Vector3(-0.18f, -0.1f, 0f));
            animController.leftLeg = lLegGO.transform;
            CreateMeshPart("LThighMesh", lLegGO.transform, PrimitiveType.Cube, new Vector3(0f, -0.22f, 0f), new Vector3(0.2f, 0.4f, 0.2f), primaryArmorColor);
            GameObject lCalfGO = CreateBoneNode("LeftCalf", lLegGO.transform, new Vector3(0f, -0.42f, 0f));
            animController.leftCalf = lCalfGO.transform;
            CreateMeshPart("LCalfMesh", lCalfGO.transform, PrimitiveType.Cube, new Vector3(0f, -0.2f, 0f), new Vector3(0.18f, 0.38f, 0.18f), primaryArmorColor);
            CreateMeshPart("LBootMesh", lCalfGO.transform, PrimitiveType.Cube, new Vector3(0f, -0.4f, 0.06f), new Vector3(0.2f, 0.12f, 0.3f), accentColor);

            // Right Leg
            GameObject rLegGO = CreateBoneNode("RightThigh", hipsGO.transform, new Vector3(0.18f, -0.1f, 0f));
            animController.rightLeg = rLegGO.transform;
            CreateMeshPart("RThighMesh", rLegGO.transform, PrimitiveType.Cube, new Vector3(0f, -0.22f, 0f), new Vector3(0.2f, 0.4f, 0.2f), primaryArmorColor);
            GameObject rCalfGO = CreateBoneNode("RightCalf", rLegGO.transform, new Vector3(0f, -0.42f, 0f));
            animController.rightCalf = rCalfGO.transform;
            CreateMeshPart("RCalfMesh", rCalfGO.transform, PrimitiveType.Cube, new Vector3(0f, -0.2f, 0f), new Vector3(0.18f, 0.38f, 0.18f), primaryArmorColor);
            CreateMeshPart("RBootMesh", rCalfGO.transform, PrimitiveType.Cube, new Vector3(0f, -0.4f, 0.06f), new Vector3(0.2f, 0.12f, 0.3f), accentColor);
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

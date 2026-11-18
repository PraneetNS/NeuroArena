using System;
using System.Collections.Generic;
using UnityEngine;
using NeuroArena.ML;

namespace NeuroArena.Environment
{
    /// <summary>
    /// Visualizes the trained Decision Tree in 3D world space as literal branching fractal geometry.
    /// Sprouts branches at each feature threshold split and blooms colored leaves at terminal nodes.
    /// Supports dynamic real-time pruning animations.
    /// </summary>
    public class BranchingTreeVisualizer : MonoBehaviour
    {
        public static BranchingTreeVisualizer Instance { get; private set; }

        [Header("3D Tree Parameters")]
        [SerializeField] private float trunkHeight = 2.8f;
        [SerializeField] private float branchLength = 2.2f;
        [SerializeField] private float branchRadius = 0.22f;
        [SerializeField] private float spreadAngle = 36f;

        private GameObject treeRootObject;
        private DecisionTreeNode currentRootNode;

        private readonly Color[] classColors = new Color[]
        {
            new Color(0.2f, 0.9f, 1.0f), // Class 0: Azure Cyan
            new Color(0.85f, 0.2f, 0.95f), // Class 1: Purple
            new Color(1.0f, 0.8f, 0.2f)   // Class 2: Amber Yellow
        };

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
        }

        public void RenderTree(DecisionTreeNode root, Vector3 worldPosition)
        {
            currentRootNode = root;

            if (treeRootObject != null)
            {
                Destroy(treeRootObject);
            }

            if (root == null) return;

            treeRootObject = new GameObject("3D_DecisionTree_Canopy");
            treeRootObject.transform.position = worldPosition;
            treeRootObject.transform.SetParent(transform);

            // Sprout central base trunk
            BuildBranchRecursive(treeRootObject.transform, root, Vector3.zero, Vector3.up, branchLength * 1.2f, branchRadius, 0);
        }

        private void BuildBranchRecursive(
            Transform parent,
            DecisionTreeNode node,
            Vector3 startPos,
            Vector3 direction,
            float length,
            float radius,
            int depth)
        {
            if (node == null) return;

            Vector3 endPos = startPos + direction * length;

            // 1. Create Branch Cylinder
            GameObject branchGO = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            branchGO.name = $"Branch_Node_{node.nodeId}_d{depth}";
            branchGO.transform.SetParent(parent);
            branchGO.transform.position = (startPos + endPos) * 0.5f;
            branchGO.transform.localScale = new Vector3(radius * 2f, length * 0.5f, radius * 2f);
            branchGO.transform.up = direction;

            Renderer branchRend = branchGO.GetComponent<Renderer>();
            if (branchRend != null)
            {
                Material mat = new Material(Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard"));
                mat.color = node.isPruned ? new Color(0.4f, 0.4f, 0.4f, 0.4f) : new Color(0.25f, 0.18f, 0.12f);
                branchRend.material = mat;
            }

            // If leaf or pruned: Bloom colored leaf cluster
            if (node.isLeaf || node.isPruned || node.leftChild == null || node.rightChild == null)
            {
                GameObject leafGO = GameObject.CreatePrimitive(PrimitiveType.Sphere);
                leafGO.name = $"Leaf_Class_{node.predictedClass}";
                leafGO.transform.SetParent(parent);
                leafGO.transform.position = endPos;
                leafGO.transform.localScale = Vector3.one * (0.8f - depth * 0.08f);

                Renderer leafRend = leafGO.GetComponent<Renderer>();
                if (leafRend != null)
                {
                    Material mat = new Material(Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard"));
                    Color col = (node.predictedClass >= 0 && node.predictedClass < classColors.Length) ? classColors[node.predictedClass] : Color.green;
                    mat.color = col;
                    leafRend.material = mat;
                }
                return;
            }

            // 2. Fork into Left Branch (x_j <= threshold) and Right Branch (x_j > threshold)
            float angleRad = spreadAngle * Mathf.Deg2Rad * Mathf.Pow(0.85f, depth);
            float nextLength = length * 0.78f;
            float nextRadius = radius * 0.72f;

            Vector3 ortho = (node.splitFeatureIndex == 0) ? Vector3.right : Vector3.forward;
            Vector3 leftDir = Quaternion.AngleAxis(-spreadAngle, ortho) * direction;
            Vector3 rightDir = Quaternion.AngleAxis(spreadAngle, ortho) * direction;

            BuildBranchRecursive(parent, node.leftChild, endPos, leftDir.normalized, nextLength, nextRadius, depth + 1);
            BuildBranchRecursive(parent, node.rightChild, endPos, rightDir.normalized, nextLength, nextRadius, depth + 1);
        }
    }
}

using System;
using System.Collections.Generic;
using UnityEngine;

namespace NeuroArena.Environment
{
    /// <summary>
    /// Visualizes the 2-Layer MLP Neural Network in 3D world space as glowing holographic synapse scaffolding.
    /// Synapse laser cylinder thickness and color scale dynamically with weight magnitudes |W_ij|.
    /// </summary>
    public class SynapseNetworkVisualizer : MonoBehaviour
    {
        public static SynapseNetworkVisualizer Instance { get; private set; }

        [Header("3D Synapse Layout")]
        [SerializeField] private float layerSpacing = 5.5f;
        [SerializeField] private float neuronSpacing = 1.6f;
        [SerializeField] private float baseCylinderRadius = 0.04f;

        private GameObject networkRoot;
        private List<GameObject> neuronSpheres = new List<GameObject>();
        private List<SynapseLine> synapses = new List<SynapseLine>();

        private struct SynapseLine
        {
            public GameObject cylinder;
            public Vector3 start;
            public Vector3 end;
            public int fromLayer;
            public int fromIdx;
            public int toIdx;
        }

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
        }

        public void BuildNetworkScaffold(int hiddenSize, Vector3 worldPosition)
        {
            if (networkRoot != null) Destroy(networkRoot);

            networkRoot = new GameObject("3D_Synapse_Scaffold");
            networkRoot.transform.position = worldPosition;
            networkRoot.transform.SetParent(transform);

            neuronSpheres.Clear();
            synapses.Clear();

            int inputCount = 2;
            int H = Mathf.Clamp(hiddenSize, 2, 16);
            int outputCount = 1;

            Vector3[] inputPositions = new Vector3[inputCount];
            Vector3[] hiddenPositions = new Vector3[H];
            Vector3[] outputPositions = new Vector3[outputCount];

            // 1. Position Input Neurons
            for (int i = 0; i < inputCount; i++)
            {
                float y = (i - 0.5f) * neuronSpacing + 2.5f;
                inputPositions[i] = new Vector3(-layerSpacing, y, 0f);
                CreateNeuronSphere(networkRoot.transform, inputPositions[i], new Color(0.2f, 0.9f, 1f), $"Input_{i}");
            }

            // 2. Position Hidden Neurons
            for (int h = 0; h < H; h++)
            {
                float y = (h - (H - 1) * 0.5f) * neuronSpacing + 2.5f;
                hiddenPositions[h] = new Vector3(0f, y, 0f);
                CreateNeuronSphere(networkRoot.transform, hiddenPositions[h], new Color(0.2f, 1f, 0.6f), $"Hidden_{h}");
            }

            // 3. Position Output Neuron
            outputPositions[0] = new Vector3(layerSpacing, 2.5f, 0f);
            CreateNeuronSphere(networkRoot.transform, outputPositions[0], new Color(1f, 0.8f, 0.2f), "Output_0");

            // 4. Create Synapses (Input ➔ Hidden)
            for (int i = 0; i < inputCount; i++)
            {
                for (int h = 0; h < H; h++)
                {
                    CreateSynapseCylinder(networkRoot.transform, inputPositions[i], hiddenPositions[h], 0, i, h);
                }
            }

            // 5. Create Synapses (Hidden ➔ Output)
            for (int h = 0; h < H; h++)
            {
                CreateSynapseCylinder(networkRoot.transform, hiddenPositions[h], outputPositions[0], 1, h, 0);
            }
        }

        private void CreateNeuronSphere(Transform parent, Vector3 localPos, Color glowCol, string name)
        {
            GameObject sphere = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            sphere.name = name;
            sphere.transform.SetParent(parent);
            sphere.transform.localPosition = localPos;
            sphere.transform.localScale = Vector3.one * 0.65f;
            Destroy(sphere.GetComponent<Collider>());

            Renderer r = sphere.GetComponent<Renderer>();
            if (r != null)
            {
                Material mat = new Material(Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard"));
                mat.color = glowCol;
                r.material = mat;
            }
            neuronSpheres.Add(sphere);
        }

        private void CreateSynapseCylinder(Transform parent, Vector3 start, Vector3 end, int layer, int fromIdx, int toIdx)
        {
            GameObject cyl = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            cyl.name = $"Synapse_L{layer}_{fromIdx}_to_{toIdx}";
            cyl.transform.SetParent(parent);
            Destroy(cyl.GetComponent<Collider>());

            Vector3 mid = (start + end) * 0.5f;
            Vector3 dir = (end - start);
            float len = dir.magnitude;

            cyl.transform.localPosition = mid;
            cyl.transform.localScale = new Vector3(baseCylinderRadius * 2f, len * 0.5f, baseCylinderRadius * 2f);
            cyl.transform.up = dir.normalized;

            Renderer r = cyl.GetComponent<Renderer>();
            if (r != null)
            {
                Material mat = new Material(Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard"));
                mat.color = new Color(0.2f, 0.8f, 0.9f, 0.35f);
                r.material = mat;
            }

            synapses.Add(new SynapseLine
            {
                cylinder = cyl,
                start = start,
                end = end,
                fromLayer = layer,
                fromIdx = fromIdx,
                toIdx = toIdx
            });
        }

        public void UpdateSynapseWeights(float[][] W1, float[] W2)
        {
            if (W1 == null || W2 == null) return;

            foreach (var syn in synapses)
            {
                if (syn.cylinder == null) continue;

                float weightVal = 0f;
                if (syn.fromLayer == 0)
                {
                    if (syn.toIdx < W1.Length && syn.fromIdx < W1[syn.toIdx].Length)
                    {
                        weightVal = W1[syn.toIdx][syn.fromIdx];
                    }
                }
                else
                {
                    if (syn.fromIdx < W2.Length)
                    {
                        weightVal = W2[syn.fromIdx];
                    }
                }

                float absW = Mathf.Abs(weightVal);
                float radius = Mathf.Clamp(baseCylinderRadius * (1f + absW * 2.5f), 0.03f, 0.25f);
                Vector3 dir = (syn.end - syn.start);
                syn.cylinder.transform.localScale = new Vector3(radius * 2f, dir.magnitude * 0.5f, radius * 2f);

                Renderer r = syn.cylinder.GetComponent<Renderer>();
                if (r != null)
                {
                    Color col = weightVal >= 0 ? new Color(0.2f, 1f, 0.5f, 0.75f) : new Color(1f, 0.2f, 0.6f, 0.75f);
                    r.material.color = col;
                }
            }
        }
    }
}

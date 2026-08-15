using System.Collections.Generic;
using UnityEngine;
using NeuroArena.ML;

namespace NeuroArena.Environment
{
    /// <summary>
    /// In-World 3D Semantic Constellation Visualizer for Biome 6 (The Semantic Expanse).
    /// Spawns 3D floating Concept Runes and connects semantically similar runes
    /// with dynamic laser beams whose thickness and color scale with Cosine Similarity.
    /// </summary>
    public class EmbeddingConstellationVisualizer : MonoBehaviour
    {
        public static EmbeddingConstellationVisualizer Instance { get; private set; }

        [Header("Constellation Center")]
        [SerializeField] private Vector3 centerOrigin = new Vector3(0f, 1.5f, 65f);
        [SerializeField] private float similarityThreshold = 0.65f;

        private List<GameObject> runeObjects = new List<GameObject>();
        private List<LineRenderer> similarityBeams = new List<LineRenderer>();

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
        }

        private void Start()
        {
            BuildConstellation();
        }

        public void BuildConstellation()
        {
            ClearExisting();

            List<ConceptRune> runes = VectorEmbeddingEngine.GetRunes();
            if (runes == null || runes.Count == 0) return;

            // 1. Spawn 3D Floating Rune Meshes
            for (int i = 0; i < runes.Count; i++)
            {
                var r = runes[i];
                Vector3 worldPos = centerOrigin + r.spatialPos3D;

                GameObject runeGo = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
                runeGo.name = $"Rune_{r.word}";
                runeGo.transform.SetParent(transform);
                runeGo.transform.position = worldPos;
                runeGo.transform.localScale = new Vector3(0.7f, 0.15f, 0.7f);

                var mr = runeGo.GetComponent<MeshRenderer>();
                if (mr != null)
                {
                    mr.material = new Material(Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard"));
                    mr.material.color = r.runeColor;
                    mr.material.EnableKeyword("_EMISSION");
                    mr.material.SetColor("_EmissionColor", r.runeColor * 1.6f);
                }

                // Attach Text Billboard
                GameObject textObj = new GameObject($"Label_{r.word}");
                textObj.transform.SetParent(runeGo.transform);
                textObj.transform.localPosition = new Vector3(0f, 1.2f, 0f);
                var tm = textObj.AddComponent<TextMesh>();
                tm.text = r.word.ToUpper();
                tm.fontSize = 28;
                tm.alignment = TextAlignment.Center;
                tm.anchor = TextAnchor.MiddleCenter;
                tm.color = r.runeColor;
                tm.characterSize = 0.08f;

                runeObjects.Add(runeGo);
            }

            // 2. Spawn Cosine Similarity Connecting Laser Beams
            for (int i = 0; i < runes.Count; i++)
            {
                for (int j = i + 1; j < runes.Count; j++)
                {
                    float sim = VectorEmbeddingEngine.CosineSimilarity(runes[i].embeddingVector, runes[j].embeddingVector);
                    if (sim >= similarityThreshold)
                    {
                        GameObject beamGo = new GameObject($"Beam_{runes[i].word}_{runes[j].word}");
                        beamGo.transform.SetParent(transform);

                        LineRenderer lr = beamGo.AddComponent<LineRenderer>();
                        lr.positionCount = 2;
                        lr.SetPosition(0, centerOrigin + runes[i].spatialPos3D);
                        lr.SetPosition(1, centerOrigin + runes[j].spatialPos3D);

                        float beamWidth = Mathf.Lerp(0.02f, 0.09f, (sim - similarityThreshold) / (1f - similarityThreshold));
                        lr.startWidth = beamWidth;
                        lr.endWidth = beamWidth;

                        Color beamCol = Color.Lerp(new Color(0.2f, 0.8f, 1f, 0.4f), new Color(0.3f, 1f, 0.5f, 0.9f), sim);
                        lr.material = new Material(Shader.Find("Universal Render Pipeline/Unlit") ?? Shader.Find("Sprites/Default"));
                        lr.startColor = beamCol;
                        lr.endColor = beamCol;

                        similarityBeams.Add(lr);
                    }
                }
            }
        }

        private void Update()
        {
            float time = Time.time * 1.2f;
            for (int i = 0; i < runeObjects.Count; i++)
            {
                if (runeObjects[i] != null)
                {
                    runeObjects[i].transform.Rotate(Vector3.up, 25f * Time.deltaTime, Space.World);
                }
            }
        }

        private void ClearExisting()
        {
            runeObjects.ForEach(go => { if (go != null) Destroy(go); });
            runeObjects.Clear();
            similarityBeams.ForEach(lr => { if (lr != null) Destroy(lr.gameObject); });
            similarityBeams.Clear();
        }
    }
}

using System.Collections.Generic;
using UnityEngine;
using NeuroArena.ML;

namespace NeuroArena.Environment
{
    /// <summary>
    /// In-World 3D Semantic Constellation Visualizer for Biome 6 (The Semantic Expanse).
    /// Spawns 3D floating Concept Runes and connects semantically similar runes
    /// with dynamic laser beams whose thickness and color scale with Cosine Similarity.
    /// Supports dynamic Simplified Attention Highlighting with scaled HDR emission pulses and attention labels.
    /// </summary>
    public class EmbeddingConstellationVisualizer : MonoBehaviour
    {
        public static EmbeddingConstellationVisualizer Instance { get; private set; }

        [Header("Constellation Center")]
        [SerializeField] private Vector3 centerOrigin = new Vector3(0f, 1.5f, 65f);
        [SerializeField] private float similarityThreshold = 0.65f;

        private List<GameObject> runeObjects = new List<GameObject>();
        private Dictionary<string, GameObject> runeByWord = new Dictionary<string, GameObject>();
        private Dictionary<string, Color> baseColorByWord = new Dictionary<string, Color>();
        private List<LineRenderer> similarityBeams = new List<LineRenderer>();

        private Dictionary<string, float> currentAttentionWeights = new Dictionary<string, float>();
        private bool isAttentionActive = false;

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
                runeByWord[r.word.ToLower()] = runeGo;
                baseColorByWord[r.word.ToLower()] = r.runeColor;
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

        /// <summary>
        /// Visually highlights concept runes proportional to their simplified softmax attention weight.
        /// Top attended words pulse with scaled HDR emission and display attention percentage badges.
        /// </summary>
        public void HighlightAttentionWeights(List<AttentionWeightEntry> attention)
        {
            if (attention == null || attention.Count == 0)
            {
                ResetAttentionVisuals();
                return;
            }

            isAttentionActive = true;
            currentAttentionWeights.Clear();

            for (int i = 0; i < attention.Count; i++)
            {
                var entry = attention[i];
                string w = entry.word.ToLower();
                currentAttentionWeights[w] = entry.attentionWeight;

                if (runeByWord.TryGetValue(w, out GameObject go) && go != null)
                {
                    var mr = go.GetComponent<MeshRenderer>();
                    Color baseCol = baseColorByWord.TryGetValue(w, out Color c) ? c : Color.cyan;

                    // Scale emission brightness from 0.8x up to 6.5x for top attended word
                    float emissionMultiplier = Mathf.Lerp(0.5f, 5.5f, entry.attentionWeight * 3.5f);
                    if (mr != null)
                    {
                        mr.material.color = baseCol;
                        mr.material.SetColor("_EmissionColor", baseCol * emissionMultiplier);
                    }

                    // Scale physical rune geometry
                    float scaleBoost = Mathf.Lerp(0.65f, 1.35f, entry.attentionWeight * 2.8f);
                    go.transform.localScale = new Vector3(0.7f * scaleBoost, 0.15f * scaleBoost, 0.7f * scaleBoost);

                    // Update Billboard text with real attention percentage
                    var tm = go.GetComponentInChildren<TextMesh>();
                    if (tm != null)
                    {
                        if (entry.attentionWeight >= 0.08f)
                        {
                            tm.text = $"{w.ToUpper()}\n<color=#FBBF24>[α = {(entry.attentionWeight * 100f):F1}%]</color>";
                        }
                        else
                        {
                            tm.text = w.ToUpper();
                        }
                    }
                }
            }
        }

        /// <summary>
        /// Resets all runes to baseline emission, scale, and text labels.
        /// </summary>
        public void ResetAttentionVisuals()
        {
            isAttentionActive = false;
            currentAttentionWeights.Clear();

            foreach (var kvp in runeByWord)
            {
                string w = kvp.Key;
                GameObject go = kvp.Value;
                if (go == null) continue;

                Color baseCol = baseColorByWord.TryGetValue(w, out Color c) ? c : Color.cyan;
                var mr = go.GetComponent<MeshRenderer>();
                if (mr != null)
                {
                    mr.material.color = baseCol;
                    mr.material.SetColor("_EmissionColor", baseCol * 1.6f);
                }

                go.transform.localScale = new Vector3(0.7f, 0.15f, 0.7f);

                var tm = go.GetComponentInChildren<TextMesh>();
                if (tm != null)
                {
                    tm.text = w.ToUpper();
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

                    // If attention is active, add subtle organic pulse based on attention weight
                    if (isAttentionActive)
                    {
                        string w = runeObjects[i].name.Replace("Rune_", "").ToLower();
                        if (currentAttentionWeights.TryGetValue(w, out float alpha) && alpha > 0.12f)
                        {
                            float pulse = Mathf.Sin(Time.time * (3f + alpha * 6f)) * 0.08f * alpha;
                            float baseScale = Mathf.Lerp(0.7f, 1.25f, alpha * 2.5f);
                            runeObjects[i].transform.localScale = new Vector3(baseScale + pulse, 0.15f * baseScale, baseScale + pulse);
                        }
                    }
                }
            }
        }

        private void ClearExisting()
        {
            runeObjects.ForEach(go => { if (go != null) Destroy(go); });
            runeObjects.Clear();
            runeByWord.Clear();
            baseColorByWord.Clear();
            similarityBeams.ForEach(lr => { if (lr != null) Destroy(lr.gameObject); });
            similarityBeams.Clear();
        }
    }
}

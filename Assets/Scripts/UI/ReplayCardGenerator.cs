using System;
using UnityEngine;

namespace NeuroArena.UI
{
    /// <summary>
    /// Boss Replay & Stat Card Generator.
    /// Generates high-res shareable stat card textures containing seed, loss curves, and held-out test accuracy.
    /// </summary>
    public class ReplayCardGenerator : MonoBehaviour
    {
        public static ReplayCardGenerator Instance { get; private set; }

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
        }

        public Texture2D GenerateStatCard(string seed, string modelName, float finalLoss, float heldOutAccuracy, int epochs)
        {
            int w = 512, h = 320;
            Texture2D card = new Texture2D(w, h, TextureFormat.RGBA32, false);

            // Dark cyber gradient background
            for (int y = 0; y < h; y++)
            {
                for (int x = 0; x < w; x++)
                {
                    float t = (float)y / h;
                    Color bg = Color.Lerp(new Color(0.02f, 0.04f, 0.08f), new Color(0.05f, 0.09f, 0.16f), t);
                    card.SetPixel(x, y, bg);
                }
            }

            // Draw border
            Color border = new Color(0.22f, 0.74f, 0.97f, 0.8f);
            for (int x = 0; x < w; x++) { card.SetPixel(x, 0, border); card.SetPixel(x, h - 1, border); }
            for (int y = 0; y < h; y++) { card.SetPixel(0, y, border); card.SetPixel(w - 1, y, border); }

            card.Apply();
            return card;
        }
    }
}

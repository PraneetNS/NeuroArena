using System;
using System.Collections.Generic;
using UnityEngine;
using NeuroArena.ML;

namespace NeuroArena.UI
{
    /// <summary>
    /// Lightweight procedural vector graph renderer for Unity OnGUI/Canvas.
    /// Draws gridlines, dual train/val loss curves, regression scatter/fit,
    /// 2D classification decision boundaries, high-degree polynomial curves,
    /// Decision Tree hierarchy nodes, non-linear MLP decision contours,
    /// 4-way multi-optimizer loss surface trajectories, and Head-to-Head Duel battle meters.
    /// </summary>
    public static class MLGraphVisualizer
    {
        private static Texture2D whitePixel;
        private static Texture2D circleTexture;

        private static void EnsureTextures()
        {
            if (whitePixel == null)
            {
                whitePixel = new Texture2D(1, 1);
                whitePixel.SetPixel(0, 0, Color.white);
                whitePixel.Apply();
            }

            if (circleTexture == null)
            {
                int res = 16;
                circleTexture = new Texture2D(res, res, TextureFormat.RGBA32, false);
                float radius = res * 0.5f;
                for (int y = 0; y < res; y++)
                {
                    for (int x = 0; x < res; x++)
                    {
                        float dist = Vector2.Distance(new Vector2(x + 0.5f, y + 0.5f), new Vector2(radius, radius));
                        float alpha = Mathf.Clamp01((radius - dist) + 0.5f);
                        circleTexture.SetPixel(x, y, new Color(1f, 1f, 1f, alpha));
                    }
                }
                circleTexture.Apply();
            }
        }

        public static void DrawLine(Vector2 start, Vector2 end, Color color, float width)
        {
            EnsureTextures();
            Vector2 d = end - start;
            float angle = Mathf.Rad2Deg * Mathf.Atan2(d.y, d.x);
            float length = d.magnitude;

            GUIUtility.RotateAroundPivot(angle, start);
            Color prevColor = GUI.color;
            GUI.color = color;
            GUI.DrawTexture(new Rect(start.x, start.y - width * 0.5f, length, width), whitePixel);
            GUI.color = prevColor;
            GUIUtility.RotateAroundPivot(-angle, start);
        }

        public static void DrawCircle(Vector2 center, float radius, Color color)
        {
            EnsureTextures();
            Color prevColor = GUI.color;
            GUI.color = color;
            GUI.DrawTexture(new Rect(center.x - radius, center.y - radius, radius * 2f, radius * 2f), circleTexture);
            GUI.color = prevColor;
        }

        public static void DrawSquare(Vector2 center, float size, Color color)
        {
            EnsureTextures();
            Color prevColor = GUI.color;
            GUI.color = color;
            GUI.DrawTexture(new Rect(center.x - size * 0.5f, center.y - size * 0.5f, size, size), whitePixel);
            GUI.color = prevColor;
        }

        public static void DrawLossCurve(Rect rect, List<float> lossHistory, int maxEpochs, float thresholdLoss, GUIStyle labelStyle, string lossName = "MSE")
        {
            EnsureTextures();
            Color bg = new Color(0.04f, 0.06f, 0.09f, 0.95f);
            Color prev = GUI.color;
            GUI.color = bg;
            GUI.DrawTexture(rect, whitePixel);
            GUI.color = prev;

            GUI.Label(new Rect(rect.x + 8, rect.y + 4, rect.width - 16, 20), $"<b>📉 {lossName.ToUpper()} LOSS J(θ)</b>", labelStyle);

            float padL = 36f, padR = 12f, padT = 28f, padB = 22f;
            Rect plotArea = new Rect(rect.x + padL, rect.y + padT, rect.width - padL - padR, rect.height - padT - padB);

            if (lossHistory == null || lossHistory.Count == 0) return;

            float maxLoss = 1.0f;
            for (int i = 0; i < lossHistory.Count; i++) if (lossHistory[i] > maxLoss && !float.IsNaN(lossHistory[i])) maxLoss = lossHistory[i];
            maxLoss = Mathf.Max(maxLoss * 1.1f, 0.1f);

            int count = lossHistory.Count;
            int totalExpected = Mathf.Max(maxEpochs, count);

            Vector2 prevPoint = Vector2.zero;
            for (int i = 0; i < count; i++)
            {
                float tX = (float)i / (totalExpected - 1);
                float val = Mathf.Clamp(lossHistory[i], 0f, maxLoss);
                float tY = val / maxLoss;
                Vector2 currentPoint = new Vector2(plotArea.x + tX * plotArea.width, plotArea.yMax - tY * plotArea.height);

                if (i > 0) DrawLine(prevPoint, currentPoint, new Color(1f, 0.65f, 0.2f), 2.2f);
                prevPoint = currentPoint;
            }
        }

        public static void DrawDualLossCurve(Rect rect, List<float> trainLossHistory, List<float> valLossHistory, int maxEpochs, float thresholdLoss, GUIStyle labelStyle)
        {
            EnsureTextures();
            Color bg = new Color(0.04f, 0.06f, 0.09f, 0.95f);
            Color prev = GUI.color;
            GUI.color = bg;
            GUI.DrawTexture(rect, whitePixel);
            GUI.color = prev;

            GUI.Label(new Rect(rect.x + 8, rect.y + 4, rect.width - 16, 20), "<b>📉 <color=#FFAA33>TRAIN LOSS</color> vs. <color=#FF3399>VAL LOSS</color></b>", labelStyle);

            float padL = 36f, padR = 12f, padT = 28f, padB = 22f;
            Rect plotArea = new Rect(rect.x + padL, rect.y + padT, rect.width - padL - padR, rect.height - padT - padB);

            if (trainLossHistory == null || trainLossHistory.Count == 0) return;

            float maxLoss = 0.5f;
            for (int i = 0; i < trainLossHistory.Count; i++) if (trainLossHistory[i] > maxLoss) maxLoss = trainLossHistory[i];
            for (int i = 0; i < valLossHistory.Count; i++) if (valLossHistory[i] > maxLoss) maxLoss = valLossHistory[i];
            maxLoss = Mathf.Max(maxLoss * 1.15f, 0.2f);

            int count = trainLossHistory.Count;
            int totalExpected = Mathf.Max(maxEpochs, count);

            Vector2 prevTrain = Vector2.zero;
            for (int i = 0; i < count; i++)
            {
                float tX = (float)i / (totalExpected - 1);
                float val = Mathf.Clamp(trainLossHistory[i], 0f, maxLoss);
                float tY = val / maxLoss;
                Vector2 pt = new Vector2(plotArea.x + tX * plotArea.width, plotArea.yMax - tY * plotArea.height);
                if (i > 0) DrawLine(prevTrain, pt, new Color(1f, 0.65f, 0.2f), 2.2f);
                prevTrain = pt;
            }

            Vector2 prevVal = Vector2.zero;
            for (int i = 0; i < valLossHistory.Count; i++)
            {
                float tX = (float)i / (totalExpected - 1);
                float val = Mathf.Clamp(valLossHistory[i], 0f, maxLoss);
                float tY = val / maxLoss;
                Vector2 pt = new Vector2(plotArea.x + tX * plotArea.width, plotArea.yMax - tY * plotArea.height);
                if (i > 0) DrawLine(prevVal, pt, new Color(1f, 0.2f, 0.6f), 2.5f);
                prevVal = pt;
            }
        }

        public static void DrawScatterAndFittedLine(Rect rect, float[] X, float[] Y, float currentW, float currentB, GUIStyle labelStyle)
        {
            EnsureTextures();
            Color bg = new Color(0.04f, 0.06f, 0.09f, 0.95f);
            Color prev = GUI.color;
            GUI.color = bg;
            GUI.DrawTexture(rect, whitePixel);
            GUI.color = prev;

            GUI.Label(new Rect(rect.x + 8, rect.y + 4, rect.width - 16, 20), $"<b>📊 LINEAR REGRESSION (ŷ = {currentW:+0.00;-0.00}x {currentB:+0.00;-0.00})</b>", labelStyle);

            float padL = 36f, padR = 14f, padT = 28f, padB = 22f;
            Rect plotArea = new Rect(rect.x + padL, rect.y + padT, rect.width - padL - padR, rect.height - padT - padB);

            if (X == null || Y == null || X.Length == 0) return;

            float minX = -6f, maxX = 6f, minY = -15f, maxY = 15f;
            for (int i = 0; i < X.Length; i++)
            {
                float normX = Mathf.InverseLerp(minX, maxX, X[i]);
                float normY = Mathf.InverseLerp(minY, maxY, Y[i]);
                DrawCircle(new Vector2(plotArea.x + normX * plotArea.width, plotArea.yMax - normY * plotArea.height), 4.5f, new Color(0.2f, 0.9f, 1f, 0.85f));
            }

            Vector2 p1 = new Vector2(plotArea.x, plotArea.yMax - Mathf.InverseLerp(minY, maxY, currentW * minX + currentB) * plotArea.height);
            Vector2 p2 = new Vector2(plotArea.xMax, plotArea.yMax - Mathf.InverseLerp(minY, maxY, currentW * maxX + currentB) * plotArea.height);
            DrawLine(p1, p2, new Color(0.3f, 1f, 0.45f, 0.95f), 2.8f);
        }

        public static void DrawClassificationScatterAndBoundary(Rect rect, float[] X1, float[] X2, float[] Y, float w1, float w2, float b, GUIStyle labelStyle)
        {
            EnsureTextures();
            Color bg = new Color(0.04f, 0.06f, 0.09f, 0.95f);
            Color prev = GUI.color;
            GUI.color = bg;
            GUI.DrawTexture(rect, whitePixel);
            GUI.color = prev;

            GUI.Label(new Rect(rect.x + 8, rect.y + 4, rect.width - 16, 20), $"<b>⚡ DECISION BOUNDARY ({w1:+0.00;-0.00}x₁ {w2:+0.00;-0.00}x₂ {b:+0.00;-0.00} = 0)</b>", labelStyle);

            float padL = 36f, padR = 14f, padT = 28f, padB = 22f;
            Rect plotArea = new Rect(rect.x + padL, rect.y + padT, rect.width - padL - padR, rect.height - padT - padB);

            if (X1 == null || X2 == null || Y == null || X1.Length == 0) return;

            float minX = -6f, maxX = 6f, minY = -6f, maxY = 6f;
            for (int i = 0; i < X1.Length; i++)
            {
                float normX = Mathf.InverseLerp(minX, maxX, X1[i]);
                float normY = Mathf.InverseLerp(minY, maxY, X2[i]);
                Vector2 pos = new Vector2(plotArea.x + normX * plotArea.width, plotArea.yMax - normY * plotArea.height);

                if (Y[i] > 0.5f) DrawCircle(pos, 5f, new Color(0.15f, 0.85f, 1f, 0.95f));
                else DrawSquare(pos, 9f, new Color(0.85f, 0.2f, 0.95f, 0.95f));
            }

            if (Mathf.Abs(w2) > 1e-4f)
            {
                Vector2 p1 = new Vector2(plotArea.x, plotArea.yMax - Mathf.InverseLerp(minY, maxY, -(w1 * minX + b) / w2) * plotArea.height);
                Vector2 p2 = new Vector2(plotArea.xMax, plotArea.yMax - Mathf.InverseLerp(minY, maxY, -(w1 * maxX + b) / w2) * plotArea.height);
                DrawLine(p1, p2, new Color(0.2f, 1f, 0.5f, 0.95f), 3.2f);
            }
        }

        public static void DrawPolynomialScatterAndCurve(Rect rect, float[] xTrain, float[] yTrain, float[] xVal, float[] yVal, float[] weights, float bias, int degree, GUIStyle labelStyle)
        {
            EnsureTextures();
            Color bg = new Color(0.04f, 0.06f, 0.09f, 0.95f);
            Color prev = GUI.color;
            GUI.color = bg;
            GUI.DrawTexture(rect, whitePixel);
            GUI.color = prev;

            GUI.Label(new Rect(rect.x + 8, rect.y + 4, rect.width - 16, 20), $"<b>❄️ POLYNOMIAL FIT (d = {degree}) [<color=#22d3ee>TRAIN</color> / <color=#fbbf24>VAL</color>]</b>", labelStyle);

            float padL = 36f, padR = 14f, padT = 28f, padB = 22f;
            Rect plotArea = new Rect(rect.x + padL, rect.y + padT, rect.width - padL - padR, rect.height - padT - padB);

            float minX = -4.5f, maxX = 4.5f, minY = -3.5f, maxY = 3.5f;

            if (xTrain != null && yTrain != null)
            {
                for (int i = 0; i < xTrain.Length; i++)
                {
                    float nx = Mathf.InverseLerp(minX, maxX, xTrain[i]);
                    float ny = Mathf.InverseLerp(minY, maxY, yTrain[i]);
                    DrawCircle(new Vector2(plotArea.x + nx * plotArea.width, plotArea.yMax - ny * plotArea.height), 4f, new Color(0.2f, 0.85f, 1f, 0.85f));
                }
            }

            if (xVal != null && yVal != null)
            {
                for (int i = 0; i < xVal.Length; i++)
                {
                    float nx = Mathf.InverseLerp(minX, maxX, xVal[i]);
                    float ny = Mathf.InverseLerp(minY, maxY, yVal[i]);
                    DrawSquare(new Vector2(plotArea.x + nx * plotArea.width, plotArea.yMax - ny * plotArea.height), 8f, new Color(1f, 0.8f, 0.2f, 0.95f));
                }
            }

            if (weights != null && weights.Length > 0)
            {
                int steps = 60;
                Vector2 prevPt = Vector2.zero;
                for (int i = 0; i <= steps; i++)
                {
                    float x = Mathf.Lerp(minX, maxX, (float)i / steps);
                    float yHat = bias;
                    for (int j = 0; j < weights.Length; j++) yHat += weights[j] * Mathf.Pow(x * 0.4f, j + 1);

                    float nx = Mathf.InverseLerp(minX, maxX, x);
                    float ny = Mathf.InverseLerp(minY, maxY, yHat);
                    Vector2 pt = new Vector2(plotArea.x + nx * plotArea.width, plotArea.yMax - ny * plotArea.height);
                    if (i > 0) DrawLine(prevPt, pt, new Color(0.3f, 1f, 0.5f), 2.5f);
                    prevPt = pt;
                }
            }
        }

        public static void DrawDecisionTree2DRegions(Rect rect, float[][] X, int[] Y, DecisionTreeNode root, GUIStyle labelStyle)
        {
            EnsureTextures();
            Color bg = new Color(0.04f, 0.06f, 0.09f, 0.95f);
            Color prev = GUI.color;
            GUI.color = bg;
            GUI.DrawTexture(rect, whitePixel);
            GUI.color = prev;

            GUI.Label(new Rect(rect.x + 8, rect.y + 4, rect.width - 16, 20), "<b>🌿 DECISION TREE PARTITIONS [AXIS SPLITS]</b>", labelStyle);

            float padL = 36f, padR = 14f, padT = 28f, padB = 22f;
            Rect plotArea = new Rect(rect.x + padL, rect.y + padT, rect.width - padL - padR, rect.height - padT - padB);

            if (root != null)
            {
                int gridRes = 16;
                float w = plotArea.width / gridRes;
                float h = plotArea.height / gridRes;

                for (int gy = 0; gy < gridRes; gy++)
                {
                    for (int gx = 0; gx < gridRes; gx++)
                    {
                        float x1 = Mathf.Lerp(-5f, 5f, (float)gx / (gridRes - 1));
                        float x2 = Mathf.Lerp(-5f, 5f, (float)gy / (gridRes - 1));
                        int pred = root.Predict(new float[] { x1, x2 });

                        Color tileCol = pred == 0 ? new Color(0.1f, 0.4f, 0.5f, 0.35f) : (pred == 1 ? new Color(0.5f, 0.1f, 0.5f, 0.35f) : new Color(0.5f, 0.4f, 0.1f, 0.35f));
                        GUI.color = tileCol;
                        GUI.DrawTexture(new Rect(plotArea.x + gx * w, plotArea.yMax - (gy + 1) * h, w, h), whitePixel);
                    }
                }
                GUI.color = prev;
            }

            if (X != null && Y != null)
            {
                for (int i = 0; i < X.Length; i++)
                {
                    float nx = Mathf.InverseLerp(-5f, 5f, X[i][0]);
                    float ny = Mathf.InverseLerp(-5f, 5f, X[i][1]);
                    Vector2 pos = new Vector2(plotArea.x + nx * plotArea.width, plotArea.yMax - ny * plotArea.height);
                    int c = Y[i];
                    Color ptCol = c == 0 ? new Color(0.2f, 0.9f, 1f) : (c == 1 ? new Color(0.85f, 0.2f, 0.95f) : new Color(1f, 0.8f, 0.2f));
                    DrawCircle(pos, 4.5f, ptCol);
                }
            }
        }

        public static void DrawTreeHierarchyGraph(Rect rect, DecisionTreeNode root, Action<int> onTogglePrune, GUIStyle labelStyle)
        {
            EnsureTextures();
            Color bg = new Color(0.04f, 0.06f, 0.09f, 0.95f);
            Color prev = GUI.color;
            GUI.color = bg;
            GUI.DrawTexture(rect, whitePixel);
            GUI.color = prev;

            GUI.Label(new Rect(rect.x + 8, rect.y + 4, rect.width - 16, 20), "<b>🌲 TREE STRUCTURE & INTERACTIVE PRUNING</b>", labelStyle);
            if (root == null) return;

            DrawNodeRecursive(rect, root, rect.x + rect.width * 0.5f, rect.y + 40, rect.width * 0.24f, 1, onTogglePrune, labelStyle);
        }

        private static void DrawNodeRecursive(Rect fullRect, DecisionTreeNode node, float cx, float cy, float xOffset, int depth, Action<int> onTogglePrune, GUIStyle labelStyle)
        {
            if (node == null || depth > 3) return;

            float boxW = 82f, boxH = 34f;
            Rect boxRect = new Rect(cx - boxW * 0.5f, cy, boxW, boxH);

            Color boxBg = node.isPruned ? new Color(0.35f, 0.2f, 0.2f, 0.9f) : (node.isLeaf ? new Color(0.12f, 0.35f, 0.2f, 0.9f) : new Color(0.15f, 0.22f, 0.32f, 0.9f));
            Color prev = GUI.color;
            GUI.color = boxBg;
            GUI.DrawTexture(boxRect, whitePixel);
            GUI.color = prev;

            string title = node.isLeaf ? $"Leaf (C={node.predictedClass})" : $"x{node.splitFeatureIndex + 1} ≤ {node.threshold:F1}";
            if (node.isPruned) title = "✂️ Pruned Leaf";

            GUI.Label(new Rect(boxRect.x + 2, boxRect.y + 2, boxRect.width - 4, 16), $"<b>{title}</b>", labelStyle);
            GUI.Label(new Rect(boxRect.x + 2, boxRect.y + 16, boxRect.width - 4, 14), $"N={node.samplesCount} Imp={node.impurity:F2}", labelStyle);

            if (!node.isLeaf)
            {
                Rect btnRect = new Rect(boxRect.xMax - 22, boxRect.y - 4, 24, 18);
                string btnText = node.isPruned ? "↺" : "✂️";
                if (GUI.Button(btnRect, btnText)) onTogglePrune?.Invoke(node.nodeId);
            }

            if (node.isLeaf || node.isPruned || node.leftChild == null || node.rightChild == null) return;

            float childY = cy + 46;
            float leftX = cx - xOffset;
            float rightX = cx + xOffset;

            DrawLine(new Vector2(cx, cy + boxH), new Vector2(leftX, childY), new Color(0.2f, 0.8f, 0.9f, 0.6f), 1.5f);
            DrawLine(new Vector2(cx, cy + boxH), new Vector2(rightX, childY), new Color(0.2f, 0.8f, 0.9f, 0.6f), 1.5f);

            DrawNodeRecursive(fullRect, node.leftChild, leftX, childY, xOffset * 0.52f, depth + 1, onTogglePrune, labelStyle);
            DrawNodeRecursive(fullRect, node.rightChild, rightX, childY, xOffset * 0.52f, depth + 1, onTogglePrune, labelStyle);
        }

        public static void DrawMLPDecisionContour(Rect rect, float[][] X, int[] Y, float[][] W1, float[] b1, float[] W2, float b2, bool useTanh, GUIStyle labelStyle)
        {
            EnsureTextures();
            Color bg = new Color(0.04f, 0.06f, 0.09f, 0.95f);
            Color prev = GUI.color;
            GUI.color = bg;
            GUI.DrawTexture(rect, whitePixel);
            GUI.color = prev;

            GUI.Label(new Rect(rect.x + 8, rect.y + 4, rect.width - 16, 20), "<b>🧠 NON-LINEAR XOR DECISION CONTOUR [2-LAYER MLP]</b>", labelStyle);

            float padL = 36f, padR = 14f, padT = 28f, padB = 22f;
            Rect plotArea = new Rect(rect.x + padL, rect.y + padT, rect.width - padL - padR, rect.height - padT - padB);

            if (W1 != null && W2 != null)
            {
                int res = 18;
                float w = plotArea.width / res, h = plotArea.height / res;

                for (int gy = 0; gy < res; gy++)
                {
                    for (int gx = 0; gx < res; gx++)
                    {
                        float x1 = Mathf.Lerp(-4.5f, 4.5f, (float)gx / (res - 1));
                        float x2 = Mathf.Lerp(-4.5f, 4.5f, (float)gy / (res - 1));

                        float prob = NeuralNetworkTrainer.PredictSingle(new float[] { x1, x2 }, W1, b1, W2, b2, useTanh);
                        Color tileCol = prob >= 0.5f ? new Color(0.1f, 0.7f, 1f, Mathf.Clamp01(prob * 0.45f)) : new Color(0.8f, 0.2f, 0.9f, Mathf.Clamp01((1f - prob) * 0.45f));

                        GUI.color = tileCol;
                        GUI.DrawTexture(new Rect(plotArea.x + gx * w, plotArea.yMax - (gy + 1) * h, w, h), whitePixel);
                    }
                }
                GUI.color = prev;
            }

            if (X != null && Y != null)
            {
                for (int i = 0; i < X.Length; i++)
                {
                    float nx = Mathf.InverseLerp(-4.5f, 4.5f, X[i][0]);
                    float ny = Mathf.InverseLerp(-4.5f, 4.5f, X[i][1]);
                    Vector2 pos = new Vector2(plotArea.x + nx * plotArea.width, plotArea.yMax - ny * plotArea.height);

                    if (Y[i] == 1) DrawCircle(pos, 5.5f, new Color(0.2f, 0.95f, 1f, 0.95f));
                    else DrawSquare(pos, 9f, new Color(0.9f, 0.2f, 0.95f, 0.95f));
                }
            }
        }

        public static void Draw4WayOptimizerRace(Rect rect, Dictionary<OptimizerType, OptimizerRaceResult> results, int maxEpochs, GUIStyle labelStyle)
        {
            EnsureTextures();
            Color bg = new Color(0.04f, 0.06f, 0.09f, 0.95f);
            Color prev = GUI.color;
            GUI.color = bg;
            GUI.DrawTexture(rect, whitePixel);
            GUI.color = prev;

            GUI.Label(new Rect(rect.x + 8, rect.y + 4, rect.width - 16, 20), "<b>🏁 4-WAY OPTIMIZER GRAND PRIX [<color=#F43F5E>SGD</color> | <color=#FB923C>MOM</color> | <color=#38BDF8>RMS</color> | <color=#4ADE80>ADAM</color>]</b>", labelStyle);

            float padL = 36f, padR = 14f, padT = 28f, padB = 22f;
            Rect plotArea = new Rect(rect.x + padL, rect.y + padT, rect.width - padL - padR, rect.height - padT - padB);

            if (results == null || results.Count == 0) return;

            float maxLoss = 15.0f;
            foreach (var kvp in results)
            {
                if (kvp.Value.lossHistory != null && kvp.Value.lossHistory.Length > 0)
                {
                    if (kvp.Value.lossHistory[0] > maxLoss) maxLoss = kvp.Value.lossHistory[0];
                }
            }
            maxLoss = Mathf.Max(maxLoss * 1.1f, 1.0f);

            foreach (var kvp in results)
            {
                var res = kvp.Value;
                if (res.lossHistory == null || res.lossHistory.Length == 0) continue;

                Vector2 prevPoint = Vector2.zero;
                for (int i = 0; i < res.lossHistory.Length; i++)
                {
                    float tX = (float)i / (maxEpochs - 1);
                    float val = Mathf.Clamp(res.lossHistory[i], 0f, maxLoss);
                    float tY = val / maxLoss;
                    Vector2 currentPoint = new Vector2(plotArea.x + tX * plotArea.width, plotArea.yMax - tY * plotArea.height);

                    if (i > 0) DrawLine(prevPoint, currentPoint, res.color, 2.4f);
                    prevPoint = currentPoint;
                }
            }
        }

        public static void Draw2DLossContourTrajectory(Rect rect, Dictionary<OptimizerType, OptimizerRaceResult> results, GUIStyle labelStyle)
        {
            EnsureTextures();
            Color bg = new Color(0.04f, 0.06f, 0.09f, 0.95f);
            Color prev = GUI.color;
            GUI.color = bg;
            GUI.DrawTexture(rect, whitePixel);
            GUI.color = prev;

            GUI.Label(new Rect(rect.x + 8, rect.y + 4, rect.width - 16, 20), "<b>⚡ ANISOTROPIC RAVINE TRAJECTORIES [w₁, w₂]</b>", labelStyle);

            float padL = 36f, padR = 14f, padT = 28f, padB = 22f;
            Rect plotArea = new Rect(rect.x + padL, rect.y + padT, rect.width - padL - padR, rect.height - padT - padB);

            Vector2 center = new Vector2(plotArea.x + plotArea.width * 0.5f, plotArea.y + plotArea.height * 0.5f);
            Color contourCol = new Color(0.2f, 0.35f, 0.45f, 0.5f);

            for (int r = 1; r <= 5; r++)
            {
                float rx = (plotArea.width * 0.16f) * r;
                float ry = (plotArea.height * 0.08f) * r;
                int pts = 24;
                Vector2 prevRingPt = Vector2.zero;
                for (int i = 0; i <= pts; i++)
                {
                    float rad = (float)i / pts * Mathf.PI * 2f;
                    Vector2 ringPt = new Vector2(center.x + Mathf.Cos(rad) * rx, center.y + Mathf.Sin(rad) * ry);
                    if (i > 0) DrawLine(prevRingPt, ringPt, contourCol, 1.2f);
                    prevRingPt = ringPt;
                }
            }

            if (results != null)
            {
                foreach (var kvp in results)
                {
                    var res = kvp.Value;
                    if (res.trajectory == null || res.trajectory.Count == 0) continue;

                    Vector2 prevPt = Vector2.zero;
                    for (int i = 0; i < res.trajectory.Count; i++)
                    {
                        Vector2 w = res.trajectory[i];
                        float nx = Mathf.InverseLerp(-4.5f, 4.5f, w.x);
                        float ny = Mathf.InverseLerp(-4.5f, 4.5f, w.y);
                        Vector2 pt = new Vector2(plotArea.x + nx * plotArea.width, plotArea.yMax - ny * plotArea.height);

                        if (i > 0) DrawLine(prevPt, pt, res.color, 2.6f);
                        prevPt = pt;
                    }
                    if (prevPt != Vector2.zero) DrawCircle(prevPt, 4.5f, res.color);
                }
            }
        }

        /// <summary>
        /// Draws Head-to-Head Duel Battle Meters (Player vs Ghost Rival on Held-Out Test Set).
        /// </summary>
        public static void DrawHeadToHeadDuelBattle(Rect rect, DuelMatchResult duel, GUIStyle labelStyle)
        {
            EnsureTextures();
            Color bg = new Color(0.04f, 0.06f, 0.09f, 0.95f);
            Color prev = GUI.color;
            GUI.color = bg;
            GUI.DrawTexture(rect, whitePixel);
            GUI.color = prev;

            GUI.Label(new Rect(rect.x + 8, rect.y + 4, rect.width - 16, 20), "<b>⚔️ ASYNC DUEL: HELD-OUT TEST EVALUATION</b>", labelStyle);

            float padL = 20f, padT = 32f, barW = rect.width - 40f, barH = 26f;

            // Player Bar
            GUI.Label(new Rect(rect.x + padL, rect.y + padT, barW, 18), $"<b>YOU ({duel.playerModelName}):</b> {duel.playerTestAccuracy:F1}% ({duel.playerPoints}/{duel.totalTestSamples})", labelStyle);
            Rect pBar = new Rect(rect.x + padL, rect.y + padT + 20, barW, barH);
            GUI.color = new Color(0.1f, 0.18f, 0.25f);
            GUI.DrawTexture(pBar, whitePixel);
            GUI.color = new Color(0.2f, 0.9f, 1.0f);
            GUI.DrawTexture(new Rect(pBar.x, pBar.y, pBar.width * Mathf.Clamp01(duel.playerTestAccuracy / 100f), pBar.height), whitePixel);

            // Ghost Rival Bar
            float gTop = padT + 58;
            GUI.color = Color.white;
            GUI.Label(new Rect(rect.x + padL, rect.y + gTop, barW, 18), $"<b>RIVAL ({duel.ghostRivalName}):</b> {duel.ghostTestAccuracy:F1}% ({duel.ghostPoints}/{duel.totalTestSamples})", labelStyle);
            Rect gBar = new Rect(rect.x + padL, rect.y + gTop + 20, barW, barH);
            GUI.color = new Color(0.1f, 0.18f, 0.25f);
            GUI.DrawTexture(gBar, whitePixel);
            GUI.color = new Color(0.95f, 0.35f, 0.35f);
            GUI.DrawTexture(new Rect(gBar.x, gBar.y, gBar.width * Mathf.Clamp01(duel.ghostTestAccuracy / 100f), gBar.height), whitePixel);
            GUI.color = prev;

            // Winner Stamp
            string verdict = duel.isPlayerVictory ? "<color=#4ADE80><b>VICTORY! HIGHER GENERALIZATION!</b></color>" : "<color=#F43F5E><b>DEFEAT! RIVAL GENERALIZED BETTER!</b></color>";
            GUI.Label(new Rect(rect.x + padL, rect.y + gTop + 54, barW, 20), verdict, labelStyle);
        }

        public static void DrawEmbeddingVectorSpace2D(Rect rect, List<ConceptRune> runes, GUIStyle labelStyle)
        {
            EnsureTextures();
            Color bg = new Color(0.04f, 0.06f, 0.09f, 0.95f);
            Color prev = GUI.color;
            GUI.color = bg;
            GUI.DrawTexture(rect, whitePixel);
            GUI.color = prev;

            GUI.Label(new Rect(rect.x + 8, rect.y + 4, rect.width - 16, 20), "<b>🌌 2D EMBEDDING VECTOR SPACE [PCA / PPMI]</b>", labelStyle);

            float padL = 25f, padR = 15f, padT = 28f, padB = 22f;
            Rect plotArea = new Rect(rect.x + padL, rect.y + padT, rect.width - padL - padR, rect.height - padT - padB);

            if (runes == null || runes.Count == 0) return;

            for (int i = 0; i < runes.Count; i++)
            {
                var r = runes[i];
                float nx = Mathf.InverseLerp(-10f, 10f, r.spatialPos3D.x);
                float ny = Mathf.InverseLerp(-10f, 10f, r.spatialPos3D.z);
                Vector2 pos = new Vector2(plotArea.x + nx * plotArea.width, plotArea.yMax - ny * plotArea.height);

                DrawCircle(pos, 5.5f, r.runeColor);
                GUI.color = r.runeColor;
                GUI.Label(new Rect(pos.x + 6, pos.y - 8, 70, 16), r.word, labelStyle);
                GUI.color = prev;
            }
        }

        public static void DrawCosineSimilarityHeatmap(Rect rect, List<ConceptRune> runes, GUIStyle labelStyle)
        {
            EnsureTextures();
            Color bg = new Color(0.04f, 0.06f, 0.09f, 0.95f);
            Color prev = GUI.color;
            GUI.color = bg;
            GUI.DrawTexture(rect, whitePixel);
            GUI.color = prev;

            GUI.Label(new Rect(rect.x + 8, rect.y + 4, rect.width - 16, 20), "<b>🧬 PAIRWISE COSINE SIMILARITY HEATMAP</b>", labelStyle);

            float padL = 36f, padR = 14f, padT = 28f, padB = 22f;
            Rect plotArea = new Rect(rect.x + padL, rect.y + padT, rect.width - padL - padR, rect.height - padT - padB);

            if (runes == null || runes.Count == 0) return;

            int n = Mathf.Min(runes.Count, 12);
            float cellW = plotArea.width / n;
            float cellH = plotArea.height / n;

            for (int i = 0; i < n; i++)
            {
                for (int j = 0; j < n; j++)
                {
                    float sim = VectorEmbeddingEngine.CosineSimilarity(runes[i].embeddingVector, runes[j].embeddingVector);
                    Color cellCol = Color.Lerp(new Color(0.05f, 0.1f, 0.18f), new Color(0.2f, 0.9f, 0.5f), Mathf.Clamp01(sim));
                    GUI.color = cellCol;
                    GUI.DrawTexture(new Rect(plotArea.x + j * cellW, plotArea.y + i * cellH, cellW - 1, cellH - 1), whitePixel);
                }
            }
            GUI.color = prev;
        }
    }
}

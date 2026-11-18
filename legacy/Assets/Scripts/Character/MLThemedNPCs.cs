using System.Collections.Generic;
using UnityEngine;
using NeuroArena.Environment;

namespace NeuroArena.Character
{
    /// <summary>
    /// Manages the named cast of ML-themed NPCs and companions:
    /// - ADA: Floating truncated polyhedron companion drone with pulsing aperture eye
    /// - The Archivist: Stacked manuscript tome golem at the Codex Library
    /// - The 4 Optimizer Smiths: SGD (jitter/overshoot), Momentum (heavy follow-through), RMSprop (adaptive oscillation), Adam (adaptive dual-momentum smoothing)
    /// - Ghost Rivals: Translucent holographic wireframe avatar representations
    /// </summary>
    public class MLThemedNPCs : MonoBehaviour
    {
        [Header("ADA Companion Settings")]
        public Transform playerTransform;
        public Vector3 adaFollowOffset = new Vector3(1.2f, 1.35f, -0.9f);
        public float adaSmoothSpeed = 5f;
        private GameObject adaDroneObj;
        private Transform adaEyeTransform;
        private Material adaEyeMaterial;
        private Material adaBodyMaterial;

        [Header("Archivist Golem Settings")]
        private GameObject archivistObj;
        private Transform archivistHeadTransform;

        [Header("Optimizer Smiths (Arena)")]
        private List<OptimizerSmithInstance> smiths = new List<OptimizerSmithInstance>();

        [Header("Ghost Rivals")]
        private List<GameObject> ghostRivals = new List<GameObject>();

        private struct OptimizerSmithInstance
        {
            public string name;
            public GameObject root;
            public Vector3 homePos;
            public float velocity;
            public float momentumVal;
            public float variance;
            public float phase;
        }

        private void Start()
        {
            SpawnAdaCompanion();
            SpawnArchivistGolem();
            SpawnOptimizerSmiths();
            SpawnGhostRivals();
        }

        #region ADA Companion Drone
        private void SpawnAdaCompanion()
        {
            if (adaDroneObj != null) return;

            adaDroneObj = new GameObject("ADA_CompanionDrone");
            if (playerTransform != null)
            {
                adaDroneObj.transform.position = playerTransform.position + adaFollowOffset;
            }

            // 1. Faceted Outer Shell
            GameObject shell = new GameObject("PolyhedronShell");
            shell.transform.SetParent(adaDroneObj.transform, false);
            var mf = shell.AddComponent<MeshFilter>();
            mf.sharedMesh = StylizedLowPolyMeshes.CreateAdaDroneMesh(0.32f);
            var mr = shell.AddComponent<MeshRenderer>();
            adaBodyMaterial = StylizedMaterialFactory.CreatePBRMaterial(new Color(0.12f, 0.20f, 0.28f), 0.35f, 0.85f);
            mr.sharedMaterial = adaBodyMaterial;

            // 2. Central Cycloptic Aperture Eye
            GameObject eye = new GameObject("ApertureEye");
            eye.transform.SetParent(adaDroneObj.transform, false);
            eye.transform.localPosition = new Vector3(0f, 0f, 0.22f);
            var eyeMf = eye.AddComponent<MeshFilter>();
            eyeMf.sharedMesh = StylizedLowPolyMeshes.CreateShardMesh(0.14f);
            var eyeMr = eye.AddComponent<MeshRenderer>();
            adaEyeMaterial = StylizedMaterialFactory.CreateEmissiveMaterial(new Color(0.13f, 0.77f, 0.95f), new Color(0.02f, 0.52f, 0.78f), 2.2f);
            eyeMr.sharedMaterial = adaEyeMaterial;
            adaEyeTransform = eye.transform;

            // 3. Orbiting Halo Ring
            GameObject halo = new GameObject("OrbitRing");
            halo.transform.SetParent(adaDroneObj.transform, false);
            var haloMf = halo.AddComponent<MeshFilter>();
            haloMf.sharedMesh = StylizedLowPolyMeshes.CreateOctagonalPlatformMesh(0.48f, 0.04f);
            var haloMr = halo.AddComponent<MeshRenderer>();
            haloMr.sharedMaterial = StylizedMaterialFactory.CreateEmissiveMaterial(new Color(0.98f, 0.80f, 0.08f), new Color(0.96f, 0.62f, 0.04f), 1.8f);
        }

        public void UpdateBiomeColor(Color biomePrimary)
        {
            if (adaEyeMaterial != null)
            {
                adaEyeMaterial.SetColor("_EmissionColor", biomePrimary * 2.2f);
            }
        }
        #endregion

        #region The Archivist Golem
        private void SpawnArchivistGolem()
        {
            if (archivistObj != null) return;

            archivistObj = new GameObject("The_Archivist_NPC");
            archivistObj.transform.position = new Vector3(18f, 0.2f, 18f); // Near Codex Station

            // Golem Torso (Stacked Tomes)
            GameObject body = new GameObject("TomeBody");
            body.transform.SetParent(archivistObj.transform, false);
            var mf = body.AddComponent<MeshFilter>();
            mf.sharedMesh = StylizedLowPolyMeshes.CreateArchivistGolemMesh(1.1f);
            var mr = body.AddComponent<MeshRenderer>();
            mr.sharedMaterial = StylizedMaterialFactory.CreatePBRMaterial(new Color(0.22f, 0.26f, 0.32f), 0.85f, 0.2f);

            // Floating Head Rune
            GameObject head = new GameObject("RunicHead");
            head.transform.SetParent(archivistObj.transform, false);
            head.transform.localPosition = new Vector3(0f, 1.65f, 0f);
            var headMf = head.AddComponent<MeshFilter>();
            headMf.sharedMesh = StylizedLowPolyMeshes.CreateRuneTabletMesh(0.55f);
            var headMr = head.AddComponent<MeshRenderer>();
            headMr.sharedMaterial = StylizedMaterialFactory.CreateEmissiveMaterial(new Color(0.22f, 0.83f, 0.93f), new Color(0.03f, 0.57f, 0.70f), 2.5f);
            archivistHeadTransform = head.transform;
        }
        #endregion

        #region The 4 Optimizer Smiths
        private void SpawnOptimizerSmiths()
        {
            string[] names = new string[] { "SGD", "Momentum", "RMSprop", "Adam" };
            Vector3[] positions = new Vector3[]
            {
                new Vector3(8f, 0.2f, 22f),  // SGD: Jittery
                new Vector3(12f, 0.2f, 25f), // Momentum: Heavy rolling
                new Vector3(16f, 0.2f, 25f), // RMSprop: Adaptive spring
                new Vector3(20f, 0.2f, 22f)  // Adam: Adaptive smooth hyper-core
            };
            Color[] colors = new Color[]
            {
                new Color(0.97f, 0.45f, 0.09f), // SGD Amber-Orange
                new Color(0.22f, 0.74f, 0.97f), // Momentum Cyan
                new Color(0.66f, 0.33f, 0.97f), // RMSprop Violet
                new Color(0.06f, 0.72f, 0.51f)  // Adam Emerald
            };

            for (int i = 0; i < names.Length; i++)
            {
                GameObject root = new GameObject($"OptimizerSmith_{names[i]}");
                root.transform.position = positions[i];

                var mf = root.AddComponent<MeshFilter>();
                mf.sharedMesh = StylizedLowPolyMeshes.CreateOptimizerSmithMesh(names[i], 0.85f);
                var mr = root.AddComponent<MeshRenderer>();
                mr.sharedMaterial = StylizedMaterialFactory.CreateEmissiveMaterial(colors[i], colors[i] * 0.8f, 1.8f);

                smiths.Add(new OptimizerSmithInstance
                {
                    name = names[i],
                    root = root,
                    homePos = positions[i],
                    velocity = 0f,
                    momentumVal = 0f,
                    variance = (i == 0 ? 0.35f : 0.05f),
                    phase = i * 1.5f
                });
            }
        }
        #endregion

        #region Ghost Rivals
        private void SpawnGhostRivals()
        {
            Vector3[] ghostPositions = new Vector3[]
            {
                new Vector3(25f, 0.2f, 8f),
                new Vector3(-18f, 0.2f, 24f)
            };

            for (int i = 0; i < ghostPositions.Length; i++)
            {
                GameObject ghost = new GameObject($"GhostRival_#{(i + 1)}");
                ghost.transform.position = ghostPositions[i];

                var mf = ghost.AddComponent<MeshFilter>();
                mf.sharedMesh = StylizedLowPolyMeshes.CreateRuneTabletMesh(0.75f);
                var mr = ghost.AddComponent<MeshRenderer>();
                // Translucent holographic cyan styling
                mr.sharedMaterial = StylizedMaterialFactory.CreateEmissiveMaterial(new Color(0.14f, 0.74f, 0.88f, 0.65f), new Color(0.02f, 0.52f, 0.78f), 1.5f);
                ghostRivals.Add(ghost);
            }
        }
        #endregion

        #region Animation & Math Kinematics
        private void Update()
        {
            float dt = Time.deltaTime;
            float time = Time.time;

            // 1. ADA Floating & Eye Pulse
            if (adaDroneObj != null && playerTransform != null)
            {
                Vector3 targetPos = playerTransform.position + adaFollowOffset + Vector3.up * (Mathf.Sin(time * 2.5f) * 0.12f);
                adaDroneObj.transform.position = Vector3.Lerp(adaDroneObj.transform.position, targetPos, dt * adaSmoothSpeed);
                adaDroneObj.transform.Rotate(Vector3.up, 25f * dt, Space.World);

                if (adaEyeTransform != null)
                {
                    float pulse = 1.0f + Mathf.Sin(time * 4.0f) * 0.15f;
                    adaEyeTransform.localScale = Vector3.one * pulse;
                }
            }

            // 2. The Archivist Head Sway & Rune Rotation
            if (archivistHeadTransform != null)
            {
                archivistHeadTransform.localPosition = new Vector3(0f, 1.65f + Mathf.Sin(time * 1.8f) * 0.05f, 0f);
                archivistHeadTransform.Rotate(Vector3.up, 18f * dt, Space.World);
            }

            // 3. Optimizer Smiths Math-Based Kinematics
            for (int i = 0; i < smiths.Count; i++)
            {
                var s = smiths[i];
                if (s.root == null) continue;

                if (s.name == "SGD")
                {
                    // High stochastic variance: sudden zig-zag jumps & overshoot jitter
                    float jitterX = (Mathf.PerlinNoise(time * 8f, 0f) - 0.5f) * 0.65f;
                    float jitterZ = (Mathf.PerlinNoise(0f, time * 8f) - 0.5f) * 0.65f;
                    float hop = Mathf.Abs(Mathf.Sin(time * 9f)) * 0.35f;
                    s.root.transform.position = s.homePos + new Vector3(jitterX, hop, jitterZ);
                    s.root.transform.Rotate(Vector3.up, 120f * dt);
                }
                else if (s.name == "Momentum")
                {
                    // Heavy rolling momentum with inertia follow-through
                    s.momentumVal = Mathf.Lerp(s.momentumVal, Mathf.Sin(time * 2.2f) * 1.2f, dt * 1.8f);
                    float rollX = s.momentumVal;
                    s.root.transform.position = s.homePos + new Vector3(rollX, Mathf.Abs(Mathf.Sin(time * 2.2f)) * 0.12f, 0f);
                    s.root.transform.Rotate(Vector3.forward, -s.momentumVal * 90f * dt);
                }
                else if (s.name == "RMSprop")
                {
                    // Adaptive oscillation scaling stride inversely with vertical gradient
                    float stepY = Mathf.Sin(time * 4.5f) * 0.45f;
                    float scaleInv = 1.0f / (1.0f + Mathf.Abs(stepY) * 2.0f);
                    s.root.transform.position = s.homePos + new Vector3(Mathf.Cos(time * 2.5f) * scaleInv * 0.8f, Mathf.Abs(stepY), 0f);
                    s.root.transform.Rotate(Vector3.up, 45f * dt);
                }
                else // Adam
                {
                    // Dual-moment exponential moving average: hyper-smooth adaptive drift
                    float smoothX = Mathf.Sin(time * 1.8f) * 0.9f;
                    float smoothZ = Mathf.Cos(time * 1.8f) * 0.6f;
                    float floatY = 0.25f + Mathf.Sin(time * 2.8f) * 0.08f;
                    s.root.transform.position = s.homePos + new Vector3(smoothX, floatY, smoothZ);
                    s.root.transform.Rotate(Vector3.up, 30f * dt);
                }
            }

            // 4. Ghost Rivals Translucent Flicker
            for (int i = 0; i < ghostRivals.Count; i++)
            {
                if (ghostRivals[i] != null)
                {
                    ghostRivals[i].transform.Rotate(Vector3.up, 20f * dt);
                    ghostRivals[i].transform.position += Vector3.up * (Mathf.Sin(time * 2.0f + i) * 0.002f);
                }
            }
        }
        #endregion
    }
}

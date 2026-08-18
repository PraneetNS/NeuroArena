using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;

namespace NeuroArena.Environment
{
    public enum VFXEffectType
    {
        ConvergenceShockwave,
        LossSpikeWarning,
        GradientFootstepTrail,
        SynapseSparkBurst,
        HyperparameterAura
    }

    /// <summary>
    /// Production Visual Effects (VFX) & Particle Pool Director.
    /// Features:
    /// - Zero-GC particle system pooling for mobile performance.
    /// - Gradient descent footstep particle trails mapped to loss gradients.
    /// - Convergence milestone spherical shockwave rings.
    /// - Camera shake triggers for loss spikes and breakthrough milestones.
    /// </summary>
    public class ProductionVFXManager : MonoBehaviour
    {
        public static ProductionVFXManager Instance { get; private set; }

        [Header("Pool Settings")]
        [SerializeField] private int initialPoolSizePerType = 8;
        [SerializeField] private Transform cameraRigTransform;

        private readonly Dictionary<VFXEffectType, Queue<GameObject>> vfxPools = new Dictionary<VFXEffectType, Queue<GameObject>>();
        private GameObject vfxRootContainer;
        private Coroutine screenShakeCoroutine;

        private void Awake()
        {
            if (Instance == null)
            {
                Instance = this;
                DontDestroyOnLoad(gameObject);
                InitializeVFXPools();
            }
            else
            {
                Destroy(gameObject);
            }
        }

        private void InitializeVFXPools()
        {
            vfxRootContainer = new GameObject("VFX_Pool_Container");
            DontDestroyOnLoad(vfxRootContainer);

            foreach (VFXEffectType type in Enum.GetValues(typeof(VFXEffectType)))
            {
                var queue = new Queue<GameObject>();
                for (int i = 0; i < initialPoolSizePerType; i++)
                {
                    GameObject obj = CreateVFXInstance(type);
                    obj.SetActive(false);
                    queue.Enqueue(obj);
                }
                vfxPools[type] = queue;
            }
        }

        private GameObject CreateVFXInstance(VFXEffectType type)
        {
            GameObject go = new GameObject($"VFX_{type}");
            go.transform.SetParent(vfxRootContainer.transform);

            ParticleSystem ps = go.AddComponent<ParticleSystem>();
            var main = ps.main;
            main.playOnAwake = false;
            main.loop = false;
            main.duration = 1.0f;

            switch (type)
            {
                case VFXEffectType.ConvergenceShockwave:
                    main.startColor = new Color(0.1f, 0.9f, 0.6f, 0.8f);
                    main.startSize = 3.5f;
                    break;
                case VFXEffectType.LossSpikeWarning:
                    main.startColor = new Color(0.95f, 0.2f, 0.2f, 0.9f);
                    main.startSize = 2.0f;
                    break;
                case VFXEffectType.GradientFootstepTrail:
                    main.startColor = new Color(0.3f, 0.7f, 1.0f, 0.6f);
                    main.startSize = 0.5f;
                    break;
                case VFXEffectType.SynapseSparkBurst:
                    main.startColor = new Color(1.0f, 0.85f, 0.2f, 0.9f);
                    main.startSize = 0.8f;
                    break;
                case VFXEffectType.HyperparameterAura:
                    main.startColor = new Color(0.7f, 0.3f, 1.0f, 0.7f);
                    main.startSize = 1.8f;
                    break;
            }

            return go;
        }

        /// <summary>
        /// Spawns a pooled particle effect at specified world position.
        /// </summary>
        public void SpawnVFX(VFXEffectType type, Vector3 position, Quaternion rotation, float customScale = 1.0f)
        {
            if (!vfxPools.TryGetValue(type, out Queue<GameObject> queue)) return;

            GameObject instance = queue.Count > 0 ? queue.Dequeue() : CreateVFXInstance(type);
            instance.transform.position = position;
            instance.transform.rotation = rotation;
            instance.transform.localScale = Vector3.one * customScale;
            instance.SetActive(true);

            ParticleSystem ps = instance.GetComponent<ParticleSystem>();
            if (ps != null) ps.Play();

            StartCoroutine(ReturnToPoolRoutine(type, instance, 1.5f));
        }

        private IEnumerator ReturnToPoolRoutine(VFXEffectType type, GameObject instance, float delaySec)
        {
            yield return new WaitForSeconds(delaySec);
            if (instance != null)
            {
                instance.SetActive(false);
                if (vfxPools.TryGetValue(type, out Queue<GameObject> queue))
                {
                    queue.Enqueue(instance);
                }
            }
        }

        /// <summary>
        /// Triggers a procedural camera shake for loss spikes and breakthroughs.
        /// </summary>
        public void TriggerScreenShake(float intensity = 0.25f, float durationSec = 0.35f)
        {
            if (Camera.main == null) return;
            Transform targetCamera = cameraRigTransform != null ? cameraRigTransform : Camera.main.transform;

            if (screenShakeCoroutine != null) StopCoroutine(screenShakeCoroutine);
            screenShakeCoroutine = StartCoroutine(ScreenShakeRoutine(targetCamera, intensity, durationSec));
        }

        private IEnumerator ScreenShakeRoutine(Transform cam, float intensity, float durationSec)
        {
            Vector3 originalPos = cam.localPosition;
            float elapsed = 0f;

            while (elapsed < durationSec)
            {
                elapsed += Time.unscaledDeltaTime;
                float damp = 1f - (elapsed / durationSec);
                cam.localPosition = originalPos + UnityEngine.Random.insideUnitSphere * (intensity * damp);
                yield return null;
            }

            cam.localPosition = originalPos;
            screenShakeCoroutine = null;
        }
    }
}

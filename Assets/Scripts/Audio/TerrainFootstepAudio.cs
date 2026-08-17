using System;
using UnityEngine;

namespace NeuroArena.Audio
{
    /// <summary>
    /// Stage 48 & Stage 21 Animation-Driven Terrain Footstep Audio System.
    /// Raycasts down to inspect terrain surface (Biome/PhysicMaterial/Texture) and procedurally synthesizes
    /// realistic steps synced to the exact animation contact frame (OnFootstep event).
    /// </summary>
    [RequireComponent(typeof(AudioSource))]
    public class TerrainFootstepAudio : MonoBehaviour
    {
        [Header("Audio Tuning")]
        [SerializeField] private float stepVolume = 0.18f;
        [SerializeField] private float raycastDistance = 1.4f;
        [SerializeField] private LayerMask terrainLayer = ~0;

        private AudioSource audioSource;
        private double audioPhase = 0;
        private float stepEnvelope = 0f;
        private int currentSurfaceType = 0; // 0: Grass, 1: Wet, 2: Snow, 3: Wood, 4: Metal, 5: Crystal

        private void Awake()
        {
            audioSource = GetComponent<AudioSource>();
            audioSource.spatialBlend = 1.0f; // 3D spatial
            audioSource.rolloffMode = AudioRolloffMode.Logarithmic;
            audioSource.minDistance = 1.0f;
            audioSource.maxDistance = 15.0f;
            audioSource.playOnAwake = true;
            audioSource.loop = true;
        }

        private void Start()
        {
            if (!audioSource.isPlaying)
            {
                audioSource.Play();
            }
        }

        /// <summary>
        /// Called directly by Animation Events on the exact frame the foot touches ground.
        /// </summary>
        /// <param name="footIndex">0 = Left Foot, 1 = Right Foot</param>
        public void OnFootstep(int footIndex)
        {
            DetectSurfaceUnderfoot();
            stepEnvelope = 1.0f;
        }

        private void DetectSurfaceUnderfoot()
        {
            Ray ray = new Ray(transform.position + Vector3.up * 0.5f, Vector3.down);
            if (Physics.Raycast(ray, out RaycastHit hit, raycastDistance, terrainLayer))
            {
                string matName = hit.collider.sharedMaterial != null ? hit.collider.sharedMaterial.name.ToLower() : "";
                string objName = hit.collider.gameObject.name.ToLower();

                if (matName.Contains("metal") || objName.Contains("citadel") || objName.Contains("platform"))
                {
                    currentSurfaceType = 4; // Metal
                }
                else if (matName.Contains("snow") || matName.Contains("ice") || objName.Contains("tundra"))
                {
                    currentSurfaceType = 2; // Snow
                }
                else if (matName.Contains("water") || matName.Contains("mud") || objName.Contains("marsh"))
                {
                    currentSurfaceType = 1; // Wet
                }
                else if (matName.Contains("wood") || objName.Contains("canopy") || objName.Contains("tree"))
                {
                    currentSurfaceType = 3; // Wood
                }
                else if (objName.Contains("semantic") || objName.Contains("expanse"))
                {
                    currentSurfaceType = 5; // Crystal
                }
                else
                {
                    currentSurfaceType = 0; // Grass / Sand
                }
            }
        }

        private void OnAudioFilterRead(float[] data, int channels)
        {
            if (stepEnvelope <= 0.0001f) return;
            double dt = 1.0 / AudioSettings.outputSampleRate;

            for (int i = 0; i < data.Length; i += channels)
            {
                float sample = 0f;

                switch (currentSurfaceType)
                {
                    case 0: // Grass / Sand: Soft muffled low-sine thud
                        audioPhase += dt * 95.0;
                        if (audioPhase > 1.0) audioPhase -= 1.0;
                        sample = Mathf.Sin((float)(audioPhase * Math.PI * 2)) * 0.7f;
                        stepEnvelope *= 0.9985f; // Fast decay
                        break;

                    case 1: // Wet Mud: Squelchy bandpass
                        audioPhase += dt * (500.0 + (1.0f - stepEnvelope) * 600.0);
                        if (audioPhase > 1.0) audioPhase -= 1.0;
                        sample = Mathf.Sin((float)(audioPhase * Math.PI * 2)) * 0.8f;
                        stepEnvelope *= 0.9982f;
                        break;

                    case 2: // Tundra Snow: Granular crunch
                        float noise = (UnityEngine.Random.value * 2f - 1f);
                        sample = noise * stepEnvelope * 0.9f;
                        stepEnvelope *= 0.9978f;
                        break;

                    case 3: // Wood: Hollow triangle
                        audioPhase += dt * 220.0;
                        if (audioPhase > 1.0) audioPhase -= 1.0;
                        sample = (float)(2.0 * Math.Abs(2.0 * (audioPhase - Math.Floor(audioPhase + 0.5))) - 1.0) * 0.8f;
                        stepEnvelope *= 0.9984f;
                        break;

                    case 4: // Metal: Resonant dual ping
                        audioPhase += dt * 620.0;
                        if (audioPhase > 1.0) audioPhase -= 1.0;
                        sample = (Mathf.Sin((float)(audioPhase * Math.PI * 2)) +
                                  Mathf.Sin((float)(audioPhase * 2.0 * Math.PI * 2)) * 0.4f) * 0.9f;
                        stepEnvelope *= 0.9989f; // Longer metallic ring
                        break;

                    case 5: // Crystal: High sine ping
                    default:
                        audioPhase += dt * 880.0;
                        if (audioPhase > 1.0) audioPhase -= 1.0;
                        sample = Mathf.Sin((float)(audioPhase * Math.PI * 2)) * 0.7f;
                        stepEnvelope *= 0.9986f;
                        break;
                }

                sample *= (stepEnvelope * stepVolume);

                for (int c = 0; c < channels; c++)
                {
                    data[i + c] += sample;
                }
            }
        }
    }
}

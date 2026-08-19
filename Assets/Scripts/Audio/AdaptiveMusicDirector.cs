using UnityEngine;
using UnityEngine.Audio;

namespace NeuroArena.Audio
{
    public class AdaptiveMusicDirector : MonoBehaviour
    {
        [Header("Audio Sources")]
        [SerializeField] private AudioSource ambientStemSource;
        [SerializeField] private AudioSource combatStemSource;
        [SerializeField] private AudioSource tensionStemSource;

        [Header("Dynamic Mix Settings")]
        [Range(0f, 1f)] [SerializeField] private float combatIntensity = 0f;
        [SerializeField] private float fadeSpeed = 2.0f;

        private void Update()
        {
            float targetCombatVol = Mathf.Clamp01(combatIntensity * 1.2f);
            float targetTensionVol = Mathf.Clamp01((combatIntensity - 0.6f) * 2.5f);
            float targetAmbientVol = Mathf.Clamp01(1.0f - combatIntensity * 0.5f);

            if (ambientStemSource != null)
                ambientStemSource.volume = Mathf.MoveTowards(ambientStemSource.volume, targetAmbientVol, Time.deltaTime * fadeSpeed);

            if (combatStemSource != null)
                combatStemSource.volume = Mathf.MoveTowards(combatStemSource.volume, targetCombatVol, Time.deltaTime * fadeSpeed);

            if (tensionStemSource != null)
                tensionStemSource.volume = Mathf.MoveTowards(tensionStemSource.volume, targetTensionVol, Time.deltaTime * fadeSpeed);
        }

        public void SetIntensity(float val)
        {
            combatIntensity = Mathf.Clamp01(val);
        }
    }
}

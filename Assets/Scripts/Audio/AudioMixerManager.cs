using UnityEngine;
using UnityEngine.Audio;

namespace NeuroArena.Audio
{
    /// <summary>
    /// Stage 30 & Audio Settings Manager.
    /// Manages Unity AudioMixer groups (Master, Ambient, SFX, UI, Music), converts linear UI slider values (0-100)
    /// to logarithmic decibel attenuations (-80dB to 0dB), and exposes global mute state.
    /// </summary>
    public class AudioMixerManager : MonoBehaviour
    {
        public static AudioMixerManager Instance { get; private set; }

        [Header("AudioMixer References")]
        [SerializeField] private AudioMixer mainAudioMixer;
        [SerializeField] private AudioMixerGroup masterGroup;
        [SerializeField] private AudioMixerGroup ambientGroup;
        [SerializeField] private AudioMixerGroup sfxGroup;
        [SerializeField] private AudioMixerGroup uiGroup;
        [SerializeField] private AudioMixerGroup musicGroup;

        [Header("Exposed Parameter Names")]
        [SerializeField] private string masterVolParam = "MasterVolume";
        [SerializeField] private string ambientVolParam = "AmbientVolume";
        [SerializeField] private string sfxVolParam = "SFXVolume";
        [SerializeField] private string uiVolParam = "UIVolume";
        [SerializeField] private string musicVolParam = "MusicVolume";

        private bool isMuted = false;
        private float currentMaster = 85f;
        private float currentAmbient = 80f;
        private float currentSFX = 90f;
        private float currentUI = 85f;
        private float currentMusic = 75f;

        public AudioMixerGroup MasterGroup => masterGroup;
        public AudioMixerGroup AmbientGroup => ambientGroup;
        public AudioMixerGroup SFXGroup => sfxGroup;
        public AudioMixerGroup UIGroup => uiGroup;
        public AudioMixerGroup MusicGroup => musicGroup;

        private void Awake()
        {
            if (Instance == null) Instance = this;
            else { Destroy(gameObject); return; }

            DontDestroyOnLoad(gameObject);
        }

        private void Start()
        {
            LoadAudioSettings();
            ApplyAllVolumes();
        }

        public void SaveAudioSettings()
        {
            PlayerPrefs.SetFloat("Audio_MasterVolume", currentMaster);
            PlayerPrefs.SetFloat("Audio_AmbientVolume", currentAmbient);
            PlayerPrefs.SetFloat("Audio_SFXVolume", currentSFX);
            PlayerPrefs.SetFloat("Audio_UIVolume", currentUI);
            PlayerPrefs.SetFloat("Audio_MusicVolume", currentMusic);
            PlayerPrefs.SetInt("Audio_IsMuted", isMuted ? 1 : 0);
            PlayerPrefs.Save();
        }

        public void LoadAudioSettings()
        {
            currentMaster = PlayerPrefs.GetFloat("Audio_MasterVolume", 85f);
            currentAmbient = PlayerPrefs.GetFloat("Audio_AmbientVolume", 80f);
            currentSFX = PlayerPrefs.GetFloat("Audio_SFXVolume", 90f);
            currentUI = PlayerPrefs.GetFloat("Audio_UIVolume", 85f);
            currentMusic = PlayerPrefs.GetFloat("Audio_MusicVolume", 75f);
            isMuted = PlayerPrefs.GetInt("Audio_IsMuted", 0) == 1;
        }

        public void SetMasterVolume(float linearPercent)
        {
            currentMaster = Mathf.Clamp(linearPercent, 0f, 100f);
            SetMixerParam(masterVolParam, isMuted ? 0f : currentMaster);
            SaveAudioSettings();
        }

        public void SetAmbientVolume(float linearPercent)
        {
            currentAmbient = Mathf.Clamp(linearPercent, 0f, 100f);
            SetMixerParam(ambientVolParam, currentAmbient);
            SaveAudioSettings();
        }

        public void SetSFXVolume(float linearPercent)
        {
            currentSFX = Mathf.Clamp(linearPercent, 0f, 100f);
            SetMixerParam(sfxVolParam, currentSFX);
            SaveAudioSettings();
        }

        public void SetUIVolume(float linearPercent)
        {
            currentUI = Mathf.Clamp(linearPercent, 0f, 100f);
            SetMixerParam(uiVolParam, currentUI);
            SaveAudioSettings();
        }

        public void SetMusicVolume(float linearPercent)
        {
            currentMusic = Mathf.Clamp(linearPercent, 0f, 100f);
            SetMixerParam(musicVolParam, currentMusic);
            SaveAudioSettings();
        }

        public void ToggleMute()
        {
            isMuted = !isMuted;
            SetMasterVolume(currentMaster);
            SaveAudioSettings();
        }

        public System.Collections.IEnumerator FadeMixerGroup(string paramName, float targetLinear, float duration)
        {
            if (mainAudioMixer == null || duration <= 0f) yield break;

            float startLinear = currentMusic;
            if (paramName == ambientVolParam) startLinear = currentAmbient;
            else if (paramName == sfxVolParam) startLinear = currentSFX;
            else if (paramName == masterVolParam) startLinear = currentMaster;

            float elapsed = 0f;
            while (elapsed < duration)
            {
                elapsed += Time.unscaledDeltaTime;
                float t = Mathf.Clamp01(elapsed / duration);
                float curr = Mathf.Lerp(startLinear, targetLinear, t);
                SetMixerParam(paramName, curr);
                yield return null;
            }
            SetMixerParam(paramName, targetLinear);
        }

        private void SetMixerParam(string paramName, float linearPercent)
        {
            if (mainAudioMixer == null) return;
            float normalized = Mathf.Clamp01(linearPercent / 100f);
            float decibels = (normalized <= 0.0001f) ? -80f : 20.0f * Mathf.Log10(normalized);
            mainAudioMixer.SetFloat(paramName, decibels);
        }

        public void ApplyAllVolumes()
        {
            SetMasterVolume(currentMaster);
            SetAmbientVolume(currentAmbient);
            SetSFXVolume(currentSFX);
            SetUIVolume(currentUI);
            SetMusicVolume(currentMusic);
        }
    }
}

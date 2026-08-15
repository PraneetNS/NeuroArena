using System;
using UnityEngine;
using NeuroArena.Data;

namespace NeuroArena.Core
{
    /// <summary>
    /// Player Profile & Multi-Slot Save Manager.
    /// Handles persistent stats, active slot switching, playtime accumulation, and milestone achievements.
    /// </summary>
    public class PlayerProfileManager : MonoBehaviour
    {
        public static PlayerProfileManager Instance { get; private set; }

        private const string ACTIVE_SLOT_KEY = "neuroarena_active_slot";
        private const int MAX_SLOTS = 3;

        [SerializeField] private int activeSlot = 0;
        private PlayerProfileData currentProfile;

        public int ActiveSlot => activeSlot;
        public PlayerProfileData CurrentProfile => currentProfile;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;

            activeSlot = PlayerPrefs.GetInt(ACTIVE_SLOT_KEY, 0);
            LoadProfile(activeSlot);
        }

        private void Update()
        {
            if (currentProfile != null)
            {
                currentProfile.totalPlaytimeSeconds += Time.unscaledDeltaTime;
            }
        }

        public void LoadProfile(int slot)
        {
            activeSlot = Mathf.Clamp(slot, 0, MAX_SLOTS - 1);
            PlayerPrefs.SetInt(ACTIVE_SLOT_KEY, activeSlot);
            PlayerPrefs.Save();

            string key = $"neuroarena_profile_slot_{activeSlot}";
            if (PlayerPrefs.HasKey(key))
            {
                try
                {
                    string json = PlayerPrefs.GetString(key);
                    currentProfile = JsonUtility.FromJson<PlayerProfileData>(json) ?? new PlayerProfileData(activeSlot);
                }
                catch
                {
                    currentProfile = new PlayerProfileData(activeSlot);
                }
            }
            else
            {
                currentProfile = new PlayerProfileData(activeSlot);
                SaveCurrentProfile();
            }
        }

        public void SaveCurrentProfile()
        {
            if (currentProfile == null) return;
            string key = $"neuroarena_profile_slot_{activeSlot}";
            string json = JsonUtility.ToJson(currentProfile);
            PlayerPrefs.SetString(key, json);
            PlayerPrefs.Save();
        }

        public void SetPlayerIdentity(string name, string avatar)
        {
            if (currentProfile == null) return;
            currentProfile.playerName = string.IsNullOrEmpty(name) ? "Architect" : name.Trim();
            currentProfile.avatarId = avatar;
            SaveCurrentProfile();
        }

        public void RecordGrandPrixRace(bool isWin)
        {
            if (currentProfile == null) return;
            currentProfile.grandPrixRaces++;
            if (isWin) currentProfile.grandPrixWins++;
            SaveCurrentProfile();
        }

        public void RecordBiomeVictory(int biomeIndex, float mse, float accuracy)
        {
            if (currentProfile == null || biomeIndex < 0 || biomeIndex >= 6) return;
            var r = currentProfile.biomeRecords[biomeIndex];
            if (!r.isCompleted)
            {
                r.isCompleted = true;
                currentProfile.biomesCompletedCount = Mathf.Min(6, currentProfile.biomesCompletedCount + 1);
            }
            if (mse < r.bestMSE) r.bestMSE = mse;
            if (accuracy > r.bestAccuracy) r.bestAccuracy = accuracy;
            SaveCurrentProfile();
        }

        private void OnApplicationQuit()
        {
            SaveCurrentProfile();
        }
    }
}

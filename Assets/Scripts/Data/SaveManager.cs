using System;
using System.IO;
using UnityEngine;
using NeuroArena.Core;
using NeuroArena.Environment;

namespace NeuroArena.Data
{
    /// <summary>
    /// Hardened Singleton Save Manager.
    /// Features:
    /// - Versioned save schema with automatic sequential migrations.
    /// - Auto-backup (.bak) of previous save before overwriting.
    /// - Try/catch defensive I/O with automatic fallback to backup and fresh save rather than crashing.
    /// </summary>
    public class SaveManager : MonoBehaviour
    {
        public static SaveManager Instance { get; private set; }

        public event Action<GameSaveData> OnGameSaved;
        public event Action<GameSaveData> OnGameLoaded;

        [SerializeField] private GameSaveData currentSaveData;
        private string saveFilePath;
        private string backupFilePath;

        public GameSaveData CurrentSaveData => currentSaveData;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
            DontDestroyOnLoad(gameObject);

            saveFilePath = Path.Combine(Application.persistentDataPath, "neuroarena_save.json");
            backupFilePath = Path.Combine(Application.persistentDataPath, "neuroarena_save.bak");
            Debug.Log($"[SaveManager] Save file: {saveFilePath} | Backup: {backupFilePath}");

            if (HasSaveData() || HasBackupData())
            {
                LoadGame();
            }
            else
            {
                currentSaveData = GameSaveData.CreateNew();
            }
        }

        public bool HasSaveData()
        {
            EnsurePaths();
            return File.Exists(saveFilePath);
        }

        public bool HasBackupData()
        {
            EnsurePaths();
            return File.Exists(backupFilePath);
        }

        private void EnsurePaths()
        {
            if (string.IsNullOrEmpty(saveFilePath))
            {
                saveFilePath = Path.Combine(Application.persistentDataPath, "neuroarena_save.json");
                backupFilePath = Path.Combine(Application.persistentDataPath, "neuroarena_save.bak");
            }
        }

        public void SaveGame()
        {
            if (currentSaveData == null)
            {
                currentSaveData = GameSaveData.CreateNew();
            }

            // 1. Capture Inventory State
            if (MLInventory.Instance != null)
            {
                MLInventory.Instance.ExportToSaveData(currentSaveData);
            }

            // 2. Capture Player Position
            if (PlayerController.Instance != null)
            {
                Vector3 pos = PlayerController.Instance.transform.position;
                currentSaveData.playerPosX = pos.x;
                currentSaveData.playerPosY = pos.y;
                currentSaveData.playerPosZ = pos.z;
                currentSaveData.playerRotY = PlayerController.Instance.transform.eulerAngles.y;
            }

            // 3. Capture Active Model Config
            if (LabStation.ActiveStation != null)
            {
                currentSaveData.activeModelConfig = LabStation.ActiveStation.ActiveModelConfig;
            }

            // 4. Capture Biome Progression
            if (BiomeManager.Instance != null)
            {
                currentSaveData.currentBiomeIndex = BiomeManager.Instance.CurrentBiomeIndex;
                currentSaveData.unlockedBiomes = BiomeManager.Instance.UnlockedBiomes;
            }

            currentSaveData.saveTimestamp = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss");

            EnsurePaths();

            // 5. Auto-Backup of Existing Save Before Overwriting
            try
            {
                if (File.Exists(saveFilePath))
                {
                    File.Copy(saveFilePath, backupFilePath, true);
                    Debug.Log($"[SaveManager] Auto-backup created at: {backupFilePath}");
                }
            }
            catch (Exception ex)
            {
                Debug.LogWarning($"[SaveManager] Failed to create pre-save backup: {ex.Message}");
            }

            // 6. Defensive Write to Disk
            try
            {
                string json = currentSaveData.ToJson();
                File.WriteAllText(saveFilePath, json);
                Debug.Log($"[SaveManager] Hardened save written successfully (v{currentSaveData.saveVersion}) to: {saveFilePath}");
                OnGameSaved?.Invoke(currentSaveData);
            }
            catch (Exception ex)
            {
                Debug.LogError($"[SaveManager] Failed to save game to primary path: {ex.Message}");
            }
        }

        public bool LoadGame()
        {
            EnsurePaths();

            // Attempt 1: Load Primary Save
            if (File.Exists(saveFilePath))
            {
                try
                {
                    string json = File.ReadAllText(saveFilePath);
                    currentSaveData = SaveMigrationManager.MigrateJsonIfNeeded(json);
                    ApplyLoadedDataToGame();
                    Debug.Log($"[SaveManager] Game loaded from primary save! Last saved: {currentSaveData.saveTimestamp}");
                    OnGameLoaded?.Invoke(currentSaveData);
                    return true;
                }
                catch (Exception ex)
                {
                    Debug.LogError($"[SaveManager] Primary save file corrupted or unreadable: {ex.Message}. Attempting backup restore...");
                }
            }

            // Attempt 2: Fallback to Auto-Backup (.bak)
            if (File.Exists(backupFilePath))
            {
                try
                {
                    string backupJson = File.ReadAllText(backupFilePath);
                    currentSaveData = SaveMigrationManager.MigrateJsonIfNeeded(backupJson);
                    ApplyLoadedDataToGame();
                    Debug.LogWarning($"[SaveManager] Game recovered successfully from auto-backup! Last saved: {currentSaveData.saveTimestamp}");
                    OnGameLoaded?.Invoke(currentSaveData);
                    return true;
                }
                catch (Exception ex)
                {
                    Debug.LogError($"[SaveManager] Backup save file is also unreadable: {ex.Message}. Falling back to fresh state.");
                }
            }

            // Attempt 3: Graceful Fallback to Fresh Save (Zero Crash)
            Debug.LogWarning("[SaveManager] Initializing fresh fallback save state.");
            currentSaveData = GameSaveData.CreateNew();
            ApplyLoadedDataToGame();
            return false;
        }

        private void ApplyLoadedDataToGame()
        {
            if (currentSaveData == null) return;

            // 1. Apply to Inventory
            if (MLInventory.Instance != null)
            {
                MLInventory.Instance.ImportFromSaveData(currentSaveData);
            }

            // 2. Apply to Player Position
            if (PlayerController.Instance != null)
            {
                CharacterController cc = PlayerController.Instance.GetComponent<CharacterController>();
                if (cc != null) cc.enabled = false;
                PlayerController.Instance.transform.position = new Vector3(currentSaveData.playerPosX, currentSaveData.playerPosY, currentSaveData.playerPosZ);
                PlayerController.Instance.transform.rotation = Quaternion.Euler(0f, currentSaveData.playerRotY, 0f);
                if (cc != null) cc.enabled = true;
            }

            // 3. Apply to Biome Manager
            if (BiomeManager.Instance != null)
            {
                BiomeManager.Instance.ApplyLoadedProgression(currentSaveData.currentBiomeIndex, currentSaveData.unlockedBiomes);
            }
        }

        public void StartNewGame()
        {
            currentSaveData = GameSaveData.CreateNew();

            if (MLInventory.Instance != null)
            {
                MLInventory.Instance.ResetInventory();
            }

            if (PlayerController.Instance != null)
            {
                CharacterController cc = PlayerController.Instance.GetComponent<CharacterController>();
                if (cc != null) cc.enabled = false;
                PlayerController.Instance.transform.position = new Vector3(0f, 1.5f, 0f);
                PlayerController.Instance.transform.rotation = Quaternion.identity;
                if (cc != null) cc.enabled = true;
            }

            if (BiomeManager.Instance != null)
            {
                BiomeManager.Instance.ApplyLoadedProgression(0, new bool[6] { true, false, false, false, false, false });
            }

            SaveGame();
            Debug.Log("[SaveManager] Started a New Game session.");
        }

        public void DeleteSaveData()
        {
            EnsurePaths();
            if (File.Exists(saveFilePath)) File.Delete(saveFilePath);
            if (File.Exists(backupFilePath)) File.Delete(backupFilePath);
            currentSaveData = GameSaveData.CreateNew();
            Debug.Log("[SaveManager] Save and backup files deleted.");
        }
    }
}

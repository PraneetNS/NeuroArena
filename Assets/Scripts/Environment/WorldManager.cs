using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.SceneManagement;
using NeuroArena.Core;
using NeuroArena.Data;

namespace NeuroArena.Environment
{
    /// <summary>
    /// Central World & Scene Manager:
    /// - Orchestrates async loading of 6 standalone Biome scenes.
    /// - Persists Player, MLInventory, SaveManager, and HUD across scenes via DontDestroyOnLoad.
    /// - Coordinates player spawn points and camera re-targeting on biome arrival.
    /// </summary>
    public class WorldManager : MonoBehaviour
    {
        public static WorldManager Instance { get; private set; }

        public static readonly string[] BiomeSceneNames = new string[]
        {
            "Biome1_LinearSteppes",
            "Biome2_BinaryMarshlands",
            "Biome3_VarianceTundra",
            "Biome4_BranchingCanopy",
            "Biome5_DeepSynapseCitadel",
            "Biome6_SemanticExpanse"
        };

        [Header("Runtime State")]
        public int currentBiomeIndex = 0;
        public bool isTransitioning = false;

        public event Action<int> OnBiomeTransitionStarted;
        public event Action<int> OnBiomeTransitionCompleted;

        private void Awake()
        {
            if (Instance == null)
            {
                Instance = this;
                DontDestroyOnLoad(gameObject);
            }
            else if (Instance != this)
            {
                Destroy(gameObject);
                return;
            }
        }

        private void Start()
        {
            SceneManager.sceneLoaded += HandleSceneLoaded;
        }

        private void OnDestroy()
        {
            SceneManager.sceneLoaded -= HandleSceneLoaded;
        }

        /// <summary>
        /// Initiates travel transition to the target biome scene.
        /// </summary>
        public void TravelToBiome(int targetBiomeIndex)
        {
            if (isTransitioning) return;
            if (targetBiomeIndex < 0 || targetBiomeIndex >= BiomeSceneNames.Length) return;

            StartCoroutine(LoadBiomeRoutine(targetBiomeIndex));
        }

        private IEnumerator LoadBiomeRoutine(int targetBiomeIndex)
        {
            isTransitioning = true;
            OnBiomeTransitionStarted?.Invoke(targetBiomeIndex);

            // Optional: trigger screen fade out or UI loader
            yield return new WaitForSeconds(0.35f);

            string sceneName = BiomeSceneNames[targetBiomeIndex];
            AsyncOperation asyncLoad = SceneManager.LoadSceneAsync(sceneName, LoadSceneMode.Single);
            
            while (!asyncLoad.isDone)
            {
                yield return null;
            }

            currentBiomeIndex = targetBiomeIndex;
            isTransitioning = false;
            OnBiomeTransitionCompleted?.Invoke(targetBiomeIndex);
        }

        private void HandleSceneLoaded(Scene scene, LoadSceneMode mode)
        {
            // Re-bind player transform and camera if needed
            GameObject player = GameObject.FindWithTag("Player");
            if (player != null)
            {
                player.transform.position = new Vector3(0f, 1.5f, 0f);
            }
        }

        public bool IsBiomeUnlocked(int biomeIndex)
        {
            if (biomeIndex == 0) return true;
            if (SaveManager.Instance != null && SaveManager.Instance.CurrentSave != null)
            {
                return SaveManager.Instance.CurrentSave.unlockedBiomes > biomeIndex;
            }
            return biomeIndex <= currentBiomeIndex;
        }
    }
}

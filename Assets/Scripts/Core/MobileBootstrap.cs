using UnityEngine;
using UnityEngine.UI;
using NeuroArena.UI;
using NeuroArena.Environment;
using NeuroArena.Data;
using NeuroArena.Character;

namespace NeuroArena.Core
{
    /// <summary>
    /// Self-contained runtime bootstrapper.
    /// Configures 60 FPS mobile settings, persistence SaveManager, BiomeManager,
    /// Player, Camera, Virtual Joystick, Terrain, Linear Steppes & Binary Marshlands props,
    /// Inventory HUD, Formula Terminal UI, and Main Menu UI.
    /// </summary>
    public class MobileBootstrap : MonoBehaviour
    {
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void OnGameStart()
        {
            // Optimize mobile runtime settings
            Application.targetFrameRate = 60;
            QualitySettings.vSyncCount = 0;
            Screen.sleepTimeout = SleepTimeout.NeverSleep;

            // Check if scene already has an orchestrator
            if (FindFirstObjectByType<MobileBootstrap>() == null)
            {
                GameObject bootstrapperGO = new GameObject("[MobileBootstrap]");
                bootstrapperGO.AddComponent<MobileBootstrap>();
            }
        }

        private void Awake()
        {
            SetupSaveSystem();
            SetupEnvironment();
            SetupPlayerAndCamera(out GameObject playerGO, out Camera mainCam);
            SetupInventory(playerGO);
            SetupMLThemedNPCs(playerGO);
            SetupMobileUI();
        }

        private void SetupMLThemedNPCs(GameObject playerGO)
        {
            if (FindFirstObjectByType<Character.MLThemedNPCs>() == null)
            {
                GameObject npcMgr = new GameObject("MLThemedNPCs_Manager");
                var npcs = npcMgr.AddComponent<Character.MLThemedNPCs>();
                if (playerGO != null) npcs.playerTransform = playerGO.transform;
            }
        }

        private void SetupSaveSystem()
        {
            if (SaveManager.Instance == null && FindFirstObjectByType<SaveManager>() == null)
            {
                GameObject saveGO = new GameObject("SaveManager");
                saveGO.AddComponent<SaveManager>();
            }
        }

        private void SetupEnvironment()
        {
            // Directional Light
            Light sunLight = null;
            if (FindFirstObjectByType<Light>() == null)
            {
                GameObject lightGO = new GameObject("Directional Light");
                sunLight = lightGO.AddComponent<Light>();
                sunLight.type = LightType.Directional;
                sunLight.color = new Color(1f, 0.96f, 0.88f);
                sunLight.intensity = 1.25f;
                lightGO.transform.rotation = Quaternion.Euler(50f, -30f, 0f);
            }

            // Stylized Low-Poly Terrain (Synty POLYGON Aesthetic)
            StylizedBiomeTerrain terrain = FindFirstObjectByType<StylizedBiomeTerrain>();
            if (terrain == null)
            {
                GameObject terrainGO = new GameObject("StylizedBiomeTerrain");
                terrain = terrainGO.AddComponent<StylizedBiomeTerrain>();
            }

            // Biome Foliage & Nature Scatterer
            BiomeFoliageScatterer scatterer = FindFirstObjectByType<BiomeFoliageScatterer>();
            if (scatterer == null)
            {
                GameObject scattererGO = new GameObject("BiomeFoliageScatterer");
                scatterer = scattererGO.AddComponent<BiomeFoliageScatterer>();
            }

            // Biome Post-Processing Volume (Bloom, Color Grading, ACES)
            BiomePostProcessingManager postProc = FindFirstObjectByType<BiomePostProcessingManager>();
            if (postProc == null)
            {
                GameObject postProcGO = new GameObject("BiomePostProcessingManager");
                postProc = postProcGO.AddComponent<BiomePostProcessingManager>();
            }

            // Biome Skybox & Atmosphere Controller
            BiomeSkyboxController skybox = FindFirstObjectByType<BiomeSkyboxController>();
            if (skybox == null)
            {
                GameObject skyboxGO = new GameObject("BiomeSkyboxController");
                skybox = skyboxGO.AddComponent<BiomeSkyboxController>();
            }

            // Biome Manager
            if (BiomeManager.Instance == null && FindFirstObjectByType<BiomeManager>() == null)
            {
                GameObject biomeGO = new GameObject("BiomeManager");
                biomeGO.AddComponent<BiomeManager>();
            }

            // Linear Steppes Landmark Props & Collectibles
            if (FindFirstObjectByType<LinearSteppesProps>() == null)
            {
                GameObject propsGO = new GameObject("LinearSteppes_PropsManager");
                propsGO.AddComponent<LinearSteppesProps>();
            }
        }

        private void SetupInventory(GameObject playerGO)
        {
            if (MLInventory.Instance == null)
            {
                if (playerGO != null && playerGO.GetComponent<MLInventory>() == null)
                {
                    playerGO.AddComponent<MLInventory>();
                }
                else if (FindFirstObjectByType<MLInventory>() == null)
                {
                    GameObject invGO = new GameObject("MLInventory_Manager");
                    invGO.AddComponent<MLInventory>();
                }
            }
        }

        private void SetupPlayerAndCamera(out GameObject playerGO, out Camera mainCam)
        {
            // Player
            PlayerController player = FindFirstObjectByType<PlayerController>();
            if (player == null)
            {
                // Instantiate Rigged Humanoid Base Character
                playerGO = new GameObject("Player_Avatar");
                playerGO.tag = "Player";
                playerGO.transform.position = new Vector3(0f, 1.5f, 0f);

                // Add Character Controller
                CharacterController cc = playerGO.AddComponent<CharacterController>();
                cc.center = new Vector3(0f, 1f, 0f);
                cc.height = 2.0f;
                cc.radius = 0.45f;
                cc.stepOffset = 0.4f;

                // Add Animation Controller and Rig
                CharacterAnimationController animController = playerGO.AddComponent<CharacterAnimationController>();
                HumanoidCharacterRig rig = playerGO.AddComponent<HumanoidCharacterRig>();

                // Add Player Controller wired to Animation Controller
                player = playerGO.AddComponent<PlayerController>();
            }
            else
            {
                playerGO = player.gameObject;
                playerGO.tag = "Player";
            }

            // Main Camera & Camera Controller
            mainCam = Camera.main;
            if (mainCam == null)
            {
                GameObject camGO = new GameObject("Main Camera");
                mainCam = camGO.AddComponent<Camera>();
                camGO.tag = "MainCamera";
                camGO.AddComponent<AudioListener>();
            }

            CameraController camController = mainCam.GetComponent<CameraController>();
            if (camController == null)
            {
                camController = mainCam.gameObject.AddComponent<CameraController>();
            }
            camController.SetTarget(playerGO.transform);
            player.SetCameraTransform(mainCam.transform);
        }

        private void SetupMobileUI()
        {
            // EventSystem
            if (FindFirstObjectByType<UnityEngine.EventSystems.EventSystem>() == null)
            {
                GameObject eventSystemGO = new GameObject("EventSystem");
                eventSystemGO.AddComponent<UnityEngine.EventSystems.EventSystem>();
                eventSystemGO.AddComponent<UnityEngine.EventSystems.StandaloneInputModule>();
            }

            // Canvas
            Canvas canvas = FindFirstObjectByType<Canvas>();
            if (canvas == null)
            {
                GameObject canvasGO = new GameObject("MobileCanvas");
                canvas = canvasGO.AddComponent<Canvas>();
                canvas.renderMode = RenderMode.ScreenSpaceOverlay;

                CanvasScaler scaler = canvasGO.AddComponent<CanvasScaler>();
                scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
                scaler.referenceResolution = new Vector2(1920, 1080);
                scaler.matchWidthOrHeight = 0.5f;

                canvasGO.AddComponent<GraphicRaycaster>();
            }

            // Debug Overlay
            if (FindFirstObjectByType<MobileDebugOverlay>() == null)
            {
                canvas.gameObject.AddComponent<MobileDebugOverlay>();
            }

            // Inventory HUD
            if (FindFirstObjectByType<InventoryHUD>() == null)
            {
                canvas.gameObject.AddComponent<InventoryHUD>();
            }

            // Formula Terminal UI
            if (FindFirstObjectByType<FormulaTerminalUI>() == null)
            {
                canvas.gameObject.AddComponent<FormulaTerminalUI>();
            }

            // Main Menu UI
            if (FindFirstObjectByType<MainMenuUI>() == null)
            {
                canvas.gameObject.AddComponent<MainMenuUI>();
            }

            // Left Touch Zone (Joystick Parent)
            if (VirtualJoystick.Instance == null)
            {
                // Create Joystick Base
                GameObject joyRoot = new GameObject("VirtualJoystick_Container");
                joyRoot.transform.SetParent(canvas.transform, false);

                RectTransform joyRect = joyRoot.AddComponent<RectTransform>();
                joyRect.anchorMin = new Vector2(0f, 0f);
                joyRect.anchorMax = new Vector2(0.5f, 0.65f); // Left half of screen
                joyRect.pivot = new Vector2(0.5f, 0.5f);
                joyRect.anchoredPosition = new Vector2(240f, 240f);
                joyRect.sizeDelta = new Vector2(260f, 260f);

                Image joyBaseImage = joyRoot.AddComponent<Image>();
                joyBaseImage.color = new Color(0.12f, 0.15f, 0.22f, 0.55f);
                joyBaseImage.sprite = CreateCircleSprite(128);

                CanvasGroup group = joyRoot.AddComponent<CanvasGroup>();

                // Handle (Stick)
                GameObject handleGO = new GameObject("Joystick_Handle");
                handleGO.transform.SetParent(joyRoot.transform, false);

                RectTransform handleRect = handleGO.AddComponent<RectTransform>();
                handleRect.sizeDelta = new Vector2(90f, 90f);

                Image handleImage = handleGO.AddComponent<Image>();
                handleImage.color = new Color(0.2f, 0.75f, 1f, 0.85f);
                handleImage.sprite = CreateCircleSprite(64);

                VirtualJoystick joystick = joyRoot.AddComponent<VirtualJoystick>();
                joystick.ConfigureComponents(joyRect, handleRect, group);
            }

            // Right Touch Look Zone
            if (TouchLookZone.Instance == null)
            {
                GameObject lookRoot = new GameObject("TouchLook_Zone");
                lookRoot.transform.SetParent(canvas.transform, false);

                RectTransform lookRect = lookRoot.AddComponent<RectTransform>();
                lookRect.anchorMin = new Vector2(0.5f, 0f);
                lookRect.anchorMax = new Vector2(1f, 1f); // Right half of screen
                lookRect.offsetMin = Vector2.zero;
                lookRect.offsetMax = Vector2.zero;

                Image lookImage = lookRoot.AddComponent<Image>();
                lookImage.color = Color.clear; // Invisible raycast target

                lookRoot.AddComponent<TouchLookZone>();
            }
        }

        private static Sprite CreateCircleSprite(int diameter)
        {
            Texture2D tex = new Texture2D(diameter, diameter, TextureFormat.RGBA32, false);
            float radius = diameter * 0.5f;
            Color[] colors = new Color[diameter * diameter];

            for (int y = 0; y < diameter; y++)
            {
                for (int x = 0; x < diameter; x++)
                {
                    float dx = x - radius + 0.5f;
                    float dy = y - radius + 0.5f;
                    float dist = Mathf.Sqrt(dx * dx + dy * dy);
                    float alpha = Mathf.Clamp01((radius - dist) + 0.5f);
                    colors[y * diameter + x] = new Color(1f, 1f, 1f, alpha);
                }
            }

            tex.SetPixels(colors);
            tex.Apply();
            return Sprite.Create(tex, new Rect(0, 0, diameter, diameter), new Vector2(0.5f, 0.5f));
        }
    }
}

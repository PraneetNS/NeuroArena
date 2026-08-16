using System;
using UnityEngine;
using NeuroArena.Data;
using NeuroArena.Core;
using NeuroArena.UI;

namespace NeuroArena.Environment
{
    /// <summary>
    /// 3D Lab Station & Terminal Trigger Zone.
    /// Detects player proximity, shows in-world interaction prompt,
    /// opens the Formula Terminal UI, and stores the configured ModelConfig.
    /// </summary>
    [RequireComponent(typeof(SphereCollider))]
    public class LabStation : MonoBehaviour
    {
        public static LabStation ActiveStation { get; private set; }

        public event Action<ModelConfig> OnModelConfigSaved;

        [Header("Lab Configuration")]
        [SerializeField] private string stationName = "Linear Steppes Calibration Lab";
        [SerializeField] private float triggerRadius = 5.0f;
        [SerializeField] private bool isPlayerInZone = false;

        [Header("Active Model Specification")]
        [SerializeField] private ModelConfig activeModelConfig;
        [SerializeField] private bool isBiomeCalibrated = false;

        public bool IsPlayerInZone => isPlayerInZone;
        public bool IsBiomeCalibrated => isBiomeCalibrated;
        public ModelConfig ActiveModelConfig => activeModelConfig;

        private SphereCollider sphereCollider;
        private GUIStyle promptButtonStyle;

        private void Awake()
        {
            ActiveStation = this;
            sphereCollider = GetComponent<SphereCollider>();
            sphereCollider.isTrigger = true;
            sphereCollider.radius = triggerRadius;

            // Load default configuration
            activeModelConfig = ModelConfig.DefaultLinearRegression;
        }

        public void SetBiomeCalibrated(bool passed)
        {
            isBiomeCalibrated = passed;
            // Update hologram ring color on platform if available
            Transform ring = transform.Find("Lab_HoloRing");
            if (ring != null)
            {
                Renderer r = ring.GetComponent<Renderer>();
                if (r != null && r.material != null)
                {
                    r.material.color = passed ? new Color(0.2f, 1f, 0.4f, 0.9f) : new Color(1f, 0.3f, 0.3f, 0.9f);
                }
            }
        }

        private void OnTriggerEnter(Collider other)
        {
            PlayerController player = other.GetComponent<PlayerController>() ?? other.GetComponentInParent<PlayerController>();
            if (player != null || other.CompareTag("Player"))
            {
                isPlayerInZone = true;
            }
        }

        private void OnTriggerExit(Collider other)
        {
            PlayerController player = other.GetComponent<PlayerController>() ?? other.GetComponentInParent<PlayerController>();
            if (player != null || other.CompareTag("Player"))
            {
                isPlayerInZone = false;
            }
        }

        private void Update()
        {
            // Smoothly rotate floating hologram orbit ring
            Transform ring = transform.Find("Lab_HoloRing");
            if (ring != null)
            {
                ring.Rotate(Vector3.up, 30f * Time.deltaTime, Space.Self);
                float ringBob = Mathf.Sin(Time.time * 1.8f) * 0.08f;
                ring.localPosition = new Vector3(0f, 3.8f + ringBob, 0f);
            }

            // Desktop hotkey fallback (E or Return) to enter terminal when in zone
            if (isPlayerInZone && (Input.GetKeyDown(KeyCode.E) || Input.GetKeyDown(KeyCode.Return)))
            {
                if (FormulaTerminalUI.Instance != null && !FormulaTerminalUI.Instance.IsOpen)
                {
                    OpenTerminal();
                }
            }
        }

        private void OnGUI()
        {
            if (!isPlayerInZone) return;
            if (FormulaTerminalUI.Instance != null && FormulaTerminalUI.Instance.IsOpen) return;

            InitStyles();
            float scale = Screen.dpi > 0 ? Screen.dpi / 160f : 1f;

            // Center-Bottom In-World Action Button
            float btnWidth = 260f * scale;
            float btnHeight = 56f * scale;
            float posX = (Screen.width - btnWidth) * 0.5f;
            float posY = Screen.height - btnHeight - (90f * scale);

            Rect promptRect = new Rect(posX, posY, btnWidth, btnHeight);
            if (GUI.Button(promptRect, "⚡ <b>OPEN FORMULA TERMINAL</b>", promptButtonStyle))
            {
                OpenTerminal();
            }
        }

        public void OpenTerminal()
        {
            if (FormulaTerminalUI.Instance != null)
            {
                FormulaTerminalUI.Instance.Open(activeModelConfig, SaveModelConfig);
            }
        }

        public void SaveModelConfig(ModelConfig config)
        {
            activeModelConfig = config;
            OnModelConfigSaved?.Invoke(config);
            Debug.Log($"[LabStation] Successfully captured ModelConfig for {stationName}:\n{config.ToJson()}");
        }

        private void InitStyles()
        {
            float scale = Screen.dpi > 0 ? Screen.dpi / 160f : 1f;

            if (promptButtonStyle == null)
            {
                promptButtonStyle = new GUIStyle(GUI.skin.button)
                {
                    fontSize = (int)(13 * scale),
                    richText = true,
                    alignment = TextAnchor.MiddleCenter
                };
                promptButtonStyle.normal.textColor = Color.white;
            }
        }
    }
}

using System;
using UnityEngine;

namespace NeuroArena.Core
{
    /// <summary>
    /// AI Mascot Guide Companion (ADA).
    /// Hovers near the player, bobs with smooth harmonic motion, and renders
    /// non-blocking glass speech bubbles to guide the player without modal interruptions.
    /// </summary>
    public class MascotGuideCompanion : MonoBehaviour
    {
        public static MascotGuideCompanion Instance { get; private set; }

        [Header("Follow Settings")]
        [SerializeField] private Vector3 followOffset = new Vector3(1.2f, 1.4f, -0.8f);
        [SerializeField] private float smoothSpeed = 5.0f;
        [SerializeField] private float bobAmplitude = 0.15f;
        [SerializeField] private float bobFrequency = 2.5f;

        [Header("Active Dialogue")]
        [SerializeField] private string currentMessage = "";
        [SerializeField] private bool isSpeaking = false;
        private float speakTimer = 0f;

        private GUIStyle speechBoxStyle;
        private GUIStyle speechHeaderStyle;
        private GUIStyle speechTextStyle;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
        }

        private void Update()
        {
            if (PlayerController.Instance != null)
            {
                Transform target = PlayerController.Instance.transform;
                Vector3 desiredPos = target.position + target.right * followOffset.x + Vector3.up * (followOffset.y + Mathf.Sin(Time.time * bobFrequency) * bobAmplitude) + target.forward * followOffset.z;
                transform.position = Vector3.Lerp(transform.position, desiredPos, Time.deltaTime * smoothSpeed);
                transform.rotation = Quaternion.Slerp(transform.rotation, target.rotation, Time.deltaTime * smoothSpeed);
            }

            if (isSpeaking && speakTimer > 0)
            {
                speakTimer -= Time.deltaTime;
                if (speakTimer <= 0) isSpeaking = false;
            }
        }

        public void Say(string message, float duration = 8.0f)
        {
            currentMessage = message;
            isSpeaking = true;
            speakTimer = duration;
            NeuroAudioEngine.Instance?.PlayPickup();
        }

        public void HideSpeech() => isSpeaking = false;

        private void OnGUI()
        {
            if (!isSpeaking || string.IsNullOrEmpty(currentMessage)) return;

            InitStyles();
            float scale = Screen.dpi > 0 ? Screen.dpi / 160f : 1f;

            float w = Mathf.Min(380 * scale, Screen.width * 0.88f);
            float h = 75 * scale;
            Rect boxRect = new Rect(16 * scale, 16 * scale, w, h);

            GUI.Box(boxRect, GUIContent.none, speechBoxStyle);
            GUILayout.BeginArea(boxRect);

            GUILayout.BeginHorizontal();
            GUILayout.Label("🤖 <b>ADA [AI COMPANION]</b>", speechHeaderStyle);
            GUILayout.FlexibleSpace();
            GUILayout.EndHorizontal();

            GUILayout.Space(2 * scale);
            GUILayout.Label(currentMessage, speechTextStyle);
            GUILayout.EndArea();
        }

        private void InitStyles()
        {
            float scale = Screen.dpi > 0 ? Screen.dpi / 160f : 1f;

            if (speechBoxStyle == null)
            {
                speechBoxStyle = new GUIStyle(GUI.skin.box);
                Texture2D bg = new Texture2D(1, 1);
                bg.SetPixel(0, 0, new Color(0.02f, 0.06f, 0.12f, 0.94f));
                bg.Apply();
                speechBoxStyle.normal.background = bg;
            }

            if (speechHeaderStyle == null)
            {
                speechHeaderStyle = new GUIStyle(GUI.skin.label) { fontSize = (int)(11 * scale), fontStyle = FontStyle.Bold, richText = true };
                speechHeaderStyle.normal.textColor = new Color(0.2f, 0.9f, 1f);
            }

            if (speechTextStyle == null)
            {
                speechTextStyle = new GUIStyle(GUI.skin.label) { fontSize = (int)(10 * scale), richText = true, wordWrap = true };
                speechTextStyle.normal.textColor = new Color(0.92f, 0.95f, 1f);
            }
        }
    }
}

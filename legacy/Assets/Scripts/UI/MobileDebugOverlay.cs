using UnityEngine;

namespace NeuroArena.UI
{
    /// <summary>
    /// Lightweight on-screen debug HUD for Android build verification:
    /// Displays FPS, Resolution, Touch Pointers count, and Current Joystick Vectors.
    /// </summary>
    public class MobileDebugOverlay : MonoBehaviour
    {
        [SerializeField] private bool showOverlay = true;

        private float deltaTime = 0.0f;
        private int frameCount = 0;
        private float fps = 0.0f;
        private GUIStyle headerStyle;
        private GUIStyle subStyle;

        private void Update()
        {
            deltaTime += (Time.unscaledDeltaTime - deltaTime) * 0.1f;
            frameCount++;
            if (frameCount % 10 == 0)
            {
                fps = 1.0f / deltaTime;
            }
        }

        private void OnGUI()
        {
            if (!showOverlay) return;

            InitStyles();

            float scale = Screen.dpi > 0 ? Screen.dpi / 160f : 1f;
            int boxWidth = (int)(280 * scale);
            int boxHeight = (int)(110 * scale);
            int margin = (int)(16 * scale);

            Rect boxRect = new Rect(margin, margin, boxWidth, boxHeight);
            GUI.Box(boxRect, GUIContent.none);

            GUILayout.BeginArea(boxRect);
            GUILayout.Space(6 * scale);

            // FPS indicator
            string fpsColor = fps >= 55 ? "<color=#55FF55>" : (fps >= 30 ? "<color=#FFFF55>" : "<color=#FF5555>");
            GUILayout.Label($"<b>NeuroArena Prototype</b> | {fpsColor}{fps:0.0} FPS</color>", headerStyle);

            // Device & Touch info
            int touches = Input.touchCount;
            Vector2 joystickInput = VirtualJoystick.Instance != null ? VirtualJoystick.Instance.InputDirection : Vector2.zero;
            GUILayout.Label($"Res: {Screen.width}x{Screen.height} | Active Touches: {touches}", subStyle);
            GUILayout.Label($"Joystick: ({joystickInput.x:+0.00;-0.00; 0.00}, {joystickInput.y:+0.00;-0.00; 0.00})", subStyle);

            GUILayout.EndArea();
        }

        private void InitStyles()
        {
            if (headerStyle == null)
            {
                headerStyle = new GUIStyle(GUI.skin.label)
                {
                    fontSize = (int)(13 * (Screen.dpi > 0 ? Screen.dpi / 160f : 1f)),
                    richText = true
                };
                headerStyle.normal.textColor = Color.white;
            }

            if (subStyle == null)
            {
                subStyle = new GUIStyle(GUI.skin.label)
                {
                    fontSize = (int)(11 * (Screen.dpi > 0 ? Screen.dpi / 160f : 1f)),
                    richText = true
                };
                subStyle.normal.textColor = new Color(0.85f, 0.85f, 0.85f, 1f);
            }
        }
    }
}

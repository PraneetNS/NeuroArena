using UnityEngine;

namespace NeuroArena.UI
{
    /// <summary>
    /// Lightweight animated popup that appears in world space / screen space
    /// to show exact numerical values when an ML resource is collected.
    /// </summary>
    public class FloatingTextPopup : MonoBehaviour
    {
        private string text = "";
        private Color textColor = Color.cyan;
        private Vector3 worldPosition;
        private float lifeTime = 1.6f;
        private float elapsed = 0f;
        private float verticalSpeed = 1.2f;

        public static void Create(Vector3 worldPos, string message, Color color)
        {
            GameObject go = new GameObject("FloatingPopup");
            FloatingTextPopup popup = go.AddComponent<FloatingTextPopup>();
            popup.text = message;
            popup.textColor = color;
            popup.worldPosition = worldPos + Vector3.up * 1.2f;
        }

        private void Update()
        {
            elapsed += Time.deltaTime;
            worldPosition += Vector3.up * (verticalSpeed * Time.deltaTime);

            if (elapsed >= lifeTime)
            {
                Destroy(gameObject);
            }
        }

        private void OnGUI()
        {
            if (Camera.main == null) return;

            Vector3 screenPos = Camera.main.WorldToScreenPoint(worldPosition);
            if (screenPos.z < 0) return; // Behind camera

            float alpha = Mathf.Clamp01(1f - (elapsed / lifeTime));
            GUIStyle style = new GUIStyle(GUI.skin.label)
            {
                fontSize = (int)(15 * (Screen.dpi > 0 ? Screen.dpi / 160f : 1f)),
                fontStyle = FontStyle.Bold,
                alignment = TextAnchor.MiddleCenter
            };
            style.normal.textColor = new Color(textColor.r, textColor.g, textColor.b, alpha);

            float w = 320f;
            float h = 40f;
            Rect rect = new Rect(screenPos.x - w * 0.5f, Screen.height - screenPos.y - h * 0.5f, w, h);

            GUI.Label(rect, text, style);
        }
    }
}

using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace NeuroArena.UI
{
    /// <summary>
    /// High-performance mobile virtual touch joystick.
    /// Supports both Fixed Position and Dynamic Floating mode (spawns where user touches).
    /// </summary>
    public class VirtualJoystick : MonoBehaviour, IPointerDownHandler, IDragHandler, IPointerUpHandler
    {
        public static VirtualJoystick Instance { get; private set; }

        [Header("Joystick UI Elements")]
        [SerializeField] private RectTransform containerRect;
        [SerializeField] private RectTransform handleRect;
        [SerializeField] private CanvasGroup canvasGroup;

        [Header("Configuration")]
        [Tooltip("Max handle travel distance in pixels.")]
        [SerializeField] private float handleRange = 85f;
        [Tooltip("Deadzone radius below which input is treated as zero.")]
        [SerializeField] private float deadZone = 0.08f;
        [Tooltip("If true, joystick moves to the initial touch point on the left screen side.")]
        [SerializeField] private bool isDynamicFloating = true;
        [Tooltip("Alpha opacity when joystick is idle vs actively pressed.")]
        [Range(0f, 1f)] [SerializeField] private float idleAlpha = 0.45f;
        [Range(0f, 1f)] [SerializeField] private float activeAlpha = 0.95f;

        // Current normalized output vector (X in [-1, 1], Y in [-1, 1])
        public Vector2 InputDirection { get; private set; } = Vector2.zero;
        public bool IsPressed { get; private set; } = false;

        private Vector2 defaultContainerPosition;
        private Canvas parentCanvas;
        private Camera uiCamera;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;

            if (containerRect == null)
                containerRect = GetComponent<RectTransform>();

            if (canvasGroup == null)
                canvasGroup = GetComponent<CanvasGroup>();

            parentCanvas = GetComponentInParent<Canvas>();
            if (parentCanvas != null && parentCanvas.renderMode != RenderMode.ScreenSpaceOverlay)
            {
                uiCamera = parentCanvas.worldCamera;
            }

            if (containerRect != null)
                defaultContainerPosition = containerRect.anchoredPosition;

            SetAlpha(idleAlpha);
        }

        public void OnPointerDown(PointerEventData eventData)
        {
            IsPressed = true;
            SetAlpha(activeAlpha);

            if (isDynamicFloating && containerRect != null && parentCanvas != null)
            {
                RectTransformUtility.ScreenPointToLocalPointInRectangle(
                    parentCanvas.transform as RectTransform,
                    eventData.position,
                    uiCamera,
                    out Vector2 localPoint
                );
                containerRect.anchoredPosition = localPoint;
            }

            OnDrag(eventData);
        }

        public void OnDrag(PointerEventData eventData)
        {
            if (containerRect == null || handleRect == null) return;

            Vector2 position = RectTransformUtility.WorldToScreenPoint(uiCamera, containerRect.position);
            Vector2 rawOffset = (eventData.position - position);
            
            // Adjust for canvas scale
            float scaleFactor = parentCanvas != null ? parentCanvas.scaleFactor : 1f;
            Vector2 offset = rawOffset / scaleFactor;

            // Clamping within handle range
            Vector2 clamped = Vector2.ClampMagnitude(offset, handleRange);
            handleRect.anchoredPosition = clamped;

            // Calculate normalized direction vector
            Vector2 rawDir = clamped / handleRange;
            if (rawDir.magnitude < deadZone)
            {
                InputDirection = Vector2.zero;
            }
            else
            {
                // Smooth deadzone remapping
                float magnitude = Mathf.InverseLerp(deadZone, 1f, rawDir.magnitude);
                InputDirection = rawDir.normalized * magnitude;
            }
        }

        public void OnPointerUp(PointerEventData eventData)
        {
            IsPressed = false;
            InputDirection = Vector2.zero;

            if (handleRect != null)
                handleRect.anchoredPosition = Vector2.zero;

            if (isDynamicFloating && containerRect != null)
                containerRect.anchoredPosition = defaultContainerPosition;

            SetAlpha(idleAlpha);
        }

        private void SetAlpha(float alpha)
        {
            if (canvasGroup != null)
                canvasGroup.alpha = alpha;
        }

        public void ConfigureComponents(RectTransform container, RectTransform handle, CanvasGroup group)
        {
            containerRect = container;
            handleRect = handle;
            canvasGroup = group;
            if (containerRect != null)
                defaultContainerPosition = containerRect.anchoredPosition;
        }
    }
}

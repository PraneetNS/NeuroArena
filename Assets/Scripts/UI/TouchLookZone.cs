using UnityEngine;
using UnityEngine.EventSystems;

namespace NeuroArena.UI
{
    /// <summary>
    /// Touch drag panel on the right side of the screen for camera orbit and orientation.
    /// Filters multi-touch touches cleanly to avoid interference with the joystick.
    /// </summary>
    public class TouchLookZone : MonoBehaviour, IPointerDownHandler, IDragHandler, IPointerUpHandler
    {
        public static TouchLookZone Instance { get; private set; }

        [Header("Sensitivity Settings")]
        [Tooltip("Orbit sensitivity multiplier for touch swipe.")]
        [SerializeField] private float touchSensitivity = 0.12f;
        [Tooltip("Smooth damping for swipe momentum.")]
        [SerializeField] private float smoothing = 18f;

        public Vector2 LookDelta { get; private set; } = Vector2.zero;
        public bool IsDragging { get; private set; } = false;

        private int activePointerId = -1;
        private Vector2 previousTouchPosition;
        private Vector2 targetDelta;

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
            if (!IsDragging)
            {
                targetDelta = Vector2.zero;
            }
            
            // Smooth look delta decay
            LookDelta = Vector2.Lerp(LookDelta, targetDelta, Time.deltaTime * smoothing);
            
            // Clear target delta each frame so continuous movement requires active dragging
            targetDelta = Vector2.zero;
        }

        public void OnPointerDown(PointerEventData eventData)
        {
            if (activePointerId != -1) return; // Already tracking a finger

            activePointerId = eventData.pointerId;
            previousTouchPosition = eventData.position;
            IsDragging = true;
        }

        public void OnDrag(PointerEventData eventData)
        {
            if (eventData.pointerId != activePointerId) return;

            Vector2 currentTouch = eventData.position;
            Vector2 delta = (currentTouch - previousTouchPosition) * touchSensitivity;
            targetDelta = delta;
            previousTouchPosition = currentTouch;
        }

        public void OnPointerUp(PointerEventData eventData)
        {
            if (eventData.pointerId != activePointerId) return;

            activePointerId = -1;
            IsDragging = false;
            targetDelta = Vector2.zero;
        }
    }
}

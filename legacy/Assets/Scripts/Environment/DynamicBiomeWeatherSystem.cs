using System;
using UnityEngine;

namespace NeuroArena.Environment
{
    /// <summary>
    /// Environmental weather perturbation modes affecting gameplay and ML telemetry.
    /// </summary>
    public enum WeatherCondition
    {
        ClearSky,           // Standard baseline conditions
        MagneticIonStorm,   // Adds Gaussian sensor noise to agent observations
        GradientFog,        // Damps agent learning rate and visual clarity
        GlacialChill,       // Increases momentum damping and vehicle friction
        NeuralRain          // Introduces stochastic weight jitter perturbations
    }

    /// <summary>
    /// Runtime weather state with simulation and training modifiers.
    /// </summary>
    [Serializable]
    public struct WeatherState
    {
        public WeatherCondition Condition;
        public float Intensity;             // 0.0 to 1.0
        public float SensorNoiseVariance;   // Standard deviation added to inputs
        public float LearningRateModifier;  // Multiplier for SGD step size
        public float MomentumDampingFactor; // Factor applied to physics momentum
        public string DisplayName;
    }

    /// <summary>
    /// Dynamic Biome Weather and Stochastic Environmental Perturbation System.
    /// Drives live procedural atmospheric events that challenge agents with covariate shifts
    /// and tests model generalization across shifting domain conditions.
    /// </summary>
    public class DynamicBiomeWeatherSystem : MonoBehaviour
    {
        public static DynamicBiomeWeatherSystem Instance { get; private set; }

        [Header("Cycle Settings")]
        [SerializeField] private float cycleDurationSeconds = 45f;
        [SerializeField] private float transitionDurationSeconds = 5f;
        [SerializeField] private bool autoCycleEnabled = true;

        [Header("Active Weather")]
        [SerializeField] private WeatherCondition currentCondition = WeatherCondition.ClearSky;
        [Range(0f, 1f)] [SerializeField] private float currentIntensity = 0f;

        private float cycleTimer = 0f;
        private WeatherState activeState;

        public event Action<WeatherState> OnWeatherChanged;

        public WeatherState ActiveState => activeState;
        public WeatherCondition CurrentCondition => currentCondition;
        public float CurrentIntensity => currentIntensity;

        private void Awake()
        {
            if (Instance == null) Instance = this;
            else Destroy(gameObject);

            ApplyWeatherCondition(WeatherCondition.ClearSky, 0f);
        }

        private void Update()
        {
            if (!autoCycleEnabled) return;

            cycleTimer += Time.deltaTime;
            if (cycleTimer >= cycleDurationSeconds)
            {
                cycleTimer = 0f;
                TransitionToRandomWeather();
            }
        }

        /// <summary>
        /// Selects and applies a random weather condition appropriate for the active biome.
        /// </summary>
        public void TransitionToRandomWeather()
        {
            var conditions = (WeatherCondition[])Enum.GetValues(typeof(WeatherCondition));
            var nextCondition = conditions[UnityEngine.Random.Range(0, conditions.Length)];
            float nextIntensity = UnityEngine.Random.Range(0.4f, 0.95f);

            ApplyWeatherCondition(nextCondition, nextIntensity);
        }

        /// <summary>
        /// Instantly applies a specific weather condition and intensity.
        /// </summary>
        public void ApplyWeatherCondition(WeatherCondition condition, float intensity)
        {
            currentCondition = condition;
            currentIntensity = Mathf.Clamp01(intensity);

            float sensorNoise = 0f;
            float lrMod = 1.0f;
            float momentumDamping = 1.0f;
            string displayName = "Clear Atmosphere";

            switch (condition)
            {
                case WeatherCondition.ClearSky:
                    sensorNoise = 0f;
                    lrMod = 1.0f;
                    momentumDamping = 1.0f;
                    displayName = "Clear Atmosphere";
                    break;

                case WeatherCondition.MagneticIonStorm:
                    sensorNoise = 0.15f * currentIntensity;
                    lrMod = 0.9f;
                    momentumDamping = 0.95f;
                    displayName = "Magnetic Ion Storm (High Noise)";
                    break;

                case WeatherCondition.GradientFog:
                    sensorNoise = 0.05f * currentIntensity;
                    lrMod = Mathf.Lerp(1.0f, 0.4f, currentIntensity);
                    momentumDamping = 1.0f;
                    displayName = "Dense Gradient Fog (LR Damping)";
                    break;

                case WeatherCondition.GlacialChill:
                    sensorNoise = 0.02f;
                    lrMod = 0.85f;
                    momentumDamping = Mathf.Lerp(1.0f, 0.6f, currentIntensity);
                    displayName = "Glacial Chill (Friction Surge)";
                    break;

                case WeatherCondition.NeuralRain:
                    sensorNoise = 0.08f * currentIntensity;
                    lrMod = 1.15f; // Encourages escape from local minima
                    momentumDamping = 0.9f;
                    displayName = "Neural Rain (Stochastic Jitter)";
                    break;
            }

            activeState = new WeatherState
            {
                Condition = currentCondition,
                Intensity = currentIntensity,
                SensorNoiseVariance = sensorNoise,
                LearningRateModifier = lrMod,
                MomentumDampingFactor = momentumDamping,
                DisplayName = displayName
            };

            OnWeatherChanged?.Invoke(activeState);
        }

        /// <summary>
        /// Injects Gaussian noise into an observation vector based on current weather state.
        /// </summary>
        public float[] PerturbObservations(float[] originalObservations)
        {
            if (originalObservations == null || activeState.SensorNoiseVariance <= 0f)
            {
                return originalObservations;
            }

            float[] perturbed = new float[originalObservations.Length];
            for (int i = 0; i < originalObservations.Length; i++)
            {
                float u1 = 1.0f - UnityEngine.Random.value;
                float u2 = 1.0f - UnityEngine.Random.value;
                float randStdNormal = Mathf.Sqrt(-2.0f * Mathf.Log(u1)) * Mathf.Sin(2.0f * Mathf.PI * u2);
                perturbed[i] = originalObservations[i] + (randStdNormal * activeState.SensorNoiseVariance);
            }

            return perturbed;
        }
    }
}

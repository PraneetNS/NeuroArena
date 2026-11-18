using System;
using UnityEngine;

namespace NeuroArena.ML.Reinforcement
{
    /// <summary>
    /// Multi-Agent Reinforcement Learning (MARL) agent utilizing Regret-Matching (Hart & Mas-Colell)
    /// and Counterfactual Regret (CFR) minimization for game-theoretic competitive and cooperative
    /// biome arena combat. Dynamically blends local empirical regrets with server-orchestrated profiles.
    /// </summary>
    public class CounterfactualRegretAgent : MonoBehaviour
    {
        public enum TacticalAction
        {
            Harvester = 0,  // Focuses on high-yield crystal node extraction
            Flanker = 1,    // High-mobility radial positioning to pressure flanks
            Defender = 2,   // Shielded territorial anchoring and defensive perimeter
            Disruptor = 3   // Adversarial perturbation and sensory noise jamming
        }

        [Header("MARL Regret Configuration")]
        [SerializeField] private float explorationEpsilon = 0.05f;
        [SerializeField] private float regretDiscount = 0.995f; // Regret discounting factor (CFR+)
        [SerializeField] private float serverProfileBlendWeight = 0.35f;
        [SerializeField] private int actionCount = 4;

        // Cumulative positive and negative regrets: R(a)
        private float[] _cumulativeRegrets;
        // Cumulative strategy profile across iterations for Nash convergence
        private float[] _strategySum;
        // Current normalized strategy distribution
        private float[] _currentStrategy;
        // Server-injected equilibrium strategy profile
        private float[] _serverEquilibriumProfile;

        // Statistics
        private int _iterationCount = 0;
        private float _lastObservedUtility = 0f;
        private float _runningAverageExploitability = 0f;

        public float[] CurrentStrategy => (float[])_currentStrategy.Clone();
        public float[] CumulativeRegrets => (float[])_cumulativeRegrets.Clone();
        public float RunningAverageExploitability => _runningAverageExploitability;
        public int IterationCount => _iterationCount;

        private void Awake()
        {
            InitializeAgent();
        }

        public void InitializeAgent(float[] initialProfile = null)
        {
            _cumulativeRegrets = new float[actionCount];
            _strategySum = new float[actionCount];
            _currentStrategy = new float[actionCount];
            _serverEquilibriumProfile = new float[actionCount];

            float defaultProb = 1f / actionCount;
            for (int i = 0; i < actionCount; i++)
            {
                _cumulativeRegrets[i] = 0f;
                _strategySum[i] = 0f;
                _currentStrategy[i] = defaultProb;
                _serverEquilibriumProfile[i] = (initialProfile != null && initialProfile.Length > i) 
                    ? initialProfile[i] 
                    : defaultProb;
            }
            _iterationCount = 0;
        }

        /// <summary>
        /// Updates the current mixed strategy via Regret-Matching.
        /// Probability of choosing action 'a' is proportional to positive cumulative regret R+(a).
        /// </summary>
        public float[] ComputeRegretMatchingStrategy()
        {
            float positiveRegretSum = 0f;
            float[] positiveRegrets = new float[actionCount];

            for (int i = 0; i < actionCount; i++)
            {
                positiveRegrets[i] = Mathf.Max(0f, _cumulativeRegrets[i]);
                positiveRegretSum += positiveRegrets[i];
            }

            for (int i = 0; i < actionCount; i++)
            {
                if (positiveRegretSum > 0.0001f)
                {
                    _currentStrategy[i] = positiveRegrets[i] / positiveRegretSum;
                }
                else
                {
                    _currentStrategy[i] = 1f / actionCount;
                }

                // Add epsilon-exploration smoothing
                _currentStrategy[i] = (1f - explorationEpsilon) * _currentStrategy[i] + (explorationEpsilon / actionCount);
            }

            // Blend with authoritative server profile if available
            if (serverProfileBlendWeight > 0f)
            {
                for (int i = 0; i < actionCount; i++)
                {
                    _currentStrategy[i] = Mathf.Lerp(_currentStrategy[i], _serverEquilibriumProfile[i], serverProfileBlendWeight);
                }
                NormalizeStrategy(_currentStrategy);
            }

            // Accumulate to long-term average strategy profile
            for (int i = 0; i < actionCount; i++)
            {
                _strategySum[i] += _currentStrategy[i];
            }

            return (float[])_currentStrategy.Clone();
        }

        /// <summary>
        /// Samples a discrete tactical action according to the current regret-matching distribution.
        /// </summary>
        public TacticalAction SampleAction()
        {
            ComputeRegretMatchingStrategy();
            float sample = UnityEngine.Random.value;
            float cumulative = 0f;

            for (int i = 0; i < actionCount; i++)
            {
                cumulative += _currentStrategy[i];
                if (sample <= cumulative || i == actionCount - 1)
                {
                    return (TacticalAction)i;
                }
            }

            return TacticalAction.Harvester;
        }

        /// <summary>
        /// Ingests post-round payoffs for all actions under the observed opponent action,
        /// updating cumulative counterfactual regrets (CFR+ clipping to non-negative when desired).
        /// </summary>
        /// <param name="actionUtilities">Array of payoffs agent would have received for each action</param>
        /// <param name="chosenAction">Index of the action actually executed</param>
        public void UpdateCounterfactualRegrets(float[] actionUtilities, TacticalAction chosenAction)
        {
            if (actionUtilities == null || actionUtilities.Length < actionCount) return;

            int chosenIdx = (int)chosenAction;
            _lastObservedUtility = actionUtilities[chosenIdx];
            _iterationCount++;

            float maxAlternativeUtility = float.MinValue;

            // Calculate instantaneous regret: r(a) = u(a) - u(chosenAction)
            for (int i = 0; i < actionCount; i++)
            {
                float instantRegret = actionUtilities[i] - _lastObservedUtility;
                // CFR+ discounting and positive accumulation
                _cumulativeRegrets[i] = Mathf.Max(0f, (_cumulativeRegrets[i] * regretDiscount) + instantRegret);

                if (actionUtilities[i] > maxAlternativeUtility)
                {
                    maxAlternativeUtility = actionUtilities[i];
                }
            }

            // Instantaneous exploitability metric: max_a u(a) - u(chosen)
            float instantExploitability = Mathf.Max(0f, maxAlternativeUtility - _lastObservedUtility);
            _runningAverageExploitability = Mathf.Lerp(_runningAverageExploitability, instantExploitability, 0.05f);
        }

        /// <summary>
        /// Synchronizes the global equilibrium profile received from the server CFR solver.
        /// </summary>
        public void IngestServerEquilibriumProfile(float[] profile)
        {
            if (profile != null && profile.Length == actionCount)
            {
                Array.Copy(profile, _serverEquilibriumProfile, actionCount);
                NormalizeStrategy(_serverEquilibriumProfile);
            }
        }

        /// <summary>
        /// Computes the empirical average strategy converged over all historical iterations.
        /// (In zero-sum games, the average strategy converges to Nash Equilibrium).
        /// </summary>
        public float[] GetAverageNashConvergenceStrategy()
        {
            float[] avg = new float[actionCount];
            float sum = 0f;
            for (int i = 0; i < actionCount; i++) sum += _strategySum[i];

            for (int i = 0; i < actionCount; i++)
            {
                avg[i] = (sum > 0.0001f) ? (_strategySum[i] / sum) : (1f / actionCount);
            }
            return avg;
        }

        private void NormalizeStrategy(float[] strategy)
        {
            float sum = 0f;
            for (int i = 0; i < strategy.Length; i++) sum += Mathf.Max(0f, strategy[i]);
            if (sum > 0.00001f)
            {
                for (int i = 0; i < strategy.Length; i++) strategy[i] = Mathf.Max(0f, strategy[i]) / sum;
            }
        }
    }
}

using System;
using System.Collections.Generic;
using UnityEngine;

namespace NeuroArena.ML
{
    public enum ModelCheckpointTag
    {
        Archived,
        Staging,
        ProductionCandidate,
        Champion
    }

    [Serializable]
    public class ExperimentRun
    {
        public string runId;
        public string runName;
        public string architecture;
        public string optimizer;
        public float learningRate;
        public float weightDecay;
        public int epochs;
        public float initialLoss;
        public float finalLoss;
        public float validationAccuracy;
        public float f1Score;
        public float rocAuc;
        public float gradientNorm;
        public string timestampUtc;
        public ModelCheckpointTag tag;
        public float[] lossCurve;
    }

    /// <summary>
    /// Production Experiment Tracker & Model Registry (Weights & Biases / MLflow style).
    /// Tracks and compares training runs, logs hyperparameter diffs, and registers champion models.
    /// </summary>
    public class ExperimentTracker : MonoBehaviour
    {
        public static ExperimentTracker Instance { get; private set; }

        public event Action<ExperimentRun> OnRunLogged;
        public event Action<ExperimentRun> OnChampionPromoted;

        private readonly List<ExperimentRun> loggedRuns = new List<ExperimentRun>();
        private ExperimentRun currentChampionRun;

        public IReadOnlyList<ExperimentRun> LoggedRuns => loggedRuns;
        public ExperimentRun CurrentChampionRun => currentChampionRun;

        private void Awake()
        {
            if (Instance == null)
            {
                Instance = this;
                DontDestroyOnLoad(gameObject);
            }
            else
            {
                Destroy(gameObject);
            }
        }

        public ExperimentRun LogTrainingRun(
            string architecture,
            string optimizer,
            float lr,
            float decay,
            int epochs,
            float initLoss,
            float finalLoss,
            float valAcc,
            float f1,
            float auc,
            float gradNorm,
            float[] lossCurve = null)
        {
            string runId = $"RUN-{Guid.NewGuid().ToString("N").Substring(0, 6).ToUpper()}";
            string dateStr = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ");

            ExperimentRun run = new ExperimentRun
            {
                runId = runId,
                runName = $"{architecture}_{optimizer}_{epochs}ep",
                architecture = architecture,
                optimizer = optimizer,
                learningRate = lr,
                weightDecay = decay,
                epochs = epochs,
                initialLoss = initLoss,
                finalLoss = finalLoss,
                validationAccuracy = valAcc,
                f1Score = f1,
                rocAuc = auc,
                gradientNorm = gradNorm,
                timestampUtc = dateStr,
                tag = ModelCheckpointTag.Staging,
                lossCurve = lossCurve
            };

            loggedRuns.Add(run);
            Debug.Log($"[ExperimentTracker] Logged Experiment {run.runId} ({run.runName}) | Final Loss: {finalLoss:F4} | F1: {f1:F3}");

            // Auto-evaluate champion status
            if (currentChampionRun == null || (run.finalLoss < currentChampionRun.finalLoss && run.validationAccuracy >= currentChampionRun.validationAccuracy))
            {
                PromoteToChampion(run);
            }

            OnRunLogged?.Invoke(run);
            return run;
        }

        public void PromoteToChampion(ExperimentRun run)
        {
            if (currentChampionRun != null)
            {
                currentChampionRun.tag = ModelCheckpointTag.ProductionCandidate;
            }

            run.tag = ModelCheckpointTag.Champion;
            currentChampionRun = run;
            Debug.Log($"[ExperimentTracker] 🏆 NEW CHAMPION PROMOTED: {run.runId} ({run.runName}) with F1={run.f1Score:F3}, Loss={run.finalLoss:F4}");
            OnChampionPromoted?.Invoke(run);
        }

        public ExperimentComparisonDelta CompareRuns(ExperimentRun baseline, ExperimentRun candidate)
        {
            if (baseline == null || candidate == null) return null;

            return new ExperimentComparisonDelta
            {
                runIdA = baseline.runId,
                runIdB = candidate.runId,
                lossDelta = candidate.finalLoss - baseline.finalLoss,
                accuracyDelta = candidate.validationAccuracy - baseline.validationAccuracy,
                f1Delta = candidate.f1Score - baseline.f1Score,
                rocAucDelta = candidate.rocAuc - baseline.rocAuc,
                learningRateRatio = baseline.learningRate > 0 ? candidate.learningRate / baseline.learningRate : 1f,
                isCandidateBetter = (candidate.finalLoss <= baseline.finalLoss && candidate.validationAccuracy >= baseline.validationAccuracy)
            };
        }

        public List<ExperimentRun> GetParetoFrontier()
        {
            var frontier = new List<ExperimentRun>();
            foreach (var candidate in loggedRuns)
            {
                bool isDominated = false;
                foreach (var other in loggedRuns)
                {
                    if (other == candidate) continue;
                    if (other.finalLoss <= candidate.finalLoss &&
                        other.validationAccuracy >= candidate.validationAccuracy &&
                        other.f1Score >= candidate.f1Score &&
                        (other.finalLoss < candidate.finalLoss || other.validationAccuracy > candidate.validationAccuracy || other.f1Score > candidate.f1Score))
                    {
                        isDominated = true;
                        break;
                    }
                }
                if (!isDominated)
                {
                    frontier.Add(candidate);
                }
            }
            return frontier;
        }

        public void ClearHistory()
        {
            loggedRuns.Clear();
            currentChampionRun = null;
        }
    }

    [Serializable]
    public class ExperimentComparisonDelta
    {
        public string runIdA;
        public string runIdB;
        public float lossDelta;
        public float accuracyDelta;
        public float f1Delta;
        public float rocAucDelta;
        public float learningRateRatio;
        public bool isCandidateBetter;
    }
}

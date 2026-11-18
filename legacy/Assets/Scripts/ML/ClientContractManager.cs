using System;
using System.Collections.Generic;
using UnityEngine;
using NeuroArena.Data;

namespace NeuroArena.ML
{
    public enum ContractClientTier
    {
        Tier1_Startup,
        Tier2_Biotech,
        Tier3_FinTech,
        Tier4_AutoDrive,
        Tier5_DeepSpaceAI
    }

    [Serializable]
    public class ClientContract
    {
        public string contractId;
        public string clientName;
        public string projectTitle;
        public string description;
        public ContractClientTier tier;
        public string requiredArchitecture; // "LinearRegression", "LogisticClassifier", "DecisionTree", "NeuralNetwork"
        public float requiredMetricThreshold; // Accuracy >= X or Loss <= Y
        public bool isLossMetric;
        public float maxAllowedLatencyMs;
        public int rewardComputeCredits;
        public int rewardQuantumShards;
        public int clientReputationGain;
        public bool isCompleted;
    }

    /// <summary>
    /// Freelance Client Contract System (inspired by 'while True: learn()').
    /// Players accept engineering contracts from corporate clients with specific accuracy,
    /// loss, and latency SLA constraints to earn Compute Credits, Hard Currency, and Reputation.
    /// </summary>
    public class ClientContractManager : MonoBehaviour
    {
        public static ClientContractManager Instance { get; private set; }

        public event Action<ClientContract> OnContractCompleted;
        public event Action<int> OnReputationUpdated;

        [Header("Corporate Reputation")]
        [SerializeField] private int totalReputationScore = 0;
        [SerializeField] private List<ClientContract> activeContracts = new List<ClientContract>();

        public int TotalReputationScore => totalReputationScore;
        public IReadOnlyList<ClientContract> ActiveContracts => activeContracts;

        private void Awake()
        {
            if (Instance == null)
            {
                Instance = this;
                DontDestroyOnLoad(gameObject);
                GenerateContractCatalog();
            }
            else
            {
                Destroy(gameObject);
            }
        }

        private void GenerateContractCatalog()
        {
            activeContracts = new List<ClientContract>
            {
                new ClientContract
                {
                    contractId = "contract_greenenergy_01",
                    clientName = "Solaris Dynamics",
                    projectTitle = "Photovoltaic Power Output Estimator",
                    description = "Fit a continuous polynomial regression model to predict solar panel energy yields against sunlight angle.",
                    tier = ContractClientTier.Tier1_Startup,
                    requiredArchitecture = "LinearRegression",
                    requiredMetricThreshold = 0.04f,
                    isLossMetric = true,
                    maxAllowedLatencyMs = 25.0f,
                    rewardComputeCredits = 300,
                    rewardQuantumShards = 15,
                    clientReputationGain = 50
                },
                new ClientContract
                {
                    contractId = "contract_biogen_02",
                    clientName = "BioGen Cellular",
                    projectTitle = "Malignant Cell Boundary Classifier",
                    description = "Train a high-precision Decision Tree / Logistic model to separate cellular pathology markers with zero false negatives.",
                    tier = ContractClientTier.Tier2_Biotech,
                    requiredArchitecture = "DecisionTree",
                    requiredMetricThreshold = 0.92f,
                    isLossMetric = false,
                    maxAllowedLatencyMs = 12.0f,
                    rewardComputeCredits = 550,
                    rewardQuantumShards = 30,
                    clientReputationGain = 120
                },
                new ClientContract
                {
                    contractId = "contract_fintech_03",
                    clientName = "Apex Quantitative",
                    projectTitle = "High-Frequency Arbitrage Anomaly Detector",
                    description = "Synthesize an Adam-optimized Deep Neural Network to detect microsecond liquidity spikes in volatile feature spaces.",
                    tier = ContractClientTier.Tier3_FinTech,
                    requiredArchitecture = "NeuralNetwork",
                    requiredMetricThreshold = 0.95f,
                    isLossMetric = false,
                    maxAllowedLatencyMs = 8.0f,
                    rewardComputeCredits = 900,
                    rewardQuantumShards = 60,
                    clientReputationGain = 250
                },
                new ClientContract
                {
                    contractId = "contract_autodrive_04",
                    clientName = "Veloce Mobility",
                    projectTitle = "Autonomous Obstacle Policy & Steering Model",
                    description = "Deploy an ensemble policy model with low latency SLA (<5ms) to navigate real-time road hazard obstacles.",
                    tier = ContractClientTier.Tier4_AutoDrive,
                    requiredArchitecture = "NeuralNetwork",
                    requiredMetricThreshold = 0.035f,
                    isLossMetric = true,
                    maxAllowedLatencyMs = 5.0f,
                    rewardComputeCredits = 1400,
                    rewardQuantumShards = 100,
                    clientReputationGain = 400
                }
            };
        }

        public bool EvaluateContractSubmission(string contractId, float achievedMetric, float measuredLatencyMs)
        {
            ClientContract contract = activeContracts.Find(c => c.contractId == contractId);
            if (contract == null || contract.isCompleted) return false;

            bool metricPassed = contract.isLossMetric ? (achievedMetric <= contract.requiredMetricThreshold) : (achievedMetric >= contract.requiredMetricThreshold);
            bool latencyPassed = measuredLatencyMs <= contract.maxAllowedLatencyMs;

            if (metricPassed && latencyPassed)
            {
                contract.isCompleted = true;
                totalReputationScore += contract.clientReputationGain;

                if (EconomyManager.Instance != null)
                {
                    EconomyManager.Instance.AddComputeCredits(contract.rewardComputeCredits, $"Contract_{contract.clientName}");
                    EconomyManager.Instance.AddQuantumShards(contract.rewardQuantumShards, $"Contract_{contract.clientName}");
                }

                Debug.Log($"[ClientContract] CONTRACT COMPLETE: '{contract.projectTitle}' for {contract.clientName}! Payout: +{contract.rewardComputeCredits} Credits, +{contract.rewardQuantumShards} Shards");
                OnContractCompleted?.Invoke(contract);
                OnReputationUpdated?.Invoke(totalReputationScore);
                return true;
            }

            Debug.LogWarning($"[ClientContract] Submission rejected for {contract.projectTitle}: Metric Passed={metricPassed} ({achievedMetric} vs {contract.requiredMetricThreshold}), Latency Passed={latencyPassed} ({measuredLatencyMs:F1}ms vs {contract.maxAllowedLatencyMs:F1}ms)");
            return false;
        }
    }
}

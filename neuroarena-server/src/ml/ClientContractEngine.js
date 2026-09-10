/**
 * ⚡ NeuroArena: Client Contract Engine (Freelance ML Marketplace)
 *
 * Implements corporate ML engineering contracts inspired by 'while True: learn()':
 * - 5 Corporate Tiers (Startup, Biotech, FinTech, AutoDrive, DeepSpaceAI)
 * - Strict SLA constraints: Accuracy >= X, Loss <= Y, Max Latency <= Z ms
 * - Reputation scoring ledger and tier unlocking
 * - SLA bonus rewards for low-latency and high-accuracy submissions
 */

const ContractClientTier = {
    Tier1_Startup: { id: "Tier1_Startup", minReputation: 0, title: "Startup Incubator" },
    Tier2_Biotech: { id: "Tier2_Biotech", minReputation: 100, title: "Biotech Research" },
    Tier3_FinTech: { id: "Tier3_FinTech", minReputation: 350, title: "FinTech Quant Lab" },
    Tier4_AutoDrive: { id: "Tier4_AutoDrive", minReputation: 900, title: "Autonomous Robotics" },
    Tier5_DeepSpaceAI: { id: "Tier5_DeepSpaceAI", minReputation: 2200, title: "Deep Space AI Consortium" }
};

const CORPORATE_CLIENT_TEMPLATES = [
    {
        id: "contract_startup_01",
        clientName: "Nexus BioHealth",
        projectTitle: "Patient Biomarker Early Detection",
        description: "Develop a lightweight binary logistic classifier for mobile clinic screening with high sensitivity.",
        tier: "Tier1_Startup",
        requiredArchitecture: "LogisticClassifier",
        requiredMetricThreshold: 0.88,
        isLossMetric: false,
        maxAllowedLatencyMs: 18.0,
        rewardComputeCredits: 300,
        rewardQuantumShards: 2,
        clientReputationGain: 25
    },
    {
        id: "contract_startup_02",
        clientName: "EcoHarvest Agritech",
        projectTitle: "Soil Moisture Regression Surface",
        description: "Predict irrigation needs across varying topographies using 2D polynomial regression.",
        tier: "Tier1_Startup",
        requiredArchitecture: "LinearRegression",
        requiredMetricThreshold: 0.08,
        isLossMetric: true,
        maxAllowedLatencyMs: 15.0,
        rewardComputeCredits: 350,
        rewardQuantumShards: 2,
        clientReputationGain: 30
    },
    {
        id: "contract_biotech_01",
        clientName: "BioGen Cellular",
        projectTitle: "Protein Folding Domain Classification",
        description: "Classify amino acid sequence structural stability under thermal variance.",
        tier: "Tier2_Biotech",
        requiredArchitecture: "NeuralNetwork",
        requiredMetricThreshold: 0.92,
        isLossMetric: false,
        maxAllowedLatencyMs: 12.0,
        rewardComputeCredits: 750,
        rewardQuantumShards: 5,
        clientReputationGain: 55
    },
    {
        id: "contract_fintech_01",
        clientName: "QuantEdge Global",
        projectTitle: "Sub-Millisecond Volatility Arbitrage",
        description: "Estimate microsecond asset price drift under sudden market order flow imbalances.",
        tier: "Tier3_FinTech",
        requiredArchitecture: "NeuralNetwork",
        requiredMetricThreshold: 0.035,
        isLossMetric: true,
        maxAllowedLatencyMs: 7.5,
        rewardComputeCredits: 1600,
        rewardQuantumShards: 12,
        clientReputationGain: 110
    },
    {
        id: "contract_autodrive_01",
        clientName: "NeuroDrive Systems",
        projectTitle: "Urban Raycast Obstacle Avoidance",
        description: "Real-time edge drone steering policy executing on embedded automotive silicon.",
        tier: "Tier4_AutoDrive",
        requiredArchitecture: "NeuralNetwork",
        requiredMetricThreshold: 0.965,
        isLossMetric: false,
        maxAllowedLatencyMs: 4.8,
        rewardComputeCredits: 3200,
        rewardQuantumShards: 25,
        clientReputationGain: 220
    },
    {
        id: "contract_deepspace_01",
        clientName: "AstroSynthetics Corp",
        projectTitle: "Deep Space Pulsar Signal Reconstruction",
        description: "De-noise cosmic background radiation bursts using deep non-linear latent representations.",
        tier: "Tier5_DeepSpaceAI",
        requiredArchitecture: "NeuralNetwork",
        requiredMetricThreshold: 0.0095,
        isLossMetric: true,
        maxAllowedLatencyMs: 3.0,
        rewardComputeCredits: 6500,
        rewardQuantumShards: 50,
        clientReputationGain: 450
    }
];

class ClientContractEngine {
    constructor() {
        this.contracts = new Map();
        CORPORATE_CLIENT_TEMPLATES.forEach(c => this.contracts.set(c.id, { ...c }));
    }

    /**
     * Retrieves active contracts available to player based on current reputation.
     */
    getAvailableContracts(playerReputation = 0) {
        const available = [];
        for (const contract of this.contracts.values()) {
            const tierConfig = ContractClientTier[contract.tier];
            const isUnlocked = playerReputation >= (tierConfig ? tierConfig.minReputation : 0);
            available.push({
                ...contract,
                isUnlocked,
                minReputationRequired: tierConfig ? tierConfig.minReputation : 0
            });
        }
        return available;
    }

    /**
     * Evaluates a model submission against contract SLA specifications.
     */
    evaluateSubmission(contractId, submission) {
        const contract = this.contracts.get(contractId);
        if (!contract) {
            return {
                passed: false,
                reason: "CONTRACT_NOT_FOUND",
                details: `Contract ${contractId} does not exist.`
            };
        }

        const { achievedMetric, measuredLatencyMs, architecture } = submission;

        // 1. Architecture Check
        if (contract.requiredArchitecture && architecture !== contract.requiredArchitecture) {
            return {
                passed: false,
                reason: "ARCHITECTURE_MISMATCH",
                details: `Required: ${contract.requiredArchitecture}, Received: ${architecture}`
            };
        }

        // 2. Latency SLA Check
        if (measuredLatencyMs > contract.maxAllowedLatencyMs) {
            return {
                passed: false,
                reason: "LATENCY_SLA_BREACH",
                details: `Measured latency ${measuredLatencyMs.toFixed(2)}ms exceeds SLA limit of ${contract.maxAllowedLatencyMs.toFixed(2)}ms`
            };
        }

        // 3. Metric SLA Check (Accuracy vs Loss)
        let metricPassed = false;
        if (contract.isLossMetric) {
            metricPassed = achievedMetric <= contract.requiredMetricThreshold;
        } else {
            metricPassed = achievedMetric >= contract.requiredMetricThreshold;
        }

        if (!metricPassed) {
            return {
                passed: false,
                reason: "ACCURACY_OR_LOSS_SLA_BREACH",
                details: contract.isLossMetric
                    ? `Loss ${achievedMetric.toFixed(4)} exceeds maximum threshold of ${contract.requiredMetricThreshold.toFixed(4)}`
                    : `Accuracy ${(achievedMetric * 100).toFixed(1)}% is below minimum threshold of ${(contract.requiredMetricThreshold * 100).toFixed(1)}%`
            };
        }

        // 4. Calculate SLA Performance Bonuses
        // Low Latency Bonus: up to 1.5x credits if latency is half the SLA ceiling
        const latencyHeadroom = Math.max(0, (contract.maxAllowedLatencyMs - measuredLatencyMs) / contract.maxAllowedLatencyMs);
        const latencyBonusMult = 1.0 + Math.min(0.5, latencyHeadroom * 0.5);

        // Quality Bonus: up to 1.3x credits if metric significantly outperforms target
        let qualityBonusMult = 1.0;
        if (!contract.isLossMetric && achievedMetric > contract.requiredMetricThreshold) {
            qualityBonusMult += Math.min(0.3, (achievedMetric - contract.requiredMetricThreshold) * 2.0);
        } else if (contract.isLossMetric && achievedMetric < contract.requiredMetricThreshold) {
            qualityBonusMult += Math.min(0.3, (contract.requiredMetricThreshold - achievedMetric) * 5.0);
        }

        const totalCreditsAwarded = Math.round(contract.rewardComputeCredits * latencyBonusMult * qualityBonusMult);
        const totalReputationAwarded = contract.clientReputationGain;
        const totalShardsAwarded = contract.rewardQuantumShards;

        return {
            passed: true,
            contractId: contract.id,
            clientName: contract.clientName,
            achievedMetric,
            measuredLatencyMs,
            creditsAwarded: totalCreditsAwarded,
            quantumShardsAwarded: totalShardsAwarded,
            reputationAwarded: totalReputationAwarded,
            bonuses: {
                latencyHeadroomPercent: (latencyHeadroom * 100).toFixed(1),
                latencyMultiplier: latencyBonusMult.toFixed(2),
                qualityMultiplier: qualityBonusMult.toFixed(2)
            }
        };
    }
}

module.exports = {
    ContractClientTier,
    CORPORATE_CLIENT_TEMPLATES,
    ClientContractEngine
};

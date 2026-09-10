/**
 * ClientContractClient.js
 * 
 * Production Client Module for Corporate ML Freelance Contracts (inspired by 'while True: learn()').
 * Allows players to review corporate client requests, evaluate model performance against SLAs,
 * claim rewards, and accumulate reputation.
 */

export class ClientContractClient {
  constructor(apiBaseUrl = "http://localhost:2567/api") {
    this.apiBaseUrl = apiBaseUrl;
    this.reputation = 0;
    this.activeContracts = [];
    this.completedContracts = new Set();
    this.onReputationChanged = null;
    this.onContractCompleted = null;

    // Local storage fallback for offline support
    this.loadPersistedState();
  }

  loadPersistedState() {
    try {
      if (typeof localStorage !== "undefined") {
        const savedRep = localStorage.getItem("neuroarena_contract_rep");
        if (savedRep) this.reputation = parseInt(savedRep, 10);
        const savedCompleted = localStorage.getItem("neuroarena_completed_contracts");
        if (savedCompleted) this.completedContracts = new Set(JSON.parse(savedCompleted));
      }
    } catch (e) {
      // Graceful fallback
    }
  }

  savePersistedState() {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("neuroarena_contract_rep", this.reputation.toString());
        localStorage.setItem("neuroarena_completed_contracts", JSON.stringify([...this.completedContracts]));
      }
    } catch (e) {
      // Graceful fallback
    }
  }

  /**
   * Fetches corporate contracts matching player reputation from server,
   * falling back to offline deterministic catalog if server is unreachable.
   */
  async fetchContracts() {
    try {
      if (typeof fetch !== "undefined") {
        const res = await fetch(`${this.apiBaseUrl}/contracts?reputation=${this.reputation}`);
        if (res.ok) {
          const data = await res.json();
          if (data.contracts) {
            this.activeContracts = data.contracts.map(c => ({
              ...c,
              isCompleted: this.completedContracts.has(c.id)
            }));
            return this.activeContracts;
          }
        }
      }
    } catch (e) {
      // Offline fallback
    }

    // Fallback Offline Corporate Catalog
    this.activeContracts = [
      {
        id: "contract_startup_01",
        clientName: "Nexus BioHealth",
        projectTitle: "Patient Biomarker Early Detection",
        tier: "Tier1_Startup",
        requiredArchitecture: "LogisticClassifier",
        requiredMetricThreshold: 0.88,
        isLossMetric: false,
        maxAllowedLatencyMs: 18.0,
        rewardComputeCredits: 300,
        rewardQuantumShards: 2,
        clientReputationGain: 25,
        isUnlocked: true,
        isCompleted: this.completedContracts.has("contract_startup_01")
      },
      {
        id: "contract_startup_02",
        clientName: "EcoHarvest Agritech",
        projectTitle: "Soil Moisture Regression Surface",
        tier: "Tier1_Startup",
        requiredArchitecture: "LinearRegression",
        requiredMetricThreshold: 0.08,
        isLossMetric: true,
        maxAllowedLatencyMs: 15.0,
        rewardComputeCredits: 350,
        rewardQuantumShards: 2,
        clientReputationGain: 30,
        isUnlocked: true,
        isCompleted: this.completedContracts.has("contract_startup_02")
      },
      {
        id: "contract_biotech_01",
        clientName: "BioGen Cellular",
        projectTitle: "Protein Folding Domain Classification",
        tier: "Tier2_Biotech",
        requiredArchitecture: "NeuralNetwork",
        requiredMetricThreshold: 0.92,
        isLossMetric: false,
        maxAllowedLatencyMs: 12.0,
        rewardComputeCredits: 750,
        rewardQuantumShards: 5,
        clientReputationGain: 55,
        isUnlocked: this.reputation >= 100,
        isCompleted: this.completedContracts.has("contract_biotech_01")
      }
    ];

    return this.activeContracts;
  }

  /**
   * Evaluates a trained model against the selected contract SLA.
   */
  async submitModelForContract(contractId, submission) {
    const { achievedMetric, measuredLatencyMs, architecture } = submission;

    // 1. Attempt Server Submission
    try {
      if (typeof fetch !== "undefined") {
        const res = await fetch(`${this.apiBaseUrl}/contracts/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contractId, achievedMetric, measuredLatencyMs, architecture })
        });
        if (res.ok) {
          const result = await res.json();
          if (result.passed) {
            this.handleSuccessfulCompletion(contractId, result.reputationAwarded);
          }
          return result;
        }
      }
    } catch (e) {
      // Offline local evaluation fallback
    }

    // 2. Offline Fallback SLA Evaluation
    const contract = this.activeContracts.find(c => c.id === contractId);
    if (!contract) {
      return { passed: false, reason: "CONTRACT_NOT_FOUND" };
    }

    if (contract.requiredArchitecture && architecture !== contract.requiredArchitecture) {
      return { passed: false, reason: "ARCHITECTURE_MISMATCH" };
    }

    if (measuredLatencyMs > contract.maxAllowedLatencyMs) {
      return { passed: false, reason: "LATENCY_SLA_BREACH" };
    }

    const metricPassed = contract.isLossMetric
      ? achievedMetric <= contract.requiredMetricThreshold
      : achievedMetric >= contract.requiredMetricThreshold;

    if (!metricPassed) {
      return { passed: false, reason: "ACCURACY_OR_LOSS_SLA_BREACH" };
    }

    this.handleSuccessfulCompletion(contractId, contract.clientReputationGain);

    return {
      passed: true,
      contractId,
      clientName: contract.clientName,
      achievedMetric,
      measuredLatencyMs,
      creditsAwarded: contract.rewardComputeCredits,
      quantumShardsAwarded: contract.rewardQuantumShards,
      reputationAwarded: contract.clientReputationGain,
      bonuses: { latencyMultiplier: "1.00", qualityMultiplier: "1.00" }
    };
  }

  handleSuccessfulCompletion(contractId, repGain) {
    this.completedContracts.add(contractId);
    this.reputation += repGain;
    this.savePersistedState();

    if (typeof this.onReputationChanged === "function") {
      this.onReputationChanged(this.reputation);
    }
    if (typeof this.onContractCompleted === "function") {
      this.onContractCompleted(contractId, repGain);
    }
  }
}

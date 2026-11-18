using System;
using UnityEngine;

namespace NeuroArena.Data
{
    /// <summary>
    /// Production Economy & Monetization Manager.
    /// Manages:
    /// - Compute Credits (Soft currency earned in-game).
    /// - Quantum Shards (Hard currency).
    /// - Transaction audit, item purchases, and balance persistence.
    /// </summary>
    public class EconomyManager : MonoBehaviour
    {
        public static EconomyManager Instance { get; private set; }

        public event Action<int, int> OnBalanceChanged; // computeCredits, quantumShards
        public event Action<string, bool> OnPurchaseResult; // itemId, success

        [Header("Balances")]
        [SerializeField] private int computeCredits = 500;
        [SerializeField] private int quantumShards = 50;

        public int ComputeCredits => computeCredits;
        public int QuantumShards => quantumShards;

        private const string PREF_CREDITS = "neuroarena_compute_credits";
        private const string PREF_SHARDS = "neuroarena_quantum_shards";

        private void Awake()
        {
            if (Instance == null)
            {
                Instance = this;
                DontDestroyOnLoad(gameObject);
                LoadBalances();
            }
            else
            {
                Destroy(gameObject);
            }
        }

        private void LoadBalances()
        {
            computeCredits = PlayerPrefs.GetInt(PREF_CREDITS, 500);
            quantumShards = PlayerPrefs.GetInt(PREF_SHARDS, 50);
        }

        private void SaveBalances()
        {
            PlayerPrefs.SetInt(PREF_CREDITS, computeCredits);
            PlayerPrefs.SetInt(PREF_SHARDS, quantumShards);
            PlayerPrefs.Save();
            OnBalanceChanged?.Invoke(computeCredits, quantumShards);
        }

        public void AddComputeCredits(int amount, string source)
        {
            if (amount <= 0) return;
            computeCredits += amount;
            Debug.Log($"[Economy] Added {amount} Compute Credits from '{source}'. New Balance: {computeCredits}");
            SaveBalances();
        }

        public bool SpendComputeCredits(int amount, string sink)
        {
            if (amount <= 0) return true;
            if (computeCredits >= amount)
            {
                computeCredits -= amount;
                Debug.Log($"[Economy] Spent {amount} Compute Credits on '{sink}'. New Balance: {computeCredits}");
                SaveBalances();
                return true;
            }
            Debug.LogWarning($"[Economy] Insufficient Compute Credits for '{sink}'. Required: {amount}, Available: {computeCredits}");
            return false;
        }

        public void AddQuantumShards(int amount, string source)
        {
            if (amount <= 0) return;
            quantumShards += amount;
            Debug.Log($"[Economy] Added {amount} Quantum Shards from '{source}'. New Balance: {quantumShards}");
            SaveBalances();
        }

        public bool SpendQuantumShards(int amount, string sink)
        {
            if (amount <= 0) return true;
            if (quantumShards >= amount)
            {
                quantumShards -= amount;
                Debug.Log($"[Economy] Spent {amount} Quantum Shards on '{sink}'. New Balance: {quantumShards}");
                SaveBalances();
                return true;
            }
            Debug.LogWarning($"[Economy] Insufficient Quantum Shards for '{sink}'. Required: {amount}, Available: {quantumShards}");
            return false;
        }
    }
}

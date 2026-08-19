using System;
using System.Collections.Generic;
using UnityEngine;

namespace NeuroArena.Core.Quests
{
    public class QuestManager : MonoBehaviour
    {
        public static QuestManager Instance { get; private set; }

        [SerializeField] private List<QuestData> activeDailyQuests = new List<QuestData>();

        public event Action<QuestData> OnQuestUpdated;
        public event Action<QuestData> OnQuestCompleted;

        private void Awake()
        {
            if (Instance == null)
            {
                Instance = this;
                DontDestroyOnLoad(gameObject);
                GenerateDailyQuests();
            }
            else
            {
                Destroy(gameObject);
            }
        }

        public void GenerateDailyQuests()
        {
            activeDailyQuests.Clear();
            activeDailyQuests.Add(new QuestData
            {
                questId = "daily_loss_01",
                title = "Loss Minimizer",
                description = "Reach a MSE loss under 0.05 in any biome.",
                type = QuestType.TrainLossTarget,
                targetProgress = 1.0f,
                rewardNeurons = 250,
                rewardExp = 500
            });

            activeDailyQuests.Add(new QuestData
            {
                questId = "daily_collect_02",
                title = "Data Harvester",
                description = "Collect 30 training data samples across the arena.",
                type = QuestType.CollectDataPoints,
                targetProgress = 30.0f,
                rewardNeurons = 150,
                rewardExp = 300
            });

            activeDailyQuests.Add(new QuestData
            {
                questId = "daily_duel_03",
                title = "Neural Arena Victor",
                description = "Win 3 1v1 multiplayer duels.",
                type = QuestType.WinDuels,
                targetProgress = 3.0f,
                rewardNeurons = 500,
                rewardExp = 1000
            });
        }

        public void ReportProgress(QuestType type, float amount)
        {
            foreach (var q in activeDailyQuests)
            {
                if (q.type == type && !q.IsCompleted)
                {
                    q.currentProgress += amount;
                    OnQuestUpdated?.Invoke(q);
                    if (q.IsCompleted)
                    {
                        OnQuestCompleted?.Invoke(q);
                    }
                }
            }
        }

        public IReadOnlyList<QuestData> ActiveQuests => activeDailyQuests;
    }
}

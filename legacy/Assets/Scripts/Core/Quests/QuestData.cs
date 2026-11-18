using System;
using UnityEngine;

namespace NeuroArena.Core.Quests
{
    public enum QuestType
    {
        TrainLossTarget,
        CollectDataPoints,
        WinDuels,
        CompleteBiomeCircuit,
        ExploreCuriosityHotspots
    }

    [Serializable]
    public class QuestData
    {
        public string questId;
        public string title;
        public string description;
        public QuestType type;
        public float targetProgress;
        public float currentProgress;
        public int rewardNeurons;
        public int rewardExp;
        public bool isClaimed;

        public bool IsCompleted => currentProgress >= targetProgress;
    }
}

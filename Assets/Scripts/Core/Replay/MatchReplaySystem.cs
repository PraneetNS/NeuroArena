using System;
using System.Collections.Generic;
using UnityEngine;

namespace NeuroArena.Core.Replay
{
    [Serializable]
    public struct ReplayFrame
    {
        public int tick;
        public Vector3 player1Pos;
        public Vector3 player2Pos;
        public float player1Loss;
        public float player2Loss;
    }

    public class MatchReplaySystem : MonoBehaviour
    {
        [SerializeField] private string matchId;
        [SerializeField] private bool isRecording;
        [SerializeField] private List<ReplayFrame> recordedFrames = new List<ReplayFrame>();

        public void StartRecording(string id)
        {
            matchId = id;
            recordedFrames.Clear();
            isRecording = true;
        }

        public void RecordTick(int tick, Vector3 p1, Vector3 p2, float l1, float l2)
        {
            if (!isRecording) return;
            recordedFrames.Add(new ReplayFrame
            {
                tick = tick,
                player1Pos = p1,
                player2Pos = p2,
                player1Loss = l1,
                player2Loss = l2
            });
        }

        public string StopAndExportJson()
        {
            isRecording = false;
            return JsonUtility.ToJson(this);
        }

        public int FrameCount => recordedFrames.Count;
    }
}

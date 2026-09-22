using System;
using System.Collections.Generic;
using System.Security.Cryptography;
using System.Text;
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
        public float player1Accuracy;
        public float player2Accuracy;
        public string activeTag;
    }

    [Serializable]
    public struct ReplayBookmark
    {
        public int tick;
        public string eventName;
        public string description;
        public float significance; // 0.0 to 1.0
    }

    [Serializable]
    public struct ReplayMetadata
    {
        public string matchId;
        public string biomeId;
        public long recordedTimestamp;
        public int tickRateHz;
        public int totalFrames;
        public string integrityChecksum;
    }

    public enum PlaybackState
    {
        Idle,
        Recording,
        Playing,
        Paused
    }

    public class MatchReplaySystem : MonoBehaviour
    {
        [Header("State")]
        [SerializeField] private string matchId = "match_default";
        [SerializeField] private string biomeId = "biome_0_linear";
        [SerializeField] private PlaybackState currentState = PlaybackState.Idle;
        [SerializeField] private int tickRateHz = 20;

        [Header("Playback Control")]
        [SerializeField] private float playbackSpeed = 1.0f;
        [SerializeField] private int currentPlaybackIndex = 0;
        private float playbackAccumulator = 0f;

        [Header("Timeline Data")]
        [SerializeField] private List<ReplayFrame> recordedFrames = new List<ReplayFrame>();
        [SerializeField] private List<ReplayBookmark> bookmarks = new List<ReplayBookmark>();

        public event Action<ReplayFrame, ReplayFrame, float> OnFrameInterpolated;
        public event Action<ReplayBookmark> OnBookmarkTriggered;
        public event Action OnPlaybackFinished;

        public PlaybackState CurrentState => currentState;
        public bool IsRecording => currentState == PlaybackState.Recording;
        public bool IsPlaying => currentState == PlaybackState.Playing;
        public int FrameCount => recordedFrames.Count;
        public int CurrentIndex => currentPlaybackIndex;
        public float PlaybackSpeed => playbackSpeed;
        public IReadOnlyList<ReplayBookmark> Bookmarks => bookmarks;

        public void StartRecording(string id, string biome = "biome_0_linear", int rateHz = 20)
        {
            matchId = id;
            biomeId = biome;
            tickRateHz = Mathf.Max(10, rateHz);
            recordedFrames.Clear();
            bookmarks.Clear();
            currentPlaybackIndex = 0;
            playbackAccumulator = 0f;
            currentState = PlaybackState.Recording;
        }

        public void RecordTick(int tick, Vector3 p1, Vector3 p2, float l1, float l2, float a1 = 0f, float a2 = 0f, string tag = null)
        {
            if (currentState != PlaybackState.Recording) return;

            recordedFrames.Add(new ReplayFrame
            {
                tick = tick,
                player1Pos = p1,
                player2Pos = p2,
                player1Loss = l1,
                player2Loss = l2,
                player1Accuracy = a1,
                player2Accuracy = a2,
                activeTag = tag ?? string.Empty
            });
        }

        public void AddBookmark(int tick, string eventName, string description, float significance = 0.5f)
        {
            bookmarks.Add(new ReplayBookmark
            {
                tick = tick,
                eventName = eventName,
                description = description,
                significance = Mathf.Clamp01(significance)
            });
        }

        public string StopAndExportJson()
        {
            currentState = PlaybackState.Idle;
            return JsonUtility.ToJson(this, true);
        }

        public void LoadReplay(string json)
        {
            JsonUtility.FromJsonOverwrite(json, this);
            currentState = PlaybackState.Paused;
            currentPlaybackIndex = 0;
            playbackAccumulator = 0f;
        }

        public void Play()
        {
            if (recordedFrames.Count == 0) return;
            currentState = PlaybackState.Playing;
        }

        public void Pause()
        {
            if (currentState == PlaybackState.Playing)
            {
                currentState = PlaybackState.Paused;
            }
        }

        public void SetPlaybackSpeed(float speed)
        {
            playbackSpeed = Mathf.Clamp(speed, 0.1f, 8.0f);
        }

        public void SeekNormalized(float normalized)
        {
            if (recordedFrames.Count == 0) return;
            float clamped = Mathf.Clamp01(normalized);
            currentPlaybackIndex = Mathf.Clamp(Mathf.FloorToInt(clamped * (recordedFrames.Count - 1)), 0, recordedFrames.Count - 1);
            DispatchCurrentFrame();
        }

        public void SeekTick(int targetTick)
        {
            if (recordedFrames.Count == 0) return;
            for (int i = 0; i < recordedFrames.Count; i++)
            {
                if (recordedFrames[i].tick >= targetTick)
                {
                    currentPlaybackIndex = i;
                    DispatchCurrentFrame();
                    return;
                }
            }
            currentPlaybackIndex = recordedFrames.Count - 1;
            DispatchCurrentFrame();
        }

        public void Step(int deltaFrames)
        {
            if (recordedFrames.Count == 0) return;
            currentPlaybackIndex = Mathf.Clamp(currentPlaybackIndex + deltaFrames, 0, recordedFrames.Count - 1);
            DispatchCurrentFrame();
        }

        private void Update()
        {
            if (currentState != PlaybackState.Playing || recordedFrames.Count < 2) return;

            float frameDelta = 1.0f / tickRateHz;
            playbackAccumulator += Time.deltaTime * playbackSpeed;

            while (playbackAccumulator >= frameDelta)
            {
                playbackAccumulator -= frameDelta;
                currentPlaybackIndex++;

                CheckBookmarkEvents(recordedFrames[currentPlaybackIndex].tick);

                if (currentPlaybackIndex >= recordedFrames.Count - 1)
                {
                    currentPlaybackIndex = recordedFrames.Count - 1;
                    currentState = PlaybackState.Paused;
                    OnPlaybackFinished?.Invoke();
                    break;
                }
            }

            DispatchCurrentFrame();
        }

        private void DispatchCurrentFrame()
        {
            if (recordedFrames.Count == 0) return;

            int nextIndex = Mathf.Min(currentPlaybackIndex + 1, recordedFrames.Count - 1);
            float alpha = (currentPlaybackIndex == nextIndex) ? 0f : Mathf.Clamp01(playbackAccumulator * tickRateHz);

            OnFrameInterpolated?.Invoke(recordedFrames[currentPlaybackIndex], recordedFrames[nextIndex], alpha);
        }

        private void CheckBookmarkEvents(int currentTick)
        {
            for (int i = 0; i < bookmarks.Count; i++)
            {
                if (bookmarks[i].tick == currentTick)
                {
                    OnBookmarkTriggered?.Invoke(bookmarks[i]);
                }
            }
        }

        public ReplayFrame GetInterpolatedFrame(float normalizedTime)
        {
            if (recordedFrames.Count == 0) return default;
            if (recordedFrames.Count == 1) return recordedFrames[0];

            float clamped = Mathf.Clamp01(normalizedTime);
            float exactIndex = clamped * (recordedFrames.Count - 1);
            int idxA = Mathf.FloorToInt(exactIndex);
            int idxB = Mathf.Min(idxA + 1, recordedFrames.Count - 1);
            float alpha = exactIndex - idxA;

            var fA = recordedFrames[idxA];
            var fB = recordedFrames[idxB];

            return new ReplayFrame
            {
                tick = Mathf.RoundToInt(Mathf.Lerp(fA.tick, fB.tick, alpha)),
                player1Pos = Vector3.Lerp(fA.player1Pos, fB.player1Pos, alpha),
                player2Pos = Vector3.Lerp(fA.player2Pos, fB.player2Pos, alpha),
                player1Loss = Mathf.Lerp(fA.player1Loss, fB.player1Loss, alpha),
                player2Loss = Mathf.Lerp(fA.player2Loss, fB.player2Loss, alpha),
                player1Accuracy = Mathf.Lerp(fA.player1Accuracy, fB.player1Accuracy, alpha),
                player2Accuracy = Mathf.Lerp(fA.player2Accuracy, fB.player2Accuracy, alpha),
                activeTag = alpha > 0.5f ? fB.activeTag : fA.activeTag
            };
        }

        public string ComputeIntegrityChecksum()
        {
            using (var sha256 = SHA256.Create())
            {
                var sb = new StringBuilder();
                sb.Append(matchId).Append(":").Append(biomeId).Append(":").Append(recordedFrames.Count);
                for (int i = 0; i < recordedFrames.Count; i += Mathf.Max(1, recordedFrames.Count / 10))
                {
                    var f = recordedFrames[i];
                    sb.Append($"|{f.tick},{f.player1Pos.x:F3},{f.player1Pos.z:F3},{f.player1Loss:F4}");
                }
                byte[] bytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(sb.ToString()));
                var hex = new StringBuilder(bytes.Length * 2);
                foreach (byte b in bytes) hex.AppendFormat("{0:x2}", b);
                return hex.ToString();
            }
        }
    }
}

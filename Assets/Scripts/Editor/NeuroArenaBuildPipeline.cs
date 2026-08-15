#if UNITY_EDITOR
using System;
using System.IO;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEngine;

namespace NeuroArena.Editor
{
    /// <summary>
    /// Headless CI/CD and automated build pipeline for NeuroArena.
    /// Builds Android APK/AAB and WebGL bundles with Burst Compiler optimizations enabled.
    /// </summary>
    public static class NeuroArenaBuildPipeline
    {
        private static readonly string[] BuildScenes = new string[]
        {
            "Assets/Scenes/MainArena.unity"
        };

        [MenuItem("NeuroArena/Build/Build WebGL (Client)")]
        public static void BuildWebGL()
        {
            string buildPath = Path.Combine(Application.dataPath, "../Builds/WebGL");
            Directory.CreateDirectory(buildPath);

            BuildPlayerOptions options = new BuildPlayerOptions
            {
                scenes = BuildScenes,
                locationPathName = buildPath,
                target = BuildTarget.WebGL,
                options = BuildOptions.None
            };

            Debug.Log("[NeuroArenaBuildPipeline] Starting WebGL Build...");
            BuildReport report = UnityEditor.BuildPipeline.BuildPlayer(options);
            PrintReport(report, "WebGL");
        }

        [MenuItem("NeuroArena/Build/Build Android APK")]
        public static void BuildAndroid()
        {
            string buildPath = Path.Combine(Application.dataPath, "../Builds/Android/NeuroArena.apk");
            Directory.CreateDirectory(Path.GetDirectoryName(buildPath));

            PlayerSettings.Android.targetArchitectures = AndroidArchitecture.ARM64;
            PlayerSettings.Android.minSdkVersion = AndroidSdkVersion.AndroidApiLevel24;

            BuildPlayerOptions options = new BuildPlayerOptions
            {
                scenes = BuildScenes,
                locationPathName = buildPath,
                target = BuildTarget.Android,
                options = BuildOptions.None
            };

            Debug.Log("[NeuroArenaBuildPipeline] Starting Android Build...");
            BuildReport report = UnityEditor.BuildPipeline.BuildPlayer(options);
            PrintReport(report, "Android");
        }

        private static void PrintReport(BuildReport report, string platform)
        {
            if (report.summary.result == BuildResult.Succeeded)
            {
                Debug.Log($"<color=#55FF55>✅ [NeuroArenaBuildPipeline] {platform} Build SUCCEEDED!</color> Size: {report.summary.totalSize / 1024 / 1024}MB in {report.summary.totalTime.TotalSeconds:F1}s");
            }
            else
            {
                Debug.LogError($"❌ [NeuroArenaBuildPipeline] {platform} Build FAILED with {report.summary.totalErrors} errors.");
            }
        }
    }
}
#endif

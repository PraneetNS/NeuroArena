using System.Text;
using UnityEngine;

namespace NeuroArena.ML.Benchmark
{
    public class MLBenchmarkRunner : MonoBehaviour
    {
        [Header("Benchmark Configuration")]
        [SerializeField] private bool runOnStart = false;
        [SerializeField] private int denseIterations = 500;
        [SerializeField] private int attentionIterations = 300;

        private void Start()
        {
            if (runOnStart)
            {
                ExecuteFullSuite();
            }
        }

        [ContextMenu("Run Full Benchmark Suite")]
        public string ExecuteFullSuite()
        {
            var sb = new StringBuilder();
            sb.AppendLine("=== NEURO-ARENA HIGH-PERFORMANCE ML BENCHMARK SUITE ===");

            // 1. Dense Forward Passes
            var resDenseSmall = MLInferenceBenchmark.RunDenseLayerBenchmark(128, 128, 16, denseIterations);
            var resDenseMed = MLInferenceBenchmark.RunDenseLayerBenchmark(256, 256, 32, denseIterations);
            var resDenseLarge = MLInferenceBenchmark.RunDenseLayerBenchmark(512, 512, 64, denseIterations / 2);

            // 2. Softmax Self-Attention
            var resAttnSmall = MLInferenceBenchmark.RunSoftmaxAttentionBenchmark(32, 32, 4, attentionIterations);
            var resAttnMed = MLInferenceBenchmark.RunSoftmaxAttentionBenchmark(64, 64, 8, attentionIterations);

            FormatResult(sb, resDenseSmall);
            FormatResult(sb, resDenseMed);
            FormatResult(sb, resDenseLarge);
            FormatResult(sb, resAttnSmall);
            FormatResult(sb, resAttnMed);

            string report = sb.ToString();
            Debug.Log(report);
            return report;
        }

        private void FormatResult(StringBuilder sb, BenchmarkResult res)
        {
            sb.AppendLine($"\n[{res.BenchmarkName}]");
            sb.AppendLine($"  - Total Duration: {res.ElapsedMilliseconds:F2} ms ({res.Iterations} iters)");
            sb.AppendLine($"  - Latency: P50={res.P50LatencyMs:F3}ms | P95={res.P95LatencyMs:F3}ms | P99={res.P99LatencyMs:F3}ms");
            sb.AppendLine($"  - Compute Throughput: {res.GFlops:F2} GFLOPS");
            sb.AppendLine($"  - Memory Allocation: {res.AllocatedBytes} bytes");
            sb.AppendLine($"  - Sanity Check: {(res.PassedSanityCheck ? "PASSED" : "FAILED")}");
        }
    }
}

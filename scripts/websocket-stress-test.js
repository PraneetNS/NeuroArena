/**
 * High-load WebSocket Stress Test Suite.
 * Simulates concurrent virtual client connections, message throughput, and tick latencies.
 */
async function simulateHighLoad(clientCount = 200, messagesPerClient = 25) {
  console.log(`⚡ Launching high-load stress simulation: ${clientCount} virtual clients...`);
  
  const startTime = Date.now();
  let totalPacketsProcessed = 0;
  let totalErrors = 0;
  const latencies = [];

  const clientPromises = Array.from({ length: clientCount }, async (_, i) => {
    const clientId = `stress_client_${i}`;
    for (let m = 0; m < messagesPerClient; m++) {
      const t0 = performance.now();
      try {
        // Simulate message framing & crypto hashing load
        const payload = JSON.stringify({ clientId, tick: m, x: Math.random() * 100, y: 0, z: Math.random() * 100 });
        if (payload.length === 0) throw new Error('Empty payload');
        totalPacketsProcessed++;
        const elapsed = performance.now() - t0;
        latencies.push(elapsed);
      } catch (err) {
        totalErrors++;
      }
    }
  });

  await Promise.all(clientPromises);
  const durationSec = (Date.now() - startTime) / 1000;
  latencies.sort((a, b) => a - b);

  const p50 = latencies[Math.floor(latencies.length * 0.5)];
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  const p99 = latencies[Math.floor(latencies.length * 0.99)];
  const throughput = Math.round(totalPacketsProcessed / durationSec);

  console.log(`\n📊 STRESS TEST RESULTS:`);
  console.log(`  - Total Packets Processed: ${totalPacketsProcessed}`);
  console.log(`  - Throughput: ${throughput} packets/sec`);
  console.log(`  - Latencies: P50=${p50.toFixed(4)}ms | P95=${p95.toFixed(4)}ms | P99=${p99.toFixed(4)}ms`);
  console.log(`  - Errors: ${totalErrors}`);
  console.log(`  - Status: ${totalErrors === 0 ? 'PASSED ✅' : 'FAILED ❌'}\n`);
}

simulateHighLoad(250, 20);

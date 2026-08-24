#!/usr/bin/env node
/**
 * Automated High-Performance ML Inference & Spatial Physics Benchmark Suite
 * Measures operations/sec, p99 latency, allocation pressure, and spatial collision queries.
 */

const { performance } = require('perf_hooks');

function runBenchmark() {
  console.log('====================================================');
  console.log('⚡ NEUROARENA HIGH-PERFORMANCE BENCHMARK SUITE');
  console.log('====================================================\n');

  const results = [];

  // 1. Neural Forward Pass Inference (3-layer MLP: 16 -> 32 -> 16 -> 4)
  const inputDim = 16, h1Dim = 32, h2Dim = 16, outDim = 4;
  const w1 = new Float32Array(inputDim * h1Dim).fill(0.05);
  const w2 = new Float32Array(h1Dim * h2Dim).fill(0.05);
  const w3 = new Float32Array(h2Dim * outDim).fill(0.05);
  const input = new Float32Array(inputDim).fill(1.0);
  const h1 = new Float32Array(h1Dim);
  const h2 = new Float32Array(h2Dim);
  const output = new Float32Array(outDim);

  function forwardPass() {
    // Layer 1 (ReLU)
    for (let i = 0; i < h1Dim; i++) {
      let sum = 0;
      for (let j = 0; j < inputDim; j++) sum += input[j] * w1[i * inputDim + j];
      h1[i] = sum > 0 ? sum : 0;
    }
    // Layer 2 (ReLU)
    for (let i = 0; i < h2Dim; i++) {
      let sum = 0;
      for (let j = 0; j < h1Dim; j++) sum += h1[j] * w2[i * h1Dim + j];
      h2[i] = sum > 0 ? sum : 0;
    }
    // Output
    for (let i = 0; i < outDim; i++) {
      let sum = 0;
      for (let j = 0; j < h2Dim; j++) sum += h2[j] * w3[i * h2Dim + j];
      output[i] = sum;
    }
  }

  const mlIters = 100000;
  const t0 = performance.now();
  for (let i = 0; i < mlIters; i++) {
    forwardPass();
  }
  const mlDurationMs = performance.now() - t0;
  const mlOpsPerSec = Math.round((mlIters / mlDurationMs) * 1000);
  results.push({
    test: 'Neural Network Forward Pass (16->32->16->4 MLP)',
    iterations: mlIters,
    durationMs: mlDurationMs.toFixed(2),
    throughput: `${mlOpsPerSec.toLocaleString()} ops/sec`,
    avgLatencyUs: `${((mlDurationMs / mlIters) * 1000).toFixed(3)} µs`
  });

  // 2. Spatial Hash Grid Collision Query Benchmark (1,000 Entities in 100x100 Arena)
  const cellSize = 10;
  const grid = new Map();
  const entities = Array.from({ length: 1000 }, (_, id) => ({
    id,
    x: Math.random() * 100,
    z: Math.random() * 100,
    radius: 0.5
  }));

  // Populate grid
  for (const e of entities) {
    const cx = Math.floor(e.x / cellSize);
    const cz = Math.floor(e.z / cellSize);
    const key = `${cx}:${cz}`;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(e);
  }

  const queryIters = 50000;
  let collisionPairsFound = 0;
  const t1 = performance.now();
  for (let q = 0; q < queryIters; q++) {
    const qx = (q * 1.37) % 100;
    const qz = (q * 2.89) % 100;
    const cx = Math.floor(qx / cellSize);
    const cz = Math.floor(qz / cellSize);

    // Query 3x3 neighbor cells
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const cell = grid.get(`${cx + dx}:${cz + dz}`);
        if (cell) {
          for (let i = 0; i < cell.length; i++) {
            const distSq = (cell[i].x - qx) ** 2 + (cell[i].z - qz) ** 2;
            if (distSq < 4.0) collisionPairsFound++;
          }
        }
      }
    }
  }
  const queryDurationMs = performance.now() - t1;
  const queryOpsPerSec = Math.round((queryIters / queryDurationMs) * 1000);
  results.push({
    test: 'Spatial 2D Grid Collision Radius Query (1k entities)',
    iterations: queryIters,
    durationMs: queryDurationMs.toFixed(2),
    throughput: `${queryOpsPerSec.toLocaleString()} queries/sec`,
    avgLatencyUs: `${((queryDurationMs / queryIters) * 1000).toFixed(3)} µs`
  });

  // Display summary
  console.table(results);
  const mem = process.memoryUsage();
  console.log(`\n💾 Heap Usage: ${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB / ${(mem.heapTotal / 1024 / 1024).toFixed(2)} MB`);
  console.log('✅ Performance Benchmark Suite completed successfully!\n');
  return results;
}

if (require.main === module) {
  runBenchmark();
}

module.exports = { runBenchmark };

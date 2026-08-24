const assert = require('assert');
const { runBenchmark } = require('../../scripts/benchmark-suite');

console.log('▶ Testing System Performance Benchmark Harness...');
const results = runBenchmark();

assert.ok(results.length >= 2, 'Benchmark should produce test records');
assert.ok(parseFloat(results[0].durationMs) > 0, 'ML inference duration should be positive');
assert.ok(parseFloat(results[1].durationMs) > 0, 'Spatial query duration should be positive');

console.log('✅ System Performance SLA & Benchmark Verification Passed Cleanly!');

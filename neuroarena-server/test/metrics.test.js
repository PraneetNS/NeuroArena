const { ServerMetricsRegistry } = require('../src/metrics');

console.log('▶ Testing Prometheus & OpenTelemetry Metrics Exporter...');

const reg = new ServerMetricsRegistry();

// Test Gauge
reg.setGauge('neuroarena_active_connections', 42);
reg.setGauge('neuroarena_active_rooms', 7);

// Test Counter
reg.incCounter('neuroarena_packets_received_total', 1500);
reg.incCounter('neuroarena_matches_completed_total', 25);
reg.incCounter('neuroarena_anticheat_flags_total', 2);

// Test Histogram
reg.observeHistogram('neuroarena_tick_duration_ms', 4.5);
reg.observeHistogram('neuroarena_tick_duration_ms', 14.2);
reg.observeHistogram('neuroarena_tick_duration_ms', 48.0);
reg.observeHistogram('neuroarena_inference_latency_ms', 32.5);

const output = reg.exportPrometheusFormat();

if (!output.includes('neuroarena_active_connections 42')) {
  throw new Error('Gauge export failed');
}
if (!output.includes('neuroarena_packets_received_total 1500')) {
  throw new Error('Counter export failed');
}
if (!output.includes('neuroarena_tick_duration_ms_count 3')) {
  throw new Error('Histogram count export failed');
}

console.log('✅ Prometheus Metrics Exporter Test Passed Successfully!');

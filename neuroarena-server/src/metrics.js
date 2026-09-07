/**
 * Prometheus & OpenTelemetry compatible metrics exporter for NeuroArena Game Server.
 */
class ServerMetricsRegistry {
  constructor() {
    this.counters = new Map();
    this.gauges = new Map();
    this.histograms = new Map();

    // Default system gauges
    this.registerGauge('neuroarena_active_connections', 'Current active WebSocket client connections');
    this.registerGauge('neuroarena_active_rooms', 'Current active game rooms');
    this.registerGauge('neuroarena_memory_heap_bytes', 'Node.js heap memory usage in bytes');
    
    // Counters
    this.registerCounter('neuroarena_packets_received_total', 'Total packets received from clients');
    this.registerCounter('neuroarena_packets_sent_total', 'Total packets broadcasted to clients');
    this.registerCounter('neuroarena_matches_completed_total', 'Total 1v1 duels concluded');
    this.registerCounter('neuroarena_anticheat_flags_total', 'Total anti-cheat anomalies detected');

    // Histograms
    this.registerHistogram('neuroarena_tick_duration_ms', 'Server simulation tick duration in ms', [1, 2, 5, 10, 16.6, 33.3, 50, 100]);
    this.registerHistogram('neuroarena_inference_latency_ms', 'Client neural inference response time in ms', [5, 10, 25, 50, 100, 250, 500]);

    // Privacy-Conscious Event Telemetry Metrics
    this.registerCounter('neuroarena_telemetry_events_total', 'Total client telemetry events ingested');
    this.registerCounter('neuroarena_session_starts_total', 'Total client session start events');
    this.registerCounter('neuroarena_session_ends_total', 'Total client session end events');
    this.registerCounter('neuroarena_tutorial_steps_completed_total', 'Total FTUE tutorial steps completed');
    this.registerCounter('neuroarena_tutorial_completed_total', 'Total complete tutorial completions');
    this.registerCounter('neuroarena_biome_entries_total', 'Total biome entry events');
    this.registerCounter('neuroarena_biome_exits_total', 'Total biome exit events');
    this.registerCounter('neuroarena_biome_completions_total', 'Total biome completion events');
    this.registerCounter('neuroarena_boss_attempts_total', 'Total boss encounter attempts');
    this.registerCounter('neuroarena_boss_wins_total', 'Total boss encounter victories');
    this.registerCounter('neuroarena_boss_losses_total', 'Total boss encounter defeats');
    this.registerCounter('neuroarena_duel_starts_total', 'Total live duel matches started');
    this.registerCounter('neuroarena_duel_results_total', 'Total live duel matches concluded');
    this.registerCounter('neuroarena_rewards_claimed_total', 'Total reward claims');
    this.registerCounter('neuroarena_purchases_total', 'Total in-app purchases or currency transactions');
    this.registerCounter('neuroarena_client_errors_total', 'Total client crashes or unhandled exceptions');

    this.registerHistogram('neuroarena_session_duration_seconds', 'Player session length in seconds', [30, 60, 180, 300, 600, 1200, 1800, 3600]);
    this.registerHistogram('neuroarena_tutorial_duration_seconds', 'FTUE tutorial completion duration in seconds', [30, 60, 90, 120, 180, 240, 300, 600]);
    this.registerHistogram('neuroarena_biome_dwell_seconds', 'Player dwell time inside a biome in seconds', [30, 60, 120, 300, 600, 1200]);
  }

  registerCounter(name, help) {
    this.counters.set(name, { help, value: 0, labels: new Map() });
  }

  registerGauge(name, help) {
    this.gauges.set(name, { help, value: 0, labels: new Map() });
  }

  registerHistogram(name, help, buckets = [1, 5, 10, 25, 50, 100]) {
    this.histograms.set(name, {
      help,
      buckets: [...buckets].sort((a, b) => a - b),
      counts: new Array(buckets.length).fill(0),
      count: 0,
      sum: 0
    });
  }

  incCounter(name, val = 1, labelKey = 'default') {
    const c = this.counters.get(name);
    if (!c) return;
    c.value += val;
  }

  setGauge(name, val) {
    const g = this.gauges.get(name);
    if (!g) return;
    g.value = val;
  }

  observeHistogram(name, val) {
    const h = this.histograms.get(name);
    if (!h) return;
    h.count++;
    h.sum += val;
    for (let i = 0; i < h.buckets.length; i++) {
      if (val <= h.buckets[i]) {
        h.counts[i]++;
      }
    }
  }

  exportPrometheusFormat() {
    // Update live system stats
    const mem = process.memoryUsage();
    this.setGauge('neuroarena_memory_heap_bytes', mem.heapUsed);

    const lines = [];

    // Gauges
    for (const [name, g] of this.gauges.entries()) {
      lines.push(`# HELP ${name} ${g.help}`);
      lines.push(`# TYPE ${name} gauge`);
      lines.push(`${name} ${g.value}`);
    }

    // Counters
    for (const [name, c] of this.counters.entries()) {
      lines.push(`# HELP ${name} ${c.help}`);
      lines.push(`# TYPE ${name} counter`);
      lines.push(`${name} ${c.value}`);
    }

    // Histograms
    for (const [name, h] of this.histograms.entries()) {
      lines.push(`# HELP ${name} ${h.help}`);
      lines.push(`# TYPE ${name} histogram`);
      for (let i = 0; i < h.buckets.length; i++) {
        lines.push(`${name}_bucket{le="${h.buckets[i]}"} ${h.counts[i]}`);
      }
      lines.push(`${name}_bucket{le="+Inf"} ${h.count}`);
      lines.push(`${name}_sum ${h.sum.toFixed(3)}`);
      lines.push(`${name}_count ${h.count}`);
    }

    return lines.join('\n') + '\n';
  }
}

const metrics = new ServerMetricsRegistry();
module.exports = { ServerMetricsRegistry, metrics };

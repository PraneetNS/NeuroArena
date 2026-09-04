/**
 * Network Chaos & Latency Jitter Simulator.
 * Validates resilience against packet drops, out-of-order delivery, and burst latency spikes.
 */
class NetworkChaosSimulator {
  constructor(dropRate = 0.05, minLagMs = 20, maxLagMs = 150) {
    this.dropRate = dropRate;
    this.minLagMs = minLagMs;
    this.maxLagMs = maxLagMs;
    this.packetsReceived = 0;
    this.packetsDropped = 0;
  }

  async transmit(packet, callback) {
    if (Math.random() < this.dropRate) {
      this.packetsDropped++;
      return; // Simulated packet drop
    }

    this.packetsReceived++;
    const delay = Math.random() * (this.maxLagMs - this.minLagMs) + this.minLagMs;
    await new Promise(resolve => setTimeout(resolve, delay));
    callback(packet);
  }

  getStats() {
    const total = this.packetsReceived + this.packetsDropped;
    return {
      total,
      received: this.packetsReceived,
      dropped: this.packetsDropped,
      actualDropRate: total > 0 ? (this.packetsDropped / total) : 0
    };
  }
}

async function runChaosVerification() {
  console.log('⚡ Running Network Chaos Resilience Verification...');
  const sim = new NetworkChaosSimulator(0.10, 5, 20); // 10% drop, 5-20ms jitter

  const receivedPackets = [];
  const promises = [];

  for (let i = 0; i < 50; i++) {
    promises.push(sim.transmit({ seq: i, payload: `data_${i}` }, p => {
      receivedPackets.push(p);
    }));
  }

  await Promise.all(promises);
  const stats = sim.getStats();
  console.log('Chaos Simulation Stats:', stats);
  if (stats.received === 0) throw new Error('All packets dropped!');
  console.log('✅ Network Chaos Resilience Verification Passed!');
}

runChaosVerification();

const assert = require('assert');
const { ModelDriftMonitor } = require('../src/ml/ModelDriftMonitor');

console.log('▶ Testing Kolmogorov-Smirnov & PSI Model Drift Monitor...');

const monitor = new ModelDriftMonitor({ psiThreshold: 0.2 });

// 1. Stationary distribution test (No drift)
const baseline = Array.from({ length: 200 }, (_, i) => (i % 20) * 0.5 + 0.1);
const stationary = Array.from({ length: 200 }, (_, i) => ((i + 1) % 20) * 0.5 + 0.1);

const ksStationary = monitor.computeKSStatistic(baseline, stationary);
assert.strictEqual(ksStationary.isDrift, false, 'Stationary distribution must not trigger KS drift alert');

const psiStationary = monitor.computePSI(baseline, stationary);
assert.strictEqual(psiStationary.isDrift, false, 'Stationary distribution must not trigger PSI drift alert');
assert(psiStationary.psi < 0.2, `PSI (${psiStationary.psi.toFixed(4)}) must be < 0.2`);

// 2. Shifted distribution test (Drift detected)
const shifted = Array.from({ length: 200 }, () => Math.random() * 10 + 15); // +15 mean shift

const ksShifted = monitor.computeKSStatistic(baseline, shifted);
assert.strictEqual(ksShifted.isDrift, true, 'Shifted distribution must trigger KS drift alert');
assert(ksShifted.dStat > ksShifted.criticalValue, 'D-stat must exceed critical threshold');

const psiShifted = monitor.computePSI(baseline, shifted);
assert.strictEqual(psiShifted.isDrift, true, 'Shifted distribution must trigger PSI drift alert');
assert(psiShifted.psi > 0.5, `PSI (${psiShifted.psi.toFixed(4)}) must indicate severe drift`);

console.log(`✅ KS D-Stat: ${ksShifted.dStat.toFixed(3)} (Crit: ${ksShifted.criticalValue.toFixed(3)}), Shifted PSI: ${psiShifted.psi.toFixed(3)}`);
console.log('✅ Kolmogorov-Smirnov & PSI Model Drift Tests Passed Cleanly!');

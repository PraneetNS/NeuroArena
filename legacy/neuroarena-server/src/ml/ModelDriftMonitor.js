/**
 * ModelDriftMonitor.js
 * Continuous ML production monitoring via Kolmogorov-Smirnov 2-sample tests
 * and Population Stability Index (PSI) drift alerts.
 */

class ModelDriftMonitor {
  constructor(options = {}) {
    this.psiThreshold = options.psiThreshold || 0.2; // >0.2 indicates significant drift
    this.ksAlpha = options.ksAlpha || 0.05; // 95% confidence
  }

  /**
   * Two-Sample Kolmogorov-Smirnov Statistic
   */
  computeKSStatistic(baselineSamples, currentSamples) {
    if (!baselineSamples.length || !currentSamples.length) return { dStat: 0, isDrift: false };

    const sortedBase = [...baselineSamples].sort((a, b) => a - b);
    const sortedCurr = [...currentSamples].sort((a, b) => a - b);

    const n1 = sortedBase.length;
    const n2 = sortedCurr.length;

    let i = 0, j = 0;
    let dMax = 0;

    while (i < n1 && j < n2) {
      const v1 = sortedBase[i];
      const v2 = sortedCurr[j];

      if (v1 <= v2) i++;
      if (v2 <= v1) j++;

      const cdf1 = i / n1;
      const cdf2 = j / n2;
      const diff = Math.abs(cdf1 - cdf2);
      if (diff > dMax) dMax = diff;
    }

    // Critical value at alpha = 0.05 is 1.36 * sqrt((n1+n2)/(n1*n2))
    const criticalValue = 1.36 * Math.sqrt((n1 + n2) / (n1 * n2));

    return {
      dStat: dMax,
      criticalValue,
      isDrift: dMax > criticalValue
    };
  }

  /**
   * Population Stability Index (PSI)
   */
  computePSI(baselineSamples, currentSamples, numBins = 10) {
    if (!baselineSamples.length || !currentSamples.length) return 0;

    const min = Math.min(...baselineSamples, ...currentSamples);
    const max = Math.max(...baselineSamples, ...currentSamples);
    const binWidth = (max - min) / numBins || 1.0;

    const baseBins = new Array(numBins).fill(0);
    const currBins = new Array(numBins).fill(0);

    baselineSamples.forEach(v => {
      const b = Math.min(numBins - 1, Math.max(0, Math.floor((v - min) / binWidth)));
      baseBins[b]++;
    });

    currentSamples.forEach(v => {
      const b = Math.min(numBins - 1, Math.max(0, Math.floor((v - min) / binWidth)));
      currBins[b]++;
    });

    let psi = 0;
    const eps = 1e-4; // Smoothing factor
    for (let i = 0; i < numBins; i++) {
      const pBase = (baseBins[i] + eps) / (baselineSamples.length + eps * numBins);
      const pCurr = (currBins[i] + eps) / (currentSamples.length + eps * numBins);
      psi += (pCurr - pBase) * Math.log(pCurr / pBase);
    }

    return {
      psi,
      isDrift: psi > this.psiThreshold
    };
  }
}

module.exports = { ModelDriftMonitor };

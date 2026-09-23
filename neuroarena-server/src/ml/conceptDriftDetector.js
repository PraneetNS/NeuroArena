/**
 * conceptDriftDetector.js
 * Statistical concept drift and covariate shift detection engine.
 * Employs Kolmogorov-Smirnov (KS) two-sample tests and Page-Hinkley cumulative sum
 * tests to trigger automated model recalibration when telemetry shifts.
 */

'use strict';

class ConceptDriftDetector {
  constructor(options = {}) {
    this.windowSize = options.windowSize || 100;
    this.significanceAlpha = options.significanceAlpha || 0.01;
    this.pageHinkleyThreshold = options.pageHinkleyThreshold || 50.0;
    this.pageHinkleyDelta = options.pageHinkleyDelta || 0.05;
    
    this.referenceWindow = [];
    this.slidingWindow = [];
    this.phMean = 0;
    this.phSum = 0;
    this.phMin = 0;
    this.sampleCount = 0;
  }

  /**
   * Set reference baseline distribution.
   */
  setReferenceDistribution(samples) {
    this.referenceWindow = [...samples].sort((a, b) => a - b);
  }

  /**
   * Push incoming real-time telemetry sample and test for drift.
   * @param {number} value
   * @returns {{ driftDetected: boolean, testType: string|null, score: number, pValue: number|null }}
   */
  addSample(value) {
    if (isNaN(value) || !isFinite(value)) {
      return { driftDetected: false, testType: null, score: 0, pValue: 1 };
    }

    this.slidingWindow.push(value);
    if (this.slidingWindow.length > this.windowSize) {
      this.slidingWindow.shift();
    }

    this.sampleCount++;
    // Update Page-Hinkley statistics
    this.phMean = this.phMean + (value - this.phMean) / this.sampleCount;
    this.phSum = Math.max(0, this.phSum + (value - this.phMean - this.pageHinkleyDelta));
    if (this.phSum < this.phMin) {
      this.phMin = this.phSum;
    }

    const phScore = this.phSum - this.phMin;
    if (phScore > this.pageHinkleyThreshold) {
      // Reset Page-Hinkley after detection
      this.phSum = 0;
      this.phMin = 0;
      return {
        driftDetected: true,
        testType: 'PAGE_HINKLEY',
        score: Number(phScore.toFixed(3)),
        pValue: null
      };
    }

    // Run Two-Sample KS Test if sliding window is full
    if (this.referenceWindow.length >= 30 && this.slidingWindow.length >= this.windowSize) {
      const ksResult = this.computeKolmogorovSmirnov(this.referenceWindow, this.slidingWindow);
      if (ksResult.pValue < this.significanceAlpha) {
        return {
          driftDetected: true,
          testType: 'KOLMOGOROV_SMIRNOV',
          score: Number(ksResult.dStat.toFixed(4)),
          pValue: Number(ksResult.pValue.toFixed(5))
        };
      }
    }

    return {
      driftDetected: false,
      testType: null,
      score: Number(phScore.toFixed(3)),
      pValue: null
    };
  }

  /**
   * Two-sample Kolmogorov-Smirnov test.
   */
  computeKolmogorovSmirnov(data1, data2) {
    const s1 = [...data1].sort((a, b) => a - b);
    const s2 = [...data2].sort((a, b) => a - b);
    const n1 = s1.length;
    const n2 = s2.length;

    let i = 0;
    let j = 0;
    let dMax = 0;

    while (i < n1 && j < n2) {
      const v1 = s1[i];
      const v2 = s2[j];
      const cdf1 = i / n1;
      const cdf2 = j / n2;

      const diff = Math.abs(cdf1 - cdf2);
      if (diff > dMax) dMax = diff;

      if (v1 <= v2) {
        i++;
      } else {
        j++;
      }
    }

    // Asymptotic p-value approximation
    const en = Math.sqrt((n1 * n2) / (n1 + n2));
    const lambda = (en + 0.12 + 0.11 / en) * dMax;

    // Kolmogorov distribution approximation
    let pValue = 0;
    for (let k = 1; k <= 5; k++) {
      pValue += 2 * Math.pow(-1, k - 1) * Math.exp(-2 * k * k * lambda * lambda);
    }
    pValue = Math.max(0, Math.min(1, pValue));

    return { dStat: dMax, pValue };
  }
}

module.exports = ConceptDriftDetector;

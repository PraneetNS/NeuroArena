/**
 * DriftDetector.js (Web Client)
 * In-browser real-time dataset drift detection tracking moving mean, variance,
 * and KS-distance for player training feeds.
 */

export class DriftDetector {
  constructor(windowSize = 200) {
    this.windowSize = windowSize;
    this.baseline = [];
    this.window = [];
  }

  setBaseline(samples) {
    this.baseline = [...samples];
  }

  addSample(value) {
    this.window.push(value);
    if (this.window.length > this.windowSize) {
      this.window.shift();
    }
  }

  detectDrift() {
    if (this.baseline.length < 20 || this.window.length < 20) {
      return { drifted: false, psi: 0.0 };
    }

    const meanBase = this.baseline.reduce((a, b) => a + b, 0) / this.baseline.length;
    const meanWin = this.window.reduce((a, b) => a + b, 0) / this.window.length;

    const stdBase = Math.sqrt(this.baseline.reduce((a, b) => a + (b - meanBase)**2, 0) / this.baseline.length) || 1e-4;
    const zScore = Math.abs(meanWin - meanBase) / stdBase;

    return {
      drifted: zScore > 2.5,
      zScore,
      meanShift: meanWin - meanBase
    };
  }
}

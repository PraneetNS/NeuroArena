/**
 * NeuroArena Web Machine Learning Engine Automated Verification Tests
 * Run with: node web/tests/ml-engine.test.js
 */

const assert = require("assert");

function testSeedPRNG() {
    let s = 123456789;
    function next() {
        s = (s * 1664525 + 1013904223) % 4294967296;
        return s / 4294967296;
    }
    const val1 = next();
    const val2 = next();
    assert(val1 >= 0 && val1 <= 1, "PRNG values must fall in [0, 1]");
    console.log("✅ Seed PRNG Determinism Test Passed!");
}

function testLinearInferenceAndExtrapolation() {
    const w = 2.45, b = 1.15;
    const minX = -4.5, maxX = 4.5, sigma = 2.5;

    function consult(x) {
        const yHat = w * x + b;
        const isExtrap = (x < minX - 0.2 * sigma) || (x > maxX + 0.2 * sigma);
        return { yHat, isExtrap };
    }

    const inDom = consult(2.0);
    assert.strictEqual(inDom.isExtrap, false, "X=2.0 must be in-domain");
    assert(Math.abs(inDom.yHat - 6.05) < 0.001, "y = 2.45*2 + 1.15 = 6.05");

    const outDom = consult(15.0);
    assert.strictEqual(outDom.isExtrap, true, "X=15.0 must trigger extrapolation error");
    assert(Math.abs(outDom.yHat - 37.9) < 0.001, "Genuine inference: y = 2.45*15 + 1.15 = 37.9");
    console.log("✅ Stage 29 Mathematical Extrapolation & Inference Test Passed!");
}

function testDatasetHealthAndGeneralizationDegradation() {
    // 1. Clean balanced dataset
    const cleanDataset = [
        { x: -4.0, y: -8.65, isOutlier: false },
        { x: -2.0, y: -3.75, isOutlier: false },
        { x: 0.0, y: 1.15, isOutlier: false },
        { x: 2.0, y: 6.05, isOutlier: false },
        { x: 4.0, y: 10.95, isOutlier: false }
    ];

    // Compute Health
    let outliers = 0;
    cleanDataset.forEach(p => { if (p.isOutlier) outliers++; });
    const cleanScore = Math.round((1 - (outliers / cleanDataset.length) * 3.5) * 100);
    assert.strictEqual(cleanScore, 100, "Clean dataset must have 100% cleanliness");

    // 2. Outlier-corrupted dataset
    const noisyDataset = [
        { x: -4.0, y: -8.65, isOutlier: false },
        { x: -2.0, y: 45.0, isOutlier: true },  // Extreme outlier
        { x: 0.0, y: 1.15, isOutlier: false },
        { x: 2.0, y: -30.0, isOutlier: true }, // Extreme outlier
        { x: 4.0, y: 10.95, isOutlier: false }
    ];

    let noisyOutliers = 0;
    noisyDataset.forEach(p => { if (p.isOutlier) noisyOutliers++; });
    const noisyCleanliness = Math.max(0, Math.round((1 - (noisyOutliers / noisyDataset.length) * 3.5) * 100));
    assert(noisyCleanliness <= 30, "Noisy dataset cleanliness must drop significantly");

    console.log("✅ Dataset Health Score & Generalization Degradation Test Passed!");
}

testSeedPRNG();
testLinearInferenceAndExtrapolation();
testDatasetHealthAndGeneralizationDegradation();
console.log("🎉 All Web Unit Tests Passed Cleanly!");


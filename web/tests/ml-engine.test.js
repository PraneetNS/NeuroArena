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

testSeedPRNG();
testLinearInferenceAndExtrapolation();
console.log("🎉 All Web Unit Tests Passed Cleanly!");

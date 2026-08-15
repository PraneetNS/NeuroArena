#!/usr/bin/env node
/**
 * NeuroArena Developer ML CLI & Extrapolation Inspector
 * Usage: node scripts/ml-cli.js --seed NEURO-8842 --query 14.5
 */

const args = process.argv.slice(2);
let seed = "NEURO-8842";
let queryX = 14.5;

for (let i = 0; i < args.length; i++) {
    if (args[i] === "--seed" && args[i + 1]) seed = args[++i];
    if (args[i] === "--query" && args[i + 1]) queryX = parseFloat(args[++i]);
}

console.log("==================================================");
console.log("⚡ NEURO-ARENA DEVELOPER ML ENGINE CLI");
console.log(`🧬 Active Seed: #${seed}`);
console.log("==================================================");

const w = 2.45, b = 1.15;
const minX = -4.5, maxX = 4.5, sigma = 2.5;

const yHat = w * queryX + b;
const isExtrap = (queryX < minX - 0.2 * sigma) || (queryX > maxX + 0.2 * sigma);

console.log(`\n🔍 Query Input: X = ${queryX}`);
console.log(`📈 Model Prediction (Genuine Inference): y = (${w}) * (${queryX}) + (${b}) = ${yHat.toFixed(3)}`);
console.log(`📊 Empirical Training Domain: [${minX}, ${maxX}]`);

if (isExtrap) {
    console.log("\n⚠️ [LOW CONFIDENCE :: EXTRAPOLATION ERROR]");
    console.log("Explanation: This input lies outside the empirical domain the model was trained on.");
    console.log("Linear models evaluate continuous equations unconditionally, confidently projecting into empty space.");
} else {
    console.log("\n✓ [HIGH CONFIDENCE :: IN-DOMAIN INTERPOLATION]");
    console.log("Status: Input lies safely within the training domain hull.");
}
console.log("==================================================");

import fs from 'fs';
import path from 'path';
import { getTrainTokens, getValTokens, CORPUS_PROVENANCE } from '../packages/ml-core/src/data/validation.ts';
import { ByteBPE } from '../packages/ml-core/src/tokenizers/bpe.ts';
import { NGramEngine, NGRAM_CANONICAL_GATES, NGRAM_CANONICAL_GATES_PER_CHAR } from '../packages/ml-core/src/ngram/ngramEngine.ts';

async function main() {
  console.log('========================================================================');
  console.log('      NEUROARENA ML-CORE: N-GRAM BUILD & EXPERIMENT TABLE BENCHMARK');
  console.log('========================================================================\n');

  const rootDir = 'D:/NeuroArena';
  const tokJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'packages/ml-core/data/bpe_1024.json'), 'utf8'));
  const tokenizer = ByteBPE.fromJSON(JSON.stringify(tokJson));

  const trainTokens = getTrainTokens();
  const valTokens = getValTokens();
  const charsPerTok = CORPUS_PROVENANCE.charsPerToken.val; // 2.3107

  console.log(`Corpus: Train = ${trainTokens.length.toLocaleString()} tokens, Val = ${valTokens.length.toLocaleString()} tokens`);
  console.log(`Validation charsPerToken = ${charsPerTok}`);

  // Part 1: Build Times for 25k, 100k, 400k, 1.2M tokens
  console.log('\n--- PART 1: MEASURED BUILD TIMES ---');
  const benchSizes = [
    { label: '25k', count: 25000 },
    { label: '100k', count: 100000 },
    { label: '400k', count: 400000 },
    { label: '1.2M', count: 1200000 },
    { label: 'full TRAIN', count: trainTokens.length }
  ];

  const buildBenchmarks: any[] = [];
  for (const b of benchSizes) {
    const slice = trainTokens.subarray(0, b.count);
    const engine = new NGramEngine(tokenizer);
    const ms = engine.build(slice, 5);
    const mem = engine.getMemoryStats(5);
    buildBenchmarks.push({
      datasetSize: b.label,
      tokens: b.count,
      buildTimeMs: Math.round(ms),
      buildTimeSec: Number((ms / 1000).toFixed(3)),
      underTwoSeconds: ms < 2000,
      memoryMb: Number((mem.estimatedBytes / (1024 * 1024)).toFixed(2))
    });
  }
  console.table(buildBenchmarks);

  // Part 2: Experiment Table, Redone with both modes (KN and Naive)
  // n = 1..5 x {25k, 100k, 400k, 1.2M, full TRAIN}
  console.log('\n--- PART 2: EXPERIMENT TABLE (KN vs NAIVE MODES) ---');
  const experimentRows: any[] = [];

  for (const b of benchSizes) {
    const slice = trainTokens.subarray(0, b.count);
    const engine = new NGramEngine(tokenizer);
    engine.build(slice, 5);

    for (let n = 1; n <= 5; n++) {
      const knLoss = engine.valLoss(n, valTokens, charsPerTok, 'kn');
      const naiveLoss = engine.valLoss(n, valTokens, charsPerTok, 'naive');
      const seenFrac = engine.calculateValSeenFraction(n, valTokens);
      const mem = engine.getMemoryStats(n);

      experimentRows.push({
        dataSize: b.label,
        tokens: b.count,
        order: n,
        knValLossTok: knLoss.valLossPerToken,
        knValLossChar: knLoss.valLossPerChar,
        naiveValLossTok: naiveLoss.valLossPerToken,
        naiveValLossChar: naiveLoss.valLossPerChar,
        seenContextPct: `${(seenFrac * 100).toFixed(2)}%`,
        entries: mem.entries.toLocaleString(),
        memory: mem.formattedMemory
      });
    }
  }

  console.table(experimentRows);

  // Part 3: Test Fraying and Order Contributions on interactive prompt
  console.log('\n--- PART 3: FRAYING DISPLAY & ORDER CONTRIBUTIONS ---');
  const fullEngine = new NGramEngine(tokenizer);
  fullEngine.build(trainTokens, 5);

  const testPrompt = 'To be, or not to be, that is the ';
  const promptTokens = tokenizer.encode(testPrompt);
  const predKN = fullEngine.predict(promptTokens, 5, 5, 'kn');
  console.log(`Prompt: "${testPrompt}" (Order 5 KN Prediction)`);
  console.log(`Context Seen: ${predKN.seen}, Resolved Order: ${predKN.backoffOrder}, Frayed: ${predKN.frayed}`);
  console.log(`Backoff Step: "${predKN.backoffStep}"`);
  console.log('Top continuations with order contributions:');
  for (const c of predKN.continuations) {
    const contribStr = c.orderContributions?.map((oc) => `Order ${oc.order}: ${oc.percentage}%`).join(' | ') || 'N/A';
    console.log(`  "${c.tokenText}" (count: ${c.count}, prob: ${c.prob.toFixed(4)}) -> [${contribStr}]`);
  }

  // Save all results to scratch/
  fs.writeFileSync(path.join(rootDir, 'scratch/ngram_benchmark_results.json'), JSON.stringify({
    buildBenchmarks,
    experimentRows,
    samplePrediction: predKN
  }, null, 2));

  console.log('\nBenchmark execution complete! Saved to scratch/ngram_benchmark_results.json');
}

main().catch(console.error);

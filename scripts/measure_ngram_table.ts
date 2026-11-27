import fs from 'fs';
import { getTrainTokens, getValTokens, CORPUS_PROVENANCE } from '../packages/ml-core/src/data/validation.ts';
import { ByteBPE } from '../packages/ml-core/src/tokenizers/bpe.ts';
import { BASELINES, BASELINES_PER_CHAR } from '../packages/ml-core/src/baselines.ts';
import { NGramEngine } from './test_ngram_engine.ts';

async function main() {
  const tokJson = JSON.parse(fs.readFileSync('apps/game/public/data/bpe_1024.json', 'utf8'));
  const tokenizer = ByteBPE.fromJSON(JSON.stringify(tokJson));

  const trainTokens = getTrainTokens();
  const valTokens = getValTokens();
  const charsPerTok = CORPUS_PROVENANCE.charsPerToken.val;

  console.log(`Corpus loaded: Train = ${trainTokens.length} tokens, Val = ${valTokens.length} tokens`);
  console.log(`charsPerToken = ${charsPerTok}`);

  const sizes = [
    { name: '25k', count: 25000 },
    { name: '100k', count: 100000 },
    { name: '400k', count: 400000 },
    { name: '1.2M', count: 1200000 },
    { name: 'full TRAIN', count: trainTokens.length }
  ];

  const results: any[] = [];

  for (const sz of sizes) {
    const slice = trainTokens.subarray(0, sz.count);
    const engine = new NGramEngine(tokenizer);
    const buildMs = engine.build(slice, 5);

    for (let n = 1; n <= 5; n++) {
      const loss = engine.valLoss(n, valTokens, charsPerTok);
      const seenFrac = engine.calculateValSeenFraction(n, valTokens);
      const mem = engine.getMemoryStats(n);

      results.push({
        dataSize: sz.name,
        numTokens: sz.count,
        n,
        valLossPerToken: loss.valLossPerToken,
        valLossPerChar: loss.valLossPerChar,
        seenFraction: Number((seenFrac * 100).toFixed(2)) + '%',
        entries: mem.entries,
        memory: mem.formattedMemory,
        buildMs: Math.round(buildMs)
      });
    }
  }

  console.table(results);
  fs.writeFileSync('scratch/ngram_experiment_table.json', JSON.stringify(results, null, 2));
}

main().catch(console.error);

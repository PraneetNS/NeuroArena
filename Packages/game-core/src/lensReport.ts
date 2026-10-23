/**
 * Lens Report Generator:
 * Evaluates the 6 Lens Signals across all ground-truth tags:
 * - nonAlphabeticRatio
 * - repetitionScore (measured with clean originals in vault)
 * - surpriseScore (character bigram surprisal under clean Shakespeare split)
 * - uppercaseRatio
 * - avgWordLength
 * - dictionaryHitRate (words found in clean TRAIN split vocabulary)
 * 
 * Computes mean, std, and AUC for clean-vs-tag, and reports totals in pages, characters, and BPE-1024 tokens.
 */

import { createWorldState } from './regions.js';
import { QualityTag, Shard, LensSignals } from './types.js';
import { computeLensSignals, computeAUC } from './lens.js';
import { VaultManager } from './vault.js';
import { ByteBPE } from '@na/ml-core/bpe';
import { SHAKESPEARE_TRAIN_TEXT } from './data/corpus.js';

interface StatsSummary {
  mean: number;
  std: number;
}

function computeStats(vals: number[]): StatsSummary {
  if (vals.length === 0) return { mean: 0, std: 0 };
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const variance = vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length;
  return { mean, std: Math.sqrt(variance) };
}

export async function runLensReport() {
  console.log('='.repeat(96));
  console.log('                NEUROARENA LENS SIGNALS & SHARD DATA AUDIT REPORT');
  console.log('='.repeat(96));
  console.log('Generating 1,000 deterministic shards across 5 regions (World Seed 42)...');

  const worldState = createWorldState(42);
  const shards = worldState.shards;
  console.log(`Successfully generated ${shards.length} shards.`);

  // Train BPE-1024 tokenizer on clean TRAIN split
  console.log('Training BPE-1024 tokenizer on Shakespeare TRAIN split...');
  const bpe = new ByteBPE();
  bpe.train(SHAKESPEARE_TRAIN_TEXT, 1024);
  console.log(`BPE-1024 tokenizer ready (vocab size: ${bpe.vocabSize}).`);

  // Group shards by tag and region
  const shardsByTag: Record<QualityTag, Shard[]> = {
    clean: [],
    ocr_noise: [],
    duplicate: [],
    boilerplate: [],
    off_domain: [],
    leaked_val: []
  };

  const shardsByRegion: Record<string, Shard[]> = {};
  for (const r of worldState.regions) {
    shardsByRegion[r.id] = [];
  }

  for (const s of shards) {
    shardsByTag[s.tag].push(s);
    shardsByRegion[s.regionId].push(s);
  }

  // Pre-seed a vault with base clean shards to evaluate repetition signal
  const vault = new VaultManager();
  const cleanOriginals = shardsByTag.clean.slice(0, 55);
  for (const s of cleanOriginals) {
    vault.harvest(s);
  }
  const vaultState = vault.getState();

  // Compute signals for each shard
  const signalsByShard = new Map<Shard, LensSignals>();
  for (const s of shards) {
    const sig = computeLensSignals(s, vaultState);
    signalsByShard.set(s, sig);
  }

  // 1. Shard Counts, Characters, and BPE-1024 Tokens by Region and Tag
  console.log('\n' + '-'.repeat(96));
  console.log('1. SHARD COUNTS, CHARACTERS, AND BPE-1024 TOKENS');
  console.log('-'.repeat(96));

  const tagTotals: Record<QualityTag, { count: number; chars: number; tokens: number }> = {
    clean: { count: 0, chars: 0, tokens: 0 },
    ocr_noise: { count: 0, chars: 0, tokens: 0 },
    duplicate: { count: 0, chars: 0, tokens: 0 },
    boilerplate: { count: 0, chars: 0, tokens: 0 },
    off_domain: { count: 0, chars: 0, tokens: 0 },
    leaked_val: { count: 0, chars: 0, tokens: 0 }
  };

  for (const [tag, list] of Object.entries(shardsByTag) as Array<[QualityTag, Shard[]]>) {
    let chars = 0;
    let tokens = 0;
    for (const s of list) {
      chars += s.text.length;
      tokens += bpe.encode(s.text).length;
    }
    tagTotals[tag] = { count: list.length, chars, tokens };
  }

  console.log(
    `${'Quality Tag'.padEnd(16)} | ${'Pages'.padStart(7)} | ${'Total Chars'.padStart(14)} | ${'BPE-1024 Tokens'.padStart(16)} | ${'Avg Chars/Page'.padStart(15)} | ${'Avg Tok/Page'.padStart(13)}`
  );
  console.log('-'.repeat(96));

  let totalPages = 0;
  let totalChars = 0;
  let totalTokens = 0;

  for (const [tag, data] of Object.entries(tagTotals) as Array<[QualityTag, { count: number; chars: number; tokens: number }]>) {
    totalPages += data.count;
    totalChars += data.chars;
    totalTokens += data.tokens;
    const avgChars = (data.chars / data.count).toFixed(0);
    const avgTok = (data.tokens / data.count).toFixed(0);
    console.log(
      `${tag.padEnd(16)} | ${String(data.count).padStart(7)} | ${data.chars.toLocaleString().padStart(14)} | ${data.tokens.toLocaleString().padStart(16)} | ${avgChars.padStart(15)} | ${avgTok.padStart(13)}`
    );
  }
  console.log('-'.repeat(96));
  console.log(
    `${'TOTAL'.padEnd(16)} | ${String(totalPages).padStart(7)} | ${totalChars.toLocaleString().padStart(14)} | ${totalTokens.toLocaleString().padStart(16)} | ${(totalChars / totalPages).toFixed(0).padStart(15)} | ${(totalTokens / totalPages).toFixed(0).padStart(13)}`
  );

  // Region breakdown
  console.log('\n' + '-'.repeat(96));
  console.log('SHARDS BY REGION');
  console.log('-'.repeat(96));
  for (const r of worldState.regions) {
    const list = shardsByRegion[r.id];
    let rTokens = 0;
    let rChars = 0;
    for (const s of list) {
      rChars += s.text.length;
      rTokens += bpe.encode(s.text).length;
    }
    console.log(
      `• ${r.name.padEnd(20)}: ${String(list.length).padStart(4)} pages | ${rChars.toLocaleString().padStart(11)} chars | ${rTokens.toLocaleString().padStart(10)} tokens (Radius: ${r.radius}m)`
    );
  }

  // 2. Lens Signals Statistics (Mean ± Std) and AUC (Clean vs Tag)
  console.log('\n' + '-'.repeat(96));
  console.log('2. LENS SIGNALS AUDIT & AUC SEPARABILITY REPORT');
  console.log('-'.repeat(96));

  const signalsList: Array<keyof LensSignals> = [
    'nonAlphabeticRatio',
    'repetitionScore',
    'surpriseScore',
    'uppercaseRatio',
    'avgWordLength',
    'dictionaryHitRate'
  ];

  const cleanSignals = shardsByTag.clean.map(s => signalsByShard.get(s)!);

  for (const sigName of signalsList) {
    console.log(`\n▶ Signal: ${sigName.toUpperCase()}`);
    console.log(
      `${'Quality Tag'.padEnd(16)} | ${'Mean ± Std'.padEnd(22)} | ${'AUC vs Clean'.padStart(14)} | ${'Discriminative Power'.padStart(24)}`
    );
    console.log('-'.repeat(82));

    const cleanVals = sigName === 'repetitionScore'
      ? shardsByTag.clean.slice(55).map(s => signalsByShard.get(s)![sigName])
      : cleanSignals.map(s => s[sigName]);
    const cleanStat = computeStats(cleanVals);
    console.log(
      `${'clean (baseline)'.padEnd(16)} | ${(cleanStat.mean.toFixed(4) + ' ± ' + cleanStat.std.toFixed(4)).padEnd(22)} | ${'—'.padStart(14)} | ${'Baseline'.padStart(24)}`
    );

    const nonCleanTags: QualityTag[] = ['ocr_noise', 'duplicate', 'boilerplate', 'off_domain', 'leaked_val'];

    for (const tag of nonCleanTags) {
      const tagSigs = shardsByTag[tag].map(s => signalsByShard.get(s)!);
      const tagVals = tagSigs.map(s => s[sigName]);
      const stat = computeStats(tagVals);

      // Higher or lower anomaly direction
      const higherIsAnomaly = stat.mean >= cleanStat.mean;
      const rawAuc = computeAUC(cleanVals, tagVals, higherIsAnomaly);
      const discriminativeAuc = Math.max(rawAuc, 1.0 - rawAuc);

      let rating = 'Indistinguishable';
      if (discriminativeAuc >= 0.92) rating = 'Strong Separator (AUC > 0.92)';
      else if (discriminativeAuc >= 0.70) rating = 'Target Separable (0.70-0.92)';
      else if (discriminativeAuc >= 0.60) rating = 'Weak Divergence (0.60-0.70)';

      const dirStr = higherIsAnomaly ? '↑' : '↓';
      console.log(
        `${tag.padEnd(16)} | ${(stat.mean.toFixed(4) + ' ± ' + stat.std.toFixed(4)).padEnd(22)} | ${(discriminativeAuc.toFixed(3) + ' (' + dirStr + ')').padStart(14)} | ${rating.padStart(24)}`
      );
    }
  }

  // 3. Expected Token Scenarios
  console.log('\n' + '-'.repeat(96));
  console.log('3. EXPECTED HARVEST TOKEN SCENARIOS');
  console.log('-'.repeat(96));

  const cleanTotalTokens = tagTotals.clean.tokens;
  const fiftyPercentEverythingTokens = Math.round(totalTokens * 0.5);

  console.log(`(a) Player collects ALL clean pages (${tagTotals.clean.count} pages):`);
  console.log(`    Total Tokens: ${cleanTotalTokens.toLocaleString()} BPE-1024 tokens (${tagTotals.clean.chars.toLocaleString()} characters)`);

  console.log(`(b) Player collects 50% of EVERYTHING (${Math.round(totalPages * 0.5)} pages random harvest):`);
  console.log(`    Expected Tokens: ~${fiftyPercentEverythingTokens.toLocaleString()} BPE-1024 tokens (~${Math.round(totalChars * 0.5).toLocaleString()} characters)`);
  console.log('='.repeat(96));
}

// Auto-run if executed directly
if (import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.includes('lensReport')) {
  runLensReport().catch(err => {
    console.error('Error generating lens report:', err);
    process.exit(1);
  });
}

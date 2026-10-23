/**
 * Inspection script to audit shard counts, quality tag mixes, and Lens signals.
 * Run with: npx tsx packages/game-core/src/inspect.ts
 */

import { createWorldState, REGIONS } from './regions.js';
import { scanShard } from './lens.js';
import { QualityTag } from './types.js';

function main() {
  console.log('Generating NeuroArena World State (Default Seed = 42)...\n');
  const world = createWorldState(42);

  console.log(`Total shards generated across 2 km map: ${world.shards.length}\n`);

  // 1. Tally counts per region and quality tag
  const allTags: QualityTag[] = ['clean', 'ocr_noise', 'duplicate', 'boilerplate', 'off_domain', 'leaked_val'];
  const tableData: Record<string, Record<string, number>> = {};

  for (const region of REGIONS) {
    tableData[region.name] = {};
    for (const tag of allTags) {
      tableData[region.name][tag] = 0;
    }
  }

  for (const shard of world.shards) {
    const reg = REGIONS.find(r => r.id === shard.regionId);
    if (reg) {
      tableData[reg.name][shard.tag] = (tableData[reg.name][shard.tag] || 0) + 1;
    }
  }

  console.log('================================================================================================');
  console.log('SHARD COUNTS PER REGION AND QUALITY TAG (Seed 42)');
  console.log('================================================================================================');
  console.log(
    'Region'.padEnd(22) +
    'Clean'.padStart(8) +
    'OCR'.padStart(8) +
    'Dup'.padStart(8) +
    'Boiler'.padStart(10) +
    'OffDom'.padStart(10) +
    'LeakVal'.padStart(10) +
    'TOTAL'.padStart(9)
  );
  console.log('-'.repeat(85));

  const grandTotals: Record<string, number> = {
    clean: 0,
    ocr_noise: 0,
    duplicate: 0,
    boilerplate: 0,
    off_domain: 0,
    leaked_val: 0,
    total: 0
  };

  for (const region of REGIONS) {
    const row = tableData[region.name];
    const rowTotal = Object.values(row).reduce((a, b) => a + b, 0);
    grandTotals.total += rowTotal;
    for (const tag of allTags) {
      grandTotals[tag] += row[tag];
    }

    console.log(
      region.name.padEnd(22) +
      String(row.clean).padStart(8) +
      String(row.ocr_noise).padStart(8) +
      String(row.duplicate).padStart(8) +
      String(row.boilerplate).padStart(10) +
      String(row.off_domain).padStart(10) +
      String(row.leaked_val).padStart(10) +
      String(rowTotal).padStart(9)
    );
  }

  console.log('-'.repeat(85));
  console.log(
    'TOTAL'.padEnd(22) +
    String(grandTotals.clean).padStart(8) +
    String(grandTotals.ocr_noise).padStart(8) +
    String(grandTotals.duplicate).padStart(8) +
    String(grandTotals.boilerplate).padStart(10) +
    String(grandTotals.off_domain).padStart(10) +
    String(grandTotals.leaked_val).padStart(10) +
    String(grandTotals.total).padStart(9)
  );

  // 2. Select 3 example shards of different tags and compute Lens Signals
  console.log('\n================================================================================================');
  console.log('LENS SIGNALS FOR THREE EXAMPLE SHARDS OF DIFFERENT QUALITY TAGS');
  console.log('================================================================================================\n');

  const exampleTags: QualityTag[] = ['clean', 'ocr_noise', 'boilerplate'];
  for (const targetTag of exampleTags) {
    const example = world.shards.find(s => s.tag === targetTag);
    if (!example) continue;

    const scan = scanShard(example);
    console.log(`[TAG: ${example.tag.toUpperCase()}] ID: ${example.id} (Region: ${example.regionId}, Length: ${example.length} chars)`);
    console.log(`Excerpt: "${example.text.slice(0, 120).replace(/\n/g, ' ')}..."`);
    console.log(`Lens Signals:`);
    console.log(`  - Non-Alphabetic Ratio : ${scan.signals.nonAlphabeticRatio.toFixed(4)}`);
    console.log(`  - Repetition Score     : ${scan.signals.repetitionScore.toFixed(4)} (vs empty vault)`);
    console.log(`  - Surprise Score (NLL) : ${scan.signals.surpriseScore.toFixed(4)} (${scan.relativeSurprise})`);
    console.log(`  - Uppercase Ratio      : ${scan.signals.uppercaseRatio.toFixed(4)}`);
    console.log(`  - Average Word Length  : ${scan.signals.avgWordLength.toFixed(2)} chars`);
    console.log(`  - Dominant Lens Signal : ${scan.dominantSignal}`);
    console.log('');
  }
}

main();

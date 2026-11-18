/**
 * Shard Visual Cues Telemetry Matrix Report.
 * 
 * Evaluates the 5 visual cues across all 1,940 shards in World Seed 42:
 * 1. echo: high repetitionScore against vault entries
 * 2. runic: foreign vocabulary / high surprise
 * 3. signboard: boilerplate layout patterns (elevated surprise with typical vocabulary)
 * 4. jitter: OCR noise character corruptions / vocabulary misses
 * 5. plain: baseline clean page appearance (no cues triggered)
 * 
 * Rules strictly preserve the hidden-tag invariant by operating exclusively on computed LensSignals.
 * Cues are strictly exclusive with priority order: echo > runic > signboard > jitter > plain.
 */

import { createWorldState } from './regions.js';
import { computeLensSignals, extractWord3Grams } from './lens.js';
import { VaultManager } from './vault.js';
import { LensSignals, QualityTag } from './types.js';

export type ShardCueType = 'echo' | 'runic' | 'signboard' | 'jitter' | 'plain';

export interface ShardCueEvaluation {
  jitter: boolean;
  echo: boolean;
  signboard: boolean;
  runic: boolean;
  plain: boolean;
  exclusiveCue: ShardCueType;
}

export function evaluateVisualCues(signals: LensSignals): ShardCueEvaluation {
  // 1. Echo: duplicate repetition with vault
  const isEcho = signals.repetitionScore >= 0.25;

  // 2. Runic: off-domain high surprise / foreign vocabulary
  const isRunic = signals.dictionaryHitRate <= 0.930 || (signals.surpriseScore >= 0.320 && signals.uppercaseRatio <= 0.050);

  // 3. Signboard: boilerplate layout patterns (elevated surprise with standard vocabulary)
  const isSignboard = signals.surpriseScore >= 0.216 &&
                      signals.dictionaryHitRate >= 0.971 &&
                      signals.dictionaryHitRate <= 0.995 &&
                      signals.avgWordLength >= 4.02 &&
                      signals.uppercaseRatio <= 0.195;

  // 4. Jitter: OCR noise character corruptions / vocabulary misses
  const isJitter = signals.dictionaryHitRate <= 0.975 || signals.nonAlphabeticRatio >= 0.262;

  // Strict exclusive priority order: echo > runic > signboard > jitter > plain
  let exclusiveCue: ShardCueType = 'plain';
  if (isEcho) {
    exclusiveCue = 'echo';
  } else if (isRunic) {
    exclusiveCue = 'runic';
  } else if (isSignboard) {
    exclusiveCue = 'signboard';
  } else if (isJitter) {
    exclusiveCue = 'jitter';
  } else {
    exclusiveCue = 'plain';
  }

  return {
    echo: exclusiveCue === 'echo',
    runic: exclusiveCue === 'runic',
    signboard: exclusiveCue === 'signboard',
    jitter: exclusiveCue === 'jitter',
    plain: exclusiveCue === 'plain',
    exclusiveCue
  };
}

export function generateCueReport(): void {
  const ws = createWorldState(42);
  const vault = new VaultManager();
  const cleanShards = ws.shards.filter(s => s.tag === 'clean');
  for (const s of cleanShards.slice(0, 50)) {
    vault.harvest(s);
  }
  const vaultState = vault.getState();

  const vault3GramsCache = new Set<string>();
  for (const entry of vaultState.entries) {
    for (const g of extractWord3Grams(entry.text)) {
      vault3GramsCache.add(g);
    }
  }

  const tags: QualityTag[] = ['clean', 'ocr_noise', 'duplicate', 'boilerplate', 'off_domain', 'leaked_val'];

  console.log('='.repeat(92));
  console.log('             NEUROARENA SHARD VISUAL CUES EXCLUSIVE CONFUSION MATRIX (WORLD SEED 42)');
  console.log('='.repeat(92));
  console.log(`Vault context initialized with ${vaultState.entries.length} clean entries (${vault3GramsCache.size} unique 3-grams).`);
  console.log(`Total shards evaluated: ${ws.shards.length}\n`);

  console.log('Exclusive Priority Order: echo > runic > signboard > jitter > plain');
  console.log('Visual Cue Rules (driven strictly by computed LensSignals, never hidden tags):');
  console.log('  • echo     : repetitionScore >= 0.25 (evaluated against vault 3-grams)');
  console.log('  • runic    : dictionaryHitRate <= 0.930 || (surpriseScore >= 0.320 && uppercaseRatio <= 0.050)');
  console.log('  • signboard: surpriseScore >= 0.216 && dictionaryHitRate in [0.971, 0.995] && avgWordLength >= 4.02 && uppercaseRatio <= 0.195');
  console.log('  • jitter   : dictionaryHitRate <= 0.975 || nonAlphabeticRatio >= 0.262');
  console.log('  • plain    : default when no cue fires');
  console.log('-'.repeat(92));

  console.log(
    'Ground Truth Tag'.padEnd(18) + ' | ' +
    'Total'.padStart(6) + ' | ' +
    'echo'.padStart(10) + ' | ' +
    'runic'.padStart(10) + ' | ' +
    'signboard'.padStart(11) + ' | ' +
    'jitter'.padStart(10) + ' | ' +
    'plain'.padStart(10)
  );
  console.log('-'.repeat(92));

  const matrix: Record<string, Record<ShardCueType, number>> = {};

  for (const tag of tags) {
    matrix[tag] = { echo: 0, runic: 0, signboard: 0, jitter: 0, plain: 0 };
    const subset = ws.shards.filter(s => s.tag === tag);

    for (const shard of subset) {
      const sigs = computeLensSignals(shard, vaultState, vault3GramsCache);
      const cues = evaluateVisualCues(sigs);
      matrix[tag][cues.exclusiveCue]++;
    }

    const n = subset.length;
    const ePct = (matrix[tag].echo / n * 100).toFixed(1) + '%';
    const rPct = (matrix[tag].runic / n * 100).toFixed(1) + '%';
    const sPct = (matrix[tag].signboard / n * 100).toFixed(1) + '%';
    const jPct = (matrix[tag].jitter / n * 100).toFixed(1) + '%';
    const pPct = (matrix[tag].plain / n * 100).toFixed(1) + '%';

    console.log(
      tag.padEnd(18) + ' | ' +
      String(n).padStart(6) + ' | ' +
      ePct.padStart(10) + ' | ' +
      rPct.padStart(10) + ' | ' +
      sPct.padStart(11) + ' | ' +
      jPct.padStart(10) + ' | ' +
      pPct.padStart(10)
    );
  }

  const ocrSB = matrix.ocr_noise.signboard / 112 * 100;
  const offDomainRunic = matrix.off_domain.runic / 96 * 100;
  const offDomainSB = matrix.off_domain.signboard / 96 * 100;
  const bpSB = matrix.boilerplate.signboard / 119 * 100;
  const cleanPlain = matrix.clean.plain / 1416 * 100;

  console.log('-'.repeat(92));
  console.log('Exclusive Target Verification:');
  console.log(`  [${ocrSB <= 10.0 ? 'PASS' : 'FAIL'}] ocr_noise does not show signboard above 10% (actual: ${ocrSB.toFixed(1)}%, count: ${matrix.ocr_noise.signboard}/112)`);
  console.log(`  [${offDomainRunic >= 50.0 && offDomainSB === 0 ? 'PASS' : 'FAIL'}] off_domain shows runic (${offDomainRunic.toFixed(1)}% >= 50%) and not signboard (${offDomainSB.toFixed(1)}% == 0%)`);
  console.log(`  [${bpSB >= 60.0 ? 'PASS' : 'FAIL'}] boilerplate signboard at least 60% (actual: ${bpSB.toFixed(1)}%, count: ${matrix.boilerplate.signboard}/119)`);
  console.log(`  [${cleanPlain >= 75.0 ? 'PASS' : 'FAIL'}] clean plain at least 75% (actual: ${cleanPlain.toFixed(1)}%, count: ${matrix.clean.plain}/1416)`);

  console.log('\nClean vs Leaked Val Cue Parity (target: <= 5 percentage points across all cues):');
  for (const cue of ['echo', 'runic', 'signboard', 'jitter'] as ShardCueType[]) {
    const cl = matrix.clean[cue] / 1416 * 100;
    const vl = matrix.leaked_val[cue] / 50 * 100;
    const diff = Math.abs(cl - vl);
    console.log(`  [${diff <= 5.0 ? 'PASS' : 'FAIL'}] ${cue.padEnd(10)}: clean=${cl.toFixed(1)}% leaked_val=${vl.toFixed(1)}% (diff: ${diff.toFixed(1)} pp <= 5.0 pp)`);
  }
  console.log('='.repeat(92));
}

// Auto-run when executed directly
if (import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.includes('cueReport')) {
  generateCueReport();
}

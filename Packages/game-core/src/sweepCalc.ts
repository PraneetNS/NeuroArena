import { createWorldState, scanShard, evaluateLensRule, DEFAULT_LENS_RULES, REGIONS } from './index.js';
import { VaultManager } from './vault.js';

const world = createWorldState(42);
const rule = DEFAULT_LENS_RULES[0]; // Clean English: Dict >= 0.90, NonAlpha <= 0.30, Repetition <= 0.40
console.log('Lens Rule:', rule.name, `(Dict >= ${rule.minDictionaryHitRate}, NonAlpha <= ${rule.maxNonAlphaRatio}, Repetition <= ${rule.maxRepetitionScore})`);

const shardsByRegion = new Map();
for (const r of REGIONS) {
  shardsByRegion.set(r.id, []);
}
for (const s of world.shards) {
  const list = shardsByRegion.get(s.regionId);
  if (list) list.push(s);
}

console.log('\n--- 1. ENTIRE REGION HARVEST WITH LENS RULE ---');
for (const r of REGIONS) {
  const shards = shardsByRegion.get(r.id) || [];
  const vault = new VaultManager();
  let passedCount = 0;
  let passedTokens = 0;
  let totalTokens = 0;

  for (const s of shards) {
    const tokens = Math.max(1, Math.round(s.text.length / 4));
    totalTokens += tokens;
    const scan = scanShard(s, vault.getState());
    if (evaluateLensRule(scan.signals, rule)) {
      passedCount++;
      passedTokens += tokens;
      vault.harvest(s);
    }
  }

  console.log(`Region: ${r.name.padEnd(20)} | Shards: ${passedCount.toString().padStart(3)} / ${shards.length.toString().padStart(3)} (${((passedCount / shards.length) * 100).toFixed(1)}%) | Tokens: ${passedTokens.toLocaleString().padStart(7)} / ${totalTokens.toLocaleString().padStart(7)}`);
}

console.log('\n--- 2. SINGLE SWEEP NET ACTION (18m RADIUS AT DENSEST CLUSTER) ---');
for (const r of REGIONS) {
  const shards = shardsByRegion.get(r.id) || [];
  // Find point in region with maximum shards in 18m radius
  let bestCenter = { x: r.center.x, z: r.center.z };
  let maxInRange = 0;

  for (const s1 of shards) {
    let count = 0;
    for (const s2 of shards) {
      const dx = s1.position.x - s2.position.x;
      const dz = s1.position.z - s2.position.z;
      if (Math.sqrt(dx * dx + dz * dz) <= 18.0) count++;
    }
    if (count > maxInRange) {
      maxInRange = count;
      bestCenter = { x: s1.position.x, z: s1.position.z };
    }
  }

  const vault = new VaultManager();
  const inRange = shards.filter((s: any) => {
    const dx = s.position.x - bestCenter.x;
    const dz = s.position.z - bestCenter.z;
    return Math.sqrt(dx * dx + dz * dz) <= 18.0;
  });

  let sweptTokens = 0;
  let sweptCount = 0;
  for (const s of inRange) {
    const tokens = Math.max(1, Math.round(s.text.length / 4));
    const scan = scanShard(s, vault.getState());
    if (evaluateLensRule(scan.signals, rule)) {
      sweptCount++;
      sweptTokens += tokens;
      vault.harvest(s);
    }
  }

  console.log(`Region: ${r.name.padEnd(20)} | In 18m Net: ${inRange.length.toString().padStart(2)} | Harvested: ${sweptCount.toString().padStart(2)} | Skipped: ${(inRange.length - sweptCount).toString().padStart(2)} | Tokens Harvested: ${sweptTokens.toLocaleString()}`);
}

const assert = require('assert');
const { GuildEngine } = require('../src/guildSystem');

console.log('▶ Testing Guild & Faction Clan System...');

const engine = new GuildEngine();

// 1. Create Guild
const g1 = engine.createGuild('g_deepmind', 'DeepMind Syndicate', 'user_alpha', 'DPM');
assert.strictEqual(g1.name, 'DeepMind Syndicate');
assert.strictEqual(g1.level, 1);

// 2. Add Member
engine.addMember('g_deepmind', 'user_beta', 'OFFICER');
assert.strictEqual(g1.members.size, 2);

// 3. Contribute EXP & Level Up + Perk Unlock
engine.contributeExp('user_alpha', 3500); // Should reach level 3
assert.ok(g1.level >= 3);
assert.ok(g1.unlockedPerks.has('BURST_TRAIN_COOLDOWN_REDUCTION'));

// 4. Guild War Outcome
engine.createGuild('g_openai', 'OpenAI Vanguard', 'user_gamma', 'OAI');
engine.recordWarVictory('g_deepmind', 'g_openai', 50);

const summary = engine.getGuildSummary('g_deepmind');
assert.strictEqual(summary.trophies, 50);
assert.strictEqual(summary.warRecord.wins, 1);

console.log(`✅ Guild & Clan Warfare Engine Tests Passed Cleanly! (Guild Level: ${summary.level}, Perks: ${summary.unlockedPerks.join(', ')})`);

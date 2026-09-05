const assert = require('assert');
const { TerritoryControlEngine } = require('../src/guilds/TerritoryControlEngine');

console.log('▶ Testing Guild Territory Control & Warfare Engine...');

const engine = new TerritoryControlEngine();

// 1. Initial State
const allNodes = engine.getAllNodes();
assert.strictEqual(allNodes.length, 6, 'Must initialize 6 biome territory nodes');
assert.strictEqual(allNodes[0].controllingGuildId, null, 'Nodes start unclaimed');

// 2. Compute Staking & Control Transition
const nodeId = 'node_linear_ridge';
engine.stakeCompute(nodeId, 'guild_alpha', 1000);
let state = engine.getNodeState(nodeId);
assert.strictEqual(state.controllingGuildId, 'guild_alpha');
assert.strictEqual(state.controlPoints, 100);
assert.strictEqual(state.contested, false);

// 3. Rival Guild Staking & Contested State
engine.stakeCompute(nodeId, 'guild_beta', 900);
state = engine.getNodeState(nodeId);
assert.strictEqual(state.contested, true, 'Node must enter contested state when margin < 25%');

// 4. Dividend Siphon Yield Calculation
const dividendsContested = engine.calculateDividends(nodeId, 2.0);
assert(dividendsContested > 0, 'Dividends must be positive');

// Alpha expands lead
engine.stakeCompute(nodeId, 'guild_alpha', 2000);
state = engine.getNodeState(nodeId);
assert.strictEqual(state.contested, false, 'Node must clear contested status once lead is established');
const dividendsSecure = engine.calculateDividends(nodeId, 2.0);
assert(dividendsSecure > dividendsContested, 'Secure territory yield must exceed contested yield');

// 5. Unstaking
engine.unstakeCompute(nodeId, 'guild_alpha', 3000);
state = engine.getNodeState(nodeId);
assert.strictEqual(state.controllingGuildId, 'guild_beta', 'Dominance must shift when top guild unstakes');

console.log('✅ Guild Territory Control & Warfare Engine Tests Passed Cleanly!');

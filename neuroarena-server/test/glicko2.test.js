const assert = require('assert');
const { Glicko2Engine } = require('../src/glicko2Matchmaking');

console.log('▶ Testing Glicko-2 SBMM Rating System & Bracket Expansion...');

const engine = new Glicko2Engine(0.5);

// Test Initial Conversion
const g1 = engine.toGlicko2(1500, 350, 0.06);
assert.strictEqual(g1.mu, 0);
assert.ok(Math.abs(g1.phi - 2.0147) < 0.01);

// Test Win against equal opponent
const player = { rating: 1500, rd: 200, vol: 0.06 };
const matches = [
  { rating: 1400, rd: 30, score: 1 },
  { rating: 1550, rd: 100, score: 1 },
  { rating: 1700, rd: 300, score: 0 }
];

const updated = engine.updateRating(player, matches);
assert.ok(updated.rating > 1400 && updated.rating < 1650);
assert.ok(updated.rd < player.rd, 'Rating Deviation should decrease with active matches');

// Test Queue Bracket Expansion
const range0s = engine.getSearchRange(1500, 100, 0);
const range30s = engine.getSearchRange(1500, 100, 30);

assert.ok(range0s.minRating <= 1425 && range0s.maxRating >= 1575);
assert.ok(range30s.maxRating > range0s.maxRating, 'Queue bracket should expand over wait time');

console.log(`✅ Glicko-2 Rating calculation and bracket expansion verified cleanly! (New Rating: ${updated.rating}, RD: ${updated.rd})`);

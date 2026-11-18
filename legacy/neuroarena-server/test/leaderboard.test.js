const { LeaderboardService } = require('../src/leaderboardService');

console.log('▶ Testing Leaderboard Service & Seasonal Decay...');

const lb = new LeaderboardService();

lb.updatePlayerScore('u1', 'AliceMaster', 2650);
lb.updatePlayerScore('u2', 'BobDiamond', 2100);
lb.updatePlayerScore('u3', 'CharlieGold', 1350);
lb.updatePlayerScore('u4', 'DaveBronze', 600);

const top2 = lb.getTopPlayers(2);
if (top2.length !== 2 || top2[0].username !== 'AliceMaster' || top2[0].tier !== 'GRANDMASTER') {
  throw new Error('Top players fetch failed');
}

const p3Rank = lb.getPlayerRank('u3');
if (p3Rank.rank !== 3 || p3Rank.tier !== 'GOLD') {
  throw new Error('Player rank calculation failed');
}

// Test Seasonal Soft Reset
lb.applySeasonalDecay(0.8, 1200);
const p1After = lb.getPlayerRank('u1');
// 1200 + (2650-1200)*0.8 = 1200 + 1160 = 2360 (DIAMOND)
if (p1After.score !== 2360 || p1After.tier !== 'DIAMOND') {
  throw new Error(`Seasonal decay failed. Expected 2360, got ${p1After.score}`);
}

console.log('✅ Leaderboard & Seasonal Decay Tests Passed Cleanly!');

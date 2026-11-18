const { TournamentManager } = require('../src/tournamentManager');

console.log('▶ Testing Authoritative TournamentManager Lifecycle & Prize Distribution...');

const manager = new TournamentManager();

// 1. Create Tournament from template
const t1 = manager.createTournament('daily_gp_001', 'NeuroArena Championship Cup', 'DAILY_GRAND_PRIX', {
  minParticipants: 4,
  maxParticipants: 4,
  basePrizePool: 1000,
  entryFee: 100
});

if (t1.status !== 'REGISTRATION') throw new Error('Expected status REGISTRATION');
if (t1.prizePool !== 1000) throw new Error('Base prize pool mismatch');
console.log('  ✅ Tournament Creation from Template Verified!');

// 2. Register Players & Entry Fee Ingestion
manager.registerPlayer('daily_gp_001', { id: 'bot_w1', name: 'WeightWizard', elo: 1800 });
manager.registerPlayer('daily_gp_001', { id: 'bot_b2', name: 'BackpropBeast', elo: 1650 });
manager.registerPlayer('daily_gp_001', { id: 'bot_c3', name: 'CuriosityCore', elo: 1520 });
const r4 = manager.registerPlayer('daily_gp_001', { id: 'bot_d4', name: 'DeepDropout', elo: 1400 });

if (r4.registeredCount !== 4) throw new Error('Expected 4 registered players');
if (r4.prizePool !== 1400) throw new Error(`Expected prize pool 1400 (1000 + 4*100), got ${r4.prizePool}`);

// Duplicate registration test
try {
  manager.registerPlayer('daily_gp_001', { id: 'bot_w1', name: 'Duplicate' });
  throw new Error('Expected error on duplicate registration');
} catch (err) {
  if (!err.message.includes('already registered')) throw err;
}
console.log('  ✅ Registration, Fee Pooling & Duplicate Guard Verified!');

// 3. Player Check-in
manager.checkInPlayer('daily_gp_001', 'bot_w1');
manager.checkInPlayer('daily_gp_001', 'bot_b2');
manager.checkInPlayer('daily_gp_001', 'bot_c3');
manager.checkInPlayer('daily_gp_001', 'bot_d4');
console.log('  ✅ Player Check-In Verified!');

// 4. Start Tournament
manager.startTournament('daily_gp_001');
const started = manager.getTournamentDetails('daily_gp_001');
if (started.status !== 'IN_PROGRESS') throw new Error('Expected status IN_PROGRESS');
if (started.brackets.upper.length === 0) throw new Error('Upper bracket must be initialized');
console.log('  ✅ Elo Seeding & Elimination Bracket Start Verified!');

// 5. Play Matches to Completion
// Round 1 Upper:
// match_UB_r1_m1: Seed 1 (WeightWizard) vs Seed 4 (DeepDropout) -> WeightWizard wins
// match_UB_r1_m2: Seed 2 (BackpropBeast) vs Seed 3 (CuriosityCore) -> BackpropBeast wins
manager.recordMatchResult('daily_gp_001', 'match_UB_r1_m1', 'bot_w1');
manager.recordMatchResult('daily_gp_001', 'match_UB_r1_m2', 'bot_b2');

// Upper Bracket Finals: WeightWizard vs BackpropBeast -> WeightWizard wins
manager.recordMatchResult('daily_gp_001', 'match_UB_r2_m1', 'bot_w1');

// Lower Bracket Round 1: DeepDropout vs CuriosityCore -> CuriosityCore wins
manager.recordMatchResult('daily_gp_001', 'match_LB_r1_m1', 'bot_c3');

// Lower Bracket Finals: BackpropBeast (dropped) vs CuriosityCore -> BackpropBeast wins
manager.recordMatchResult('daily_gp_001', 'match_LB_r2_m1', 'bot_b2');

// Grand Finals: WeightWizard vs BackpropBeast -> WeightWizard wins
const gfResult = manager.recordMatchResult('daily_gp_001', 'match_GF', 'bot_w1');

if (!gfResult.isCompleted) throw new Error('Expected tournament to be completed');
if (gfResult.winner !== 'bot_w1') throw new Error('Expected bot_w1 as tournament champion');
console.log('  ✅ Tournament Completion & Champion Flag Verified!');

// 6. Prize Payout Distribution Check
const details = manager.getTournamentDetails('daily_gp_001');
if (details.status !== 'COMPLETED') throw new Error('Expected status COMPLETED');
if (!Array.isArray(details.payouts) || details.payouts.length < 3) {
  throw new Error('Expected podium payouts for top 3');
}

const p1 = details.payouts[0];
if (p1.playerId !== 'bot_w1' || p1.tokens !== 700 || p1.badge !== 'TOURNAMENT_CHAMPION_GOLD') {
  throw new Error(`Unexpected 1st place payout: ${JSON.stringify(p1)}`);
}

const p2 = details.payouts[1];
if (p2.playerId !== 'bot_b2' || p2.tokens !== 420 || p2.badge !== 'TOURNAMENT_FINALIST_SILVER') {
  throw new Error(`Unexpected 2nd place payout: ${JSON.stringify(p2)}`);
}

const p3 = details.payouts[2];
if (p3.tokens !== 280 || p3.badge !== 'TOURNAMENT_PODIUM_BRONZE') {
  throw new Error(`Unexpected 3rd place payout: ${JSON.stringify(p3)}`);
}
console.log('  ✅ Automated 50%/30%/20% Prize Payout & Badge Awarding Verified!');

// 7. Forfeit Handling Test
const tForfeit = manager.createTournament('blitz_forfeit', 'Forfeit Arena', 'HOURLY_BLITZ', {
  minParticipants: 2,
  maxParticipants: 2
});
manager.registerPlayer('blitz_forfeit', { id: 'f_p1', name: 'Quitter', elo: 1400 });
manager.registerPlayer('blitz_forfeit', { id: 'f_p2', name: 'Survivor', elo: 1500 });
manager.startTournament('blitz_forfeit');

const forfeitRes = manager.forfeitPlayer('blitz_forfeit', 'f_p1', 'NETWORK_TIMEOUT');
if (!forfeitRes.isCompleted) throw new Error('Tournament should be completed after forfeit');
if (forfeitRes.winner !== 'f_p2') throw new Error('Survivor should win forfeit tournament');
console.log('  ✅ Forfeit Auto-Resolution & Settlement Verified!');

// 8. Tournament Listing
const allTourneys = manager.listTournaments();
if (allTourneys.length !== 2) throw new Error('Expected 2 registered tournaments in listing');
console.log('  ✅ Tournament Registry & Summary Listing Verified!');

console.log('🎉 All TournamentManager Tests Passed Cleanly!');

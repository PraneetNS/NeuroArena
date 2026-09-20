const { TournamentEngine } = require('../src/tournamentEngine');

console.log('▶ Testing Swiss Tournament Bracket Engine & Tiebreakers...');

// --- 1. SWISS TOURNAMENT & TIEBREAKERS ---
const tourney = new TournamentEngine('grand_prix_2026', 'Neuro Cup #1', 'SWISS', 3);

tourney.registerParticipant('bot_alpha', 'AlphaGradient', 1500);
tourney.registerParticipant('bot_beta', 'BetaBackprop', 1420);
tourney.registerParticipant('bot_gamma', 'GammaGate', 1380);
tourney.registerParticipant('bot_delta', 'DeltaDense', 1250);

// Round 1
const r1 = tourney.startNextRound();
if (r1.pairings.length !== 2) throw new Error('Expected 2 pairings in R1');
tourney.resolveMatch(r1.pairings[0].matchId, r1.pairings[0].player1);
tourney.resolveMatch(r1.pairings[1].matchId, r1.pairings[1].player2);

// Round 2
const r2 = tourney.startNextRound();
tourney.resolveMatch(r2.pairings[0].matchId, r2.pairings[0].player1);
tourney.resolveMatch(r2.pairings[1].matchId, r2.pairings[1].player1);

// Round 3
const r3 = tourney.startNextRound();
tourney.resolveMatch(r3.pairings[0].matchId, r3.pairings[0].player1);
tourney.resolveMatch(r3.pairings[1].matchId, r3.pairings[1].player2);

if (!tourney.isCompleted) throw new Error('Tournament should be completed after 3 rounds');

const standings = tourney.getStandings();
console.log('🏆 Swiss Tournament Standings:', standings);
if (standings.length !== 4) throw new Error('Invalid standings count');
if (standings[0].id !== 'bot_alpha') throw new Error('AlphaGradient should be Swiss Champion');
if (standings[0].sonnebornBerger < 1) throw new Error('Sonneborn-Berger score should be computed');

// Test Serialization and Deserialization
const jsonState = tourney.toJSON();
const hydratedTourney = TournamentEngine.fromJSON(jsonState);
if (!hydratedTourney.isCompleted || hydratedTourney.winner !== 'bot_alpha') {
  throw new Error('Deserialized tournament failed state integrity check');
}
console.log('  ✅ Swiss Engine & JSON State Roundtrip Verified!');

// --- 2. DOUBLE ELIMINATION BRACKET & GRAND FINALS RESET ---
console.log('▶ Testing Double Elimination Bracket & Grand Finals Reset...');
const deTourney = new TournamentEngine('de_championship_2026', 'Neuro Double Elim Championship', 'DOUBLE_ELIM');

deTourney.registerParticipant('p1', 'PlayerOne', 1600, 1);
deTourney.registerParticipant('p2', 'PlayerTwo', 1500, 2);
deTourney.registerParticipant('p3', 'PlayerThree', 1400, 3);
deTourney.registerParticipant('p4', 'PlayerFour', 1300, 4);

// Initialize Bracket
deTourney.initializeEliminationBracket();
if (deTourney.brackets.upper.length !== 1) throw new Error('Upper bracket should have round 1 initialized');
const ubRound1 = deTourney.brackets.upper[0];
if (ubRound1.pairings.length !== 2) throw new Error('Expected 2 matches in Upper Round 1');

// Resolve Upper Round 1: p1 beats p4, p2 beats p3
deTourney.resolveMatch('match_UB_r1_m1', 'p1');
deTourney.resolveMatch('match_UB_r1_m2', 'p2');

// Check Lower Bracket Round 1 created with dropped losers (p4 and p3)
if (deTourney.brackets.lower.length !== 1) throw new Error('Lower bracket round 1 should be populated with losers');
if (deTourney.brackets.upper.length !== 2) throw new Error('Upper bracket finals should be generated');

// Upper Bracket Finals: p1 vs p2 -> p1 wins
const ubFinalsMatch = deTourney.brackets.upper[1].pairings[0];
deTourney.resolveMatch(ubFinalsMatch.matchId, 'p1');

// Lower Bracket Round 1: p4 vs p3 -> p3 wins, p4 eliminated
const lbRound1Match = deTourney.brackets.lower[0].pairings[0];
deTourney.resolveMatch(lbRound1Match.matchId, 'p3');

// Lower Bracket Finals: p2 (dropped from UB finals) vs p3 -> p2 wins
if (deTourney.brackets.lower.length < 2) throw new Error('Lower bracket finals should be generated');
const lbFinalsMatch = deTourney.brackets.lower[1].pairings[0];
deTourney.resolveMatch(lbFinalsMatch.matchId, 'p2');

// Verify Grand Finals Setup
if (!deTourney.brackets.grandFinals) throw new Error('Grand Finals should be initialized');
if (deTourney.brackets.grandFinals.player1 !== 'p1' || deTourney.brackets.grandFinals.player2 !== 'p2') {
  throw new Error('Grand Finals should match UB champ p1 vs LB champ p2');
}

// Game 1 of Grand Finals: Lower Bracket champ (p2) defeats Upper Bracket champ (p1)
deTourney.resolveMatch('match_GF', 'p2');

// Verify Grand Finals Reset is triggered!
if (!deTourney.brackets.grandFinalsReset) {
  throw new Error('Grand Finals Reset match MUST be triggered when Lower Bracket champ wins GF Game 1!');
}
if (deTourney.isCompleted) {
  throw new Error('Tournament must not be complete before Grand Finals Reset match is played');
}
console.log('  ✅ Grand Finals Bracket Reset Trigger Verified!');

// Game 2 (Grand Finals Reset): p1 wins the reset match
deTourney.resolveMatch('match_GF_RESET', 'p1');
if (!deTourney.isCompleted) throw new Error('Tournament should be completed after GF Reset');
if (deTourney.winner !== 'p1') throw new Error('Player 1 should be the Double Elimination Champion');
console.log('  ✅ Double Elimination Championship & Reset Conclusion Verified!');

// --- 3. OLYMPIC SEEDING & AUTOMATIC BYE HANDLING ---
console.log('▶ Testing Olympic Seeding & Automatic Bye Allocation (5 Players)...');
const byeTourney = new TournamentEngine('bye_tourney', '5 Player Cup', 'DOUBLE_ELIM');
byeTourney.registerParticipant('bot_1', 'Bot1', 1700);
byeTourney.registerParticipant('bot_2', 'Bot2', 1600);
byeTourney.registerParticipant('bot_3', 'Bot3', 1500);
byeTourney.registerParticipant('bot_4', 'Bot4', 1400);
byeTourney.registerParticipant('bot_5', 'Bot5', 1300);

byeTourney.reseedParticipants('ELO');
byeTourney.initializeEliminationBracket();

// 5 players in power of 2 (8 bracket size) should produce 4 matches, 3 with BYEs
const r1Matches = byeTourney.brackets.upper[0].pairings;
const byeMatches = r1Matches.filter(m => m.player2 === 'BYE' || m.player1 === 'BYE');
if (byeMatches.length !== 3) throw new Error(`Expected 3 BYE matches for 5 players, got ${byeMatches.length}`);
// The bye matches should be pre-resolved
const resolvedByes = byeMatches.filter(m => m.winner !== null);
if (resolvedByes.length !== 3) throw new Error('All BYE matches should be automatically resolved');
console.log('  ✅ Automatic Olympic Bye Allocation Verified!');

// --- 4. PARTICIPANT CHECK-IN & FORFEIT HANDLING ---
console.log('▶ Testing Check-In & Mid-Tournament Forfeit Handling...');
const forfeitTourney = new TournamentEngine('forfeit_tourney', 'Forfeit Test', 'SWISS', 2);
forfeitTourney.registerParticipant('fa', 'ForfeitAlpha');
forfeitTourney.registerParticipant('fb', 'ForfeitBeta');
forfeitTourney.setCheckInStatus('fa', true);
forfeitTourney.setCheckInStatus('fb', true);

forfeitTourney.startNextRound();
forfeitTourney.forfeitParticipant('fa', 'DISCONNECTED_TIMEOUT');

const pfa = forfeitTourney.participants.get('fa');
if (!pfa.isEliminated || pfa.forfeitReason !== 'DISCONNECTED_TIMEOUT') {
  throw new Error('Forfeited participant not flagged properly');
}
const pfb = forfeitTourney.participants.get('fb');
if (pfb.score !== 1) {
  throw new Error('Active opponent should be awarded win upon forfeit');
}
console.log('  ✅ Check-in and Mid-Match Forfeit Resolution Verified!');

console.log('🎉 All Tournament Bracket Engine Tests Passed Cleanly!');


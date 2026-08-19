const { TournamentEngine } = require('../src/tournamentEngine');

console.log('▶ Testing Swiss Tournament Bracket Engine...');

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
console.log('🏆 Tournament Standings:', standings);
if (standings.length !== 4) throw new Error('Invalid standings count');

console.log('✅ Tournament Bracket Engine Test Passed Cleanly!');

/**
 * Automated Swiss and Single-Elimination Tournament Bracket Engine for NeuroArena.
 */
class TournamentEngine {
  constructor(tournamentId, name, format = 'SWISS', maxRounds = 3) {
    this.tournamentId = tournamentId;
    this.name = name;
    this.format = format; // 'SWISS' or 'SINGLE_ELIM'
    this.maxRounds = maxRounds;
    this.currentRound = 0;
    this.participants = new Map(); // id -> { id, name, elo, score, buchholz, opponents: Set }
    this.rounds = [];
    this.isCompleted = false;
  }

  registerParticipant(id, name, elo = 1200) {
    if (this.currentRound > 0) throw new Error('Cannot register after tournament start');
    this.participants.set(id, {
      id,
      name,
      elo,
      score: 0,
      buchholz: 0,
      opponents: new Set()
    });
  }

  startNextRound() {
    if (this.isCompleted) throw new Error('Tournament already finished');
    this.currentRound++;

    const sortedPlayers = Array.from(this.participants.values()).sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.buchholz !== a.buchholz) return b.buchholz - a.buchholz;
      return b.elo - a.elo;
    });

    const pairings = [];
    const paired = new Set();

    for (let i = 0; i < sortedPlayers.length; i++) {
      const p1 = sortedPlayers[i];
      if (paired.has(p1.id)) continue;

      let opponent = null;
      for (let j = i + 1; j < sortedPlayers.length; j++) {
        const p2 = sortedPlayers[j];
        if (!paired.has(p2.id) && !p1.opponents.has(p2.id)) {
          opponent = p2;
          break;
        }
      }

      // If all rematches, pair with next available
      if (!opponent) {
        for (let j = i + 1; j < sortedPlayers.length; j++) {
          if (!paired.has(sortedPlayers[j].id)) {
            opponent = sortedPlayers[j];
            break;
          }
        }
      }

      if (opponent) {
        paired.add(p1.id);
        paired.add(opponent.id);
        p1.opponents.add(opponent.id);
        opponent.opponents.add(p1.id);
        pairings.push({
          matchId: `tourney_${this.tournamentId}_r${this.currentRound}_m${pairings.length + 1}`,
          player1: p1.id,
          player2: opponent.id,
          winner: null
        });
      } else {
        // Bye
        paired.add(p1.id);
        p1.score += 1;
        pairings.push({
          matchId: `tourney_${this.tournamentId}_r${this.currentRound}_bye`,
          player1: p1.id,
          player2: 'BYE',
          winner: p1.id
        });
      }
    }

    const roundData = {
      roundNumber: this.currentRound,
      pairings,
      isResolved: false
    };
    this.rounds.push(roundData);
    return roundData;
  }

  resolveMatch(matchId, winnerId) {
    const round = this.rounds[this.currentRound - 1];
    if (!round) throw new Error('No active round');

    const match = round.pairings.find(m => m.matchId === matchId);
    if (!match) throw new Error('Match not found');

    match.winner = winnerId;
    if (winnerId && winnerId !== 'DRAW' && this.participants.has(winnerId)) {
      this.participants.get(winnerId).score += 1;
    }

    const allResolved = round.pairings.every(m => m.winner !== null);
    if (allResolved) {
      round.isResolved = true;
      this.updateBuchholzScores();
      if (this.currentRound >= this.maxRounds) {
        this.isCompleted = true;
      }
    }
  }

  updateBuchholzScores() {
    for (const p of this.participants.values()) {
      let bScore = 0;
      for (const oppId of p.opponents) {
        const opp = this.participants.get(oppId);
        if (opp) bScore += opp.score;
      }
      p.buchholz = bScore;
    }
  }

  getStandings() {
    return Array.from(this.participants.values())
      .map(p => ({
        id: p.id,
        name: p.name,
        score: p.score,
        buchholz: p.buchholz,
        elo: p.elo
      }))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (b.buchholz !== a.buchholz) return b.buchholz - a.buchholz;
        return b.elo - a.elo;
      });
  }
}

module.exports = { TournamentEngine };

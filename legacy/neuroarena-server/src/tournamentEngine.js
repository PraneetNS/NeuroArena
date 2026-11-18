/**
 * Automated Swiss, Single-Elimination, and Double-Elimination Tournament Bracket Engine for NeuroArena.
 */
class TournamentEngine {
  constructor(tournamentId, name, format = 'SWISS', maxRounds = 3) {
    this.tournamentId = tournamentId;
    this.name = name;
    this.format = format; // 'SWISS', 'SINGLE_ELIM', 'DOUBLE_ELIM'
    this.maxRounds = maxRounds;
    this.currentRound = 0;
    this.participants = new Map(); // id -> { id, name, elo, score, buchholz, sonnebornBerger, seed, isEliminated, checkedIn, opponents: Set, matchHistory: [] }
    this.rounds = [];
    this.brackets = {
      upper: [], // Upper/Winners bracket rounds
      lower: [], // Lower/Losers bracket rounds
      grandFinals: null,
      grandFinalsReset: null
    };
    this.isCompleted = false;
    this.winner = null;
  }

  registerParticipant(id, name, elo = 1200, seed = null) {
    if (this.currentRound > 0 || (this.brackets.upper.length > 0)) {
      throw new Error('Cannot register after tournament start');
    }
    this.participants.set(id, {
      id,
      name,
      elo,
      seed: seed !== null ? seed : this.participants.size + 1,
      score: 0,
      buchholz: 0,
      sonnebornBerger: 0,
      isEliminated: false,
      checkedIn: true,
      opponents: new Set(),
      matchHistory: []
    });
  }

  // --- DOUBLE ELIMINATION & BRACKET INITIALIZATION ---
  initializeEliminationBracket() {
    if (this.participants.size < 2) {
      throw new Error('At least 2 participants required for elimination tournament');
    }

    const players = Array.from(this.participants.values()).sort((a, b) => a.seed - b.seed);
    const bracketSize = Math.pow(2, Math.ceil(Math.log2(players.length)));

    // Standard Olympic seeding pairing
    const seeds = this._generateSeedOrder(bracketSize);
    const round1Matches = [];

    for (let i = 0; i < seeds.length; i += 2) {
      const p1 = players[seeds[i] - 1] || null;
      const p2 = players[seeds[i + 1] - 1] || null;

      const matchId = `match_UB_r1_m${Math.floor(i / 2) + 1}`;
      const match = {
        matchId,
        bracket: 'UPPER',
        round: 1,
        player1: p1 ? p1.id : 'BYE',
        player2: p2 ? p2.id : 'BYE',
        winner: null,
        loser: null
      };

      // Handle automatic bye advance
      if (match.player1 !== 'BYE' && match.player2 === 'BYE') {
        match.winner = match.player1;
        match.loser = 'BYE';
      } else if (match.player1 === 'BYE' && match.player2 !== 'BYE') {
        match.winner = match.player2;
        match.loser = 'BYE';
      }

      round1Matches.push(match);
    }

    this.brackets.upper.push({ roundNumber: 1, pairings: round1Matches, isResolved: round1Matches.every(m => m.winner !== null) });
    return this.brackets;
  }

  _generateSeedOrder(size) {
    let rounds = Math.log2(size) - 1;
    let pls = [1, 2];
    for (let i = 0; i < rounds; i++) {
      const next = [];
      const length = pls.length * 2 + 1;
      for (const p of pls) {
        next.push(p);
        next.push(length - p);
      }
      pls = next;
    }
    return pls;
  }

  startNextRound() {
    if (this.isCompleted) throw new Error('Tournament already finished');

    if (this.format === 'DOUBLE_ELIM' || this.format === 'SINGLE_ELIM') {
      if (this.brackets.upper.length === 0) {
        this.initializeEliminationBracket();
      }
      return this._advanceEliminationBracket();
    }

    // SWISS Format
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

  _advanceEliminationBracket() {
    this.currentRound++;
    const allMatches = [];
    for (const r of this.brackets.upper) allMatches.push(...r.pairings);
    for (const r of this.brackets.lower) allMatches.push(...r.pairings);
    if (this.brackets.grandFinals) allMatches.push(this.brackets.grandFinals);
    if (this.brackets.grandFinalsReset) allMatches.push(this.brackets.grandFinalsReset);

    const unresolved = allMatches.filter(m => m.winner === null);
    return {
      roundNumber: this.currentRound,
      pairings: unresolved,
      isResolved: unresolved.length === 0
    };
  }

  resolveMatch(matchId, winnerId) {
    if (this.format === 'SWISS') {
      const round = this.rounds[this.currentRound - 1];
      if (!round) throw new Error('No active round');

      const match = round.pairings.find(m => m.matchId === matchId);
      if (!match) throw new Error('Match not found');

      match.winner = winnerId;
      const loserId = match.player1 === winnerId ? match.player2 : match.player1;
      match.loser = loserId;

      if (winnerId && winnerId !== 'DRAW' && this.participants.has(winnerId)) {
        this.participants.get(winnerId).score += 1;
        this.participants.get(winnerId).matchHistory.push({ opponent: loserId, result: 'WIN' });
      }
      if (loserId && loserId !== 'BYE' && this.participants.has(loserId)) {
        this.participants.get(loserId).matchHistory.push({ opponent: winnerId, result: 'LOSS' });
      }

      const allResolved = round.pairings.every(m => m.winner !== null);
      if (allResolved) {
        round.isResolved = true;
        this.updateBuchholzScores();
        if (this.currentRound >= this.maxRounds) {
          this.isCompleted = true;
          const standings = this.getStandings();
          if (standings.length > 0) this.winner = standings[0].id;
        }
      }
      return match;
    }

    // Elimination match resolution
    const match = this._findEliminationMatch(matchId);
    if (!match) throw new Error(`Match ${matchId} not found`);
    if (match.winner !== null) return match;

    match.winner = winnerId;
    match.loser = match.player1 === winnerId ? match.player2 : match.player1;

    if (this.participants.has(winnerId)) {
      this.participants.get(winnerId).score += 1;
    }

    this._onEliminationMatchResolved(match);
    return match;
  }

  _findEliminationMatch(matchId) {
    for (const r of this.brackets.upper) {
      const m = r.pairings.find(p => p.matchId === matchId);
      if (m) return m;
    }
    for (const r of this.brackets.lower) {
      const m = r.pairings.find(p => p.matchId === matchId);
      if (m) return m;
    }
    if (this.brackets.grandFinals && this.brackets.grandFinals.matchId === matchId) {
      return this.brackets.grandFinals;
    }
    if (this.brackets.grandFinalsReset && this.brackets.grandFinalsReset.matchId === matchId) {
      return this.brackets.grandFinalsReset;
    }
    return null;
  }

  _onEliminationMatchResolved(match) {
    if (match.bracket === 'GRAND_FINALS') {
      const ubChamp = match.player1;
      const lbChamp = match.player2;

      if (match.winner === ubChamp) {
        // Upper bracket champ won without reset
        this.isCompleted = true;
        this.winner = ubChamp;
      } else {
        // Lower bracket champ won -> Trigger Grand Finals Reset match!
        this.brackets.grandFinalsReset = {
          matchId: `match_GF_RESET`,
          bracket: 'GRAND_FINALS_RESET',
          player1: ubChamp,
          player2: lbChamp,
          winner: null,
          loser: null
        };
      }
      return;
    }

    if (match.bracket === 'GRAND_FINALS_RESET') {
      this.isCompleted = true;
      this.winner = match.winner;
      return;
    }

    // Check if current Upper Bracket round is fully resolved
    const currentUpper = this.brackets.upper[this.brackets.upper.length - 1];
    if (currentUpper && !currentUpper.isResolved && currentUpper.pairings.every(m => m.winner !== null)) {
      currentUpper.isResolved = true;
      const winners = currentUpper.pairings.map(m => m.winner).filter(w => w !== 'BYE');
      const losers = currentUpper.pairings.map(m => m.loser).filter(l => l && l !== 'BYE');

      if (winners.length === 1) {
        // Upper bracket has its champion
        const ubChamp = winners[0];
        if (this.format === 'SINGLE_ELIM') {
          this.isCompleted = true;
          this.winner = ubChamp;
        } else {
          // If there's a loser from Upper Finals, queue them for Lower Finals
          if (losers.length > 0) {
            this._feedLowerBracket(losers);
          }
          this._checkGrandFinalsReadiness(ubChamp);
        }
      } else if (winners.length > 1) {
        // Next Upper Bracket round
        const nextRound = [];
        for (let i = 0; i < winners.length; i += 2) {
          nextRound.push({
            matchId: `match_UB_r${this.brackets.upper.length + 1}_m${Math.floor(i / 2) + 1}`,
            bracket: 'UPPER',
            round: this.brackets.upper.length + 1,
            player1: winners[i],
            player2: winners[i + 1] || 'BYE',
            winner: winners[i + 1] ? null : winners[i],
            loser: winners[i + 1] ? null : 'BYE'
          });
        }
        this.brackets.upper.push({
          roundNumber: this.brackets.upper.length + 1,
          pairings: nextRound,
          isResolved: nextRound.every(m => m.winner !== null)
        });

        if (this.format === 'DOUBLE_ELIM' && losers.length > 0) {
          this._feedLowerBracket(losers);
        }
      }
    }

    // Check Lower Bracket progress if Double Elim
    if (this.format === 'DOUBLE_ELIM' && this.brackets.lower.length > 0) {
      const currentLower = this.brackets.lower[this.brackets.lower.length - 1];
      if (currentLower && !currentLower.isResolved && currentLower.pairings.every(m => m.winner !== null)) {
        currentLower.isResolved = true;
        const lbWinners = currentLower.pairings.map(m => m.winner).filter(w => w !== 'BYE');
        
        // If we have pending upper losers waiting for a match against lower bracket survivor
        if (this.pendingLowerLosers && this.pendingLowerLosers.length > 0) {
          const nextDrop = this.pendingLowerLosers.shift();
          const nextRoundIndex = this.brackets.lower.length + 1;
          this.brackets.lower.push({
            roundNumber: nextRoundIndex,
            pairings: [{
              matchId: `match_LB_r${nextRoundIndex}_m1`,
              bracket: 'LOWER',
              round: nextRoundIndex,
              player1: nextDrop,
              player2: lbWinners[0],
              winner: null,
              loser: null
            }],
            isResolved: false
          });
        } else if (lbWinners.length === 1 && this._isUpperBracketDone()) {
          const ubChamp = this.brackets.upper[this.brackets.upper.length - 1].pairings[0].winner;
          this._setupGrandFinals(ubChamp, lbWinners[0]);
        }
      }
    }
  }

  _feedLowerBracket(droppedLosers) {
    if (!this.pendingLowerLosers) this.pendingLowerLosers = [];

    if (this.brackets.lower.length === 0) {
      // First drop (Round 1): create initial lower round
      const pairings = [];
      for (let i = 0; i < droppedLosers.length; i += 2) {
        pairings.push({
          matchId: `match_LB_r1_m${Math.floor(i / 2) + 1}`,
          bracket: 'LOWER',
          round: 1,
          player1: droppedLosers[i],
          player2: droppedLosers[i + 1] || 'BYE',
          winner: droppedLosers[i + 1] ? null : droppedLosers[i],
          loser: droppedLosers[i + 1] ? null : 'BYE'
        });
      }
      this.brackets.lower.push({
        roundNumber: 1,
        pairings,
        isResolved: pairings.every(m => m.winner !== null)
      });
      return;
    }

    // Subsequent drops: if current lower round is resolved, pair immediately; otherwise queue
    const currentLower = this.brackets.lower[this.brackets.lower.length - 1];
    if (currentLower && currentLower.isResolved) {
      const lbWinners = currentLower.pairings.map(m => m.winner).filter(w => w !== 'BYE');
      const nextRoundIndex = this.brackets.lower.length + 1;
      const pairings = [];
      for (let i = 0; i < droppedLosers.length; i++) {
        pairings.push({
          matchId: `match_LB_r${nextRoundIndex}_m${i + 1}`,
          bracket: 'LOWER',
          round: nextRoundIndex,
          player1: droppedLosers[i],
          player2: lbWinners[i] || 'BYE',
          winner: lbWinners[i] ? null : droppedLosers[i],
          loser: lbWinners[i] ? null : 'BYE'
        });
      }
      this.brackets.lower.push({
        roundNumber: nextRoundIndex,
        pairings,
        isResolved: pairings.every(m => m.winner !== null)
      });
    } else {
      this.pendingLowerLosers.push(...droppedLosers);
    }
  }

  _isUpperBracketDone() {
    const last = this.brackets.upper[this.brackets.upper.length - 1];
    return last && last.isResolved && last.pairings.length === 1;
  }

  _checkGrandFinalsReadiness(ubChamp) {
    if (this.brackets.lower.length > 0) {
      const lastLower = this.brackets.lower[this.brackets.lower.length - 1];
      if (lastLower.isResolved && (!this.pendingLowerLosers || this.pendingLowerLosers.length === 0)) {
        const lbWinners = lastLower.pairings.map(m => m.winner).filter(w => w !== 'BYE');
        if (lbWinners.length === 1) {
          this._setupGrandFinals(ubChamp, lbWinners[0]);
        }
      }
    }
  }

  _setupGrandFinals(ubChamp, lbChamp) {
    this.brackets.grandFinals = {
      matchId: `match_GF`,
      bracket: 'GRAND_FINALS',
      player1: ubChamp,
      player2: lbChamp,
      winner: null,
      loser: null
    };
  }

  updateBuchholzScores() {
    this.updateTiebreakerScores();
  }

  updateTiebreakerScores() {
    for (const p of this.participants.values()) {
      let bScore = 0;
      let sbScore = 0;

      for (const oppId of p.opponents) {
        const opp = this.participants.get(oppId);
        if (opp) {
          bScore += opp.score;
        }
      }

      // Sonneborn-Berger: sum scores of defeated opponents + 0.5 * drawn opponents
      for (const entry of p.matchHistory) {
        const opp = this.participants.get(entry.opponent);
        if (opp) {
          if (entry.result === 'WIN') {
            sbScore += opp.score;
          } else if (entry.result === 'DRAW') {
            sbScore += opp.score * 0.5;
          }
        }
      }

      p.buchholz = bScore;
      p.sonnebornBerger = Number(sbScore.toFixed(2));
    }
  }

  getHeadToHeadResult(p1Id, p2Id) {
    const p1 = this.participants.get(p1Id);
    if (!p1) return 0;
    let p1Wins = 0;
    let p2Wins = 0;
    for (const m of p1.matchHistory) {
      if (m.opponent === p2Id) {
        if (m.result === 'WIN') p1Wins++;
        else if (m.result === 'LOSS') p2Wins++;
      }
    }
    if (p1Wins > p2Wins) return 1;
    if (p2Wins > p1Wins) return -1;
    return 0;
  }

  getStandings() {
    this.updateTiebreakerScores();
    return Array.from(this.participants.values())
      .map(p => ({
        id: p.id,
        name: p.name,
        score: p.score,
        buchholz: p.buchholz,
        sonnebornBerger: p.sonnebornBerger || 0,
        elo: p.elo,
        seed: p.seed,
        checkedIn: p.checkedIn,
        isEliminated: p.isEliminated
      }))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (b.buchholz !== a.buchholz) return b.buchholz - a.buchholz;
        if (b.sonnebornBerger !== a.sonnebornBerger) return b.sonnebornBerger - a.sonnebornBerger;
        const h2h = this.getHeadToHeadResult(a.id, b.id);
        if (h2h !== 0) return -h2h; // If a beat b, h2h is 1, so return -1 (a precedes b)
        return b.elo - a.elo;
      });
  }

  setCheckInStatus(participantId, isCheckedIn = true) {
    const p = this.participants.get(participantId);
    if (!p) throw new Error(`Participant ${participantId} not found`);
    p.checkedIn = Boolean(isCheckedIn);
    return p;
  }

  forfeitParticipant(participantId, reason = 'FORFEIT') {
    const p = this.participants.get(participantId);
    if (!p) throw new Error(`Participant ${participantId} not found`);
    p.isEliminated = true;
    p.forfeitReason = reason;

    // Resolve any active unresolved match where this player is participating
    if (this.format === 'SWISS') {
      const activeRound = this.rounds[this.currentRound - 1];
      if (activeRound) {
        const activeMatch = activeRound.pairings.find(
          m => (m.player1 === participantId || m.player2 === participantId) && m.winner === null
        );
        if (activeMatch) {
          const winnerId = activeMatch.player1 === participantId ? activeMatch.player2 : activeMatch.player1;
          this.resolveMatch(activeMatch.matchId, winnerId === 'BYE' ? participantId : winnerId);
        }
      }
    } else {
      const allMatches = [];
      for (const r of this.brackets.upper) allMatches.push(...r.pairings);
      for (const r of this.brackets.lower) allMatches.push(...r.pairings);
      if (this.brackets.grandFinals) allMatches.push(this.brackets.grandFinals);
      if (this.brackets.grandFinalsReset) allMatches.push(this.brackets.grandFinalsReset);

      const activeMatch = allMatches.find(
        m => (m.player1 === participantId || m.player2 === participantId) && m.winner === null
      );
      if (activeMatch) {
        const winnerId = activeMatch.player1 === participantId ? activeMatch.player2 : activeMatch.player1;
        this.resolveMatch(activeMatch.matchId, winnerId === 'BYE' ? participantId : winnerId);
      }
    }
  }

  reseedParticipants(strategy = 'ELO') {
    if (this.currentRound > 0 || this.brackets.upper.length > 0) {
      throw new Error('Cannot reseed after tournament starts');
    }
    const players = Array.from(this.participants.values());
    if (strategy === 'ELO') {
      players.sort((a, b) => b.elo - a.elo);
    } else if (strategy === 'RANDOM') {
      players.sort(() => Math.random() - 0.5);
    }
    players.forEach((p, index) => {
      p.seed = index + 1;
    });
  }

  toJSON() {
    return {
      tournamentId: this.tournamentId,
      name: this.name,
      format: this.format,
      maxRounds: this.maxRounds,
      currentRound: this.currentRound,
      isCompleted: this.isCompleted,
      winner: this.winner,
      participants: Array.from(this.participants.values()).map(p => ({
        ...p,
        opponents: Array.from(p.opponents)
      })),
      rounds: this.rounds,
      brackets: this.brackets
    };
  }

  static fromJSON(data) {
    const engine = new TournamentEngine(data.tournamentId, data.name, data.format, data.maxRounds);
    engine.currentRound = data.currentRound;
    engine.isCompleted = data.isCompleted;
    engine.winner = data.winner;
    engine.rounds = data.rounds || [];
    engine.brackets = data.brackets || { upper: [], lower: [], grandFinals: null, grandFinalsReset: null };

    if (Array.isArray(data.participants)) {
      for (const p of data.participants) {
        engine.participants.set(p.id, {
          ...p,
          opponents: new Set(p.opponents || [])
        });
      }
    }
    return engine;
  }
}

module.exports = { TournamentEngine };


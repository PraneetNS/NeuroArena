/**
 * Authoritative Esports Tournament Manager for NeuroArena.
 * Manages tournament scheduling, player check-in, bracket lifecycle, and prize distributions.
 */
const { TournamentEngine } = require('./tournamentEngine');

const TOURNAMENT_TEMPLATES = {
  HOURLY_BLITZ: {
    id: 'HOURLY_BLITZ',
    name: 'Hourly Blitz Arena',
    format: 'SINGLE_ELIM',
    maxParticipants: 8,
    minParticipants: 4,
    entryFee: 50,
    basePrizePool: 400,
    checkInDurationMs: 60000,
    matchTimeoutMs: 180000
  },
  DAILY_GRAND_PRIX: {
    id: 'DAILY_GRAND_PRIX',
    name: 'Daily Grand Prix Championship',
    format: 'DOUBLE_ELIM',
    maxParticipants: 16,
    minParticipants: 4,
    entryFee: 200,
    basePrizePool: 3000,
    checkInDurationMs: 120000,
    matchTimeoutMs: 300000
  },
  GUILD_INVITATIONAL: {
    id: 'GUILD_INVITATIONAL',
    name: 'Guild Masters Invitational',
    format: 'SWISS',
    maxRounds: 3,
    maxParticipants: 8,
    minParticipants: 4,
    entryFee: 100,
    basePrizePool: 1500,
    checkInDurationMs: 60000,
    matchTimeoutMs: 180000
  }
};

class TournamentManager {
  constructor() {
    this.tournaments = new Map(); // tournamentId -> tournamentState
  }

  createTournament(tournamentId, name, templateKey = 'DAILY_GRAND_PRIX', customOptions = {}) {
    if (this.tournaments.has(tournamentId)) {
      throw new Error(`Tournament ${tournamentId} already exists`);
    }

    const template = TOURNAMENT_TEMPLATES[templateKey] || TOURNAMENT_TEMPLATES.DAILY_GRAND_PRIX;
    const config = { ...template, ...customOptions };

    const engine = new TournamentEngine(
      tournamentId,
      name || config.name,
      config.format,
      config.maxRounds || 3
    );

    const tournament = {
      id: tournamentId,
      name: name || config.name,
      template: template.id,
      format: config.format,
      status: 'REGISTRATION', // REGISTRATION -> CHECK_IN -> IN_PROGRESS -> COMPLETED -> CANCELLED
      config,
      engine,
      prizePool: config.basePrizePool,
      payouts: null,
      createdAt: Date.now(),
      startedAt: null,
      completedAt: null
    };

    this.tournaments.set(tournamentId, tournament);
    return tournament;
  }

  registerPlayer(tournamentId, player) {
    const t = this._getTournament(tournamentId);
    if (t.status !== 'REGISTRATION') {
      throw new Error(`Cannot register: tournament is in ${t.status} state`);
    }
    if (t.engine.participants.has(player.id)) {
      throw new Error(`Player ${player.id} is already registered`);
    }
    if (t.engine.participants.size >= t.config.maxParticipants) {
      throw new Error(`Tournament is full (Max: ${t.config.maxParticipants})`);
    }

    t.engine.registerParticipant(player.id, player.name, player.elo || 1200);
    t.prizePool += t.config.entryFee;
    return { success: true, registeredCount: t.engine.participants.size, prizePool: t.prizePool };
  }

  checkInPlayer(tournamentId, playerId) {
    const t = this._getTournament(tournamentId);
    if (t.status !== 'REGISTRATION' && t.status !== 'CHECK_IN') {
      throw new Error(`Cannot check in during ${t.status}`);
    }
    return t.engine.setCheckInStatus(playerId, true);
  }

  startTournament(tournamentId) {
    const t = this._getTournament(tournamentId);
    if (t.status !== 'REGISTRATION' && t.status !== 'CHECK_IN') {
      throw new Error(`Tournament cannot start from ${t.status}`);
    }
    if (t.engine.participants.size < t.config.minParticipants) {
      t.status = 'CANCELLED';
      throw new Error(`Insufficient participants (${t.engine.participants.size}/${t.config.minParticipants}). Tournament cancelled.`);
    }

    // Reseed participants by Elo rating
    t.engine.reseedParticipants('ELO');

    // Initialize bracket or start round 1
    if (t.format === 'DOUBLE_ELIM' || t.format === 'SINGLE_ELIM') {
      t.engine.initializeEliminationBracket();
    } else {
      t.engine.startNextRound();
    }

    t.status = 'IN_PROGRESS';
    t.startedAt = Date.now();
    return t;
  }

  recordMatchResult(tournamentId, matchId, winnerId) {
    const t = this._getTournament(tournamentId);
    if (t.status !== 'IN_PROGRESS') {
      throw new Error(`Cannot record match: tournament is in ${t.status} state`);
    }

    const match = t.engine.resolveMatch(matchId, winnerId);

    if (t.engine.isCompleted) {
      t.status = 'COMPLETED';
      t.completedAt = Date.now();
      t.payouts = this._distributePrizes(t);
    }

    return {
      match,
      isCompleted: t.engine.isCompleted,
      winner: t.engine.winner,
      payouts: t.payouts
    };
  }

  forfeitPlayer(tournamentId, playerId, reason = 'PLAYER_QUIT') {
    const t = this._getTournament(tournamentId);
    t.engine.forfeitParticipant(playerId, reason);

    if (t.engine.isCompleted) {
      t.status = 'COMPLETED';
      t.completedAt = Date.now();
      t.payouts = this._distributePrizes(t);
    }

    return {
      forfeited: playerId,
      isCompleted: t.engine.isCompleted,
      winner: t.engine.winner,
      payouts: t.payouts
    };
  }

  _distributePrizes(tournament) {
    const standings = tournament.engine.getStandings();
    const totalPool = tournament.prizePool;

    // Standard esports payout: 50% 1st, 30% 2nd, 20% 3rd
    const payouts = [];
    if (standings.length >= 1) {
      payouts.push({
        rank: 1,
        playerId: standings[0].id,
        name: standings[0].name,
        tokens: Math.floor(totalPool * 0.5),
        exp: 600,
        badge: 'TOURNAMENT_CHAMPION_GOLD'
      });
    }
    if (standings.length >= 2) {
      payouts.push({
        rank: 2,
        playerId: standings[1].id,
        name: standings[1].name,
        tokens: Math.floor(totalPool * 0.3),
        exp: 350,
        badge: 'TOURNAMENT_FINALIST_SILVER'
      });
    }
    if (standings.length >= 3) {
      payouts.push({
        rank: 3,
        playerId: standings[2].id,
        name: standings[2].name,
        tokens: Math.floor(totalPool * 0.2),
        exp: 200,
        badge: 'TOURNAMENT_PODIUM_BRONZE'
      });
    }

    return payouts;
  }

  getTournamentDetails(tournamentId) {
    const t = this._getTournament(tournamentId);
    return {
      id: t.id,
      name: t.name,
      template: t.template,
      format: t.format,
      status: t.status,
      prizePool: t.prizePool,
      winner: t.engine.winner,
      standings: t.engine.getStandings(),
      brackets: t.engine.brackets,
      rounds: t.engine.rounds,
      payouts: t.payouts,
      createdAt: t.createdAt,
      startedAt: t.startedAt,
      completedAt: t.completedAt
    };
  }

  listTournaments() {
    return Array.from(this.tournaments.values()).map(t => ({
      id: t.id,
      name: t.name,
      template: t.template,
      format: t.format,
      status: t.status,
      participantCount: t.engine.participants.size,
      maxParticipants: t.config.maxParticipants,
      prizePool: t.prizePool,
      winner: t.engine.winner
    }));
  }

  _getTournament(tournamentId) {
    const t = this.tournaments.get(tournamentId);
    if (!t) throw new Error(`Tournament ${tournamentId} does not exist`);
    return t;
  }
}

module.exports = { TournamentManager, TOURNAMENT_TEMPLATES };

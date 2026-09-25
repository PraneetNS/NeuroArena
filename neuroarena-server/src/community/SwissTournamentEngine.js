/**
 * SwissTournamentEngine.js
 * Swiss-system tournament engine for AI agent and player duels.
 * Features score-bracket pairing, non-repeating encounter constraints,
 * Buchholz tie-breakers, Sonneborn-Berger secondary metrics, and odd-player bye allocation.
 */

class SwissTournamentEngine {
    constructor(options = {}) {
        this.tournamentId = options.tournamentId || `swiss_${Date.now()}`;
        this.maxRounds = options.maxRounds || 5;
        this.pointsForWin = options.pointsForWin || 1.0;
        this.pointsForDraw = options.pointsForDraw || 0.5;
        this.pointsForLoss = options.pointsForLoss || 0.0;

        // Player ID -> { id, name, score, opponents: Set, matchHistory: [], byes: number }
        this.participants = new Map();
        this.currentRound = 0;
        this.rounds = [];
        this.isCompleted = false;
    }

    registerParticipant(id, name, rating = 1500) {
        if (this.currentRound > 0) {
            throw new Error('Cannot register participant after tournament has commenced.');
        }
        this.participants.set(id, {
            id,
            name: name || id,
            rating,
            score: 0,
            opponents: new Set(),
            matchHistory: [],
            byes: 0,
            buchholz: 0,
            sonnebornBerger: 0
        });
    }

    generateNextRound() {
        if (this.isCompleted) {
            throw new Error('Tournament is already completed.');
        }
        if (this.currentRound >= this.maxRounds) {
            this.isCompleted = true;
            this.calculateTieBreakers();
            return { completed: true, standings: this.getStandings() };
        }

        this.currentRound++;
        const players = Array.from(this.participants.values());

        // Sort descending by score, then by rating
        players.sort((a, b) => b.score - a.score || b.rating - a.rating);

        const pairings = [];
        const unpaired = [...players];

        // Handle odd player count: assign bye to lowest-scoring eligible player without a bye
        if (unpaired.length % 2 !== 0) {
            for (let i = unpaired.length - 1; i >= 0; i--) {
                if (unpaired[i].byes === 0) {
                    const byePlayer = unpaired.splice(i, 1)[0];
                    byePlayer.byes++;
                    byePlayer.score += this.pointsForWin;
                    pairings.push({
                        matchId: `${this.tournamentId}_r${this.currentRound}_bye`,
                        player1: byePlayer.id,
                        player2: null,
                        isBye: true,
                        completed: true,
                        winner: byePlayer.id
                    });
                    break;
                }
            }
        }

        // Pair remaining players using greedy score-bracket matching
        while (unpaired.length > 1) {
            const p1 = unpaired.shift();
            let partnerIndex = -1;

            // Find first available partner they haven't played against
            for (let i = 0; i < unpaired.length; i++) {
                if (!p1.opponents.has(unpaired[i].id)) {
                    partnerIndex = i;
                    break;
                }
            }

            // Fallback: if all available have been played, pair with first available
            if (partnerIndex === -1) {
                partnerIndex = 0;
            }

            const p2 = unpaired.splice(partnerIndex, 1)[0];
            p1.opponents.add(p2.id);
            p2.opponents.add(p1.id);

            pairings.push({
                matchId: `${this.tournamentId}_r${this.currentRound}_m${pairings.length + 1}`,
                player1: p1.id,
                player2: p2.id,
                isBye: false,
                completed: false,
                winner: null
            });
        }

        const roundData = {
            roundNumber: this.currentRound,
            pairings,
            completed: false
        };
        this.rounds.push(roundData);
        return roundData;
    }

    recordMatchResult(matchId, winnerId, isDraw = false) {
        for (const round of this.rounds) {
            const match = round.pairings.find(m => m.matchId === matchId);
            if (match && !match.completed) {
                match.completed = true;
                match.winner = isDraw ? 'DRAW' : winnerId;

                const p1 = this.participants.get(match.player1);
                const p2 = this.participants.get(match.player2);

                if (isDraw) {
                    if (p1) p1.score += this.pointsForDraw;
                    if (p2) p2.score += this.pointsForDraw;
                } else if (winnerId === match.player1) {
                    if (p1) p1.score += this.pointsForWin;
                    if (p2) p2.score += this.pointsForLoss;
                } else if (winnerId === match.player2) {
                    if (p2) p2.score += this.pointsForWin;
                    if (p1) p1.score += this.pointsForLoss;
                }

                if (p1) p1.matchHistory.push({ round: round.roundNumber, opponent: match.player2, result: isDraw ? 'DRAW' : (winnerId === p1.id ? 'WIN' : 'LOSS') });
                if (p2) p2.matchHistory.push({ round: round.roundNumber, opponent: match.player1, result: isDraw ? 'DRAW' : (winnerId === p2.id ? 'WIN' : 'LOSS') });

                // Check if round is fully resolved
                round.completed = round.pairings.every(m => m.completed);
                if (round.completed && this.currentRound >= this.maxRounds) {
                    this.isCompleted = true;
                    this.calculateTieBreakers();
                }
                return true;
            }
        }
        return false;
    }

    calculateTieBreakers() {
        for (const player of this.participants.values()) {
            let buchholz = 0;
            let sonneborn = 0;

            for (const oppId of player.opponents) {
                const opp = this.participants.get(oppId);
                if (opp) {
                    buchholz += opp.score;
                    // Sonneborn-Berger: add score of opponents defeated, half score of draws
                    const match = player.matchHistory.find(m => m.opponent === oppId);
                    if (match) {
                        if (match.result === 'WIN') sonneborn += opp.score;
                        else if (match.result === 'DRAW') sonneborn += opp.score * 0.5;
                    }
                }
            }

            player.buchholz = Number(buchholz.toFixed(2));
            player.sonnebornBerger = Number(sonneborn.toFixed(2));
        }
    }

    getStandings() {
        this.calculateTieBreakers();
        const standings = Array.from(this.participants.values());
        standings.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            if (b.buchholz !== a.buchholz) return b.buchholz - a.buchholz;
            if (b.sonnebornBerger !== a.sonnebornBerger) return b.sonnebornBerger - a.sonnebornBerger;
            return b.rating - a.rating;
        });

        return standings.map((p, index) => ({
            rank: index + 1,
            id: p.id,
            name: p.name,
            score: p.score,
            buchholz: p.buchholz,
            sonnebornBerger: p.sonnebornBerger,
            rating: p.rating,
            byes: p.byes
        }));
    }
}

module.exports = SwissTournamentEngine;

const colyseus = require("colyseus");
const { Room } = colyseus;
const { DuelRoomState } = require("../schema/DuelRoomState");
const { PlayerSchema } = require("../schema/ArenaRoomState");
const { auditLogger } = require("../security/AuditLogger");

/**
 * 1v1 Private Duel Match Room.
 * Implements FIFO 2-player matchmaking, synchronized 90s training timer,
 * lightweight anti-cheat submission integrity validation, and authoritative hidden test set evaluation.
 */
class DuelRoom extends Room {
    onCreate(options) {
        this.maxClients = 2;
        this.setState(new DuelRoomState());
        this.setPatchRate(100);

        this.submissions = new Map(); // sessionId -> { weightW, weightB, name, build, flagged, reason }
        this.hiddenTestSet = this.generateHiddenTestSet();
        this.matchInterval = null;
        this.matchStartTime = 0;

        // 1. Transform / Live presence relay during duel
        this.onMessage("transform", (client, message) => {
            const player = this.state.players.get(client.sessionId);
            if (player) {
                if (typeof message.x === "number") player.x = message.x;
                if (typeof message.z === "number") player.z = message.z;
                if (typeof message.rotationY === "number") player.rotationY = message.rotationY;
                if (message.activityState) player.activityState = message.activityState;
                player.lastUpdate = Date.now();
            }
        });

        // 2. Player Submits Trained Model Weights (With Integrity Checks)
        this.onMessage("submit_weights", (client, message) => {
            const player = this.state.players.get(client.sessionId);
            const w = (typeof message.weightW === "number") ? message.weightW : 0;
            const b = (typeof message.weightB === "number") ? message.weightB : 0;
            const now = Date.now();
            const elapsedMs = this.matchStartTime > 0 ? (now - this.matchStartTime) : 0;

            console.log(`[DuelRoom] Received model weights from ${client.sessionId}: w=${w.toFixed(4)}, b=${b.toFixed(4)} (Elapsed: ${elapsedMs}ms)`);

            let isFlagged = false;
            let flagReason = "";

            // --- INTEGRITY CHECK 1: Numeric Validity & Finite Bounds ---
            if (isNaN(w) || isNaN(b) || !isFinite(w) || !isFinite(b) || Math.abs(w) > 500 || Math.abs(b) > 500) {
                isFlagged = true;
                flagReason = "MALFORMED_OR_OUT_OF_BOUNDS_WEIGHTS";
            }

            // --- INTEGRITY CHECK 2: Impossible Training Speed Check ---
            // Physical limit: Collecting crystals and optimizing a model cannot plausibly occur in under 2.5s (2500ms)
            if (!isFlagged && elapsedMs < 2500 && (Math.abs(w) > 0.01 || Math.abs(b) > 0.01)) {
                isFlagged = true;
                flagReason = "IMPOSSIBLE_TRAINING_SPEED";
            }

            if (isFlagged) {
                // Log anomaly to server audit logger for review
                auditLogger.logAnomaly({
                    roomId: this.roomId,
                    sessionId: client.sessionId,
                    playerName: player ? player.name : "Unknown",
                    reason: flagReason,
                    elapsedMs,
                    weightW: w,
                    weightB: b,
                    actionTaken: "REJECTED_WITH_PENALTY"
                });

                client.send("submission_rejected", {
                    reason: flagReason,
                    message: `Submission rejected by Anti-Cheat: Implausible training speed (${elapsedMs}ms < 2500ms).`
                });
            }

            this.submissions.set(client.sessionId, {
                sessionId: client.sessionId,
                name: player ? player.name : "Architect",
                characterBuild: player ? player.characterBuild : "explorer",
                weightW: isFlagged ? 0 : w,
                weightB: isFlagged ? 0 : b,
                flagged: isFlagged,
                flagReason: flagReason,
                submittedAt: now
            });

            // Notify opponent that player finished training
            this.broadcast("player_submitted", { sessionId: client.sessionId }, { except: client });

            // If both players submitted early, evaluate immediately!
            if (this.submissions.size >= 2) {
                this.evaluateDuelResults();
            }
        });

        console.log(`[DuelRoom] Created 1v1 private duel room ${this.roomId}. Hidden test samples: ${this.hiddenTestSet.length}`);
    }

    generateHiddenTestSet() {
        const samples = [];
        const trueW = 2.45;
        const trueB = 1.15;

        // 50 uniformly sampled points across in-domain and boundary distribution
        for (let i = 0; i < 50; i++) {
            const x = -4.5 + (i / 49) * 9.0;
            // Gaussian noise approximation
            const noise = (Math.random() + Math.random() + Math.random() - 1.5) * 0.15;
            const y = trueW * x + trueB + noise;
            samples.push({ x, y });
        }
        return samples;
    }

    onJoin(client, options) {
        const playerName = (options && options.name) ? options.name : `Duelist-${client.sessionId.slice(0, 4)}`;
        const characterBuild = (options && options.characterBuild) ? options.characterBuild : "explorer";

        const player = new PlayerSchema(client.sessionId, playerName, characterBuild);
        this.state.players.set(client.sessionId, player);

        console.log(`[DuelRoom] Duelist ${playerName} (${client.sessionId}) entered. Total players: ${this.state.players.size}/2`);

        // Check if 2 players are now paired
        if (this.state.players.size === 2) {
            this.lock(); // Prevent any 3rd player from joining
            this.startMatchCountdown();
        }
    }

    startMatchCountdown() {
        this.state.status = "countdown";
        console.log(`[DuelRoom] 2 players paired in room ${this.roomId}. Starting 3s countdown...`);

        const playerList = [];
        this.state.players.forEach(p => playerList.push({ id: p.id, name: p.name, build: p.characterBuild }));

        this.broadcast("match_paired", {
            roomId: this.roomId,
            seed: this.state.seed,
            players: playerList,
            countdownSec: 3
        });

        this.clock.setTimeout(() => {
            this.startActiveMatch();
        }, 3000);
    }

    startActiveMatch() {
        this.state.status = "active";
        this.state.timerSec = 90;
        this.matchStartTime = Date.now();

        this.broadcast("match_started", {
            durationSec: 90,
            seed: this.state.seed
        });

        // 1Hz Synchronized Match Timer
        this.matchInterval = this.clock.setInterval(() => {
            if (this.state.timerSec > 0) {
                this.state.timerSec--;
                this.broadcast("timer_tick", { timerSec: this.state.timerSec });
            } else {
                this.clock.clearInterval(this.matchInterval);
                this.evaluateDuelResults();
            }
        }, 1000);
    }

    evaluateDuelResults() {
        if (this.state.status === "completed") return;
        this.state.status = "completed";

        if (this.matchInterval) {
            this.clock.clearInterval(this.matchInterval);
        }

        console.log(`[DuelRoom] Evaluating duel ${this.roomId} against server hidden test set...`);

        const results = [];
        const testSet = this.hiddenTestSet;

        // Calculate variance of target Y for R2 accuracy computation
        const meanY = testSet.reduce((sum, s) => sum + s.y, 0) / testSet.length;
        const totalVar = testSet.reduce((sum, s) => sum + Math.pow(s.y - meanY, 2), 0) / testSet.length;

        this.state.players.forEach(player => {
            const sub = this.submissions.get(player.id) || {
                sessionId: player.id,
                name: player.name,
                characterBuild: player.characterBuild,
                weightW: 0,
                weightB: 0,
                flagged: false,
                flagReason: ""
            };

            if (sub.flagged) {
                // Integrity violation: Assign severe penalty score
                results.push({
                    sessionId: player.id,
                    name: player.name,
                    characterBuild: player.characterBuild,
                    weightW: 0,
                    weightB: 0,
                    mseLoss: 999.0,
                    accuracy: 0.0,
                    flagged: true,
                    flagReason: sub.flagReason
                });
                return;
            }

            // Run model inference against authoritative hidden test set
            let mseSum = 0;
            testSet.forEach(s => {
                const predY = sub.weightW * s.x + sub.weightB;
                mseSum += Math.pow(predY - s.y, 2);
            });

            const mse = mseSum / testSet.length;
            const accuracy = Math.max(0, Math.min(99.8, (1 - (mse / Math.max(0.01, totalVar))) * 100));

            results.push({
                sessionId: player.id,
                name: player.name,
                characterBuild: player.characterBuild,
                weightW: sub.weightW,
                weightB: sub.weightB,
                mseLoss: parseFloat(mse.toFixed(4)),
                accuracy: parseFloat(accuracy.toFixed(1)),
                flagged: false
            });
        });

        // Determine Winner (Lower MSE / Higher Accuracy)
        let winnerId = null;
        let isDraw = false;

        if (results.length === 2) {
            if (results[0].mseLoss < results[1].mseLoss) {
                winnerId = results[0].sessionId;
            } else if (results[1].mseLoss < results[0].mseLoss) {
                winnerId = results[1].sessionId;
            } else {
                isDraw = true;
            }
        } else if (results.length === 1) {
            winnerId = results[0].sessionId;
        }

        const payload = {
            roomId: this.roomId,
            hiddenTestSampleSize: testSet.length,
            winnerId,
            isDraw,
            results
        };

        console.log(`[DuelRoom] Evaluation complete! Winner: ${winnerId || 'DRAW'}. Broadcasting results.`);
        this.broadcast("duel_results", payload);
    }

    onLeave(client, consented) {
        if (this.state.players.has(client.sessionId)) {
            const p = this.state.players.get(client.sessionId);
            console.log(`[DuelRoom] Duelist ${p.name} left. Consented: ${consented}`);
            this.state.players.delete(client.sessionId);

            // If match was active, award technical forfeit win to remaining player
            if (this.state.status === "active") {
                this.evaluateDuelResults();
            }
        }
    }

    onDispose() {
        if (this.matchInterval) this.clock.clearInterval(this.matchInterval);
        console.log(`[DuelRoom] Disposed duel room ${this.roomId}.`);
    }
}

module.exports = {
    DuelRoom
};

const colyseus = require("colyseus");
const { Room } = colyseus;
const { CoopRoomState } = require("../schema/CoopRoomState");
const { PlayerSchema } = require("../schema/ArenaRoomState");
const { auditLogger } = require("../security/AuditLogger");
const { MovementReconciliationEngine } = require("../network/MovementReconciliationEngine");
const { ProceduralVariantEngine } = require("../ml/ProceduralVariantEngine");

/**
 * 2-4 Player Collaborative Co-op Room.
 * Mirror's DuelRoom's robust netcode structure while implementing genuine ML collaboration:
 * - Shared objective built around Dataset Health Score & Domain Coverage across blind spots
 * - Scaled procedural difficulty envelope per party size (2-4 players)
 * - Non-verbal ping system with dual-motor haptic pulse metadata
 * - Server-authoritative hidden test set evaluation against a shared multi-phase Boss
 * - Transparent, strictly equal reward distribution (anti ninja-looting)
 * - 15s mid-match disconnection grace period with full authoritative state resync
 */
class CoopRoom extends Room {
    onCreate(options = {}) {
        const requestedPartySize = Math.max(2, Math.min(4, Number(options.partySize) || 4));
        const requestedBiome = Math.max(0, Math.min(5, Number(options.biome) || 0));

        this.maxClients = requestedPartySize;
        this.partySize = requestedPartySize;
        this.biome = requestedBiome;

        this.proceduralEngine = new ProceduralVariantEngine();
        this.difficultyEnvelope = this.proceduralEngine.getPartyDifficultyEnvelope(this.partySize, this.biome);

        const state = new CoopRoomState();
        state.partySize = this.partySize;
        state.biome = this.biome;
        state.bossMaxHp = this.difficultyEnvelope.scaledBossHp;
        state.bossCurrentHp = this.difficultyEnvelope.scaledBossHp;
        state.bossMoveVariant = `Party-${this.partySize} ${this.difficultyEnvelope.biomeName} Guardian`;
        this.setState(state);

        this.setPatchRate(50); // 20Hz tick rate

        this.pooledSamples = []; // Array of { id, x, y, contributedBy, isOutlier, partitionIndex }
        this.submissions = new Map(); // sessionId -> { weightW, weightB, name, build, flagged, reason }
        this.hiddenTestSet = this.generateHiddenTestSet();
        this.matchInterval = null;
        this.matchStartTime = 0;
        this.currentTick = 0;
        this.reconciler = new MovementReconciliationEngine();
        this.playerInputSeqs = new Map(); // sessionId -> lastProcessedSeq
        this.playerPartitions = new Map(); // sessionId -> partitionIndex

        // 1. Transform Relay
        this.onMessage("transform", (client, message) => {
            const player = this.state.players.get(client.sessionId);
            if (player) {
                if (typeof message.x === "number") player.x = message.x;
                if (typeof message.y === "number") player.y = message.y;
                if (typeof message.z === "number") player.z = message.z;
                if (typeof message.rotationY === "number") player.rotationY = message.rotationY;
                if (message.activityState) player.activityState = message.activityState;
                player.lastUpdate = Date.now();
            }
        });

        // 1.1 Movement Input Reconciliation
        this.onMessage("movement_input", (client, message) => {
            const player = this.state.players.get(client.sessionId);
            if (!player) return;

            const seq = message.seq || 0;
            const dt = typeof message.dt === "number" ? Math.min(0.1, message.dt) : 0.05;
            const input = message.input || { dx: 0, dz: 0, rotY: player.rotationY };

            const updated = this.reconciler.serverSimulateStep(
                { x: player.x, z: player.z, rotationY: player.rotationY },
                input,
                dt,
                seq
            );

            player.x = updated.x;
            player.z = updated.z;
            player.rotationY = updated.rotationY;
            player.lastUpdate = updated.timestamp;
            this.playerInputSeqs.set(client.sessionId, seq);

            client.send("movement_ack", {
                lastProcessedSeq: seq,
                tick: this.currentTick,
                x: player.x,
                z: player.z,
                rotationY: player.rotationY,
                serverTimestamp: updated.timestamp
            });
        });

        // 2. Real-Time Shared Empirical Token Contribution (Collaborative Dataset Pooling)
        this.onMessage("contribute_samples", (client, message) => {
            if (this.state.status !== "active") return;
            const player = this.state.players.get(client.sessionId);
            if (!player) return;

            const samples = Array.isArray(message.samples) ? message.samples : [message.sample];
            let addedCount = 0;

            for (const s of samples) {
                if (!s || typeof s.x !== "number" || typeof s.y !== "number") continue;
                if (isNaN(s.x) || isNaN(s.y) || !isFinite(s.x) || !isFinite(s.y)) continue;

                // Determine partition index based on x
                const partition = this.difficultyEnvelope.partitions.find(p => s.x >= p.minX && s.x <= p.maxX);
                const partitionIdx = partition ? partition.partitionIndex : (s.x < 0 ? 0 : this.difficultyEnvelope.partitions.length - 1);

                this.pooledSamples.push({
                    id: s.id || `S_${this.pooledSamples.length + 1}`,
                    x: Number(s.x.toFixed(3)),
                    y: Number(s.y.toFixed(3)),
                    isOutlier: !!s.isOutlier,
                    contributedBy: client.sessionId,
                    contributedByName: player.name,
                    partitionIndex: partitionIdx,
                    timestamp: Date.now()
                });
                addedCount++;
            }

            if (addedCount > 0) {
                // Recompute authoritative Shared Dataset Health Score
                this.computeSharedDatasetHealth();

                // Broadcast live dataset state update to all party members
                this.broadcast("shared_dataset_updated", {
                    totalSamples: this.pooledSamples.length,
                    latestContribution: {
                        sessionId: client.sessionId,
                        playerName: player.name,
                        count: addedCount
                    },
                    metrics: {
                        coverageScore: this.state.datasetMetrics.coverageScore,
                        balanceScore: this.state.datasetMetrics.balanceScore,
                        cleanlinessScore: this.state.datasetMetrics.cleanlinessScore,
                        overallHealthScore: this.state.datasetMetrics.overallHealthScore,
                        healthGrade: this.state.datasetMetrics.healthGrade,
                        blindSpotsCount: this.state.datasetMetrics.blindSpotsCount,
                        domainMin: this.state.datasetMetrics.domainMin,
                        domainMax: this.state.datasetMetrics.domainMax
                    }
                });
            }
        });

        // 3. Non-Verbal Ping System (Pings with Haptic Profiles)
        this.onMessage("ping", (client, message) => {
            const player = this.state.players.get(client.sessionId);
            if (!player) return;

            const validPingTypes = ["HARVEST_HERE", "COVERAGE_GAP", "OUTLIER_ALERT", "ASSEMBLE_TRAIN", "BOSS_HAZARD"];
            const pingType = validPingTypes.includes(message.type) ? message.type : "HARVEST_HERE";

            // Map ping type to specific tactile haptic pulse type
            const hapticMap = {
                HARVEST_HERE: "LightTick",
                COVERAGE_GAP: "MediumImpact",
                OUTLIER_ALERT: "MediumImpact",
                BOSS_HAZARD: "HeavyRumble",
                ASSEMBLE_TRAIN: "SuccessBurst"
            };

            const pingPayload = {
                senderId: client.sessionId,
                senderName: player.name,
                type: pingType,
                x: typeof message.x === "number" ? message.x : player.x,
                z: typeof message.z === "number" ? message.z : player.z,
                domainX: typeof message.domainX === "number" ? message.domainX : null,
                targetPartition: typeof message.targetPartition === "number" ? message.targetPartition : null,
                textPrompt: message.textPrompt || this._getDefaultPingPrompt(pingType),
                hapticPulse: hapticMap[pingType],
                timestamp: Date.now()
            };

            // Broadcast ping to all party members (including sender for feedback confirmation)
            this.broadcast("player_ping", pingPayload);
        });

        // 4. Model Weights Submission (Individual or Ensemble Contribution)
        this.onMessage("submit_weights", (client, message) => {
            const player = this.state.players.get(client.sessionId);
            const w = (typeof message.weightW === "number") ? message.weightW : 0;
            const b = (typeof message.weightB === "number") ? message.weightB : 0;
            const now = Date.now();
            const elapsedMs = this.matchStartTime > 0 ? (now - this.matchStartTime) : 0;

            console.log(`[CoopRoom] Received weights from ${client.sessionId}: w=${w.toFixed(4)}, b=${b.toFixed(4)} (Elapsed: ${elapsedMs}ms)`);

            let isFlagged = false;
            let flagReason = "";

            if (isNaN(w) || isNaN(b) || !isFinite(w) || !isFinite(b) || Math.abs(w) > 500 || Math.abs(b) > 500) {
                isFlagged = true;
                flagReason = "MALFORMED_OR_OUT_OF_BOUNDS_WEIGHTS";
            }

            if (!isFlagged && elapsedMs < 2500 && (Math.abs(w) > 0.01 || Math.abs(b) > 0.01)) {
                isFlagged = true;
                flagReason = "IMPOSSIBLE_TRAINING_SPEED";
            }

            if (isFlagged) {
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
                    message: `Submission flagged by Anti-Cheat: Implausible training speed (${elapsedMs}ms < 2500ms).`
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

            this.broadcast("player_submitted", { sessionId: client.sessionId, playerName: player ? player.name : "" }, { except: client });

            // If all party members submitted, evaluate immediately!
            if (this.submissions.size >= this.state.players.size) {
                this.evaluateCoopSession();
            }
        });

        // Authoritative Room-Type Guard: Reject any adaptive coaching/hint requests in multiplayer Co-op
        this.onMessage("request_coaching_hint", (client) => {
            client.send("coaching_error", {
                error: "ADAPTIVE_COACHING_FORBIDDEN_IN_RANKED",
                message: "Coaching hints and adaptive difficulty are strictly disabled in multiplayer Co-op rooms."
            });
        });

        console.log(`[CoopRoom] Created ${this.partySize}-player Co-op Room ${this.roomId} (Biome ${this.biome}). Boss HP: ${this.state.bossMaxHp}`);
    }

    _getDefaultPingPrompt(type) {
        switch (type) {
            case "HARVEST_HERE": return "Harvest crystal tokens in this sector!";
            case "COVERAGE_GAP": return "Watch coverage gap! Sample this feature boundary!";
            case "OUTLIER_ALERT": return "High noise / outlier cluster detected here!";
            case "BOSS_HAZARD": return "Warning: Boss preparing high-damage manifold attack!";
            case "ASSEMBLE_TRAIN": return "Assemble at central hub: Begin team model training!";
            default: return "Team Ping";
        }
    }

    generateHiddenTestSet() {
        const samples = [];
        const trueW = 2.45;
        const trueB = 1.15;
        const span = this.difficultyEnvelope.domainSpan;
        const sampleCount = 50;

        // Uniformly sample points spanning the party difficulty envelope domain
        for (let i = 0; i < sampleCount; i++) {
            const x = span.minX + (i / (sampleCount - 1)) * span.totalSpan;
            const noise = (Math.random() + Math.random() + Math.random() - 1.5) * (0.15 * this.difficultyEnvelope.noiseScaleMultiplier);
            const y = trueW * x + trueB + noise;
            samples.push({
                x: Number(x.toFixed(4)),
                y: Number(y.toFixed(4))
            });
        }
        return samples;
    }

    computeSharedDatasetHealth() {
        const n = this.pooledSamples.length;
        if (n === 0) {
            this.state.datasetMetrics.totalSamples = 0;
            this.state.datasetMetrics.overallHealthScore = 0;
            this.state.datasetMetrics.coverageScore = 0;
            this.state.datasetMetrics.balanceScore = 100;
            this.state.datasetMetrics.cleanlinessScore = 100;
            this.state.datasetMetrics.healthGrade = "CRITICAL";
            this.state.datasetMetrics.blindSpotsCount = this.difficultyEnvelope.partitions.length;
            return;
        }

        const xs = this.pooledSamples.map(s => s.x);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const span = maxX - minX;

        // 1. Multi-Partition Coverage & Blind Spot Analysis
        const partitionCounts = new Array(this.difficultyEnvelope.partitions.length).fill(0);
        for (const s of this.pooledSamples) {
            if (s.partitionIndex >= 0 && s.partitionIndex < partitionCounts.length) {
                partitionCounts[s.partitionIndex]++;
            }
        }

        let blindSpots = 0;
        for (let i = 0; i < partitionCounts.length; i++) {
            if (partitionCounts[i] === 0) blindSpots++;
        }

        const targetSpan = this.difficultyEnvelope.domainSpan.totalSpan;
        const spanRatio = Math.min(1.0, span / targetSpan);
        const partitionRatio = (partitionCounts.length - blindSpots) / partitionCounts.length;
        const sampleDensityRatio = Math.min(1.0, n / (this.partySize * 8));

        // Coverage is only high if multiple partitions are actively sampled
        const coverageScore = Math.max(0, Math.min(100, Math.round(
            (partitionRatio * 0.50 + spanRatio * 0.35 + sampleDensityRatio * 0.15) * 100
        )));

        // 2. Outlier Cleanliness
        let outlierCount = 0;
        const expectedW = 2.45;
        const expectedB = 1.15;
        for (const s of this.pooledSamples) {
            if (s.isOutlier) {
                outlierCount++;
            } else {
                const expectedY = expectedW * s.x + expectedB;
                if (Math.abs(s.y - expectedY) > 5.0) outlierCount++;
            }
        }
        const outlierRatio = outlierCount / n;
        const cleanlinessScore = Math.max(0, Math.min(100, Math.round((1.0 - outlierRatio * 3.0) * 100)));

        // 3. Distribution Balance (Partition Skew)
        let balanceScore = 100;
        if (partitionCounts.length > 1) {
            const meanCount = n / partitionCounts.length;
            let varianceSum = 0;
            for (const count of partitionCounts) {
                varianceSum += Math.pow(count - meanCount, 2);
            }
            const stdCount = Math.sqrt(varianceSum / partitionCounts.length);
            const coefficientOfVariation = meanCount > 0 ? (stdCount / meanCount) : 1.0;
            balanceScore = Math.max(0, Math.min(100, Math.round((1.0 - Math.min(1.0, coefficientOfVariation * 0.5)) * 100)));
        }

        // Overall Health Score (Domain Coverage 45% + Balance 30% + Cleanliness 25%)
        const overallScore = Math.max(5, Math.min(100, Math.round(
            coverageScore * 0.45 + balanceScore * 0.30 + cleanlinessScore * 0.25
        )));

        const grade = overallScore >= 85 ? "EXCELLENT" : (overallScore >= 70 ? "GOOD" : (overallScore >= 50 ? "FAIR" : "CRITICAL"));

        // Update Synchronized Schema
        this.state.datasetMetrics.totalSamples = n;
        this.state.datasetMetrics.domainMin = Number(minX.toFixed(2));
        this.state.datasetMetrics.domainMax = Number(maxX.toFixed(2));
        this.state.datasetMetrics.coverageScore = coverageScore;
        this.state.datasetMetrics.balanceScore = balanceScore;
        this.state.datasetMetrics.cleanlinessScore = cleanlinessScore;
        this.state.datasetMetrics.overallHealthScore = overallScore;
        this.state.datasetMetrics.healthGrade = grade;
        this.state.datasetMetrics.blindSpotsCount = blindSpots;
    }

    onJoin(client, options = {}) {
        const playerName = options.name || `Architect-${client.sessionId.slice(0, 4)}`;
        const characterBuild = options.characterBuild || "explorer";

        const player = new PlayerSchema(client.sessionId, playerName, characterBuild);
        this.state.players.set(client.sessionId, player);

        // Assign domain partition to player for complementary harvesting
        const assignedPartitionIdx = (this.state.players.size - 1) % this.difficultyEnvelope.partitions.length;
        this.playerPartitions.set(client.sessionId, assignedPartitionIdx);
        const assignedPartition = this.difficultyEnvelope.partitions[assignedPartitionIdx];

        console.log(`[CoopRoom] Player ${playerName} (${client.sessionId}) joined. Role: ${assignedPartition.name}. Capacity: ${this.state.players.size}/${this.partySize}`);

        // Send assigned sector role to client
        client.send("assigned_role", {
            partitionIndex: assignedPartitionIdx,
            roleName: assignedPartition.name,
            targetDomain: { minX: assignedPartition.minX, maxX: assignedPartition.maxX },
            targetDescription: assignedPartition.targetRole,
            partySize: this.partySize,
            difficultyEnvelope: this.difficultyEnvelope
        });

        // Check if full party is assembled
        if (this.state.players.size >= this.partySize) {
            if (this.listing) {
                try { this.lock(); } catch (e) {}
            }
            this.startMatchCountdown();
        }
    }

    startMatchCountdown() {
        this.state.status = "countdown";
        console.log(`[CoopRoom] Full party of ${this.partySize} assembled in room ${this.roomId}. Starting 3s countdown...`);

        const playerList = [];
        this.state.players.forEach(p => {
            const partIdx = this.playerPartitions.get(p.id) || 0;
            const part = this.difficultyEnvelope.partitions[partIdx];
            playerList.push({
                id: p.id,
                name: p.name,
                build: p.characterBuild,
                assignedPartition: partIdx,
                partitionName: part ? part.name : "Unassigned"
            });
        });

        this.broadcast("match_paired", {
            roomId: this.roomId,
            partySize: this.partySize,
            biome: this.biome,
            seed: this.state.seed,
            players: playerList,
            difficultyEnvelope: this.difficultyEnvelope,
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
        this.currentTick = 0;

        this.broadcast("match_started", {
            durationSec: 90,
            partySize: this.partySize,
            biome: this.biome,
            seed: this.state.seed,
            bossInfo: {
                maxHp: this.state.bossMaxHp,
                bossVariant: this.state.bossMoveVariant
            }
        });

        // 20Hz Simulation & Timer
        this.matchInterval = this.clock.setInterval(() => {
            this.currentTick++;
            if (this.currentTick % 20 === 0) {
                if (this.state.timerSec > 0) {
                    this.state.timerSec--;
                    this.broadcast("timer_tick", {
                        timerSec: this.state.timerSec,
                        tick: this.currentTick,
                        bossHp: this.state.bossCurrentHp,
                        healthScore: this.state.datasetMetrics.overallHealthScore
                    });
                } else {
                    this.clock.clearInterval(this.matchInterval);
                    this.evaluateCoopSession();
                }
            }
        }, 50);
    }

    evaluateCoopSession() {
        if (this.state.status === "completed") return;
        this.state.status = "completed";

        if (this.matchInterval) {
            this.clock.clearInterval(this.matchInterval);
        }

        console.log(`[CoopRoom] Evaluating party session ${this.roomId} against authoritative hidden test set...`);

        // Authoritatively recompute Dataset Health
        this.computeSharedDatasetHealth();
        const healthScore = this.state.datasetMetrics.overallHealthScore;
        const coverageScore = this.state.datasetMetrics.coverageScore;
        const testSet = this.hiddenTestSet;

        // Compute ensemble model from submitted weights
        const validSubmissions = [];
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
            if (!sub.flagged && (sub.weightW !== 0 || sub.weightB !== 0)) {
                validSubmissions.push(sub);
            }
        });

        // Compute collective ensemble weights
        let ensembleW = 0;
        let ensembleB = 0;
        if (validSubmissions.length > 0) {
            ensembleW = validSubmissions.reduce((sum, s) => sum + s.weightW, 0) / validSubmissions.length;
            ensembleB = validSubmissions.reduce((sum, s) => sum + s.weightB, 0) / validSubmissions.length;
        } else {
            // Fallback: If no weights submitted, fit OLS closed-form on pooled samples
            if (this.pooledSamples.length >= 2) {
                const inliers = this.pooledSamples.filter(s => !s.isOutlier);
                const meanX = inliers.reduce((sum, s) => sum + s.x, 0) / inliers.length;
                const meanY = inliers.reduce((sum, s) => sum + s.y, 0) / inliers.length;
                let num = 0, den = 0;
                for (const s of inliers) {
                    num += (s.x - meanX) * (s.y - meanY);
                    den += Math.pow(s.x - meanX, 2);
                }
                ensembleW = den > 0.0001 ? (num / den) : 0;
                ensembleB = meanY - ensembleW * meanX;
            }
        }

        // Evaluate model against hidden test set
        const meanY = testSet.reduce((sum, s) => sum + s.y, 0) / testSet.length;
        const totalVar = testSet.reduce((sum, s) => sum + Math.pow(s.y - meanY, 2), 0) / testSet.length;

        let mseSum = 0;
        testSet.forEach(s => {
            const predY = ensembleW * s.x + ensembleB;
            mseSum += Math.pow(predY - s.y, 2);
        });

        const rawMse = mseSum / testSet.length;
        // Extrapolation Penalty: If coverage score is low (< 70%), out-of-domain test errors scale up
        const coverageMultiplier = coverageScore >= 70 ? 1.0 : (1.0 + (70 - coverageScore) * 0.05);
        const effectiveMse = rawMse * coverageMultiplier;
        const teamAccuracy = Math.max(0, Math.min(99.8, (1 - (effectiveMse / Math.max(0.01, totalVar))) * 100));

        // Boss Damage Calculation: Team Accuracy scaled by Health Score Multiplier
        // Low health (<60%) suppresses damage due to extrapolation errors; high health (>=85%) allows 100% boss clear
        const healthMultiplier = healthScore >= 85 ? (1.0 + (healthScore - 85) * 0.01) : Math.max(0.2, (healthScore / 85.0) * 0.95);
        const damageRatio = Math.min(1.0, (teamAccuracy / 95.0) * healthMultiplier);
        const totalDamageDealt = Math.min(this.state.bossMaxHp, Math.round(this.state.bossMaxHp * damageRatio));
        this.state.bossCurrentHp = Math.max(0, this.state.bossMaxHp - totalDamageDealt);
        const isBossDefeated = this.state.bossCurrentHp <= 0;

        // Calculate Server-Authoritative Equal Rewards
        const baseRewardPool = Math.round(600 * this.difficultyEnvelope.rewardPoolMultiplier);
        const accuracyBonus = Math.round(teamAccuracy * 5);
        const healthBonus = Math.round(healthScore * 4);
        const bossKillBonus = isBossDefeated ? 500 : Math.round((totalDamageDealt / this.state.bossMaxHp) * 250);
        const totalRewardPool = baseRewardPool + accuracyBonus + healthBonus + bossKillBonus;

        const activePlayerCount = Math.max(1, this.state.players.size);
        const equalShareTokens = Math.floor(totalRewardPool / activePlayerCount);
        const equalShareExp = Math.floor((totalRewardPool * 2.5) / activePlayerCount);

        // Build individual reward allocations
        const playerAllocations = [];
        this.state.players.forEach(player => {
            const sub = this.submissions.get(player.id);
            const isFlagged = sub ? sub.flagged : false;
            playerAllocations.push({
                sessionId: player.id,
                name: player.name,
                characterBuild: player.characterBuild,
                assignedPartition: this.playerPartitions.get(player.id) || 0,
                tokensAwarded: isFlagged ? 0 : equalShareTokens,
                expAwarded: isFlagged ? 0 : equalShareExp,
                isFlagged,
                flagReason: isFlagged ? sub.flagReason : ""
            });
        });

        const payload = {
            roomId: this.roomId,
            partySize: this.partySize,
            biome: this.biome,
            seed: this.state.seed,
            hiddenTestSampleSize: testSet.length,
            ensembleWeights: {
                weightW: parseFloat(ensembleW.toFixed(4)),
                weightB: parseFloat(ensembleB.toFixed(4))
            },
            evaluation: {
                rawMseLoss: parseFloat(rawMse.toFixed(4)),
                effectiveMseLoss: parseFloat(effectiveMse.toFixed(4)),
                teamAccuracy: parseFloat(teamAccuracy.toFixed(1)),
                datasetHealthScore: healthScore,
                coverageScore,
                balanceScore: this.state.datasetMetrics.balanceScore,
                cleanlinessScore: this.state.datasetMetrics.cleanlinessScore,
                blindSpotsCount: this.state.datasetMetrics.blindSpotsCount,
                totalSamplesHarvested: this.pooledSamples.length
            },
            bossOutcome: {
                bossMaxHp: this.state.bossMaxHp,
                damageDealt: totalDamageDealt,
                bossRemainingHp: this.state.bossCurrentHp,
                isDefeated: isBossDefeated
            },
            rewards: {
                totalPool: totalRewardPool,
                distributionMode: "SERVER_AUTHORITATIVE_EQUAL_SPLIT",
                equalShareTokens,
                equalShareExp,
                allocations: playerAllocations,
                auditLedgerId: `LEDGER-COOP-${Date.now()}`
            }
        };

        console.log(`[CoopRoom] Evaluation complete! Team Accuracy: ${teamAccuracy.toFixed(1)}%, Health: ${healthScore}%, Boss Defeated: ${isBossDefeated}. Broadcasting results.`);
        this.broadcast("coop_results", payload);
    }

    async onLeave(client, consented) {
        const player = this.state.players.get(client.sessionId);
        if (!player) return;

        if (consented || this.state.status !== "active") {
            console.log(`[CoopRoom] Player ${player.name} left. Consented: ${consented}`);
            this.state.players.delete(client.sessionId);
            if (this.state.status === "active" && this.state.players.size === 0) {
                this.evaluateCoopSession();
            }
            return;
        }

        // Mid-session unexpected disconnection: 15s grace window
        console.log(`[CoopRoom] Player ${player.name} disconnected unexpectedly. Holding 15s reconnection grace window...`);
        player.activityState = "DISCONNECTED_WAITING_RECONNECT";

        this.broadcast("player_disconnected", {
            sessionId: client.sessionId,
            playerName: player.name,
            gracePeriodSec: 15
        }, { except: client });

        try {
            const reconnectedClient = await this.allowReconnection(client, 15);
            console.log(`[CoopRoom] Player ${player.name} reconnected! Dispatching state resync...`);
            player.activityState = "IDLE";

            reconnectedClient.send("resync_state", {
                roomId: this.roomId,
                status: this.state.status,
                timerSec: this.state.timerSec,
                lastConfirmedTick: this.currentTick,
                partySize: this.partySize,
                biome: this.biome,
                seed: this.state.seed,
                bossMaxHp: this.state.bossMaxHp,
                bossCurrentHp: this.state.bossCurrentHp,
                assignedPartition: this.playerPartitions.get(client.sessionId) || 0,
                difficultyEnvelope: this.difficultyEnvelope,
                datasetMetrics: {
                    totalSamples: this.state.datasetMetrics.totalSamples,
                    coverageScore: this.state.datasetMetrics.coverageScore,
                    balanceScore: this.state.datasetMetrics.balanceScore,
                    cleanlinessScore: this.state.datasetMetrics.cleanlinessScore,
                    overallHealthScore: this.state.datasetMetrics.overallHealthScore,
                    healthGrade: this.state.datasetMetrics.healthGrade
                },
                players: Array.from(this.state.players.values()).map(p => ({
                    id: p.id,
                    name: p.name,
                    x: p.x,
                    z: p.z,
                    rotationY: p.rotationY,
                    activityState: p.activityState
                })),
                hasSubmitted: this.submissions.has(client.sessionId)
            });

            this.broadcast("player_reconnected", {
                sessionId: client.sessionId,
                playerName: player.name
            }, { except: reconnectedClient });

        } catch (e) {
            console.log(`[CoopRoom] 15s Reconnection grace period expired for ${player.name}.`);
            this.state.players.delete(client.sessionId);
            if (this.state.status === "active" && this.state.players.size === 0) {
                this.evaluateCoopSession();
            }
        }
    }

    onDispose() {
        if (this.matchInterval) this.clock.clearInterval(this.matchInterval);
        if (this.clock) this.clock.clear();
        console.log(`[CoopRoom] Disposed Co-op Room ${this.roomId}.`);
    }
}

module.exports = {
    CoopRoom
};

/**
 * BotArenaClient.js
 * 
 * Production Client Module for Autonomous Bot Policy Arena (inspired by Screeps & Gladiabots).
 * Coordinates WebSocket connection to bot_arena_room, neural weight dispatch,
 * and live drone kinematic simulation.
 */

export class BotArenaClient {
  constructor(serverUrl = "ws://localhost:2567") {
    this.serverUrl = serverUrl;
    this.ws = null;
    this.status = "idle"; // "idle" | "connecting" | "active" | "completed"
    this.bots = new Map();
    this.obstacles = [];
    this.crystals = [];
    this.timeRemainingSec = 60;
    this.onStateChanged = null;
    this.onMatchCompleted = null;
  }

  /**
   * Connects to Colyseus bot_arena_room
   */
  async joinBotArena(playerName = "ArchitectDrone") {
    this.status = "connecting";
    return new Promise((resolve) => {
      try {
        if (typeof WebSocket !== "undefined") {
          this.ws = new WebSocket(`${this.serverUrl}/bot_arena_room`);
          this.ws.onopen = () => {
            this.status = "active";
            this.ws.send(JSON.stringify({ type: "join", name: playerName }));
            resolve({ status: "connected" });
          };
          this.ws.onmessage = (event) => {
            this.handleServerMessage(event.data);
          };
          this.ws.onerror = () => {
            this.initOfflineSimulation(playerName);
            resolve({ status: "offline_simulation" });
          };
        } else {
          this.initOfflineSimulation(playerName);
          resolve({ status: "offline_simulation" });
        }
      } catch (e) {
        this.initOfflineSimulation(playerName);
        resolve({ status: "offline_simulation" });
      }
    });
  }

  /**
   * Dispatches trained player neural weights to server or local simulation.
   */
  uploadPolicy(weights, architecture = "2-Layer MLP") {
    if (this.ws && this.ws.readyState === 1) {
      this.ws.send(JSON.stringify({
        type: "upload_policy",
        weights,
        architecture
      }));
    }
    this.activeWeights = weights;
  }

  /**
   * Evaluates neural policy inference locally for zero-latency client prediction.
   */
  evaluateLocalPolicy(observation, weights = this.activeWeights) {
    const { targetDeltaX, targetDeltaZ, obstacleProximity, currentSpeed } = observation;
    const input = [targetDeltaX, targetDeltaZ, obstacleProximity, currentSpeed];

    if (!weights || !weights.W1 || !weights.b1 || !weights.W2 || !weights.b2) {
      // Heuristic fallback
      const targetAngle = Math.atan2(targetDeltaX, targetDeltaZ) * (180 / Math.PI);
      const steerAngle = Math.max(-45, Math.min(45, targetAngle));
      const throttle = obstacleProximity < 2.0 ? 0.4 : 0.85;
      const isBraking = obstacleProximity < 1.2;
      return { steerAngle, throttle, isBraking };
    }

    // 2-layer MLP (4 -> hidden -> 3)
    const { W1, b1, W2, b2 } = weights;
    const hidden = b1.map((bias, j) => {
      let sum = bias;
      for (let i = 0; i < 4; i++) {
        sum += input[i] * (W1[i] ? W1[i][j] : 0);
      }
      return Math.max(0, sum); // ReLU
    });

    const out = [b2[0] || 0, b2[1] || 0, b2[2] || 0];
    for (let k = 0; k < 3; k++) {
      for (let j = 0; j < hidden.length; j++) {
        out[k] += hidden[j] * (W2[j] ? W2[j][k] : 0);
      }
    }

    const steerAngle = Math.tanh(out[0]) * 45.0;
    const throttle = 1.0 / (1.0 + Math.exp(-Math.max(-10, Math.min(10, out[1]))));
    const isBraking = (1.0 / (1.0 + Math.exp(-Math.max(-10, Math.min(10, out[2]))))) > 0.55;

    return { steerAngle, throttle, isBraking };
  }

  initOfflineSimulation(playerName) {
    this.status = "active";
    this.bots.set("player_bot", {
      botId: "bot_local",
      name: playerName,
      x: 0,
      z: 0,
      rotationY: 0,
      speed: 3.5,
      score: 0,
      crystals: 0
    });

    // Seed local crystals
    this.crystals = [];
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      this.crystals.push({
        id: `crystal_${i}`,
        x: Math.cos(angle) * 15,
        z: Math.sin(angle) * 15,
        collected: false
      });
    }
  }

  handleServerMessage(raw) {
    try {
      const data = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (data.type === "match_results" && typeof this.onMatchCompleted === "function") {
        this.status = "completed";
        this.onMatchCompleted(data);
      }
    } catch (e) {
      // Ignore
    }
  }

  leave() {
    if (this.ws) {
      try { this.ws.close(); } catch (e) {}
      this.ws = null;
    }
    this.status = "idle";
  }
}

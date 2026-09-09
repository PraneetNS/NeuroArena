/**
 * CoopRoomClient.js
 * 
 * Production Client Module for 2-4 Player Collaborative Co-op Rooms in NeuroArena.
 * Features:
 * - Real-time Colyseus/WebSocket room connection lifecycle
 * - Domain partition role tracking (e.g. Sector Alpha vs Delta)
 * - Real-time pooled sample contribution & live Dataset Health Score tracking
 * - Non-verbal ping system with dual-motor haptic trigger integration
 * - Server-authoritative equal reward settlement & hidden test set results
 */

export class CoopRoomClient {
  constructor(serverUrl = "ws://localhost:2567") {
    this.serverUrl = serverUrl;
    this.ws = null;
    this.status = "idle"; // "idle" | "queueing" | "countdown" | "active" | "completed"
    this.roomId = null;
    this.partySize = 4;
    this.biome = 0;
    this.assignedPartition = null;
    this.difficultyEnvelope = null;
    this.sharedDatasetMetrics = {
      totalSamples: 0,
      coverageScore: 0,
      balanceScore: 100,
      cleanlinessScore: 100,
      overallHealthScore: 0,
      healthGrade: "CRITICAL",
      blindSpotsCount: 0
    };
    this.partyMembers = [];
    this.lastEvaluationResults = null;
    this.pingHistory = [];
    this.onMetricsChanged = null;
    this.onPingReceived = null;
    this.onResultsReceived = null;
  }

  /**
   * Connects to a Co-op room instance
   */
  async joinCoopRoom(partySize = 4, biome = 0, playerName = "Architect", characterBuild = "explorer") {
    this.status = "queueing";
    this.partySize = Math.max(2, Math.min(4, partySize));
    this.biome = biome;

    return new Promise((resolve, reject) => {
      try {
        const wsUrl = `${this.serverUrl}/coop_room?partySize=${this.partySize}&biome=${this.biome}`;
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          this.send("join", {
            name: playerName,
            characterBuild,
            partySize: this.partySize,
            biome: this.biome
          });
          resolve({ status: "connected", partySize: this.partySize, biome: this.biome });
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
          } catch (err) {
            console.error("[CoopClient] JSON parse error:", err);
          }
        };

        this.ws.onerror = (err) => {
          console.warn("[CoopClient] WebSocket error, fallback ready:", err);
          this.status = "error";
          reject(err);
        };

        this.ws.onclose = () => {
          if (this.status === "active" || this.status === "queueing") {
            this.status = "disconnected";
          }
        };
      } catch (e) {
        reject(e);
      }
    });
  }

  send(type, payload = {}) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, ...payload }));
    }
  }

  /**
   * Dispatches a non-verbal tactical ping to party members
   */
  sendPing(pingType = "HARVEST_HERE", x = 0, z = 0, domainX = null, targetPartition = null, textPrompt = null) {
    const validPingTypes = ["HARVEST_HERE", "COVERAGE_GAP", "OUTLIER_ALERT", "ASSEMBLE_TRAIN", "BOSS_HAZARD"];
    const type = validPingTypes.includes(pingType) ? pingType : "HARVEST_HERE";

    this.send("ping", {
      type,
      x,
      z,
      domainX,
      targetPartition,
      textPrompt
    });

    // Trigger local haptic feedback immediately
    this._triggerHapticForPing(type);
  }

  /**
   * Contributes local empirical harvest tokens to the shared party pool
   */
  contributeSamples(samples = []) {
    if (!Array.isArray(samples) || samples.length === 0) return;
    this.send("contribute_samples", { samples });
  }

  /**
   * Submits local trained model weights to the server
   */
  submitModelWeights(weightW = 0, weightB = 0) {
    this.send("submit_weights", {
      weightW: Number(weightW) || 0,
      weightB: Number(weightB) || 0
    });
  }

  /**
   * Internal message dispatcher
   */
  handleMessage(msg) {
    if (!msg) return;

    switch (msg.type || msg.event) {
      case "assigned_role":
        this.assignedPartition = msg;
        this.difficultyEnvelope = msg.difficultyEnvelope;
        break;

      case "match_paired":
        this.status = "countdown";
        this.roomId = msg.roomId;
        this.partyMembers = msg.players || [];
        this.difficultyEnvelope = msg.difficultyEnvelope;
        break;

      case "match_started":
        this.status = "active";
        break;

      case "shared_dataset_updated":
        if (msg.metrics) {
          this.sharedDatasetMetrics = { ...this.sharedDatasetMetrics, ...msg.metrics };
          if (this.onMetricsChanged) this.onMetricsChanged(this.sharedDatasetMetrics);
        }
        break;

      case "player_ping":
      case "HARVEST_HERE":
      case "COVERAGE_GAP":
      case "OUTLIER_ALERT":
      case "BOSS_HAZARD":
      case "ASSEMBLE_TRAIN":
        this.pingHistory.unshift(msg);
        if (this.pingHistory.length > 20) this.pingHistory.pop();
        const effectivePingType = msg.pingType || (msg.type !== "player_ping" ? msg.type : (msg.payload ? msg.payload.type : "HARVEST_HERE"));
        this._triggerHapticForPing(effectivePingType);
        if (this.onPingReceived) this.onPingReceived(msg);
        break;

      case "coop_results":
        this.status = "completed";
        this.lastEvaluationResults = msg;
        if (this.onResultsReceived) this.onResultsReceived(msg);
        break;

      default:
        break;
    }
  }

  _triggerHapticForPing(pingType) {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      switch (pingType) {
        case "HARVEST_HERE":
          navigator.vibrate(35);
          break;
        case "COVERAGE_GAP":
        case "OUTLIER_ALERT":
          navigator.vibrate([40, 30, 40]);
          break;
        case "BOSS_HAZARD":
          navigator.vibrate([100, 50, 100]);
          break;
        case "ASSEMBLE_TRAIN":
          navigator.vibrate([50, 40, 80]);
          break;
      }
    }
  }

  leave() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.status = "idle";
  }
}

export const NeuroCoopRoomClient = new CoopRoomClient();
if (typeof window !== "undefined") {
  window.NeuroCoopRoomClient = NeuroCoopRoomClient;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    CoopRoomClient,
    NeuroCoopRoomClient
  };
}


const schema = require("@colyseus/schema");
const { Schema, MapSchema, type } = schema;
const { PlayerSchema } = require("./ArenaRoomState");

/**
 * Shared Dataset Health Schema synchronized in real-time across party members.
 */
class SharedDatasetMetricsSchema extends Schema {
    constructor() {
        super();
        this.totalSamples = 0;
        this.domainMin = 0;
        this.domainMax = 0;
        this.coverageScore = 0;
        this.balanceScore = 100;
        this.cleanlinessScore = 100;
        this.overallHealthScore = 0;
        this.healthGrade = "CRITICAL";
        this.blindSpotsCount = 0;
    }
}

type("number")(SharedDatasetMetricsSchema.prototype, "totalSamples");
type("number")(SharedDatasetMetricsSchema.prototype, "domainMin");
type("number")(SharedDatasetMetricsSchema.prototype, "domainMax");
type("number")(SharedDatasetMetricsSchema.prototype, "coverageScore");
type("number")(SharedDatasetMetricsSchema.prototype, "balanceScore");
type("number")(SharedDatasetMetricsSchema.prototype, "cleanlinessScore");
type("number")(SharedDatasetMetricsSchema.prototype, "overallHealthScore");
type("string")(SharedDatasetMetricsSchema.prototype, "healthGrade");
type("number")(SharedDatasetMetricsSchema.prototype, "blindSpotsCount");

/**
 * 2-4 Player Collaborative Co-op Room State Schema
 */
class CoopRoomState extends Schema {
    constructor() {
        super();
        this.status = "waiting"; // "waiting" | "countdown" | "active" | "evaluating" | "completed"
        this.timerSec = 90;
        this.partySize = 4; // 2, 3, or 4 players
        this.biome = 0;
        this.seed = "COOP-" + Math.floor(Math.random() * 90000 + 10000);
        this.players = new MapSchema();
        this.datasetMetrics = new SharedDatasetMetricsSchema();
        this.bossMaxHp = 2500;
        this.bossCurrentHp = 2500;
        this.bossMoveVariant = "Standard Phase";
    }
}

type("string")(CoopRoomState.prototype, "status");
type("number")(CoopRoomState.prototype, "timerSec");
type("number")(CoopRoomState.prototype, "partySize");
type("number")(CoopRoomState.prototype, "biome");
type("string")(CoopRoomState.prototype, "seed");
type({ map: PlayerSchema })(CoopRoomState.prototype, "players");
type(SharedDatasetMetricsSchema)(CoopRoomState.prototype, "datasetMetrics");
type("number")(CoopRoomState.prototype, "bossMaxHp");
type("number")(CoopRoomState.prototype, "bossCurrentHp");
type("string")(CoopRoomState.prototype, "bossMoveVariant");

module.exports = {
    SharedDatasetMetricsSchema,
    CoopRoomState
};

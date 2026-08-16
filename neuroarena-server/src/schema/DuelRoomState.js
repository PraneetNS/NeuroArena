const schema = require("@colyseus/schema");
const { Schema, MapSchema, type } = schema;
const { PlayerSchema } = require("./ArenaRoomState");

/**
 * 1v1 Live Duel Room State Schema
 */
class DuelRoomState extends Schema {
    constructor() {
        super();
        this.status = "waiting"; // "waiting" | "countdown" | "active" | "evaluating" | "completed"
        this.timerSec = 90;
        this.players = new MapSchema();
        this.biome = 0;
        this.seed = "DUEL-" + Math.floor(Math.random() * 90000 + 10000);
    }
}

type("string")(DuelRoomState.prototype, "status");
type("number")(DuelRoomState.prototype, "timerSec");
type("number")(DuelRoomState.prototype, "biome");
type("string")(DuelRoomState.prototype, "seed");
type({ map: PlayerSchema })(DuelRoomState.prototype, "players");

module.exports = {
    DuelRoomState
};

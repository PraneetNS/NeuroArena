const schema = require("@colyseus/schema");
const { Schema, MapSchema, type } = schema;

/**
 * Activity State Enum
 * @readonly
 * @enum {string}
 */
const ActivityState = {
    IDLE: "idle",
    WALKING: "walking",
    HARVESTING: "harvesting",
    TRAINING: "training"
};

/**
 * Player state schema synchronized across all clients in the arena room.
 */
class PlayerSchema extends Schema {
    constructor(id = "", name = "Architect", characterBuild = "explorer") {
        super();
        this.id = id;
        this.name = name;
        this.characterBuild = characterBuild;
        this.x = 0;
        this.y = 1.2;
        this.z = 0;
        this.rotationY = 0;
        this.biome = 0;
        this.activityState = ActivityState.IDLE;
        this.lastUpdate = Date.now();
    }
}

type("string")(PlayerSchema.prototype, "id");
type("string")(PlayerSchema.prototype, "name");
type("string")(PlayerSchema.prototype, "characterBuild");
type("number")(PlayerSchema.prototype, "x");
type("number")(PlayerSchema.prototype, "y");
type("number")(PlayerSchema.prototype, "z");
type("number")(PlayerSchema.prototype, "rotationY");
type("uint8")(PlayerSchema.prototype, "biome");
type("string")(PlayerSchema.prototype, "activityState");
type("number")(PlayerSchema.prototype, "lastUpdate");

/**
 * Arena Room State schema containing the synchronized players map.
 */
class ArenaRoomState extends Schema {
    constructor() {
        super();
        this.players = new MapSchema();
        this.serverTime = Date.now();
    }
}

type({ map: PlayerSchema })(ArenaRoomState.prototype, "players");
type("number")(ArenaRoomState.prototype, "serverTime");

module.exports = {
    ActivityState,
    PlayerSchema,
    ArenaRoomState
};

const schema = require("@colyseus/schema");
const { Schema, MapSchema, type } = schema;
const { CollectibleSchema } = require("./ArenaRoomState");

/**
 * Real-Time Neural Policy Bot Drone Schema.
 * Synchronizes autonomous agent kinematics, sensor readings, and score telemetry.
 */
class BotDroneSchema extends Schema {
    constructor(botId = "", ownerId = "", ownerName = "NeuralDrone") {
        super();
        this.botId = botId;
        this.ownerId = ownerId;
        this.ownerName = ownerName;
        this.x = 0;
        this.y = 0.5;
        this.z = 0;
        this.rotationY = 0;
        this.speed = 0;
        this.steerAngle = 0;
        this.throttle = 0;
        this.isBraking = false;
        this.crystalsHarvested = 0;
        this.obstaclesAvoided = 0;
        this.score = 0;
        this.architecture = "2-Layer MLP";
        this.isAlive = true;
    }
}

type("string")(BotDroneSchema.prototype, "botId");
type("string")(BotDroneSchema.prototype, "ownerId");
type("string")(BotDroneSchema.prototype, "ownerName");
type("number")(BotDroneSchema.prototype, "x");
type("number")(BotDroneSchema.prototype, "y");
type("number")(BotDroneSchema.prototype, "z");
type("number")(BotDroneSchema.prototype, "rotationY");
type("number")(BotDroneSchema.prototype, "speed");
type("number")(BotDroneSchema.prototype, "steerAngle");
type("number")(BotDroneSchema.prototype, "throttle");
type("boolean")(BotDroneSchema.prototype, "isBraking");
type("number")(BotDroneSchema.prototype, "crystalsHarvested");
type("number")(BotDroneSchema.prototype, "obstaclesAvoided");
type("number")(BotDroneSchema.prototype, "score");
type("string")(BotDroneSchema.prototype, "architecture");
type("boolean")(BotDroneSchema.prototype, "isAlive");

/**
 * Dynamic Environmental Obstacle Schema
 */
class DynamicObstacleSchema extends Schema {
    constructor(id = "", x = 0, y = 0, z = 0, radius = 1.2) {
        super();
        this.id = id;
        this.x = x;
        this.y = y;
        this.z = z;
        this.radius = radius;
    }
}

type("string")(DynamicObstacleSchema.prototype, "id");
type("number")(DynamicObstacleSchema.prototype, "x");
type("number")(DynamicObstacleSchema.prototype, "y");
type("number")(DynamicObstacleSchema.prototype, "z");
type("number")(DynamicObstacleSchema.prototype, "radius");

/**
 * Bot Policy Arena Room State Schema.
 * Coordinates 2-8 autonomous neural bots in an obstacle avoidance & crystal collection simulation.
 */
class BotArenaRoomState extends Schema {
    constructor() {
        super();
        this.status = "waiting"; // "waiting" | "active" | "evaluating" | "completed"
        this.timeRemainingSec = 60;
        this.arenaRadius = 35;
        this.seed = "BOT-" + Math.floor(Math.random() * 90000 + 10000);
        this.bots = new MapSchema();
        this.obstacles = new MapSchema();
        this.crystals = new MapSchema();
    }
}

type("string")(BotArenaRoomState.prototype, "status");
type("number")(BotArenaRoomState.prototype, "timeRemainingSec");
type("number")(BotArenaRoomState.prototype, "arenaRadius");
type("string")(BotArenaRoomState.prototype, "seed");
type({ map: BotDroneSchema })(BotArenaRoomState.prototype, "bots");
type({ map: DynamicObstacleSchema })(BotArenaRoomState.prototype, "obstacles");
type({ map: CollectibleSchema })(BotArenaRoomState.prototype, "crystals");

module.exports = {
    BotDroneSchema,
    DynamicObstacleSchema,
    BotArenaRoomState
};

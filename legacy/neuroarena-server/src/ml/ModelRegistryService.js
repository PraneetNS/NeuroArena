/**
 * ModelRegistryService.js
 * Authoritative server-side ML model registry and champion staging pipeline.
 * Enforces SHA-256 weight integrity, finite value checking, champion promotion,
 * and zero-downtime rollback against model drift or corruption.
 */

const crypto = require('crypto');

class ModelRegistryService {
  constructor(options = {}) {
    this.maxWeightCount = options.maxWeightCount || 10000;
    this.minAccuracyForChampion = options.minAccuracyForChampion || 0.85;
    
    // In-memory model store: modelId -> ModelRecord
    this.models = new Map();
    // Biome champion pointers: biomeId -> { currentChampionId, previousChampionId, history: [] }
    this.biomeChampions = new Map();
    // Telemetry counters
    this.stats = {
      totalRegistered: 0,
      totalPromotions: 0,
      totalRollbacks: 0,
      rejectedSubmissions: 0
    };
  }

  computeChecksum(weights, biases = []) {
    const hash = crypto.createHash('sha256');
    const wStr = (weights || []).map(w => Number(w).toFixed(7)).join(',');
    const bStr = (biases || []).map(b => Number(b).toFixed(7)).join(',');
    hash.update(`${wStr}|${bStr}`);
    return hash.digest('hex');
  }

  validateWeights(weights, biases = []) {
    if (!Array.isArray(weights) || weights.length === 0) {
      return { valid: false, reason: 'WEIGHTS_EMPTY_OR_NOT_ARRAY' };
    }
    if (weights.length > this.maxWeightCount) {
      return { valid: false, reason: 'WEIGHT_COUNT_EXCEEDED_LIMIT' };
    }
    for (let i = 0; i < weights.length; i++) {
      const val = weights[i];
      if (typeof val !== 'number' || !Number.isFinite(val)) {
        return { valid: false, reason: 'WEIGHT_NON_FINITE_OR_NAN' };
      }
      if (Math.abs(val) > 1000.0) {
        return { valid: false, reason: 'WEIGHT_OUT_OF_BOUNDS' };
      }
    }
    for (let i = 0; i < biases.length; i++) {
      const val = biases[i];
      if (typeof val !== 'number' || !Number.isFinite(val)) {
        return { valid: false, reason: 'BIAS_NON_FINITE_OR_NAN' };
      }
    }
    return { valid: true };
  }

  registerModel(architectId, payload) {
    if (!architectId || !payload) {
      this.stats.rejectedSubmissions++;
      throw new Error('INVALID_REGISTRATION_ARGUMENTS');
    }

    const {
      modelName,
      biomeId = 0,
      architecture = 'FeedForward',
      weights = [],
      biases = [],
      validationLoss = 1.0,
      validationAccuracy = 0.5,
      clientChecksum = null
    } = payload;

    const validation = this.validateWeights(weights, biases);
    if (!validation.valid) {
      this.stats.rejectedSubmissions++;
      throw new Error(`MODEL_REJECTED: ${validation.reason}`);
    }

    const authoritativeChecksum = this.computeChecksum(weights, biases);
    if (clientChecksum && clientChecksum.toLowerCase() !== authoritativeChecksum.toLowerCase()) {
      this.stats.rejectedSubmissions++;
      throw new Error('CHECKSUM_MISMATCH_POTENTIAL_TAMPERING');
    }

    const modelId = `model_${biomeId}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const modelRecord = {
      modelId,
      architectId,
      modelName: modelName || `Architect-Model-${this.stats.totalRegistered + 1}`,
      biomeId: Number(biomeId),
      architecture,
      weightCount: weights.length,
      biasCount: biases.length,
      weights: Object.freeze([...weights]),
      biases: Object.freeze([...biases]),
      validationLoss: Number(validationLoss),
      validationAccuracy: Number(validationAccuracy),
      checksum: authoritativeChecksum,
      registeredAt: Date.now(),
      isChampion: false
    };

    this.models.set(modelId, modelRecord);
    this.stats.totalRegistered++;

    return modelRecord;
  }

  promoteChampion(biomeId, modelId) {
    const bId = Number(biomeId);
    const model = this.models.get(modelId);
    if (!model) {
      throw new Error('MODEL_NOT_FOUND');
    }
    if (model.biomeId !== bId) {
      throw new Error('BIOME_MISMATCH');
    }
    if (model.validationAccuracy < this.minAccuracyForChampion) {
      throw new Error(`ACCURACY_BELOW_CHAMPION_THRESHOLD (${model.validationAccuracy} < ${this.minAccuracyForChampion})`);
    }

    let championMeta = this.biomeChampions.get(bId);
    if (!championMeta) {
      championMeta = {
        currentChampionId: null,
        previousChampionId: null,
        history: []
      };
      this.biomeChampions.set(bId, championMeta);
    }

    // Demote current champion
    if (championMeta.currentChampionId) {
      const prev = this.models.get(championMeta.currentChampionId);
      if (prev) prev.isChampion = false;
      championMeta.previousChampionId = championMeta.currentChampionId;
      championMeta.history.push({
        modelId: championMeta.currentChampionId,
        demotedAt: Date.now()
      });
    }

    model.isChampion = true;
    championMeta.currentChampionId = modelId;
    this.stats.totalPromotions++;

    return {
      promotedModelId: modelId,
      biomeId: bId,
      validationLoss: model.validationLoss,
      validationAccuracy: model.validationAccuracy,
      previousChampionId: championMeta.previousChampionId
    };
  }

  rollbackChampion(biomeId) {
    const bId = Number(biomeId);
    const championMeta = this.biomeChampions.get(bId);
    if (!championMeta || !championMeta.previousChampionId) {
      throw new Error('NO_PREVIOUS_CHAMPION_FOR_ROLLBACK');
    }

    const prevModel = this.models.get(championMeta.previousChampionId);
    if (!prevModel) {
      throw new Error('PREVIOUS_CHAMPION_RECORD_CORRUPTED');
    }

    const currentModel = this.models.get(championMeta.currentChampionId);
    if (currentModel) currentModel.isChampion = false;

    prevModel.isChampion = true;
    const rolledBackFrom = championMeta.currentChampionId;
    championMeta.currentChampionId = prevModel.modelId;
    championMeta.previousChampionId = null;

    this.stats.totalRollbacks++;

    return {
      biomeId: bId,
      restoredChampionId: prevModel.modelId,
      rolledBackFrom,
      validationLoss: prevModel.validationLoss,
      validationAccuracy: prevModel.validationAccuracy
    };
  }

  getBiomeChampion(biomeId) {
    const bId = Number(biomeId);
    const championMeta = this.biomeChampions.get(bId);
    if (!championMeta || !championMeta.currentChampionId) {
      return null;
    }
    return this.models.get(championMeta.currentChampionId) || null;
  }

  compareModels(modelAId, modelBId) {
    const a = this.models.get(modelAId);
    const b = this.models.get(modelBId);
    if (!a || !b) throw new Error('MODEL_NOT_FOUND_FOR_COMPARISON');

    const deltaLoss = b.validationLoss - a.validationLoss;
    const deltaAccuracy = b.validationAccuracy - a.validationAccuracy;

    // Weight Euclidean distance ||W_B - W_A||_2
    const minLen = Math.min(a.weights.length, b.weights.length);
    let sqDist = 0;
    for (let i = 0; i < minLen; i++) {
      const diff = b.weights[i] - a.weights[i];
      sqDist += diff * diff;
    }
    const weightDistance = Math.sqrt(sqDist);

    return {
      modelAId,
      modelBId,
      deltaLoss,
      deltaAccuracy,
      weightDistance,
      isSuperior: deltaAccuracy > 0 && deltaLoss <= 0
    };
  }

  getStats() {
    return { ...this.stats };
  }
}

module.exports = { ModelRegistryService };

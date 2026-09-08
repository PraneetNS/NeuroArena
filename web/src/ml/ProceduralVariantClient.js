/**
 * ProceduralVariantClient.js
 * Client-Side Deterministic Procedural Biome Variant Generator & Replay Parser for NeuroArena Web.
 * 
 * Features:
 * - 100% Deterministic Seeded PRNG matching backend bit-for-bit.
 * - 6-Biome mathematical difficulty envelopes.
 * - Poisson-disc terrain parameter generation.
 * - 2-3 boss attack patterns per biome.
 * - Daily Seed mode synchronized to UTC date keys.
 */

export class SeededPRNG {
    constructor(seedStr = "NEURO-8842") {
        this.init(seedStr);
    }

    init(seedStr) {
        this.seed = String(seedStr || "NEURO-8842").toUpperCase().trim();
        let hash = 0;
        for (let i = 0; i < this.seed.length; i++) {
            hash = ((hash << 5) - hash) + this.seed.charCodeAt(i);
            hash |= 0;
        }
        this.state = (Math.abs(hash) || 1337) >>> 0;
    }

    next() {
        let t = (this.state += 0x6D2B79F5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    range(min, max) {
        return min + this.next() * (max - min);
    }

    int(min, max) {
        return Math.floor(this.range(min, max + 1));
    }

    choice(arr) {
        if (!arr || arr.length === 0) return null;
        return arr[this.int(0, arr.length - 1)];
    }

    gaussian(mean = 0, std = 1) {
        let u = 1 - this.next();
        let v = 1 - this.next();
        return mean + std * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    }
}

export class ProceduralVariantClient {
    constructor() {
        this.bossDefinitions = [
            {
                bossId: "outlier_titan",
                bossName: "The Outlier Titan",
                biomeIndex: 0,
                biomeName: "The Linear Steppes",
                baseHp: 500,
                baseDamage: 25,
                baseEnrageSec: 90,
                moveSets: [
                    { variantId: "GRADIENT_AVALANCHE", variantName: "Gradient Avalanche Pattern", specialMove: "Descent Volley" },
                    { variantId: "RESIDUAL_SHOCKWAVE", variantName: "Residual Shockwave Pattern", specialMove: "Outlier Seismic Slam" },
                    { variantId: "MOMENTUM_SURGE", variantName: "Momentum Surge Pattern", specialMove: "Velocity Rush" }
                ]
            },
            {
                bossId: "hyperplane_hydra",
                bossName: "The Hyperplane Hydra",
                biomeIndex: 1,
                biomeName: "The Binary Marshlands",
                baseHp: 850,
                baseDamage: 40,
                baseEnrageSec: 120,
                moveSets: [
                    { variantId: "SIGMOID_BREATH", variantName: "Sigmoid Breath Pattern", specialMove: "Logistic Sweep" },
                    { variantId: "BCE_POISON_POOLS", variantName: "Log-Loss Poison Spores", specialMove: "Cross-Entropy Eruption" },
                    { variantId: "DUAL_HYPERPLANE_CLEAVE", variantName: "Dual-Head Hyperplane Cleave", specialMove: "Orthogonal Cleave" }
                ]
            },
            {
                bossId: "overfit_colossus",
                bossName: "The Overfit Colossus",
                biomeIndex: 2,
                biomeName: "The Variance Tundra",
                baseHp: 1500,
                baseDamage: 65,
                baseEnrageSec: 150,
                moveSets: [
                    { variantId: "POLYNOMIAL_OSCILLATION", variantName: "Degree-7 Polynomial Wave", specialMove: "Runge Oscillation Slam" },
                    { variantId: "BLIZZARD_OVERFIT", variantName: "Zero-Variance Freeze Storm", specialMove: "L2 Shrinkage Tempest" },
                    { variantId: "LASSO_SPARSE_SHARDS", variantName: "L1 Lasso Sparse Needle Rain", specialMove: "Coordinate Descent Barrage" }
                ]
            },
            {
                bossId: "dendrogram_dragon",
                bossName: "The Dendrogram Dragon",
                biomeIndex: 3,
                biomeName: "The Branching Canopy",
                baseHp: 1800,
                baseDamage: 75,
                baseEnrageSec: 160,
                moveSets: [
                    { variantId: "GINI_BRANCH_CLEAVE", variantName: "Binary Decision Split Tail", specialMove: "Gini Impurity Split" },
                    { variantId: "ENSEMBLE_ROAR", variantName: "5-Tree Bagging Summon", specialMove: "Random Forest Stampede" },
                    { variantId: "PRUNING_GALE", variantName: "Cost-Complexity Pruning Gale", specialMove: "Subtree Pruning Blast" }
                ]
            },
            {
                bossId: "nonlinear_overlord",
                bossName: "The Non-Linear Overlord",
                biomeIndex: 4,
                biomeName: "The Deep Synapse Citadel",
                baseHp: 2500,
                baseDamage: 90,
                baseEnrageSec: 180,
                moveSets: [
                    { variantId: "XOR_ENERGY_GRID", variantName: "XOR Non-Linear Laser Manifold", specialMove: "Hidden Layer Flux" },
                    { variantId: "BACKPROP_LASER", variantName: "Gradient Backprop Focus Beam", specialMove: "Chain Rule Ray" },
                    { variantId: "VANISHING_GRADIENT_AURA", variantName: "Sigmoid Saturation Dark Zone", specialMove: "Dead Neuron Pulse" }
                ]
            },
            {
                bossId: "high_dim_void",
                bossName: "The High-Dimensional Void",
                biomeIndex: 5,
                biomeName: "The Semantic Expanse",
                baseHp: 3200,
                baseDamage: 110,
                baseEnrageSec: 210,
                moveSets: [
                    { variantId: "COSINE_SINGULARITY", variantName: "High-Dimensional Vector Singularity", specialMove: "PPMI Vortex" },
                    { variantId: "LATENT_RAY_SWEEP", variantName: "Principal Component Slicing Beam", specialMove: "PCA Eigen-Beam" },
                    { variantId: "SEMANTIC_ANALOGY_VOLLEY", variantName: "Constellation Concept Barrage", specialMove: "Analogy Resonator" }
                ]
            }
        ];
    }

    getDailySeed(date = new Date()) {
        const d = new Date(date);
        const y = d.getUTCFullYear();
        const m = String(d.getUTCMonth() + 1).padStart(2, '0');
        const day = String(d.getUTCDate()).padStart(2, '0');
        return `DAILY-${y}${m}${day}`;
    }

    generateVariant(biomeIndex = 0, seedStr = "NEURO-8842") {
        const safeBiome = Math.max(0, Math.min(5, Number(biomeIndex) || 0));
        const prng = new SeededPRNG(`${seedStr}_B${safeBiome}`);
        const bossDef = this.bossDefinitions[safeBiome];
        const moveSet = prng.choice(bossDef.moveSets);

        const hpDelta = prng.range(-0.10, 0.15);
        const damageDelta = prng.range(-0.10, 0.10);

        return {
            seed: seedStr,
            biomeIndex: safeBiome,
            biomeName: bossDef.biomeName,
            boss: {
                bossId: bossDef.bossId,
                bossName: bossDef.bossName,
                maxHp: Math.round(bossDef.baseHp * (1 + hpDelta)),
                attackDamage: Math.round(bossDef.baseDamage * (1 + damageDelta)),
                selectedMoveSet: moveSet
            },
            terrain: {
                densityMultiplier: Number(prng.range(0.85, 1.25).toFixed(2)),
                minDistance: Number(prng.range(4.8, 6.2).toFixed(2)),
                poissonSeed: prng.int(1000, 999999)
            }
        };
    }
}

export const NeuroProceduralVariant = new ProceduralVariantClient();
if (typeof window !== "undefined") {
    window.NeuroProceduralVariant = NeuroProceduralVariant;
}

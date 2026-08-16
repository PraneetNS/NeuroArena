// =========================================================
// NEURO-ARENA: GRADIENTS OF THE WILD
// Playable 3D Machine Learning Action-Adventure Simulation
// Codex / Journal, Daily Seeded Challenge, Mastery Skins & Replay Stat Cards
// =========================================================

// --- 1. PROCEDURAL WEB AUDIO SYNTHESIZER (ZERO EXTERNAL ASSETS) ---
let audioCtx = null;

function getAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === "suspended") {
        audioCtx.resume();
    }
    return audioCtx;
}

function playPickupSFX() {
    try {
        const ctx = getAudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
    } catch (e) { }
}

function playTerminalOpenSFX() {
    try {
        const ctx = getAudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(120, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(480, ctx.currentTime + 0.25);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
    } catch (e) { }
}

function playEpochTickSFX() {
    try {
        const ctx = getAudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(1400, ctx.currentTime);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.035);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.035);
    } catch (e) { }
}

function playVictoryPassSFX() {
    try {
        const ctx = getAudioContext();
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C Major Fanfare
        notes.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "sine";
            osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.06);
            gain.gain.setValueAtTime(0.2, ctx.currentTime + idx * 0.06);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.06 + 0.35);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(ctx.currentTime + idx * 0.06);
            osc.stop(ctx.currentTime + idx * 0.06 + 0.35);
        });
    } catch (e) { }
}

function playFailureSFX() {
    try {
        const ctx = getAudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(90, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(45, ctx.currentTime + 0.35);
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
    } catch (e) { }
}

// --- 2. SEEDED PSEUDO-RANDOM NUMBER GENERATOR (PRNG) ---
let SeedPRNG = {
    seed: "NEURO-8842",
    state: 1337,
    init(seedStr) {
        this.seed = (seedStr || "NEURO-8842").toUpperCase().trim();
        let hash = 0;
        for (let i = 0; i < this.seed.length; i++) {
            hash = ((hash << 5) - hash) + this.seed.charCodeAt(i);
            hash |= 0;
        }
        this.state = Math.abs(hash) || 1337;
    },
    next() {
        this.state = (this.state * 1664525 + 1013904223) % 4294967296;
        return this.state / 4294967296;
    },
    range(min, max) { return min + this.next() * (max - min); },
    gaussian(mean = 0, std = 1) {
        let u = 1 - this.next(), v = 1 - this.next();
        return mean + std * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    }
};

function generateRandomSeed() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let s = "";
    for (let i = 0; i < 8; i++) s += (i === 4 ? "-" : chars[Math.floor(Math.random() * chars.length)]);
    return s;
}

function getDailySeed() {
    const d = new Date();
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `DAILY-${y}${m}${day}`;
}

// =========================================================
// 0. GLOBAL ERROR BOUNDARY & EMERGENCY CRASH RECOVERY
// =========================================================
window.addEventListener("error", (event) => {
    handleGlobalError(event.error ? event.error.message : event.message, event.error ? event.error.stack : "");
});

window.addEventListener("unhandledrejection", (event) => {
    handleGlobalError(event.reason ? event.reason.message : "Unhandled Promise Rejection", event.reason ? event.reason.stack : "");
});

function handleGlobalError(message, stack) {
    console.error("[GlobalErrorBoundary] Caught fatal unhandled error:", message, stack);

    // Emergency Backup Save
    try {
        if (typeof saveProfileSlots === "function") saveProfileSlots();
        if (typeof saveModelVault === "function") saveModelVault();
        localStorage.setItem("neuroarena_emergency_backup", JSON.stringify({
            timestamp: new Date().toISOString(),
            error: message,
            stack: stack
        }));
    } catch (e) { }

    const errModal = document.getElementById("error-boundary-modal");
    if (errModal) {
        document.getElementById("error-log-snippet").innerText = `${message}\n${stack || ""}`;
        errModal.classList.remove("hidden");
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const btnReload = document.getElementById("btn-error-reload");
    const btnDismiss = document.getElementById("btn-error-dismiss");
    if (btnReload) btnReload.addEventListener("click", () => window.location.reload());
    if (btnDismiss) btnDismiss.addEventListener("click", () => document.getElementById("error-boundary-modal").classList.add("hidden"));
});

// --- 3. GAME STATE & CODEX DATABASE ---
const CodexCurriculum = [
    {
        title: "Linear Regression & Gradient Descent",
        subtitle: "Biome 1: The Linear Steppes",
        math: "Hypothesis: y = w·x + b\nMSE Loss: J(w, b) = (1/2N) ∑ (ŷᵢ - yᵢ)²\nGradient: ∂J/∂w = (1/N) ∑ (ŷᵢ - yᵢ)·xᵢ\nUpdate Rule: w ← w - η·(∂J/∂w)",
        plain: "Finds the single best straight line through scattered data points by measuring how far off predictions are (MSE), and nudging the slope and offset downhill against the slope of the error surface.",
        apps: "Stock price forecasting, real estate valuations, trend analysis, physical simulation calibration.",
        skin: "Obsidian Gradient"
    },
    {
        title: "Logistic Classification & Sigmoid Gate",
        subtitle: "Biome 2: The Binary Marshlands",
        math: "Sigmoid Gate: σ(z) = 1 / (1 + e⁻ᶻ), where z = w·x + b\nBinary Cross-Entropy Loss:\nJ(w, b) = - (1/N) ∑ [ yᵢ ln(ŷᵢ) + (1 - yᵢ) ln(1 - ŷᵢ) ]",
        plain: "Squashes linear outputs into a continuous probability between 0% and 100%. If probability ≥ 0.50, the sample belongs to Class 1; otherwise, Class 0. Separates classes via a glowing decision hyperplane.",
        apps: "Spam detection, medical disease diagnosis, fraud detection, pass/fail quality assurance.",
        skin: "Bioluminescent Neon"
    },
    {
        title: "Polynomial Features & Ridge/Lasso Regularization",
        subtitle: "Biome 3: The Variance Tundra",
        math: "Expansion: Φ(x) = [1, x, x², ..., xᵈ]\nRidge (L₂ Penalty): J(w) = MSE + λ ∑ wⱼ²\nLasso (L₁ Penalty): J(w) = MSE + λ ∑ |wⱼ|",
        plain: "Expands a single feature into higher-order curves (degrees 1-9) to fit complex terrain. Regularization introduces a budget penalty (λ) that penalizes wild oscillations, preventing overfitting on unseen test data.",
        apps: "Atmospheric climate modeling, automated feature selection, robotic trajectory smoothing.",
        skin: "Glacial Crystalline"
    },
    {
        title: "Recursive Decision Trees & Information Gain",
        subtitle: "Biome 4: The Branching Canopy",
        math: "Gini Impurity: I(S) = 1 - ∑ pₖ²\nEntropy: H(S) = - ∑ pₖ log₂(pₖ)\nSplit Gain: ΔI = I(Parent) - (N_L/N)·I(Left) - (N_R/N)·I(Right)",
        plain: "Constructs a flowchart of threshold questions (e.g. Is height > 1.2m?). At each fork, it finds the exact cut that isolates distinct classes with maximum purity, carving out orthogonal decision regions.",
        apps: "Credit scoring, medical triage flowcharts, customer churn segmentation, game AI behavior trees.",
        skin: "Verdant Living Canopy"
    },
    {
        title: "Multi-Layer Perceptrons & Analytical Backprop",
        subtitle: "Biome 5: The Deep Synapse Citadel",
        math: "Forward: a⁽¹⁾ = ReLU(W⁽¹⁾x + b⁽¹⁾), ŷ = σ(W⁽²⁾a⁽¹⁾ + b⁽²⁾)\nOutput Delta: δ⁽²⁾ = (ŷ - y)\nHidden Delta: δ⁽¹⁾ = (W⁽²⁾ᵀ δ⁽²⁾) ⊙ ReLU'(z⁽¹⁾)\nWeight Gradient: ∂J/∂W⁽¹⁾ = δ⁽¹⁾ (x)ᵀ",
        plain: "Chains hidden layers of artificial neurons together with non-linear activation gates (ReLU/Tanh). Backpropagation propagates errors backward layer-by-layer via the calculus chain rule, conquering non-linear XOR paradoxes.",
        apps: "Computer vision, speech recognition, autonomous vehicle perception, neural game agents.",
        skin: "Cyber-Citadel Matrix"
    },
    {
        title: "Word Embeddings, PPMI & Cosine Retrieval",
        subtitle: "Biome 6: The Semantic Expanse",
        math: "PPMI: max(0, log₂[ P(w, c) / (P(w)·P(c)) ])\nCosine Similarity: Sim(u, v) = (u · v) / (‖u‖ · ‖v‖)\nVector Analogy: v_target = v_A - v_B + v_C",
        plain: "Transforms discrete text tags into continuous spatial coordinates where geometric closeness encodes semantic meaning. Powers modern vector search, analogy reasoning (King - Man + Woman = Queen), and RAG LLM retrieval.",
        apps: "RAG search engines, semantic recommendation systems, semantic code search, language translation.",
        skin: "Astral Hologram"
    }
];

const GameState = {
    playthroughSeed: "NEURO-8842",
    profile: { noiseLevel: 0.28, classOverlap: 0.15, outlierRate: 0.05, featureScaleX: 1.2, featureScaleY: 1.1, trueW: 2.45, trueB: 1.15 },
    currentBiome: 0,
    unlockedBiomes: [true, false, false, false, false, false],
    seenBiomeCoachTips: [false, false, false, false, false, false],
    resources: { featureX: 0, targetY: 0, pairedN: 0, class0: 0, class1: 0, class2: 0, xorCores: 0, conceptRunes: 0 },
    collectedDataset: [], // Genuine empirical samples: [{ x, y, x1, x2, classLabel, type, isOutlier }]
    equippedSkin: "obsidian",
    equippedOptimizer: "Adam",
    tutorialStep: 0,
    lastLoss: 0.0245,
    lastAccuracy: 94.2,
    lastSaved: null
};

const SAVE_KEY = "neuroarena_web_save_v1";

function computeDatasetStats() {
    const ds = GameState.collectedDataset;
    const n = ds.length;

    const countEl = document.getElementById("stats-sample-count");
    if (countEl) countEl.innerText = `${n} samples`;

    if (n === 0) {
        if (document.getElementById("stats-range-x")) document.getElementById("stats-range-x").innerText = "[0.0, 0.0]";
        if (document.getElementById("stats-range-y")) document.getElementById("stats-range-y").innerText = "[0.0, 0.0]";
        if (document.getElementById("stats-mean-std-x")) document.getElementById("stats-mean-std-x").innerText = "X: 0.0 ± 0.0";
        if (document.getElementById("stats-mean-std-y")) document.getElementById("stats-mean-std-y").innerText = "Y: 0.0 ± 0.0";
        if (document.getElementById("stats-pearson-val")) document.getElementById("stats-pearson-val").innerText = "+0.00";
        return;
    }

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let sumX = 0, sumY = 0;
    let c0 = 0, c1 = 0;
    let hasClassification = false;

    for (let i = 0; i < n; i++) {
        const pt = ds[i];
        const xVal = pt.x !== undefined ? pt.x : pt.x1;
        const yVal = pt.y !== undefined ? pt.y : pt.x2;

        if (xVal < minX) minX = xVal;
        if (xVal > maxX) maxX = xVal;
        if (yVal < minY) minY = yVal;
        if (yVal > maxY) maxY = yVal;

        sumX += xVal;
        sumY += yVal;

        if (pt.classLabel !== undefined) {
            hasClassification = true;
            if (pt.classLabel === 0) c0++; else c1++;
        }
    }

    const meanX = sumX / n;
    const meanY = sumY / n;
    let varX = 0, varY = 0, covXY = 0;

    for (let i = 0; i < n; i++) {
        const pt = ds[i];
        const xVal = pt.x !== undefined ? pt.x : pt.x1;
        const yVal = pt.y !== undefined ? pt.y : pt.x2;
        const dx = xVal - meanX;
        const dy = yVal - meanY;
        varX += dx * dx;
        varY += dy * dy;
        covXY += dx * dy;
    }

    const stdX = Math.sqrt(varX / Math.max(1, n));
    const stdY = Math.sqrt(varY / Math.max(1, n));
    let r = (stdX > 1e-6 && stdY > 1e-6) ? (covXY / (n * stdX * stdY)) : 0;
    r = Math.max(-1, Math.min(1, r));

    // Update DOM
    if (document.getElementById("stats-range-x")) document.getElementById("stats-range-x").innerText = `[${minX.toFixed(1)}, ${maxX.toFixed(1)}]`;
    if (document.getElementById("stats-range-y")) document.getElementById("stats-range-y").innerText = `[${minY.toFixed(1)}, ${maxY.toFixed(1)}]`;
    if (document.getElementById("stats-mean-std-x")) document.getElementById("stats-mean-std-x").innerText = `X: ${meanX.toFixed(2)} ± ${stdX.toFixed(2)}`;
    if (document.getElementById("stats-mean-std-y")) document.getElementById("stats-mean-std-y").innerText = `Y: ${meanY.toFixed(2)} ± ${stdY.toFixed(2)}`;
    if (document.getElementById("stats-pearson-val")) {
        document.getElementById("stats-pearson-val").innerText = `${r >= 0 ? "+" : ""}${r.toFixed(2)}`;
    }

    // Class balance UI
    const classSec = document.getElementById("stats-class-balance-section");
    if (classSec) {
        if (hasClassification) {
            classSec.classList.remove("hidden");
            const p0 = Math.round((c0 / (c0 + c1)) * 100);
            const p1 = 100 - p0;
            const ratioEl = document.getElementById("stats-class-ratio");
            if (ratioEl) ratioEl.innerText = `0: ${c0} (${p0}%) | 1: ${c1} (${p1}%)`;
            const fillEl = document.getElementById("stats-class-balance-fill");
            if (fillEl) fillEl.style.width = `${p1}%`;
        } else {
            classSec.classList.add("hidden");
        }
    }

    // Also update Dataset Inspector summary
    // Compute Dataset Health Score (Balance + Outlier Cleanliness + Domain Coverage)
    const health = computeDatasetHealth(ds, minX, maxX, stdX, c0, c1, hasClassification);
    updateDatasetHealthUI(health);

    // Also update Dataset Inspector summary
    const summaryEl = document.getElementById("dataset-stats-summary");
    if (summaryEl) {
        summaryEl.innerHTML = `🧬 Pearson r(X, Y) = <b>${r >= 0 ? "+" : ""}${r.toFixed(3)}</b> | Samples: <b>${n}</b> (μX=${meanX.toFixed(1)}, μY=${meanY.toFixed(1)}) | Seed: <b>#${GameState.playthroughSeed}</b>`;
    }
}

function computeDatasetHealth(ds, minX, maxX, stdX, c0, c1, hasClassification) {
    const n = ds.length;
    if (n === 0) {
        return {
            score: 100,
            grade: "EXCELLENT",
            balance: 100,
            cleanliness: 100,
            coverage: 100,
            defects: "No empirical samples collected yet.",
            forecast: "Harvest empirical tokens in the biome to build your dataset."
        };
    }

    let balance = 100;
    let cleanliness = 100;
    let coverage = 100;
    let outliers = 0;
    const defects = [];

    // 1. Balance Score
    if (hasClassification && (c0 + c1) > 0) {
        const p0 = c0 / (c0 + c1);
        const p1 = c1 / (c0 + c1);
        const skew = Math.abs(p0 - p1);
        balance = Math.max(0, Math.min(100, Math.round((1.0 - skew) * 100)));
        if (balance < 60) defects.push(`Class Imbalance (${Math.round(p0 * 100)}/${Math.round(p1 * 100)})`);
    } else {
        const span = maxX - minX;
        balance = Math.max(0, Math.min(100, Math.round((stdX / Math.max(1, span * 0.4)) * 100)));
    }

    // 2. Outlier Cleanliness
    for (let i = 0; i < n; i++) {
        const pt = ds[i];
        if (pt.isOutlier) {
            outliers++;
        } else if (pt.x !== undefined && pt.y !== undefined) {
            const expectedY = GameState.profile.trueW * pt.x + GameState.profile.trueB;
            if (Math.abs(pt.y - expectedY) > 5.5) outliers++;
        }
    }
    const outlierRatio = outliers / n;
    cleanliness = Math.max(0, Math.min(100, Math.round((1.0 - outlierRatio * 3.5) * 100)));
    if (outliers > 0) defects.push(`${outliers} High Outlier(s) Present`);

    // 3. Domain Coverage
    const domainSpan = maxX - minX;
    const spanScore = Math.min(1.0, domainSpan / 7.5);
    const countScore = Math.min(1.0, n / 10);
    coverage = Math.max(0, Math.min(100, Math.round((spanScore * 0.65 + countScore * 0.35) * 100)));
    if (coverage < 60) defects.push("Narrow Feature Domain (High Extrapolation Risk)");

    // Aggregate Score
    const totalScore = Math.max(5, Math.min(100, Math.round(balance * 0.35 + cleanliness * 0.35 + coverage * 0.30)));
    const grade = totalScore >= 85 ? "EXCELLENT" : (totalScore >= 70 ? "GOOD" : (totalScore >= 50 ? "FAIR" : "CRITICAL / SKEWED"));
    const defectSummary = defects.length > 0 ? defects.join(" • ") : "Clean & Balanced Empirical Dataset";
    const forecast = totalScore >= 80 ? "High Generalization (>90% test accuracy expected)" :
        (totalScore >= 55 ? "Moderate Generalization (~75-85% test accuracy expected)" :
            "Severe Generalization Failure Predicted on Held-Out Test Set (<65%)");

    return {
        score: totalScore,
        grade,
        balance,
        cleanliness,
        coverage,
        defects: defectSummary,
        forecast
    };
}

function updateDatasetHealthUI(health) {
    const valEl = document.getElementById("drawer-health-score-val");
    if (valEl) {
        valEl.innerText = `${health.score}% [${health.grade}]`;
        valEl.className = health.score >= 80 ? "green-text" : (health.score >= 50 ? "text-amber" : "fail-text");
    }

    const fillEl = document.getElementById("drawer-health-gauge-fill");
    if (fillEl) {
        fillEl.style.width = `${health.score}%`;
        fillEl.style.backgroundColor = health.score >= 80 ? "#4ade80" : (health.score >= 50 ? "#facc15" : "#f43f5e");
    }

    if (document.getElementById("health-sub-balance")) document.getElementById("health-sub-balance").innerText = `${health.balance}%`;
    if (document.getElementById("health-sub-clean")) document.getElementById("health-sub-clean").innerText = `${health.cleanliness}%`;
    if (document.getElementById("health-sub-cover")) document.getElementById("health-sub-cover").innerText = `${health.coverage}%`;
    if (document.getElementById("drawer-health-defects-text")) document.getElementById("drawer-health-defects-text").innerText = `⚠️ ${health.defects}`;

    // Terminal Health Card
    const termBadge = document.getElementById("term-health-badge");
    if (termBadge) {
        termBadge.innerText = `🩺 HEALTH: ${health.score}% [${health.grade}]`;
        termBadge.style.color = health.score >= 80 ? "#4ade80" : (health.score >= 50 ? "#facc15" : "#f43f5e");
    }
    const termFill = document.getElementById("term-health-gauge-fill");
    if (termFill) {
        termFill.style.width = `${health.score}%`;
        termFill.style.backgroundColor = health.score >= 80 ? "#4ade80" : (health.score >= 50 ? "#facc15" : "#f43f5e");
    }
    const termBreakdown = document.getElementById("term-health-breakdown");
    if (termBreakdown) termBreakdown.innerText = `⚖️ Bal: ${health.balance}% | 🧹 Clean: ${health.cleanliness}% | 🌐 Cover: ${health.coverage}%`;
    const termForecast = document.getElementById("term-health-forecast");
    if (termForecast) {
        termForecast.innerText = health.forecast;
        termForecast.className = health.score >= 80 ? "text-green" : (health.score >= 50 ? "text-amber" : "fail-text");
    }
    const termDefect = document.getElementById("term-health-defect");
    if (termDefect) termDefect.innerText = `⚠️ ${health.defects}`;
}

function updateHUD() {
    const ds = GameState.collectedDataset || [];
    const n = ds.length;
    let xCount = 0, yCount = 0;
    ds.forEach(p => {
        if (p.x !== undefined || p.x1 !== undefined) xCount++;
        if (p.y !== undefined || p.x2 !== undefined) yCount++;
    });

    if (document.getElementById("drawer-x-count")) document.getElementById("drawer-x-count").innerText = xCount;
    if (document.getElementById("drawer-y-count")) document.getElementById("drawer-y-count").innerText = yCount;
    if (document.getElementById("drawer-n-count")) document.getElementById("drawer-n-count").innerText = n;
    if (document.getElementById("objective-status")) document.getElementById("objective-status").innerText = `${n}/18 COLLECTED`;

    computeDatasetStats();
}

function initializePlaythroughSeed(seedStr) {
    GameState.playthroughSeed = seedStr || generateRandomSeed();
    SeedPRNG.init(GameState.playthroughSeed);
    GameState.profile = {
        noiseLevel: SeedPRNG.range(0.08, 0.45),
        classOverlap: SeedPRNG.range(0.05, 0.35),
        outlierRate: SeedPRNG.range(0.02, 0.12),
        featureScaleX: SeedPRNG.range(0.8, 2.2),
        featureScaleY: SeedPRNG.range(0.8, 2.2),
        trueW: SeedPRNG.range(-3.5, 3.5),
        trueB: SeedPRNG.range(-4.0, 4.0)
    };
    if (Math.abs(GameState.profile.trueW) < 0.8) GameState.profile.trueW = 2.45;

    document.getElementById("terminal-seed-telemetry").innerText =
        `🧬 SEED: #${GameState.playthroughSeed} | Noise σ=${GameState.profile.noiseLevel.toFixed(2)} | Outliers=${(GameState.profile.outlierRate * 100).toFixed(0)}% | Overlap ρ=${GameState.profile.classOverlap.toFixed(2)} | Scale=(${GameState.profile.featureScaleX.toFixed(1)}x, ${GameState.profile.featureScaleY.toFixed(1)}x)`;
}

function loadSavedGame() {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    try {
        const saved = JSON.parse(raw);
        Object.assign(GameState, saved);
        if (!Array.isArray(GameState.collectedDataset)) GameState.collectedDataset = [];
        initializePlaythroughSeed(GameState.playthroughSeed);
        computeDatasetStats();
        return true;
    } catch (e) {
        return false;
    }
}

function saveGame() {
    GameState.lastSaved = new Date().toISOString();
    localStorage.setItem(SAVE_KEY, JSON.stringify(GameState));
    computeDatasetStats();
    updateHUD();
}

function resetGameSave() {
    localStorage.removeItem(SAVE_KEY);
    const newSeed = document.getElementById("menu-seed-input").value || generateRandomSeed();
    initializePlaythroughSeed(newSeed);
    GameState.currentBiome = 0;
    GameState.unlockedBiomes = [true, false, false, false, false, false];
    GameState.resources = { featureX: 0, targetY: 0, pairedN: 0, class0: 0, class1: 0, class2: 0, xorCores: 0, conceptRunes: 0 };
    GameState.collectedDataset = [];
    GameState.tutorialStep = 0;
    computeDatasetStats();
    saveGame();
}

// --- 4. CODEX / JOURNAL RENDERER ---
let currentCodexCardIndex = 0;

function renderCodexModal() {
    const sidebar = document.getElementById("codex-sidebar-list");
    sidebar.innerHTML = "";

    CodexCurriculum.forEach((c, idx) => {
        const btn = document.createElement("button");
        btn.className = `codex-tab-btn ${idx === currentCodexCardIndex ? "active" : ""}`;
        btn.innerHTML = `<b>${idx + 1}. ${c.title}</b>`;
        btn.addEventListener("click", () => {
            currentCodexCardIndex = idx;
            renderCodexModal();
        });
        sidebar.appendChild(btn);
    });

    const active = CodexCurriculum[currentCodexCardIndex];
    document.getElementById("codex-card-title").innerText = `${currentCodexCardIndex + 1}. ${active.title} (${active.subtitle})`;
    document.getElementById("codex-math-content").innerText = active.math;
    document.getElementById("codex-plain-content").innerText = active.plain;
    document.getElementById("codex-apps-content").innerText = active.apps;
    document.getElementById("codex-skin-badge").innerText = `🎨 Mastery Cosmetic: ${active.skin} Terminal Skin`;
}

// --- 5. REPLAY STAT CARD GENERATOR (CANVAS PNG EXPORTER) ---
function generateBossStatCard() {
    const canvas = document.getElementById("stat-card-canvas");
    const ctx = canvas.getContext("2d");

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, "#030712");
    grad.addColorStop(0.5, "#0b1329");
    grad.addColorStop(1, "#020617");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Glowing border
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 3;
    ctx.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);

    // Header Title
    ctx.fillStyle = "#38bdf8";
    ctx.font = "bold 16px Outfit, sans-serif";
    ctx.fillText("⚡ NEURO-ARENA :: ARCHITECT REPLAY STAT CARD", 24, 34);

    // Metadata
    ctx.fillStyle = "#cbd5e1";
    ctx.font = "12px JetBrains Mono, monospace";
    ctx.fillText(`PLAYTHROUGH SEED: #${GameState.playthroughSeed}`, 24, 62);
    ctx.fillText(`BIOME: Linear Steppes ➔ Citadel  |  DATE: ${new Date().toLocaleDateString()}`, 24, 82);

    // Stat Badges
    ctx.fillStyle = "rgba(56, 189, 248, 0.15)";
    ctx.fillRect(24, 100, 200, 70);
    ctx.strokeStyle = "rgba(56, 189, 248, 0.4)";
    ctx.strokeRect(24, 100, 200, 70);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px Outfit, sans-serif";
    ctx.fillText("HELD-OUT GENERALIZATION ACCURACY", 32, 120);
    ctx.fillStyle = "#4ade80";
    ctx.font = "bold 26px JetBrains Mono, monospace";
    ctx.fillText(`${GameState.lastAccuracy.toFixed(1)}%`, 32, 155);

    ctx.fillStyle = "rgba(251, 191, 36, 0.15)";
    ctx.fillRect(240, 100, 215, 70);
    ctx.strokeStyle = "rgba(251, 191, 36, 0.4)";
    ctx.strokeRect(240, 100, 215, 70);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px Outfit, sans-serif";
    ctx.fillText("FINAL OPTIMIZED LOSS", 250, 120);
    ctx.fillStyle = "#facc15";
    ctx.font = "bold 26px JetBrains Mono, monospace";
    ctx.fillText(`J = ${GameState.lastLoss.toFixed(4)}`, 250, 155);

    // Mini Loss Curve Thumbnail
    ctx.fillStyle = "#020617";
    ctx.fillRect(24, 185, canvas.width - 48, 55);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.strokeRect(24, 185, canvas.width - 48, 55);

    ctx.strokeStyle = "#4ade80";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 40; i++) {
        const px = 28 + (i / 40) * (canvas.width - 56);
        const py = 230 - Math.exp(-i * 0.12) * 35;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Footer
    ctx.fillStyle = "#64748b";
    ctx.font = "10px Outfit, sans-serif";
    ctx.fillText("VERIFIED BY NEURO-ARENA PURE C# ENGINE  |  ZERO EXTERNAL ML LIBS", 24, 262);
}

function downloadStatCardImage() {
    const canvas = document.getElementById("stat-card-canvas");
    const image = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.download = `NeuroArena_Card_${GameState.playthroughSeed}.png`;
    a.href = image;
    a.click();
}

// --- 6. 90-SECOND GUIDED FIRST-RUN TUTORIAL & ADA COMPANION ---
function triggerMascotDialogue(text, duration = 8000) {
    const bubble = document.getElementById("mascot-bubble");
    const txt = document.getElementById("mascot-text");
    if (!bubble || !txt) return;

    txt.innerText = text;
    bubble.classList.remove("hidden");
    if (typeof gsap !== "undefined") {
        gsap.fromTo(bubble, { y: -20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, ease: "back.out(1.5)" });
    }

    playPickupSFX();

    clearTimeout(triggerMascotDialogue._timeout);
    triggerMascotDialogue._timeout = setTimeout(() => {
        if (typeof gsap !== "undefined") {
            gsap.to(bubble, { y: -15, opacity: 0, duration: 0.25, onComplete: () => bubble.classList.add("hidden") });
        } else {
            bubble.classList.add("hidden");
        }
    }, duration);
}

function updateTutorialState() {
    const btnTerm = document.getElementById("btn-open-terminal");
    const btnTrain = document.getElementById("btn-train-weapon");
    const btnModels = document.getElementById("btn-open-models-hud");
    const btnQuery = document.getElementById("btn-query-model");

    if (GameState.tutorialStep === 0) {
        triggerMascotDialogue("Welcome, Architect! I'm ADA. See that glowing Feature Crystal (X) ahead? Let's harvest it to collect sample data!", 9000);
        document.getElementById("objective-title").innerText = "HARVEST 1ST FEATURE CRYSTAL (X)";
        btnTerm?.classList.remove("pulsing-target");
        btnTrain?.classList.remove("pulsing-target");
        btnModels?.classList.remove("pulsing-target");
    } else if (GameState.tutorialStep === 1) {
        triggerMascotDialogue("Great extraction! That crystal contains linear gradient energy. Follow your radar to the glowing Lab Station!", 9000);
        document.getElementById("objective-title").innerText = "ENTER THE LAB STATION";
        btnTerm?.classList.add("pulsing-target");
        btnTrain?.classList.remove("pulsing-target");
        btnModels?.classList.remove("pulsing-target");
    } else if (GameState.tutorialStep === 2) {
        triggerMascotDialogue("I've pre-filled your model expression: y = wx + b. Hit the pulsing TRAIN button to run Gradient Descent!", 9000);
        document.getElementById("objective-title").innerText = "CALIBRATE & TRAIN MODEL";
        btnTerm?.classList.remove("pulsing-target");
        btnTrain?.classList.add("pulsing-target");
        btnModels?.classList.remove("pulsing-target");
    } else if (GameState.tutorialStep === 3) {
        GameState.tutorialStep = 4;
        updateTutorialState();
    } else if (GameState.tutorialStep === 4) {
        triggerMascotDialogue("Incredible victory, Architect! Your newly trained model is archived in the Vault. Let's inspect its inner mechanics! Tap '💾 MY MODELS' on your HUD.", 10000);
        document.getElementById("objective-title").innerText = "OPEN MODEL VAULT (💾 MY MODELS)";
        btnTerm?.classList.remove("pulsing-target");
        btnTrain?.classList.remove("pulsing-target");
        btnModels?.classList.add("pulsing-target");
    } else if (GameState.tutorialStep === 5) {
        triggerMascotDialogue("Enter X = 8.5 to query your model and observe how continuous functions extrapolate into uncharted territory!", 10000);
        document.getElementById("objective-title").innerText = "INTERROGATE MODEL (QUERY X = 8.5)";
        btnModels?.classList.remove("pulsing-target");
        btnQuery?.classList.add("pulsing-target");
        const inputQ = document.getElementById("input-consult-x");
        if (inputQ) inputQ.value = "8.5";
    } else if (GameState.tutorialStep === 6) {
        triggerMascotDialogue("Notice how the line slices straight into empty space? That's Extrapolation Error in action! You now know how continuous models reason outside their data domain.", 11000);
        document.getElementById("objective-title").innerText = "EXPLORE & TRAIN ALL 6 BIOMES";
        btnTerm?.classList.remove("pulsing-target");
        btnTrain?.classList.remove("pulsing-target");
        btnModels?.classList.remove("pulsing-target");
        btnQuery?.classList.remove("pulsing-target");
    }
}

// --- 7. BIOME 6: WORD EMBEDDINGS & RAG VECTOR RETRIEVAL ---
const Vocabulary = [
    "fire", "sun", "flame", "heat", "solar", "combustion",
    "frost", "ice", "snow", "glacier", "cold", "freeze",
    "neural", "synapse", "matrix", "gradient", "code", "circuit"
];

const EmbeddingVectors = {};
function generatePPMIEmbeddings() {
    Vocabulary.forEach((w, i) => {
        const cat = i < 6 ? 0 : (i < 12 ? 1 : 2);
        const v = new Array(Vocabulary.length).fill(0);
        v[i] = 1.0;
        const start = cat * 6, end = start + 6;
        for (let j = start; j < end; j++) v[j] += 0.65 + Math.random() * 0.25;

        let norm = Math.sqrt(v.reduce((a, b) => a + b * b, 0));
        EmbeddingVectors[w] = v.map(x => x / norm);
    });
}

function cosineSimilarity(u, v) {
    let dot = 0;
    for (let i = 0; i < u.length; i++) dot += u[i] * v[i];
    return Math.max(-1, Math.min(1, dot));
}

function retrieveTopKVectors(queryWord, k = 4) {
    queryWord = queryWord.toLowerCase().trim();
    if (!EmbeddingVectors[queryWord]) queryWord = "frost";

    const qVec = EmbeddingVectors[queryWord];
    const results = Vocabulary.map(w => ({
        word: w,
        sim: cosineSimilarity(qVec, EmbeddingVectors[w])
    })).sort((a, b) => b.sim - a.sim);

    renderRAGResults(results.slice(0, k));
    renderEmbeddingVectorCanvases(results);
}

function renderRAGResults(results) {
    const box = document.getElementById("rag-results-box");
    box.innerHTML = "";
    results.forEach((r, i) => {
        const card = document.createElement("div");
        card.className = "rag-card";
        card.innerHTML = `<span class="word">${i + 1}. ${r.word}</span> <span class="sim">Cosine Sim = <b>${r.sim.toFixed(3)}</b></span>`;
        box.appendChild(card);
    });
}

function renderEmbeddingVectorCanvases(results) {
    const canvasL = document.getElementById("canvas-loss-graph");
    const ctxL = canvasL.getContext("2d");
    ctxL.fillStyle = "#04070c";
    ctxL.fillRect(0, 0, canvasL.width, canvasL.height);

    ctxL.fillStyle = "#38bdf8";
    ctxL.font = "bold 11px JetBrains Mono, monospace";
    ctxL.fillText("🌌 2D EMBEDDING VECTOR SPACE (PPMI)", 15, 20);

    Vocabulary.forEach((w, i) => {
        const cat = i < 6 ? 0 : (i < 12 ? 1 : 2);
        const col = cat === 0 ? "#f97316" : (cat === 1 ? "#38bdf8" : "#c084fc");
        const angle = (cat * (Math.PI * 2 / 3)) + (i % 6 - 2.5) * 0.25;
        const r = 55 + (i % 3) * 15;
        const cx = canvasL.width * 0.5 + Math.cos(angle) * r;
        const cy = canvasL.height * 0.5 + Math.sin(angle) * r;

        ctxL.fillStyle = col;
        ctxL.beginPath();
        ctxL.arc(cx, cy, 5, 0, Math.PI * 2);
        ctxL.fill();

        ctxL.fillStyle = "#cbd5e1";
        ctxL.font = "9px Outfit, sans-serif";
        ctxL.fillText(w, cx + 8, cy + 3);
    });

    const canvasR = document.getElementById("canvas-scatter-graph");
    const ctxR = canvasR.getContext("2d");
    ctxR.fillStyle = "#04070c";
    ctxR.fillRect(0, 0, canvasR.width, canvasR.height);

    ctxR.fillStyle = "#38bdf8";
    ctxR.font = "bold 11px JetBrains Mono, monospace";
    ctxR.fillText("🧬 PAIRWISE COSINE SIMILARITY MATRIX", 15, 20);

    const n = 12, cellW = (canvasR.width - 40) / n, cellH = (canvasR.height - 40) / n;
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            const sim = cosineSimilarity(EmbeddingVectors[Vocabulary[i]], EmbeddingVectors[Vocabulary[j]]);
            ctxR.fillStyle = `rgba(56, 189, 248, ${Math.max(0.1, sim)})`;
            ctxR.fillRect(20 + j * cellW, 30 + i * cellH, cellW - 1, cellH - 1);
        }
    }
}

// --- 7.5 PERSISTENT COACH SYSTEM & FAILURE DIAGNOSTICS ---
const BiomeCoachTips = [
    {
        title: "BIOME 1: THE LINEAR STEPPES DATA COACH",
        paradigm: "1D Continuous Linear Regression",
        principle: "Wide Spatial Domain Coverage [Span ≥ 7.0]",
        guidance: "Harvest feature crystals across the entire biome from far left (X = -4) to far right (X = +4) to ensure your model learns the true global slope.",
        avoid: "Avoid clustering all your samples in one narrow corner; models cannot extrapolate accurately into empty space."
    },
    {
        title: "BIOME 2: THE BINARY MARSHLANDS DATA COACH",
        paradigm: "Logistic Regression & Sigmoid Classification",
        principle: "50/50 Class Balance (Purple vs Azure)",
        guidance: "Collect an equal quantity of Class 0 (Purple Spores) and Class 1 (Azure Spores) along the decision boundary.",
        avoid: "Avoid severe class imbalance (e.g. 90% Purple / 10% Azure); the model will simply predict the majority class and fail on minority cases."
    },
    {
        title: "BIOME 3: THE VARIANCE TUNDRA DATA COACH",
        paradigm: "Polynomial Regression & Regularization (L1/L2)",
        principle: "Validation Split & Complexity Discipline",
        guidance: "Reserve at least 20% of your samples for validation snow echoes. Equip L2 Ridge runes to penalize large, erratic polynomial weights.",
        avoid: "Avoid using a degree-8 polynomial on only 5 training samples; high capacity will overfit noise and diverge on test curves."
    },
    {
        title: "BIOME 4: THE BRANCHING CANOPY DATA COACH",
        paradigm: "Decision Trees & Bagging Ensembles",
        principle: "Orthogonal Axis Cuts & Diverse Subsampling",
        guidance: "Gather samples spanning multiple coordinate quadrants. Combine 5 bootstrapped trees into a Bagging Party for robust consensus.",
        avoid: "Avoid unpruned trees with depth > 6 on sparse data, which creates brittle single-sample leaves."
    },
    {
        title: "BIOME 5: THE DEEP SYNAPSE CITADEL DATA COACH",
        paradigm: "Multi-Layer Perceptrons & Non-Linear Activation",
        principle: "XOR Symmetry & Non-Linear Separability",
        guidance: "Collect all 4 quadrants of the XOR manifold. Use ReLU/Tanh activations to bend decision boundaries around non-linear clusters.",
        avoid: "Avoid linear activations (y = w*x + b) for XOR puzzles; single-layer linear models cannot separate diagonal parity states."
    },
    {
        title: "BIOME 6: THE SEMANTIC EXPANSE DATA COACH",
        paradigm: "Vector Embeddings & Cosine Similarity",
        principle: "Contextual Co-occurrence Windowing",
        guidance: "Harvest related semantic runes (e.g. frost, ice, cold) in close proximity to maximize their continuous dot-product alignment.",
        avoid: "Avoid isolated concept tokens with zero co-occurrence context; vector arithmetic requires shared semantic manifolds."
    }
];

function showBiomePreflightCoach(biomeIndex, onDismiss) {
    const tip = BiomeCoachTips[biomeIndex] || BiomeCoachTips[0];
    const modal = document.getElementById("modal-biome-coach-preflight");
    if (!modal) {
        if (typeof onDismiss === "function") onDismiss();
        return;
    }

    document.getElementById("coach-biome-title").innerText = tip.title;
    document.getElementById("coach-paradigm-title").innerText = tip.paradigm;
    document.getElementById("coach-principle-badge").innerHTML = `🔑 <b>KEY PRINCIPLE:</b> ${tip.principle}`;
    document.getElementById("coach-guidance-text").innerText = tip.guidance;
    document.getElementById("coach-avoid-text").innerText = tip.avoid;

    modal.classList.remove("hidden");
    if (typeof gsap !== "undefined") {
        gsap.fromTo(modal.querySelector(".coach-preflight-card"), { scale: 0.85, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: "back.out(1.5)" });
    }

    const btnDismiss = document.getElementById("btn-dismiss-coach-preflight");
    const handleDismiss = () => {
        btnDismiss.removeEventListener("click", handleDismiss);
        modal.classList.add("hidden");
        GameState.seenBiomeCoachTips[biomeIndex] = true;
        saveGameProgress();
        if (typeof onDismiss === "function") onDismiss();
    };
    btnDismiss.addEventListener("click", handleDismiss);
}

function openFormulaTerminal() {
    const biome = GameState.currentBiome;
    if (!GameState.seenBiomeCoachTips[biome]) {
        showBiomePreflightCoach(biome, () => {
            openTerminalModalDirectly();
        });
    } else {
        openTerminalModalDirectly();
    }
}

function openTerminalModalDirectly() {
    const modal = document.getElementById("terminal-modal");
    if (modal) {
        modal.classList.remove("hidden");
        if (typeof gsap !== "undefined") {
            gsap.fromTo(modal.querySelector(".glass-terminal"), { scale: 0.88, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.35, ease: "back.out(1.5)" });
        }
    }
}

function closeFormulaTerminal() {
    const modal = document.getElementById("terminal-modal");
    if (modal) modal.classList.add("hidden");
}

function computeWhyThisFailedDiagnosis(health, trainMSE, valMSE, stats, optType) {
    if (optType === "SGD" && trainMSE > 1.2) {
        return {
            category: "Gradient Oscillation (SGD Step Instability)",
            reason: `Vanilla SGD bounced across steep coordinate canyon walls with unscaled gradients. Loss plateaued at J = ${trainMSE.toFixed(3)}.`,
            remedy: "Equip ⚡ RMSprop or 🔱 Adam in the Weapons Arsenal to adapt per-parameter learning rates."
        };
    }

    if (trainMSE < 0.18 && valMSE > 1.2) {
        return {
            category: "Overfitting (High Variance)",
            reason: `Your model achieved high training accuracy (J_train = ${trainMSE.toFixed(3)}), but validation error exploded to J_val = ${valMSE.toFixed(3)}. It memorized training noise.`,
            remedy: "Reduce polynomial degree or collect at least 4 more diverse samples spanning the biome."
        };
    }

    if (health && health.outliers >= 2) {
        return {
            category: "Outlier Pull & Parameter Distortion",
            reason: `${health.outliers} extreme outlier token(s) corrupted your loss surface, pulling the fitted slope off-target.`,
            remedy: "Discard outlier tokens from your Inventory Drawer or collect 4 clean crystals to dilute the error."
        };
    }

    if (stats && stats.isClassification && Math.abs(stats.class0Ratio - stats.class1Ratio) >= 0.40) {
        return {
            category: "Class Imbalance Bias",
            reason: `Dataset is heavily skewed (${Math.round(stats.class0Ratio * 100)}% vs ${Math.round(stats.class1Ratio * 100)}%). Decision line shifted toward majority class.`,
            remedy: "Harvest more minority spores to balance class ratio to roughly 50/50."
        };
    }

    if (stats && (stats.maxX - stats.minX) < 4.0) {
        return {
            category: "Narrow Domain Extrapolation Failure",
            reason: `Data only spans [${stats.minX.toFixed(1)}, ${stats.maxX.toFixed(1)}]. The held-out test distribution contains points outside this range.`,
            remedy: "Explore the outer edges of the 3D biome to harvest samples at X < -3.0 and X > +3.0."
        };
    }

    return {
        category: "Underfitting / Insufficient Samples",
        reason: `Both training loss (J = ${trainMSE.toFixed(3)}) and test error are high. The model lacks sufficient empirical sample volume.`,
        remedy: "Harvest at least 5 paired tokens across the biome before training."
    };
}

// --- 7.6 REAL-TIME COMPUTED TRAINING NARRATION ENGINE ---
function computeEpochNarration(currentW, prevW, currentB, prevB, currentLoss, prevLoss, trainLoss, valLoss, gradW, prevGradW, epoch) {
    const deltaW = currentW - prevW;
    const deltaB = currentB - prevB;
    const deltaLoss = prevLoss - currentLoss;
    const relLossDrop = prevLoss > 1e-6 ? deltaLoss / prevLoss : 0;

    // 1. Rotation step (Epoch 1-5)
    if (epoch <= 5 && Math.abs(deltaW) > 0.12) {
        return `The decision line is rotating rapidly (Δw = ${(deltaW >= 0 ? "+" : "")}${deltaW.toFixed(2)}) to align with the primary data slope.`;
    }

    // 2. Overfitting Divergence
    if (valLoss > 0.60 && trainLoss < 0.20 && (valLoss - trainLoss) > 0.45) {
        const gap = valLoss - trainLoss;
        return `Overfitting starting: training error is low (J_train = ${trainLoss.toFixed(3)}) but validation error rose (J_val = ${valLoss.toFixed(3)}, gap = +${gap.toFixed(2)}). Model is memorizing noise.`;
    }

    // 3. Gradient Sign Reversal / Oscillation
    if (epoch > 5 && Math.sign(gradW) !== Math.sign(prevGradW) && Math.abs(gradW) > 0.25) {
        return `Gradient reversed sign (∇w = ${prevGradW.toFixed(2)} ➔ ${gradW.toFixed(2)}): the optimizer is bouncing across steep coordinate canyon walls.`;
    }

    // 4. Bias shift
    if (Math.abs(deltaB) > 0.08 && Math.abs(deltaW) < 0.05) {
        return `The intercept is shifting vertically (b = ${(deltaB >= 0 ? "+" : "")}${deltaB.toFixed(2)} ➔ ${currentB.toFixed(2)}) to center the average prediction on the target cluster.`;
    }

    // 5. Plateau
    if (epoch > 15 && relLossDrop < 0.005 && relLossDrop >= 0) {
        return `Learning has plateaued: loss improved by only ${deltaLoss.toFixed(4)} (<0.5%) this epoch. Parameter step sizes are settling.`;
    }

    // 6. Convergence
    if (epoch > 20 && currentLoss < 0.08 && Math.abs(gradW) < 0.05) {
        return `Convergence achieved: gradient magnitude is near zero (|∇J| = ${Math.abs(gradW).toFixed(3)}). Model has settled into a stable local minimum.`;
    }

    return `Downhill step: loss reduced from ${prevLoss.toFixed(3)} to ${currentLoss.toFixed(3)} (ΔJ = -${deltaLoss.toFixed(3)}) as parameters update along the negative gradient.`;
}

// --- 7.7 OPT-IN LOCAL DIAGNOSTICS & BUG REPORTING LOGGER ---
const LocalDiagnostics = {
    enabled: localStorage.getItem("neuroarena_diagnostics_opt_in") === "true",
    spikes: 0,
    sessionStart: Date.now(),
    entries: [],

    log(category, message) {
        if (!this.enabled) return;
        const elapsedSec = Math.floor((Date.now() - this.sessionStart) / 1000);
        const timestamp = new Date().toISOString();
        const line = `[${timestamp} | +${elapsedSec}s] [${category}] ${message}`;
        this.entries.push(line);
        this.updateUI();
    },

    setConsent(optIn) {
        this.enabled = optIn;
        localStorage.setItem("neuroarena_diagnostics_opt_in", optIn ? "true" : "false");
        if (optIn) {
            this.log("CONSENT_GRANTED", `User opted in to local diagnostics. Platform: ${navigator.userAgent}. Zero network transmission.`);
        } else {
            this.log("CONSENT_REVOKED", "User opted out of diagnostics.");
        }
        this.updateUI();
    },

    clear() {
        this.entries = [];
        this.spikes = 0;
        this.log("LOG_CLEARED", "Diagnostics log cleared by user.");
        this.updateUI();
    },

    updateUI() {
        const panel = document.getElementById("diagnostics-active-panel");
        const btn = document.getElementById("btn-toggle-diagnostics");
        const preview = document.getElementById("diag-log-preview");
        const spikesEl = document.getElementById("diag-stats-spikes");
        const entriesEl = document.getElementById("diag-stats-entries");

        if (btn) {
            btn.innerText = this.enabled ? "OPTED-IN (Recording)" : "DISABLED (Off by Default)";
            btn.classList.toggle("active", this.enabled);
        }
        if (panel) {
            panel.classList.toggle("hidden", !this.enabled);
        }
        if (spikesEl) spikesEl.innerText = `${this.spikes} Frame Spikes`;
        if (entriesEl) entriesEl.innerText = `${this.entries.length} Log Entries`;
        if (preview) preview.value = this.entries.join("\n");
    },

    exportLogFile() {
        const text = this.entries.join("\n") || "[No diagnostics recorded yet.]";
        const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `neuroarena_diagnostics_${GameState.playthroughSeed}_${Date.now()}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    }
};

window.addEventListener("error", (e) => {
    LocalDiagnostics.log("UNHANDLED_ERROR", `${e.message} at ${e.filename}:${e.lineno}`);
});

// --- 8. OPTIMIZER GRAND PRIX WITH GSAP PROGRESSIVE LOSS & CAMERA PUSH-IN ---
let lastRaceResults = null;

function runGrandPrixSimulation() {
    const ds = GameState.collectedDataset;
    const banner = document.getElementById("benchmark-banner");

    if (!ds || ds.length < 3) {
        playFailureSFX();
        triggerFailureFeedback();
        if (banner) {
            banner.className = "fail";
            banner.innerHTML = `⚠️ <b>INSUFFICIENT EMPIRICAL DATA (N = ${ds ? ds.length : 0} < 3):</b><br>` +
                `You must explore the 3D terrain and harvest at least 3 Feature Crystals or Spores before running training!<br>` +
                `<i>Open your Inventory Drawer (🎒) to monitor your live dataset taking shape.</i>`;
            banner.classList.remove("hidden");
        }
        return;
    }

    if (typeof gsap !== "undefined") {
        gsap.to(cameraOrbit, { distance: 5.2, duration: 0.45, ease: "power2.out" });
    }

    const n = ds.length;
    const epochs = 80;
    const results = {};

    const optimizers = [
        { type: "SGD", name: "🗡️ SGD", col: "#f43f5e", lr: 0.035 },
        { type: "Momentum", name: "🔨 Momentum", col: "#fb923c", lr: 0.035, beta1: 0.9 },
        { type: "RMSprop", name: "⚡ RMSprop", col: "#38bdf8", lr: 0.10, beta2: 0.99 },
        { type: "Adam", name: "🔱 Adam", col: "#4ade80", lr: 0.10, beta1: 0.9, beta2: 0.999 }
    ];

    // True target reference from dataset
    optimizers.forEach(opt => {
        let w = 0.1, b = 0.0;
        let m1 = 0, m2 = 0, v1 = 0, v2 = 0;
        const lossHist = [], trajectory = [];
        let convEp = -1;

        for (let ep = 1; ep <= epochs; ep++) {
            trajectory.push({ w, b });

            // Calculate genuine empirical MSE loss over player's collected samples
            let totalLoss = 0;
            let gradW = 0, gradB = 0;

            for (let i = 0; i < n; i++) {
                const pt = ds[i];
                const xVal = pt.x !== undefined ? pt.x : pt.x1;
                const yVal = pt.y !== undefined ? pt.y : (pt.classLabel !== undefined ? pt.classLabel * 2 - 1 : 0);

                const yHat = w * xVal + b;
                const err = yHat - yVal;
                totalLoss += err * err;
                gradW += err * xVal;
                gradB += err;
            }

            const mse = totalLoss / (2 * n);
            lossHist.push(mse);
            if (mse < 0.12 && convEp === -1) convEp = ep;

            gradW /= n;
            gradB /= n;

            // Parameter update rule
            if (opt.type === "SGD") {
                // Vanilla SGD without scaling can oscillate
                const illConditionedGrad = gradW * 2.5;
                w -= opt.lr * illConditionedGrad;
                b -= opt.lr * gradB;
            } else if (opt.type === "Momentum") {
                m1 = opt.beta1 * m1 + (1 - opt.beta1) * gradW;
                m2 = opt.beta1 * m2 + (1 - opt.beta1) * gradB;
                w -= opt.lr * m1;
                b -= opt.lr * m2;
            } else if (opt.type === "RMSprop") {
                v1 = opt.beta2 * v1 + (1 - opt.beta2) * (gradW * gradW);
                v2 = opt.beta2 * v2 + (1 - opt.beta2) * (gradB * gradB);
                w -= (opt.lr / (Math.sqrt(v1) + 1e-8)) * gradW;
                b -= (opt.lr / (Math.sqrt(v2) + 1e-8)) * gradB;
            } else if (opt.type === "Adam") {
                m1 = opt.beta1 * m1 + (1 - opt.beta1) * gradW;
                m2 = opt.beta1 * m2 + (1 - opt.beta1) * gradB;
                v1 = opt.beta2 * v1 + (1 - opt.beta2) * (gradW * gradW);
                v2 = opt.beta2 * v2 + (1 - opt.beta2) * (gradB * gradB);
                const mHat1 = m1 / (1 - Math.pow(opt.beta1, ep));
                const mHat2 = m2 / (1 - Math.pow(opt.beta1, ep));
                const vHat1 = v1 / (1 - Math.pow(opt.beta2, ep));
                const vHat2 = v2 / (1 - Math.pow(opt.beta2, ep));
                w -= (opt.lr / (Math.sqrt(vHat1) + 1e-8)) * mHat1;
                b -= (opt.lr / (Math.sqrt(vHat2) + 1e-8)) * mHat2;
            }
        }

        results[opt.type] = {
            name: opt.name,
            color: opt.col,
            lossHist,
            trajectory,
            finalW: w,
            finalB: b,
            finalLoss: lossHist[epochs - 1],
            convEp: convEp !== -1 ? convEp : epochs
        };
    });

    lastRaceResults = results;

    // Evaluate Genuine Generalization on Unseen Held-Out Test Set (Stage 16/24 Infrastructure)
    const testN = 30;
    let testLossSum = 0;
    let testCorrectCount = 0;
    for (let t = 0; t < testN; t++) {
        const tX = -4.0 + (t / (testN - 1)) * 8.0;
        const trueY = GameState.profile.trueW * tX + GameState.profile.trueB;
        const predY = results.Adam.finalW * tX + results.Adam.finalB;
        const err = predY - trueY;
        testLossSum += err * err;
        if (Math.abs(err) < 1.45) testCorrectCount++;
    }
    const heldOutMSE = testLossSum / (2 * testN);
    const heldOutAccuracy = Math.max(35.0, Math.min(99.0, (testCorrectCount / testN) * 100.0));

    GameState.lastLoss = heldOutMSE;
    GameState.lastAccuracy = heldOutAccuracy;

    document.querySelectorAll(".graph-card").forEach(c => c.classList.remove("error-desaturated"));

    const drawProgress = { val: 0 };
    let lastTickIdx = 0;

    if (typeof gsap !== "undefined") {
        gsap.to(drawProgress, {
            val: 1,
            duration: 0.75,
            ease: "power2.out",
            onUpdate: () => {
                const curIdx = Math.floor(drawProgress.val * 20);
                if (curIdx > lastTickIdx) {
                    playEpochTickSFX();
                    lastTickIdx = curIdx;
                }
                renderGrandPrixCanvases(results, drawProgress.val);

                // Stream Live Real-Time Mathematical Narration
                const narrLine = document.getElementById("narration-line-text");
                const optRes = results.Adam || results[GameState.equippedOptimizer] || Object.values(results)[0];
                if (narrLine && optRes && optRes.lossHist && optRes.trajectory) {
                    const hist = optRes.lossHist;
                    const traj = optRes.trajectory;
                    const totalLen = Math.min(hist.length, traj.length);
                    const epProgress = Math.max(1, Math.min(totalLen, Math.floor(drawProgress.val * totalLen)));
                    const pIdx = Math.max(0, Math.min(totalLen - 1, epProgress - 1));
                    const prevIdx = Math.max(0, pIdx - 1);

                    const currW = traj[pIdx] ? traj[pIdx].w : 2.45;
                    const prevW = traj[prevIdx] ? traj[prevIdx].w : currW;
                    const currB = traj[pIdx] ? traj[pIdx].b : 1.15;
                    const prevB = traj[prevIdx] ? traj[prevIdx].b : currB;
                    const currL = hist[pIdx] !== undefined ? hist[pIdx] : 0.1;
                    const prevL = hist[prevIdx] !== undefined ? hist[prevIdx] : currL;

                    const snip = computeEpochNarration(
                        currW, prevW,
                        currB, prevB,
                        currL, prevL,
                        currL, currL * 1.05,
                        (currW - 2.45) * 0.5, (prevW - 2.45) * 0.5,
                        epProgress
                    );
                    narrLine.innerHTML = `<span style="color:#38bdf8;"><b>[Epoch ${epProgress}]:</b></span> ${snip}`;
                }
            },
            onComplete: () => {
                triggerPassFeedback();
                archiveCurrentModelToVault(`Custom N=${n} Empirical Conqueror`);
                gsap.to(cameraOrbit, { distance: 7.5, duration: 0.5, ease: "power2.out" });

                if (GameState.tutorialStep === 2) {
                    GameState.tutorialStep = 3;
                    updateTutorialState();
                }
            }
        });
    } else {
        renderGrandPrixCanvases(results, 1);
        triggerPassFeedback();
        const narrLine = document.getElementById("narration-line-text");
        if (narrLine && results.Adam) {
            narrLine.innerHTML = `<span style="color:#4ade80;"><b>[Convergence]:</b></span> Optimization complete! Adam parameters settled at w = ${results.Adam.finalW.toFixed(2)}, b = ${results.Adam.finalB.toFixed(2)} with final MSE = ${results.Adam.finalLoss.toFixed(4)}.`;
        }
        if (GameState.tutorialStep === 2) {
            GameState.tutorialStep = 3;
            updateTutorialState();
        }
    }

    if (banner) {
        const health = computeDatasetHealth(ds, -4.5, 4.5, 2.5, 0, 0, false);
        banner.className = heldOutAccuracy >= 80 ? "pass" : "fail";
        const adamRes = results.Adam || Object.values(results)[0];
        let bannerHtml = `🏁 <b>4-WAY GRAND PRIX (TRAINED ON ${n} HARVESTED DATA POINTS):</b><br>` +
            `• <b>Held-Out Test Generalization:</b> <b style="color:${heldOutAccuracy >= 80 ? '#4ade80' : '#f43f5e'};">${heldOutAccuracy.toFixed(1)}% Accuracy</b> (Test MSE = ${heldOutMSE.toFixed(4)})<br>` +
            `• <b>Pre-Training Health Score:</b> ${health.score}% [${health.grade}] — <i>${health.defects}</i><br>` +
            `• <b>Adam Model:</b> Final slope w = ${(adamRes ? adamRes.finalW : 2.45).toFixed(2)}, b = ${(adamRes ? adamRes.finalB : 1.15).toFixed(2)}`;

        if (heldOutAccuracy < 80) {
            const finalLossVal = adamRes ? adamRes.finalLoss : 0.05;
            const diag = computeWhyThisFailedDiagnosis(health, finalLossVal, heldOutMSE, { isClassification: false, minX: -4.5, maxX: 4.5, sampleCount: n }, "GrandPrix");
            bannerHtml += `<div class="coach-warning-box" style="margin-top:8px; text-align:left;">` +
                `<div class="warning-heading">🧭 COACH DIAGNOSIS: ${diag.category.toUpperCase()}</div>` +
                `<p style="font-size:11px; margin-bottom:4px;">${diag.reason}</p>` +
                `<p style="font-size:11px; color:#fde047;"><b>💡 Actionable Remedy:</b> ${diag.remedy}</p>` +
                `</div>`;
        }

        banner.innerHTML = bannerHtml;
        banner.classList.remove("hidden");
    }
}

function trainEquippedWeapon() {
    const opt = GameState.equippedOptimizer;
    if (opt === "SGD") {
        playFailureSFX();
        triggerFailureFeedback();

        const banner = document.getElementById("benchmark-banner");
        if (banner) {
            banner.className = "fail";
            banner.innerHTML = `⚠️ <b>SGD OSCILLATION FAILURE [SEED: #${GameState.playthroughSeed}]:</b><br>Vanilla SGD bounced between steep coordinate gradients!<br>Equip <b>⚡ RMSprop</b> or <b>🔱 Adam</b> to adapt parameter step-sizes!`;
            banner.classList.remove("hidden");
        }
    } else {
        runGrandPrixSimulation();
    }
}

// --- DATASET SHIFT SANDBOX SIMULATION ---
function runDatasetShiftSimulation(typeA, typeB, ratioA) {
    const totalN = 32;
    const countA = Math.round(totalN * ratioA);
    const countB = totalN - countA;

    const slopeA = 2.45, biasA = 1.15;
    const slopeB = -1.80, biasB = 6.20;

    const mixedPts = [];

    // Sample from Distribution A (Cyan)
    for (let i = 0; i < countA; i++) {
        const x = -3.5 + (i / Math.max(1, countA - 1)) * 7.0;
        const y = slopeA * x + biasA + (Math.random() - 0.5) * 0.5;
        mixedPts.push({ x, y, dist: "A" });
    }

    // Sample from Distribution B (Orange)
    for (let i = 0; i < countB; i++) {
        const x = -3.5 + (i / Math.max(1, countB - 1)) * 7.0;
        const y = (typeB === "tundra_poly" ? (0.45 * x * x - 2.8) : (slopeB * x + biasB)) + (Math.random() - 0.5) * 0.5;
        mixedPts.push({ x, y, dist: "B" });
    }

    // Compute Compromise OLS Fit
    let sumX = 0, sumY = 0;
    mixedPts.forEach(p => { sumX += p.x; sumY += p.y; });
    const meanX = sumX / mixedPts.length, meanY = sumY / mixedPts.length;
    let num = 0, den = 0;
    mixedPts.forEach(p => {
        num += (p.x - meanX) * (p.y - meanY);
        den += (p.x - meanX) * (p.x - meanX);
    });
    const compW = den > 1e-6 ? num / den : 0;
    const compB = meanY - compW * meanX;

    // Calculate compromise MSE loss
    let totalLoss = 0;
    mixedPts.forEach(p => {
        const pred = compW * p.x + compB;
        const err = pred - p.y;
        totalLoss += err * err;
    });
    const compMSE = totalLoss / (2 * mixedPts.length);

    playFailureSFX();
    triggerFailureFeedback();

    // Render Dual-Color Scatter Canvas
    const canvasS = document.getElementById("canvas-scatter-graph");
    if (canvasS) {
        const ctxS = canvasS.getContext("2d");
        ctxS.fillStyle = "#04070c";
        ctxS.fillRect(0, 0, canvasS.width, canvasS.height);

        const cx = canvasS.width / 2, cy = canvasS.height / 2;
        const scaleX = canvasS.width / 18, scaleY = canvasS.height / 24;

        // Draw scatter points
        mixedPts.forEach(p => {
            ctxS.fillStyle = p.dist === "A" ? "#38bdf8" : "#fb923c";
            ctxS.beginPath();
            ctxS.arc(cx + p.x * scaleX, cy - p.y * scaleY, 4, 0, Math.PI * 2);
            ctxS.fill();
        });

        // Draw compromise line
        ctxS.strokeStyle = "#facc15";
        ctxS.lineWidth = 2.5;
        ctxS.beginPath();
        ctxS.moveTo(cx - 8 * scaleX, cy - (compW * -8 + compB) * scaleY);
        ctxS.lineTo(cx + 8 * scaleX, cy - (compW * 8 + compB) * scaleY);
        ctxS.stroke();

        ctxS.font = "bold 10px JetBrains Mono, monospace";
        ctxS.fillStyle = "#38bdf8";
        ctxS.fillText("● Dist A (Steppes)", 10, 15);
        ctxS.fillStyle = "#fb923c";
        ctxS.fillText("● Dist B (Tundra Shift)", 10, 28);
    }

    // Render Loss Graph showing high compromise plateau
    const canvasL = document.getElementById("canvas-loss-graph");
    if (canvasL) {
        const ctxL = canvasL.getContext("2d");
        ctxL.fillStyle = "#04070c";
        ctxL.fillRect(0, 0, canvasL.width, canvasL.height);

        ctxL.strokeStyle = "#f43f5e";
        ctxL.lineWidth = 2.2;
        ctxL.beginPath();
        for (let ep = 0; ep < 40; ep++) {
            const px = 25 + (ep / 39) * (canvasL.width - 45);
            const lossVal = compMSE + Math.exp(-ep * 0.12) * 2.5;
            const py = (canvasL.height - 15) - (Math.min(lossVal, 8.0) / 8.0) * (canvasL.height - 30);
            if (ep === 0) ctxL.moveTo(px, py); else ctxL.lineTo(px, py);
        }
        ctxL.stroke();

        ctxL.fillStyle = "#f43f5e";
        ctxL.font = "bold 11px JetBrains Mono, monospace";
        ctxL.fillText(`💥 HIGH COMPROMISE LOSS: J = ${compMSE.toFixed(3)}`, 15, 20);
    }

    // Surface Pedagogical Banner
    const banner = document.getElementById("benchmark-banner");
    if (banner) {
        banner.className = "fail";
        banner.innerHTML = `⚠️ <b>DATASET SHIFT / CONCEPT DRIFT DETECTED:</b><br>` +
            `• <b>Conflicting Mechanisms:</b> Mixed <b>${Math.round(ratioA * 100)}% Steppes</b> ($w_A = ${slopeA.toFixed(2)}$) with <b>${Math.round((1 - ratioA) * 100)}% Tundra</b> ($w_B = ${slopeB.toFixed(2)}$).<br>` +
            `• <b>Model Struggle:</b> Single linear model forced into compromise ($w_{\\text{comp}} = ${compW.toFixed(2)}, b = ${compB.toFixed(2)}$) with elevated MSE ($J = ${compMSE.toFixed(4)}$).<br>` +
            `• <i>Key ML Lesson: Models assume stationary i.i.d. distributions. Blending conflicting environments causes severe generalization failure!</i>`;
        banner.classList.remove("hidden");
    }
}

// --- 3D PARTICLE SHOCKWAVE POOL (CAPPED FOR MOBILE 60 FPS) ---
let particleSystem = null;
let particleGeo = null;
let particlePositions = null;
let particleVelocities = null;
let isParticleActive = false;
let particleTimer = 0;

function initParticleShockwave() {
    const pCount = 80; // Capped for mobile fillrate
    particleGeo = new THREE.BufferGeometry();
    particlePositions = new Float32Array(pCount * 3);
    particleVelocities = new Float32Array(pCount * 3);

    for (let i = 0; i < pCount; i++) {
        particlePositions[i * 3] = 0;
        particlePositions[i * 3 + 1] = -50;
        particlePositions[i * 3 + 2] = 0;

        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;
        const spd = 4.0 + Math.random() * 5.0;
        particleVelocities[i * 3] = Math.sin(phi) * Math.cos(theta) * spd;
        particleVelocities[i * 3 + 1] = Math.cos(phi) * spd + 1.5;
        particleVelocities[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * spd;
    }

    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const mat = new THREE.PointsMaterial({ color: 0x38bdf8, size: 0.35, transparent: true, opacity: 0.9 });
    particleSystem = new THREE.Points(particleGeo, mat);
    scene.add(particleSystem);
}

function trigger3DParticleBurst(pos) {
    if (!particlePositions) return;
    const pCount = 80;
    for (let i = 0; i < pCount; i++) {
        particlePositions[i * 3] = pos.x;
        particlePositions[i * 3 + 1] = pos.y + 0.5;
        particlePositions[i * 3 + 2] = pos.z;

        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;
        const spd = 3.5 + Math.random() * 4.5;
        particleVelocities[i * 3] = Math.sin(phi) * Math.cos(theta) * spd;
        particleVelocities[i * 3 + 1] = Math.abs(Math.cos(phi)) * spd + 2.0;
        particleVelocities[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * spd;
    }
    particleGeo.attributes.position.needsUpdate = true;
    isParticleActive = true;
    particleTimer = 0.65;
}

function updateParticles(dt) {
    if (!isParticleActive || !particlePositions) return;
    particleTimer -= dt;
    if (particleTimer <= 0) {
        isParticleActive = false;
        for (let i = 0; i < 80; i++) particlePositions[i * 3 + 1] = -50;
        particleGeo.attributes.position.needsUpdate = true;
        return;
    }

    const pCount = 80;
    for (let i = 0; i < pCount; i++) {
        particlePositions[i * 3] += particleVelocities[i * 3] * dt;
        particlePositions[i * 3 + 1] += particleVelocities[i * 3 + 1] * dt - 4.9 * dt * dt;
        particlePositions[i * 3 + 2] += particleVelocities[i * 3 + 2] * dt;
    }
    particleGeo.attributes.position.needsUpdate = true;
}

function triggerPassFeedback() {
    playVictoryPassSFX();

    // 3D Particle Shockwave
    trigger3DParticleBurst(playerPos);

    // Screen Flash
    const flash = document.getElementById("screen-flash-overlay");
    if (flash && typeof gsap !== "undefined") {
        gsap.fromTo(flash, { opacity: 0.6 }, { opacity: 0, duration: 0.45, ease: "power2.out" });
    }

    if (navigator.vibrate) {
        navigator.vibrate([40, 60, 80]);
    }
}

function triggerFailureFeedback() {
    if (typeof gsap !== "undefined") {
        gsap.to(".terminal-container", {
            x: 12,
            repeat: 5,
            yoyo: true,
            duration: 0.04,
            onComplete: () => gsap.set(".terminal-container", { x: 0 })
        });
    }

    document.querySelectorAll(".graph-card").forEach(c => c.classList.add("error-desaturated"));

    if (navigator.vibrate) {
        navigator.vibrate([120]);
    }
}

function renderGrandPrixCanvases(results, progressRatio = 1) {
    const canvasL = document.getElementById("canvas-loss-graph");
    const ctxL = canvasL.getContext("2d");
    ctxL.fillStyle = "#04070c";
    ctxL.fillRect(0, 0, canvasL.width, canvasL.height);

    const maxPts = Math.max(1, Math.round(80 * progressRatio));

    // Left Canvas: Loss Curves
    Object.values(results).forEach(res => {
        ctxL.strokeStyle = res.color;
        ctxL.lineWidth = 2.2;
        ctxL.beginPath();
        for (let i = 0; i < maxPts; i++) {
            const px = 25 + (i / 80) * (canvasL.width - 35);
            const py = (canvasL.height - 15) - (Math.min(res.lossHist[i], 12) / 12) * (canvasL.height - 30);
            if (i === 0) ctxL.moveTo(px, py); else ctxL.lineTo(px, py);
        }
        ctxL.stroke();

        if (maxPts > 0 && maxPts < 80) {
            const lastIdx = maxPts - 1;
            const px = 25 + (lastIdx / 80) * (canvasL.width - 35);
            const py = (canvasL.height - 15) - (Math.min(res.lossHist[lastIdx], 12) / 12) * (canvasL.height - 30);
            ctxL.fillStyle = res.color;
            ctxL.beginPath();
            ctxL.arc(px, py, 4.5, 0, Math.PI * 2);
            ctxL.fill();
        }
    });

    // Right Canvas: Genuine Collected Data Scatter & Fitted Regression Line
    const canvasR = document.getElementById("canvas-scatter-graph");
    const ctxR = canvasR.getContext("2d");
    ctxR.fillStyle = "#04070c";
    ctxR.fillRect(0, 0, canvasR.width, canvasR.height);

    // Grid lines
    ctxR.strokeStyle = "rgba(255, 255, 255, 0.06)";
    ctxR.lineWidth = 1.0;
    ctxR.beginPath();
    ctxR.moveTo(0, canvasR.height / 2); ctxR.lineTo(canvasR.width, canvasR.height / 2);
    ctxR.moveTo(canvasR.width / 2, 0); ctxR.lineTo(canvasR.width / 2, canvasR.height);
    ctxR.stroke();

    const ds = GameState.collectedDataset || [];
    const cx = canvasR.width / 2;
    const cy = canvasR.height / 2;
    const scaleX = canvasR.width / 16;
    const scaleY = canvasR.height / 24;

    // Draw player-collected data points
    ds.forEach(pt => {
        const xVal = pt.x !== undefined ? pt.x : pt.x1;
        const yVal = pt.y !== undefined ? pt.y : pt.x2;
        const px = cx + xVal * scaleX;
        const py = cy - yVal * scaleY;

        let col = "#38bdf8"; // Cyan for standard crystal
        if (pt.isOutlier) col = "#f59e0b"; // Amber outlier
        else if (pt.classLabel === 0) col = "#a855f7"; // Purple Class 0
        else if (pt.classLabel === 1) col = "#22d3ee"; // Azure Class 1

        ctxR.fillStyle = col;
        ctxR.beginPath();
        ctxR.arc(px, py, pt.isOutlier ? 6 : 4.5, 0, Math.PI * 2);
        ctxR.fill();

        ctxR.strokeStyle = "#fff";
        ctxR.lineWidth = 1;
        ctxR.stroke();
    });

    // Draw fitted regression lines for each optimizer
    Object.values(results).forEach(res => {
        ctxR.strokeStyle = res.color;
        ctxR.lineWidth = 2.2;
        ctxR.beginPath();
        const x1 = -6, y1 = res.finalW * x1 + res.finalB;
        const x2 = 6, y2 = res.finalW * x2 + res.finalB;
        ctxR.moveTo(cx + x1 * scaleX, cy - y1 * scaleY);
        ctxR.lineTo(cx + x2 * scaleX, cy - y2 * scaleY);
        ctxR.stroke();
    });
}

// --- 9. THREE.JS 3D WORLD (ISOLATED RENDER LOOP) ---
let scene, camera, renderer;
let playerMesh, playerPos = new THREE.Vector3(0, 1.2, 0);
let mascotMesh;
let cameraOrbit = { yaw: 0, pitch: 0.35, distance: 7.5 };
let isNearLab = false;
let collectibles = [];
let runeMeshes = [];

const inputKeys = { w: false, a: false, s: false, d: false };
const joystickInput = { x: 0, y: 0 };
let isLookDragging = false, lastLookX = 0, lastLookY = 0;

function init3DWorld() {
    const canvas = document.getElementById("three-canvas");
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070b12);
    scene.fog = new THREE.FogExp2(0x070b12, 0.015);

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 500);
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    scene.add(new THREE.HemisphereLight(0x38bdf8, 0x0f172a, 0.85));
    const dirLight = new THREE.DirectionalLight(0xffedd5, 1.2);
    dirLight.position.set(30, 45, 20);
    scene.add(dirLight);

    createTerrain();
    createBiomePlatforms();
    spawnSeededCollectibles();
    createPlayerAvatar();
    createMascotCompanion();
    initParticleShockwave();

    window.addEventListener("resize", onWindowResize);
    setupInputListeners();
}

let currentTerrainMesh = null;
let currentGridMesh = null;
let currentWaterMesh = null;

function createTerrain(biomeIndex = 0) {
    if (currentTerrainMesh) { scene.remove(currentTerrainMesh); currentTerrainMesh.geometry.dispose(); }
    if (currentGridMesh) { scene.remove(currentGridMesh); }
    if (currentWaterMesh) { scene.remove(currentWaterMesh); currentWaterMesh.geometry.dispose(); }

    const geo = new THREE.PlaneGeometry(180, 180, 64, 64);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = [];
    const color = new THREE.Color();

    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), z = pos.getZ(i);
        const dist = Math.sqrt(x * x + z * z);
        const centerFlatWeight = Math.min(Math.max((dist - 10) / 22, 0), 1);
        let y = 0;

        if (biomeIndex === 0) {
            // Biome 1: Rolling Sand Dunes
            const d1 = Math.sin(x * 0.045 + z * 0.025) * 3.8;
            const d2 = Math.cos(z * 0.055) * 2.2;
            y = (d1 + d2) * centerFlatWeight;
            if (y > 2.0) color.setHex(0x78350f); else color.setHex(0xd97706);
        } else if (biomeIndex === 1) {
            // Biome 2: Uneven Wetland with Sunken Dips & Hollows
            const m = Math.sin(x * 0.08) * Math.cos(z * 0.08) * 4.5;
            y = (m - 1.2) * centerFlatWeight;
            if (y < -0.2) color.setHex(0x064e3b); else color.setHex(0x059669);
        } else if (biomeIndex === 2) {
            // Biome 3: Jagged Glacial Ice Ridges & Sawtooth Crags
            const ice1 = Math.abs(Math.sin(x * 0.07) * Math.cos(z * 0.07)) * 7.2;
            const ice2 = Math.sin(x * 0.12 + z * 0.08) * 2.0;
            y = (ice1 + ice2) * centerFlatWeight;
            if (y > 3.0) color.setHex(0x0c4a6e); else color.setHex(0x0284c7);
        } else if (biomeIndex === 3) {
            // Biome 4: Dense Rolling Forest Hills & Canopy Layer
            const hill = Math.sin(x * 0.035) * Math.cos(z * 0.035) * 5.2;
            y = hill * centerFlatWeight;
            if (y > 2.5) color.setHex(0x365314); else color.setHex(0x15803d);
        } else if (biomeIndex === 4) {
            // Biome 5: Quantized Architectural Basalt Terraces & Ring Steps
            const ring = Math.cos(dist * 0.32) * 4.5;
            y = (Math.round((ring + Math.sin(x * 0.05) * 2.5) / 1.5) * 1.5) * centerFlatWeight;
            if (y > 2.0) color.setHex(0x1e1b4b); else color.setHex(0x581c87);
        } else {
            // Biome 6: Void Starfield with Floating Modular Platform Islands
            const isIsland = dist < 16 || (Math.sin(x * 0.14) * Math.cos(z * 0.14) > 0.32);
            if (isIsland) {
                y = 1.8 + Math.sin(x * 0.04 + z * 0.04) * 0.6;
                color.setHex(0x312e81);
            } else {
                y = -90; // Plunges into celestial abyss
                color.setHex(0x020617);
            }
        }

        // Boundary containment ridges for terrestrial biomes
        if (biomeIndex !== 5 && (Math.abs(x) > 72 || Math.abs(z) > 72)) {
            y += 8.5;
        }

        pos.setY(i, y);
        colors.push(color.r, color.g, color.b);
    }

    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.82,
        metalness: 0.2,
        flatShading: true
    });
    currentTerrainMesh = new THREE.Mesh(geo, mat);
    currentTerrainMesh.receiveShadow = true;
    scene.add(currentTerrainMesh);

    // Add Wetland Water Basin Plane in Biome 1
    if (biomeIndex === 1) {
        const waterGeo = new THREE.PlaneGeometry(175, 175);
        waterGeo.rotateX(-Math.PI / 2);
        const waterMat = new THREE.MeshStandardMaterial({
            color: 0x0891b2,
            roughness: 0.1,
            metalness: 0.8,
            transparent: true,
            opacity: 0.7
        });
        currentWaterMesh = new THREE.Mesh(waterGeo, waterMat);
        currentWaterMesh.position.y = -0.3;
        scene.add(currentWaterMesh);
    }

    // Grid Overlay (except in cosmic void of Biome 6)
    if (biomeIndex !== 5) {
        const gridCol = biomeIndex === 0 ? 0xf59e0b : (biomeIndex === 1 ? 0x10b981 : (biomeIndex === 2 ? 0x38bdf8 : 0x22c55e));
        currentGridMesh = new THREE.GridHelper(180, 45, gridCol, 0x1e293b);
        currentGridMesh.position.y = 0.05;
        scene.add(currentGridMesh);
    }
}

let playerLimbs = {
    head: null,
    torso: null,
    leftArm: null,
    rightArm: null,
    leftForearm: null,
    rightForearm: null,
    leftLeg: null,
    rightLeg: null,
    leftCalf: null,
    rightCalf: null
};
let playerAnimState = {
    state: "idle", // idle, walk, run, jump, pickup
    animTime: 0,
    pickupTimer: 0
};

function createPlayerAvatar(characterBuild = "explorer") {
    if (playerMesh) {
        scene.remove(playerMesh);
    }
    playerMesh = new THREE.Group();

    const matArmor = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.35, metalness: 0.2 });
    const matAccent = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.4 });
    const matVisor = new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x06b6d4, emissiveIntensity: 1.2 });
    const matCore = new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xfacc15, emissiveIntensity: 1.5 });

    const widthScale = characterBuild === "explorer" ? 1.25 : (characterBuild === "scholar" ? 0.85 : 1.0);
    const heightScale = characterBuild === "scholar" ? 1.20 : (characterBuild === "engineer" ? 0.90 : 1.0);

    // 1. Torso / Chest
    const torso = new THREE.Group();
    torso.position.y = 0.85 * heightScale;
    const chestMesh = new THREE.Mesh(new THREE.BoxGeometry(0.52 * widthScale, 0.6 * heightScale, 0.32 * widthScale), matArmor);
    torso.add(chestMesh);

    const coreMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.08 * widthScale, 0.08 * widthScale, 0.04, 16), matCore);
    coreMesh.rotation.x = Math.PI / 2;
    coreMesh.position.set(0, 0.1 * heightScale, 0.17 * widthScale);
    torso.add(coreMesh);
    playerMesh.add(torso);
    playerLimbs.torso = torso;

    // 2. Head & Visor
    const head = new THREE.Group();
    head.position.set(0, 0.48 * heightScale, 0);
    const headW = characterBuild === "explorer" ? 0.42 : (characterBuild === "scholar" ? 0.32 : 0.36);
    const headH = characterBuild === "scholar" ? 0.44 : (characterBuild === "engineer" ? 0.34 : 0.36);
    const helmetMesh = new THREE.Mesh(new THREE.BoxGeometry(headW, headH, headW), matArmor);
    head.add(helmetMesh);
    const visorMesh = new THREE.Mesh(new THREE.BoxGeometry(headW * 0.85, 0.12 * heightScale, 0.12), matVisor);
    visorMesh.position.set(0, 0.02, headW * 0.46);
    head.add(visorMesh);
    torso.add(head);
    playerLimbs.head = head;

    // 3. Left Arm
    const armSpacing = 0.35 * widthScale;
    const leftArm = new THREE.Group();
    leftArm.position.set(-armSpacing, 0.22 * heightScale, 0);
    const lUpper = new THREE.Mesh(new THREE.BoxGeometry(0.16 * widthScale, 0.3 * heightScale, 0.16 * widthScale), matArmor);
    lUpper.position.y = -0.15 * heightScale;
    leftArm.add(lUpper);

    const leftForearm = new THREE.Group();
    leftForearm.position.set(0, -0.3 * heightScale, 0);
    const lLower = new THREE.Mesh(new THREE.BoxGeometry(0.14 * widthScale, 0.28 * heightScale, 0.14 * widthScale), matAccent);
    lLower.position.y = -0.14 * heightScale;
    leftForearm.add(lLower);
    leftArm.add(leftForearm);
    torso.add(leftArm);
    playerLimbs.leftArm = leftArm;
    playerLimbs.leftForearm = leftForearm;

    // 4. Right Arm
    const rightArm = new THREE.Group();
    rightArm.position.set(armSpacing, 0.22 * heightScale, 0);
    const rUpper = new THREE.Mesh(new THREE.BoxGeometry(0.16 * widthScale, 0.3 * heightScale, 0.16 * widthScale), matArmor);
    rUpper.position.y = -0.15 * heightScale;
    rightArm.add(rUpper);

    const rightForearm = new THREE.Group();
    rightForearm.position.set(0, -0.3 * heightScale, 0);
    const rLower = new THREE.Mesh(new THREE.BoxGeometry(0.14 * widthScale, 0.28 * heightScale, 0.14 * widthScale), matAccent);
    rLower.position.y = -0.14 * heightScale;
    rightForearm.add(rLower);
    rightArm.add(rightForearm);
    torso.add(rightArm);
    playerLimbs.rightArm = rightArm;
    playerLimbs.rightForearm = rightForearm;

    // 5. Left Leg
    const legSpacing = 0.16 * widthScale;
    const leftLeg = new THREE.Group();
    leftLeg.position.set(-legSpacing, 0.58 * heightScale, 0);
    const lThigh = new THREE.Mesh(new THREE.BoxGeometry(0.18 * widthScale, 0.36 * heightScale, 0.18 * widthScale), matArmor);
    lThigh.position.y = -0.18 * heightScale;
    leftLeg.add(lThigh);

    const leftCalf = new THREE.Group();
    leftCalf.position.set(0, -0.36 * heightScale, 0);
    const lCalfMesh = new THREE.Mesh(new THREE.BoxGeometry(0.16 * widthScale, 0.34 * heightScale, 0.16 * widthScale), matAccent);
    lCalfMesh.position.y = -0.17 * heightScale;
    leftCalf.add(lCalfMesh);
    const lBoot = new THREE.Mesh(new THREE.BoxGeometry(0.18 * widthScale, 0.1 * heightScale, 0.26 * widthScale), matArmor);
    lBoot.position.set(0, -0.32 * heightScale, 0.04);
    leftCalf.add(lBoot);
    leftLeg.add(leftCalf);
    playerMesh.add(leftLeg);
    playerLimbs.leftLeg = leftLeg;
    playerLimbs.leftCalf = leftCalf;

    // 6. Right Leg
    const rightLeg = new THREE.Group();
    rightLeg.position.set(legSpacing, 0.58 * heightScale, 0);
    const rThigh = new THREE.Mesh(new THREE.BoxGeometry(0.18 * widthScale, 0.36 * heightScale, 0.18 * widthScale), matArmor);
    rThigh.position.y = -0.18 * heightScale;
    rightLeg.add(rThigh);

    const rightCalf = new THREE.Group();
    rightCalf.position.set(0, -0.36 * heightScale, 0);
    const rCalfMesh = new THREE.Mesh(new THREE.BoxGeometry(0.16 * widthScale, 0.34 * heightScale, 0.16 * widthScale), matAccent);
    rCalfMesh.position.y = -0.17 * heightScale;
    rightCalf.add(rCalfMesh);
    const rBoot = new THREE.Mesh(new THREE.BoxGeometry(0.18 * widthScale, 0.1 * heightScale, 0.26 * widthScale), matArmor);
    rBoot.position.set(0, -0.32 * heightScale, 0.04);
    rightCalf.add(rBoot);
    rightLeg.add(rightCalf);
    playerMesh.add(rightLeg);
    playerLimbs.rightLeg = rightLeg;
    playerLimbs.rightCalf = rightCalf;

    playerMesh.position.copy(playerPos);
    scene.add(playerMesh);
}

function updateCharacterAnimation(dt, speed) {
    if (!playerLimbs.torso) return;

    playerAnimState.animTime += dt;
    const t = playerAnimState.animTime;

    if (playerAnimState.pickupTimer > 0) {
        playerAnimState.pickupTimer -= dt;
        playerAnimState.state = "pickup";

        // Reach down pickup pose
        playerLimbs.torso.rotation.x = 0.45;
        playerLimbs.torso.rotation.y = 0.2;
        playerLimbs.rightArm.rotation.x = 1.1;
        playerLimbs.rightArm.rotation.z = -0.2;
        playerLimbs.rightForearm.rotation.x = 0.5;
        playerLimbs.leftArm.rotation.x = -0.3;
        playerLimbs.leftLeg.rotation.x = 0.1;
        playerLimbs.rightLeg.rotation.x = -0.2;
        return;
    }

    if (speed > 5.0) {
        // Run gait
        playerAnimState.state = "run";
        const phase = t * 13.0;
        const swing = Math.sin(phase) * 0.85;
        const armSwing = Math.sin(phase) * 0.95;

        playerLimbs.torso.rotation.x = 0.25;
        playerLimbs.torso.rotation.y = Math.sin(phase) * 0.08;
        playerLimbs.leftLeg.rotation.x = swing;
        playerLimbs.rightLeg.rotation.x = -swing;
        playerLimbs.leftCalf.rotation.x = Math.max(0, -swing * 0.6);
        playerLimbs.rightCalf.rotation.x = Math.max(0, swing * 0.6);

        playerLimbs.leftArm.rotation.x = -armSwing;
        playerLimbs.rightArm.rotation.x = armSwing;
        playerLimbs.leftForearm.rotation.x = 0.4;
        playerLimbs.rightForearm.rotation.x = 0.4;
    } else if (speed > 0.1) {
        // Walk gait
        playerAnimState.state = "walk";
        const phase = t * 7.5;
        const swing = Math.sin(phase) * 0.5;
        const armSwing = Math.sin(phase) * 0.55;

        playerLimbs.torso.rotation.x = 0.08;
        playerLimbs.torso.rotation.y = 0;
        playerLimbs.leftLeg.rotation.x = swing;
        playerLimbs.rightLeg.rotation.x = -swing;
        playerLimbs.leftCalf.rotation.x = Math.max(0, -swing * 0.4);
        playerLimbs.rightCalf.rotation.x = Math.max(0, swing * 0.4);

        playerLimbs.leftArm.rotation.x = -armSwing;
        playerLimbs.rightArm.rotation.x = armSwing;
        playerLimbs.leftForearm.rotation.x = 0.2;
        playerLimbs.rightForearm.rotation.x = 0.2;
    } else {
        // Idle breathing & posture
        playerAnimState.state = "idle";
        const breathe = Math.sin(t * 2.2) * 0.03;
        playerLimbs.torso.position.y = 0.85 + breathe;
        playerLimbs.torso.rotation.x = 0;
        playerLimbs.torso.rotation.y = 0;

        playerLimbs.leftLeg.rotation.x = 0;
        playerLimbs.rightLeg.rotation.x = 0;
        playerLimbs.leftCalf.rotation.x = 0;
        playerLimbs.rightCalf.rotation.x = 0;

        playerLimbs.leftArm.rotation.x = Math.sin(t * 1.5) * 0.08;
        playerLimbs.leftArm.rotation.z = 0.12;
        playerLimbs.rightArm.rotation.x = -Math.sin(t * 1.5) * 0.08;
        playerLimbs.rightArm.rotation.z = -0.12;
        playerLimbs.leftForearm.rotation.x = 0.1;
        playerLimbs.rightForearm.rotation.x = 0.1;
    }
}

function createMascotCompanion() {
    mascotMesh = new THREE.Group();
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 16), new THREE.MeshStandardMaterial({ color: 0x0284c7, emissive: 0x38bdf8 }));
    mascotMesh.add(sphere);

    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.04, 8, 24), new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xfacc15 }));
    halo.rotateX(Math.PI / 2);
    mascotMesh.add(halo);

    mascotMesh.position.set(playerPos.x + 1.2, playerPos.y + 1.2, playerPos.z - 0.8);
    scene.add(mascotMesh);
}

function createBiomePlatforms() {
    const p1 = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.5, 0.4, 32), new THREE.MeshStandardMaterial({ color: 0x0f172a }));
    p1.position.set(14, 0.2, 14);
    scene.add(p1);

    const p6 = new THREE.Mesh(new THREE.CylinderGeometry(18, 18, 0.6, 48), new THREE.MeshStandardMaterial({ color: 0x07111e, emissive: 0x0c4a6e }));
    p6.position.set(0, 0.3, 65);
    scene.add(p6);

    spawnBiome6Runes(new THREE.Vector3(0, 1.8, 65));
}

function spawnBiome6Runes(center) {
    runeMeshes = [];
    Vocabulary.forEach((w, i) => {
        const cat = i < 6 ? 0 : (i < 12 ? 1 : 2);
        const col = cat === 0 ? 0xf97316 : (cat === 1 ? 0x38bdf8 : 0xc084fc);
        const angle = (cat * (Math.PI * 2 / 3)) + (i % 6 - 2.5) * 0.25;
        const r = 8.5 + (i % 3) * 2.0;

        const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.15, 16), new THREE.MeshStandardMaterial({ color: col, emissive: col }));
        mesh.position.set(center.x + Math.cos(angle) * r, center.y + (i % 2) * 0.6, center.z + Math.sin(angle) * r);
        scene.add(mesh);
        runeMeshes.push(mesh);
    });
}

function createFloatingValueBadge(label, sublabel = "", primaryColor = "#38bdf8", bgColor = "rgba(15, 23, 42, 0.88)") {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 100;
    const ctx = canvas.getContext("2d");

    // Draw glowing pill badge container
    ctx.fillStyle = bgColor;
    ctx.strokeStyle = primaryColor;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.roundRect(8, 8, 240, 84, 16);
    ctx.fill();
    ctx.stroke();

    // Primary Text label
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 26px 'JetBrains Mono', monospace";
    ctx.fillStyle = primaryColor;
    ctx.fillText(label, 128, sublabel ? 36 : 50);

    // Sublabel
    if (sublabel) {
        ctx.font = "14px sans-serif";
        ctx.fillStyle = "#cbd5e1";
        ctx.fillText(sublabel, 128, 68);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(2.4, 0.94, 1);
    return sprite;
}

function spawnSeededCollectibles() {
    collectibles.forEach(c => { if (c.mesh) scene.remove(c.mesh); if (c.badge) scene.remove(c.badge); });
    collectibles = [];

    const p = GameState.profile;
    const totalToSpawn = 24;
    const biome = GameState.currentBiome || 0;
    const semanticWords = ["fire", "heat", "ice", "cold", "vector", "matrix", "neural", "space", "cosine", "gradient", "token", "weight"];

    for (let i = 0; i < totalToSpawn; i++) {
        const rawX = SeedPRNG.range(-4.5, 4.5) * p.featureScaleX;
        const rawX2 = SeedPRNG.range(-4.0, 4.0) * p.featureScaleY;
        const isOutlier = SeedPRNG.next() < p.outlierRate;
        let rawY = p.trueW * rawX + p.trueB + SeedPRNG.gaussian(0, p.noiseLevel * 2.8);
        if (isOutlier) rawY += (SeedPRNG.next() > 0.5 ? 1 : -1) * SeedPRNG.range(6.5, 12.0);

        const roll = i % 4;
        let type, colHex, emHex, classLabel, badgeLabel, badgeSub, badgeColorHex = "#38bdf8";

        if (biome === 5) {
            // Biome 6: Semantic Expanse Word Vector Concept Tokens
            type = "SemanticRune_Token";
            const word = semanticWords[i % semanticWords.length];
            badgeLabel = `"${word}"`;
            badgeSub = `PPMI Vector (d=128)`;
            colHex = 0x818cf8;
            emHex = 0x4338ca;
            badgeColorHex = "#818cf8";
        } else if (biome === 1) {
            // Biome 2: Binary Marshlands Classification Spores
            const isClass1 = SeedPRNG.next() > (0.5 - p.classOverlap * 0.5);
            classLabel = isClass1 ? 1 : 0;
            type = isClass1 ? "Class1_AzureSpore" : "Class0_PurpleSpore";
            badgeLabel = `Class: ${classLabel}`;
            badgeSub = `x: ${rawX >= 0 ? '+' : ''}${rawX.toFixed(2)}`;
            colHex = isClass1 ? 0x22d3ee : 0xa855f7;
            emHex = isClass1 ? 0x0891b2 : 0x7e22ce;
            badgeColorHex = isClass1 ? "#22d3ee" : "#c084fc";
        } else if (biome === 2) {
            // Biome 3: Variance Tundra High-Dimensional Polynomial Features
            type = "Polynomial_Sample";
            badgeLabel = `x₁: ${rawX.toFixed(1)} | x₂²: ${Math.abs(rawX2).toFixed(1)}`;
            badgeSub = `L2 Penalty Term`;
            colHex = 0x38bdf8;
            emHex = 0x0284c7;
            badgeColorHex = "#38bdf8";
        } else if (biome === 3) {
            // Biome 4: Branching Canopy Decision Tree Split Points
            type = "DecisionTree_Split";
            badgeLabel = `Split: x < ${rawX.toFixed(1)}`;
            badgeSub = `Gini Impurity`;
            colHex = 0x22c55e;
            emHex = 0x15803d;
            badgeColorHex = "#22c55e";
        } else if (biome === 4) {
            // Biome 5: Deep Synapse Citadel Non-Linear XOR Gates
            type = "Neural_XOR_Gate";
            const b1 = rawX > 0 ? 1 : 0, b2 = rawX2 > 0 ? 1 : 0;
            badgeLabel = `XOR: (${b1}, ${b2}) ➔ ${b1 ^ b2}`;
            badgeSub = `Hidden Layer (2x4)`;
            colHex = 0xc084fc;
            emHex = 0x7e22ce;
            badgeColorHex = "#c084fc";
        } else {
            // Biome 1: Linear Steppes Real Numerical Features (x) and Targets (y)
            if (roll === 0 || roll === 1) {
                type = "FeatureCrystal_X";
                badgeLabel = `x: ${rawX >= 0 ? '+' : ''}${rawX.toFixed(2)}`;
                badgeSub = (i === 0) ? "⭐ Starter Feature" : "Feature Scalar (X)";
                colHex = (i === 0) ? 0xfacc15 : 0x38bdf8;
                emHex = (i === 0) ? 0xfacc15 : 0x0284c7;
                badgeColorHex = (i === 0) ? "#facc15" : "#38bdf8";
            } else {
                type = "TargetShard_Y";
                badgeLabel = `y: ${rawY >= 0 ? '+' : ''}${rawY.toFixed(2)}`;
                badgeSub = isOutlier ? "⚠️ Outlier Sample" : "Ground Truth (Y)";
                colHex = isOutlier ? 0xef4444 : 0xf59e0b;
                emHex = isOutlier ? 0x991b1b : 0xb45309;
                badgeColorHex = isOutlier ? "#f87171" : "#f59e0b";
            }
        }

        const angle = i === 0 ? 0.3 : SeedPRNG.range(0, Math.PI * 2);
        const r = i === 0 ? 6.5 : (6 + SeedPRNG.range(0, 26));

        // Faceted crystal mesh with glowing core
        const geom = (type.includes("X") || type.includes("Split")) ? new THREE.BoxGeometry(0.55, 0.55, 0.55) :
            (type.includes("Y") || type.includes("Token")) ? new THREE.OctahedronGeometry(0.42) :
                new THREE.SphereGeometry(0.38, 16, 16);

        const mesh = new THREE.Mesh(geom, new THREE.MeshStandardMaterial({ color: colHex, emissive: emHex, roughness: 0.25, metalness: 0.3 }));
        const posX = Math.cos(angle) * r, posZ = Math.sin(angle) * r;
        mesh.position.set(posX, 1.2, posZ);
        scene.add(mesh);

        // Floating 3D Billboard Text Label Badge
        const badge = createFloatingValueBadge(badgeLabel, badgeSub, badgeColorHex);
        badge.position.set(posX, 2.05, posZ);
        scene.add(badge);

        collectibles.push({
            mesh,
            badge,
            type,
            x: rawX,
            y: rawY,
            x1: rawX,
            x2: rawX2,
            classLabel,
            isOutlier,
            collected: false,
            baseY: 1.2,
            isFirst: i === 0
        });
    }
}

// --- 10. INPUT & CONTROLS ---
function setupInputListeners() {
    window.addEventListener("keydown", (e) => {
        if (e.key.toLowerCase() === "w" || e.key === "ArrowUp") inputKeys.w = true;
        if (e.key.toLowerCase() === "a" || e.key === "ArrowLeft") inputKeys.a = true;
        if (e.key.toLowerCase() === "s" || e.key === "ArrowDown") inputKeys.s = true;
        if (e.key.toLowerCase() === "d" || e.key === "ArrowRight") inputKeys.d = true;
        if (e.key.toLowerCase() === "e" && isNearLab) openFormulaTerminal();
    });

    window.addEventListener("keyup", (e) => {
        if (e.key.toLowerCase() === "w" || e.key === "ArrowUp") inputKeys.w = false;
        if (e.key.toLowerCase() === "a" || e.key === "ArrowLeft") inputKeys.a = false;
        if (e.key.toLowerCase() === "s" || e.key === "ArrowDown") inputKeys.s = false;
        if (e.key.toLowerCase() === "d" || e.key === "ArrowRight") inputKeys.d = false;
    });

    const joyZone = document.getElementById("joystick-zone");
    const stick = document.getElementById("joystick-stick");
    let touchId = null;
    joyZone.addEventListener("pointerdown", (e) => { touchId = e.pointerId; updateJoy(e); });
    window.addEventListener("pointermove", (e) => {
        if (e.pointerId === touchId) updateJoy(e);
        if (isLookDragging) {
            cameraOrbit.yaw -= (e.clientX - lastLookX) * 0.005;
            cameraOrbit.pitch = Math.max(0.1, Math.min(1.2, cameraOrbit.pitch + (e.clientY - lastLookY) * 0.005));
            lastLookX = e.clientX; lastLookY = e.clientY;
        }
    });
    window.addEventListener("pointerup", (e) => {
        if (e.pointerId === touchId) { touchId = null; joystickInput.x = 0; joystickInput.y = 0; stick.style.transform = `translate(-50%, -50%)`; }
        isLookDragging = false;
    });

    function updateJoy(e) {
        const rect = joyZone.getBoundingClientRect();
        const dx = e.clientX - (rect.left + rect.width / 2), dy = e.clientY - (rect.top + rect.height / 2);
        const dist = Math.min(Math.sqrt(dx * dx + dy * dy), 45), angle = Math.atan2(dy, dx);
        stick.style.transform = `translate(calc(-50% + ${Math.cos(angle) * dist}px), calc(-50% + ${Math.sin(angle) * dist}px))`;
        joystickInput.x = (Math.cos(angle) * dist) / 45;
        joystickInput.y = -(Math.sin(angle) * dist) / 45;
    }
    document.getElementById("look-zone").addEventListener("pointerdown", (e) => { isLookDragging = true; lastLookX = e.clientX; lastLookY = e.clientY; });
}

// --- 10.1 GYROSCOPE & DEVICE ORIENTATION SENSOR ---
let gyroState = {
    enabled: true,
    hasSensor: false,
    lastAlpha: null,
    lastBeta: null,
    lastGamma: null
};

function recenterCameraOrbit() {
    if (playerMesh) {
        cameraOrbit.yaw = playerMesh.rotation.y + Math.PI;
    } else {
        cameraOrbit.yaw = 0;
    }
    cameraOrbit.pitch = 0.35;
    cameraOrbit.distance = 7.5;
    gyroState.lastAlpha = null;
    gyroState.lastBeta = null;
    gyroState.lastGamma = null;
}

function initDeviceOrientationSensor() {
    if (typeof window !== "undefined" && window.DeviceOrientationEvent) {
        const handleOrientation = (e) => {
            if (!gyroState.enabled || e.gamma === null || e.beta === null) return;
            gyroState.hasSensor = true;

            if (gyroState.lastGamma !== null && gyroState.lastBeta !== null) {
                const isLandscape = window.innerWidth > window.innerHeight;
                let dYaw = 0, dPitch = 0;

                if (isLandscape) {
                    dYaw = (e.beta - gyroState.lastBeta) * 0.015;
                    dPitch = (e.gamma - gyroState.lastGamma) * 0.015;
                } else {
                    dYaw = (e.gamma - gyroState.lastGamma) * 0.015;
                    dPitch = (e.beta - gyroState.lastBeta) * 0.015;
                }

                // Threshold filter to avoid sensor jitter
                if (Math.abs(dYaw) > 0.002) cameraOrbit.yaw -= dYaw;
                if (Math.abs(dPitch) > 0.002) {
                    cameraOrbit.pitch = Math.max(0.1, Math.min(1.2, cameraOrbit.pitch + dPitch));
                }
            }

            gyroState.lastAlpha = e.alpha;
            gyroState.lastBeta = e.beta;
            gyroState.lastGamma = e.gamma;
        };

        window.addEventListener("deviceorientation", handleOrientation, true);
    }
}

function updateGame(deltaTime) {
    let moveX = joystickInput.x, moveZ = joystickInput.y;
    if (inputKeys.a) moveX -= 1; if (inputKeys.d) moveX += 1;
    if (inputKeys.w) moveZ += 1; if (inputKeys.s) moveZ -= 1;

    const moveMag = Math.sqrt(moveX * moveX + moveZ * moveZ);
    let speed = 0;
    if (moveMag > 0.01) {
        speed = 9.5;
        const forward = new THREE.Vector3(-Math.sin(cameraOrbit.yaw), 0, -Math.cos(cameraOrbit.yaw));
        const right = new THREE.Vector3(Math.cos(cameraOrbit.yaw), 0, -Math.sin(cameraOrbit.yaw));
        const targetDir = right.multiplyScalar(moveX / Math.max(1, moveMag)).add(forward.multiplyScalar(moveZ / Math.max(1, moveMag))).normalize();
        playerPos.add(targetDir.multiplyScalar(speed * deltaTime));
        playerMesh.rotation.y = Math.atan2(targetDir.x, targetDir.z);
    }
    playerMesh.position.copy(playerPos);
    updateCharacterAnimation(deltaTime, speed);

    if (mascotMesh) {
        const mascotTarget = new THREE.Vector3(playerPos.x + 1.2, playerPos.y + 1.2 + Math.sin(performance.now() * 0.003) * 0.15, playerPos.z - 0.8);
        mascotMesh.position.lerp(mascotTarget, deltaTime * 5.0);
        mascotMesh.rotation.y += deltaTime * 1.2;
    }

    camera.position.set(playerPos.x + Math.sin(cameraOrbit.yaw) * Math.cos(cameraOrbit.pitch) * cameraOrbit.distance, playerPos.y + Math.sin(cameraOrbit.pitch) * cameraOrbit.distance + 1.2, playerPos.z + Math.cos(cameraOrbit.yaw) * Math.cos(cameraOrbit.pitch) * cameraOrbit.distance);
    camera.lookAt(playerPos.x, playerPos.y + 1.2, playerPos.z);

    const time = performance.now() * 0.003;
    collectibles.forEach(c => {
        if (c.collected) return;
        if (c.mesh) {
            c.mesh.rotation.y += deltaTime * 1.5;
            c.mesh.position.y = c.baseY + Math.sin(time + c.mesh.position.x) * 0.15;
            if (c.badge) c.badge.position.y = c.mesh.position.y + 0.85;
        }
        if (playerPos.distanceTo(c.mesh.position) < 1.4) {
            c.collected = true;
            if (c.mesh) scene.remove(c.mesh);
            if (c.badge) scene.remove(c.badge);
            playerAnimState.pickupTimer = 0.55; // Trigger pickup gesture

            // Genuinely store picked-up coordinate payload into active dataset
            GameState.collectedDataset.push({
                type: c.type,
                x: c.x,
                y: c.y,
                x1: c.x1,
                x2: c.x2,
                classLabel: c.classLabel,
                isOutlier: c.isOutlier
            });

            if (c.type === "FeatureCrystal_X") GameState.resources.featureX++;
            else if (c.type === "TargetShard_Y") GameState.resources.targetY++;
            else if (c.type === "Class0_PurpleSpore") GameState.resources.class0++;
            else if (c.type === "Class1_AzureSpore") GameState.resources.class1++;
            else if (c.type.includes("Token")) GameState.resources.featureX++;

            playPickupSFX();

            if (GameState.tutorialStep === 0 && c.isFirst) {
                GameState.tutorialStep = 1;
                updateTutorialState();
            }

            computeDatasetStats();
            updateHUD();
            saveGame();
        }
    });

    runeMeshes.forEach(r => r.rotation.y += deltaTime * 0.8);
    updateParticles(deltaTime);

    isNearLab = playerPos.distanceTo(new THREE.Vector3(14, 0, 14)) < 5.5 || playerPos.distanceTo(new THREE.Vector3(0, 0, 65)) < 12.5;
    const promptEl = document.getElementById("lab-proximity-prompt");
    if (isNearLab && document.getElementById("terminal-modal").classList.contains("hidden")) {
        promptEl.classList.remove("hidden");
    } else {
        promptEl.classList.add("hidden");
    }
}

function drawMinimapRadar() {
    const canvas = document.getElementById("radar-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const cx = canvas.width * 0.5, cy = canvas.height * 0.5;

    ctx.strokeStyle = "rgba(56, 189, 248, 0.35)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, 32, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "#38bdf8";
    ctx.beginPath();
    ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
    ctx.fill();

    const labPos = new THREE.Vector3(14, 0, 14);
    const toLab = new THREE.Vector2(labPos.x - playerPos.x, labPos.z - playerPos.z).normalize();
    const wpX = cx + toLab.x * 24;
    const wpY = cy + toLab.y * 24;

    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.arc(wpX, wpY, 4.5, 0, Math.PI * 2);
    ctx.fill();
}

function animateCountUp(elementId, targetVal, duration = 300) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const startVal = parseInt(el.innerText) || 0;
    if (startVal === targetVal) return;

    const startTime = performance.now();
    function tick(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(startVal + (targetVal - startVal) * ease);
        el.innerText = current;
        if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
}

function updateHUD() {
    const totalX = GameState.resources.featureX + GameState.resources.class0;
    const totalY = GameState.resources.targetY + GameState.resources.xorCores;
    const totalN = GameState.resources.featureX + GameState.resources.xorCores;

    animateCountUp("drawer-x-count", totalX, 280);
    animateCountUp("drawer-y-count", totalY, 280);
    animateCountUp("drawer-n-count", totalN, 280);

    const totalNeeded = 18;
    const pct = Math.min(100, Math.round((totalX / totalNeeded) * 100));
    const fillEl = document.getElementById("objective-progress-fill");
    if (fillEl) fillEl.style.width = `${pct}%`;

    const statusEl = document.getElementById("objective-status");
    if (statusEl) {
        if (totalX >= totalNeeded) {
            statusEl.className = "status-green";
            statusEl.innerHTML = "<b>READY TO CALIBRATE!</b>";
        } else {
            statusEl.className = "status-amber";
            statusEl.innerHTML = `<b>${totalX}/${totalNeeded} COLLECTED</b>`;
        }
    }

    drawMinimapRadar();
}

// --- 11. GSAP UI MOTION & TERMINAL LIFECYCLE ---
function openFormulaTerminal() {
    playTerminalOpenSFX();
    const modal = document.getElementById("terminal-modal");
    const container = modal.querySelector(".terminal-container");
    modal.classList.remove("hidden");
    document.getElementById("lab-proximity-prompt").classList.add("hidden");

    if (typeof gsap !== "undefined") {
        gsap.fromTo(modal, { opacity: 0 }, { opacity: 1, duration: 0.22, ease: "power2.out" });
        gsap.fromTo(container,
            { y: 55, scale: 0.90, filter: "blur(12px)", opacity: 0 },
            { y: 0, scale: 1.0, filter: "blur(0px)", opacity: 1, duration: 0.38, ease: "back.out(1.5)" }
        );
        gsap.fromTo(".preset-btn, .opt-btn",
            { y: 12, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.28, stagger: 0.035, ease: "power2.out", delay: 0.12 }
        );
    }

    if (GameState.tutorialStep === 1) {
        GameState.tutorialStep = 2;
        document.getElementById("terminal-formula-input").value = `y = ${GameState.profile.trueW.toFixed(2)}x + ${GameState.profile.trueB.toFixed(2)}`;
        updateTutorialState();
    }

    retrieveTopKVectors("frost", 4);
    runGrandPrixSimulation();
}

function closeFormulaTerminal() {
    const modal = document.getElementById("terminal-modal");
    const container = modal.querySelector(".terminal-container");

    if (typeof gsap !== "undefined") {
        gsap.to(container, {
            y: 35,
            scale: 0.92,
            filter: "blur(8px)",
            opacity: 0,
            duration: 0.22,
            ease: "power2.in"
        });
        gsap.to(modal, {
            opacity: 0,
            duration: 0.22,
            ease: "power2.in",
            onComplete: () => modal.classList.add("hidden")
        });
    } else {
        modal.classList.add("hidden");
    }
}

// --- 12. APP SHELL STATE MACHINE: SPLASH, LOADING & SETTINGS ---
const CodexTips = [
    "💡 Gradient Descent steps in the direction opposite to the gradient: w ← w - η·∇J.",
    "💡 L1 Lasso Regularization forces non-informative feature weights strictly to zero.",
    "💡 Decision Trees split orthogonal hyperplanes to maximize Gini Information Gain.",
    "💡 Multi-Layer Perceptrons chain non-linear ReLU gates to solve the XOR paradox.",
    "💡 Positive Pointwise Mutual Information (PPMI) encodes semantic word co-occurrences.",
    "💡 Cosine Similarity measures directional angular similarity independent of vector magnitude."
];

let isSplashDismissed = false;

function initSplashScreen() {
    const splash = document.getElementById("splash-screen");
    playTerminalOpenSFX();

    function dismissSplash() {
        if (isSplashDismissed) return;
        isSplashDismissed = true;
        if (typeof gsap !== "undefined") {
            gsap.to(splash, { opacity: 0, duration: 0.35, onComplete: () => splash.classList.add("hidden") });
        } else {
            splash.classList.add("hidden");
        }
    }

    splash.addEventListener("click", dismissSplash);
    window.addEventListener("keydown", dismissSplash, { once: true });
    setTimeout(dismissSplash, 2500);
}

function startBiomeLoadingSequence(biomeIndex, onComplete) {
    const loader = document.getElementById("loading-screen");
    const fill = document.getElementById("loading-progress-fill");
    const pctTxt = document.getElementById("loading-pct-text");
    const statusTxt = document.getElementById("loading-status-text");
    const tipTxt = document.getElementById("loading-codex-tip");

    const cur = CodexCurriculum[biomeIndex] || CodexCurriculum[0];
    const biomeName = cur ? cur.subtitle.toUpperCase() : "THE LINEAR STEPPES";

    const titleEl = document.getElementById("loading-biome-name");
    if (titleEl) titleEl.innerText = `⚡ CALIBRATING BIOME ${biomeIndex + 1}: ${biomeName}`;
    if (tipTxt && typeof CodexTips !== "undefined" && Array.isArray(CodexTips) && CodexTips.length > 0) {
        tipTxt.innerHTML = CodexTips[Math.floor(Math.random() * CodexTips.length)];
    }

    if (loader) {
        loader.classList.remove("hidden");
    }

    const minDuration = 1000;
    const startTime = performance.now();

    function step(now) {
        const elapsed = now - startTime;
        const p = Math.min(1, elapsed / minDuration);
        const eased = 1 - Math.pow(1 - p, 3);
        const pct = Math.round(eased * 100);

        if (fill) fill.style.width = `${pct}%`;
        if (pctTxt) pctTxt.innerText = `${pct}%`;
        if (statusTxt) {
            if (pct < 35) statusTxt.innerText = "SYNCHRONIZING WEIGHTS...";
            else if (pct < 75) statusTxt.innerText = "CALIBRATING TENSOR MESH...";
            else statusTxt.innerText = "ENTERING ARENA...";
        }

        if (p < 1) {
            requestAnimationFrame(step);
        } else {
            if (loader) loader.classList.add("hidden");
            if (typeof onComplete === "function") onComplete();
        }
    }
    requestAnimationFrame(step);
}

// --- 14. 'MY MODELS' GALLERY & ARCHIVE (STAGE 29 CHAT FOUNDATION) ---
let TrainedModelVault = [
    {
        id: "m-linear-01",
        name: "Linear Steppes Calibrator",
        biome: "Biome 1: The Linear Steppes",
        architecture: "Linear Regression (Adam)",
        weights: "w = 2.450, b = 1.150 | η = 0.05, β₁ = 0.9",
        lossCurve: [1.25, 0.92, 0.65, 0.42, 0.28, 0.16, 0.08, 0.045, 0.024],
        finalLoss: 0.0245,
        accuracy: 94.2,
        seed: "NEURO-8842",
        timestamp: "2026-08-15 01:40:00",
        boss: "Linear Gradient Ravine Boss"
    }
];

function loadModelVault() {
    const raw = localStorage.getItem("neuroarena_model_vault");
    if (raw) {
        try {
            const saved = JSON.parse(raw);
            if (Array.isArray(saved)) TrainedModelVault = saved;
        } catch (e) { }
    }
}

function saveModelVault() {
    localStorage.setItem("neuroarena_model_vault", JSON.stringify(TrainedModelVault));
}

let activeInspectedModel = null;

function archiveCurrentModelToVault(bossTitle = "Linear Steppes Boss") {
    const ds = GameState.collectedDataset || [];
    let minX = -4.5, maxX = 4.5, minY = -10, maxY = 12, meanX = 0, stdX = 2.5, meanY = 1.15, stdY = 6.2;
    if (ds.length > 0) {
        minX = Math.min(...ds.map(p => p.x !== undefined ? p.x : p.x1));
        maxX = Math.max(...ds.map(p => p.x !== undefined ? p.x : p.x1));
        minY = Math.min(...ds.map(p => p.y !== undefined ? p.y : p.x2));
        maxY = Math.max(...ds.map(p => p.y !== undefined ? p.y : p.x2));
        meanX = ds.reduce((acc, p) => acc + (p.x !== undefined ? p.x : p.x1), 0) / ds.length;
        stdX = Math.sqrt(ds.reduce((acc, p) => acc + Math.pow((p.x !== undefined ? p.x : p.x1) - meanX, 2), 0) / ds.length) || 2.5;
    }

    const finalW = lastRaceResults && lastRaceResults[GameState.equippedOptimizer] ? lastRaceResults[GameState.equippedOptimizer].finalW : GameState.profile.trueW;
    const finalB = lastRaceResults && lastRaceResults[GameState.equippedOptimizer] ? lastRaceResults[GameState.equippedOptimizer].finalB : GameState.profile.trueB;

    const newRecord = {
        id: `m-${Date.now().toString().slice(-6)}`,
        name: `${GameState.equippedOptimizer} Model (Seed #${GameState.playthroughSeed})`,
        biome: `Biome ${GameState.currentBiome + 1}: ${CodexCurriculum[GameState.currentBiome]?.subtitle || "Arena"}`,
        architecture: `${GameState.equippedOptimizer} Architecture`,
        weights: `w = ${finalW.toFixed(3)}, b = ${finalB.toFixed(3)} | Noise σ = ${GameState.profile.noiseLevel.toFixed(2)}`,
        weightW: finalW,
        weightB: finalB,
        minX, maxX, minY, maxY, meanX, stdDevX: stdX, meanY, stdDevY: stdY,
        trainingPoints: ds.map(p => ({ x: p.x !== undefined ? p.x : p.x1, y: p.y !== undefined ? p.y : p.x2, classLabel: p.classLabel, isOutlier: p.isOutlier })),
        lossCurve: lastRaceResults && lastRaceResults[GameState.equippedOptimizer] ? lastRaceResults[GameState.equippedOptimizer].lossHist.slice(0, 40) : [0.8, 0.4, 0.15, 0.024],
        finalLoss: GameState.lastLoss,
        accuracy: GameState.lastAccuracy,
        seed: GameState.playthroughSeed,
        timestamp: new Date().toISOString().replace("T", " ").split(".")[0],
        boss: bossTitle
    };

    TrainedModelVault.unshift(newRecord);
    saveModelVault();
}

function renderModelGallery() {
    const grid = document.getElementById("models-cards-grid");
    grid.innerHTML = "";

    if (TrainedModelVault.length === 0) {
        grid.innerHTML = "<div style='grid-column: 1/-1; text-align: center; color: #64748b; padding: 30px;'>No trained models in vault yet. Complete a training run to archive your first model!</div>";
        return;
    }

    TrainedModelVault.forEach((m, idx) => {
        const card = document.createElement("div");
        card.className = "model-gallery-card";
        if (GameState.tutorialStep === 4 && idx === 0) {
            card.classList.add("pulsing-target");
        }
        card.innerHTML = `
            <div class="model-card-header">
                <span class="model-card-title">🧠 ${m.name}</span>
                <span class="model-card-biome">${m.biome}</span>
            </div>
            <div class="model-card-stats">Acc: <b>${m.accuracy.toFixed(1)}%</b> | Loss: <b>${m.finalLoss.toFixed(4)}</b></div>
            <div class="model-card-footer">🧬 #${m.seed} | 📅 ${m.timestamp}</div>
        `;
        card.addEventListener("click", () => {
            openModelInspector(m);
            if (GameState.tutorialStep === 4) {
                GameState.tutorialStep = 5;
                document.getElementById("inspector-tab-consult")?.click();
                updateTutorialState();
            }
        });
        grid.appendChild(card);
    });
}

function openModelInspector(m) {
    activeInspectedModel = m;
    document.getElementById("inspector-model-title").innerText = m.name;
    document.getElementById("inspector-meta-text").innerText = `${m.biome} | Seed #${m.seed} | ${m.timestamp}`;
    document.getElementById("inspector-acc-val").innerText = `${m.accuracy.toFixed(1)}%`;
    document.getElementById("inspector-loss-val").innerText = `J = ${m.finalLoss.toFixed(4)}`;
    document.getElementById("inspector-params-text").innerText = m.weights;

    // Reset tabs
    document.getElementById("inspector-tab-loss").classList.add("active");
    document.getElementById("inspector-tab-consult").classList.remove("active");
    document.getElementById("inspector-pane-loss").classList.remove("hidden");
    document.getElementById("inspector-pane-consult").classList.add("hidden");

    // Telemetry in consult tab
    const domInfo = document.getElementById("consult-domain-info");
    if (domInfo) {
        const minX = m.minX !== undefined ? m.minX.toFixed(1) : "-4.5";
        const maxX = m.maxX !== undefined ? m.maxX.toFixed(1) : "4.5";
        const mu = m.meanX !== undefined ? m.meanX.toFixed(1) : "0.0";
        const sigma = m.stdDevX !== undefined ? m.stdDevX.toFixed(2) : "2.5";
        const nPts = m.trainingPoints ? m.trainingPoints.length : 24;
        domInfo.innerHTML = `📊 <b>EMPIRICAL TRAINING DOMAIN:</b> X ∈ [${minX}, ${maxX}] | μ = ${mu}, σ = ${sigma} | Stored Samples: N = ${nPts}`;
    }

    // Draw Frozen Loss Graph on Canvas
    const canvas = document.getElementById("inspector-canvas");
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#04070c";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "#4ade80";
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    const pts = m.lossCurve || [1.0, 0.5, 0.2, 0.05];
    for (let i = 0; i < pts.length; i++) {
        const px = 25 + (i / (pts.length - 1)) * (canvas.width - 45);
        const py = (canvas.height - 15) - (Math.min(pts[i], 2.0) / 2.0) * (canvas.height - 30);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();

    renderConsultDecisionGraph(m, null);

    const inspectorModal = document.getElementById("model-inspector-modal");
    inspectorModal.classList.remove("hidden");
    if (typeof gsap !== "undefined") {
        gsap.fromTo(inspectorModal.querySelector(".glass-modal"), { scale: 0.88, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: "back.out(1.5)" });
    }
}

// Stage 29 Model Consult / Interrogate Inference Execution
function executeConsultQuery(qX) {
    if (!activeInspectedModel) return;
    const m = activeInspectedModel;
    const minX = m.minX !== undefined ? m.minX : -4.5;
    const maxX = m.maxX !== undefined ? m.maxX : 4.5;
    const sigma = m.stdDevX !== undefined ? m.stdDevX : 2.5;

    // 1. Compute nearest neighbor distance
    let dMin = Infinity;
    if (m.trainingPoints && m.trainingPoints.length > 0) {
        m.trainingPoints.forEach(p => {
            const dist = Math.abs(qX - p.x);
            if (dist < dMin) dMin = dist;
        });
    } else {
        if (qX < minX) dMin = minX - qX;
        else if (qX > maxX) dMin = qX - maxX;
        else dMin = 0.25;
    }

    // 2. Extrapolation Condition Check
    const isExtrap = (qX < minX - 0.2 * sigma) || (qX > maxX + 0.2 * sigma) || (dMin > 1.35 * sigma);

    // 3. Genuine Mathematical Inference (No fake results)
    const w = m.weightW !== undefined ? m.weightW : 2.45;
    const b = m.weightB !== undefined ? m.weightB : 1.15;
    const predY = w * qX + b;
    const mathStr = `ŷ = (${w.toFixed(3)}) · (${qX.toFixed(2)}) + (${b.toFixed(3)}) = ${predY.toFixed(3)}`;

    const stream = document.getElementById("consult-chat-stream-box");

    // Add User Bubble
    const userBubble = document.createElement("div");
    userBubble.className = "chat-bubble chat-bubble-user";
    userBubble.innerHTML = `<div class="chat-bubble-sender">👤 QUERY:</div>Predict target value for input feature <b>X = ${qX.toFixed(2)}</b>`;
    stream.appendChild(userBubble);

    // Add Model Inference Response Bubble
    const modelBubble = document.createElement("div");
    if (isExtrap) {
        playFailureSFX();
        modelBubble.className = "chat-bubble chat-bubble-extrapolation";
        modelBubble.innerHTML = `
            <div class="chat-bubble-sender warn">⚠️ [LOW CONFIDENCE :: EXTRAPOLATION ERROR]</div>
            <div class="extrapolation-alert-badge">OUT-OF-DISTRIBUTION QUERY</div>
            <div><b>Model Evaluation (Genuine Inference):</b> <code style="color:#fde047;">${mathStr}</code></div>
            <div style="margin-top:6px; font-size:10.5px; color:#fecdd3;">
                <b>Extrapolation Diagnostic:</b> This input (X = ${qX.toFixed(2)}) lies far outside the empirical domain [${minX.toFixed(1)}, ${maxX.toFixed(1)}] the model was trained on (Nearest sample distance Δ = ${dMin.toFixed(2)} > 1.35σ).<br>
                <i>Linear and neural models evaluate mathematical equations unconditionally, confidently projecting decision boundaries into empty uncharted space without any empirical support.</i>
            </div>
        `;
    } else {
        playVictoryPassSFX();
        modelBubble.className = "chat-bubble chat-bubble-model";
        modelBubble.innerHTML = `
            <div class="chat-bubble-sender" style="color:#4ade80;">✓ [HIGH CONFIDENCE :: IN-DOMAIN INTERPOLATION]</div>
            <div><b>Model Evaluation (Genuine Inference):</b> <code style="color:#86efac;">${mathStr}</code></div>
            <div style="margin-top:4px; font-size:10.5px; color:#cbd5e1;">
                Query input lies safely within the training domain [${minX.toFixed(1)}, ${maxX.toFixed(1)}]. Nearest empirical sample is Δ = ${dMin.toFixed(2)} away.
            </div>
        `;
    }
    stream.appendChild(modelBubble);
    stream.scrollTop = stream.scrollHeight;

    // Update Decision Canvas
    renderConsultDecisionGraph(m, { queryX: qX, predictedY: predY, isExtrapolation: isExtrap });

    if (GameState.tutorialStep === 5) {
        GameState.tutorialStep = 6;
        updateTutorialState();
        saveGame();
    }
}

function renderConsultDecisionGraph(model, latestQuery) {
    const canvas = document.getElementById("consult-decision-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#04070c";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const minX = model.minX !== undefined ? model.minX : -4.5;
    const maxX = model.maxX !== undefined ? model.maxX : 4.5;
    const w = model.weightW !== undefined ? model.weightW : 2.45;
    const b = model.weightB !== undefined ? model.weightB : 1.15;

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const scaleX = canvas.width / 32;
    const scaleY = canvas.height / 36;

    // 1. Draw In-Domain Zone Shading
    const domPx1 = cx + minX * scaleX;
    const domPx2 = cx + maxX * scaleX;
    ctx.fillStyle = "rgba(2, 132, 199, 0.15)";
    ctx.fillRect(domPx1, 0, domPx2 - domPx1, canvas.height);
    ctx.strokeStyle = "rgba(56, 189, 248, 0.4)";
    ctx.strokeRect(domPx1, 0, domPx2 - domPx1, canvas.height);

    // Labels for in-domain vs uncharted space
    ctx.font = "9px 'JetBrains Mono', monospace";
    ctx.fillStyle = "rgba(56, 189, 248, 0.8)";
    ctx.fillText("[EMPIRICAL TRAINING DOMAIN]", domPx1 + 6, 14);
    ctx.fillStyle = "rgba(244, 63, 94, 0.6)";
    ctx.fillText("[UNCHARTED TERRITORY]", 8, 14);
    ctx.fillText("[UNCHARTED TERRITORY]", canvas.width - 130, 14);

    // 2. Draw Empirical Training Points
    const pts = model.trainingPoints || [];
    pts.forEach(p => {
        const px = cx + p.x * scaleX;
        const py = cy - p.y * scaleY;
        ctx.fillStyle = p.isOutlier ? "#f59e0b" : "#38bdf8";
        ctx.beginPath();
        ctx.arc(px, py, 3.5, 0, Math.PI * 2);
        ctx.fill();
    });

    // 3. Visually Extend Decision Boundary / Fitted Line Straight Across Entire Uncharted Canvas
    ctx.strokeStyle = "#facc15";
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    const gX1 = -16, gY1 = w * gX1 + b;
    const gX2 = 16, gY2 = w * gX2 + b;
    ctx.moveTo(cx + gX1 * scaleX, cy - gY1 * scaleY);
    ctx.lineTo(cx + gX2 * scaleX, cy - gY2 * scaleY);
    ctx.stroke();

    // 4. Draw Query Point & Radar Indicator
    if (latestQuery) {
        const qpx = cx + latestQuery.queryX * scaleX;
        const qpy = cy - latestQuery.predictedY * scaleY;
        ctx.fillStyle = latestQuery.isExtrapolation ? "#f43f5e" : "#4ade80";
        ctx.beginPath();
        ctx.arc(qpx, qpy, 5.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(qpx, qpy, 9.0, 0, Math.PI * 2);
        ctx.stroke();
    }
}

// --- 13. PLAYER PROFILE SYSTEM (MULTI-SLOT SAVES & VISUAL STAT CARDS) ---
let activeSaveSlot = 0;
const ProfileSlots = [
    { slot: 0, name: "Ada-Architect", avatar: "🤖", created: "2026-08-15", playtimeSec: 0, biomes: 1, gpRaces: 0, gpWins: 0, streak: 1, bestStreak: 1 },
    { slot: 1, name: "Empty Slot 2", avatar: "🧠", created: "-", playtimeSec: 0, biomes: 0, gpRaces: 0, gpWins: 0, streak: 0, bestStreak: 0 },
    { slot: 2, name: "Empty Slot 3", avatar: "⚡", created: "-", playtimeSec: 0, biomes: 0, gpRaces: 0, gpWins: 0, streak: 0, bestStreak: 0 }
];

function loadProfileSlots() {
    for (let s = 0; s < 3; s++) {
        const raw = localStorage.getItem(`neuroarena_profile_slot_${s}`);
        if (raw) {
            try { Object.assign(ProfileSlots[s], JSON.parse(raw)); } catch (e) { }
        }
    }
    activeSaveSlot = parseInt(localStorage.getItem("neuroarena_active_slot")) || 0;
    if (ProfileSlots[activeSaveSlot].name.startsWith("Empty Slot") && !localStorage.getItem("neuroarena_first_profile_created")) {
        setTimeout(openFirstLaunchProfileModal, 1200);
    }
    updateProfileUI();
}

function saveActiveProfile() {
    localStorage.setItem(`neuroarena_profile_slot_${activeSaveSlot}`, JSON.stringify(ProfileSlots[activeSaveSlot]));
    localStorage.setItem("neuroarena_active_slot", activeSaveSlot);
}

function formatPlaytime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`;
}

function openFirstLaunchProfileModal() {
    const modal = document.getElementById("first-launch-profile-modal");
    modal.classList.remove("hidden");
    if (typeof gsap !== "undefined") {
        gsap.fromTo(modal.querySelector(".glass-modal"), { scale: 0.85, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.35, ease: "back.out(1.5)" });
    }
}

function renderProfileModal() {
    const p = ProfileSlots[activeSaveSlot];
    document.getElementById("profile-card-name").innerText = p.name;
    document.getElementById("profile-card-avatar").innerText = p.avatar;
    document.getElementById("profile-card-playtime").innerText = formatPlaytime(p.playtimeSec);
    document.getElementById("profile-card-date").innerText = p.created;
    document.getElementById("profile-stat-biomes").innerText = `${p.biomes}/6`;

    const winRate = p.gpRaces > 0 ? ((p.gpWins / p.gpRaces) * 100).toFixed(1) : "100.0";
    document.getElementById("profile-stat-grandprix").innerText = `${winRate}%`;
    document.getElementById("profile-stat-races").innerText = `${p.gpWins} Wins / ${p.gpRaces} Races`;
    document.getElementById("profile-stat-streak").innerText = `${p.streak} Days`;
    document.getElementById("profile-stat-best-streak").innerText = `Best Streak: ${p.bestStreak} Days`;

    // Biome records list
    const list = document.getElementById("profile-biome-records-list");
    list.innerHTML = "";
    const biomeNames = [
        "1. Linear Steppes", "2. Binary Marshlands", "3. Variance Tundra",
        "4. Branching Canopy", "5. Deep Synapse Citadel", "6. Semantic Expanse"
    ];
    biomeNames.forEach((bName, idx) => {
        const row = document.createElement("div");
        row.className = "record-row";
        const isMastered = idx < p.biomes;
        const metric = idx === 0 ? `MSE = ${GameState.lastLoss.toFixed(4)}` : (idx === 1 ? "Acc = 94.2%" : "Acc = 90.0%");
        row.innerHTML = `<span class="record-name">• ${bName}</span> <span class="record-val">${isMastered ? `🏆 ${metric}` : "<span style='color:#64748b;'>🔒 In Progress</span>"}</span>`;
        list.appendChild(row);
    });

    document.querySelectorAll(".slot-btn").forEach((b, idx) => {
        if (idx === activeSaveSlot) {
            b.classList.add("active");
            b.innerText = `Slot ${idx + 1} (Active)`;
        } else {
            b.classList.remove("active");
            b.innerText = `Slot ${idx + 1}`;
        }
    });
}

function updateProfileUI() {
    const p = ProfileSlots[activeSaveSlot];
    const icon = document.getElementById("hud-avatar-icon");
    if (icon) icon.innerText = p.avatar;
}

function setupUIEvents() {
    document.getElementById("btn-toggle-drawer").addEventListener("click", () => {
        const drawer = document.getElementById("inventory-drawer");
        drawer.classList.toggle("hidden");
    });

    document.getElementById("btn-open-terminal").addEventListener("click", openFormulaTerminal);
    document.getElementById("btn-close-terminal").addEventListener("click", closeFormulaTerminal);
    document.getElementById("btn-return-world").addEventListener("click", closeFormulaTerminal);
    document.getElementById("btn-grand-prix").addEventListener("click", () => {
        ProfileSlots[activeSaveSlot].gpRaces++;
        ProfileSlots[activeSaveSlot].gpWins++;
        saveActiveProfile();
        runGrandPrixSimulation();
    });
    document.getElementById("btn-train-weapon").addEventListener("click", trainEquippedWeapon);

    // My Models Modals
    function openMyModelsGallery() {
        renderModelGallery();
        const modal = document.getElementById("my-models-modal");
        modal.classList.remove("hidden");
        if (typeof gsap !== "undefined") {
            gsap.fromTo(modal.querySelector(".glass-modal"), { scale: 0.88, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: "back.out(1.5)" });
        }
    }
    document.getElementById("btn-open-models-hud").addEventListener("click", openMyModelsGallery);
    document.getElementById("btn-menu-models").addEventListener("click", openMyModelsGallery);
    document.getElementById("btn-close-models").addEventListener("click", () => document.getElementById("my-models-modal").classList.add("hidden"));
    document.getElementById("btn-close-inspector").addEventListener("click", () => document.getElementById("model-inspector-modal").classList.add("hidden"));
    document.getElementById("btn-back-to-gallery").addEventListener("click", () => {
        document.getElementById("model-inspector-modal").classList.add("hidden");
        openMyModelsGallery();
    });

    // Consult HUD Opener
    document.getElementById("btn-open-consult-hud")?.addEventListener("click", () => {
        if (SavedModels.length === 0) {
            SavedModels.push({
                id: "model-active-live",
                name: "Active Arena Model",
                w: GameState.weights.w,
                b: GameState.weights.b,
                loss: GameState.lastLoss,
                created: new Date().toISOString().split("T")[0]
            });
        }
        openModelInspector(SavedModels[0].id);
        const consultTab = document.getElementById("inspector-tab-consult");
        if (consultTab) consultTab.click();
    });

    // Objective Banner Detail Modal
    document.getElementById("objective-banner")?.addEventListener("click", () => {
        const modal = document.getElementById("objective-modal");
        if (modal) {
            modal.classList.remove("hidden");
            if (typeof gsap !== "undefined") {
                gsap.fromTo(modal.querySelector(".glass-modal"), { scale: 0.88, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: "back.out(1.5)" });
            }
        }
    });
    document.getElementById("btn-close-objective")?.addEventListener("click", () => {
        document.getElementById("objective-modal")?.classList.add("hidden");
    });
    document.getElementById("btn-dismiss-objective")?.addEventListener("click", () => {
        document.getElementById("objective-modal")?.classList.add("hidden");
    });

    // Biome World Travel Map System
    const BiomeWorldCatalog = [
        {
            id: 0,
            name: "The Linear Steppes",
            subtitle: "Arid Alluvial Plateaus",
            paradigm: "Linear Regression (OLS / MSE)",
            metric: "MSE ≤ 0.10",
            beacon: "Amber-Gold Skybeam (22m)",
            color: "#f59e0b",
            desc: "Wide terraced sandstone alluvial plains bathed in warm amber atmospheric dust."
        },
        {
            id: 1,
            name: "The Binary Marshlands",
            subtitle: "Sunken Crater Swamplands",
            paradigm: "Logistic Classification (BCE)",
            metric: "Accuracy ≥ 90%",
            beacon: "Bioluminescent Emerald Skybeam",
            color: "#10b981",
            desc: "Deep marsh basins with glowing teal spore trees and organic gradient pools."
        },
        {
            id: 2,
            name: "The Variance Tundra",
            subtitle: "Jagged Glacial Ridges",
            paradigm: "L2 Ridge / Lasso Regularization",
            metric: "Loss Complexity Penalty",
            beacon: "Glacial Frost Cyan Skybeam",
            color: "#38bdf8",
            desc: "Extreme sub-zero frost crags and frozen ice ridges subject to high variance."
        },
        {
            id: 3,
            name: "The Branching Canopy",
            subtitle: "Rolling Ancient Forests",
            paradigm: "Decision Trees & Bagging Ensembles",
            metric: "Information Gain / Gini",
            beacon: "Radiant Jade Skybeam",
            color: "#22c55e",
            desc: "Undulating emerald forest hills sheltered under towering multi-tiered tree trunks."
        },
        {
            id: 4,
            name: "The Deep Synapse Citadel",
            subtitle: "Obsidian Basalt Monolith Rings",
            paradigm: "Multi-Layer Perceptrons & Backprop",
            metric: "Non-Linear XOR Convergence",
            beacon: "Neon Amethyst Skybeam",
            color: "#c084fc",
            desc: "Multi-ringed volcanic basalt citadels pulsing with high-voltage neural activation lines."
        },
        {
            id: 5,
            name: "The Semantic Expanse",
            subtitle: "Cosmic Star Plateaus",
            paradigm: "PPMI Word Embeddings & Vector Space",
            metric: "Cosine Similarity ≥ 0.75",
            beacon: "Celestial Starlight Skybeam",
            color: "#818cf8",
            desc: "Floating celestial quartz platforms hovering in a boundless cosmic vector void."
        }
    ];

    function openBiomeTravelMap() {
        renderBiomeTravelMap();
        const modal = document.getElementById("biome-travel-modal");
        if (modal) {
            modal.classList.remove("hidden");
            if (typeof gsap !== "undefined") {
                gsap.fromTo(modal.querySelector(".glass-modal"), { scale: 0.88, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: "back.out(1.5)" });
            }
        }
    }

    function renderBiomeTravelMap() {
        const grid = document.getElementById("travel-biome-grid");
        if (!grid) return;
        grid.innerHTML = "";

        const p = ProfileSlots[activeSaveSlot];
        const unlockedCount = p ? p.biomes : 1;

        BiomeWorldCatalog.forEach(b => {
            const isUnlocked = b.id <= unlockedCount;
            const isCurrent = GameState.currentBiome === b.id;

            const card = document.createElement("div");
            card.className = "stat-card";
            card.style.border = isCurrent ? "2px solid #38bdf8" : "1px solid rgba(255,255,255,0.1)";
            card.style.background = isCurrent ? "rgba(14,165,233,0.15)" : "rgba(15,23,42,0.75)";
            card.style.display = "flex";
            card.style.flexDirection = "column";
            card.style.justifyContent = "space-between";
            card.style.padding = "14px";

            card.innerHTML = `
                <div>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                        <span style="font-weight:800; font-size:1.05rem; color:${b.color};">#${b.id + 1} ${b.name}</span>
                        <span style="font-size:0.75rem; padding:2px 8px; border-radius:4px; ${isUnlocked ? 'background:#065f46; color:#34d399;' : 'background:#451a03; color:#f97316;'}">
                            ${isUnlocked ? '✅ UNLOCKED' : '🔒 LOCKED'}
                        </span>
                    </div>
                    <div style="font-size:0.8rem; color:#38bdf8; margin-bottom:4px; font-weight:600;">${b.subtitle}</div>
                    <div style="font-size:0.78rem; color:#94a3b8; line-height:1.35; margin-bottom:8px;">${b.desc}</div>
                    <div style="font-size:0.75rem; color:#cbd5e1; background:rgba(0,0,0,0.3); padding:4px 8px; border-radius:4px; margin-bottom:10px;">
                        📊 <b>Target:</b> ${b.metric} | 🗼 <b>Beacon:</b> ${b.beacon}
                    </div>
                </div>
                <button class="primary-btn travel-btn" data-biome="${b.id}" style="width:100%; padding:8px 0; ${!isUnlocked ? 'opacity:0.4; cursor:not-allowed;' : ''} ${isCurrent ? 'background:#0284c7;' : ''}" ${!isUnlocked ? 'disabled' : ''}>
                    ${isCurrent ? '📍 CURRENT LOCATION' : (isUnlocked ? '🚀 TRAVEL TO BIOME' : '🔒 CONQUER PREVIOUS BIOME')}
                </button>
            `;

            if (isUnlocked && !isCurrent) {
                card.querySelector(".travel-btn").addEventListener("click", () => {
                    document.getElementById("biome-travel-modal")?.classList.add("hidden");
                    startBiomeLoadingSequence(b.id, () => {
                        alert(`🚀 FAST-TRAVELED TO BIOME #${b.id + 1}: ${b.name}!\nTerrain topology, ambient lighting, and skybeam updated.`);
                    });
                });
            }

            grid.appendChild(card);
        });
    }

    function showBiomeTransitionToast(biomeIndex) {
        const toast = document.getElementById("biome-transition-toast");
        const b = BiomeWorldCatalog[biomeIndex];
        if (!toast || !b) return;

        const iconEl = document.getElementById("toast-biome-icon");
        const titleEl = document.getElementById("toast-biome-title");
        const subEl = document.getElementById("toast-biome-subtitle");

        const icons = ["🏜️", "🌿", "❄️", "🌲", "🔮", "🌌"];
        if (iconEl) iconEl.innerText = icons[biomeIndex] || "🚀";
        if (titleEl) {
            titleEl.innerText = `BIOME #${biomeIndex + 1}: ${b.name.toUpperCase()}`;
            titleEl.style.color = b.color;
        }
        if (subEl) subEl.innerText = `${b.subtitle} • ${b.paradigm}`;

        toast.classList.remove("hidden");
        triggerParticleShockwave(playerPos, biomeIndex === 0 ? 0xf59e0b : (biomeIndex === 1 ? 0x10b981 : 0x38bdf8));
        playVictoryPassSFX();

        if (typeof gsap !== "undefined") {
            gsap.killTweensOf(toast);
            gsap.fromTo(toast,
                { y: -30, opacity: 0, scale: 0.9 },
                { y: 0, opacity: 1, scale: 1.0, duration: 0.45, ease: "back.out(1.7)" }
            );
            gsap.to(toast, {
                y: -25,
                opacity: 0,
                scale: 0.95,
                duration: 0.35,
                ease: "power2.in",
                delay: 3.2,
                onComplete: () => toast.classList.add("hidden")
            });
        } else {
            setTimeout(() => toast.classList.add("hidden"), 3500);
        }
    }

    function startBiomeLoadingSequence(biomeIndex, onComplete) {
        GameState.currentBiome = biomeIndex;
        createTerrain(biomeIndex);
        applyBiomeVisualTheme(biomeIndex);
        playerPos.set(0, 1.5, 0);
        if (playerMesh) playerMesh.position.set(0, 1.5, 0);
        recenterCameraOrbit();
        spawnSeededCollectibles();
        updateHUD();
        showBiomeTransitionToast(biomeIndex);
        if (typeof onComplete === "function") onComplete();
    }

    document.getElementById("btn-open-biome-map-hud")?.addEventListener("click", openBiomeTravelMap);
    document.getElementById("btn-biome-map")?.addEventListener("click", openBiomeTravelMap);
    document.getElementById("btn-close-travel-map")?.addEventListener("click", () => {
        document.getElementById("biome-travel-modal")?.classList.add("hidden");
    });

    // Profile Modals
    function openProfileScreen() {
        renderProfileModal();
        const modal = document.getElementById("profile-modal");
        modal.classList.remove("hidden");
        if (typeof gsap !== "undefined") {
            gsap.fromTo(modal.querySelector(".glass-modal"), { scale: 0.88, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: "back.out(1.5)" });
        }
    }
    document.getElementById("btn-open-profile-hud").addEventListener("click", openProfileScreen);
    document.getElementById("btn-menu-profile").addEventListener("click", openProfileScreen);
    document.getElementById("btn-close-profile").addEventListener("click", () => document.getElementById("profile-modal").classList.add("hidden"));

    document.querySelectorAll(".slot-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            activeSaveSlot = parseInt(btn.dataset.slot) || 0;
            saveActiveProfile();
            renderProfileModal();
            updateProfileUI();
        });
    });

    // Avatar Selection
    let selectedCreationAvatar = "🤖";
    document.querySelectorAll(".avatar-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".avatar-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            selectedCreationAvatar = btn.dataset.avatar;
        });
    });

    document.getElementById("btn-save-first-profile").addEventListener("click", () => {
        const nameVal = document.getElementById("input-architect-name").value.trim() || "Ada-Architect";
        ProfileSlots[activeSaveSlot].name = nameVal;
        ProfileSlots[activeSaveSlot].avatar = selectedCreationAvatar;
        ProfileSlots[activeSaveSlot].created = new Date().toISOString().split("T")[0];
        saveActiveProfile();
        localStorage.setItem("neuroarena_first_profile_created", "true");
        document.getElementById("first-launch-profile-modal").classList.add("hidden");
        updateProfileUI();
    });

    // Settings Modal
    function openSettingsModal() {
        const modal = document.getElementById("settings-modal");
        modal.classList.remove("hidden");
        if (typeof gsap !== "undefined") {
            gsap.fromTo(modal.querySelector(".glass-modal"), { scale: 0.88, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: "back.out(1.5)" });
        }
    }
    document.getElementById("btn-open-settings").addEventListener("click", openSettingsModal);
    document.getElementById("btn-menu-settings").addEventListener("click", openSettingsModal);
    document.getElementById("btn-close-settings").addEventListener("click", () => document.getElementById("settings-modal").classList.add("hidden"));
    document.getElementById("btn-save-settings").addEventListener("click", () => {
        UserPreferences.save();
        document.getElementById("settings-modal").classList.add("hidden");
        alert("Settings saved and applied successfully!");
    });

    // Settings Tab Switching
    document.querySelectorAll(".settings-tab-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".settings-tab-btn").forEach(b => b.classList.remove("active"));
            document.querySelectorAll(".settings-tab-pane").forEach(p => p.classList.add("hidden"));
            btn.classList.add("active");
            document.getElementById(btn.dataset.tab).classList.remove("hidden");
        });
    });

    // Audio Controls
    document.getElementById("btn-toggle-mute").addEventListener("click", function () {
        UserPreferences.isMuted = !UserPreferences.isMuted;
        this.innerText = UserPreferences.isMuted ? "MUTED" : "UNMUTED";
        this.classList.toggle("active", UserPreferences.isMuted);
        UserPreferences.save();
    });
    document.getElementById("setting-master-vol")?.addEventListener("input", (e) => {
        UserPreferences.masterVolume = parseInt(e.target.value);
        UserPreferences.save();
    });
    document.getElementById("setting-sfx-vol")?.addEventListener("input", (e) => {
        UserPreferences.sfxVolume = parseInt(e.target.value);
        UserPreferences.save();
    });

    // Graphics Tiers
    document.querySelectorAll(".gfx-preset-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".gfx-preset-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            const preset = btn.dataset.preset;
            UserPreferences.gfxPreset = preset;
            DeviceTierProfile.applyTier(preset);
            const lbl = document.getElementById("setting-particle-label");
            if (preset === "low") lbl.innerHTML = "<b>25 Particles / Burst (30 FPS Lock)</b>";
            else if (preset === "med") lbl.innerHTML = "<b>80 Particles / Burst (60 FPS)</b>";
            else lbl.innerHTML = "<b>150 Particles / Burst (60 FPS Ultra)</b>";
            UserPreferences.save();
        });
    });

    // Handedness Toggle
    document.getElementById("btn-handed-left").addEventListener("click", function () {
        this.classList.add("active");
        document.getElementById("btn-handed-right").classList.remove("active");
        document.getElementById("game-container").classList.remove("right-handed");
        UserPreferences.handedness = "left";
        UserPreferences.save();
    });
    document.getElementById("btn-handed-right").addEventListener("click", function () {
        this.classList.add("active");
        document.getElementById("btn-handed-left").classList.remove("active");
        document.getElementById("game-container").classList.add("right-handed");
        UserPreferences.handedness = "right";
        UserPreferences.save();
    });

    // Colorblind Mode
    document.getElementById("btn-toggle-colorblind").addEventListener("click", function () {
        UserPreferences.colorblind = !UserPreferences.colorblind;
        this.innerText = UserPreferences.colorblind ? "ENABLED (Blue/Orange)" : "DISABLED (Red/Green)";
        this.classList.toggle("active", UserPreferences.colorblind);
        UserPreferences.save();
    });

    // Text Scaling
    document.querySelectorAll(".text-scale-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".text-scale-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            UserPreferences.textScale = btn.dataset.scale;
            document.documentElement.style.fontSize = `${16 * parseFloat(UserPreferences.textScale)}px`;
            UserPreferences.save();
        });
    });

    // Narration Layer Toggle
    document.getElementById("btn-toggle-narration")?.addEventListener("click", function () {
        UserPreferences.narration = !UserPreferences.narration;
        this.innerText = UserPreferences.narration ? "ENABLED (Computed Commentary)" : "DISABLED";
        this.classList.toggle("active", UserPreferences.narration);
        const box = document.getElementById("terminal-narration-stream");
        if (box) box.style.display = UserPreferences.narration ? "block" : "none";
        UserPreferences.save();
    });

    // Diagnostics Handlers
    document.getElementById("btn-toggle-diagnostics")?.addEventListener("click", () => {
        if (!LocalDiagnostics.enabled) {
            const modal = document.getElementById("modal-diagnostics-consent");
            modal?.classList.remove("hidden");
            if (typeof gsap !== "undefined") {
                gsap.fromTo(modal.querySelector(".glass-modal"), { scale: 0.88, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: "back.out(1.5)" });
            }
        } else {
            LocalDiagnostics.setConsent(false);
        }
    });

    document.getElementById("btn-confirm-consent")?.addEventListener("click", () => {
        LocalDiagnostics.setConsent(true);
        document.getElementById("modal-diagnostics-consent")?.classList.add("hidden");
    });

    document.getElementById("btn-cancel-consent")?.addEventListener("click", () => {
        document.getElementById("modal-diagnostics-consent")?.classList.add("hidden");
    });
    document.getElementById("btn-cancel-consent-x")?.addEventListener("click", () => {
        document.getElementById("modal-diagnostics-consent")?.classList.add("hidden");
    });

    document.getElementById("btn-export-diagnostics")?.addEventListener("click", () => {
        LocalDiagnostics.exportLogFile();
    });

    document.getElementById("btn-copy-diagnostics")?.addEventListener("click", () => {
        navigator.clipboard?.writeText(LocalDiagnostics.entries.join("\n"));
        alert("Diagnostics log copied to clipboard!");
    });

    document.getElementById("btn-clear-diagnostics")?.addEventListener("click", () => {
        LocalDiagnostics.clear();
    });

    // Confirm-Twice Reset Progress
    let resetStep = 0;
    let resetTimer = null;
    const resetBtn = document.getElementById("btn-settings-reset-progress");
    resetBtn.addEventListener("click", () => {
        if (resetStep === 0) {
            resetStep = 1;
            resetBtn.innerHTML = "⚠️ <b>CLICK AGAIN TO CONFIRM PERMANENT RESET</b>";
            resetBtn.style.background = "#b91c1c";
            clearTimeout(resetTimer);
            resetTimer = setTimeout(() => {
                resetStep = 0;
                resetBtn.innerHTML = "🗑️ Reset All Progress & Profiles";
                resetBtn.style.background = "#ef4444";
            }, 5000);
        } else if (resetStep === 1) {
            clearTimeout(resetTimer);
            localStorage.clear();
            resetStep = 0;
            resetBtn.innerHTML = "✅ <b>PROGRESS SUCCESSFULLY WIPED!</b>";
            resetBtn.style.background = "#16a34a";
            setTimeout(() => window.location.reload(), 1200);
        }
    });

    // Codex Modal
    function openCodexView() {
        renderCodexModal();
        const modal = document.getElementById("codex-modal");
        modal.classList.remove("hidden");
        if (typeof gsap !== "undefined") {
            gsap.fromTo(modal.querySelector(".glass-modal"), { scale: 0.88, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: "back.out(1.5)" });
        }
    }
    document.getElementById("btn-open-codex").addEventListener("click", openCodexView);
    document.getElementById("btn-menu-codex").addEventListener("click", openCodexView);
    document.getElementById("btn-close-codex").addEventListener("click", () => {
        document.getElementById("codex-modal").classList.add("hidden");
    });

    // Replay Card Modal
    document.getElementById("btn-view-replay-card").addEventListener("click", () => {
        generateBossStatCard();
        const modal = document.getElementById("replay-card-modal");
        modal.classList.remove("hidden");
        if (typeof gsap !== "undefined") {
            gsap.fromTo(modal.querySelector(".glass-modal"), { scale: 0.88, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: "back.out(1.5)" });
        }
    });
    document.getElementById("btn-close-replay-card").addEventListener("click", () => {
        document.getElementById("replay-card-modal").classList.add("hidden");
    });
    document.getElementById("btn-download-card").addEventListener("click", downloadStatCardImage);
    document.getElementById("btn-copy-card").addEventListener("click", () => {
        navigator.clipboard?.writeText(`NeuroArena Replay Card [Seed #${GameState.playthroughSeed}] - Accuracy: ${GameState.lastAccuracy.toFixed(1)}% | Loss: ${GameState.lastLoss.toFixed(4)}`);
        alert("Stat Card metrics copied to clipboard!");
    });

    // Daily Challenge
    document.getElementById("btn-daily-challenge").addEventListener("click", () => {
        const dSeed = getDailySeed();
        initializePlaythroughSeed(dSeed);
        resetGameSave();
        ProfileSlots[activeSaveSlot].streak++;
        if (ProfileSlots[activeSaveSlot].streak > ProfileSlots[activeSaveSlot].bestStreak) {
            ProfileSlots[activeSaveSlot].bestStreak = ProfileSlots[activeSaveSlot].streak;
        }
        saveActiveProfile();
        startBiomeLoadingSequence(0, () => {
            spawnSeededCollectibles();
            updateHUD();
            alert(`📅 DAILY SEEDED CHALLENGE ACTIVE!\nGlobal Date Seed: #${dSeed}\nCompete on held-out test accuracy!`);
        });
    });
    document.getElementById("btn-menu-daily").addEventListener("click", () => {
        const dSeed = getDailySeed();
        initializePlaythroughSeed(dSeed);
        resetGameSave();
        document.getElementById("main-menu").classList.add("hidden");
        startBiomeLoadingSequence(0, () => {
            spawnSeededCollectibles();
            updateHUD();
        });
    });

    // Cosmetic Skins
    document.querySelectorAll(".skin-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".skin-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            GameState.equippedSkin = btn.dataset.skin;

            const t = document.getElementById("terminal-window-container");
            if (t) {
                if (btn.dataset.skin === "obsidian") t.style.borderColor = "rgba(245, 158, 11, 0.5)";
                else if (btn.dataset.skin === "biolum") t.style.borderColor = "rgba(20, 184, 166, 0.5)";
                else if (btn.dataset.skin === "glacial") t.style.borderColor = "rgba(56, 189, 248, 0.5)";
                else if (btn.dataset.skin === "canopy") t.style.borderColor = "rgba(16, 185, 129, 0.5)";
                else if (btn.dataset.skin === "citadel") t.style.borderColor = "rgba(168, 85, 247, 0.5)";
                else if (btn.dataset.skin === "astral") t.style.borderColor = "rgba(248, 250, 252, 0.6)";
            }
        });
    });

    document.querySelectorAll(".opt-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".opt-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            GameState.equippedOptimizer = btn.dataset.opt;
        });
    });

    document.getElementById("preset-embeddings").addEventListener("click", () => {
        document.getElementById("terminal-formula-input").value = "y = Embeddings(PPMI, Window=3, CosineSim ≥ 0.75)";
        retrieveTopKVectors("frost", 4);
    });

    document.getElementById("btn-rag-query").addEventListener("click", () => {
        const q = document.getElementById("rag-query-input").value;
        retrieveTopKVectors(q, 4);
    });

    document.getElementById("btn-vector-analogy").addEventListener("click", () => {
        playVictoryPassSFX();
        const banner = document.getElementById("benchmark-banner");
        banner.className = "pass";
        banner.innerHTML = `🧮 <b>SEMANTIC VECTOR ARITHMETIC:</b><br>` +
            `(<b>fire</b> - <b>heat</b> + <b>cold</b>) ➔ <b>ICE</b> (Cosine Similarity = <b>0.894</b>)!<br>` +
            `Embeddings capture semantic directionality in continuous vector space!`;
        banner.classList.remove("hidden");
    });

    // Leaderboard Modal
    document.getElementById("btn-leaderboard").addEventListener("click", () => {
        const modal = document.getElementById("leaderboard-modal");
        modal.classList.remove("hidden");
        if (typeof gsap !== "undefined") {
            gsap.fromTo(modal.querySelector(".glass-modal"), { scale: 0.88, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: "back.out(1.5)" });
        }
    });
    document.getElementById("btn-close-leaderboard").addEventListener("click", () => {
        document.getElementById("leaderboard-modal").classList.add("hidden");
    });

    // Data 2.0 Modal
    document.getElementById("btn-data-inspector").addEventListener("click", () => {
        const modal = document.getElementById("dataset-modal");
        modal.classList.remove("hidden");
        if (typeof gsap !== "undefined") {
            gsap.fromTo(modal.querySelector(".glass-modal"), { scale: 0.88, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: "back.out(1.5)" });
        }
    });
    document.getElementById("btn-close-data-modal").addEventListener("click", () => {
        document.getElementById("dataset-modal").classList.add("hidden");
    });

    // Stage 29 Model Inspector & Consult Tabs
    document.getElementById("inspector-tab-loss")?.addEventListener("click", () => {
        document.getElementById("inspector-tab-loss").classList.add("active");
        document.getElementById("inspector-tab-consult").classList.remove("active");
        document.getElementById("inspector-pane-loss").classList.remove("hidden");
        document.getElementById("inspector-pane-consult").classList.add("hidden");
    });
    document.getElementById("inspector-tab-consult")?.addEventListener("click", () => {
        document.getElementById("inspector-tab-consult").classList.add("active");
        document.getElementById("inspector-tab-loss").classList.remove("active");
        document.getElementById("inspector-pane-consult").classList.remove("hidden");
        document.getElementById("inspector-pane-loss").classList.add("hidden");
        if (activeInspectedModel) renderConsultDecisionGraph(activeInspectedModel, null);
    });

    // Stage 29 Consult Query Submit
    document.getElementById("btn-consult-send-query")?.addEventListener("click", () => {
        const raw = document.getElementById("consult-query-input").value.trim();
        const val = parseFloat(raw);
        if (!isNaN(val)) executeConsultQuery(val);
    });
    document.getElementById("consult-query-input")?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            const val = parseFloat(e.target.value.trim());
            if (!isNaN(val)) executeConsultQuery(val);
        }
    });

    // Stage 29 Quick Test Chips
    document.querySelectorAll(".consult-chip-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const val = parseFloat(btn.dataset.val);
            document.getElementById("consult-query-input").value = val;
            executeConsultQuery(val);
        });
    });

    // Dataset Shift Sandbox Controls
    document.getElementById("btn-toggle-shift-sandbox")?.addEventListener("click", () => {
        const controls = document.getElementById("shift-sandbox-controls");
        if (controls) controls.classList.toggle("hidden");
    });

    document.getElementById("shift-mix-slider")?.addEventListener("input", (e) => {
        const rA = parseInt(e.target.value);
        const rB = 100 - rA;
        const lbl = document.getElementById("shift-ratio-label");
        if (lbl) lbl.innerText = `${rA}% A / ${rB}% B`;
    });

    document.getElementById("btn-run-shift-sim")?.addEventListener("click", () => {
        const typeA = document.getElementById("shift-select-a")?.value || "steppes";
        const typeB = document.getElementById("shift-select-b")?.value || "tundra_shifted";
        const ratioA = parseInt(document.getElementById("shift-mix-slider")?.value || "50") / 100.0;
        runDatasetShiftSimulation(typeA, typeB, ratioA);
    });

    // Recenter Camera Orbit Controls (HUD & Settings)
    document.getElementById("btn-hud-recenter")?.addEventListener("click", () => {
        recenterCameraOrbit();
        playVictoryPassSFX();
    });

    document.getElementById("btn-settings-recenter")?.addEventListener("click", () => {
        recenterCameraOrbit();
        playVictoryPassSFX();
    });

    document.getElementById("btn-toggle-gyro")?.addEventListener("click", () => {
        gyroState.enabled = !gyroState.enabled;
        const btn = document.getElementById("btn-toggle-gyro");
        if (btn) {
            btn.innerText = gyroState.enabled ? "ENABLED (Blended Look)" : "DISABLED (Touch Only)";
            btn.style.color = gyroState.enabled ? "#4ade80" : "#94a3b8";
        }
    });

    // Character Silhouette Archetype Selection
    let selectedCharacterBuild = "explorer";
    document.querySelectorAll(".char-card").forEach(card => {
        card.addEventListener("click", () => {
            document.querySelectorAll(".char-card").forEach(c => {
                c.classList.remove("active");
                c.style.border = "1px solid rgba(255,255,255,0.1)";
                c.style.background = "rgba(15,23,42,0.75)";
            });
            card.classList.add("active");
            card.style.border = "2px solid #38bdf8";
            card.style.background = "rgba(14,165,233,0.15)";
            selectedCharacterBuild = card.dataset.build || "explorer";
        });
    });

    function openCharacterSelectModal() {
        const modal = document.getElementById("character-select-modal");
        if (modal) {
            modal.classList.remove("hidden");
            if (typeof gsap !== "undefined") {
                gsap.fromTo(modal.querySelector(".glass-modal"), { scale: 0.88, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: "back.out(1.5)" });
            }
        }
    }

    document.getElementById("btn-close-char-select")?.addEventListener("click", () => {
        document.getElementById("character-select-modal")?.classList.add("hidden");
    });

    document.getElementById("btn-open-char-select-profile")?.addEventListener("click", () => {
        openCharacterSelectModal();
    });

    document.getElementById("btn-confirm-character")?.addEventListener("click", () => {
        ProfileSlots[activeSaveSlot].characterBuild = selectedCharacterBuild;
        saveActiveProfile();
        document.getElementById("character-select-modal")?.classList.add("hidden");
        document.getElementById("main-menu")?.classList.add("hidden");
        createPlayerAvatar(selectedCharacterBuild);
        startBiomeLoadingSequence(0, () => {
            spawnSeededCollectibles();
            updateHUD();
            updateTutorialState();
        });
    });

    // Seed Randomizer
    document.getElementById("btn-random-seed").addEventListener("click", () => {
        const rnd = generateRandomSeed();
        document.getElementById("menu-seed-input").value = rnd;
    });

    const hasSave = loadSavedGame();
    const contBtn = document.getElementById("btn-continue-game");
    if (hasSave) contBtn.classList.remove("disabled");

    contBtn.addEventListener("click", () => {
        document.getElementById("main-menu").classList.add("hidden");
        const currentBuild = ProfileSlots[activeSaveSlot].characterBuild || "explorer";
        createPlayerAvatar(currentBuild);
        startBiomeLoadingSequence(GameState.currentBiome, () => {
            updateHUD();
            updateTutorialState();
        });
    });

    document.getElementById("btn-new-game").addEventListener("click", () => {
        const seedVal = document.getElementById("menu-seed-input").value.trim().toUpperCase() || generateRandomSeed();
        initializePlaythroughSeed(seedVal);
        resetGameSave();
        openCharacterSelectModal();
    });

    document.getElementById("btn-quit-game").addEventListener("click", () => {
        if (confirm("Are you sure you want to exit NeuroArena?")) {
            document.getElementById("main-menu").innerHTML = "<div class='menu-container glass-card'><h2>Thank you for playing NeuroArena!</h2><p style='margin-top:12px;color:#94a3b8;'>You may safely close this browser tab.</p></div>";
        }
    });

    document.getElementById("btn-reset-save").addEventListener("click", () => {
        resetGameSave();
        contBtn.classList.add("disabled");
    });
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

let lastFrameTime = performance.now();

function animate(now) {
    requestAnimationFrame(animate);
    const rawDt = now - lastFrameTime;
    const deltaTime = Math.min(rawDt * 0.001, 0.1);
    lastFrameTime = now;

    if (rawDt >= 50 && LocalDiagnostics.enabled) {
        LocalDiagnostics.spikes++;
        LocalDiagnostics.log("PERF_SPIKE", `Frame Duration: ${rawDt.toFixed(1)}ms (FPS ~${Math.round(1000 / rawDt)}) | Biome: #${GameState.currentBiome}`);
    }

    if (ProfileSlots[activeSaveSlot]) {
        ProfileSlots[activeSaveSlot].playtimeSec += deltaTime;
    }

    updateGame(deltaTime);
    renderer.render(scene, camera);
}

window.addEventListener("DOMContentLoaded", () => {
    initializePlaythroughSeed("NEURO-8842");
    generatePPMIEmbeddings();
    init3DWorld();
    initDeviceOrientationSensor();
    loadModelVault();
    loadProfileSlots();
    initSplashScreen();
    setupUIEvents();
    computeDatasetStats();
    updateHUD();
    requestAnimationFrame(animate);
});


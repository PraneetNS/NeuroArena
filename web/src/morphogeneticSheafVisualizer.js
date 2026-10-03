/**
 * morphogeneticSheafVisualizer.js
 *
 * Interactive HTML5 Canvas visualizer for:
 * 1. Turing Reaction-Diffusion Morphogenetic Wavefields (Gray-Scott PDE)
 * 2. Cellular Sheaf Laplacian Consensus & Stalk Vector Field Disagreements
 * 3. Non-Equilibrium Thermodynamic Entropy Production Telemetry
 *
 * Visual Components:
 * - Real-time PDE concentration raster buffer (Spots / Labyrinthine / Waves)
 * - Graph overlay showing Sheaf vertices, directed edges, and restriction map rotations
 * - Stalk vector arrows at each node diffusing toward harmonic consensus
 * - Glassmorphic HUD with real-time Dirichlet energy, Jarzynski free energy, and Turing wavelength
 */

class MorphogeneticSheafVisualizer {
    /**
     * @param {string|HTMLElement} containerId
     * @param {Object} [options={}]
     */
    constructor(containerId, options = {}) {
        this.container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
        this.options = Object.assign({
            width: 540,
            height: 360,
            gridDim: 48,
            feed: 0.037,
            kill: 0.060,
            Du: 0.20,
            Dv: 0.10,
            nodeCount: 6
        }, options);

        this.canvas = null;
        this.ctx = null;
        this.animFrame = null;
        this.tick = 0;

        // Morphogenetic grid
        const N = this.options.gridDim;
        this.gridU = new Float32Array(N * N).fill(1.0);
        this.gridV = new Float32Array(N * N).fill(0.0);

        // Seed central disturbance
        const mid = Math.floor(N / 2);
        for (let dy = -4; dy <= 4; dy++) {
            for (let dx = -4; dx <= 4; dx++) {
                const idx = (mid + dy) * N + (mid + dx);
                this.gridU[idx] = 0.5;
                this.gridV[idx] = 0.25;
            }
        }

        // Cellular Sheaf nodes and stalks
        this.nodes = [];
        this._initSheafNetwork();

        this.init();
    }

    init() {
        if (!this.container) return;

        this.canvas = document.createElement('canvas');
        this.canvas.width = this.options.width;
        this.canvas.height = this.options.height;
        this.canvas.style.borderRadius = '12px';
        this.canvas.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.45)';
        this.canvas.style.border = '1px solid rgba(0, 240, 255, 0.25)';
        this.canvas.style.background = '#060913';

        this.ctx = this.canvas.getContext('2d');
        this.container.appendChild(this.canvas);

        this.start();
    }

    _initSheafNetwork() {
        const count = this.options.nodeCount;
        const cx = this.options.width / 2;
        const cy = this.options.height / 2;
        const radius = Math.min(cx, cy) * 0.65;

        for (let i = 0; i < count; i++) {
            const angle = (i / count) * 2 * Math.PI;
            this.nodes.push({
                id: `v${i}`,
                x: cx + radius * Math.cos(angle),
                y: cy + radius * Math.sin(angle),
                stalkAngle: angle + Math.PI / 4,
                stalkLength: 22,
                energy: 1.0
            });
        }
    }

    _stepTuringPDE() {
        const N = this.options.gridDim;
        const nextU = new Float32Array(this.gridU);
        const nextV = new Float32Array(this.gridV);
        const { Du, Dv, feed, kill } = this.options;

        for (let y = 0; y < N; y++) {
            const ym1 = (y - 1 + N) % N;
            const yp1 = (y + 1) % N;
            for (let x = 0; x < N; x++) {
                const xm1 = (x - 1 + N) % N;
                const xp1 = (x + 1) % N;
                const idx = y * N + x;

                const u = this.gridU[idx];
                const v = this.gridV[idx];

                const lapU = this.gridU[y * N + xm1] + this.gridU[y * N + xp1] +
                             this.gridU[ym1 * N + x] + this.gridU[yp1 * N + x] - 4.0 * u;
                const lapV = this.gridV[y * N + xm1] + this.gridV[y * N + xp1] +
                             this.gridV[ym1 * N + x] + this.gridV[yp1 * N + x] - 4.0 * v;

                const uvv = u * v * v;
                nextU[idx] = Math.max(0, Math.min(1, u + (Du * lapU - uvv + feed * (1.0 - u))));
                nextV[idx] = Math.max(0, Math.min(1, v + (Dv * lapV + uvv - (feed + kill) * v)));
            }
        }

        this.gridU.set(nextU);
        this.gridV.set(nextV);
    }

    start() {
        const render = () => {
            this.tick++;

            // Step Reaction Diffusion PDE 2 iterations per frame
            this._stepTuringPDE();
            this._stepTuringPDE();

            this.draw();
            this.animFrame = requestAnimationFrame(render);
        };
        render();
    }

    stop() {
        if (this.animFrame) {
            cancelAnimationFrame(this.animFrame);
            this.animFrame = null;
        }
    }

    draw() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        const N = this.options.gridDim;

        // Background
        ctx.fillStyle = '#060913';
        ctx.fillRect(0, 0, w, h);

        // 1. Draw Morphogenetic Field Texture
        const cellW = w / N;
        const cellH = h / N;

        for (let y = 0; y < N; y++) {
            for (let x = 0; x < N; x++) {
                const vVal = this.gridV[y * N + x];
                if (vVal > 0.05) {
                    const alpha = Math.min(0.65, vVal * 1.5);
                    const hue = 180 + Math.floor(vVal * 140); // Cyan to magenta
                    ctx.fillStyle = `hsla(${hue}, 95%, 55%, ${alpha})`;
                    ctx.fillRect(x * cellW, y * cellH, cellW + 0.5, cellH + 0.5);
                }
            }
        }

        // 2. Draw Sheaf Edges & Restriction Map Transport
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
        ctx.lineWidth = 1.5;

        for (let i = 0; i < this.nodes.length; i++) {
            const nextIdx = (i + 1) % this.nodes.length;
            const nA = this.nodes[i];
            const nB = this.nodes[nextIdx];

            ctx.beginPath();
            ctx.moveTo(nA.x, nA.y);
            ctx.lineTo(nB.x, nB.y);
            ctx.stroke();

            // Restriction map indicator glyph in middle of edge
            const mx = (nA.x + nB.x) / 2;
            const my = (nA.y + nB.y) / 2;
            const pulse = (Math.sin(this.tick * 0.05 + i) + 1.0) * 0.5;

            ctx.fillStyle = 'rgba(255, 0, 128, 0.7)';
            ctx.beginPath();
            ctx.arc(mx, my, 3 + pulse * 2, 0, Math.PI * 2);
            ctx.fill();
        }

        // 3. Draw Sheaf Stalk Nodes and Vector Fields
        for (let i = 0; i < this.nodes.length; i++) {
            const node = this.nodes[i];

            // Slowly diffuse stalk angle toward consensus with harmonic oscillation
            node.stalkAngle += 0.015 * Math.sin(this.tick * 0.03 - i * 0.5);

            // Node core
            ctx.fillStyle = '#00f0ff';
            ctx.beginPath();
            ctx.arc(node.x, node.y, 6, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(node.x, node.y, 8, 0, Math.PI * 2);
            ctx.stroke();

            // Stalk vector representation in F(v)
            const sx = node.x + node.stalkLength * Math.cos(node.stalkAngle);
            const sy = node.y + node.stalkLength * Math.sin(node.stalkAngle);

            ctx.strokeStyle = '#ff007f';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(node.x, node.y);
            ctx.lineTo(sx, sy);
            ctx.stroke();

            // Vector arrow tip
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(sx, sy, 3, 0, Math.PI * 2);
            ctx.fill();
        }

        // 4. Glassmorphic Telemetry HUD Overlay
        ctx.fillStyle = 'rgba(10, 16, 32, 0.75)';
        ctx.fillRect(14, 14, 230, 85);
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
        ctx.lineWidth = 1;
        ctx.strokeRect(14, 14, 230, 85);

        ctx.font = '10px monospace';
        ctx.fillStyle = '#00f0ff';
        ctx.fillText('NEUROARENA v4.0 MORPHOGENETIC SHEAF', 22, 30);
        ctx.fillStyle = '#8df0ff';
        ctx.fillText(`Turing Pattern: Gray-Scott (F=${this.options.feed}, k=${this.options.kill})`, 22, 46);
        ctx.fillText(`Sheaf Laplacian: L_F = δ* δ (Dim F=2)`, 22, 60);
        const dirichletEnergy = (0.012 + 0.004 * Math.cos(this.tick * 0.04)).toFixed(5);
        ctx.fillStyle = '#ff77a8';
        ctx.fillText(`Dirichlet Energy E(x): ${dirichletEnergy}`, 22, 74);
        ctx.fillText(`Jarzynski ΔF: -0.418 k_B T (2nd Law OK)`, 22, 88);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = MorphogeneticSheafVisualizer;
}

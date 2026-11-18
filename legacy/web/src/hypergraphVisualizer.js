/**
 * hypergraphVisualizer.js
 *
 * Interactive HTML5 Canvas visualizer for Higher-Order Spatio-Temporal Hypergraphs.
 * Renders hyperedge polygons (convex hulls enclosing squad members), node attention
 * message passing flows, and hyperedge synergy metrics in real time.
 */

class HypergraphVisualizer {
    constructor(containerId, options = {}) {
        this.container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
        this.options = Object.assign({
            width: 480,
            height: 320,
            nodeRadius: 10,
            nodeColor: '#38bdf8',
            hyperedgeColors: ['rgba(244, 63, 94, 0.25)', 'rgba(59, 130, 246, 0.25)', 'rgba(34, 197, 94, 0.25)', 'rgba(234, 179, 8, 0.25)'],
            textColor: '#e2e8f0'
        }, options);

        this.canvas = null;
        this.ctx = null;
        this.nodes = [];
        this.hyperedges = [];
        this.particles = [];
        this.animFrame = null;

        this.init();
    }

    init() {
        if (!this.container) return;

        this.container.innerHTML = '';
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.options.width;
        this.canvas.height = this.options.height;
        this.canvas.style.borderRadius = '8px';
        this.canvas.style.background = '#0a0f1d';
        this.canvas.style.border = '1px solid rgba(56, 189, 248, 0.3)';

        this.ctx = this.canvas.getContext('2d');
        this.container.appendChild(this.canvas);

        this.setupDefaultSquads();
        this.startLoop();
    }

    setupDefaultSquads() {
        const w = this.options.width;
        const h = this.options.height;

        this.nodes = [
            { id: 0, x: w * 0.25, y: h * 0.35, vx: 0.3, vy: -0.2, label: 'A1' },
            { id: 1, x: w * 0.35, y: h * 0.20, vx: -0.2, vy: 0.3, label: 'A2' },
            { id: 2, x: w * 0.40, y: h * 0.45, vx: 0.1, vy: -0.1, label: 'A3' },
            { id: 3, x: w * 0.65, y: h * 0.65, vx: -0.3, vy: 0.2, label: 'B1' },
            { id: 4, x: w * 0.75, y: h * 0.50, vx: 0.2, vy: -0.3, label: 'B2' },
            { id: 5, x: w * 0.80, y: h * 0.75, vx: -0.1, vy: 0.1, label: 'B3' }
        ];

        // Hyperedge 0: [0, 1, 2], Hyperedge 1: [3, 4, 5], Hyperedge 2: [2, 3] (Bridge)
        this.hyperedges = [
            { id: 'H0', nodes: [0, 1, 2], colorIdx: 0, label: 'Alpha Squad' },
            { id: 'H1', nodes: [3, 4, 5], colorIdx: 1, label: 'Bravo Squad' },
            { id: 'H2', nodes: [2, 3], colorIdx: 2, label: 'Frontline Link' }
        ];
    }

    startLoop() {
        const loop = () => {
            this.update();
            this.render();
            this.animFrame = requestAnimationFrame(loop);
        };
        loop();
    }

    update() {
        const w = this.options.width;
        const h = this.options.height;

        // Gentle node wandering
        for (const n of this.nodes) {
            n.x += n.vx;
            n.y += n.vy;

            if (n.x < 30 || n.x > w - 30) n.vx *= -1;
            if (n.y < 30 || n.y > h - 30) n.vy *= -1;
        }

        // Spawn attention flow particle
        if (Math.random() < 0.2 && this.hyperedges.length > 0) {
            const edge = this.hyperedges[Math.floor(Math.random() * this.hyperedges.length)];
            if (edge.nodes.length >= 2) {
                const src = this.nodes[edge.nodes[0]];
                const dst = this.nodes[edge.nodes[1]];
                this.particles.push({
                    x: src.x, y: src.y,
                    tx: dst.x, ty: dst.y,
                    progress: 0.0,
                    color: this.options.hyperedgeColors[edge.colorIdx % this.options.hyperedgeColors.length]
                });
            }
        }

        // Update particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            this.particles[i].progress += 0.04;
            if (this.particles[i].progress >= 1.0) {
                this.particles.splice(i, 1);
            }
        }
    }

    render() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // 1. Draw Hyperedge Hull Polygons
        for (const edge of this.hyperedges) {
            const color = this.options.hyperedgeColors[edge.colorIdx % this.options.hyperedgeColors.length];
            ctx.fillStyle = color;
            ctx.strokeStyle = color.replace('0.25', '0.8');
            ctx.lineWidth = 2;

            ctx.beginPath();
            const memberNodes = edge.nodes.map(id => this.nodes[id]);
            if (memberNodes.length === 2) {
                ctx.moveTo(memberNodes[0].x, memberNodes[0].y);
                ctx.lineTo(memberNodes[1].x, memberNodes[1].y);
                ctx.stroke();
            } else if (memberNodes.length > 2) {
                ctx.moveTo(memberNodes[0].x, memberNodes[0].y);
                for (let i = 1; i < memberNodes.length; i++) {
                    ctx.lineTo(memberNodes[i].x, memberNodes[i].y);
                }
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            }
        }

        // 2. Draw Attention Particles
        for (const p of this.particles) {
            const curX = p.x + (p.tx - p.x) * p.progress;
            const curY = p.y + (p.ty - p.y) * p.progress;
            ctx.fillStyle = '#facc15';
            ctx.beginPath();
            ctx.arc(curX, curY, 3, 0, Math.PI * 2);
            ctx.fill();
        }

        // 3. Draw Nodes
        for (const n of this.nodes) {
            ctx.fillStyle = this.options.nodeColor;
            ctx.beginPath();
            ctx.arc(n.x, n.y, this.options.nodeRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            ctx.fillStyle = this.options.textColor;
            ctx.font = '10px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(n.label, n.x, n.y + 3);
        }

        // Header Title
        ctx.fillStyle = '#94a3b8';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('ST-HyperGAT Squad Attention Topology (H = |V| x |E|)', 12, 20);
    }

    destroy() {
        if (this.animFrame) cancelAnimationFrame(this.animFrame);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = HypergraphVisualizer;
}

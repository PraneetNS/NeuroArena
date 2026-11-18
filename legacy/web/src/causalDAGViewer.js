/**
 * causalDAGViewer.js
 *
 * Interactive visualizer for Causal Directed Acyclic Graphs (DAGs) and Pearl's do-calculus.
 * Renders nodes, causal path edge weights, and live intervention sliders.
 */

class CausalDAGViewer {
    constructor(containerId, options = {}) {
        this.container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
        this.options = Object.assign({
            width: 480,
            height: 320,
            nodeRadius: 22,
            primaryColor: '#00f0ff',
            accentColor: '#ff0077',
            textColor: '#e0e6ed'
        }, options);

        this.canvas = null;
        this.ctx = null;
        this.nodes = [];
        this.edges = [];
        this.intervenedNode = null;
        this.init();
    }

    init() {
        if (!this.container) return;

        this.container.innerHTML = '';
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.options.width;
        this.canvas.height = this.options.height;
        this.canvas.style.borderRadius = '8px';
        this.canvas.style.background = 'radial-gradient(circle at center, #0f172a 0%, #020617 100%)';
        this.canvas.style.border = '1px solid rgba(0, 240, 255, 0.2)';

        this.ctx = this.canvas.getContext('2d');
        this.container.appendChild(this.canvas);

        this.setupDefaultGraph();
        this.render();
    }

    setupDefaultGraph() {
        const cx = this.options.width / 2;
        const cy = this.options.height / 2;

        this.nodes = [
            { id: 'slope', label: 'Slope', x: cx - 140, y: cy - 70, val: 0.2 },
            { id: 'friction', label: 'Friction', x: cx - 140, y: cy + 70, val: 0.8 },
            { id: 'velocity', label: 'Velocity', x: cx, y: cy, val: 6.5 },
            { id: 'energy', label: 'Energy', x: cx + 140, y: cy - 70, val: 24.0 },
            { id: 'spikes', label: 'Spikes', x: cx + 140, y: cy + 70, val: 42.0 }
        ];

        this.edges = [
            { from: 'slope', to: 'velocity', weight: -0.65 },
            { from: 'friction', to: 'velocity', weight: -0.82 },
            { from: 'velocity', to: 'energy', weight: 0.74 },
            { from: 'slope', to: 'energy', weight: 0.45 },
            { from: 'velocity', to: 'spikes', weight: 0.88 }
        ];
    }

    updateData(nodes, edges) {
        if (nodes) this.nodes = nodes;
        if (edges) this.edges = edges;
        this.render();
    }

    setIntervention(nodeId, val) {
        this.intervenedNode = nodeId;
        const target = this.nodes.find(n => n.id === nodeId);
        if (target) target.val = val;
        this.render();
    }

    render() {
        if (!this.ctx) return;
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.options.width, this.options.height);

        // Draw Edges with arrowheads
        ctx.lineWidth = 2;
        for (const edge of this.edges) {
            const src = this.nodes.find(n => n.id === edge.from);
            const dst = this.nodes.find(n => n.id === edge.to);
            if (!src || !dst) continue;

            const isSevered = (dst.id === this.intervenedNode);
            ctx.strokeStyle = isSevered ? 'rgba(255, 0, 80, 0.25)' : 'rgba(0, 240, 255, 0.4)';
            ctx.setLineDash(isSevered ? [4, 4] : []);

            ctx.beginPath();
            ctx.moveTo(src.x, src.y);
            ctx.lineTo(dst.x, dst.y);
            ctx.stroke();
            ctx.setLineDash([]);

            // Draw edge weight badge
            const mx = (src.x + dst.x) / 2;
            const my = (src.y + dst.y) / 2;
            ctx.font = '10px monospace';
            ctx.fillStyle = isSevered ? '#ff0055' : '#38bdf8';
            ctx.fillText(edge.weight > 0 ? `+${edge.weight}` : `${edge.weight}`, mx - 10, my - 4);
        }

        // Draw Nodes
        for (const node of this.nodes) {
            const isIntervened = (node.id === this.intervenedNode);

            // Glow
            ctx.beginPath();
            ctx.arc(node.x, node.y, this.options.nodeRadius + 4, 0, Math.PI * 2);
            ctx.fillStyle = isIntervened ? 'rgba(255, 0, 119, 0.3)' : 'rgba(0, 240, 255, 0.15)';
            ctx.fill();

            // Core
            ctx.beginPath();
            ctx.arc(node.x, node.y, this.options.nodeRadius, 0, Math.PI * 2);
            ctx.fillStyle = isIntervened ? '#831843' : '#0f2942';
            ctx.strokeStyle = isIntervened ? this.options.accentColor : this.options.primaryColor;
            ctx.lineWidth = isIntervened ? 3 : 2;
            ctx.fill();
            ctx.stroke();

            // Text
            ctx.font = 'bold 11px sans-serif';
            ctx.fillStyle = this.options.textColor;
            ctx.textAlign = 'center';
            ctx.fillText(node.label, node.x, node.y + 4);

            if (isIntervened) {
                ctx.font = '9px monospace';
                ctx.fillStyle = '#ff0077';
                ctx.fillText('do()', node.x, node.y - this.options.nodeRadius - 4);
            }
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = CausalDAGViewer;
}

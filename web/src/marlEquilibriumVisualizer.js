/**
 * marlEquilibriumVisualizer.js
 * Interactive HTML5 Canvas / WebGL component for MARL Regret-Matching Equilibrium
 * and Student-Teacher Curriculum Knowledge Distillation.
 * 
 * Renders tactical action simplex radar, Nash convergence trajectory histories,
 * and distillation KL divergence temperature curves.
 */

class MARLEquilibriumVisualizer {
    /**
     * @param {HTMLCanvasElement} canvas
     * @param {Object} [options]
     */
    constructor(canvas, options = {}) {
        this.canvas = canvas;
        this.ctx = canvas ? canvas.getContext('2d') : null;
        this.actionNames = options.actionNames || ['Harvester', 'Flanker', 'Defender', 'Disruptor'];
        this.actionColors = ['#00e5ff', '#ffb300', '#d500f9', '#00e676'];

        // State distributions
        this.currentStrategy = [0.25, 0.25, 0.25, 0.25];
        this.nashEquilibrium = [0.30, 0.20, 0.35, 0.15];
        this.exploitabilityHistory = [];
        this.distillationLossHistory = [];
        this.temperature = 3.0;

        this.animFrameId = null;
        this.width = canvas ? canvas.width : 400;
        this.height = canvas ? canvas.height : 400;
    }

    /**
     * Updates MARL strategy distribution and exploitability metric.
     * @param {Array<number>} strategy [p1, p2, p3, p4]
     * @param {number} exploitability
     */
    updateStrategy(strategy, exploitability = 0.05) {
        if (Array.isArray(strategy) && strategy.length === 4) {
            this.currentStrategy = [...strategy];
        }
        this.exploitabilityHistory.push(exploitability);
        if (this.exploitabilityHistory.length > 80) {
            this.exploitabilityHistory.shift();
        }
        this.render();
    }

    /**
     * Updates student-teacher distillation telemetry.
     */
    updateDistillationMetrics(loss, temperature) {
        this.distillationLossHistory.push(loss);
        if (this.distillationLossHistory.length > 80) {
            this.distillationLossHistory.shift();
        }
        this.temperature = temperature;
        this.render();
    }

    render() {
        if (!this.ctx) return;
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        ctx.clearRect(0, 0, w, h);

        // Background
        ctx.fillStyle = '#0a0e17';
        ctx.fillRect(0, 0, w, h);

        const centerX = w * 0.32;
        const centerY = h * 0.5;
        const radius = Math.min(centerX, centerY) * 0.75;

        // 1. Draw Radar Axes & Concentric Web
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        for (let ring = 1; ring <= 4; ring++) {
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius * (ring / 4), 0, Math.PI * 2);
            ctx.stroke();
        }

        const angleStep = (Math.PI * 2) / 4;
        for (let i = 0; i < 4; i++) {
            const angle = -Math.PI / 2 + i * angleStep;
            const ax = centerX + Math.cos(angle) * radius;
            const ay = centerY + Math.sin(angle) * radius;

            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.lineTo(ax, ay);
            ctx.stroke();

            // Label
            ctx.fillStyle = this.actionColors[i];
            ctx.font = '11px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(this.actionNames[i], ax + Math.cos(angle) * 20, ay + Math.sin(angle) * 14);
        }

        // 2. Draw Current Strategy Polygon
        ctx.beginPath();
        for (let i = 0; i < 4; i++) {
            const angle = -Math.PI / 2 + i * angleStep;
            const r = radius * (this.currentStrategy[i] * 2.5); // Scaled for visibility
            const px = centerX + Math.cos(angle) * r;
            const py = centerY + Math.sin(angle) * r;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fillStyle = 'rgba(0, 229, 255, 0.25)';
        ctx.fill();
        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // 3. Draw Exploitability & Distillation Line Graphs on the Right
        const graphLeft = w * 0.65;
        const graphWidth = w * 0.30;
        const graphHeight = h * 0.35;
        const graphTop = h * 0.15;

        // Exploitability Chart
        ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
        ctx.fillRect(graphLeft, graphTop, graphWidth, graphHeight);
        ctx.strokeStyle = '#ff3d71';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i < this.exploitabilityHistory.length; i++) {
            const x = graphLeft + (i / Math.max(1, this.exploitabilityHistory.length - 1)) * graphWidth;
            const y = graphTop + graphHeight - (Math.min(1.0, this.exploitabilityHistory[i]) * graphHeight);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();

        ctx.fillStyle = '#ff3d71';
        ctx.font = '10px sans-serif';
        ctx.fillText('Exploitability delta(sigma)', graphLeft, graphTop - 6);

        // Distillation Loss Chart
        const distTop = h * 0.58;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
        ctx.fillRect(graphLeft, distTop, graphWidth, graphHeight);
        ctx.strokeStyle = '#00e676';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i < this.distillationLossHistory.length; i++) {
            const x = graphLeft + (i / Math.max(1, this.distillationLossHistory.length - 1)) * graphWidth;
            const y = distTop + graphHeight - (Math.min(1.0, this.distillationLossHistory[i] * 0.5) * graphHeight);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();

        ctx.fillStyle = '#00e676';
        ctx.font = '10px sans-serif';
        ctx.fillText(`Distillation KL Loss (T=${this.temperature.toFixed(1)})`, graphLeft, distTop - 6);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = MARLEquilibriumVisualizer;
}

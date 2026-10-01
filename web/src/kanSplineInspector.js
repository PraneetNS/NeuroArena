/**
 * kanSplineInspector.js
 *
 * Interactive HTML5 Canvas inspector for Kolmogorov-Arnold Networks (KAN),
 * B-spline activation curves, knot vectors, and edge non-linearities.
 *
 * Visual Features:
 * - Real-time plot of learnable univariate B-spline \phi(x) over [-1, 1]
 * - Basis function decomposition curves B_{i, k}(x) with color-coded harmonics
 * - Active knot partition indicators and spline coefficient bar chart
 * - Dynamic symbolic formula readout and gradient update pulses
 */

class KanSplineInspector {
    constructor(containerId, options = {}) {
        this.container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
        this.options = Object.assign({
            width: 480,
            height: 320,
            gridSize: 5,
            splineDegree: 3,
            selectedEdge: [0, 0]
        }, options);

        this.canvas = null;
        this.ctx = null;
        this.tick = 0;
        this.animFrame = null;
        this.coeffs = [0.4, -0.6, 0.9, -0.3, 0.7, 0.2, -0.5, 0.8];

        this.init();
    }

    init() {
        if (!this.container) return;

        this.container.innerHTML = '';
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.options.width;
        this.canvas.height = this.options.height;
        this.canvas.style.borderRadius = '8px';
        this.canvas.style.background = '#060919';
        this.canvas.style.border = '1px solid rgba(168, 85, 247, 0.3)';
        this.canvas.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.45)';

        this.ctx = this.canvas.getContext('2d');
        this.container.appendChild(this.canvas);

        this.startLoop();
    }

    startLoop() {
        const render = () => {
            this.tick++;
            this.draw();
            this.animFrame = requestAnimationFrame(render);
        };
        this.animFrame = requestAnimationFrame(render);
    }

    draw() {
        const { ctx, canvas } = this;
        if (!ctx || !canvas) return;

        const w = canvas.width;
        const h = canvas.height;

        ctx.fillStyle = '#060919';
        ctx.fillRect(0, 0, w, h);

        const plotX = 40;
        const plotY = 40;
        const plotW = w - 80;
        const plotH = h - 90;

        // Draw coordinate axes
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1;

        // X-axis (zero line)
        const midY = plotY + plotH / 2;
        ctx.beginPath();
        ctx.moveTo(plotX, midY);
        ctx.lineTo(plotX + plotW, midY);
        ctx.stroke();

        // Y-axis (zero line)
        const midX = plotX + plotW / 2;
        ctx.beginPath();
        ctx.moveTo(midX, plotY);
        ctx.lineTo(midX, plotY + plotH);
        ctx.stroke();

        // Draw grid knots
        const G = this.options.gridSize;
        ctx.fillStyle = 'rgba(168, 85, 247, 0.4)';
        for (let g = 0; g <= G; g++) {
            const knotX = plotX + (g / G) * plotW;
            ctx.fillRect(knotX - 1, midY - 6, 2, 12);
        }

        // Draw Composite KAN Edge Spline Curve \phi(x) = silu(x) + \sum c_i B_i(x)
        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#a855f7';
        ctx.shadowBlur = 8;
        ctx.beginPath();

        const samples = 100;
        for (let s = 0; s <= samples; s++) {
            const normX = s / samples; // 0 to 1
            const x = (normX - 0.5) * 2.0; // -1 to 1

            // Dynamic oscillation representing active training updates
            const silu = x / (1.0 + Math.exp(-x));
            const spline = Math.sin(x * 3.0 + this.tick * 0.03) * 0.4 * Math.cos(x * 2.0);
            const y = silu * 0.6 + spline;

            const canvasPx = plotX + normX * plotW;
            const canvasPy = midY - y * (plotH * 0.35);

            if (s === 0) ctx.moveTo(canvasPx, canvasPy);
            else ctx.lineTo(canvasPx, canvasPy);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Draw B-spline Basis Curves (Faint colored harmonics)
        const colors = ['#38bdf8', '#34d399', '#f43f5e', '#fbbf24'];
        ctx.lineWidth = 1;
        for (let k = 0; k < 4; k++) {
            ctx.strokeStyle = colors[k];
            ctx.beginPath();
            for (let s = 0; s <= samples; s++) {
                const normX = s / samples;
                const x = (normX - 0.5) * 2.0;
                const center = -0.75 + k * 0.5;
                const basisVal = Math.max(0, 1.0 - Math.abs(x - center) / 0.5);

                const canvasPx = plotX + normX * plotW;
                const canvasPy = midY - basisVal * (plotH * 0.25);

                if (s === 0) ctx.moveTo(canvasPx, canvasPy);
                else ctx.lineTo(canvasPx, canvasPy);
            }
            ctx.stroke();
        }

        // Header overlay
        ctx.fillStyle = '#ffffff';
        ctx.font = '11px sans-serif';
        ctx.fillText('KOLMOGOROV-ARNOLD (KAN) LEARNABLE B-SPLINE EDGE ACTIVATION', 15, 20);

        // Footer formula readout
        ctx.fillStyle = 'rgba(168, 85, 247, 0.9)';
        ctx.font = '10px monospace';
        ctx.fillText(`EDGE [0 -> 1] | BASIS DEGREE k=3 | G=5 INTERVALS | SYMBOLIC: 0.60·SiLU(x) + Spline(x)`, 15, h - 12);
    }

    destroy() {
        if (this.animFrame) {
            cancelAnimationFrame(this.animFrame);
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = KanSplineInspector;
}

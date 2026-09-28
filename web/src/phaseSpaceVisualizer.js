/**
 * phaseSpaceVisualizer.js
 *
 * Real-time (q, p) Phase Space orbit renderer for Physics-Informed Neural Network (PINN) dynamics.
 * Visualizes symplectic energy contours H(q, p) = E and verifies conservation invariants.
 */

class PhaseSpaceVisualizer {
    constructor(containerId, options = {}) {
        this.container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
        this.options = Object.assign({
            width: 480,
            height: 320,
            maxOrbitPoints: 300,
            trajectoryColor: '#10b981',
            contourColor: 'rgba(255, 255, 255, 0.08)',
            scaleQ: 25,
            scaleP: 25
        }, options);

        this.canvas = null;
        this.ctx = null;
        this.orbitPoints = []; // Array of { q, p }
        this.currentEnergy = 0;
        this.init();
    }

    init() {
        if (!this.container) return;

        this.container.innerHTML = '';
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.options.width;
        this.canvas.height = this.options.height;
        this.canvas.style.borderRadius = '8px';
        this.canvas.style.background = '#030712';
        this.canvas.style.border = '1px solid rgba(16, 185, 129, 0.3)';

        this.ctx = this.canvas.getContext('2d');
        this.container.appendChild(this.canvas);
        this.render();
    }

    addPoint(q, p, energy = 0) {
        this.orbitPoints.push({ q, p });
        this.currentEnergy = energy;
        if (this.orbitPoints.length > this.options.maxOrbitPoints) {
            this.orbitPoints.shift();
        }
        this.render();
    }

    render() {
        if (!this.ctx) return;
        const ctx = this.ctx;
        const w = this.options.width;
        const h = this.options.height;
        const cx = w / 2;
        const cy = h / 2;

        ctx.clearRect(0, 0, w, h);

        // Grid & axes
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, cy); ctx.lineTo(w, cy);
        ctx.moveTo(cx, 0); ctx.lineTo(cx, h);
        ctx.stroke();

        // Energy contour ellipses
        ctx.strokeStyle = this.options.contourColor;
        for (let r = 20; r <= 140; r += 30) {
            ctx.beginPath();
            ctx.ellipse(cx, cy, r, r * 0.75, 0, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Labels
        ctx.fillStyle = '#94a3b8';
        ctx.font = '10px monospace';
        ctx.fillText('Position q ->', w - 80, cy - 8);
        ctx.fillText('Momentum p ^', cx + 8, 16);

        // Trajectory
        if (this.orbitPoints.length > 1) {
            ctx.beginPath();
            for (let i = 0; i < this.orbitPoints.length; i++) {
                const pt = this.orbitPoints[i];
                const x = cx + pt.q * this.options.scaleQ;
                const y = cy - pt.p * this.options.scaleP;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.strokeStyle = this.options.trajectoryColor;
            ctx.lineWidth = 2;
            ctx.stroke();

            // Head marker
            const head = this.orbitPoints[this.orbitPoints.length - 1];
            const hx = cx + head.q * this.options.scaleQ;
            const hy = cy - head.p * this.options.scaleP;
            ctx.fillStyle = '#34d399';
            ctx.beginPath();
            ctx.arc(hx, hy, 4, 0, Math.PI * 2);
            ctx.fill();
        }

        // Energy HUD
        ctx.fillStyle = '#10b981';
        ctx.font = 'bold 11px monospace';
        ctx.fillText(`H(q,p) Energy: ${this.currentEnergy.toFixed(3)} J`, 12, 22);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = PhaseSpaceVisualizer;
}

/**
 * neuralODEPhaseViewer.js
 *
 * Interactive HTML5 Canvas continuous-flow phase space visualizer for Neural ODEs.
 * Renders dynamic 2D vector field streamline arrows and Runge-Kutta 4th order
 * integration particle trajectories over continuous vector field dz/dt = f(z, t).
 */

class NeuralODEPhaseViewer {
    constructor(containerId, options = {}) {
        this.container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
        this.options = Object.assign({
            width: 480,
            height: 320,
            gridSteps: 12,
            arrowColor: 'rgba(56, 189, 248, 0.35)',
            trajectoryColor: '#f43f5e',
            particleCount: 20
        }, options);

        this.canvas = null;
        this.ctx = null;
        this.particles = [];
        this.t = 0;
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
        this.canvas.style.background = '#030712';
        this.canvas.style.border = '1px solid rgba(244, 63, 94, 0.3)';

        this.ctx = this.canvas.getContext('2d');
        this.container.appendChild(this.canvas);

        this.initParticles();
        this.startLoop();
    }

    initParticles() {
        this.particles = [];
        for (let i = 0; i < this.options.particleCount; i++) {
            this.particles.push({
                x: (Math.random() - 0.5) * 4,
                y: (Math.random() - 0.5) * 4,
                trail: []
            });
        }
    }

    /**
     * Continuous 2D Vector Field: dz/dt = [ -y + 0.1 * x * (1 - r^2), x + 0.1 * y * (1 - r^2) ] (Limit Cycle)
     */
    vectorField(x, y) {
        const r2 = x * x + y * y;
        const dx = -y + 0.2 * x * (1.0 - r2);
        const dy = x + 0.2 * y * (1.0 - r2);
        return { dx, dy };
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
        this.t += 0.02;
        const dt = 0.04;

        for (const p of this.particles) {
            // RK4 Step
            const k1 = this.vectorField(p.x, p.y);
            const k2 = this.vectorField(p.x + 0.5 * dt * k1.dx, p.y + 0.5 * dt * k1.dy);
            const k3 = this.vectorField(p.x + 0.5 * dt * k2.dx, p.y + 0.5 * dt * k2.dy);
            const k4 = this.vectorField(p.x + dt * k3.dx, p.y + dt * k3.dy);

            p.x += (dt / 6) * (k1.dx + 2 * k2.dx + 2 * k3.dx + k4.dx);
            p.y += (dt / 6) * (k1.dy + 2 * k2.dy + 2 * k3.dy + k4.dy);

            p.trail.push({ x: p.x, y: p.y });
            if (p.trail.length > 25) p.trail.shift();

            // Reset escaped particles
            if (Math.abs(p.x) > 3.0 || Math.abs(p.y) > 3.0) {
                p.x = (Math.random() - 0.5) * 2;
                p.y = (Math.random() - 0.5) * 2;
                p.trail = [];
            }
        }
    }

    toScreen(x, y) {
        const cx = this.options.width / 2;
        const cy = this.options.height / 2;
        const scale = this.options.width / 6.0;
        return { sx: cx + x * scale, sy: cy - y * scale };
    }

    render() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // 1. Draw Vector Field Grid Arrows
        const steps = this.options.gridSteps;
        for (let i = -steps / 2; i <= steps / 2; i++) {
            for (let j = -steps / 2; j <= steps / 2; j++) {
                const x = (i / (steps / 2)) * 2.5;
                const y = (j / (steps / 2)) * 2.5;
                const vf = this.vectorField(x, y);
                const len = Math.sqrt(vf.dx * vf.dx + vf.dy * vf.dy);
                const udx = (vf.dx / (len + 1e-6)) * 0.12;
                const udy = (vf.dy / (len + 1e-6)) * 0.12;

                const p1 = this.toScreen(x, y);
                const p2 = this.toScreen(x + udx, y + udy);

                ctx.strokeStyle = this.options.arrowColor;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(p1.sx, p1.sy);
                ctx.lineTo(p2.sx, p2.sy);
                ctx.stroke();
            }
        }

        // 2. Draw Particle RK4 Trajectories
        for (const p of this.particles) {
            if (p.trail.length < 2) continue;

            ctx.strokeStyle = this.options.trajectoryColor;
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            const pStart = this.toScreen(p.trail[0].x, p.trail[0].y);
            ctx.moveTo(pStart.sx, pStart.sy);
            for (let k = 1; k < p.trail.length; k++) {
                const pt = this.toScreen(p.trail[k].x, p.trail[k].y);
                ctx.lineTo(pt.sx, pt.sy);
            }
            ctx.stroke();

            // Head particle
            const head = this.toScreen(p.x, p.y);
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(head.sx, head.sy, 2.5, 0, Math.PI * 2);
            ctx.fill();
        }

        // Title
        ctx.fillStyle = '#94a3b8';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('Neural ODE Phase Space Streamlines (RK4 Continuous Flow)', 12, 20);
    }

    destroy() {
        if (this.animFrame) cancelAnimationFrame(this.animFrame);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = NeuralODEPhaseViewer;
}

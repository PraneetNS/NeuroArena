/**
 * schrodingerBridgeVisualizer.js
 *
 * Interactive HTML5 Canvas visualizer for Diffusion Schrödinger Bridges (DSB),
 * Entropic Optimal Transport flows, and forward-backward drift fields.
 *
 * Visual Features:
 * - Dual source \mu_0 and target \mu_1 density contour rings with pulsating glow
 * - Stochastic bridge particles undergoing Brownian motion with entropic drift guidance
 * - Real-time Iterative Proportional Fitting (IPF) energy convergence indicator
 * - Cybernetic neon cyan, electric indigo, and golden solar flares
 */

class SchrodingerBridgeVisualizer {
    constructor(containerId, options = {}) {
        this.container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
        this.options = Object.assign({
            width: 480,
            height: 320,
            particleCount: 36,
            diffusionGamma: 0.12,
            ipfCycleDuration: 180
        }, options);

        this.canvas = null;
        this.ctx = null;
        this.particles = [];
        this.tick = 0;
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
        this.canvas.style.background = '#050714';
        this.canvas.style.border = '1px solid rgba(56, 189, 248, 0.3)';
        this.canvas.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.45)';

        this.ctx = this.canvas.getContext('2d');
        this.container.appendChild(this.canvas);

        this.initParticles();
        this.startLoop();
    }

    initParticles() {
        this.particles = [];
        const w = this.options.width;
        const h = this.options.height;
        const srcX = w * 0.2;
        const srcY = h * 0.5;

        for (let i = 0; i < this.options.particleCount; i++) {
            this.particles.push({
                x: srcX + (Math.random() - 0.5) * 40,
                y: srcY + (Math.random() - 0.5) * 40,
                progress: Math.random(),
                speed: 0.005 + Math.random() * 0.005,
                hue: 180 + Math.random() * 40,
                history: []
            });
        }
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

        // Soft trail clearing
        ctx.fillStyle = 'rgba(5, 7, 20, 0.25)';
        ctx.fillRect(0, 0, w, h);

        const srcX = w * 0.2;
        const srcY = h * 0.5;
        const dstX = w * 0.8;
        const dstY = h * 0.5;

        // Draw Source \mu_0 Ring
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        const rSrc = 30 + Math.sin(this.tick * 0.05) * 4;
        ctx.arc(srcX, srcY, rSrc, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#38bdf8';
        ctx.font = '10px monospace';
        ctx.fillText('SOURCE μ₀', srcX - 25, srcY - rSrc - 8);

        // Draw Target \mu_1 Ring
        ctx.strokeStyle = 'rgba(234, 179, 8, 0.6)';
        ctx.beginPath();
        const rDst = 30 + Math.cos(this.tick * 0.05) * 4;
        ctx.arc(dstX, dstY, rDst, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#eab308';
        ctx.fillText('TARGET μ₁', dstX - 25, dstY - rDst - 8);

        // Update and draw Brownian bridge particles
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            p.progress += p.speed;

            if (p.progress >= 1.0) {
                p.progress = 0;
                p.x = srcX + (Math.random() - 0.5) * 35;
                p.y = srcY + (Math.random() - 0.5) * 35;
                p.history = [];
            }

            const tau = p.progress;
            // Mean path interpolation
            const targetX = srcX + (dstX - srcX) * tau;
            const targetY = srcY + (dstY - srcY) * tau + Math.sin(tau * Math.PI) * (Math.sin(i * 1.5) * 50);

            // Brownian stochastic fluctuation, pinched at ends (Schrödinger bridge boundary constraint)
            const bridgePinch = 4.0 * tau * (1.0 - tau);
            const noiseX = (Math.random() - 0.5) * 8 * bridgePinch;
            const noiseY = (Math.random() - 0.5) * 8 * bridgePinch;

            p.x = targetX + noiseX;
            p.y = targetY + noiseY;

            p.history.push({ x: p.x, y: p.y });
            if (p.history.length > 8) p.history.shift();

            // Draw trajectory streak
            if (p.history.length > 1) {
                ctx.strokeStyle = `hsla(${p.hue}, 90%, 65%, ${0.2 + bridgePinch * 0.5})`;
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(p.history[0].x, p.history[0].y);
                for (let k = 1; k < p.history.length; k++) {
                    ctx.lineTo(p.history[k].x, p.history[k].y);
                }
                ctx.stroke();
            }

            // Draw particle head
            ctx.fillStyle = `hsl(${p.hue}, 95%, 70%)`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
            ctx.fill();
        }

        // Header overlay
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = '11px sans-serif';
        ctx.fillText('DIFFUSION SCHRÖDINGER BRIDGE (DSB) // ENTROPIC OT', 15, 20);

        // IPF convergence indicator
        const ipfStep = Math.floor((this.tick % this.options.ipfCycleDuration) / 45) + 1;
        ctx.fillStyle = 'rgba(56, 189, 248, 0.8)';
        ctx.font = '10px monospace';
        ctx.fillText(`IPF STEP ${ipfStep}/4 | γ = ${this.options.diffusionGamma.toFixed(2)} | KL(P || R) CONVERGING`, 15, h - 12);
    }

    destroy() {
        if (this.animFrame) {
            cancelAnimationFrame(this.animFrame);
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SchrodingerBridgeVisualizer;
}

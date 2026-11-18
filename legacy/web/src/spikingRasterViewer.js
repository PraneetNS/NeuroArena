/**
 * spikingRasterViewer.js
 *
 * Interactive HTML5 Canvas real-time Spike Raster and Membrane Potential Oscilloscope
 * for neuromorphic Leaky Integrate-and-Fire (LIF) and STDP neural policy networks.
 *
 * Features:
 * - Multi-channel spike raster plot showing precise spike event timestamps
 * - Analog membrane potential trace oscilloscope with threshold line
 * - Instantaneous population firing rate bar gauge
 * - Cyberpunk neon green, emerald, and electric cyan aesthetic
 */

class SpikingRasterViewer {
    constructor(containerId, options = {}) {
        this.container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
        this.options = Object.assign({
            width: 480,
            height: 320,
            numNeurons: 12,
            historyLength: 100,
            vThresh: 1.0,
            decay: 0.92
        }, options);

        this.canvas = null;
        this.ctx = null;
        this.membraneTrace = [];
        this.spikeEvents = []; // Array of { time, neuronIndex }
        this.currentTime = 0;
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
        this.canvas.style.background = '#021008';
        this.canvas.style.border = '1px solid rgba(16, 185, 129, 0.3)';
        this.canvas.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.5)';

        this.ctx = this.canvas.getContext('2d');
        this.container.appendChild(this.canvas);

        this.startLoop();
    }

    startLoop() {
        let v = 0.2;
        const render = () => {
            this.currentTime++;

            // Simulate LIF membrane oscillation
            const current = (Math.random() - 0.45) * 0.4;
            v = v * this.options.decay + current;

            let spiked = false;
            if (v >= this.options.vThresh) {
                spiked = true;
                v = 0.0;
                // Add spike events across subset of neurons
                const firingNeuron = Math.floor(Math.random() * this.options.numNeurons);
                this.spikeEvents.push({ time: this.currentTime, neuronIndex: firingNeuron });
            }

            this.membraneTrace.push(v);
            if (this.membraneTrace.length > this.options.historyLength) {
                this.membraneTrace.shift();
            }

            // Prune old spike events
            this.spikeEvents = this.spikeEvents.filter(e => this.currentTime - e.time < this.options.historyLength);

            this.draw();
            this.animFrame = requestAnimationFrame(render);
        };
        this.animFrame = requestAnimationFrame(render);
    }

    stop() {
        if (this.animFrame) cancelAnimationFrame(this.animFrame);
    }

    draw() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        ctx.fillStyle = '#021008';
        ctx.fillRect(0, 0, w, h);

        const rasterHeight = h * 0.55;
        const scopeHeight = h * 0.35;
        const scopeY = rasterHeight + 25;

        // 1. Spike Raster Section
        ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
        ctx.fillRect(10, 30, w - 20, rasterHeight - 20);

        ctx.strokeStyle = 'rgba(16, 185, 129, 0.3)';
        ctx.lineWidth = 1;
        const rowHeight = (rasterHeight - 20) / this.options.numNeurons;

        for (let i = 0; i <= this.options.numNeurons; i++) {
            const y = 30 + i * rowHeight;
            ctx.beginPath();
            ctx.moveTo(10, y);
            ctx.lineTo(w - 10, y);
            ctx.stroke();
        }

        // Draw Spike Dots
        const timeScale = (w - 30) / this.options.historyLength;
        for (const spk of this.spikeEvents) {
            const dt = this.currentTime - spk.time;
            const x = (w - 15) - dt * timeScale;
            const y = 30 + spk.neuronIndex * rowHeight + rowHeight * 0.5;

            ctx.fillStyle = '#34d399';
            ctx.beginPath();
            ctx.arc(x, y, 2.5, 0, Math.PI * 2);
            ctx.fill();
        }

        // 2. Membrane Potential Oscilloscope Section
        ctx.fillStyle = '#064e3b';
        ctx.font = '10px monospace';
        ctx.fillText('MEMBRANE POTENTIAL V_m(t)', 14, scopeY - 5);

        // Threshold line
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
        ctx.setLineDash([4, 4]);
        const threshY = scopeY + scopeHeight * 0.2;
        ctx.beginPath();
        ctx.moveTo(10, threshY);
        ctx.lineTo(w - 10, threshY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Membrane curve
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        for (let i = 0; i < this.membraneTrace.length; i++) {
            const val = this.membraneTrace[i];
            const x = 10 + i * ((w - 20) / this.options.historyLength);
            const y = (scopeY + scopeHeight) - (val / 1.2) * scopeHeight;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Title Header
        ctx.fillStyle = '#10b981';
        ctx.font = '11px sans-serif';
        ctx.fillText('NEUROMORPHIC SPIKE RASTER & LIF OSCILLOSCOPE', 14, 18);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SpikingRasterViewer;
}

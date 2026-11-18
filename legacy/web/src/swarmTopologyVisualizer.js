/**
 * swarmTopologyVisualizer.js
 *
 * Interactive HTML5 Canvas visualizer for Graph Neural Network (GNN) swarm message-passing
 * topologies and Neuromorphic Leaky Integrate-and-Fire (LIF) spiking dynamics.
 * Displays agent nodes, dynamic communication edges, Byzantine anomaly detection,
 * and live membrane oscilloscope telemetry.
 */

class SwarmTopologyVisualizer {
    /**
     * @param {HTMLCanvasElement} canvas
     * @param {Object} [options]
     */
    constructor(canvas, options = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.options = Object.assign({
            nodeRadius: 8,
            communicationRadius: 75,
            edgeColor: 'rgba(0, 240, 255, 0.25)',
            pulseSpeed: 1.5,
            maxTracePoints: 120
        }, options);

        this.agents = [];
        this.edges = [];
        this.selectedAgentId = null;
        this.membraneTraces = new Map(); // agentId -> number[]
        this.byzantineNodes = new Set();
        this.animationFrameId = null;
        this.time = 0;

        this._setupInteractions();
    }

    /**
     * Updates swarm agents and their network links.
     * @param {Array<Object>} agents - [{ id, x, y, vx, vy, isSpiking, membranePotential, isByzantine }]
     */
    updateTopology(agents) {
        this.agents = agents;
        this.edges = [];
        const R_sq = this.options.communicationRadius * this.options.communicationRadius;

        for (let i = 0; i < agents.length; i++) {
            const a1 = agents[i];

            if (a1.isByzantine) {
                this.byzantineNodes.add(a1.id);
            }

            // Update membrane trace buffer
            if (!this.membraneTraces.has(a1.id)) {
                this.membraneTraces.set(a1.id, []);
            }
            const trace = this.membraneTraces.get(a1.id);
            trace.push(a1.membranePotential || -70.0);
            if (trace.length > this.options.maxTracePoints) {
                trace.shift();
            }

            for (let j = i + 1; j < agents.length; j++) {
                const a2 = agents[j];
                const dx = a1.x - a2.x;
                const dy = a1.y - a2.y;
                const dSq = dx * dx + dy * dy;

                if (dSq <= R_sq) {
                    this.edges.push({
                        from: a1,
                        to: a2,
                        weight: Math.exp(-dSq / (R_sq * 0.5)),
                        length: Math.sqrt(dSq)
                    });
                }
            }
        }
    }

    _setupInteractions() {
        this.canvas.addEventListener('click', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const clickY = e.clientY - rect.top;

            let closest = null;
            let minDist = this.options.nodeRadius * 2.5;

            for (const agent of this.agents) {
                const d = Math.hypot(agent.x - clickX, agent.y - clickY);
                if (d < minDist) {
                    minDist = d;
                    closest = agent;
                }
            }

            this.selectedAgentId = closest ? closest.id : null;
        });
    }

    start() {
        if (!this.animationFrameId) {
            const loop = () => {
                this.render();
                this.animationFrameId = requestAnimationFrame(loop);
            };
            this.animationFrameId = requestAnimationFrame(loop);
        }
    }

    stop() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    render() {
        const { width, height } = this.canvas;
        const ctx = this.ctx;
        this.time += 0.02;

        // Dark bioluminescent background
        ctx.fillStyle = '#070b14';
        ctx.fillRect(0, 0, width, height);

        // 1. Draw GNN Message Passing Edges
        ctx.lineWidth = 1.5;
        for (const edge of this.edges) {
            const alpha = Math.min(0.8, edge.weight * 0.6);
            ctx.strokeStyle = `rgba(0, 220, 255, ${alpha})`;

            ctx.beginPath();
            ctx.moveTo(edge.from.x, edge.from.y);
            ctx.lineTo(edge.to.x, edge.to.y);
            ctx.stroke();

            // Animated message passing packet pulse
            const pulseT = (this.time * this.options.pulseSpeed + edge.weight) % 1.0;
            const px = edge.from.x + (edge.to.x - edge.from.x) * pulseT;
            const py = edge.from.y + (edge.to.y - edge.from.y) * pulseT;

            ctx.fillStyle = '#00ffff';
            ctx.beginPath();
            ctx.arc(px, py, 2.5, 0, Math.PI * 2);
            ctx.fill();
        }

        // 2. Draw Agent Nodes
        for (const agent of this.agents) {
            const isSelected = agent.id === this.selectedAgentId;
            const isByzantine = this.byzantineNodes.has(agent.id);

            // Halo glow on action potential spike
            if (agent.isSpiking) {
                ctx.save();
                ctx.shadowColor = '#ff007f';
                ctx.shadowBlur = 18;
                ctx.strokeStyle = '#ff007f';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(agent.x, agent.y, this.options.nodeRadius + 4, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }

            // Node core
            ctx.beginPath();
            ctx.arc(agent.x, agent.y, this.options.nodeRadius, 0, Math.PI * 2);

            if (isByzantine) {
                ctx.fillStyle = '#ff2a4b'; // Byzantine alert red
            } else if (agent.isSpiking) {
                ctx.fillStyle = '#ff00aa'; // Spike magenta
            } else if (isSelected) {
                ctx.fillStyle = '#00ffcc'; // Selected teal
            } else {
                ctx.fillStyle = '#00b4d8'; // Standard drone blue
            }
            ctx.fill();

            // Heading velocity vector
            if (agent.vx !== undefined && agent.vy !== undefined) {
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(agent.x, agent.y);
                ctx.lineTo(agent.x + agent.vx * 3.0, agent.y + agent.vy * 3.0);
                ctx.stroke();
            }
        }

        // 3. Mini Membrane Oscilloscope for Selected Agent
        if (this.selectedAgentId && this.membraneTraces.has(this.selectedAgentId)) {
            this._renderOscilloscope(ctx, width, height);
        }

        // 4. Swarm HUD Overlay
        this._renderHUD(ctx, width, height);
    }

    _renderOscilloscope(ctx, width, height) {
        const trace = this.membraneTraces.get(this.selectedAgentId);
        const boxW = 200;
        const boxH = 75;
        const boxX = width - boxW - 15;
        const boxY = height - boxH - 15;

        ctx.fillStyle = 'rgba(10, 16, 30, 0.85)';
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 1;
        ctx.fillRect(boxX, boxY, boxW, boxH);
        ctx.strokeRect(boxX, boxY, boxW, boxH);

        ctx.font = '10px monospace';
        ctx.fillStyle = '#00ffff';
        ctx.fillText(`LIF POTENTIAL: ${this.selectedAgentId}`, boxX + 8, boxY + 14);

        if (trace.length > 1) {
            ctx.strokeStyle = '#00ff88';
            ctx.lineWidth = 1.5;
            ctx.beginPath();

            for (let i = 0; i < trace.length; i++) {
                const x = boxX + (i / this.options.maxTracePoints) * boxW;
                // Map [-75, -50] mV to [boxY + boxH, boxY + 20]
                const v = trace[i];
                const norm = Math.max(0, Math.min(1, (v + 75) / 25));
                const y = boxY + boxH - (norm * (boxH - 24)) - 4;

                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
        }
    }

    _renderHUD(ctx, width, height) {
        ctx.font = '11px monospace';
        ctx.fillStyle = '#a0aec0';
        ctx.fillText(`GNN SWARM NODES: ${this.agents.length} | EDGES: ${this.edges.length}`, 15, 20);
        ctx.fillText(`BYZANTINE QUARANTINE: ${this.byzantineNodes.size}`, 15, 36);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SwarmTopologyVisualizer;
}

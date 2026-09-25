/**
 * attentionVisualizer.js
 * Interactive WebGL / Canvas visualizer for neural attention weights and feature attributions.
 * Renders multi-head self-attention heatmaps, token affinity networks, and head selection toggles.
 */

class AttentionVisualizer {
    constructor(canvasElement, options = {}) {
        this.canvas = canvasElement;
        this.numHeads = options.numHeads || 4;
        this.gridSize = options.gridSize || 4; // 4x4 tokens
        this.activeHead = 0;
        this.labels = options.labels || ['RayLeft', 'RayCenter', 'RayRight', 'Velocity'];

        // 3D array: heads -> rows -> cols
        this.attentionMatrices = this._initDefaultMatrices();
        this.animFrameId = null;
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    }

    _initDefaultMatrices() {
        const heads = [];
        for (let h = 0; h < this.numHeads; h++) {
            const mat = [];
            for (let r = 0; r < this.gridSize; r++) {
                const row = [];
                for (let c = 0; c < this.gridSize; c++) {
                    // Initialize with normalized identity + noise
                    const base = r === c ? 0.6 : 0.15;
                    const noise = (Math.random() - 0.5) * 0.1;
                    row.push(Math.max(0.01, Math.min(1.0, base + noise)));
                }
                // Softmax normalize row
                const sum = row.reduce((a, b) => a + b, 0);
                heads.push(row.map(v => v / sum));
            }
        }
        return heads;
    }

    setActiveHead(headIndex) {
        if (headIndex >= 0 && headIndex < this.numHeads) {
            this.activeHead = headIndex;
            this.render();
        }
    }

    updateAttentionWeights(headIndex, matrix) {
        if (headIndex >= 0 && headIndex < this.numHeads && Array.isArray(matrix)) {
            this.attentionMatrices[headIndex] = matrix;
            this.render();
        }
    }

    _getColorForWeight(val) {
        // High-contrast cyber emerald-to-amber turbo palette
        val = Math.max(0, Math.min(1, val));
        const r = Math.round(255 * Math.min(1, val * 1.8));
        const g = Math.round(255 * Math.sin(val * Math.PI));
        const b = Math.round(255 * Math.max(0, 1 - val * 2.2));
        return `rgb(${r}, ${g}, ${b})`;
    }

    render() {
        if (!this.ctx || !this.canvas) return;

        const w = this.canvas.width;
        const h = this.canvas.height;
        const ctx = this.ctx;

        ctx.clearRect(0, 0, w, h);

        const pad = 40;
        const cellSize = Math.min((w - pad * 2) / this.gridSize, (h - pad * 2) / this.gridSize);
        const matrix = this.attentionMatrices[this.activeHead] || [];

        // Draw header
        ctx.fillStyle = '#00f0ff';
        ctx.font = '12px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`Multi-Head Self-Attention (Head ${this.activeHead + 1}/${this.numHeads})`, w / 2, 22);

        // Draw cells
        for (let r = 0; r < this.gridSize; r++) {
            for (let c = 0; c < this.gridSize; c++) {
                const val = (matrix[r] && matrix[r][c] !== undefined) ? matrix[r][c] : 0.25;
                const x = pad + c * cellSize;
                const y = pad + r * cellSize;

                // Cell background
                ctx.fillStyle = this._getColorForWeight(val);
                ctx.fillRect(x + 2, y + 2, cellSize - 4, cellSize - 4);

                // Cell border
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
                ctx.strokeRect(x + 2, y + 2, cellSize - 4, cellSize - 4);

                // Text value
                ctx.fillStyle = val > 0.4 ? '#050811' : '#f0f4fc';
                ctx.font = 'bold 11px monospace';
                ctx.fillText(val.toFixed(2), x + cellSize / 2, y + cellSize / 2 + 4);
            }
        }

        // Draw row/col labels
        ctx.fillStyle = '#8e9aaf';
        ctx.font = '10px Inter, sans-serif';
        for (let i = 0; i < this.gridSize; i++) {
            const label = this.labels[i] || `T${i}`;
            // Top col labels
            ctx.textAlign = 'center';
            ctx.fillText(label, pad + i * cellSize + cellSize / 2, pad - 8);

            // Left row labels
            ctx.textAlign = 'right';
            ctx.fillText(label, pad - 8, pad + i * cellSize + cellSize / 2 + 3);
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = AttentionVisualizer;
}

/**
 * transferVisualizer.js
 * Interactive Cross-Biome Transfer Learning & Layer Freezing Inspector.
 * Visualizes model topology layer states (Frozen, Fine-Tuning, Scratch),
 * cross-biome domain similarity heatmap, and real-time inference micro-batch telemetry.
 */

(function () {
  'use strict';

  class TransferVisualizer {
    constructor() {
      this.biomes = [
        'Linear Steppes',
        'Binary Marshlands',
        'Variance Tundra',
        'Branching Canopy',
        'Synapse Citadel',
        'Semantic Expanse'
      ];

      this.transferMatrix = [
        [1.00, 0.78, 0.65, 0.52, 0.40, 0.35],
        [0.72, 1.00, 0.81, 0.64, 0.49, 0.42],
        [0.60, 0.79, 1.00, 0.75, 0.58, 0.50],
        [0.48, 0.62, 0.74, 1.00, 0.82, 0.68],
        [0.38, 0.46, 0.55, 0.80, 1.00, 0.85],
        [0.32, 0.39, 0.47, 0.65, 0.84, 1.00]
      ];

      this.layerStates = [
        { name: 'Layer 1: Input Spatial Embedder', status: 'FROZEN', lr: 0.000, color: '#38bdf8' },
        { name: 'Layer 2: Dense Feature Extractor', status: 'FROZEN', lr: 0.000, color: '#38bdf8' },
        { name: 'Layer 3: Hidden Latent Projection', status: 'FINE_TUNING', lr: 0.002, color: '#fbbf24' },
        { name: 'Layer 4: Action Policy & Head', status: 'ACTIVE', lr: 0.010, color: '#4ade80' }
      ];

      this.init();
    }

    init() {
      console.log('⚡ [TransferVisualizer] Initialized Cross-Biome Transfer Learning HUD');
    }

    renderTransferModal() {
      let modal = document.getElementById('transfer-learning-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'transfer-learning-modal';
        modal.className = 'transfer-modal-backdrop';
        modal.innerHTML = `
          <div class="transfer-modal-card">
            <div class="transfer-modal-header">
              <div class="transfer-modal-title">🎓 CROSS-BIOME TRANSFER LEARNING & TOPOLOGY INSPECTOR</div>
              <button class="transfer-modal-close" onclick="window.transferVisualizer.hideModal()">✕</button>
            </div>
            <div class="transfer-modal-body">
              <div class="transfer-section">
                <div class="section-subheading">NEURAL LAYER FREEZING & GRADIENT STATUS</div>
                <div id="transfer-layers-list" class="transfer-layers-grid"></div>
              </div>
              <div class="transfer-section">
                <div class="section-subheading">BIOME DOMAIN AFFINITY & MMD TRANSFER MATRIX</div>
                <div id="transfer-matrix-container" class="transfer-matrix-table-wrap"></div>
              </div>
              <div class="transfer-section">
                <div class="section-subheading">DYNAMIC INFERENCE BATCHING TELEMETRY</div>
                <div class="transfer-batch-hud">
                  <div class="batch-metric-box">
                    <span class="batch-label">AVG BATCH SIZE</span>
                    <span id="batch-avg-size" class="batch-val">28.4</span>
                  </div>
                  <div class="batch-metric-box">
                    <span class="batch-label">P95 LATENCY</span>
                    <span id="batch-p95-lat" class="batch-val">6.2 ms</span>
                  </div>
                  <div class="batch-metric-box">
                    <span class="batch-label">SLA VIOLATIONS</span>
                    <span id="batch-sla-viol" class="batch-val">0</span>
                  </div>
                  <div class="batch-metric-box">
                    <span class="batch-label">MMD DISCREPANCY</span>
                    <span id="batch-mmd-score" class="batch-val">0.038</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        `;
        document.body.appendChild(modal);
      }

      this.populateLayers();
      this.populateMatrix();
      modal.style.display = 'flex';
    }

    populateLayers() {
      const container = document.getElementById('transfer-layers-list');
      if (!container) return;

      container.innerHTML = this.layerStates
        .map(
          (l, i) => `
        <div class="transfer-layer-row">
          <div class="layer-badge" style="border-left: 4px solid ${l.color};">
            <span class="layer-title">${l.name}</span>
            <span class="layer-status-pill status-${l.status.toLowerCase()}">${l.status}</span>
          </div>
          <div class="layer-lr-text">LR: ${l.lr.toFixed(4)}</div>
        </div>
      `
        )
        .join('');
    }

    populateMatrix() {
      const container = document.getElementById('transfer-matrix-container');
      if (!container) return;

      let html = '<table class="transfer-table"><thead><tr><th>Source / Target</th>';
      for (const b of this.biomes) {
        html += `<th>${b.split(' ')[0]}</th>`;
      }
      html += '</tr></thead><tbody>';

      for (let r = 0; r < 6; r++) {
        html += `<tr><td class="biome-row-name">${this.biomes[r]}</td>`;
        for (let c = 0; c < 6; c++) {
          const score = this.transferMatrix[r][c];
          const opacity = Math.max(0.2, score);
          const bg = `rgba(56, 189, 248, ${opacity * 0.45})`;
          html += `<td style="background:${bg}; text-align:center;">${score.toFixed(2)}</td>`;
        }
        html += '</tr>';
      }
      html += '</tbody></table>';
      container.innerHTML = html;
    }

    showModal() {
      this.renderTransferModal();
    }

    hideModal() {
      const modal = document.getElementById('transfer-learning-modal');
      if (modal) modal.style.display = 'none';
    }

    updateTelemetry(data) {
      if (data.avgBatchSize) {
        const el = document.getElementById('batch-avg-size');
        if (el) el.textContent = data.avgBatchSize;
      }
      if (data.p95LatencyMs) {
        const el = document.getElementById('batch-p95-lat');
        if (el) el.textContent = `${data.p95LatencyMs} ms`;
      }
      if (data.slaViolations !== undefined) {
        const el = document.getElementById('batch-sla-viol');
        if (el) el.textContent = data.slaViolations;
      }
    }
  }

  window.transferVisualizer = new TransferVisualizer();
})();

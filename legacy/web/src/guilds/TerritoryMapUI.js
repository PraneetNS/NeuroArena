/**
 * TerritoryMapUI.js (Web Client)
 * Interactive biome territory map visualization showing active guild dominance,
 * contested borders, and resource siphon rates.
 */

export class TerritoryMapUI {
  constructor(containerElement = null) {
    this.container = containerElement;
    this.activeNodes = [];
  }

  renderNodes(nodesList) {
    this.activeNodes = nodesList || [];
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="territory-grid">
        ${this.activeNodes.map(node => `
          <div class="territory-card ${node.contested ? 'contested' : ''}" data-node-id="${node.id}">
            <div class="territory-header">
              <span class="territory-name">${node.biome}</span>
              <span class="territory-status">${node.contested ? '⚔️ CONTESTED' : (node.controllingGuildId ? '🛡️ HELD' : '⚪ UNCLAIMED')}</span>
            </div>
            <div class="territory-body">
              <div class="control-bar">
                <div class="control-fill" style="width: ${node.controlPoints}%;"></div>
              </div>
              <div class="territory-meta">
                <span>Dominant: <strong>${node.controllingGuildId || 'None'}</strong></span>
                <span>Base Yield: <strong>${node.baseYield} FLOPs/hr</strong></span>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }
}

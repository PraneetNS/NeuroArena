/**
 * LiveOpsBannerUI.js (Web Client)
 * Renders the top HUD live-ops event banner for modifier weekends and rotating bosses.
 */

export class LiveOpsBannerUI {
  constructor(containerElement = null) {
    this.container = containerElement;
    this.activeModifier = null;
  }

  render(modifier) {
    this.activeModifier = modifier;
    if (!this.container) return;

    if (!modifier || !modifier.active) {
      this.container.innerHTML = "";
      this.container.classList.add("hidden");
      return;
    }

    this.container.classList.remove("hidden");
    this.container.innerHTML = `
      <div class="live-ops-banner pulse-glow" style="border-left-color: ${modifier.bannerColor || '#F59E0B'};">
        <div class="live-ops-icon">⚡</div>
        <div class="live-ops-content">
          <div class="live-ops-title">
            <span class="live-badge">LIVE EVENT</span>
            <strong>${modifier.title}</strong>
          </div>
          <div class="live-ops-desc">${modifier.description}</div>
        </div>
        <div class="live-ops-multiplier">
          <span class="multiplier-val">${modifier.multiplier}x</span>
          <span class="multiplier-lbl">BOOST</span>
        </div>
      </div>
    `;
  }
}

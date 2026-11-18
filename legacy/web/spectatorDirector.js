/**
 * spectatorDirector.js (Web Client)
 * Client-side shoutcaster telemetry, camera angle transitions, and broadcast HUD binder.
 */

class ClientSpectatorDirector {
  constructor(canvasElement, hudContainer) {
    this.canvas = canvasElement;
    this.hud = hudContainer;
    this.activeCameraMode = 'OVERVIEW';
    this.cameraZoom = 1.0;
    this.cameraTarget = { x: 0, y: 0 };
    this.currentWinProb = { p1: 0.5, p2: 0.5 };
  }

  /**
   * Updates HUD and camera interpolation on new spectator packet.
   */
  updateDirectorState(packet) {
    if (!packet) return;

    this.activeCameraMode = packet.mode || 'OVERVIEW';
    this.currentWinProb = packet.winProb || { p1: 0.5, p2: 0.5 };

    if (packet.broadcastCue) {
      this.displayShoutcastBanner(packet.broadcastCue);
    }

    this.renderTelemetryBar(this.currentWinProb);
  }

  /**
   * Display dynamic shoutcaster callout banner.
   */
  displayShoutcastBanner(text) {
    let banner = document.getElementById('shoutcast-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'shoutcast-banner';
      banner.className = 'shoutcast-banner-pulse';
      document.body.appendChild(banner);
    }

    banner.textContent = `🎙️ [LIVE CAST] ${text}`;
    banner.style.display = 'block';
    banner.style.opacity = '1';

    if (this._bannerTimeout) clearTimeout(this._bannerTimeout);
    this._bannerTimeout = setTimeout(() => {
      banner.style.opacity = '0';
      setTimeout(() => { banner.style.display = 'none'; }, 500);
    }, 4000);
  }

  /**
   * Updates win probability bar.
   */
  renderTelemetryBar(winProb) {
    const barP1 = document.getElementById('win-prob-p1');
    const barP2 = document.getElementById('win-prob-p2');
    if (barP1 && barP2) {
      const p1Pct = Math.round(winProb.p1 * 100);
      const p2Pct = 100 - p1Pct;
      barP1.style.width = `${p1Pct}%`;
      barP1.textContent = `P1 ${p1Pct}%`;
      barP2.style.width = `${p2Pct}%`;
      barP2.textContent = `P2 ${p2Pct}%`;
    }
  }
}

if (typeof window !== 'undefined') {
  window.ClientSpectatorDirector = ClientSpectatorDirector;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ClientSpectatorDirector;
}

/**
 * broadcastOverlay.js
 * Esports Live Broadcast Mode & Streamer HUD Controller.
 * Manages clean-feed streamer mode, interactive chat crowd handicap polls, and ML telemetry radar.
 */

'use strict';

class BroadcastOverlayManager {
  constructor() {
    this.isBroadcastMode = false;
    this.activePoll = null;
    this.pollVotes = { optionA: 0, optionB: 0 };
  }

  /**
   * Toggles streamer broadcast mode (clean HUD, high-contrast typography, radar charts).
   */
  toggleBroadcastMode() {
    this.isBroadcastMode = !this.isBroadcastMode;
    document.body.classList.toggle('broadcast-mode-active', this.isBroadcastMode);
    
    const banner = document.getElementById('broadcast-hud-banner');
    if (banner) {
      banner.style.display = this.isBroadcastMode ? 'flex' : 'none';
    }

    return this.isBroadcastMode;
  }

  /**
   * Starts a crowd-sourced Twitch/YouTube hyperparameter tampering poll.
   */
  startCrowdPoll(title, optionA, optionB, durationSec = 15) {
    this.activePoll = { title, optionA, optionB, durationSec };
    this.pollVotes = { optionA: 0, optionB: 0 };

    const pollContainer = document.getElementById('crowd-poll-overlay');
    if (pollContainer) {
      pollContainer.innerHTML = `
        <div class="poll-box">
          <div class="poll-title">🗳️ CHAT VOTE: ${title}</div>
          <div class="poll-options">
            <button class="poll-btn" onclick="window.broadcastOverlay?.vote('optionA')">[1] ${optionA} (<span id="poll-cnt-a">0</span>)</button>
            <button class="poll-btn" onclick="window.broadcastOverlay?.vote('optionB')">[2] ${optionB} (<span id="poll-cnt-b">0</span>)</button>
          </div>
          <div class="poll-timer">Time Remaining: <span id="poll-time">${durationSec}</span>s</div>
        </div>
      `;
      pollContainer.style.display = 'block';

      let remaining = durationSec;
      const timer = setInterval(() => {
        remaining--;
        const timeEl = document.getElementById('poll-time');
        if (timeEl) timeEl.textContent = remaining;
        if (remaining <= 0) {
          clearInterval(timer);
          this.resolvePoll();
        }
      }, 1000);
    }
  }

  vote(option) {
    if (this.pollVotes[option] !== undefined) {
      this.pollVotes[option]++;
      const cntEl = document.getElementById(option === 'optionA' ? 'poll-cnt-a' : 'poll-cnt-b');
      if (cntEl) cntEl.textContent = this.pollVotes[option];
    }
  }

  resolvePoll() {
    const winner = this.pollVotes.optionA >= this.pollVotes.optionB ? this.activePoll.optionA : this.activePoll.optionB;
    const pollContainer = document.getElementById('crowd-poll-overlay');
    if (pollContainer) {
      pollContainer.innerHTML = `<div class="poll-box winner">🏆 CHAT DECIDED: ${winner}! Applying modifier...</div>`;
      setTimeout(() => {
        pollContainer.style.display = 'none';
      }, 3000);
    }
  }
}

if (typeof window !== 'undefined') {
  window.BroadcastOverlayManager = BroadcastOverlayManager;
  window.broadcastOverlay = new BroadcastOverlayManager();
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BroadcastOverlayManager;
}

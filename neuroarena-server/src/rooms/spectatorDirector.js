/**
 * spectatorDirector.js
 * Automated Esports Spectator Director and High-Entropy Highlight Tracker.
 * Evaluates live duel state vectors to switch camera angles and dispatch shoutcaster telemetry.
 */

'use strict';

class SpectatorDirector {
  constructor(options = {}) {
    this.cameraFocusModes = ['OVERVIEW', 'LEADER_CHASE', 'CRITICAL_CONVERGENCE', 'TRAJECTORY_SPLIT'];
    this.currentMode = 'OVERVIEW';
    this.focusedPlayerId = null;
    this.lossVelocityThreshold = options.lossVelocityThreshold || 0.15;
    this.hpClosenessThreshold = options.hpClosenessThreshold || 150;
    this.historyBuffer = [];
  }

  /**
   * Evaluates live duel frame to determine optimal camera framing and broadcast cues.
   * @param {{ p1: Object, p2: Object, bossHp?: number, elapsedTimeMs: number }} matchState
   * @returns {{ mode: string, focusedPlayerId: string|null, broadcastCue: string|null, winProb: { p1: number, p2: number } }}
   */
  evaluateFrame(matchState) {
    const { p1, p2, bossHp, elapsedTimeMs } = matchState;

    // Calculate dynamic win probability based on loss, HP, and training convergence speed
    const p1Loss = p1.currentLoss || 1.0;
    const p2Loss = p2.currentLoss || 1.0;
    const p1Score = (1 / (p1Loss + 0.01)) * (p1.hp || 100);
    const p2Score = (1 / (p2Loss + 0.01)) * (p2.hp || 100);
    const totalScore = p1Score + p2Score;

    const p1WinProb = Number((p1Score / totalScore).toFixed(3));
    const p2WinProb = Number((1.0 - p1WinProb).toFixed(3));

    let broadcastCue = null;
    let targetMode = 'OVERVIEW';
    let targetPlayer = null;

    // 1. Check for rapid gradient descent convergence (loss drop)
    const p1LossDrop = (p1.prevLoss || p1Loss) - p1Loss;
    const p2LossDrop = (p2.prevLoss || p2Loss) - p2Loss;

    if (p1LossDrop > this.lossVelocityThreshold) {
      targetMode = 'CRITICAL_CONVERGENCE';
      targetPlayer = p1.id;
      broadcastCue = `${p1.name || 'Player 1'} achieved rapid gradient descent breakthrough (-${p1LossDrop.toFixed(3)} loss)!`;
    } else if (p2LossDrop > this.lossVelocityThreshold) {
      targetMode = 'CRITICAL_CONVERGENCE';
      targetPlayer = p2.id;
      broadcastCue = `${p2.name || 'Player 2'} achieved rapid gradient descent breakthrough (-${p2LossDrop.toFixed(3)} loss)!`;
    }
    // 2. Check for close duel finish
    else if (Math.abs((p1.hp || 0) - (p2.hp || 0)) < this.hpClosenessThreshold && (p1.hp < 300 || p2.hp < 300)) {
      targetMode = 'TRAJECTORY_SPLIT';
      broadcastCue = 'Neck-and-neck endgame sprint! Sub-150 HP margin!';
    }
    // 3. Lead tracking
    else if (p1Loss < p2Loss * 0.7) {
      targetMode = 'LEADER_CHASE';
      targetPlayer = p1.id;
    } else if (p2Loss < p1Loss * 0.7) {
      targetMode = 'LEADER_CHASE';
      targetPlayer = p2.id;
    }

    this.currentMode = targetMode;
    this.focusedPlayerId = targetPlayer;

    return {
      mode: this.currentMode,
      focusedPlayerId: this.focusedPlayerId,
      broadcastCue,
      winProb: { p1: p1WinProb, p2: p2WinProb },
      timestamp: elapsedTimeMs
    };
  }
}

module.exports = SpectatorDirector;

/**
 * DailyChallengeUI.js (Web Client)
 * Renders the daily challenge card, persistent streak badge, escalating reward breakdown,
 * and live UTC countdown timer for NeuroArena.
 */

export class DailyChallengeUI {
  constructor(containerElement = null) {
    this.container = containerElement;
    this.dailyState = null;
  }

  formatTimeRemaining(seconds) {
    if (seconds <= 0) return "Resetting now...";
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  render(dailyData, onPlayClick = null, onClaimClick = null) {
    this.dailyState = dailyData;
    if (!this.container) return;

    const { objective, streak = 0, bestStreak = 0, hasCompletedToday = false, secondsUntilDailyReset = 86400 } = dailyData;

    const streakTier = streak >= 30 ? "GRANDMASTER" : streak >= 14 ? "PLATINUM" : streak >= 7 ? "GOLD" : streak >= 3 ? "SILVER" : "BRONZE";
    const streakIcon = streak >= 7 ? "🔥" : "⚡";

    this.container.innerHTML = `
      <div class="daily-challenge-card glass-panel ${hasCompletedToday ? 'completed' : ''}">
        <div class="daily-header">
          <div class="daily-badge-row">
            <span class="badge-daily">📅 DAILY OBJECTIVE [UTC: ${objective.dateKey}]</span>
            <span class="badge-streak ${streakTier.toLowerCase()}">${streakIcon} STREAK: ${streak} DAYS (Best: ${bestStreak})</span>
          </div>
          <div class="daily-timer" id="daily-countdown">
            ⏳ Resets in: <strong class="text-amber">${this.formatTimeRemaining(secondsUntilDailyReset)}</strong>
          </div>
        </div>

        <div class="daily-body">
          <h3 class="daily-title">${objective.title}</h3>
          <p class="daily-desc">${objective.description}</p>
          
          <div class="daily-meta-grid">
            <div class="meta-item">
              <span class="meta-label">Biome / Realm</span>
              <span class="meta-value">${objective.biome || 'Competitive Arena'}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Boss / Target</span>
              <span class="meta-value">${objective.boss || 'Target Distribution'}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Base Reward</span>
              <span class="meta-value">${objective.baseReward?.computeCredits || 100} Credits + ${objective.baseReward?.seasonXp || 75} XP</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Streak Bonus Tier</span>
              <span class="meta-value text-cyan">${streakTier} (+${Math.min(300, Math.max(0, streak - 1) * 15)}%)</span>
            </div>
          </div>
        </div>

        <div class="daily-footer">
          ${hasCompletedToday ? `
            <div class="daily-status-completed">
              ✅ <strong>COMPLETED FOR TODAY</strong> — Persistent Streak Locked In!
            </div>
          ` : `
            <button class="btn-play-daily glow-amber" id="btn-start-daily-challenge">
              ⚔️ LAUNCH DAILY OBJECTIVE
            </button>
          `}
        </div>
      </div>
    `;

    if (!hasCompletedToday && onPlayClick) {
      const btn = this.container.querySelector("#btn-start-daily-challenge");
      if (btn) btn.addEventListener("click", () => onPlayClick(objective));
    }
  }
}

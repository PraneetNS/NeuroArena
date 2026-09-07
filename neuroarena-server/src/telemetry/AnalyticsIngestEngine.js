/**
 * AnalyticsIngestEngine.js
 * 
 * Lightweight, privacy-conscious event ingestion and query aggregation engine.
 * Emits Prometheus metrics and maintains fast in-memory cohort & funnel caches
 * for real-time D1/D7/D30 retention, FTUE drop-off, and biome completion queries.
 */

const { metrics } = require('../metrics');
const crypto = require('crypto');

const KNOWN_TUTORIAL_STEPS = [
  { index: 1, name: 'harvest_crystal', label: '1. Crystal Harvesting' },
  { index: 2, name: 'live_fit_preview', label: '2. Live Line Fitting' },
  { index: 3, name: 'mini_challenge_lab', label: '3. Mini-Challenge Lab' },
  { index: 4, name: 'first_aha_moment', label: '4. First Aha Moment' },
  { index: 5, name: 'tutorial_complete', label: '5. Tutorial Complete' }
];

const KNOWN_BIOMES = [
  { index: 0, id: 'linear_steppes', name: 'Linear Steppes' },
  { index: 1, id: 'binary_marshlands', name: 'Binary Marshlands' },
  { index: 2, id: 'overfitting_badlands', name: 'Overfitting Badlands' },
  { index: 3, id: 'stochastic_ravine', name: 'Stochastic Ravine' },
  { index: 4, id: 'gradient_peaks', name: 'Gradient Peaks' },
  { index: 5, id: 'eigen_core', name: 'Eigen Core' }
];

class AnalyticsIngestEngine {
  constructor(options = {}) {
    this.maxEventsRetained = options.maxEventsRetained || 50000;
    this.events = [];
    
    // Fast indexing structures
    this.players = new Map(); // playerId -> { firstSeenDate, activeDates: Set<YYYY-MM-DD>, isGuest }
    this.tutorialFunnel = new Map(); // stepKey -> Set<playerId>
    this.tutorialCompletions = new Set(); // playerId
    this.biomeStats = new Map(); // biomeKey -> { entries: Set<playerId>, completions: Set<playerId>, bossAttempts: 0, bossWins: 0, totalDwellSec: 0, dwellCount: 0 }
    this.errorLogs = []; // recent error events

    // Initialize biome stats
    for (const biome of KNOWN_BIOMES) {
      this.biomeStats.set(biome.name, {
        index: biome.index,
        id: biome.id,
        name: biome.name,
        entries: new Set(),
        completions: new Set(),
        bossAttempts: 0,
        bossWins: 0,
        totalDwellSec: 0,
        dwellCount: 0
      });
    }

    // Initialize funnel steps
    for (const step of KNOWN_TUTORIAL_STEPS) {
      this.tutorialFunnel.set(step.name, new Set());
    }
  }

  /**
   * Sanitize incoming event to guarantee zero PII and valid privacy attributes
   */
  sanitizeEvent(rawEvent) {
    if (!rawEvent || typeof rawEvent !== 'object') {
      throw new Error('Invalid event payload: must be an object');
    }

    const eventName = String(rawEvent.eventName || rawEvent.event || '').trim();
    if (!eventName) {
      throw new Error('Missing eventName in analytics payload');
    }

    const isGuest = Boolean(rawEvent.isGuest || rawEvent.is_guest || false);
    let playerId = String(rawEvent.playerId || rawEvent.player_id || '').trim();

    // Anonymous player handling for guests or missing playerId
    if (!playerId) {
      playerId = rawEvent.anonymousId || rawEvent.anonymous_id || (isGuest && rawEvent.sessionId ? `anon_${rawEvent.sessionId}` : `anon_${crypto.randomBytes(8).toString('hex')}`);
    }

    const sessionId = String(rawEvent.sessionId || rawEvent.session_id || `sess_${crypto.randomBytes(8).toString('hex')}`);
    const timestamp = rawEvent.timestamp || rawEvent.timestampUtc || new Date().toISOString();
    const clientPlatform = String(rawEvent.clientPlatform || rawEvent.platform || 'web');
    const clientVersion = String(rawEvent.clientVersion || rawEvent.version || '1.0.0');

    // Extract payload params without any potential PII fields
    const payload = typeof rawEvent.payload === 'object' && rawEvent.payload !== null 
      ? { ...rawEvent.payload }
      : { ...rawEvent };

    // Clean up top-level duplicated metadata
    delete payload.email;
    delete payload.ip;
    delete payload.password;
    delete payload.eventName;
    delete payload.event;
    delete payload.playerId;
    delete payload.player_id;
    delete payload.sessionId;
    delete payload.session_id;

    return {
      id: rawEvent.id || `evt_${crypto.randomBytes(8).toString('hex')}`,
      eventName,
      playerId,
      sessionId,
      isGuest,
      clientPlatform,
      clientVersion,
      timestamp,
      payload
    };
  }

  /**
   * Ingest a single telemetry event
   */
  ingestEvent(rawEvent) {
    const evt = this.sanitizeEvent(rawEvent);

    // 1. Record event into in-memory ring buffer
    this.events.push(evt);
    if (this.events.length > this.maxEventsRetained) {
      this.events.shift();
    }

    // 2. Track player activity dates for retention calculation
    const eventDate = evt.timestamp.substring(0, 10); // YYYY-MM-DD
    if (!this.players.has(evt.playerId)) {
      this.players.set(evt.playerId, {
        firstSeenDate: eventDate,
        activeDates: new Set([eventDate]),
        isGuest: evt.isGuest,
        completedTutorial: false
      });
    } else {
      const p = this.players.get(evt.playerId);
      p.activeDates.add(eventDate);
    }

    // 3. Update Prometheus metrics and domain-specific analytical aggregation
    metrics.incCounter('neuroarena_telemetry_events_total', 1);

    const name = evt.eventName.toLowerCase();
    const data = evt.payload;

    if (name === 'session_start' || name === 'ftue_session_started') {
      metrics.incCounter('neuroarena_session_starts_total', 1);
    } 
    else if (name === 'session_end') {
      metrics.incCounter('neuroarena_session_ends_total', 1);
      if (typeof data.duration_sec === 'number' || typeof data.durationSeconds === 'number') {
        const dur = data.duration_sec || data.durationSeconds;
        metrics.observeHistogram('neuroarena_session_duration_seconds', dur);
      }
    } 
    else if (name.startsWith('tutorial_step') || name === 'ftue_first_aha_reached') {
      metrics.incCounter('neuroarena_tutorial_steps_completed_total', 1);
      const stepName = data.step_name || data.stepName || name.replace('tutorial_step_', '');
      
      // Match with known step or record directly
      for (const known of KNOWN_TUTORIAL_STEPS) {
        if (stepName.includes(known.name) || (data.step_index === known.index)) {
          if (!this.tutorialFunnel.has(known.name)) {
            this.tutorialFunnel.set(known.name, new Set());
          }
          this.tutorialFunnel.get(known.name).add(evt.playerId);
          break;
        }
      }
    } 
    else if (name === 'tutorial_completed') {
      metrics.incCounter('neuroarena_tutorial_completed_total', 1);
      this.tutorialCompletions.add(evt.playerId);
      const playerRecord = this.players.get(evt.playerId);
      if (playerRecord) playerRecord.completedTutorial = true;

      // Add to last funnel step
      if (this.tutorialFunnel.has('tutorial_complete')) {
        this.tutorialFunnel.get('tutorial_complete').add(evt.playerId);
      }

      if (typeof data.duration_seconds === 'number' || typeof data.total_duration_sec === 'number') {
        const dur = data.duration_seconds || data.total_duration_sec;
        metrics.observeHistogram('neuroarena_tutorial_duration_seconds', dur);
      }
    } 
    else if (name === 'biome_enter') {
      metrics.incCounter('neuroarena_biome_entries_total', 1);
      const biomeName = data.biome_name || data.biomeName || 'Linear Steppes';
      if (this.biomeStats.has(biomeName)) {
        this.biomeStats.get(biomeName).entries.add(evt.playerId);
      }
    } 
    else if (name === 'biome_exit') {
      metrics.incCounter('neuroarena_biome_exits_total', 1);
      const biomeName = data.biome_name || data.biomeName || 'Linear Steppes';
      const stats = this.biomeStats.get(biomeName);
      if (stats) {
        if (data.completed || data.is_completed) {
          metrics.incCounter('neuroarena_biome_completions_total', 1);
          stats.completions.add(evt.playerId);
        }
        const dwell = data.time_spent_sec || data.dwell_seconds || 0;
        if (dwell > 0) {
          stats.totalDwellSec += dwell;
          stats.dwellCount++;
          metrics.observeHistogram('neuroarena_biome_dwell_seconds', dwell);
        }
      }
    } 
    else if (name === 'boss_attempt') {
      metrics.incCounter('neuroarena_boss_attempts_total', 1);
      const biomeName = data.biome_name || data.biomeName || 'Linear Steppes';
      const stats = this.biomeStats.get(biomeName);
      if (stats) stats.bossAttempts++;
    } 
    else if (name === 'boss_result') {
      const won = Boolean(data.won || data.victory);
      const biomeName = data.biome_name || data.biomeName || 'Linear Steppes';
      const stats = this.biomeStats.get(biomeName);

      if (won) {
        metrics.incCounter('neuroarena_boss_wins_total', 1);
        if (stats) stats.bossWins++;
      } else {
        metrics.incCounter('neuroarena_boss_losses_total', 1);
      }
    } 
    else if (name === 'duel_start') {
      metrics.incCounter('neuroarena_duel_starts_total', 1);
    } 
    else if (name === 'duel_result') {
      metrics.incCounter('neuroarena_duel_results_total', 1);
    } 
    else if (name === 'reward_claim') {
      metrics.incCounter('neuroarena_rewards_claimed_total', 1);
    } 
    else if (name === 'purchase') {
      metrics.incCounter('neuroarena_purchases_total', 1);
    } 
    else if (name === 'crash_error' || name === 'client_error') {
      metrics.incCounter('neuroarena_client_errors_total', 1);
      this.errorLogs.unshift({
        timestamp: evt.timestamp,
        playerId: evt.playerId,
        platform: evt.clientPlatform,
        errorType: data.error_type || data.errorType || 'FatalException',
        message: data.message || 'Unknown error',
        stack: data.stack || ''
      });
      if (this.errorLogs.length > 50) this.errorLogs.pop();
    }

    return evt;
  }

  /**
   * Ingest a batch of telemetry events
   */
  ingestBatch(events = []) {
    if (!Array.isArray(events)) {
      throw new Error('Batch ingestion expects an array of events');
    }
    const results = [];
    for (const raw of events) {
      results.push(this.ingestEvent(raw));
    }
    return {
      ingested: results.length,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Compute D1, D7, D30 player retention rates based on cohorts
   */
  computeRetention() {
    let totalTrackedPlayers = this.players.size;
    if (totalTrackedPlayers === 0) {
      return {
        totalPlayers: 0,
        d1RetentionRate: 0,
        d7RetentionRate: 0,
        d30RetentionRate: 0,
        d1ReturningCount: 0,
        d7ReturningCount: 0,
        d30ReturningCount: 0,
        cohorts: []
      };
    }

    // Helper: calculate difference in calendar days
    const diffDays = (d1Str, d2Str) => {
      const d1 = new Date(d1Str);
      const d2 = new Date(d2Str);
      return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
    };

    let eligibleD1 = 0;
    let returnedD1 = 0;
    let eligibleD7 = 0;
    let returnedD7 = 0;
    let eligibleD30 = 0;
    let returnedD30 = 0;

    const todayStr = new Date().toISOString().substring(0, 10);

    for (const [_, p] of this.players.entries()) {
      const daysSinceFirstSeen = diffDays(p.firstSeenDate, todayStr);

      if (daysSinceFirstSeen >= 1) {
        eligibleD1++;
        let hasD1 = false;
        for (const activeDate of p.activeDates) {
          const delta = diffDays(p.firstSeenDate, activeDate);
          if (delta === 1) {
            hasD1 = true;
            break;
          }
        }
        if (hasD1) returnedD1++;
      }

      if (daysSinceFirstSeen >= 7) {
        eligibleD7++;
        let hasD7 = false;
        for (const activeDate of p.activeDates) {
          const delta = diffDays(p.firstSeenDate, activeDate);
          if (delta >= 6 && delta <= 8) {
            hasD7 = true;
            break;
          }
        }
        if (hasD7) returnedD7++;
      }

      if (daysSinceFirstSeen >= 30) {
        eligibleD30++;
        let hasD30 = false;
        for (const activeDate of p.activeDates) {
          const delta = diffDays(p.firstSeenDate, activeDate);
          if (delta >= 28 && delta <= 32) {
            hasD30 = true;
            break;
          }
        }
        if (hasD30) returnedD30++;
      }
    }

    const d1Rate = eligibleD1 > 0 ? (returnedD1 / eligibleD1) * 100 : (returnedD1 > 0 ? 100 : 0);
    const d7Rate = eligibleD7 > 0 ? (returnedD7 / eligibleD7) * 100 : (returnedD7 > 0 ? 100 : 0);
    const d30Rate = eligibleD30 > 0 ? (returnedD30 / eligibleD30) * 100 : (returnedD30 > 0 ? 100 : 0);

    return {
      totalPlayers: totalTrackedPlayers,
      eligibleD1,
      returnedD1,
      d1RetentionRate: Number(d1Rate.toFixed(1)),
      eligibleD7,
      returnedD7,
      d7RetentionRate: Number(d7Rate.toFixed(1)),
      eligibleD30,
      returnedD30,
      d30RetentionRate: Number(d30Rate.toFixed(1))
    };
  }

  /**
   * Compute Step-by-Step FTUE Tutorial Funnel & Drop-off Rates
   * Acceptance Criteria: Can answer "what % of new players complete the tutorial"
   */
  computeTutorialFunnel() {
    const totalNewPlayers = this.players.size;
    const step1Count = this.tutorialFunnel.get('harvest_crystal')?.size || 0;
    const baselineStarters = Math.max(totalNewPlayers, step1Count, 1);

    const steps = [];
    let previousStepCount = baselineStarters;

    for (const step of KNOWN_TUTORIAL_STEPS) {
      const stepCount = this.tutorialFunnel.get(step.name)?.size || 0;
      const overallConversionPct = (stepCount / baselineStarters) * 100;
      const dropOffFromPrevPct = previousStepCount > 0 
        ? Math.max(0, ((previousStepCount - stepCount) / previousStepCount) * 100)
        : 0;

      steps.push({
        stepIndex: step.index,
        stepKey: step.name,
        stepName: step.label,
        playersCompleted: stepCount,
        overallConversionRate: Number(overallConversionPct.toFixed(1)),
        dropOffRate: Number(dropOffFromPrevPct.toFixed(1))
      });

      previousStepCount = stepCount;
    }

    const completedCount = this.tutorialCompletions.size;
    const overallCompletionPct = (completedCount / baselineStarters) * 100;

    return {
      totalStarters: totalNewPlayers,
      completedTutorialCount: completedCount,
      overallCompletionRate: Number(overallCompletionPct.toFixed(1)),
      steps
    };
  }

  /**
   * Compute Biome-by-Biome Completion Rates & Boss Win Statistics
   */
  computeBiomeProgression() {
    const biomes = [];

    for (const [_, stats] of this.biomeStats.entries()) {
      const entries = stats.entries.size;
      const completions = stats.completions.size;
      const completionRate = entries > 0 ? (completions / entries) * 100 : 0;
      const bossWinRate = stats.bossAttempts > 0 ? (stats.bossWins / stats.bossAttempts) * 100 : 0;
      const avgDwellSec = stats.dwellCount > 0 ? stats.totalDwellSec / stats.dwellCount : 0;

      biomes.push({
        biomeIndex: stats.index,
        biomeId: stats.id,
        biomeName: stats.name,
        playerEntries: entries,
        playerCompletions: completions,
        completionRate: Number(completionRate.toFixed(1)),
        bossAttempts: stats.bossAttempts,
        bossWins: stats.bossWins,
        bossWinRate: Number(bossWinRate.toFixed(1)),
        avgDwellSeconds: Number(avgDwellSec.toFixed(1))
      });
    }

    return biomes;
  }

  /**
   * Get full executive analytics dashboard summary
   */
  getDashboardSummary() {
    const retention = this.computeRetention();
    const tutorialFunnel = this.computeTutorialFunnel();
    const biomes = this.computeBiomeProgression();

    return {
      generatedAt: new Date().toISOString(),
      summaryKpis: {
        totalTrackedPlayers: this.players.size,
        totalEventsIngested: this.events.length,
        d1RetentionRate: retention.d1RetentionRate,
        d7RetentionRate: retention.d7RetentionRate,
        d30RetentionRate: retention.d30RetentionRate,
        tutorialCompletionRate: tutorialFunnel.overallCompletionRate,
        totalCrashesLogged: this.errorLogs.length
      },
      retention,
      tutorialFunnel,
      biomeProgression: biomes,
      recentErrors: this.errorLogs.slice(0, 10)
    };
  }

  /**
   * Clear in-memory analytics (used for unit testing)
   */
  reset() {
    this.events = [];
    this.players.clear();
    this.tutorialCompletions.clear();
    this.errorLogs = [];
    for (const step of KNOWN_TUTORIAL_STEPS) {
      this.tutorialFunnel.set(step.name, new Set());
    }
    for (const biome of KNOWN_BIOMES) {
      this.biomeStats.set(biome.name, {
        index: biome.index,
        id: biome.id,
        name: biome.name,
        entries: new Set(),
        completions: new Set(),
        bossAttempts: 0,
        bossWins: 0,
        totalDwellSec: 0,
        dwellCount: 0
      });
    }
  }
}

const analyticsIngestEngine = new AnalyticsIngestEngine();

module.exports = {
  AnalyticsIngestEngine,
  analyticsIngestEngine,
  KNOWN_TUTORIAL_STEPS,
  KNOWN_BIOMES
};

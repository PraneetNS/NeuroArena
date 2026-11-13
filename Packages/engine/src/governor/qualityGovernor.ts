/**
 * Auto Quality Governor for NeuroArena Open-World Engine.
 * Requirements:
 * - 'Quality: Auto' adjusts DPR first, then effects, with hysteresis (no flapping).
 * - Starts from the detected hardware tier.
 * - Shows what it changed in the debug HUD / telemetry.
 */

import { World } from '../world.js';
import { QualityTier } from '../terrain/terrainManager.js';

export interface QualityGovernorConfig {
  targetFps: number;            // 60 or 30
  downgradeThresholdMs: number; // e.g. 21.0ms for 60fps (drops below ~48 fps)
  upgradeThresholdMs: number;   // e.g. 13.5ms (room for headroom, ~74 fps)
  sustainedDowngradeSec: number; // 2.5s sustained before stepping down
  sustainedUpgradeSec: number;   // 5.0s sustained before stepping up
  cooldownSec: number;           // 3.0s cooldown between adjustments
}

export interface QualityGovernorState {
  currentTier: QualityTier;
  currentDpr: number;
  bloomEnabled: boolean;
  gtaoEnabled: boolean;
  shadowsEnabled: boolean;
  lastAdjustmentReason: string;
  adjustmentLog: string[];
}

export class QualityGovernor {
  private world: World;
  private config: QualityGovernorConfig;
  private isEnabled: boolean = false;

  private detectedTier: QualityTier = 'high';
  private currentTier: QualityTier = 'high';
  private currentDpr: number = 1.0;

  private bloomEnabled: boolean = true;
  private gtaoEnabled: boolean = true;
  private shadowsEnabled: boolean = true;

  // Frame timing tracking
  private frameTimes: number[] = [];
  private maxSamples: number = 120;
  private badPerformanceDuration: number = 0;
  private goodPerformanceDuration: number = 0;
  private cooldownTimer: number = 0;

  private lastAdjustmentReason: string = 'Initialized at hardware tier';
  private adjustmentLog: string[] = [];

  constructor(world: World, initialTier: QualityTier = 'high', config?: Partial<QualityGovernorConfig>) {
    this.world = world;
    this.detectedTier = initialTier;
    this.currentTier = initialTier;

    const baseTargetFps = initialTier === 'low' ? 30 : 60;
    this.config = {
      targetFps: config?.targetFps ?? baseTargetFps,
      downgradeThresholdMs: config?.downgradeThresholdMs ?? (baseTargetFps === 30 ? 38.0 : 21.0),
      upgradeThresholdMs: config?.upgradeThresholdMs ?? (baseTargetFps === 30 ? 25.0 : 13.5),
      sustainedDowngradeSec: config?.sustainedDowngradeSec ?? 2.5,
      sustainedUpgradeSec: config?.sustainedUpgradeSec ?? 5.0,
      cooldownSec: config?.cooldownSec ?? 3.0
    };

    this.currentDpr = initialTier === 'low' ? 0.75 : 1.0;
  }

  public enable(): void {
    this.isEnabled = true;
    this.applySettings('Governor activated');
  }

  public disable(): void {
    this.isEnabled = false;
  }

  public isActive(): boolean {
    return this.isEnabled;
  }

  /**
   * Called every frame with the delta time (dt in seconds) and frame time (ms).
   */
  public update(dt: number, frameTimeMs: number): void {
    if (!this.isEnabled) return;

    // Collect frame time sample
    this.frameTimes.push(frameTimeMs);
    if (this.frameTimes.length > this.maxSamples) {
      this.frameTimes.shift();
    }

    if (this.cooldownTimer > 0) {
      this.cooldownTimer -= dt;
      return;
    }

    // Compute rolling median / p50 frame time
    const sorted = [...this.frameTimes].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)] || frameTimeMs;

    // Evaluate sustained load
    if (p50 > this.config.downgradeThresholdMs) {
      this.badPerformanceDuration += dt;
      this.goodPerformanceDuration = 0;

      if (this.badPerformanceDuration >= this.config.sustainedDowngradeSec) {
        this.stepDown(`Sustained frame time ${p50.toFixed(1)}ms > ${this.config.downgradeThresholdMs}ms for ${this.badPerformanceDuration.toFixed(1)}s`);
        this.badPerformanceDuration = 0;
        this.cooldownTimer = this.config.cooldownSec;
      }
    } else if (p50 < this.config.upgradeThresholdMs) {
      this.goodPerformanceDuration += dt;
      this.badPerformanceDuration = 0;

      if (this.goodPerformanceDuration >= this.config.sustainedUpgradeSec) {
        this.stepUp(`Sustained frame time ${p50.toFixed(1)}ms < ${this.config.upgradeThresholdMs}ms for ${this.goodPerformanceDuration.toFixed(1)}s`);
        this.goodPerformanceDuration = 0;
        this.cooldownTimer = this.config.cooldownSec;
      }
    } else {
      // Nominal range: slowly decay accumulated counters
      this.badPerformanceDuration = Math.max(0, this.badPerformanceDuration - dt * 0.5);
      this.goodPerformanceDuration = Math.max(0, this.goodPerformanceDuration - dt * 0.5);
    }
  }

  /**
   * Downgrades quality: DPR first, then post-effects, then tier.
   */
  private stepDown(reason: string): void {
    // 1. Adjust DPR first (e.g. 1.0 -> 0.85 -> 0.75)
    if (this.currentDpr > 0.86) {
      this.currentDpr = 0.85;
      this.applySettings(`Reduced DPR to 0.85: ${reason}`);
      return;
    } else if (this.currentDpr > 0.76) {
      this.currentDpr = 0.75;
      this.applySettings(`Reduced DPR to 0.75: ${reason}`);
      return;
    }

    // 2. Adjust effects next: turn off GTAO, then Bloom
    if (this.gtaoEnabled) {
      this.gtaoEnabled = false;
      this.applySettings(`Disabled GTAO: ${reason}`);
      return;
    }
    if (this.bloomEnabled) {
      this.bloomEnabled = false;
      this.applySettings(`Disabled Bloom: ${reason}`);
      return;
    }

    // 3. Step down quality tier
    if (this.currentTier === 'high') {
      this.currentTier = 'medium';
      this.currentDpr = 1.0; // Reset DPR for next tier steps
      this.applySettings(`Switched tier High -> Medium: ${reason}`);
    } else if (this.currentTier === 'medium') {
      this.currentTier = 'low';
      this.currentDpr = 0.75;
      this.applySettings(`Switched tier Medium -> Low: ${reason}`);
    }
  }

  /**
   * Upgrades quality if sustained headroom is available (with hysteresis).
   */
  private stepUp(reason: string): void {
    // 1. Upgrade tier if below detected tier
    if (this.currentTier === 'low' && this.detectedTier !== 'low') {
      this.currentTier = 'medium';
      this.currentDpr = 0.85;
      this.applySettings(`Upgraded tier Low -> Medium: ${reason}`);
      return;
    } else if (this.currentTier === 'medium' && this.detectedTier === 'high') {
      this.currentTier = 'high';
      this.currentDpr = 0.85;
      this.applySettings(`Upgraded tier Medium -> High: ${reason}`);
      return;
    }

    // 2. Re-enable effects
    if (!this.bloomEnabled) {
      this.bloomEnabled = true;
      this.applySettings(`Restored Bloom: ${reason}`);
      return;
    }
    if (!this.gtaoEnabled && this.currentTier === 'high') {
      this.gtaoEnabled = true;
      this.applySettings(`Restored GTAO: ${reason}`);
      return;
    }

    // 3. Raise DPR back to native
    if (this.currentDpr < 0.84) {
      this.currentDpr = 0.85;
      this.applySettings(`Raised DPR to 0.85: ${reason}`);
    } else if (this.currentDpr < 0.99) {
      this.currentDpr = 1.0;
      this.applySettings(`Restored native DPR 1.0: ${reason}`);
    }
  }

  private applySettings(reason: string): void {
    this.lastAdjustmentReason = reason;
    this.adjustmentLog.push(`[${new Date().toLocaleTimeString()}] ${reason}`);
    if (this.adjustmentLog.length > 20) this.adjustmentLog.shift();

    // Apply Tier
    this.world.setQualityTier(this.currentTier);

    // Apply DPR
    this.world.setDpr(this.currentDpr);

    // Apply Post Effects
    if (this.world.environment?.postProcessing) {
      this.world.environment.postProcessing.toggleEffect('enableBloom', this.bloomEnabled);
      this.world.environment.postProcessing.toggleEffect('enableGTAO', this.gtaoEnabled);
    }
  }

  public getStatusString(): string {
    if (!this.isEnabled) return 'Quality: Manual';
    const effectNotes = [];
    if (!this.bloomEnabled) effectNotes.push('-bloom');
    if (!this.gtaoEnabled) effectNotes.push('-gtao');
    const notesStr = effectNotes.length > 0 ? ` (${effectNotes.join(', ')})` : '';
    return `Auto [${this.currentTier.toUpperCase()}, DPR ${this.currentDpr.toFixed(2)}${notesStr}]`;
  }

  public getState(): QualityGovernorState {
    return {
      currentTier: this.currentTier,
      currentDpr: this.currentDpr,
      bloomEnabled: this.bloomEnabled,
      gtaoEnabled: this.gtaoEnabled,
      shadowsEnabled: this.shadowsEnabled,
      lastAdjustmentReason: this.lastAdjustmentReason,
      adjustmentLog: [...this.adjustmentLog]
    };
  }
}


/**
 * Real-time Terrain Engine & Environment Diagnostics Overlay:
 * - Header with active GPU name and WebGPU/WebGL2 backend indicator
 * - FPS counter with dynamic color coding
 * - Total draw calls & triangle budgets (< 800 draw calls, < 2M triangles, < 1GB VRAM)
 * - Per-feature breakdown (Terrain, Grass, Foliage, Water, Post-Processing)
 * - Time of day & Golden hour status
 * - Quality tier controls (Low / Medium / High)
 * - Preferred GPU settings (Auto / High Performance / Low Power) persisted in localStorage
 * - Free-Fly Camera telemetry
 */

import { QualityTier, EnvironmentStats } from '@na/engine';
import {
  GpuPreference,
  getPreferredGpuSetting,
  setPreferredGpuSetting
} from './capability.js';

export interface OverlayStatsData extends EnvironmentStats {
  activeChunks: number;
  visibleChunks?: number;
  backendName?: string;
  gpuName?: string;
  gpuPowerPreference?: string;
  isFreeFly: boolean;
  cameraPos: { x: number; y: number; z: number };
  groundHeight: number;
}

export class TerrainStatsOverlay {
  public root: HTMLElement;
  private onQualityChange: (tier: QualityTier) => void;
  private onToggleFreeFly: () => void;
  private onOpenDebugPanel?: () => void;
  private onGpuPreferenceChange?: (pref: GpuPreference) => void;

  private fpsValEl!: HTMLElement;
  private gpuNameEl!: HTMLElement;
  private drawCallsValEl!: HTMLElement;
  private trisValEl!: HTMLElement;
  private memValEl!: HTMLElement;
  private chunksValEl!: HTMLElement;
  private camModeBtn!: HTMLButtonElement;
  private posValEl!: HTMLElement;
  private groundValEl!: HTMLElement;
  private timeValEl!: HTMLElement;

  // Per-feature breakdown elements
  private featTerrainEl!: HTMLElement;
  private featGrassEl!: HTMLElement;
  private featFoliageEl!: HTMLElement;
  private featWaterEl!: HTMLElement;
  private featPostEl!: HTMLElement;

  private btnLow!: HTMLButtonElement;
  private btnMed!: HTMLButtonElement;
  private btnHigh!: HTMLButtonElement;

  // Preferred GPU buttons
  private btnGpuAuto!: HTMLButtonElement;
  private btnGpuHigh!: HTMLButtonElement;
  private btnGpuLow!: HTMLButtonElement;
  private initialGpuPref: GpuPreference;

  constructor(
    parent: HTMLElement,
    callbacks: {
      onQualityChange: (tier: QualityTier) => void;
      onToggleFreeFly: () => void;
      onOpenDebugPanel?: () => void;
      onGpuPreferenceChange?: (pref: GpuPreference) => void;
    }
  ) {
    this.onQualityChange = callbacks.onQualityChange;
    this.onToggleFreeFly = callbacks.onToggleFreeFly;
    this.onOpenDebugPanel = callbacks.onOpenDebugPanel;
    this.onGpuPreferenceChange = callbacks.onGpuPreferenceChange;

    this.initialGpuPref = getPreferredGpuSetting();

    this.root = document.createElement('div');
    this.root.id = 'terrain-stats-overlay';
    this.root.style.cssText = `
      position: absolute;
      top: 1rem;
      left: 1rem;
      z-index: 999;
      pointer-events: auto;
      font-family: var(--na-font-mono, 'IBM Plex Mono', monospace);
      width: 350px;
      user-select: none;
    `;
    parent.appendChild(this.root);

    this.render();
  }

  private render(): void {
    const currentPref = getPreferredGpuSetting();

    this.root.innerHTML = `
      <div style="background: rgba(14, 17, 22, 0.92); backdrop-filter: blur(14px); border: 1px solid var(--na-line, #2A333F); border-radius: 6px; padding: 0.85rem; box-shadow: 0 8px 32px rgba(0,0,0,0.65); display: flex; flex-direction: column; gap: 0.6rem; color: #E8E4DA;">
        
        <!-- Header with Active GPU Name -->
        <div style="display: flex; flex-direction: column; gap: 0.25rem; border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding-bottom: 0.4rem;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="font-weight: 700; font-size: 0.8rem; color: var(--na-accent, #E8A33D); letter-spacing: 0.05em; display: flex; align-items: center; gap: 0.4rem;">
              <span style="width: 7px; height: 7px; border-radius: 50%; background: var(--na-accent, #E8A33D); box-shadow: 0 0 6px var(--na-accent, #E8A33D); display: inline-block;"></span>
              ENGINE DIAGNOSTICS <span id="stat-backend" style="font-size: 0.65rem; color: var(--na-accent-cool, #4FB3A9); padding: 1px 4px; background: rgba(79, 179, 169, 0.15); border-radius: 3px;">WebGPU</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span id="stat-time" style="font-size: 0.72rem; color: #cbd5e1;">18:12</span>
              <span id="stat-fps" style="font-size: 0.95rem; font-weight: 700; color: #6BBF7A;">60 FPS</span>
            </div>
          </div>
          <!-- Active GPU Name Display -->
          <div style="font-size: 0.66rem; display: flex; align-items: center; gap: 0.35rem; overflow: hidden;">
            <span style="color: #9AA3AE; font-size: 0.58rem; text-transform: uppercase;">ACTIVE GPU:</span>
            <span id="stat-gpu-name" style="color: #4FB3A9; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="Active GPU Device">Detecting GPU...</span>
          </div>
        </div>

        <!-- Preferred GPU Option (Persisted in localStorage) -->
        <div style="display: flex; flex-direction: column; gap: 0.25rem;">
          <div style="display: flex; justify-content: space-between; font-size: 0.65rem; color: #9AA3AE; text-transform: uppercase;">
            <span>Preferred GPU</span>
            <span style="color: #4FB3A9; font-size: 0.6rem;">Persisted (localStorage)</span>
          </div>
          <div style="display: flex; gap: 0.35rem;">
            <button id="gpu-btn-auto" class="tier-btn" style="flex: 1; padding: 0.28rem; font-size: 0.68rem; font-family: inherit; border-radius: 4px; border: 1px solid #2A333F; background: #1D242D; color: #9AA3AE; cursor: pointer;">Auto</button>
            <button id="gpu-btn-high" class="tier-btn" style="flex: 1; padding: 0.28rem; font-size: 0.68rem; font-family: inherit; border-radius: 4px; border: 1px solid #2A333F; background: #1D242D; color: #9AA3AE; cursor: pointer;">High Perf</button>
            <button id="gpu-btn-low" class="tier-btn" style="flex: 1; padding: 0.28rem; font-size: 0.68rem; font-family: inherit; border-radius: 4px; border: 1px solid #2A333F; background: #1D242D; color: #9AA3AE; cursor: pointer;">Low Power</button>
          </div>
          <div id="gpu-reload-prompt" style="display: none; font-size: 0.62rem; color: #E8A33D; background: rgba(232, 163, 61, 0.12); border: 1px solid rgba(232, 163, 61, 0.3); padding: 3px 6px; border-radius: 3px; align-items: center; justify-content: space-between; margin-top: 2px;">
            <span>GPU preference saved. Reload to apply.</span>
            <button id="gpu-reload-btn" style="background: #E8A33D; color: #0E1116; border: none; border-radius: 2px; font-size: 0.6rem; font-weight: 700; padding: 1px 6px; cursor: pointer;">Reload</button>
          </div>
        </div>

        <!-- Quality Tiers -->
        <div style="display: flex; flex-direction: column; gap: 0.25rem;">
          <div style="display: flex; justify-content: space-between; font-size: 0.65rem; color: #9AA3AE; text-transform: uppercase;">
            <span>Quality Tier</span>
            <span>Budgets: &lt;800 DC | &lt;2M Tris</span>
          </div>
          <div style="display: flex; gap: 0.35rem;">
            <button id="tier-low" class="tier-btn" style="flex: 1; padding: 0.28rem; font-size: 0.68rem; font-family: inherit; border-radius: 4px; border: 1px solid #2A333F; background: #1D242D; color: #9AA3AE; cursor: pointer;">Low</button>
            <button id="tier-med" class="tier-btn" style="flex: 1; padding: 0.28rem; font-size: 0.68rem; font-family: inherit; border-radius: 4px; border: 1px solid #2A333F; background: #1D242D; color: #9AA3AE; cursor: pointer;">Medium</button>
            <button id="tier-high" class="tier-btn" style="flex: 1; padding: 0.28rem; font-size: 0.68rem; font-family: inherit; border-radius: 4px; border: 1px solid #E8A33D; background: rgba(232, 163, 61, 0.18); color: #E8A33D; font-weight: 600; cursor: pointer;">High</button>
          </div>
        </div>

        <!-- Overall Budget Grid -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.4rem; background: #151A21; padding: 0.5rem; border-radius: 4px; border: 1px solid #2A333F; font-size: 0.7rem;">
          <div>
            <div style="color: #9AA3AE; font-size: 0.62rem;">TOTAL DRAW CALLS</div>
            <div id="stat-drawcalls" style="color: #E8E4DA; font-weight: 700;">-- / 800</div>
          </div>
          <div>
            <div style="color: #9AA3AE; font-size: 0.62rem;">TOTAL TRIANGLES</div>
            <div id="stat-tris" style="color: #E8E4DA; font-weight: 700;">-- / 2.0M</div>
          </div>
          <div>
            <div style="color: #9AA3AE; font-size: 0.62rem;">CHUNKS (RAM / VISIBLE)</div>
            <div id="stat-chunks" style="color: #4FB3A9; font-weight: 700;">--</div>
          </div>
          <div>
            <div style="color: #9AA3AE; font-size: 0.62rem;">EST. GPU MEMORY</div>
            <div id="stat-mem" style="color: #E8A33D; font-weight: 700;">-- MB / 1GB</div>
          </div>
        </div>

        <!-- Per-Frame Cost Breakdown Table -->
        <div style="background: #151A21; padding: 0.45rem; border-radius: 4px; border: 1px solid #2A333F; font-size: 0.65rem;">
          <div style="color: #9AA3AE; font-weight: 600; margin-bottom: 0.25rem; text-transform: uppercase;">Per-Frame Render Breakdown</div>
          <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed rgba(255,255,255,0.06); padding: 2px 0;">
            <span style="color: #9AA3AE;">Terrain Surface (Separate Meshes)</span>
            <span id="feat-terrain" style="color: #E8E4DA;">--</span>
          </div>
          <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed rgba(255,255,255,0.06); padding: 2px 0;">
            <span style="color: #9AA3AE;">Terrain Skirts (12m extruded)</span>
            <span style="color: #4FB3A9;">0 DC (baked in chunk geom)</span>
          </div>
          <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed rgba(255,255,255,0.06); padding: 2px 0;">
            <span style="color: #9AA3AE;">Sky & Atmosphere Dome</span>
            <span style="color: #E8A33D;">1.5k tris (1 DC)</span>
          </div>
          <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed rgba(255,255,255,0.06); padding: 2px 0;">
            <span style="color: #9AA3AE;">GPU Grass Blades (Instanced)</span>
            <span id="feat-grass" style="color: #6BBF7A;">--</span>
          </div>
          <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed rgba(255,255,255,0.06); padding: 2px 0;">
            <span style="color: #9AA3AE;">Foliage & Boulders (Instanced)</span>
            <span id="feat-foliage" style="color: #E8A33D;">--</span>
          </div>
          <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed rgba(255,255,255,0.06); padding: 2px 0;">
            <span style="color: #9AA3AE;">Water Plane (Reflective)</span>
            <span id="feat-water" style="color: #4FB3A9;">--</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 2px 0;">
            <span style="color: #9AA3AE;">Post-Processing & Other</span>
            <span id="feat-post" style="color: #C084FC;">--</span>
          </div>
        </div>

        <!-- Camera Mode & Debug Controls -->
        <div style="display: flex; gap: 0.4rem;">
          <button id="toggle-freefly-btn" style="flex: 2; padding: 0.35rem; font-size: 0.72rem; font-weight: 600; font-family: inherit; border-radius: 4px; border: 1px solid #3A4657; background: #1D242D; color: #E8E4DA; cursor: pointer; text-align: center;">
            [F] 3rd-Person Orbit
          </button>
          <button id="open-debug-btn" style="flex: 1; padding: 0.35rem; font-size: 0.72rem; font-weight: 600; font-family: inherit; border-radius: 4px; border: 1px solid var(--na-accent, #E8A33D); background: rgba(232, 163, 61, 0.15); color: var(--na-accent, #E8A33D); cursor: pointer;">
            [G] Debug
          </button>
        </div>

        <!-- Telemetry -->
        <div style="display: flex; justify-content: space-between; font-size: 0.65rem; color: #9AA3AE; border-top: 1px solid #2A333F; padding-top: 0.35rem;">
          <div>POS: <span id="stat-pos" style="color: #E8E4DA; font-weight: 600;">(0, 0, 0)</span></div>
          <div>ALT: <span id="stat-ground" style="color: #6BBF7A; font-weight: 600;">-- m</span></div>
        </div>
      </div>
    `;

    this.fpsValEl = this.root.querySelector('#stat-fps')!;
    this.gpuNameEl = this.root.querySelector('#stat-gpu-name')!;
    this.timeValEl = this.root.querySelector('#stat-time')!;
    this.drawCallsValEl = this.root.querySelector('#stat-drawcalls')!;
    this.trisValEl = this.root.querySelector('#stat-tris')!;
    this.memValEl = this.root.querySelector('#stat-mem')!;
    this.chunksValEl = this.root.querySelector('#stat-chunks')!;
    this.camModeBtn = this.root.querySelector('#toggle-freefly-btn')!;
    this.posValEl = this.root.querySelector('#stat-pos')!;
    this.groundValEl = this.root.querySelector('#stat-ground')!;

    this.featTerrainEl = this.root.querySelector('#feat-terrain')!;
    this.featGrassEl = this.root.querySelector('#feat-grass')!;
    this.featFoliageEl = this.root.querySelector('#feat-foliage')!;
    this.featWaterEl = this.root.querySelector('#feat-water')!;
    this.featPostEl = this.root.querySelector('#feat-post')!;

    this.btnLow = this.root.querySelector('#tier-low')!;
    this.btnMed = this.root.querySelector('#tier-med')!;
    this.btnHigh = this.root.querySelector('#tier-high')!;

    this.btnLow.onclick = () => this.selectTier('low');
    this.btnMed.onclick = () => this.selectTier('medium');
    this.btnHigh.onclick = () => this.selectTier('high');

    // GPU Preference buttons
    this.btnGpuAuto = this.root.querySelector('#gpu-btn-auto')!;
    this.btnGpuHigh = this.root.querySelector('#gpu-btn-high')!;
    this.btnGpuLow = this.root.querySelector('#gpu-btn-low')!;

    this.btnGpuAuto.onclick = () => this.selectGpuPref('auto');
    this.btnGpuHigh.onclick = () => this.selectGpuPref('high-performance');
    this.btnGpuLow.onclick = () => this.selectGpuPref('low-power');

    this.applyGpuPrefUI(currentPref);

    this.root.querySelector('#gpu-reload-btn')?.addEventListener('click', () => {
      window.location.reload();
    });

    this.camModeBtn.onclick = () => this.onToggleFreeFly();

    const debugBtn = this.root.querySelector('#open-debug-btn') as HTMLButtonElement;
    if (debugBtn && this.onOpenDebugPanel) {
      debugBtn.onclick = () => this.onOpenDebugPanel!();
    }
  }

  public selectGpuPref(pref: GpuPreference): void {
    setPreferredGpuSetting(pref);
    this.applyGpuPrefUI(pref);

    const reloadPrompt = this.root.querySelector('#gpu-reload-prompt') as HTMLElement;
    if (reloadPrompt) {
      if (pref !== this.initialGpuPref) {
        reloadPrompt.style.display = 'flex';
      } else {
        reloadPrompt.style.display = 'none';
      }
    }

    if (this.onGpuPreferenceChange) {
      this.onGpuPreferenceChange(pref);
    }
  }

  private applyGpuPrefUI(pref: GpuPreference): void {
    const list = [
      { btn: this.btnGpuAuto, p: 'auto' },
      { btn: this.btnGpuHigh, p: 'high-performance' },
      { btn: this.btnGpuLow, p: 'low-power' }
    ];

    for (const item of list) {
      if (item.p === pref) {
        item.btn.style.border = '1px solid #4FB3A9';
        item.btn.style.background = 'rgba(79, 179, 169, 0.2)';
        item.btn.style.color = '#4FB3A9';
        item.btn.style.fontWeight = '700';
      } else {
        item.btn.style.border = '1px solid #2A333F';
        item.btn.style.background = '#1D242D';
        item.btn.style.color = '#9AA3AE';
        item.btn.style.fontWeight = '400';
      }
    }
  }

  public selectTier(tier: QualityTier): void {
    const buttons = [
      { btn: this.btnLow, t: 'low' },
      { btn: this.btnMed, t: 'medium' },
      { btn: this.btnHigh, t: 'high' }
    ];

    for (const b of buttons) {
      if (b.t === tier) {
        b.btn.style.border = '1px solid #E8A33D';
        b.btn.style.background = 'rgba(232, 163, 61, 0.18)';
        b.btn.style.color = '#E8A33D';
        b.btn.style.fontWeight = '600';
      } else {
        b.btn.style.border = '1px solid #2A333F';
        b.btn.style.background = '#1D242D';
        b.btn.style.color = '#9AA3AE';
        b.btn.style.fontWeight = '400';
      }
    }

    this.onQualityChange(tier);
  }

  public update(stats: OverlayStatsData): void {
    // Active GPU Name in header
    if (this.gpuNameEl && stats.gpuName) {
      this.gpuNameEl.textContent = stats.gpuName;
      this.gpuNameEl.title = `${stats.gpuName} (${stats.backendName || 'WebGPU'})`;
    }

    // FPS Color
    this.fpsValEl.textContent = `${stats.fps} FPS`;
    if (stats.fps >= 55) {
      this.fpsValEl.style.color = '#6BBF7A';
    } else if (stats.fps >= 30) {
      this.fpsValEl.style.color = '#E0B04A';
    } else {
      this.fpsValEl.style.color = '#D9564A';
    }

    // Time of day format
    const h = Math.floor(stats.timeOfDayHours);
    const m = Math.floor((stats.timeOfDayHours - h) * 60);
    const timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    this.timeValEl.textContent = stats.isGoldenHour ? `${timeStr} 🌅` : timeStr;

    // Backend indicator
    const backendEl = this.root.querySelector('#stat-backend');
    if (backendEl && stats.backendName) {
      backendEl.textContent = stats.backendName;
    }

    // Overall metrics & budgets
    this.drawCallsValEl.textContent = `${stats.drawCalls} / 800`;
    this.drawCallsValEl.style.color = stats.drawCalls <= 800 ? '#E8E4DA' : '#D9564A';

    this.trisValEl.textContent = `${(stats.totalTriangles / 1000).toFixed(0)}k / 2M`;
    this.trisValEl.style.color = stats.totalTriangles <= 2000000 ? '#E8E4DA' : '#D9564A';

    const visible = stats.visibleChunks || stats.terrainDrawCalls;
    this.chunksValEl.textContent = `${stats.activeChunks} RAM (${visible} vis)`;
    this.memValEl.textContent = `${stats.gpuMemoryMB} MB / 1GB`;

    // Per-feature cost breakdown
    this.featTerrainEl.textContent = `${(stats.terrainTris / 1000).toFixed(0)}k tris (${stats.terrainDrawCalls} DC)`;
    this.featGrassEl.textContent = `${stats.grassBlades.toLocaleString()} blades, ${(stats.grassTris / 1000).toFixed(0)}k tris (${stats.grassDrawCalls} DC)`;
    this.featFoliageEl.textContent = `${stats.foliageInstances} objs, ${(stats.foliageTris / 1000).toFixed(0)}k tris (${stats.foliageDrawCalls} DC)`;
    this.featWaterEl.textContent = `${(stats.waterTris / 1000).toFixed(0)}k tris (${stats.waterDrawCalls} DC)`;
    this.featPostEl.textContent = `${stats.activePostPasses} active passes`;

    this.posValEl.textContent = `(${Math.round(stats.cameraPos.x)}, ${Math.round(stats.cameraPos.y)}, ${Math.round(stats.cameraPos.z)})`;
    this.groundValEl.textContent = `${stats.groundHeight.toFixed(1)} m`;

    if (stats.isFreeFly) {
      this.camModeBtn.textContent = '✈ [F] FREE-FLY Camera';
      this.camModeBtn.style.background = 'rgba(79, 179, 169, 0.25)';
      this.camModeBtn.style.color = '#4FB3A9';
      this.camModeBtn.style.borderColor = '#4FB3A9';
    } else {
      this.camModeBtn.textContent = '👤 [F] 3rd-Person Orbit';
      this.camModeBtn.style.background = '#1D242D';
      this.camModeBtn.style.color = '#E8E4DA';
      this.camModeBtn.style.borderColor = '#3A4657';
    }
  }
}

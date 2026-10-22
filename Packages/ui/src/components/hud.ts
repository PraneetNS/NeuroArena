/**
 * Heads-Up Display (HUD) overlay for NeuroArena.
 */

export interface HUDState {
  sector: string;
  shardsCollected: number;
  totalShards: number;
  tokensHarvested: number;
  modelStatus: 'untrained' | 'training' | 'awakened';
  questStep: number;
  interactionPrompt: string | null;
}

export class HUD {
  public root: HTMLElement;
  private sectorEl!: HTMLElement;
  private shardsEl!: HTMLElement;
  private tokensEl!: HTMLElement;
  private statusBadgeEl!: HTMLElement;
  private promptEl!: HTMLElement;
  private questListEl!: HTMLElement;

  private onCuratorClick: () => void;
  private onForgeClick: () => void;
  private onChatClick: () => void;
  private onReportClick: () => void;

  constructor(
    parent: HTMLElement,
    callbacks: {
      onCurator: () => void;
      onForge: () => void;
      onChat: () => void;
      onReport: () => void;
    }
  ) {
    this.onCuratorClick = callbacks.onCurator;
    this.onForgeClick = callbacks.onForge;
    this.onChatClick = callbacks.onChat;
    this.onReportClick = callbacks.onReport;

    this.root = document.createElement('div');
    this.root.id = 'neuroarena-hud';
    this.root.style.cssText = `
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 10;
      font-family: var(--font-sans);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 1.2rem;
      user-select: none;
    `;

    this.render();
    parent.appendChild(this.root);
  }

  private render(): void {
    this.root.innerHTML = `
      <!-- Top Navigation & Stats Bar -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; pointer-events: auto;">
        <!-- Logo & Sector -->
        <div class="glass-panel" style="padding: 0.8rem 1.4rem; display: flex; align-items: center; gap: 1.2rem;">
          <div style="display: flex; flex-direction: column;">
            <div style="font-family: var(--font-mono); font-weight: 800; font-size: 1.25rem; letter-spacing: 0.15em; color: var(--accent-cyan);">
              NEURO<span style="color: var(--accent-purple);">ARENA</span>
            </div>
            <div style="font-size: 0.72rem; color: var(--text-muted); letter-spacing: 0.05em;">
              LOCAL IN-BROWSER GPT LAB
            </div>
          </div>
          <div style="width: 1px; height: 32px; background: var(--border-subtle);"></div>
          <div>
            <div style="font-size: 0.68rem; text-transform: uppercase; color: var(--text-dim); font-family: var(--font-mono);">
              Sector
            </div>
            <div id="hud-sector" style="font-size: 0.95rem; font-weight: 600; color: #fff;">
              The Neural Core
            </div>
          </div>
        </div>

        <!-- Shards, Tokens & Status -->
        <div class="glass-panel" style="padding: 0.8rem 1.4rem; display: flex; align-items: center; gap: 1.5rem;">
          <div>
            <div style="font-size: 0.68rem; text-transform: uppercase; color: var(--text-dim); font-family: var(--font-mono);">
              Neural Shards
            </div>
            <div id="hud-shards" style="font-size: 1.1rem; font-family: var(--font-mono); font-weight: 700; color: var(--accent-cyan);">
              0 / 6
            </div>
          </div>

          <div>
            <div style="font-size: 0.68rem; text-transform: uppercase; color: var(--text-dim); font-family: var(--font-mono);">
              Harvested Tokens
            </div>
            <div id="hud-tokens" style="font-size: 1.1rem; font-family: var(--font-mono); font-weight: 700; color: var(--accent-purple);">
              0
            </div>
          </div>

          <div id="hud-status-badge" class="badge-neon badge-amber">
            <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:currentColor;"></span>
            Untrained
          </div>
        </div>
      </div>

      <!-- Center Interaction Prompt -->
      <div id="hud-interaction-prompt" style="align-self: center; display: none; pointer-events: none;">
        <div class="glass-panel glass-panel-glow" style="padding: 0.7rem 1.8rem; font-family: var(--font-mono); font-weight: 700; font-size: 1rem; color: #fff; letter-spacing: 0.05em;">
          PRESS [E] TO HARVEST
        </div>
      </div>

      <!-- Bottom Bar: Quests & Action Buttons -->
      <div style="display: flex; justify-content: space-between; align-items: flex-end; pointer-events: auto;">
        <!-- Quest Stepper -->
        <div class="glass-panel" style="padding: 1rem 1.4rem; width: 340px;">
          <div style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: var(--accent-cyan); font-family: var(--font-mono); margin-bottom: 0.6rem; letter-spacing: 0.05em;">
            TRAINING PROGRESSION
          </div>
          <div id="hud-quest-list" style="display: flex; flex-direction: column; gap: 0.5rem; font-size: 0.85rem;">
            <!-- Populated dynamically -->
          </div>
        </div>

        <!-- Quick Action Buttons -->
        <div style="display: flex; gap: 0.8rem;">
          <button id="btn-open-workbench" class="btn-cyber" style="border-color: var(--accent-amber, #E8A33D); color: var(--accent-amber, #E8A33D);">
            <span>[W]</span> Workbench
          </button>
          <button id="btn-open-uilab" class="btn-cyber" style="border-color: var(--accent-cyan); color: var(--accent-cyan);">
            <span>[U]</span> UI Lab
          </button>
          <button id="btn-open-report" class="btn-cyber" style="border-color: var(--accent-green); color: var(--accent-green);">
            <span>[R]</span> Capability Report
          </button>
          <button id="btn-open-curator" class="btn-cyber">
            <span>[C]</span> Data Curator
          </button>
          <button id="btn-open-forge" class="btn-cyber btn-cyber-purple">
            <span>[T]</span> Neural Forge
          </button>
          <button id="btn-open-chat" class="btn-cyber btn-cyber-amber">
            <span>[X]</span> Companion Chat
          </button>
        </div>
      </div>
    `;

    this.sectorEl = this.root.querySelector('#hud-sector') as HTMLElement;
    this.shardsEl = this.root.querySelector('#hud-shards') as HTMLElement;
    this.tokensEl = this.root.querySelector('#hud-tokens') as HTMLElement;
    this.statusBadgeEl = this.root.querySelector('#hud-status-badge') as HTMLElement;
    this.promptEl = this.root.querySelector('#hud-interaction-prompt') as HTMLElement;
    this.questListEl = this.root.querySelector('#hud-quest-list') as HTMLElement;

    // Attach button handlers
    this.root
      .querySelector('#btn-open-workbench')
      ?.addEventListener('click', () => {
        window.location.href = '/workbench';
      });
    this.root
      .querySelector('#btn-open-uilab')
      ?.addEventListener('click', () => {
        window.location.href = '/ui-lab';
      });
    this.root
      .querySelector('#btn-open-report')
      ?.addEventListener('click', () => this.onReportClick());
    this.root
      .querySelector('#btn-open-curator')
      ?.addEventListener('click', () => this.onCuratorClick());
    this.root
      .querySelector('#btn-open-forge')
      ?.addEventListener('click', () => this.onForgeClick());
    this.root.querySelector('#btn-open-chat')?.addEventListener('click', () => this.onChatClick());
  }

  public update(state: HUDState): void {
    this.sectorEl.textContent = state.sector;
    this.shardsEl.textContent = `${state.shardsCollected} / ${state.totalShards}`;
    this.tokensEl.textContent = state.tokensHarvested.toLocaleString();

    // Status Badge
    if (state.modelStatus === 'awakened') {
      this.statusBadgeEl.className = 'badge-neon badge-green';
      this.statusBadgeEl.innerHTML = `<span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:currentColor;"></span> Awakened`;
    } else if (state.modelStatus === 'training') {
      this.statusBadgeEl.className = 'badge-neon badge-purple';
      this.statusBadgeEl.innerHTML = `<span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:currentColor;"></span> Training`;
    } else {
      this.statusBadgeEl.className = 'badge-neon badge-amber';
      this.statusBadgeEl.innerHTML = `<span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:currentColor;"></span> Untrained`;
    }

    // Interaction prompt
    if (state.interactionPrompt) {
      this.promptEl.style.display = 'block';
      this.promptEl.firstElementChild!.textContent = state.interactionPrompt;
    } else {
      this.promptEl.style.display = 'none';
    }

    // Quest steps
    const quests = [
      { step: 1, text: `Collect Neural Shards (${state.shardsCollected}/${state.totalShards})` },
      { step: 2, text: 'Curate Corpus & Build Vocab [C]' },
      { step: 3, text: 'Train TinyGPT in Neural Forge [T]' },
      { step: 4, text: 'Awaken Companion & Chat [X]' }
    ];

    this.questListEl.innerHTML = quests
      .map((q) => {
        const isDone = state.questStep > q.step;
        const isCurrent = state.questStep === q.step;
        const color = isDone
          ? 'var(--accent-green)'
          : isCurrent
            ? 'var(--accent-cyan)'
            : 'var(--text-dim)';
        const icon = isDone ? '✓' : isCurrent ? '►' : '○';
        return `
        <div style="display: flex; align-items: center; gap: 0.6rem; color: ${color}; font-weight: ${isCurrent ? '600' : '400'};">
          <span style="font-family: var(--font-mono); width: 14px;">${icon}</span>
          <span>${q.text}</span>
        </div>
      `;
      })
      .join('');
  }
}

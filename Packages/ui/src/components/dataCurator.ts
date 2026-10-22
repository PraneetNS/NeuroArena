/**
 * Data Curator & Tokenizer Inspector Modal.
 */

import { Tokenizer, PRESET_CORPORA } from '@na/ml-core';

export interface HarvestedShardInfo {
  id: string;
  title: string;
  category: string;
  sector: string;
  text: string;
}

export class DataCuratorModal {
  public root: HTMLElement;
  public isOpen = false;

  private activeTab: 'shards' | 'custom' | 'tokenizer' = 'shards';
  private harvestedShards: HarvestedShardInfo[] = [];
  private currentCorpus = '';
  private tokenizer: Tokenizer;
  private onCorpusUpdated: (newCorpus: string) => void;

  constructor(
    parent: HTMLElement,
    tokenizer: Tokenizer,
    onCorpusUpdated: (newCorpus: string) => void
  ) {
    this.tokenizer = tokenizer;
    this.onCorpusUpdated = onCorpusUpdated;

    this.root = document.createElement('div');
    this.root.className = 'modal-overlay';
    parent.appendChild(this.root);

    this.render();
  }

  public setHarvestedShards(shards: HarvestedShardInfo[]): void {
    this.harvestedShards = shards;
    if (this.currentCorpus === '' && shards.length > 0) {
      this.currentCorpus = shards.map((s) => s.text).join('\n\n');
      this.tokenizer.buildVocab(this.currentCorpus);
    }
    if (this.isOpen) {
      this.render();
    }
  }

  public open(): void {
    this.isOpen = true;
    this.root.classList.add('active');
    this.render();
  }

  public close(): void {
    this.isOpen = false;
    this.root.classList.remove('active');
  }

  private render(): void {
    const shardCount = this.harvestedShards.length;
    const vocabSize = this.tokenizer.vocabSize;
    const totalTokens = this.tokenizer.encode(this.currentCorpus).length;

    this.root.innerHTML = `
      <div class="modal-container glass-panel glass-panel-glow" style="padding: 1.8rem; display: flex; flex-direction: column; gap: 1.2rem;">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-subtle); padding-bottom: 1rem;">
          <div>
            <div style="font-family: var(--font-mono); font-weight: 800; font-size: 1.3rem; color: var(--accent-cyan); letter-spacing: 0.05em;">
              DATA CURATOR & TOKENIZER LAB
            </div>
            <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.2rem;">
              Inspect harvested neural fragments, curate training text, and explore vocabulary tokenization.
            </div>
          </div>
          <button id="curator-close" class="btn-cyber" style="padding: 0.4rem 0.8rem;">ESC ✕</button>
        </div>

        <!-- Navigation Tabs -->
        <div style="display: flex; gap: 0.8rem;">
          <button id="tab-shards" class="btn-cyber ${this.activeTab === 'shards' ? '' : 'btn-cyber-purple'}" style="flex: 1;">
            Harvested Shards (${shardCount})
          </button>
          <button id="tab-custom" class="btn-cyber ${this.activeTab === 'custom' ? '' : 'btn-cyber-purple'}" style="flex: 1;">
            Presets & Custom Corpus
          </button>
          <button id="tab-tokenizer" class="btn-cyber ${this.activeTab === 'tokenizer' ? '' : 'btn-cyber-purple'}" style="flex: 1;">
            Tokenizer Inspector (Vocab: ${vocabSize})
          </button>
        </div>

        <!-- Tab Contents -->
        <div id="curator-content" style="min-height: 380px;">
          ${this.renderTabContent()}
        </div>

        <!-- Footer -->
        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-subtle); padding-top: 1rem;">
          <div style="font-family: var(--font-mono); font-size: 0.85rem; color: var(--text-muted);">
            Active Corpus: <span style="color: var(--accent-cyan); font-weight: 600;">${this.currentCorpus.length} chars</span> |
            <span style="color: var(--accent-purple); font-weight: 600;">${totalTokens} tokens</span> |
            <span style="color: var(--accent-green); font-weight: 600;">${vocabSize} unique vocab</span>
          </div>
          <button id="btn-save-corpus" class="btn-cyber">
            Apply Corpus to Neural Forge →
          </button>
        </div>
      </div>
    `;

    // Event bindings
    this.root.querySelector('#curator-close')?.addEventListener('click', () => this.close());

    this.root.querySelector('#tab-shards')?.addEventListener('click', () => {
      this.activeTab = 'shards';
      this.render();
    });
    this.root.querySelector('#tab-custom')?.addEventListener('click', () => {
      this.activeTab = 'custom';
      this.render();
    });
    this.root.querySelector('#tab-tokenizer')?.addEventListener('click', () => {
      this.activeTab = 'tokenizer';
      this.render();
    });

    this.root.querySelector('#btn-save-corpus')?.addEventListener('click', () => {
      this.tokenizer.buildVocab(this.currentCorpus);
      this.onCorpusUpdated(this.currentCorpus);
      this.close();
    });

    this.attachTabListeners();
  }

  private renderTabContent(): string {
    if (this.activeTab === 'shards') {
      if (this.harvestedShards.length === 0) {
        return `
          <div style="text-align: center; padding: 4rem 1rem; color: var(--text-dim); font-family: var(--font-mono);">
            <div style="font-size: 2.5rem; margin-bottom: 0.8rem;">◈</div>
            <div style="font-size: 1.1rem; color: var(--text-muted); margin-bottom: 0.4rem;">No Neural Shards Harvested Yet</div>
            <div style="font-size: 0.85rem;">Explore the arena sectors and approach glowing crystals to absorb training data!</div>
          </div>
        `;
      }

      return `
        <div style="display: flex; flex-direction: column; gap: 0.8rem; max-height: 400px; overflow-y: auto; padding-right: 0.5rem;">
          ${this.harvestedShards
            .map(
              (shard) => `
            <div class="glass-panel" style="padding: 1rem; background: rgba(30, 41, 59, 0.4);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                <div style="font-family: var(--font-mono); font-weight: 700; color: var(--accent-cyan); font-size: 0.95rem;">
                  ${shard.title}
                </div>
                <div class="badge-neon ${shard.category === 'lore' ? 'badge-purple' : shard.category === 'logic' ? 'badge-amber' : ''}">
                  ${shard.sector}
                </div>
              </div>
              <div style="font-family: var(--font-mono); font-size: 0.82rem; color: var(--text-muted); line-height: 1.4; white-space: pre-wrap; background: rgba(15, 23, 42, 0.6); padding: 0.6rem; border-radius: var(--radius-sm);">
${shard.text}
              </div>
            </div>
          `
            )
            .join('')}
        </div>
      `;
    }

    if (this.activeTab === 'custom') {
      return `
        <div style="display: flex; flex-direction: column; gap: 1rem;">
          <div style="display: flex; gap: 0.6rem; align-items: center;">
            <span style="font-size: 0.8rem; color: var(--text-dim); text-transform: uppercase; font-family: var(--font-mono);">
              Load Presets:
            </span>
            <button id="preset-companion" class="btn-cyber" style="padding: 0.35rem 0.8rem; font-size: 0.75rem;">Companion Dialogues</button>
            <button id="preset-lore" class="btn-cyber btn-cyber-purple" style="padding: 0.35rem 0.8rem; font-size: 0.75rem;">Cyberpunk Lore</button>
            <button id="preset-logic" class="btn-cyber btn-cyber-amber" style="padding: 0.35rem 0.8rem; font-size: 0.75rem;">Logic & Code</button>
          </div>

          <textarea id="curator-textarea" class="input-cyber" style="width: 100%; height: 260px; resize: vertical; line-height: 1.5; font-size: 0.85rem;" placeholder="Type or paste training data here...">${this.currentCorpus}</textarea>
        </div>
      `;
    }

    if (this.activeTab === 'tokenizer') {
      const stats = this.tokenizer.getStats(this.currentCorpus);
      const spans = this.tokenizer.tokenizeWithSpans(this.currentCorpus.slice(0, 400));
      const colors = ['#00f3ff', '#a855f7', '#f59e0b', '#10b981', '#ec4899', '#3b82f6'];

      return `
        <div style="display: flex; flex-direction: column; gap: 1.2rem;">
          <!-- Top Token Frequency Badges -->
          <div>
            <div style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-dim); font-family: var(--font-mono); margin-bottom: 0.5rem;">
              Top Token Frequencies
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 0.4rem;">
              ${stats.topTokens
                .map(
                  (tok) => `
                <div class="badge-neon" style="font-size: 0.75rem;">
                  <span style="color: #fff; font-weight: 700;">'${tok.token === ' ' ? '␣' : tok.token === '\n' ? '↵' : tok.token}'</span>
                  <span style="opacity: 0.65;">#${tok.id}</span>
                  <span style="color: var(--accent-purple); font-weight: 700;">×${tok.count}</span>
                </div>
              `
                )
                .join('')}
            </div>
          </div>

          <!-- Interactive Token Highlighting Stream -->
          <div>
            <div style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-dim); font-family: var(--font-mono); margin-bottom: 0.5rem;">
              Live Tokenizer Highlighting (First 400 characters)
            </div>
            <div style="font-family: var(--font-mono); font-size: 0.9rem; line-height: 1.9; padding: 1rem; background: rgba(15, 23, 42, 0.7); border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); max-height: 200px; overflow-y: auto;">
              ${spans
                .map((s) => {
                  const color = colors[s.id % colors.length];
                  const charDisplay =
                    s.text === ' ' ? '&nbsp;' : s.text === '\n' ? '↵<br/>' : s.text;
                  return `
                  <span title="Token: '${s.text}' | ID: ${s.id}" style="background: ${color}22; border-bottom: 2px solid ${color}; padding: 1px 3px; border-radius: 2px; color: ${color};">
                    ${charDisplay}
                  </span>
                `;
                })
                .join('')}
            </div>
          </div>
        </div>
      `;
    }

    return '';
  }

  private attachTabListeners(): void {
    if (this.activeTab === 'custom') {
      const textarea = this.root.querySelector('#curator-textarea') as HTMLTextAreaElement;
      textarea?.addEventListener('input', () => {
        this.currentCorpus = textarea.value;
      });

      this.root.querySelector('#preset-companion')?.addEventListener('click', () => {
        this.currentCorpus = PRESET_CORPORA.companion;
        this.tokenizer.buildVocab(this.currentCorpus);
        this.render();
      });

      this.root.querySelector('#preset-lore')?.addEventListener('click', () => {
        this.currentCorpus = PRESET_CORPORA.lore;
        this.tokenizer.buildVocab(this.currentCorpus);
        this.render();
      });

      this.root.querySelector('#preset-logic')?.addEventListener('click', () => {
        this.currentCorpus = PRESET_CORPORA.logic;
        this.tokenizer.buildVocab(this.currentCorpus);
        this.render();
      });
    }
  }
}

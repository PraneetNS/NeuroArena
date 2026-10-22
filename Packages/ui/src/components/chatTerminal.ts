/**
 * Companion Hologram Chat Terminal with streaming generation and live
 * candidate token probability distribution inspector.
 */

import { TinyGPT, Tokenizer, Sampler, CandidateProb } from '@na/ml-core';

export interface ChatMessage {
  sender: 'player' | 'companion';
  text: string;
}

export class ChatTerminalModal {
  public root: HTMLElement;
  public isOpen = false;

  private model: TinyGPT | null = null;
  private tokenizer: Tokenizer;
  private messages: ChatMessage[] = [
    {
      sender: 'companion',
      text: 'Greetings, explorer. I am your local Tiny GPT neural companion. Speak with me!'
    }
  ];

  // Generation parameters
  public temperature = 0.8;
  public topK = 10;
  public topP = 0.9;
  public maxTokens = 45;

  private chatHistoryEl!: HTMLElement;
  private inputEl!: HTMLInputElement;
  private candidateBoxEl!: HTMLElement;
  private tempLabelEl!: HTMLElement;

  private onSpeakInWorld: (text: string) => void;
  private onTokenSound: () => void;

  constructor(
    parent: HTMLElement,
    tokenizer: Tokenizer,
    callbacks: {
      onSpeakInWorld: (text: string) => void;
      onTokenSound: () => void;
    }
  ) {
    this.tokenizer = tokenizer;
    this.onSpeakInWorld = callbacks.onSpeakInWorld;
    this.onTokenSound = callbacks.onTokenSound;

    this.root = document.createElement('div');
    this.root.className = 'modal-overlay';
    parent.appendChild(this.root);

    this.render();
  }

  public setModel(model: TinyGPT): void {
    this.model = model;
  }

  public open(): void {
    this.isOpen = true;
    this.root.classList.add('active');
    this.render();
    setTimeout(() => this.inputEl?.focus(), 100);
  }

  public close(): void {
    this.isOpen = false;
    this.root.classList.remove('active');
  }

  public sendMessage(userText: string): void {
    const text = userText.trim();
    if (!text) return;

    this.messages.push({ sender: 'player', text });
    this.renderMessages();

    if (!this.model) {
      this.messages.push({
        sender: 'companion',
        text: 'Neural weights not loaded yet! Please train me in the Neural Forge [T] first.'
      });
      this.renderMessages();
      return;
    }

    // Prepare prompt
    const prompt = `[PLAYER]: ${text}\n[COMPANION]: `;
    let companionReply = '';

    // Create placeholder message
    const replyMsg: ChatMessage = { sender: 'companion', text: '' };
    this.messages.push(replyMsg);

    // Stream tokens
    try {
      Sampler.generate(this.model, this.tokenizer, prompt, {
        maxNewTokens: this.maxTokens,
        temperature: this.temperature,
        topK: this.topK,
        topP: this.topP,
        onToken: (tokenChar, _tokenId, topCandidates) => {
          companionReply += tokenChar;
          replyMsg.text = companionReply;
          this.renderMessages();
          this.renderCandidateProbabilities(topCandidates);
          this.onTokenSound();
        }
      });
    } catch {
      replyMsg.text = companionReply || '...';
      this.renderMessages();
    }

    // Broadcast speech to 3D world drone
    this.onSpeakInWorld(companionReply);
  }

  private renderCandidateProbabilities(candidates: CandidateProb[]): void {
    if (!this.candidateBoxEl) return;
    this.candidateBoxEl.innerHTML = `
      <div style="font-size: 0.72rem; text-transform: uppercase; color: var(--text-dim); font-family: var(--font-mono); margin-bottom: 0.4rem;">
        Last Token Probabilities (Softmax Distribution)
      </div>
      <div style="display: flex; flex-direction: column; gap: 0.35rem;">
        ${candidates
          .map((c) => {
            const pct = (c.prob * 100).toFixed(1);
            const charDisplay = c.token === ' ' ? '␣' : c.token === '\n' ? '↵' : c.token;
            return `
            <div style="display: flex; align-items: center; gap: 0.5rem; font-family: var(--font-mono); font-size: 0.78rem;">
              <span style="width: 24px; color: var(--accent-cyan); font-weight: 700;">'${charDisplay}'</span>
              <div style="flex: 1; height: 7px; background: rgba(255,255,255,0.06); border-radius: 3px; overflow: hidden;">
                <div style="width: ${pct}%; height: 100%; background: linear-gradient(90deg, var(--accent-cyan), var(--accent-purple)); border-radius: 3px;"></div>
              </div>
              <span style="width: 44px; text-align: right; color: var(--text-muted); font-size: 0.72rem;">${pct}%</span>
            </div>
          `;
          })
          .join('')}
      </div>
    `;
  }

  private renderMessages(): void {
    if (!this.chatHistoryEl) return;
    this.chatHistoryEl.innerHTML = this.messages
      .map((m) => {
        const isPlayer = m.sender === 'player';
        return `
        <div style="display: flex; flex-direction: column; align-items: ${isPlayer ? 'flex-end' : 'flex-start'}; gap: 0.2rem;">
          <div style="font-family: var(--font-mono); font-size: 0.7rem; color: ${isPlayer ? 'var(--accent-purple)' : 'var(--accent-cyan)'}; text-transform: uppercase;">
            ${isPlayer ? 'You [Explorer]' : 'Neural Companion'}
          </div>
          <div style="
            max-width: 80%;
            padding: 0.7rem 1.1rem;
            border-radius: var(--radius-md);
            font-size: 0.9rem;
            line-height: 1.45;
            background: ${isPlayer ? 'rgba(168, 85, 247, 0.18)' : 'rgba(0, 243, 255, 0.12)'};
            border: 1px solid ${isPlayer ? 'rgba(168, 85, 247, 0.4)' : 'rgba(0, 243, 255, 0.3)'};
            color: #fff;
            white-space: pre-wrap;
          ">
            ${m.text}
          </div>
        </div>
      `;
      })
      .join('');

    this.chatHistoryEl.scrollTop = this.chatHistoryEl.scrollHeight;
  }

  private render(): void {
    this.root.innerHTML = `
      <div class="modal-container glass-panel glass-panel-glow" style="padding: 1.8rem; display: flex; flex-direction: column; gap: 1.2rem; max-width: 840px;">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.8rem;">
          <div>
            <div style="font-family: var(--font-mono); font-weight: 800; font-size: 1.3rem; color: var(--accent-amber); letter-spacing: 0.05em;">
              COMPANION HOLOGRAPHIC TERMINAL
            </div>
            <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.2rem;">
              Direct autoregressive dialogue with your locally trained Tiny GPT
            </div>
          </div>
          <button id="chat-close" class="btn-cyber" style="padding: 0.4rem 0.8rem;">ESC ✕</button>
        </div>

        <!-- Chat History & Inspector Grid -->
        <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 1rem;">
          <!-- Messages Box -->
          <div id="chat-history" style="
            height: 340px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 0.8rem;
            padding: 1rem;
            background: rgba(15, 23, 42, 0.6);
            border-radius: var(--radius-sm);
            border: 1px solid var(--border-subtle);
          "></div>

          <!-- Sampling Controls & Probability Inspector -->
          <div style="display: flex; flex-direction: column; gap: 0.9rem;">
            <!-- Temperature Slider -->
            <div class="glass-panel" style="padding: 0.8rem;">
              <div style="display: flex; justify-content: space-between; font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-dim); margin-bottom: 0.3rem;">
                <span>TEMPERATURE</span>
                <span id="temp-label" style="color: var(--accent-cyan); font-weight: 700;">${this.temperature.toFixed(2)}</span>
              </div>
              <input id="temp-slider" type="range" min="0.1" max="1.4" step="0.05" value="${this.temperature}" style="width: 100%; accent-color: var(--accent-cyan);" />
            </div>

            <!-- Live Softmax Probability Bars -->
            <div id="candidate-prob-box" class="glass-panel" style="padding: 0.8rem; flex: 1;">
              <div style="font-size: 0.72rem; text-transform: uppercase; color: var(--text-dim); font-family: var(--font-mono); margin-bottom: 0.4rem;">
                Next-Token Distribution
              </div>
              <div style="font-size: 0.8rem; color: var(--text-dim); font-family: var(--font-mono); text-align: center; margin-top: 2rem;">
                Send a prompt to visualize live token candidate probabilities!
              </div>
            </div>
          </div>
        </div>

        <!-- Quick Prompt Pills -->
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
          <button class="badge-neon prompt-pill" style="cursor: pointer;">"Hello, who are you?"</button>
          <button class="badge-neon badge-purple prompt-pill" style="cursor: pointer;">"What is your purpose?"</button>
          <button class="badge-neon badge-amber prompt-pill" style="cursor: pointer;">"Explain what you learned in the arena"</button>
          <button class="badge-neon badge-green prompt-pill" style="cursor: pointer;">"Write a haiku about neural networks"</button>
        </div>

        <!-- Input Row -->
        <div style="display: flex; gap: 0.8rem;">
          <input id="chat-input" type="text" class="input-cyber" style="flex: 1; padding: 0.7rem 1.1rem; font-size: 0.95rem;" placeholder="Type a message to your trained companion..." />
          <button id="chat-send" class="btn-cyber btn-cyber-amber" style="padding: 0.7rem 1.4rem;">
            Send Prompt ↵
          </button>
        </div>
      </div>
    `;

    this.chatHistoryEl = this.root.querySelector('#chat-history') as HTMLElement;
    this.inputEl = this.root.querySelector('#chat-input') as HTMLInputElement;
    this.candidateBoxEl = this.root.querySelector('#candidate-prob-box') as HTMLElement;
    this.tempLabelEl = this.root.querySelector('#temp-label') as HTMLElement;

    // Attach listeners
    this.root.querySelector('#chat-close')?.addEventListener('click', () => this.close());

    const sendAction = () => {
      this.sendMessage(this.inputEl.value);
      this.inputEl.value = '';
    };

    this.root.querySelector('#chat-send')?.addEventListener('click', sendAction);
    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') sendAction();
    });

    const tempSlider = this.root.querySelector('#temp-slider') as HTMLInputElement;
    tempSlider?.addEventListener('input', () => {
      this.temperature = parseFloat(tempSlider.value);
      this.tempLabelEl.textContent = this.temperature.toFixed(2);
    });

    // Prompt pills
    this.root.querySelectorAll('.prompt-pill').forEach((pill) => {
      pill.addEventListener('click', () => {
        const text = (pill.textContent || '').replace(/^"|"$/g, '');
        this.inputEl.value = text;
        sendAction();
      });
    });

    this.renderMessages();
  }
}

/**
 * @file BootScreen.js
 * @description Chamfered cybernetic title panel animated with GSAP timeline,
 * featuring interactive triggers for camera trauma, post-processing shockwaves,
 * hit-stop freezes, and F3 telemetry inspection.
 */

import gsap from 'gsap';

export class BootScreen {
  /**
   * @param {HTMLElement} parentContainer
   * @param {Object} actions
   * @param {function(): void} actions.onStart
   * @param {function(): void} actions.onTriggerShock
   * @param {function(): void} actions.onToggleDebug
   */
  constructor(parentContainer, { onStart = null, onTriggerShock = null, onToggleDebug = null } = {}) {
    this.parentContainer = parentContainer;
    this.onStart = onStart;
    this.onTriggerShock = onTriggerShock;
    this.onToggleDebug = onToggleDebug;

    this.root = null;
    this.timeline = null;

    this.createDom();
    this.animateIntro();
  }

  /**
   * Builds the DOM for the boot screen.
   */
  createDom() {
    this.root = document.createElement('div');
    this.root.className = 'boot-container';

    this.root.innerHTML = `
      <!-- Header Bar -->
      <div class="boot-header">
        <div class="boot-brand">
          <span style="color: var(--alert-converged);">⚡</span> NEUROARENA
        </div>
        <div class="boot-badge">
          v4.0 FRONTIER // PURE C# & JS ENGINE
        </div>
      </div>

      <!-- Main Chamfered Hero Card -->
      <div class="boot-card chamfer-panel interactive">
        <div style="font-size: 11px; letter-spacing: 0.18em; color: var(--steppes-primary); margin-bottom: 6px; font-weight: 700;">
          NON-EQUILIBRIUM MATHEMATICAL SIMULATION
        </div>
        <h1 class="boot-title">
          GRADIENTS<br><span>OF THE WILD</span>
        </h1>
        <p class="boot-subtitle">
          Step into the role of an <strong>Architect</strong>. Explore non-convex mathematical biomes,
          harvest empirical data tokens, and optimize living neural loss surfaces in real-time.
        </p>

        <div class="boot-formula">
          <code>min_{θ} J(θ) = 𝔼_{x~𝒟} [ ‖f_θ(x) - y‖² ] + λ ‖θ‖₂² // ANALYTIC ∇J</code>
        </div>

        <div class="boot-actions">
          <button id="btn-start" class="chamfer-btn">
            <span>ENTER ARENA</span>
            <span>➔</span>
          </button>
          <a href="/src/dev/mlSandbox.html" class="chamfer-btn chamfer-btn-secondary" style="text-decoration: none;" title="Open Pure-JS ML Core Sandbox & Dataset Health Inspector">
            <span>ML SANDBOX</span>
          </a>
          <button id="btn-shock" class="chamfer-btn chamfer-btn-secondary" title="Test Radial Chromatic Aberration & Camera Trauma">
            <span>TEST SHOCK</span>
          </button>
          <button id="btn-f3" class="chamfer-btn chamfer-btn-secondary" title="Toggle F3 Telemetry Overlay">
            <span>F3 STATS</span>
          </button>
        </div>
      </div>

      <!-- Footer Bar -->
      <div class="boot-footer-bar">
        <div>ZERO BLACK-BOX ML LIBRARIES // WEBGPU + WEBGL2 DUAL RUNTIME</div>
        <div>TOGGLE TELEMETRY OVERLAY: [F3] // FORCE WEBGL: ?renderer=webgl</div>
      </div>
    `;

    this.parentContainer.appendChild(this.root);

    // Bind event handlers
    const btnStart = this.root.querySelector('#btn-start');
    const btnShock = this.root.querySelector('#btn-shock');
    const btnF3 = this.root.querySelector('#btn-f3');

    if (btnStart) {
      btnStart.addEventListener('click', () => {
        if (this.onStart) this.onStart();
      });
    }

    if (btnShock) {
      btnShock.addEventListener('click', () => {
        if (this.onTriggerShock) this.onTriggerShock();
      });
    }

    if (btnF3) {
      btnF3.addEventListener('click', () => {
        if (this.onToggleDebug) this.onToggleDebug();
      });
    }
  }

  /**
   * GSAP Timeline intro animation.
   */
  animateIntro() {
    const card = this.root.querySelector('.boot-card');
    const header = this.root.querySelector('.boot-header');
    const footer = this.root.querySelector('.boot-footer-bar');
    const title = this.root.querySelector('.boot-title');
    const subtitle = this.root.querySelector('.boot-subtitle');
    const formula = this.root.querySelector('.boot-formula');
    const actions = this.root.querySelector('.boot-actions');

    this.timeline = gsap.timeline({ defaults: { ease: 'power3.out' } });

    this.timeline
      .fromTo(header, { opacity: 0, y: -20 }, { opacity: 1, y: 0, duration: 0.6 })
      .fromTo(card, { opacity: 0, x: -60 }, { opacity: 1, x: 0, duration: 0.8 }, '-=0.3')
      .fromTo(title, { opacity: 0, y: 15 }, { opacity: 1, y: 0, duration: 0.5 }, '-=0.5')
      .fromTo(subtitle, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.4 }, '-=0.3')
      .fromTo(formula, { opacity: 0, scale: 0.95 }, { opacity: 1, scale: 1.0, duration: 0.4 }, '-=0.2')
      .fromTo(actions.children, { opacity: 0, y: 10 }, { opacity: 1, y: 0, stagger: 0.1, duration: 0.4 }, '-=0.2')
      .fromTo(footer, { opacity: 0 }, { opacity: 1, duration: 0.5 }, '-=0.3');
  }

  /**
   * Destroys DOM elements and animations.
   */
  dispose() {
    if (this.timeline) {
      this.timeline.kill();
    }
    if (this.root && this.root.parentNode) {
      this.root.parentNode.removeChild(this.root);
      this.root = null;
    }
  }
}

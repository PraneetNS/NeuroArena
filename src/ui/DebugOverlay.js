/**
 * @file DebugOverlay.js
 * @description In-game live telemetry overlay toggled via F3.
 * Displays FPS, frame time, dynamic DPR, draw calls, triangles, renderer type,
 * loss, gradient norm ||∇J||, optimization step count, and camera trauma.
 */

export class DebugOverlay {
  /**
   * @param {HTMLElement} parentContainer
   */
  constructor(parentContainer = document.body) {
    this.parentContainer = parentContainer;
    this.visible = true; // Enabled by default for immediate verification
    this.element = null;

    // References to value span elements for zero-allocation DOM updates
    this.valFps = null;
    this.valFrameMs = null;
    this.valDpr = null;
    this.valCalls = null;
    this.valTriangles = null;
    this.valRenderer = null;
    this.valLoss = null;
    this.valGradNorm = null;
    this.valSteps = null;
    this.valEntities = null;
    this.valTrauma = null;

    this.createDom();
    this.setupKeyListener();
  }

  /**
   * Constructs the chamfered F3 DOM layout.
   */
  createDom() {
    this.element = document.createElement('div');
    this.element.id = 'f3-debug-overlay';
    this.element.className = 'interactive';

    this.element.innerHTML = `
      <div class="debug-header">
        <span>⚡ NEURO-TELEMETRY [F3]</span>
        <span id="f3-status" class="val-active">ONLINE</span>
      </div>
      <div class="debug-row"><span>RENDERER:</span> <span id="f3-renderer" class="val-highlight">Probing...</span></div>
      <div class="debug-row"><span>FPS:</span> <span id="f3-fps" class="val-active">60</span></div>
      <div class="debug-row"><span>FRAME TIME:</span> <span id="f3-frame-ms" class="val-highlight">16.6 ms</span></div>
      <div class="debug-row"><span>DYNAMIC DPR:</span> <span id="f3-dpr" class="val-highlight">1.00x</span></div>
      <div class="debug-row"><span>DRAW CALLS:</span> <span id="f3-calls" class="val-highlight">0</span></div>
      <div class="debug-row"><span>TRIANGLES:</span> <span id="f3-tris" class="val-highlight">0</span></div>
      <div style="margin: 6px 0; border-top: 1px solid rgba(255, 255, 255, 0.08);"></div>
      <div class="debug-row"><span>LOSS J(θ):</span> <span id="f3-loss" class="val-warning">0.0000</span></div>
      <div class="debug-row"><span>||∇J|| NORM:</span> <span id="f3-grad-norm" class="val-highlight">0.0000</span></div>
      <div class="debug-row"><span>OPT STEPS:</span> <span id="f3-steps" class="val-highlight">0</span></div>
      <div class="debug-row"><span>ENTITIES:</span> <span id="f3-entities" class="val-highlight">0</span></div>
      <div class="debug-row"><span>CAM TRAUMA:</span> <span id="f3-trauma" class="val-highlight">0.00</span></div>
    `;

    this.parentContainer.appendChild(this.element);

    // Cache elements
    this.valFps = this.element.querySelector('#f3-fps');
    this.valFrameMs = this.element.querySelector('#f3-frame-ms');
    this.valDpr = this.element.querySelector('#f3-dpr');
    this.valCalls = this.element.querySelector('#f3-calls');
    this.valTriangles = this.element.querySelector('#f3-tris');
    this.valRenderer = this.element.querySelector('#f3-renderer');
    this.valLoss = this.element.querySelector('#f3-loss');
    this.valGradNorm = this.element.querySelector('#f3-grad-norm');
    this.valSteps = this.element.querySelector('#f3-steps');
    this.valEntities = this.element.querySelector('#f3-entities');
    this.valTrauma = this.element.querySelector('#f3-trauma');
  }

  /**
   * Sets up F3 key toggle listener.
   */
  setupKeyListener() {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'F3' || e.code === 'F3') {
        e.preventDefault();
        this.toggle();
      }
    });
  }

  /**
   * Toggles visibility of the debug overlay.
   */
  toggle() {
    this.visible = !this.visible;
    if (this.element) {
      this.element.style.display = this.visible ? 'block' : 'none';
    }
  }

  /**
   * Updates live debug values. Call this from the render loop.
   * @param {Object} data
   */
  update(data = {}) {
    if (!this.visible || !this.element) return;

    if (data.fps !== undefined && this.valFps) {
      this.valFps.textContent = data.fps;
      this.valFps.className = data.fps >= 55 ? 'val-active' : (data.fps >= 30 ? 'val-warning' : 'val-crit');
    }
    if (data.frameMs !== undefined && this.valFrameMs) {
      this.valFrameMs.textContent = `${data.frameMs} ms`;
    }
    if (data.dpr !== undefined && this.valDpr) {
      this.valDpr.textContent = `${data.dpr}x`;
    }
    if (data.drawCalls !== undefined && this.valCalls) {
      this.valCalls.textContent = data.drawCalls;
    }
    if (data.triangles !== undefined && this.valTriangles) {
      this.valTriangles.textContent = data.triangles.toLocaleString();
    }
    if (data.rendererType !== undefined && this.valRenderer) {
      this.valRenderer.textContent = data.rendererType;
    }
    if (data.loss !== undefined && this.valLoss) {
      this.valLoss.textContent = typeof data.loss === 'number' ? data.loss.toFixed(4) : data.loss;
    }
    if (data.gradNorm !== undefined && this.valGradNorm) {
      this.valGradNorm.textContent = typeof data.gradNorm === 'number' ? data.gradNorm.toFixed(4) : data.gradNorm;
    }
    if (data.stepCount !== undefined && this.valSteps) {
      this.valSteps.textContent = data.stepCount;
    }
    if (data.entityCount !== undefined && this.valEntities) {
      this.valEntities.textContent = data.entityCount;
    }
    if (data.trauma !== undefined && this.valTrauma) {
      this.valTrauma.textContent = data.trauma.toFixed(2);
    }
  }

  /**
   * Destroys DOM elements and listeners.
   */
  dispose() {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
      this.element = null;
    }
  }
}

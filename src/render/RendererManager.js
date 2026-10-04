/**
 * @file RendererManager.js
 * @description Manages WebGPU / WebGL2 graphics context initialization, capability probing,
 * viewport resizing, and rolling-average dynamic resolution scaling (DPR 0.75x - 2.0x).
 */

import * as THREE from 'three';

const ROLLING_FRAME_COUNT = 60;
const TARGET_FRAME_MS = 1000 / 60; // 16.67ms
const LOW_FPS_THRESHOLD_MS = 18.2;  // < ~55 FPS triggers downgrade
const HIGH_FPS_THRESHOLD_MS = 15.2; // > ~65 FPS allows upgrade
const MIN_DPR = 0.75;
const MAX_DPR_CEILING = 2.0;
const DPR_CHANGE_THRESHOLD = 0.025;

export class RendererManager {
  /**
   * @param {HTMLElement} container - DOM container element for the canvas
   */
  constructor(container) {
    if (!container) {
      throw new Error('[RendererManager] Container element must be provided.');
    }
    this.container = container;
    this.renderer = null;
    this.isWebGPU = false;
    this.rendererType = 'Initializing';

    // Resolution & Viewport
    this.width = container.clientWidth || window.innerWidth;
    this.height = container.clientHeight || window.innerHeight;
    this.maxDpr = Math.min(window.devicePixelRatio || 1.0, MAX_DPR_CEILING);
    this.targetDpr = Math.max(MIN_DPR, Math.min(this.maxDpr, 1.5));
    this.currentDpr = this.targetDpr;

    // Rolling 60-frame buffer (preallocated Float32Array - zero per-frame allocation)
    this.frameTimeSamples = new Float32Array(ROLLING_FRAME_COUNT);
    this.sampleIndex = 0;
    this.sampleCount = 0;
    this.rollingSumMs = 0;
    this.rollingAvgFrameMs = TARGET_FRAME_MS;
    this.currentFps = 60.0;

    // Render Stats
    this.drawCalls = 0;
    this.triangles = 0;

    // Capability flags
    this.capabilitiesProbed = false;
  }

  /**
   * Probes system capabilities and initializes either WebGPURenderer or WebGLRenderer fallback.
   * Checks ?renderer=webgl URL param to explicitly force fallback path.
   * @returns {Promise<THREE.WebGLRenderer | any>}
   */
  async init() {
    if (this.capabilitiesProbed && this.renderer) {
      return this.renderer;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const forceWebGL = urlParams.get('renderer') === 'webgl';

    let webgpuSuccess = false;

    if (!forceWebGL && typeof navigator !== 'undefined' && 'gpu' in navigator) {
      try {
        const adapter = await navigator.gpu.requestAdapter();
        if (adapter) {
          const { WebGPURenderer } = await import('three/webgpu');
          const webgpuRenderer = new WebGPURenderer({
            antialias: true,
            powerPreference: 'high-performance'
          });
          await webgpuRenderer.init();
          this.renderer = webgpuRenderer;
          this.isWebGPU = true;
          this.rendererType = 'WebGPU (Hardware Accelerated)';
          webgpuSuccess = true;
          console.info('[RendererManager] Successfully initialized Three.js WebGPURenderer.');
        }
      } catch (err) {
        console.warn('[RendererManager] WebGPU init attempt failed, falling back to WebGL2:', err.message);
        webgpuSuccess = false;
      }
    }

    if (!webgpuSuccess) {
      const reason = forceWebGL ? 'Forced by ?renderer=webgl URL parameter' : 'WebGPU unavailable or adapter rejected';
      console.info(`[RendererManager] Initializing WebGLRenderer (${reason}).`);
      this.renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: 'high-performance',
        alpha: false,
        stencil: false,
        depth: true
      });
      this.isWebGPU = false;
      this.rendererType = forceWebGL ? 'WebGL2 (Forced via ?renderer=webgl)' : 'WebGL2 (High-Performance Fallback)';
    }

    this.capabilitiesProbed = true;

    // Configure renderer parameters
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.setSize(this.width, this.height, false);
    this.renderer.setPixelRatio(this.currentDpr);

    // Canvas attachment
    const domElement = this.renderer.domElement;
    domElement.id = 'neuroarena-canvas';
    domElement.style.width = '100%';
    domElement.style.height = '100%';
    domElement.style.display = 'block';

    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
    this.container.appendChild(domElement);

    return this.renderer;
  }

  /**
   * Updates rolling frame time window and dynamically scales DPR if necessary.
   * Zero-allocation in hot loop.
   * @param {number} deltaSeconds - Time elapsed since last frame in seconds
   */
  updateRollingFrameTime(deltaSeconds) {
    if (deltaSeconds <= 0 || deltaSeconds > 0.5) return; // ignore background tabs or anomalies

    const frameMs = deltaSeconds * 1000;

    // Update rolling sum and circular buffer
    if (this.sampleCount < ROLLING_FRAME_COUNT) {
      this.frameTimeSamples[this.sampleIndex] = frameMs;
      this.rollingSumMs += frameMs;
      this.sampleCount++;
      this.sampleIndex = (this.sampleIndex + 1) % ROLLING_FRAME_COUNT;
      this.rollingAvgFrameMs = this.rollingSumMs / this.sampleCount;
    } else {
      const oldSample = this.frameTimeSamples[this.sampleIndex];
      this.rollingSumMs = this.rollingSumMs - oldSample + frameMs;
      this.frameTimeSamples[this.sampleIndex] = frameMs;
      this.sampleIndex = (this.sampleIndex + 1) % ROLLING_FRAME_COUNT;
      this.rollingAvgFrameMs = this.rollingSumMs / ROLLING_FRAME_COUNT;
    }

    this.currentFps = 1000 / Math.max(1.0, this.rollingAvgFrameMs);

    // Dynamic resolution scaling logic (smooth damping)
    if (this.sampleCount >= 20) {
      if (this.rollingAvgFrameMs > LOW_FPS_THRESHOLD_MS && this.targetDpr > MIN_DPR) {
        // Frame time too high -> scale down resolution
        this.targetDpr = Math.max(MIN_DPR, this.targetDpr - 0.08 * deltaSeconds);
      } else if (this.rollingAvgFrameMs < HIGH_FPS_THRESHOLD_MS && this.targetDpr < this.maxDpr) {
        // High performance budget available -> scale up resolution
        this.targetDpr = Math.min(this.maxDpr, this.targetDpr + 0.04 * deltaSeconds);
      }

      if (Math.abs(this.targetDpr - this.currentDpr) > DPR_CHANGE_THRESHOLD) {
        this.currentDpr = this.targetDpr;
        this.renderer.setPixelRatio(this.currentDpr);
      }
    }

    // Collect render metrics from renderer info
    if (this.renderer && this.renderer.info) {
      this.drawCalls = this.renderer.info.render ? this.renderer.info.render.calls : 0;
      this.triangles = this.renderer.info.render ? this.renderer.info.render.triangles : 0;
    }
  }

  /**
   * Resizes viewport and updates renderer dimensions.
   * @param {number} width - Viewport width
   * @param {number} height - Viewport height
   */
  resize(width, height) {
    if (width <= 0 || height <= 0) return;
    this.width = width;
    this.height = height;
    if (this.renderer) {
      this.renderer.setSize(width, height, false);
      this.renderer.setPixelRatio(this.currentDpr);
    }
  }

  /**
   * Obtains live render performance telemetry for F3 overlay.
   * @returns {Object}
   */
  getStats() {
    return {
      rendererType: this.rendererType,
      isWebGPU: this.isWebGPU,
      fps: Math.round(this.currentFps),
      frameMs: this.rollingAvgFrameMs.toFixed(2),
      dpr: this.currentDpr.toFixed(2),
      drawCalls: this.drawCalls,
      triangles: this.triangles,
      width: this.width,
      height: this.height
    };
  }

  /**
   * Cleans up renderer context and DOM.
   */
  dispose() {
    if (this.renderer) {
      this.renderer.dispose();
      if (this.renderer.domElement && this.renderer.domElement.parentNode) {
        this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
      }
      this.renderer = null;
    }
  }
}

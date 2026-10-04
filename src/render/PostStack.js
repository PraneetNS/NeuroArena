/**
 * @file PostStack.js
 * @description Production post-processing pipeline featuring HDR Bloom, radial chromatic aberration
 * driven by an exponentially decaying shock impulse, ACES Filmic tonemapping, subtle film grain,
 * and custom vignette. Exposes single PostFX.set({...}) API.
 */

import * as THREE from 'three';
import {
  EffectComposer,
  RenderPass,
  EffectPass,
  BloomEffect,
  VignetteEffect,
  NoiseEffect,
  ToneMappingEffect,
  ToneMappingMode,
  BlendFunction,
  Effect
} from 'postprocessing';

const RADIAL_ABERRATION_SHADER = `
  uniform float shock;

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec2 center = vec2(0.5, 0.5);
    vec2 dir = uv - center;
    float dist = length(dir);
    
    // Non-linear radial dispersion expanding outward from screen center
    vec2 offset = normalize(dir + 0.00001) * pow(dist, 1.4) * (shock * 0.028);

    vec4 sampleR = texture2D(inputBuffer, uv - offset);
    vec4 sampleG = texture2D(inputBuffer, uv);
    vec4 sampleB = texture2D(inputBuffer, uv + offset);

    outputColor = vec4(sampleR.r, sampleG.g, sampleB.b, inputColor.a);
  }
`;

/**
 * Custom radial chromatic aberration effect driven by shock uniform.
 */
class RadialAberrationEffect extends Effect {
  constructor() {
    super('RadialAberrationEffect', RADIAL_ABERRATION_SHADER, {
      uniforms: new Map([
        ['shock', new THREE.Uniform(0.0)]
      ])
    });
  }

  setShock(value) {
    const uniform = this.uniforms.get('shock');
    if (uniform) {
      uniform.value = Math.max(0.0, value);
    }
  }

  getShock() {
    const uniform = this.uniforms.get('shock');
    return uniform ? uniform.value : 0.0;
  }
}

export class PostStack {
  /**
   * @param {THREE.WebGLRenderer | any} renderer - The active renderer
   * @param {THREE.Scene} scene - Active 3D scene
   * @param {THREE.Camera} camera - Active camera
   */
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.composer = null;
    this.enabled = true;

    // Shock impulse state
    this.shock = 0.0;
    this.shockDecayRate = 4.5; // Exponential decay rate (reaches ~0 within 0.7s)

    // Effects
    this.bloomEffect = null;
    this.radialAberrationEffect = null;
    this.vignetteEffect = null;
    this.noiseEffect = null;
    this.toneMappingEffect = null;

    this.initComposer();
  }

  /**
   * Initializes EffectComposer with full post-processing pass stack.
   * Gracefully handles WebGPU or unsupported contexts with fallback.
   */
  initComposer() {
    try {
      this.composer = new EffectComposer(this.renderer, {
        frameBufferType: THREE.HalfFloatType
      });

      // 1. Scene Render Pass
      const renderPass = new RenderPass(this.scene, this.camera);
      this.composer.addPass(renderPass);

      // 2. HDR Bloom Effect
      this.bloomEffect = new BloomEffect({
        blendFunction: BlendFunction.ADD,
        mipmapBlur: true,
        luminanceThreshold: 0.75,
        luminanceSmoothing: 0.25,
        intensity: 1.35
      });

      // 3. Radial Chromatic Aberration Effect
      this.radialAberrationEffect = new RadialAberrationEffect();

      // 4. Custom Cybernetic Vignette Effect
      this.vignetteEffect = new VignetteEffect({
        eskil: false,
        offset: 0.32,
        darkness: 0.68
      });

      // 5. Subtle Film Grain Noise
      this.noiseEffect = new NoiseEffect({
        premultiply: true,
        blendFunction: BlendFunction.OVERLAY
      });
      this.noiseEffect.blendMode.opacity.value = 0.055;

      // 6. ACES Filmic Tone Mapping Effect
      this.toneMappingEffect = new ToneMappingEffect({
        mode: ToneMappingMode.ACES_FILMIC
      });

      // Combine into unified EffectPass
      const effectPass = new EffectPass(
        this.camera,
        this.bloomEffect,
        this.radialAberrationEffect,
        this.vignetteEffect,
        this.noiseEffect,
        this.toneMappingEffect
      );
      this.composer.addPass(effectPass);
      console.info('[PostStack] Post-processing pipeline successfully initialized.');
    } catch (err) {
      console.warn('[PostStack] Post-processing composer fallback to direct render:', err.message);
      this.composer = null;
    }
  }

  /**
   * Primary PostFX control API.
   * All parameters exposed via a single PostFX.set({...}) API.
   * @param {Object} params
   * @param {number} [params.shock] - Chromatic aberration shock impulse [0..2]
   * @param {number} [params.bloomIntensity] - Bloom intensity [0..5]
   * @param {number} [params.bloomThreshold] - Bloom luminance threshold [0..1]
   * @param {number} [params.vignetteDarkness] - Vignette darkness [0..1]
   * @param {number} [params.grainOpacity] - Film grain opacity [0..0.2]
   * @param {boolean} [params.enabled] - Master toggle for post effects
   */
  set(params = {}) {
    if (typeof params.enabled === 'boolean') {
      this.enabled = params.enabled;
    }

    if (typeof params.shock === 'number') {
      this.shock = Math.max(0.0, params.shock);
      if (this.radialAberrationEffect) {
        this.radialAberrationEffect.setShock(this.shock);
      }
    }

    if (this.bloomEffect) {
      if (typeof params.bloomIntensity === 'number') {
        this.bloomEffect.intensity = params.bloomIntensity;
      }
      if (typeof params.bloomThreshold === 'number') {
        this.bloomEffect.luminanceMaterial.threshold = params.bloomThreshold;
      }
    }

    if (this.vignetteEffect && typeof params.vignetteDarkness === 'number') {
      this.vignetteEffect.darkness = params.vignetteDarkness;
    }

    if (this.noiseEffect && typeof params.grainOpacity === 'number') {
      this.noiseEffect.blendMode.opacity.value = params.grainOpacity;
    }
  }

  /**
   * Updates per-frame post effects (e.g. exponential shock decay).
   * @param {number} deltaSeconds - Frame elapsed time in seconds
   */
  update(deltaSeconds) {
    if (this.shock > 0.0001) {
      this.shock = this.shock * Math.exp(-this.shockDecayRate * deltaSeconds);
      if (this.shock < 0.0001) this.shock = 0.0;
      if (this.radialAberrationEffect) {
        this.radialAberrationEffect.setShock(this.shock);
      }
    }
  }

  /**
   * Executes post-processing rendering or falls back to direct renderer.
   * @param {number} deltaSeconds - Frame delta time in seconds
   */
  render(deltaSeconds) {
    this.update(deltaSeconds);

    if (this.enabled && this.composer) {
      this.composer.render(deltaSeconds);
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  /**
   * Viewport resize notification.
   * @param {number} width - Viewport width
   * @param {number} height - Viewport height
   */
  resize(width, height) {
    if (this.composer) {
      this.composer.setSize(width, height);
    }
  }

  /**
   * Cleans up all post-processing passes and textures.
   */
  dispose() {
    if (this.composer) {
      this.composer.dispose();
      this.composer = null;
    }
  }
}

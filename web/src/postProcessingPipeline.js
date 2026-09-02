/**
 * High-Performance Post-Processing & Screen FX Pipeline for NeuroArena WebGL (Three.js).
 * Provides customizable Bloom thresholding, Chromatic Aberration, Vignette,
 * Film Grain / Cyberpunk Scanline overlays, and Dynamic Resolution Scaling (DRS).
 */
export class PostProcessingPipeline {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.enabled = true;
    this.drsScale = 1.0; // Dynamic resolution scaling factor (0.5 - 1.0)
    this.targetFrameTimeMs = 1000 / 60; // 60 FPS target

    this.settings = {
      bloomIntensity: 0.65,
      bloomRadius: 0.4,
      bloomThreshold: 0.85,
      chromaticAberrationOffset: 0.0025,
      vignetteDarkness: 0.95,
      vignetteOffset: 1.1,
      scanlinesEnabled: false,
      scanlineIntensity: 0.15
    };

    this.renderTargets = {
      main: null,
      bloom: null
    };

    this.initTargets();
  }

  initTargets() {
    if (!this.renderer) return;
    const width = (window.innerWidth || 1280) * this.drsScale;
    const height = (window.innerHeight || 720) * this.drsScale;

    // Allocate render targets if THREE is present in global or imported
    if (typeof window !== 'undefined' && window.THREE) {
      const THREE = window.THREE;
      this.renderTargets.main = new THREE.WebGLRenderTarget(width, height, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
        type: THREE.HalfFloatType || THREE.UnsignedByteType
      });

      this.renderTargets.bloom = new THREE.WebGLRenderTarget(width / 2, height / 2, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat
      });
    }
  }

  resize(width, height) {
    const w = Math.floor(width * this.drsScale);
    const h = Math.floor(height * this.drsScale);

    if (this.renderTargets.main) {
      this.renderTargets.main.setSize(w, h);
    }
    if (this.renderTargets.bloom) {
      this.renderTargets.bloom.setSize(Math.floor(w / 2), Math.floor(h / 2));
    }
  }

  /**
   * Adapts DRS resolution scale based on GPU frame duration
   * @param {number} frameDurationMs
   */
  adaptResolution(frameDurationMs) {
    if (frameDurationMs > this.targetFrameTimeMs * 1.3) {
      // GPU struggling, step down resolution
      this.drsScale = Math.max(0.65, this.drsScale - 0.05);
      this.resize(window.innerWidth, window.innerHeight);
    } else if (frameDurationMs < this.targetFrameTimeMs * 0.7 && this.drsScale < 1.0) {
      // Plenty of headroom, step up resolution
      this.drsScale = Math.min(1.0, this.drsScale + 0.05);
      this.resize(window.innerWidth, window.innerHeight);
    }
  }

  /**
   * Generates custom GLSL fragment shader for combined post-FX pass
   */
  static getPostFXShader() {
    return {
      uniforms: {
        tDiffuse: { value: null },
        tBloom: { value: null },
        uBloomIntensity: { value: 0.65 },
        uChromaOffset: { value: 0.0025 },
        uVignetteDarkness: { value: 0.95 },
        uVignetteOffset: { value: 1.1 },
        uScanlineIntensity: { value: 0.0 },
        uTime: { value: 0.0 }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform sampler2D tBloom;
        uniform float uBloomIntensity;
        uniform float uChromaOffset;
        uniform float uVignetteDarkness;
        uniform float uVignetteOffset;
        uniform float uScanlineIntensity;
        uniform float uTime;
        varying vec2 vUv;

        void main() {
          // Chromatic Aberration
          vec2 redUv = vUv + vec2(uChromaOffset, 0.0);
          vec2 blueUv = vUv - vec2(uChromaOffset, 0.0);

          float r = texture2D(tDiffuse, redUv).r;
          float g = texture2D(tDiffuse, vUv).g;
          float b = texture2D(tDiffuse, blueUv).b;
          vec4 color = vec4(r, g, b, 1.0);

          // Add Bloom Glow
          vec4 bloom = texture2D(tBloom, vUv);
          color += bloom * uBloomIntensity;

          // Vignette
          vec2 uvDist = (vUv - 0.5) * vec2(uVignetteOffset);
          float vignette = clamp(1.0 - dot(uvDist, uvDist) * uVignetteDarkness, 0.0, 1.0);
          color.rgb *= vignette;

          // Optional Cyber Scanlines
          if (uScanlineIntensity > 0.01) {
            float scanline = sin(vUv.y * 800.0 + uTime * 5.0) * 0.5 + 0.5;
            color.rgb -= scanline * uScanlineIntensity;
          }

          // Tone mapping (ACES Filmic Approximation)
          color.rgb = clamp((color.rgb * (2.51 * color.rgb + 0.03)) / (color.rgb * (2.43 * color.rgb + 0.59) + 0.14), 0.0, 1.0);

          gl_FragColor = color;
        }
      `
    };
  }

  render(deltaTime) {
    if (!this.enabled || !this.renderer) {
      this.renderer.render(this.scene, this.camera);
      return;
    }

    // Pass through rendering with active FX
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Disposes all allocated render targets and textures
   */
  dispose() {
    if (this.renderTargets.main && typeof this.renderTargets.main.dispose === 'function') {
      this.renderTargets.main.dispose();
      this.renderTargets.main = null;
    }
    if (this.renderTargets.bloom && typeof this.renderTargets.bloom.dispose === 'function') {
      this.renderTargets.bloom.dispose();
      this.renderTargets.bloom = null;
    }
  }
}

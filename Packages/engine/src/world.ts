/**
 * 3D Open-World NeuroArena Scene, Environment, Camera, and Lighting.
 * Uses Three.js WebGPURenderer with automatic WebGL2 fallback.
 * Renders:
 * - 2 km x 2 km chunked streamed terrain with KTX2 splatting
 * - TSL Atmospheric Scattering Sky, Day/Night cycle, Sun & Moon disc, Starfield, and Drifting Clouds
 * - Exponential Height Fog & Volumetric Light Shafts
 * - 240,000+ GPU Instanced Grass Blades with Wind & Player Interaction
 * - Low-Poly CC0 Foliage (Trees, Pines, Boulders, Billboards) with spatial CPU collision queries
 * - Painterly Water Plane with shore foam, depth absorption & wave reflections
 * - Post-Processing Pipeline (GTAO, Bloom, Color-Grade LUT, Vignette, DOF, FXAA/TAA)
 */

import * as THREE from 'three/webgpu';
import { Player } from './player.js';
import { TerrainManager, QualityTier } from './terrain/terrainManager.js';
import { loadTerrainTextures } from './terrain/textureLoader.js';
import { FreeFlyCamera } from './camera/freeFlyCamera.js';
import { EnvironmentManager, EnvironmentStats } from './environment/environmentManager.js';

export interface WorldOptions {
  powerPreference?: GPUPowerPreference | string;
}

export interface GpuDeviceInfo {
  name: string;
  vendor: string;
  architecture: string;
  device: string;
  description: string;
  powerPreference: string;
  isFallback: boolean;
  backend: 'WebGPU' | 'WebGL2';
}

export class World {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGPURenderer;
  public container: HTMLElement;
  public targetPowerPreference: GPUPowerPreference;
  public gpuInfo: GpuDeviceInfo = {
    name: 'Initializing GPU...',
    vendor: 'Unknown',
    architecture: 'Unknown',
    device: 'Unknown',
    description: '3D Graphics Device',
    powerPreference: 'high-performance',
    isFallback: false,
    backend: 'WebGPU'
  };

  public terrain: TerrainManager | null = null;
  public environment!: EnvironmentManager;
  public freeFlyCamera: FreeFlyCamera;
  public isFreeFly = false;

  // Camera Orbit parameters for Third-Person
  public cameraAngleY = 0;
  public cameraPitch = 0.35;
  public cameraDistance = 12.0;
  private isMouseDown = false;
  private prevMouseX = 0;
  private prevMouseY = 0;

  // Dynamic Lighting
  public sunLight!: THREE.DirectionalLight;
  public hemiLight!: THREE.HemisphereLight;

  // Frame timing and statistics
  private frameCount = 0;
  private currentFPS = 60;
  private fpsUpdateTime = performance.now();
  private clock = new THREE.Clock();

  constructor(container: HTMLElement, options?: WorldOptions) {
    this.container = container;
    const targetPowerPreference = (options?.powerPreference as GPUPowerPreference) || 'high-performance';
    this.targetPowerPreference = targetPowerPreference;

    // 1. Scene
    this.scene = new THREE.Scene();

    // 2. Camera
    this.camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.2,
      2500
    );
    this.camera.position.set(0, 35, 60);

    // 3. WebGPURenderer with Automatic WebGL2 Fallback
    // Ensure WebGL fallback also receives powerPreference: 'high-performance'
    const canvas = document.createElement('canvas');
    const origGetContext = canvas.getContext.bind(canvas);
    (canvas as any).getContext = function (contextId: string, contextAttributes?: any) {
      if (contextId === 'webgl2' || contextId === 'webgl' || contextId === 'experimental-webgl') {
        contextAttributes = Object.assign(
          { powerPreference: targetPowerPreference, antialias: true },
          contextAttributes
        );
      }
      return origGetContext(contextId, contextAttributes);
    };

    this.renderer = new THREE.WebGPURenderer({
      canvas,
      antialias: true,
      powerPreference: targetPowerPreference
    });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(this.renderer.domElement);

    // 4. Free-Fly Camera Controller
    this.freeFlyCamera = new FreeFlyCamera(this.camera, this.renderer.domElement);

    // 5. Stylized Painterly Lighting & Celestial Setup
    this.setupLighting();

    // 6. Master Environment Manager (Sky, Fog, Grass, Foliage, Water, Post-Processing)
    this.environment = new EnvironmentManager(
      this.scene,
      this.camera,
      this.renderer,
      this.sunLight,
      this.hemiLight
    );

    // 7. Camera Interaction Listeners (Orbit Mode)
    this.setupCameraControls();

    // 8. Window resize handling
    window.addEventListener('resize', this.onResize);
  }

  public async init(): Promise<void> {
    await this.renderer.init();
    await this.detectGpuDeviceInfo();
  }

  private async detectGpuDeviceInfo(): Promise<void> {
    const isWebGPU = (this.renderer as any).isWebGPURenderer;
    const nav = typeof navigator !== 'undefined' ? (navigator as any) : null;

    if (isWebGPU && nav?.gpu?.requestAdapter) {
      try {
        const adapter = await nav.gpu.requestAdapter({ powerPreference: this.targetPowerPreference });
        if (adapter) {
          const info = adapter.info || (await adapter.requestAdapterInfo?.()) || {};
          const isFallback = !!adapter.isFallbackAdapter;
          const gpuName =
            info.description ||
            info.device ||
            (info.vendor && info.architecture ? `${info.vendor} ${info.architecture}` : '') ||
            'WebGPU Hardware Device';

          this.gpuInfo = {
            name: gpuName,
            vendor: info.vendor || 'Unknown GPU Vendor',
            architecture: info.architecture || 'WebGPU Hardware',
            device: info.device || 'Direct3D12 / Vulkan Hardware',
            description: info.description || 'Hardware WebGPU Accelerator',
            powerPreference: this.targetPowerPreference,
            isFallback,
            backend: 'WebGPU'
          };
          return;
        }
      } catch (err) {
        console.warn('WebGPU device info query fallback:', err);
      }
    }

    // WebGL fallback detection
    try {
      const gl = (this.renderer.domElement.getContext('webgl2') ||
        this.renderer.domElement.getContext('webgl')) as WebGL2RenderingContext | null;
      if (gl) {
        const dbg = gl.getExtension('WEBGL_debug_renderer_info');
        const unmaskedRenderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
        const unmaskedVendor = dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR);
        const gpuName = unmaskedRenderer || 'WebGL2 Graphics Device';

        this.gpuInfo = {
          name: gpuName,
          vendor: unmaskedVendor || 'Unknown WebGL Vendor',
          architecture: 'OpenGL ES / WebGL2',
          device: unmaskedRenderer || 'WebGL2 Device',
          description: `WebGL2 Fallback (${unmaskedRenderer})`,
          powerPreference: this.targetPowerPreference,
          isFallback: false,
          backend: 'WebGL2'
        };
        return;
      }
    } catch (err) {
      console.warn('WebGL device info query fallback:', err);
    }

    this.gpuInfo = {
      name: 'Active 3D Graphics Device',
      vendor: 'Unknown',
      architecture: 'Unknown',
      device: 'Default Renderer',
      description: 'Active 3D Hardware',
      powerPreference: this.targetPowerPreference,
      isFallback: false,
      backend: isWebGPU ? 'WebGPU' : 'WebGL2'
    };
  }

  /**
   * Initializes the 2 km x 2 km procedural terrain with CC0 KTX2 textures.
   */
  public async loadTerrain(qualityTier: QualityTier = 'high'): Promise<void> {
    try {
      const textures = await loadTerrainTextures(this.renderer);
      this.terrain = new TerrainManager(textures, qualityTier);
      this.scene.add(this.terrain.group);
      this.setQualityTier(qualityTier);
    } catch (err) {
      console.error('Failed to load terrain system:', err);
    }
  }

  private setupLighting(): void {
    // 1. Hemisphere Ambient Light (Warm Sky / Cool Ground Bounce)
    this.hemiLight = new THREE.HemisphereLight(0xffedd5, 0x1e293b, 1.25);
    this.scene.add(this.hemiLight);

    // 2. Directional Sun with Cascaded Shadows
    this.sunLight = new THREE.DirectionalLight(0xfff3db, 2.6);
    this.sunLight.position.set(350, 500, 280);
    this.sunLight.castShadow = true;

    // Configure shadow map bounds for high-clarity terrain shadows
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 50;
    this.sunLight.shadow.camera.far = 1400;
    this.sunLight.shadow.camera.left = -350;
    this.sunLight.shadow.camera.right = 350;
    this.sunLight.shadow.camera.top = 350;
    this.sunLight.shadow.camera.bottom = -350;
    this.sunLight.shadow.bias = -0.0004;

    this.scene.add(this.sunLight);
  }

  public setQualityTier(tier: QualityTier): void {
    if (this.terrain) {
      this.terrain.setQualityTier(tier);
      const config = this.terrain.getQualityConfig();

      this.sunLight.shadow.mapSize.width = config.shadowResolution;
      this.sunLight.shadow.mapSize.height = config.shadowResolution;
      if (this.sunLight.shadow.map) {
        this.sunLight.shadow.map.dispose();
        this.sunLight.shadow.map = null as any;
      }
    }

    if (this.environment) {
      this.environment.setQualityTier(tier);
    }
  }

  public toggleFreeFly(enable?: boolean): boolean {
    const targetState = enable !== undefined ? enable : !this.isFreeFly;
    this.isFreeFly = targetState;

    if (this.isFreeFly) {
      this.freeFlyCamera.enable();
    } else {
      this.freeFlyCamera.disable();
    }
    return this.isFreeFly;
  }

  private setupCameraControls(): void {
    const el = this.renderer.domElement;

    el.addEventListener('mousedown', (e: MouseEvent) => {
      if (this.isFreeFly) return;
      if (e.button === 0 || e.button === 2) {
        this.isMouseDown = true;
        this.prevMouseX = e.clientX;
        this.prevMouseY = e.clientY;
      }
    });

    window.addEventListener('mouseup', () => {
      this.isMouseDown = false;
    });

    window.addEventListener('mousemove', (e: MouseEvent) => {
      if (this.isFreeFly || !this.isMouseDown) return;
      const dx = e.clientX - this.prevMouseX;
      const dy = e.clientY - this.prevMouseY;
      this.prevMouseX = e.clientX;
      this.prevMouseY = e.clientY;

      this.cameraAngleY -= dx * 0.005;
      this.cameraPitch = THREE.MathUtils.clamp(this.cameraPitch + dy * 0.004, 0.05, 1.4);
    });

    el.addEventListener(
      'wheel',
      (e: WheelEvent) => {
        if (this.isFreeFly) return;
        this.cameraDistance = THREE.MathUtils.clamp(
          this.cameraDistance + e.deltaY * 0.02,
          5.0,
          60.0
        );
      },
      { passive: true }
    );
  }

  public updateCamera(player: Player): void {
    if (this.isFreeFly) return;

    const target = player.position.clone().add(new THREE.Vector3(0, 1.8, 0));

    const horizontalDist = this.cameraDistance * Math.cos(this.cameraPitch);
    const verticalDist = this.cameraDistance * Math.sin(this.cameraPitch);

    const camX = target.x + Math.sin(this.cameraAngleY) * horizontalDist;
    const camY = target.y + verticalDist;
    const camZ = target.z + Math.cos(this.cameraAngleY) * horizontalDist;

    this.camera.position.set(camX, camY, camZ);
    this.camera.lookAt(target);
  }

  public update(dt: number, playerPos?: THREE.Vector3): void {
    // 1. Update Free-Fly camera if active
    if (this.isFreeFly) {
      this.freeFlyCamera.update(dt);
    }

    const pos = playerPos || this.camera.position;
    const elapsed = this.clock.getElapsedTime();

    // 2. Update Streamed Terrain Chunks
    if (this.terrain) {
      this.terrain.update(this.camera.position);
    }

    // 3. Update Environment (Sky, Time of day, Grass, Foliage, Water, Fog)
    if (this.environment) {
      this.environment.update(dt, elapsed, pos);
    }

    // 4. Update FPS
    this.frameCount++;
    const now = performance.now();
    if (now - this.fpsUpdateTime >= 1000) {
      this.currentFPS = Math.round((this.frameCount * 1000) / (now - this.fpsUpdateTime));
      this.frameCount = 0;
      this.fpsUpdateTime = now;
    }
  }

  public render(): void {
    if (this.environment) {
      this.environment.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  public getFullStats(): EnvironmentStats & {
    isFreeFly: boolean;
    activeChunks: number;
    visibleChunks: number;
    backendName: string;
    gpuName: string;
    gpuPowerPreference: string;
  } {
    const infoRender = (this.renderer as any).info?.render;
    const realRendererCalls = infoRender?.drawCalls ?? infoRender?.calls ?? (this.renderer as any).info?.calls ?? 0;
    const realRendererTris = infoRender?.triangles ?? 0;

    const terrainStats = this.terrain
      ? this.terrain.getStats(this.camera)
      : {
          activeChunks: 0,
          visibleChunks: 0,
          totalTriangles: 0,
          estimatedMemoryMB: 0,
          drawCalls: 0,
          qualityTier: 'high' as QualityTier
        };

    const envStats = this.environment
      ? this.environment.getStats(
          terrainStats.totalTriangles,
          terrainStats.drawCalls,
          this.currentFPS
        )
      : {
          fps: this.currentFPS,
          qualityTier: 'high' as QualityTier,
          drawCalls: terrainStats.drawCalls,
          totalTriangles: terrainStats.totalTriangles,
          gpuMemoryMB: terrainStats.estimatedMemoryMB,
          timeOfDayHours: 12.0,
          isGoldenHour: false,
          terrainTris: terrainStats.totalTriangles,
          terrainDrawCalls: terrainStats.drawCalls,
          grassBlades: 0,
          grassTris: 0,
          grassDrawCalls: 0,
          foliageInstances: 0,
          foliageTris: 0,
          foliageDrawCalls: 0,
          waterTris: 0,
          waterDrawCalls: 0,
          activePostPasses: 0
        };

    const effectiveDrawCalls =
      realRendererCalls > 0
        ? realRendererCalls
        : terrainStats.drawCalls +
          envStats.grassDrawCalls +
          envStats.foliageDrawCalls +
          envStats.waterDrawCalls +
          1;

    return {
      ...envStats,
      drawCalls: effectiveDrawCalls,
      totalTriangles: realRendererTris > 0 ? realRendererTris : envStats.totalTriangles,
      isFreeFly: this.isFreeFly,
      activeChunks: terrainStats.activeChunks,
      visibleChunks: terrainStats.visibleChunks,
      terrainDrawCalls: terrainStats.drawCalls,
      backendName: this.gpuInfo.backend,
      gpuName: this.gpuInfo.name,
      gpuPowerPreference: this.gpuInfo.powerPreference
    };
  }

  public onResize = (): void => {
    if (!this.container) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  public destroy(): void {
    window.removeEventListener('resize', this.onResize);
    this.freeFlyCamera.dispose();
    if (this.terrain) {
      this.terrain.dispose();
    }
    this.renderer.dispose();
  }
}

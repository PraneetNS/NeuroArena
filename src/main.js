/**
 * @file main.js
 * @description Application bootstrap coordinating RendererManager, CameraRig,
 * PostStack, LossSurfaceScene, Loop, and UI components.
 */

import * as THREE from 'three';
import { RendererManager } from './render/RendererManager.js';
import { PostStack } from './render/PostStack.js';
import { CameraRig } from './core/CameraRig.js';
import { Loop } from './core/Loop.js';
import { LossSurfaceScene } from './world/LossSurfaceScene.js';
import { DebugOverlay } from './ui/DebugOverlay.js';
import { BootScreen } from './ui/BootScreen.js';

import './ui/design-tokens.css';

async function bootstrap() {
  const canvasContainer = document.getElementById('canvas-container');
  const uiRoot = document.getElementById('ui-root');

  if (!canvasContainer || !uiRoot) {
    throw new Error('[Bootstrap] Required DOM mounting elements not found.');
  }

  // 1. Initialize Renderer with WebGPU / WebGL2 Fallback & Dynamic DPR
  const rendererManager = new RendererManager(canvasContainer);
  const renderer = await rendererManager.init();

  // 2. Scene Graph
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#05080E');
  scene.fog = new THREE.FogExp2('#05080E', 0.038);

  // Ambient & Directional Lights
  const ambientLight = new THREE.AmbientLight('#111A29', 1.4);
  scene.add(ambientLight);

  const keyLight = new THREE.DirectionalLight('#00F59B', 2.2);
  keyLight.position.set(12, 20, 10);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight('#F59E0B', 1.8);
  fillLight.position.set(-15, 12, -10);
  scene.add(fillLight);

  // 3. Camera Rig with Spring Follow & Procedural Trauma Shake
  const width = canvasContainer.clientWidth || window.innerWidth;
  const height = canvasContainer.clientHeight || window.innerHeight;
  const cameraRig = new CameraRig({
    fov: 54,
    aspect: width / height,
    near: 0.1,
    far: 1000
  });
  cameraRig.setOffset(0, 6.0, 11.5);

  // 4. Post-Processing Pipeline (HDR Bloom, Chromatic Shock, ACES, Grain, Vignette)
  const postStack = new PostStack(renderer, scene, cameraRig.camera);

  // 5. Living Mathematical Loss Surface Scene
  const lossSurface = new LossSurfaceScene(scene);
  cameraRig.setTarget(lossSurface.probeMesh.position);

  // 6. UI: F3 Live Telemetry Overlay & Cybernetic Boot Screen
  const debugOverlay = new DebugOverlay(uiRoot);

  const bootScreen = new BootScreen(uiRoot, {
    onStart: () => {
      // Impact juice moment
      postStack.set({ shock: 1.2 });
      cameraRig.addTrauma(0.6);
      cameraRig.kickFov(14.0);
    },
    onTriggerShock: () => {
      // Full test of radial chromatic aberration shock, camera trauma, and hit-stop
      postStack.set({ shock: 1.8 });
      cameraRig.addTrauma(0.85);
      cameraRig.kickFov(16.0);
      loop.hitStop(80); // 80ms freeze
    },
    onToggleDebug: () => {
      debugOverlay.toggle();
    }
  });

  // 7. Viewport Resizing Handler
  const handleResize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    rendererManager.resize(w, h);
    cameraRig.resize(w, h);
    postStack.resize(w, h);
  };
  window.addEventListener('resize', handleResize);

  // 8. Deterministic 60 Hz Game Loop with Accumulator & Interpolation
  const loop = new Loop({
    onFixedUpdate: (fixedDt) => {
      // Step living mathematical simulation & SGD optimization
      lossSurface.update(fixedDt);

      // Camera follows the active gradient descent probe
      cameraRig.setTarget(lossSurface.probeMesh.position);
    },
    onRender: (alpha, unscaledDt) => {
      // Update camera spring follow, trauma decay, and FOV interpolation
      cameraRig.update(unscaledDt);

      // Render post-processing passes
      postStack.render(unscaledDt);

      // Track frame times and adjust DPR dynamically
      rendererManager.updateRollingFrameTime(unscaledDt);

      // Update F3 Live Telemetry
      const renderStats = rendererManager.getStats();
      const mathMetrics = lossSurface.getMetrics();

      debugOverlay.update({
        fps: renderStats.fps,
        frameMs: renderStats.frameMs,
        dpr: renderStats.dpr,
        drawCalls: renderStats.drawCalls,
        triangles: renderStats.triangles,
        rendererType: renderStats.rendererType,
        loss: mathMetrics.loss,
        gradNorm: mathMetrics.gradNorm,
        stepCount: mathMetrics.stepCount,
        entityCount: 4, // Surface + Probe + Trail + Subgrid
        trauma: cameraRig.trauma
      });
    }
  });

  loop.start();
  console.info('[NeuroArena] Core loop successfully initiated at 60 Hz.');
}

window.addEventListener('DOMContentLoaded', bootstrap);

/**
 * Stylized Atmospheric Scattering Sky Dome with TSL (Three.js Shading Language).
 * Features:
 * - Analytical Rayleigh & Mie atmospheric scattering
 * - Sun disc with painterly solar corona
 * - Moon disc with soft night glow
 * - Procedural twinkling starfield
 * - Soft painterly drifting layered-noise clouds
 * - Full time-of-day dynamic parameter updates
 */

import * as THREE from 'three/webgpu';
import {
  Fn,
  positionWorld,
  cameraPosition,
  uniform,
  vec3,
  vec4,
  float,
  dot,
  normalize,
  smoothstep,
  max,
  sin,
  cos
} from 'three/tsl';
import { TimeOfDayState } from './timeOfDay.js';

export class SkySystem {
  public mesh: THREE.Mesh;
  public material: THREE.MeshBasicNodeMaterial;

  // Uniforms passed to TSL shader
  private uSunDirection = uniform(new THREE.Vector3(0.5, 0.6, 0.3).normalize());
  private uMoonDirection = uniform(new THREE.Vector3(-0.5, -0.6, -0.3).normalize());
  private uSunColor = uniform(new THREE.Color(0xffedd5));
  private uSunIntensity = uniform(2.5);
  private uZenithColor = uniform(new THREE.Color(0x1d4ed8));
  private uHorizonColor = uniform(new THREE.Color(0xfde68a));
  private uCloudTint = uniform(new THREE.Color(1, 1, 1));
  private uStarOpacity = uniform(0.0);
  private uTime = uniform(0.0);
  private uCloudDensity = uniform(0.55);

  constructor() {
    const skyGeo = new THREE.SphereGeometry(2200, 48, 32);
    // Invert geometry normals so it renders inside out
    skyGeo.scale(-1, 1, 1);

    this.material = this.createSkyMaterial();
    this.mesh = new THREE.Mesh(skyGeo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -100; // Render behind everything
  }

  private createSkyMaterial(): THREE.MeshBasicNodeMaterial {
    const mat = new THREE.MeshBasicNodeMaterial();
    mat.side = THREE.BackSide;
    mat.depthWrite = false;

    const uSunDir = this.uSunDirection;
    const uMoonDir = this.uMoonDirection;
    const uSunCol = this.uSunColor;
    const uSunInt = this.uSunIntensity;
    const uZenithCol = this.uZenithColor;
    const uHorizonCol = this.uHorizonColor;
    const uCloudCol = this.uCloudTint;
    const uStarOp = this.uStarOpacity;
    const uTime = this.uTime;
    const uCloudDens = this.uCloudDensity;

    // Sky shader node
    const skyColorNode = Fn(() => {
      // Ray direction from camera to dome vertex
      const rayDir = normalize(positionWorld.sub(cameraPosition));
      const rayY = rayDir.y;

      // 1. Atmosphere Gradient (Zenith to Horizon)
      // Clamped altitude factor
      const hFactor = smoothstep(float(-0.05), float(0.65), rayY);
      const baseSky = uHorizonCol.rgb.mix(uZenithCol.rgb, hFactor);

      // 2. Rayleigh & Mie Atmospheric Scattering towards Sun
      const cosTheta = max(float(0.0), dot(rayDir, uSunDir));

      // Rayleigh halo
      const rayleigh = cosTheta.mul(cosTheta).mul(0.25);

      // Mie forward-scattering (warm glow around sun)
      const g = float(0.78);
      const g2 = g.mul(g);
      const denom = float(1.0).add(g2).sub(float(2.0).mul(g).mul(cosTheta)).pow(1.5);
      const mie = float(1.0).sub(g2).div(max(float(0.001), denom)).mul(0.06);

      // Boost forward scattering with sun color
      const scatterLight = uSunCol.rgb.mul(mie.add(rayleigh)).mul(uSunInt);
      const skyWithAtmosphere = baseSky.add(scatterLight);

      // 3. Sun Disc & Painterly Corona
      const sunDiscEdge = smoothstep(float(0.9992), float(0.9998), cosTheta);
      const sunCorona = smoothstep(float(0.985), float(0.9992), cosTheta).mul(0.45);
      const sunContribution = uSunCol.rgb.mul(sunDiscEdge.mul(float(4.0)).add(sunCorona)).mul(uSunInt);

      // 4. Moon Disc & Soft Night Halo
      const cosMoon = max(float(0.0), dot(rayDir, uMoonDir));
      const moonDisc = smoothstep(float(0.9985), float(0.9996), cosMoon);
      const moonHalo = smoothstep(float(0.97), float(0.9985), cosMoon).mul(0.18);
      const moonColor = vec3(0.85, 0.92, 1.0).mul(moonDisc.mul(float(2.5)).add(moonHalo));

      // 5. Procedural Stars (Active at Night)
      // Deterministic 3D pseudo-random grid hash
      const starCoord = rayDir.xyz.mul(320.0);
      const starFloor = starCoord.floor();
      const starFract = starCoord.fract().sub(0.5);

      // Hash function for star intensity
      const starHash = sin(dot(starFloor, vec3(12.9898, 78.233, 45.164))).mul(43758.5453).fract();
      const starDist = dot(starFract, starFract);
      const starGlow = smoothstep(float(0.08), float(0.01), starDist);
      const isStar = starHash.greaterThan(float(0.97)).select(starGlow.mul(starHash), float(0.0));
      const stars = vec3(1.0, 0.98, 0.95).mul(isStar).mul(uStarOp);

      // 6. Soft Painterly Drifting Clouds
      // Project ray into spherical cloud coordinates
      const cloudUV = vec3(rayDir.x, float(0.0), rayDir.z).normalize().xz.mul(1.8);
      const cloudSpeed = uTime.mul(0.004);

      // Multi-frequency wave synthesis for painterly brush-stroke clouds
      const p1 = cloudUV.mul(1.5).add(vec3(cloudSpeed, cloudSpeed.mul(0.5), float(0.0)).xy);
      const p2 = cloudUV.mul(3.2).sub(vec3(cloudSpeed.mul(0.7), float(0.0), float(0.0)).xy);

      const w1 = sin(p1.x.mul(2.0).add(p1.y.mul(1.8))).mul(0.35);
      const w2 = cos(p1.x.mul(1.4).sub(p1.y.mul(2.6))).mul(0.30);
      const w3 = sin(p2.x.mul(3.5).add(p2.y.mul(2.2))).mul(0.18);
      const rawCloud = w1.add(w2).add(w3).add(0.5);

      // Height fade: only clouds in upper sky
      const cloudHeightFade = smoothstep(float(0.08), float(0.35), rayY);
      const cloudAlpha = smoothstep(float(0.42), float(0.75), rawCloud)
        .mul(cloudHeightFade)
        .mul(uCloudDens);

      // Cloud sun-rim lighting (golden/amber edge when facing sun)
      const cloudSunRim = cosTheta.mul(0.5).add(0.5);
      const litCloudColor = uCloudCol.rgb.mul(cloudSunRim.mul(0.4).add(0.6));

      // Combine: Base Sky + Stars + Moon + Sun + Clouds
      const skyWithCelestials = skyWithAtmosphere.add(sunContribution).add(moonColor).add(stars);
      const finalSky = skyWithCelestials.mix(litCloudColor, cloudAlpha);

      return vec4(finalSky, 1.0);
    });

    mat.colorNode = skyColorNode();
    return mat;
  }

  public update(state: TimeOfDayState, elapsedTime: number): void {
    // Update shader uniforms
    this.uSunDirection.value.copy(state.sunDirection);
    this.uMoonDirection.value.copy(state.moonDirection);
    this.uSunColor.value.copy(state.sunColor);
    this.uSunIntensity.value = state.sunIntensity;
    this.uStarOpacity.value = state.starOpacity;
    this.uCloudTint.value.copy(state.cloudTint);
    this.uTime.value = elapsedTime;

    // Derive horizon and zenith colors from time-of-day state
    if (state.isGoldenHour) {
      this.uZenithColor.value.setHex(0x1e3a8a); // Indigo sapphire zenith
      this.uHorizonColor.value.copy(state.fogColor); // Radiant golden amber
    } else if (state.isNight) {
      this.uZenithColor.value.setHex(0x020617); // Obsidian zenith
      this.uHorizonColor.value.copy(state.fogColor); // Deep twilight navy
    } else {
      this.uZenithColor.value.setHex(0x1d4ed8); // Rich daytime blue
      this.uHorizonColor.value.copy(state.fogColor); // Sunny distance haze
    }
  }

  public setCloudDensity(density: number): void {
    this.uCloudDensity.value = Math.max(0.0, Math.min(1.0, density));
  }
}

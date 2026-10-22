/**
 * Time of Day & Celestial Controller for NeuroArena.
 * Manages full 24-hour day/night cycle, astronomical sun and moon orbits,
 * dynamic color grading, ambient lighting, and horizon fog colors.
 */

import * as THREE from 'three/webgpu';

export interface TimeOfDayState {
  timeHours: number; // 0.0 to 24.0
  timeNormalized: number; // 0.0 to 1.0
  sunDirection: THREE.Vector3;
  moonDirection: THREE.Vector3;
  sunColor: THREE.Color;
  sunIntensity: number;
  ambientSkyColor: THREE.Color;
  ambientGroundColor: THREE.Color;
  ambientIntensity: number;
  fogColor: THREE.Color;
  fogDensity: number;
  isGoldenHour: boolean;
  isNight: boolean;
  cloudTint: THREE.Color;
  starOpacity: number;
}

export class TimeOfDayController {
  // Current in-game time in hours (0.0 to 24.0).
  // Default start at 18.2 (6:12 PM - glorious golden sunset)
  public timeHours: number = 18.2;

  // Real-world minutes per 24-hour in-game day (default 24 minutes)
  public minutesPerDay: number = 24.0;
  public isPaused: boolean = false;

  private sunDir = new THREE.Vector3();
  private moonDir = new THREE.Vector3();

  // Cached color objects to avoid per-frame allocations
  private sunColor = new THREE.Color();
  private ambientSky = new THREE.Color();
  private ambientGround = new THREE.Color();
  private fogColor = new THREE.Color();
  private cloudTint = new THREE.Color();

  constructor(initialHours = 18.2, minutesPerDay = 24.0) {
    this.timeHours = initialHours;
    this.minutesPerDay = minutesPerDay;
  }

  public update(dtSeconds: number): TimeOfDayState {
    if (!this.isPaused && this.minutesPerDay > 0) {
      const hoursPerSecond = 24.0 / (this.minutesPerDay * 60.0);
      this.timeHours = (this.timeHours + dtSeconds * hoursPerSecond) % 24.0;
      if (this.timeHours < 0) this.timeHours += 24.0;
    }

    return this.getState();
  }

  public setTime(hours: number): void {
    this.timeHours = ((hours % 24.0) + 24.0) % 24.0;
  }

  public getState(): TimeOfDayState {
    const hours = this.timeHours;
    const timeNorm = hours / 24.0;

    // Celestial orbital mechanics:
    // Sun rises in East (+X), peaks in South (+Z, +Y), sets in West (-X)
    // Solar angle: 0 at midnight, PI at noon (12:00)
    const solarAngle = (hours - 6.0) * (Math.PI / 12.0); // 0 at 6am, PI/2 at 12pm, PI at 6pm
    const sunElevation = Math.sin(solarAngle);
    const sunAzimuth = Math.cos(solarAngle);

    // Give sun a gentle 35-degree seasonal tilt for painterly oblique angles
    this.sunDir.set(
      -sunAzimuth * 0.85,
      sunElevation,
      Math.cos(solarAngle * 0.5) * 0.45 + 0.35
    ).normalize();

    // Moon is opposite to the sun
    this.moonDir.copy(this.sunDir).negate();

    const sunHeight = this.sunDir.y;

    // Golden hour detection: sun near horizon (height between -0.08 and 0.28)
    const isGoldenHour = sunHeight > -0.08 && sunHeight < 0.28;
    const isNight = sunHeight <= -0.05;

    // Interpolate colors based on sun height and time
    let sunIntensity = 0;
    let ambientIntensity = 1.0;
    let fogDensity = 0.0012;
    let starOpacity = 0.0;

    if (sunHeight > 0.35) {
      // High noon / mid-day: crisp warm white sun, bright azure ambient
      const t = Math.min(1.0, (sunHeight - 0.35) / 0.65);
      this.sunColor.setRGB(1.0, 0.96, 0.88);
      sunIntensity = THREE.MathUtils.lerp(2.2, 3.2, t);

      this.ambientSky.setRGB(0.58, 0.77, 0.99); // Sky blue
      this.ambientGround.setRGB(0.20, 0.28, 0.35); // Cool ground bounce
      ambientIntensity = 1.25;

      this.fogColor.setRGB(0.72, 0.85, 0.98); // Soft distance azure haze
      this.cloudTint.setRGB(1.0, 1.0, 1.0);
      starOpacity = 0.0;
    } else if (sunHeight > 0.0) {
      // Golden Hour / Sunset / Sunrise (Warm, painterly, amber & rose)
      const t = sunHeight / 0.35; // 0 at horizon, 1 at golden hour peak
      // Sunset: saturated amber/gold sun with deep coral/peach rim
      this.sunColor.lerpColors(
        new THREE.Color(0xff6e30), // Deep sunset vermilion/amber
        new THREE.Color(0xfff0c4), // Pale warm yellow
        t
      );
      sunIntensity = THREE.MathUtils.lerp(1.4, 2.2, t);

      this.ambientSky.lerpColors(
        new THREE.Color(0xfd8a5e), // Coral amber sky glow
        new THREE.Color(0x7dd3fc), // Light sky blue
        t
      );
      this.ambientGround.lerpColors(
        new THREE.Color(0x381507), // Warm terracotta dark bounce
        new THREE.Color(0x1e293b),
        t
      );
      ambientIntensity = THREE.MathUtils.lerp(1.5, 1.25, t);

      this.fogColor.lerpColors(
        new THREE.Color(0xfb923c), // Radiant sunset horizon fog
        new THREE.Color(0xfde68a), // Golden peach
        t
      );
      this.cloudTint.lerpColors(
        new THREE.Color(0xffcba4), // Rose-tinted clouds
        new THREE.Color(1.0, 1.0, 1.0),
        t
      );
      starOpacity = 0.0;
    } else if (sunHeight > -0.25) {
      // Twilight / Dusk: deep violet, indigo, rose horizon line
      const t = (sunHeight - (-0.25)) / 0.25; // 0 at dark night, 1 at sunset border
      this.sunColor.setRGB(0.8, 0.25, 0.15);
      sunIntensity = THREE.MathUtils.lerp(0.0, 1.0, t);

      this.ambientSky.lerpColors(
        new THREE.Color(0x1e1b4b), // Deep twilight indigo
        new THREE.Color(0xd946ef), // Electric dusk magenta
        t
      );
      this.ambientGround.setRGB(0.05, 0.06, 0.12);
      ambientIntensity = THREE.MathUtils.lerp(0.4, 0.9, t);

      this.fogColor.lerpColors(
        new THREE.Color(0x0f172a), // Dark horizon
        new THREE.Color(0xa855f7), // Purple twilight horizon
        t
      );
      this.cloudTint.setRGB(0.45, 0.35, 0.55);
      starOpacity = (1.0 - t) * 0.8;
      fogDensity = 0.0016;
    } else {
      // Midnight / Starry Night
      this.sunColor.setRGB(0.05, 0.08, 0.15);
      sunIntensity = 0.0; // Sun below horizon

      // Moonlight ambient
      this.ambientSky.setRGB(0.08, 0.12, 0.22); // Moonlit midnight blue
      this.ambientGround.setRGB(0.02, 0.03, 0.06);
      ambientIntensity = 0.35;

      this.fogColor.setRGB(0.04, 0.06, 0.12); // Deep midnight fog
      this.cloudTint.setRGB(0.12, 0.15, 0.25);
      starOpacity = 1.0;
      fogDensity = 0.0018;
    }

    return {
      timeHours: hours,
      timeNormalized: timeNorm,
      sunDirection: this.sunDir,
      moonDirection: this.moonDir,
      sunColor: this.sunColor,
      sunIntensity,
      ambientSkyColor: this.ambientSky,
      ambientGroundColor: this.ambientGround,
      ambientIntensity,
      fogColor: this.fogColor,
      fogDensity,
      isGoldenHour,
      isNight,
      cloudTint: this.cloudTint,
      starOpacity
    };
  }
}

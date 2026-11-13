/**
 * Stylized Painterly Terrain Shader Material written with Three.js TSL (Three.js Shading Language).
 * Features:
 * - 4-biome splatting: Sand, Grass, Dirt, Rock by slope and altitude
 * - Triplanar texture mapping on steep cliff slopes
 * - Per-texture normal maps for rich tactile relief
 * - Macro-variation noise to eliminate repeating tiling artifacts over 2 km distances
 * - Soft warm painterly art direction (Journey / Breath of the Wild / Sable style)
 */

import * as THREE from 'three/webgpu';
import {
  attribute,
  positionWorld,
  normalWorld,
  texture,
  triplanarTexture,
  vec2,
  vec3,
  vec4,
  float,
  Fn,
  smoothstep,
  mix,
  uniform
} from 'three/tsl';


export interface TerrainTextures {
  grassDiffuse: THREE.Texture;
  grassNormal: THREE.Texture;
  dirtDiffuse: THREE.Texture;
  dirtNormal: THREE.Texture;
  rockDiffuse: THREE.Texture;
  rockNormal: THREE.Texture;
  sandDiffuse: THREE.Texture;
  sandNormal: THREE.Texture;
}

/**
 * Creates the high-performance TSL Node Material for Terrain rendering.
 */
export function createTerrainMaterial(textures: TerrainTextures): THREE.MeshStandardNodeMaterial {
  const material = new THREE.MeshStandardNodeMaterial();

  // Dynamic uniforms for drifting cloud shadows and player worn paths
  const uTime = uniform(0.0);
  const uPlayerTrailPos = uniform(new THREE.Vector3(0, 0, 0));
  const uTrailFade = uniform(0.0);

  // Ensure wrapping is set to RepeatWrapping on all textures
  const allTextures = Object.values(textures);
  for (const tex of allTextures) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
  }

  // 1. Splat Weights Attribute passed per-vertex from the Worker
  // (x: sand, y: grass, z: dirt, w: rock)
  const aSplats = attribute('aSplats', 'vec4');

  // 2. Texture Sampling UVs
  // World-space UVs prevent texture stretching across chunk borders
  const worldPos = positionWorld;
  const worldNorm = normalWorld;

  const grassUV = worldPos.xz.mul(0.12);
  const dirtUV = worldPos.xz.mul(0.14);
  const sandUV = worldPos.xz.mul(0.10);

  // 3. Diffuse Samples
  const grassColor = texture(textures.grassDiffuse, grassUV);
  const dirtColor = texture(textures.dirtDiffuse, dirtUV);
  const sandColor = texture(textures.sandDiffuse, sandUV);

  const rockTexNode = texture(textures.rockDiffuse);
  const rockTriplanar = triplanarTexture(
    rockTexNode,
    rockTexNode,
    rockTexNode,
    float(0.08)
  );

  // 5. Macro-Variation Noise Function (TSL)
  // Low-frequency procedural modulation over 100-300m scales to break up tiling
  const macroNoise = Fn(() => {
    const p1 = worldPos.xz.mul(0.0035);
    const p2 = worldPos.xz.mul(0.008);

    const wave1 = p1.x.mul(1.8).add(p1.y.mul(2.4)).sin();
    const wave2 = p1.x.mul(3.2).sub(p1.y.mul(1.6)).cos();
    const wave3 = p2.x.mul(2.1).add(p2.y.mul(3.7)).sin();

    const combined = wave1.add(wave2).mul(0.35).add(wave3.mul(0.3));
    // Maps to range [0.82, 1.18]
    return combined.mul(0.18).add(1.0);
  });

  const macroVal = macroNoise();

  // 6. Splat Blending
  // Sand -> Grass -> Dirt -> Rock
  const diffuseBlend = Fn(() => {
    const sandCol = sandColor.rgb.mul(vec3(1.05, 0.98, 0.90)); // Soft golden beach
    const grassCol = grassColor.rgb.mul(vec3(1.0, 1.05, 0.95)); // Vibrant sunlit meadow
    const dirtCol = dirtColor.rgb.mul(vec3(1.02, 0.96, 0.92)); // Warm terracotta loam
    const rockCol = rockTriplanar.rgb.mul(vec3(1.08, 0.95, 0.92)); // Reddish sandstone cliff

    // Accumulate weighted layers
    const c = sandCol.mul(aSplats.x)
      .add(grassCol.mul(aSplats.y))
      .add(dirtCol.mul(aSplats.z))
      .add(rockCol.mul(aSplats.w));

    // Apply painterly macro-variation modulation
    const painterlyColor = c.mul(macroVal);

    // Biome Regional Color Shifts based on world coordinates across 2 km world
    const biomeX = worldPos.x.mul(0.001); // [-1.0, 1.0]
    const biomeZ = worldPos.z.mul(0.001);

    // North-West / River: cool aquamarine coastal tint
    // South-West / Meadow: vivid clover emerald
    // North-East / Ridge: cool lavender / alpine slate
    // South-East / Terracotta: rich sunbaked ochre
    const biomeTint = vec3(
      float(1.0).add(biomeX.mul(0.08)),
      float(1.0).add(biomeZ.mul(0.06)).sub(biomeX.mul(0.03)),
      float(1.0).sub(biomeX.mul(0.06)).add(biomeZ.mul(0.04))
    );

    // Shoreline wet-sand darkening (near water level 7.5m)
    const distWater = worldPos.y.sub(float(7.5)).abs();
    const wetSand = float(1.0).sub(smoothstep(float(0.0), float(1.8), distWater)).mul(aSplats.x);
    const wetFactor = mix(float(1.0), float(0.70), wetSand);

    // Drifting cloud shadow modulation (procedural cloud velocity across terrain)
    const cloudSpeed = uTime.mul(0.025);
    const cloudWave1 = worldPos.x.mul(0.003).add(worldPos.z.mul(0.002)).add(cloudSpeed).sin();
    const cloudWave2 = worldPos.x.mul(0.0015).sub(worldPos.z.mul(0.0035)).sub(cloudSpeed.mul(0.8)).cos();
    const cloudShadow = cloudWave1.add(cloudWave2).mul(0.18).add(0.82);

    // Player worn paths: compaction and dirt transition where the player walks
    const playerXZ = vec2(uPlayerTrailPos.x, uPlayerTrailPos.z);
    const worldXZ = vec2(worldPos.x, worldPos.z);
    const distPlayer = worldXZ.sub(playerXZ).length();
    const pathMask = float(1.0).sub(smoothstep(float(0.4), float(2.2), distPlayer)).mul(uTrailFade).mul(aSplats.y);
    const pathTint = mix(vec3(1.0, 1.0, 1.0), vec3(0.68, 0.58, 0.48), pathMask);

    const finalTerrain = painterlyColor.mul(biomeTint).mul(wetFactor).mul(cloudShadow).mul(pathTint);

    // Warm atmospheric sun-kissed boost
    return vec4(finalTerrain, 1.0);
  });

  material.colorNode = diffuseBlend();

  // 7. Normal Map Blending
  const normalBlend = Fn(() => {
    const grassNormSample = texture(textures.grassNormal, grassUV).xyz.mul(2.0).sub(1.0);
    const dirtNormSample = texture(textures.dirtNormal, dirtUV).xyz.mul(2.0).sub(1.0);
    const sandNormSample = texture(textures.sandNormal, sandUV).xyz.mul(2.0).sub(1.0);

    const rockNormNode = texture(textures.rockNormal);
    const rockNormTri = triplanarTexture(
      rockNormNode,
      rockNormNode,
      rockNormNode,
      float(0.08)
    ).xyz.mul(2.0).sub(1.0);

    const blendedTangentNormal = sandNormSample.mul(aSplats.x)
      .add(grassNormSample.mul(aSplats.y))
      .add(dirtNormSample.mul(aSplats.z))
      .add(rockNormTri.mul(aSplats.w));

    // Perturb the geometric world normal with blended normal map relief
    const perturbed = worldNorm.add(vec3(blendedTangentNormal.x.mul(0.4), float(0.0), blendedTangentNormal.y.mul(0.4)));
    return perturbed.normalize();
  });

  material.normalNode = normalBlend();

  // 8. Roughness Node: Sand (0.9), Grass (0.75), Dirt (0.85), Rock (0.7)
  const roughnessBlend = Fn(() => {
    const baseRoughness = float(0.9).mul(aSplats.x)
      .add(float(0.75).mul(aSplats.y))
      .add(float(0.85).mul(aSplats.z))
      .add(float(0.70).mul(aSplats.w));

    // Wet sand is glossy / reflective
    const distWater = worldPos.y.sub(float(7.5)).abs();
    const wetSand = float(1.0).sub(smoothstep(float(0.0), float(1.8), distWater)).mul(aSplats.x);
    return mix(baseRoughness, float(0.28), wetSand);
  });

  material.roughnessNode = roughnessBlend();
  material.metalnessNode = float(0.05);

  material.roughness = 0.8;
  material.metalness = 0.05;

  material.userData.uTime = uTime;
  material.userData.uPlayerTrailPos = uPlayerTrailPos;
  material.userData.uTrailFade = uTrailFade;
  material.userData.update = (time: number, playerPos?: THREE.Vector3) => {
    uTime.value = time;
    if (playerPos) {
      uPlayerTrailPos.value.copy(playerPos);
      uTrailFade.value = 1.0;
    }
  };

  return material;
}

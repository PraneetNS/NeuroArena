/**
 * Generates CC0 Stylized Painterly Terrain Textures (Grass, Dirt, Rock, Sand - Albedo & Normal)
 * and packages them into Khronos KTX 2.0 containers.
 */

import fs from 'fs';
import path from 'path';
import {
  KTX2Container,
  write,
  VK_FORMAT_R8G8B8A8_SRGB,
  VK_FORMAT_R8G8B8A8_UNORM
} from '../node_modules/.pnpm/three@0.170.0/node_modules/three/examples/jsm/libs/ktx-parse.module.js';

const OUT_DIR = path.resolve('apps/game/public/textures/terrain');
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

const WIDTH = 256;
const HEIGHT = 256;

// Pseudo-random deterministic noise
function hash(x, y) {
  let h = x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) & 0x7fffffff) / 0x7fffffff;
}

function smoothNoise(x, y) {
  const i = Math.floor(x);
  const j = Math.floor(y);
  const fx = x - i;
  const fy = y - j;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);

  const n00 = hash(i, j);
  const n10 = hash(i + 1, j);
  const n01 = hash(i, j + 1);
  const n11 = hash(i + 1, j + 1);

  return (1 - sy) * ((1 - sx) * n00 + sx * n10) + sy * ((1 - sx) * n01 + sx * n11);
}

function fbm(x, y, octaves = 4) {
  let total = 0;
  let freq = 1;
  let amp = 0.5;
  for (let o = 0; o < octaves; o++) {
    total += smoothNoise(x * freq, y * freq) * amp;
    freq *= 2;
    amp *= 0.5;
  }
  return total;
}

function createKTX2(pixels, isSRGB = true) {
  const c = new KTX2Container();
  c.vkFormat = isSRGB ? VK_FORMAT_R8G8B8A8_SRGB : VK_FORMAT_R8G8B8A8_UNORM;
  c.typeSize = 1;
  c.pixelWidth = WIDTH;
  c.pixelHeight = HEIGHT;
  c.pixelDepth = 0;
  c.layerCount = 0;
  c.faceCount = 1;
  c.supercompressionScheme = 0;
  c.levels = [
    {
      levelData: pixels,
      uncompressedByteLength: pixels.byteLength
    }
  ];
  return write(c);
}

function computeNormalFromHeight(heightFn) {
  const normalMap = new Uint8Array(WIDTH * HEIGHT * 4);
  const strength = 3.0;

  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const idx = (y * WIDTH + x) * 4;
      const left = heightFn((x - 1 + WIDTH) % WIDTH, y);
      const right = heightFn((x + 1) % WIDTH, y);
      const down = heightFn(x, (y - 1 + HEIGHT) % HEIGHT);
      const up = heightFn(x, (y + 1) % HEIGHT);

      const dx = (right - left) * strength;
      const dy = (up - down) * strength;
      const dz = 1.0;

      const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const nx = -dx / len;
      const ny = -dy / len;
      const nz = dz / len;

      normalMap[idx + 0] = Math.floor((nx * 0.5 + 0.5) * 255);
      normalMap[idx + 1] = Math.floor((ny * 0.5 + 0.5) * 255);
      normalMap[idx + 2] = Math.floor((nz * 0.5 + 0.5) * 255);
      normalMap[idx + 3] = 255;
    }
  }
  return normalMap;
}

// 1. Grass (Stylized Zelda/Journey Painterly Emerald & Sunlit Blades)
function generateGrass() {
  const albedo = new Uint8Array(WIDTH * HEIGHT * 4);
  const heightMap = (x, y) => {
    return fbm(x * 0.1, y * 0.1, 3) * 0.7 + hash(x, y) * 0.3;
  };

  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const idx = (y * WIDTH + x) * 4;
      const n = fbm(x * 0.04, y * 0.04, 4);
      const blades = fbm(x * 0.15, y * 0.15, 2);

      // Painterly palette: deep emerald green to vibrant warm golden lime
      const r = Math.floor((48 + n * 35 + blades * 20) * 1.0);
      const g = Math.floor((142 + n * 65 + blades * 30) * 1.0);
      const b = Math.floor((36 + n * 25 + blades * 15) * 1.0);

      albedo[idx + 0] = Math.min(255, r);
      albedo[idx + 1] = Math.min(255, g);
      albedo[idx + 2] = Math.min(255, b);
      albedo[idx + 3] = 255;
    }
  }

  const normal = computeNormalFromHeight(heightMap);
  return { albedo, normal };
}

// 2. Dirt (Warm Terracotta / Loam with Pebble Variations)
function generateDirt() {
  const albedo = new Uint8Array(WIDTH * HEIGHT * 4);
  const heightMap = (x, y) => {
    return fbm(x * 0.06, y * 0.06, 4) * 0.8 + hash(x, y) * 0.2;
  };

  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const idx = (y * WIDTH + x) * 4;
      const n = fbm(x * 0.05, y * 0.05, 4);
      const soil = fbm(x * 0.18, y * 0.18, 3);

      // Warm earthy brown / terracotta
      const r = Math.floor(138 + n * 45 + soil * 25);
      const g = Math.floor(92 + n * 35 + soil * 20);
      const b = Math.floor(54 + n * 22 + soil * 14);

      albedo[idx + 0] = Math.min(255, r);
      albedo[idx + 1] = Math.min(255, g);
      albedo[idx + 2] = Math.min(255, b);
      albedo[idx + 3] = 255;
    }
  }

  const normal = computeNormalFromHeight(heightMap);
  return { albedo, normal };
}

// 3. Rock (Sedimentary / Stratified Sandstone Cliff Face)
function generateRock() {
  const albedo = new Uint8Array(WIDTH * HEIGHT * 4);
  const heightMap = (x, y) => {
    // Stratified horizontal rock bands + rugged cracks
    const strata = Math.sin(y * 0.12 + fbm(x * 0.03, y * 0.03, 3) * 3.0);
    return (strata * 0.5 + 0.5) * 0.6 + fbm(x * 0.08, y * 0.08, 4) * 0.4;
  };

  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const idx = (y * WIDTH + x) * 4;
      const strata = Math.sin(y * 0.12 + fbm(x * 0.03, y * 0.03, 3) * 3.0) * 0.5 + 0.5;
      const crack = fbm(x * 0.07, y * 0.07, 4);

      // Warm desert rock / reddish sandstone
      const r = Math.floor(145 + strata * 35 + crack * 25);
      const g = Math.floor(118 + strata * 25 + crack * 20);
      const b = Math.floor(102 + strata * 18 + crack * 15);

      albedo[idx + 0] = Math.min(255, r);
      albedo[idx + 1] = Math.min(255, g);
      albedo[idx + 2] = Math.min(255, b);
      albedo[idx + 3] = 255;
    }
  }

  const normal = computeNormalFromHeight(heightMap);
  return { albedo, normal };
}

// 4. Sand (Soft Golden Dunes with Wind Ripples)
function generateSand() {
  const albedo = new Uint8Array(WIDTH * HEIGHT * 4);
  const heightMap = (x, y) => {
    const ripples = Math.sin(x * 0.15 + y * 0.08 + fbm(x * 0.03, y * 0.03, 2) * 2.0);
    return ripples * 0.4 + fbm(x * 0.05, y * 0.05, 3) * 0.6;
  };

  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const idx = (y * WIDTH + x) * 4;
      const ripples = Math.sin(x * 0.15 + y * 0.08 + fbm(x * 0.03, y * 0.03, 2) * 2.0) * 0.5 + 0.5;
      const n = fbm(x * 0.04, y * 0.04, 3);

      // Warm sunlit golden sand
      const r = Math.floor(218 + ripples * 18 + n * 14);
      const g = Math.floor(184 + ripples * 16 + n * 12);
      const b = Math.floor(132 + ripples * 14 + n * 10);

      albedo[idx + 0] = Math.min(255, r);
      albedo[idx + 1] = Math.min(255, g);
      albedo[idx + 2] = Math.min(255, b);
      albedo[idx + 3] = 255;
    }
  }

  const normal = computeNormalFromHeight(heightMap);
  return { albedo, normal };
}

console.log('Generating Stylized Terrain KTX2 Textures...');

const biomes = [
  { name: 'grass', gen: generateGrass },
  { name: 'dirt', gen: generateDirt },
  { name: 'rock', gen: generateRock },
  { name: 'sand', gen: generateSand }
];

for (const b of biomes) {
  const { albedo, normal } = b.gen();
  const albedoKTX = createKTX2(albedo, true);
  const normalKTX = createKTX2(normal, false);

  fs.writeFileSync(path.join(OUT_DIR, `${b.name}_diffuse.ktx2`), albedoKTX);
  fs.writeFileSync(path.join(OUT_DIR, `${b.name}_normal.ktx2`), normalKTX);
  console.log(`✓ Generated ${b.name}_diffuse.ktx2 & ${b.name}_normal.ktx2`);
}

console.log('All 8 KTX2 textures generated successfully!');

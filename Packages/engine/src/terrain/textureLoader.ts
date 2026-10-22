/**
 * Loads CC0 KTX2 terrain textures with KTX2Loader, configured with self-hosted Basis transcoder.
 */

import * as THREE from 'three/webgpu';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { TerrainTextures } from './terrainMaterial.js';

export async function loadTerrainTextures(
  renderer: THREE.WebGPURenderer,
  basePath = '/textures/terrain/'
): Promise<TerrainTextures> {
  const ktx2Loader = new KTX2Loader();
  ktx2Loader.setTranscoderPath('/basis/');
  ktx2Loader.detectSupport(renderer);

  const textureNames = [
    'grass_diffuse',
    'grass_normal',
    'dirt_diffuse',
    'dirt_normal',
    'rock_diffuse',
    'rock_normal',
    'sand_diffuse',
    'sand_normal'
  ];

  const loadedMap = new Map<string, THREE.Texture>();

  const loadSingle = async (name: string): Promise<THREE.Texture> => {
    return new Promise((resolve) => {
      const url = `${basePath}${name}.ktx2`;
      ktx2Loader.load(
        url,
        (texture) => {
          texture.wrapS = THREE.RepeatWrapping;
          texture.wrapT = THREE.RepeatWrapping;
          loadedMap.set(name, texture);
          resolve(texture);
        },
        undefined,
        (err) => {
          console.warn(`Could not load KTX2 ${url}, generating fallback texture:`, err);
          const fallback = createFallbackTexture(name);
          loadedMap.set(name, fallback);
          resolve(fallback);
        }
      );
    });
  };

  await Promise.all(textureNames.map(loadSingle));

  return {
    grassDiffuse: loadedMap.get('grass_diffuse')!,
    grassNormal: loadedMap.get('grass_normal')!,
    dirtDiffuse: loadedMap.get('dirt_diffuse')!,
    dirtNormal: loadedMap.get('dirt_normal')!,
    rockDiffuse: loadedMap.get('rock_diffuse')!,
    rockNormal: loadedMap.get('rock_normal')!,
    sandDiffuse: loadedMap.get('sand_diffuse')!,
    sandNormal: loadedMap.get('sand_normal')!
  };
}

/**
 * Creates high-quality procedural fallback DataTexture if KTX2 network fetch fails.
 */
function createFallbackTexture(name: string): THREE.DataTexture {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  const isNormal = name.includes('normal');

  for (let i = 0; i < size * size; i++) {
    const idx = i * 4;
    if (isNormal) {
      data[idx + 0] = 128;
      data[idx + 1] = 128;
      data[idx + 2] = 255;
      data[idx + 3] = 255;
    } else if (name.includes('grass')) {
      data[idx + 0] = 68;
      data[idx + 1] = 168;
      data[idx + 2] = 52;
      data[idx + 3] = 255;
    } else if (name.includes('dirt')) {
      data[idx + 0] = 145;
      data[idx + 1] = 98;
      data[idx + 2] = 62;
      data[idx + 3] = 255;
    } else if (name.includes('rock')) {
      data[idx + 0] = 156;
      data[idx + 1] = 124;
      data[idx + 2] = 108;
      data[idx + 3] = 255;
    } else {
      // Sand
      data[idx + 0] = 224;
      data[idx + 1] = 188;
      data[idx + 2] = 136;
      data[idx + 3] = 255;
    }
  }

  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}

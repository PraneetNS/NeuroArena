#!/usr/bin/env node
/**
 * Static Asset Pre-Compression Script for Production Deployments.
 * Pre-generates .br (Brotli quality 11) and .gz (Gzip level 9) files
 * alongside static assets in apps/game/dist for CDNs and static hosts.
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const targetDir = path.resolve(__dirname, '../apps/game/dist');

if (!fs.existsSync(targetDir)) {
  console.error(`[Precompress] Target directory does not exist: ${targetDir}`);
  process.exit(1);
}

const compressibleExtensions = new Set([
  '.js',
  '.css',
  '.html',
  '.json',
  '.bin',
  '.wasm',
  '.glb',
  '.ktx2',
  '.txt',
  '.svg'
]);

function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);

  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getAllFiles(fullPath, arrayOfFiles);
    } else {
      arrayOfFiles.push(fullPath);
    }
  }

  return arrayOfFiles;
}

const allFiles = getAllFiles(targetDir);
let totalRaw = 0;
let totalGz = 0;
let totalBr = 0;
let fileCount = 0;

console.log('[Precompress] Pre-compressing production assets with Brotli & Gzip...');

for (const filePath of allFiles) {
  const ext = path.extname(filePath).toLowerCase();
  if (!compressibleExtensions.has(ext)) continue;
  if (filePath.endsWith('.br') || filePath.endsWith('.gz')) continue;

  const rawData = fs.readFileSync(filePath);
  const rawSize = rawData.length;

  // 1. Brotli Compression (Quality 11)
  const brData = zlib.brotliCompressSync(rawData, {
    params: {
      [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_GENERIC,
      [zlib.constants.BROTLI_PARAM_QUALITY]: 11
    }
  });
  fs.writeFileSync(`${filePath}.br`, brData);

  // 2. Gzip Compression (Level 9)
  const gzData = zlib.gzipSync(rawData, { level: 9 });
  fs.writeFileSync(`${filePath}.gz`, gzData);

  totalRaw += rawSize;
  totalGz += gzData.length;
  totalBr += brData.length;
  fileCount++;
}

console.log(`[Precompress] Successfully compressed ${fileCount} assets:`);
console.log(`  Raw Total:    ${(totalRaw / 1024 / 1024).toFixed(2)} MB (${totalRaw.toLocaleString()} bytes)`);
console.log(`  Gzip Total:   ${(totalGz / 1024 / 1024).toFixed(2)} MB (${totalGz.toLocaleString()} bytes) - ${(((totalRaw - totalGz) / totalRaw) * 100).toFixed(1)}% reduction`);
console.log(`  Brotli Total: ${(totalBr / 1024 / 1024).toFixed(2)} MB (${totalBr.toLocaleString()} bytes) - ${(((totalRaw - totalBr) / totalRaw) * 100).toFixed(1)}% reduction`);

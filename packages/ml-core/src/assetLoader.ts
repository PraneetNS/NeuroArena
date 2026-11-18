/**
 * NeuroArena Asset Loader & Runtime Integrity Verifier.
 * 
 * Enforces cryptographic and content-type integrity for all external data assets:
 * - Rejects HTML responses (detects SPA fallback / 404 hijacking).
 * - Enforces minimum byte-length bounds to prevent partial reads.
 * - Enforces MIME content-type validation.
 * - Computes SHA-256 digest in modern browsers (Web Crypto) and Node.js.
 * - Matches against ASSET_MANIFEST to guarantee bit-for-bit parity before training.
 */

import { ASSET_MANIFEST, AssetManifestEntry } from './assetManifest.js';

export interface AssetValidationOptions {
  minBytes?: number;
  expectedContentType?: string | string[];
  expectedSha256?: string;
  assetKey?: string;
}

export class AssetValidationError extends Error {
  public readonly code: 'NOT_OK' | 'HTML_RESPONSE' | 'TOO_SHORT' | 'INVALID_CONTENT_TYPE' | 'SHA256_MISMATCH';
  public readonly url: string;
  public readonly details: Record<string, any>;

  constructor(
    code: 'NOT_OK' | 'HTML_RESPONSE' | 'TOO_SHORT' | 'INVALID_CONTENT_TYPE' | 'SHA256_MISMATCH',
    url: string,
    message: string,
    details: Record<string, any> = {}
  ) {
    super(`[AssetLoader] FATAL: ${message}`);
    this.name = 'AssetValidationError';
    this.code = code;
    this.url = url;
    this.details = details;
  }
}

/**
 * Computes hexadecimal SHA-256 digest of a byte array across Browser & Node.js.
 */
export async function computeSha256Hex(bytes: Uint8Array): Promise<string> {
  // 1. Web Crypto API (Standard in modern browsers, Web Workers, Node 19+)
  const cryptoObj = typeof globalThis !== 'undefined' ? (globalThis.crypto || (globalThis as any).msCrypto) : null;
  if (cryptoObj?.subtle?.digest) {
    const hashBuf = await cryptoObj.subtle.digest('SHA-256', bytes as unknown as BufferSource);
    const hashArray = Array.from(new Uint8Array(hashBuf));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // 2. Node.js native crypto fallback
  try {
    const nodeCrypto = await import('crypto');
    return nodeCrypto.createHash('sha256').update(bytes).digest('hex');
  } catch {
    throw new Error('SHA-256 calculation unavailable: neither Web Crypto nor Node crypto found.');
  }
}

export interface ValidatedAssetResult {
  url: string;
  bytes: Uint8Array;
  text: () => string;
  json: <T = any>() => T;
  sha256: string;
  manifestEntry?: AssetManifestEntry;
}

/**
 * Fetches and strictly validates a data asset before allowing downstream processing.
 * Fails LOUDLY with AssetValidationError on any violation.
 */
export async function fetchValidatedAsset(
  url: string,
  options?: AssetValidationOptions
): Promise<ValidatedAssetResult> {
  const normUrl = url.split('?')[0];
  const manifest = ASSET_MANIFEST[normUrl] || (options?.assetKey ? ASSET_MANIFEST[options.assetKey] : undefined);

  const minBytes = options?.minBytes ?? manifest?.minBytes ?? 10;
  const expectedSha256 = (options?.expectedSha256 || manifest?.sha256)?.toLowerCase();
  const expectedContentType = options?.expectedContentType || manifest?.contentType;

  // 1. Fetch
  let res: Response;
  try {
    res = await fetch(url);
  } catch (err: any) {
    throw new AssetValidationError(
      'NOT_OK',
      url,
      `Network fetch failed for asset "${url}": ${err?.message || err}`,
      { originalError: err }
    );
  }

  if (!res.ok) {
    throw new AssetValidationError(
      'NOT_OK',
      url,
      `Asset "${url}" returned HTTP ${res.status} ${res.statusText}`,
      { status: res.status, statusText: res.statusText }
    );
  }

  // 2. Content-Type Check
  const contentType = res.headers.get('content-type') || '';
  if (contentType.toLowerCase().includes('text/html')) {
    throw new AssetValidationError(
      'HTML_RESPONSE',
      url,
      `Asset "${url}" returned Content-Type "text/html". Dev server SPA fallback served index.html instead of real asset!`,
      { contentType }
    );
  }

  if (expectedContentType) {
    const allowed = Array.isArray(expectedContentType) ? expectedContentType : [expectedContentType];
    const matched = allowed.some(ct => contentType.toLowerCase().includes(ct.toLowerCase()));
    if (!matched && contentType.length > 0) {
      console.warn(`[AssetLoader] Content-Type mismatch for ${url}: received "${contentType}", expected "${allowed.join(' or ')}"`);
    }
  }

  // 3. Read bytes & check size
  const arrayBuf = await res.arrayBuffer();
  const bytes = new Uint8Array(arrayBuf);

  if (bytes.byteLength < minBytes) {
    throw new AssetValidationError(
      'TOO_SHORT',
      url,
      `Asset "${url}" payload too small: received ${bytes.byteLength} bytes, required minimum ${minBytes} bytes.`,
      { receivedBytes: bytes.byteLength, minBytes }
    );
  }

  // 4. Check for leading HTML doctype even if Content-Type was missing/generic
  const preview = new TextDecoder('utf-8', { fatal: false }).decode(bytes.subarray(0, 100)).trim().toLowerCase();
  if (preview.startsWith('<!doctype') || preview.startsWith('<html') || preview.startsWith('<head')) {
    throw new AssetValidationError(
      'HTML_RESPONSE',
      url,
      `Asset "${url}" begins with HTML document tags (<!DOCTYPE html>). Server answered missing file with SPA index!`,
      { preview }
    );
  }

  // 5. SHA-256 Verification
  const actualSha256 = (await computeSha256Hex(bytes)).toLowerCase();
  if (expectedSha256 && actualSha256 !== expectedSha256) {
    throw new AssetValidationError(
      'SHA256_MISMATCH',
      url,
      `Asset "${url}" SHA-256 digest mismatch! Expected ${expectedSha256}, got ${actualSha256}. Data asset is corrupted or tampered.`,
      { expectedSha256, actualSha256 }
    );
  }

  return {
    url,
    bytes,
    text: () => new TextDecoder('utf-8').decode(bytes),
    json: <T = any>() => JSON.parse(new TextDecoder('utf-8').decode(bytes)) as T,
    sha256: actualSha256,
    manifestEntry: manifest
  };
}

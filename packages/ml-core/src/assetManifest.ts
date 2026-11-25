/**
 * Build-time Asset Integrity Manifest.
 * 
 * Contains SHA-256 digests, size bounds, and expected MIME types for all
 * critical training datasets, tokenizers, and model checkpoint weights.
 */

export interface AssetManifestEntry {
  path: string;
  bytes: number;
  minBytes: number;
  sha256: string;
  contentType: string;
  description: string;
}

export const ASSET_MANIFEST: Record<string, AssetManifestEntry> = {
  '/shakespeare.txt': {
    path: '/shakespeare.txt',
    bytes: 5422619,
    minBytes: 5000000,
    sha256: '0a7fc75eba9b3a188da3d5dc6f2f50847453d4725504be78c5bc1cb6a57d4132',
    contentType: 'text/plain',
    description: 'Complete Works of William Shakespeare (Project Gutenberg #100 stripped corpus)'
  },
  '/assets/elder_preset_s.bin': {
    path: '/assets/elder_preset_s.bin',
    bytes: 1881993,
    minBytes: 1500000,
    sha256: 'c878628647b375948998c35531c101bff9e4d6ace64f81af3afda34ae4046cdc',
    contentType: 'application/octet-stream',
    description: 'The Elder 12,000-step trained checkpoint binary (FP16 weights + NACP header)'
  },
  '/data/bpe_1024.json': {
    path: '/data/bpe_1024.json',
    bytes: 34361,
    minBytes: 25000,
    sha256: '5f63788d1f7b412b9a224be47e62643e3aeec17f53d6cd4f930470046b08007d',
    contentType: 'application/json',
    description: 'Pretrained ByteBPE-1024 Vocabulary and Merge Tables (bpe1024-v2)'
  }
};

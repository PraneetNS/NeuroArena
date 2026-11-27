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
    bytes: 1881992,
    minBytes: 1500000,
    sha256: 'c0ca1f442eac3277fb72c9c7b18803e97b8268c80584d1cb194db73605e8f6d6',
    contentType: 'application/octet-stream',
    description: 'The Elder 12,000-step trained checkpoint binary (bpe1024-v2 FP16 weights + NACP header)'
  },
  '/assets/elder_austen_tuned.bin': {
    path: '/assets/elder_austen_tuned.bin',
    bytes: 1881942,
    minBytes: 1500000,
    sha256: '00a02d12347f5ed42c010ace17ec3c0361db4a2420b410a74d8847cdace62f29',
    contentType: 'application/octet-stream',
    description: 'The Elder Austen domain-adapted checkpoint binary (bpe1024-v2 FP16 weights + NACP header)'
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

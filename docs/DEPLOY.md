# NeuroArena Production Deployment Guide

This guide details the exact procedures, configuration, and verification steps for deploying NeuroArena to Vercel (or any static hosting platform supporting custom HTTP headers).

---

## 1. Architectural Requirements

NeuroArena executes real-time WebGPU deep learning compute shaders and multi-threaded Web Workers with shared memory. For the game to operate in production:

1. **Cross-Origin Isolation**: Both `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` must be delivered on all HTML document and asset responses. This unlocks `SharedArrayBuffer` and high-resolution timer access required for worker coordination.
2. **Correct MIME Types**:
   - WebAssembly binaries: `application/wasm` (`.wasm`)
   - Model parameter checkpoints: `application/octet-stream` (`.bin`)
   - 3D glTF Models: `model/gltf-binary` (`.glb`)
   - Basis Universal KTX2 Textures: `image/ktx2` (`.ktx2`)
   - Tokenizer & JSON Schemas: `application/json` (`.json`)
3. **Immutable Caching for Content-Hashed Assets**: Files in `/assets/*` receive `Cache-Control: public, max-age=31536000, immutable`.
4. **Strict 404 Handling**: Missing static files with file extensions must return HTTP 404, while clean client routes (`/`, `/bench`, `/curator`, `/lab`) rewrite to `/index.html`.

---

## 2. Vercel Configuration (`vercel.json`)

The repository includes a root `vercel.json` configured as follows:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "cleanUrls": true,
  "outputDirectory": "apps/game/dist",
  "buildCommand": "pnpm run build",
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" },
        { "key": "Cross-Origin-Embedder-Policy", "value": "require-corp" }
      ]
    },
    {
      "source": "/assets/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    },
    {
      "source": "/(.*)\\.bin",
      "headers": [
        { "key": "Content-Type", "value": "application/octet-stream" },
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    },
    {
      "source": "/(.*)\\.wasm",
      "headers": [
        { "key": "Content-Type", "value": "application/wasm" },
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    },
    {
      "source": "/(.*)\\.ktx2",
      "headers": [
        { "key": "Content-Type", "value": "image/ktx2" },
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    },
    {
      "source": "/(.*)\\.glb",
      "headers": [
        { "key": "Content-Type", "value": "model/gltf-binary" },
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    },
    {
      "source": "/(.*)\\.json",
      "headers": [
        { "key": "Content-Type", "value": "application/json" },
        { "key": "Cache-Control", "value": "public, max-age=3600" }
      ]
    },
    {
      "source": "/(.*)\\.gz",
      "headers": [
        { "key": "Content-Type", "value": "application/gzip" }
      ]
    }
  ],
  "rewrites": [
    {
      "source": "/((?!.*\\.[^/]+$).*)",
      "destination": "/index.html"
    }
  ]
}
```

---

## 3. Step-by-Step Deployment Commands

### Option A: Deploying via Vercel CLI

1. **Install Vercel CLI**:
   ```bash
   pnpm add -g vercel
   ```

2. **Authenticate with Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy Preview Build**:
   ```bash
   vercel
   ```
   *When prompted*:
   - Set up and deploy `.`? **Yes**
   - Which scope? **Select your team/account**
   - Link to existing project? **No**
   - Project name: `neuroarena`
   - In which directory is your code located? `./`
   - Want to modify settings? **No** (detected from `vercel.json`).

4. **Deploy to Production**:
   ```bash
   vercel --prod
   ```

---

### Option B: Deploying via GitHub Git Integration

1. Push your repository branch to GitHub (`git push origin main`).
2. Log into [vercel.com](https://vercel.com) and click **"Add New Project"**.
3. Import the `NeuroArena` repository.
4. Set Project Configuration:
   - **Framework Preset**: `Vite` (or `Other`)
   - **Root Directory**: `./` (leave default)
   - **Build Command**: `pnpm run build`
   - **Output Directory**: `apps/game/dist`
   - **Install Command**: `pnpm install`
5. Click **"Deploy"**.

---

## 4. Local Preview Server Verification

To verify the production build locally with exact production HTTP headers and routing:

```bash
# 1. Build all packages and precompress assets
pnpm run build

# 2. Launch Vite production preview server
pnpm --filter @na/game preview
```

### Verification Commands (`curl` inspection)

Open a terminal and verify response headers:

```bash
# Verify Root HTML (must have COOP, COEP, and text/html)
curl -I http://localhost:3000/

# Verify Hashed JS Asset (must have immutable long-cache)
curl -I http://localhost:3000/assets/index-DEcfccW_.js

# Verify Binary Checkpoint (must have application/octet-stream)
curl -I http://localhost:3000/assets/elder_austen_tuned.bin

# Verify Missing Asset Returns Strict 404 (does NOT rewrite to index.html)
curl -I http://localhost:3000/nonexistent_file.bin
```

Expected output for missing file:
```http
HTTP/1.1 404 Not Found
Content-Type: text/plain
```

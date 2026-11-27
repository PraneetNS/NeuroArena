import { defineConfig } from 'vite';
import path from 'path';
import fs from 'fs';
import react from '@vitejs/plugin-react';

function strictStatic404Plugin() {
  return {
    name: 'strict-static-404',
    configureServer(server: any) {
      server.middlewares.use((req: any, res: any, next: any) => {
        const rawUrl = (req.url || '').split('?')[0];
        const match = rawUrl.match(/\.([a-zA-Z0-9_-]+)$/);
        if (match) {
          const ext = match[1].toLowerCase();
          if (ext !== 'html' && ext !== 'htm' && !rawUrl.startsWith('/@') && !rawUrl.startsWith('/node_modules')) {
            const publicPath = path.resolve(__dirname, 'public', '.' + rawUrl);
            const rootPath = path.resolve(__dirname, '.' + rawUrl);
            if (!fs.existsSync(publicPath) && !fs.existsSync(rootPath)) {
              res.statusCode = 404;
              res.setHeader('Content-Type', 'text/plain');
              res.end(`404 Not Found: Static asset ${rawUrl} does not exist`);
              return;
            }
          }
        }
        next();
      });
    },
    configurePreviewServer(server: any) {
      server.middlewares.use((req: any, res: any, next: any) => {
        const rawUrl = (req.url || '').split('?')[0];
        if (rawUrl.startsWith('/assets/')) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
        const match = rawUrl.match(/\.([a-zA-Z0-9_-]+)$/);
        if (match) {
          const ext = match[1].toLowerCase();
          if (ext !== 'html' && ext !== 'htm') {
            const distPath = path.resolve(__dirname, 'dist', '.' + rawUrl);
            if (!fs.existsSync(distPath)) {
              res.statusCode = 404;
              res.setHeader('Content-Type', 'text/plain');
              res.end(`404 Not Found: Static asset ${rawUrl} does not exist`);
              return;
            }
            if (ext === 'bin') res.setHeader('Content-Type', 'application/octet-stream');
            else if (ext === 'wasm') res.setHeader('Content-Type', 'application/wasm');
            else if (ext === 'ktx2') res.setHeader('Content-Type', 'image/ktx2');
            else if (ext === 'glb') res.setHeader('Content-Type', 'model/gltf-binary');
            else if (ext === 'json') res.setHeader('Content-Type', 'application/json');
            else if (ext === 'gz') res.setHeader('Content-Type', 'application/gzip');
            else if (ext === 'br') res.setHeader('Content-Type', 'application/octet-stream');
          }
        }
        next();
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), strictStatic404Plugin()],

  server: {
    port: 3000,
    open: false,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    }
  },
  preview: {
    port: 3000,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    }
  },
  resolve: {
    dedupe: ['three'],
    alias: {
      '@na/ml-core': path.resolve(__dirname, '../../packages/ml-core/src'),
      '@nа/ml-core': path.resolve(__dirname, '../../packages/ml-core/src'),
      '@na/engine': path.resolve(__dirname, '../../packages/engine/src'),
      '@na/ui/styles': path.resolve(__dirname, '../../packages/ui/src/styles/theme.css'),
      '@na/ui': path.resolve(__dirname, '../../packages/ui/src')
    }
  },
  build: {
    target: 'esnext'
  }
});

import { defineConfig } from 'vite';
import path from 'path';
import fs from 'fs';

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
    }
  };
}

export default defineConfig({
  plugins: [
    strictStatic404Plugin(),
    {
      name: 'wgsl-raw-loader',
      transform(code, id) {
        if (id.endsWith('.wgsl')) {
          return {
            code: `export default ${JSON.stringify(code)};`,
            map: { mappings: '' }
          };
        }
      }
    }
  ],
  server: {
    port: 3001,
    open: false,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    }
  },
  preview: {
    port: 3001,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    }
  },
  resolve: {
    alias: {
      '@na/ml-core': path.resolve(__dirname, '../../packages/ml-core/src'),
      '@nа/ml-core': path.resolve(__dirname, '../../packages/ml-core/src'),
      '@na/ui/styles': path.resolve(__dirname, '../../packages/ui/src/styles/theme.css'),
      '@na/ui': path.resolve(__dirname, '../../packages/ui/src')
    }
  },
  build: {
    target: 'esnext'
  }
});

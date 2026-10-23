import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  plugins: [
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

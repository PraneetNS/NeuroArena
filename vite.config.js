import { defineConfig } from 'vite';

export default defineConfig({
  root: './',
  server: {
    port: 5173,
    host: true,
    open: false
  },
  worker: {
    format: 'es'
  },
  build: {
    target: 'esnext',
    outDir: 'dist',
    assetsInlineLimit: 0,
    rollupOptions: {
      input: {
        main: './index.html',
        mlSandbox: './src/dev/mlSandbox.html'
      }
    }
  }
});

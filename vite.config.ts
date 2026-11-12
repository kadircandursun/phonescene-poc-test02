import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
  root: path.resolve('client'),
  publicDir: false,
  build: {
    outDir: path.resolve('dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        companion: path.resolve('client/companion/index.html'),
        mobile: path.resolve('client/mobile/index.html'),
        desktop: path.resolve('client/desktop/index.html'),
      },
    },
    chunkSizeWarningLimit: 1500,
  },
  optimizeDeps: {
    exclude: ['onnxruntime-web'],
  },
  server: {
    middlewareMode: true,
    // Cloudflare Quick Tunnel / localtunnel hostnames must be accepted in dev.
    allowedHosts: true,
  },
});

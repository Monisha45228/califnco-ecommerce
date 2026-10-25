import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // The shared Firebase SDK is ~550 KB minified but ~165 KB gzip; splitting it creates circular chunks.
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('/node_modules/')) return;
          if (id.includes('/node_modules/@firebase/') || id.includes('/node_modules/firebase/')) return 'firebase-vendor';
          if (id.includes('/node_modules/leaflet/')) return 'maps';
          if (id.includes('/node_modules/react/') || id.includes('/node_modules/react-dom/')) return 'react-vendor';
        }
      }
    }
  },
  server: {
    port: 3001,
    open: false
  }
});

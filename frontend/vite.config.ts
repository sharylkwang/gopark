import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  envDir: '.',
  plugins: [react(), tailwindcss()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'react-vendor', test: /node_modules[\/](react|react-dom|scheduler)[\/]/ },
            { name: 'leaflet-vendor', test: /node_modules[\/](leaflet|react-leaflet|leaflet\.markercluster)[\/]/ },
            { name: 'icons', test: /node_modules[\/]lucide-react[\/]/ },
          ],
        },
      },
    },
  },
  server: {
    host: true,
    port: 5173,
    watch: { usePolling: true },
    allowedHosts: ['gopark.pengu.app'],
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});

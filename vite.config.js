import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3200,
    // In development, /api calls go to your live Vercel deployment.
    proxy: { '/api': { target: process.env.VITE_DEV_API || 'https://localhost:3000', changeOrigin: true, secure: false } },
  },
  build: { outDir: 'dist', sourcemap: false },
});

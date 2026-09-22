import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react-swc';
import { fileURLToPath, URL } from 'node:url';

// https://vite.dev/config/
export default defineConfig({
  server: {
    allowedHosts: ['.trycloudflare.com'],
  },
  base: '/', // Vercel root에 배포
  build: {
    assetsInlineLimit: 0,
    // esbuild minification exits unexpectedly on the Windows kiosk build.
    // The kiosk is served locally, so a deterministic unminified bundle is preferable.
    minify: false,
    emptyOutDir: false,
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
      {
        find: '@components',
        replacement: fileURLToPath(new URL('./src/components', import.meta.url)),
      },
    ],
  },
  preview: {
    port: 3000, // <-- 여기서 포트를 지정
  },
});

import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path'; // Import the 'path' module

// https://vite.dev/config/
export default defineConfig({
  base: '/', // Vercel root에 배포
  build: {
    assetsInlineLimit: 0,
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      { find: '@', replacement: path.resolve(__dirname, 'src') },
      {
        find: '@components',
        replacement: path.resolve(__dirname, 'src/components'),
      },
    ],
  },
  preview: {
    port: 3000, // <-- 여기서 포트를 지정
  },
});


import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // 讓瀏覽器端能識別 process.env 語法，這是 Vite 專案使用 process.env 的標準做法
    'process.env': process.env
  },
  server: {
    port: 3000
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
});

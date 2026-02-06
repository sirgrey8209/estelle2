import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // 빌드된 dist 사용 (소스의 .js 확장자 문제 회피)
      '@estelle/core': path.resolve(__dirname, '../core/dist'),
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: '../relay/public',
    emptyOutDir: true,
    sourcemap: true,
  },
  server: {
    port: 5173,
    host: true,
  },
  preview: {
    port: 4173,
  },
});

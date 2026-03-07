import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import fs from 'fs';

/** 빌드 시점에 버전 읽기 */
function getVersion(): string {
  try {
    const versionPath = path.resolve(__dirname, '../../config/version.json');
    const data = JSON.parse(fs.readFileSync(versionPath, 'utf-8'));
    return data.version;
  } catch {
    return 'dev';
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        id: '/relay/',
        name: 'Estelle',
        short_name: 'Estelle',
        description: 'Claude Code Remote Controller',
        lang: 'ko',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/relay/',
        start_url: '/relay/',
        icons: [
          {
            src: '/relay/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/relay/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/relay/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        categories: ['utilities', 'developer tools'],
      },
      workbox: {
        // 앱 쉘만 최소 캐싱 (WebSocket 앱이라 오프라인 의미 없음)
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // 새 SW 즉시 활성화 (대기 상태 건너뜀)
        skipWaiting: true,
        clientsClaim: true,
      },
    }),
  ],
  resolve: {
    alias: {
      // 빌드된 dist 사용 (소스의 .js 확장자 문제 회피)
      '@estelle/core': path.resolve(__dirname, '../core/dist'),
      '@': path.resolve(__dirname, './src'),
    },
  },
  base: '/relay/',
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
  define: {
    __ESTELLE_VERSION__: JSON.stringify(getVersion()),
  },
});

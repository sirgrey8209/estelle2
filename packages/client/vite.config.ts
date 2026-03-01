import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import fs from 'fs';

/** 빌드 후 version.json 생성 플러그인 */
function versionJsonPlugin() {
  return {
    name: 'version-json',
    closeBundle() {
      const outDir = path.resolve(__dirname, '../relay/public');
      const env = process.env.ESTELLE_BUILD_ENV || 'release';
      fs.writeFileSync(
        path.join(outDir, 'version.json'),
        JSON.stringify({ env, version: '', buildTime: new Date().toISOString() })
      );
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        id: '/',
        name: 'Estelle',
        short_name: 'Estelle',
        description: 'Claude Code Remote Controller',
        lang: 'ko',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
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
        // /hub는 서버에서 별도 서빙하는 Dev Hub 대시보드이므로 SPA fallback 제외
        navigateFallbackDenylist: [/^\/hub/],
      },
    }),
    versionJsonPlugin(),
  ],
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

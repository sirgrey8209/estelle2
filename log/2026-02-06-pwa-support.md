# PWA 지원 추가

## 상태
⏸️ 보류 (아이콘 준비 필요)

## 구현 목표
`vite-plugin-pwa`를 사용하여 Estelle 클라이언트에 PWA 지원 추가.
안드로이드에서 주소표시줄 없이 앱처럼 실행되도록 함.

## 구현 방향

### 1. 의존성 추가
```bash
pnpm --filter @estelle/client add -D vite-plugin-pwa
```

### 2. vite.config.ts 수정
```typescript
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Estelle',
        short_name: 'Estelle',
        description: 'Claude Code Remote Controller',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  // ... 기존 설정
});
```

### 3. 아이콘 파일 준비
- `packages/client/public/pwa-192x192.png`
- `packages/client/public/pwa-512x512.png`

## 영향 범위
- 수정: `packages/client/vite.config.ts`, `packages/client/package.json`
- 신규: `packages/client/public/pwa-*.png`

## TODO
- [ ] 아이콘 이미지 준비
- [ ] vite-plugin-pwa 설치
- [ ] vite.config.ts 설정
- [ ] 빌드 및 테스트
- [ ] 안드로이드에서 PWA 설치 확인

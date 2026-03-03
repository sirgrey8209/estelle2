# Caddy 중심 Hub 라우팅 재설계

## 배경

현재 구조에서 여러 문제가 있음:
- `serve`에 `-s` 옵션 미적용 → F5 새로고침 시 404/원본 페이지 연결
- 두 도메인(`estelle-hub.mooo.com`, `hub.estelle-hub.mooo.com`)에 동일 라우팅 중복
- PWA scope가 `/`로 설정되어 다른 프로젝트와 충돌
- 프로젝트 추가 시 PM2 + Caddy 양쪽 모두 수정 필요

## 설계

### 아키텍처

```
estelle-hub.mooo.com (Caddy)
├── /relay/*              → localhost:8080 (Relay PWA + WebSocket)
├── /hub                  → localhost:8080 (Hub 대시보드, 유지)
├── /voxel-engine/*       → Caddy file_server (/home/estelle/voxel-engine/dist)
├── /neon-grid-defense/*  → Caddy file_server (/home/estelle/web-td)
├── /eb-navigation/*      → Caddy file_server (/home/estelle/eb-navigation-web/dist)
└── /                     → /relay/ redirect
```

`hub.estelle-hub.mooo.com` 도메인은 삭제.

### 변경 사항

#### 1. Caddyfile

단일 도메인으로 통합. 프로젝트별 `file_server` + `try_files`로 SPA fallback 처리.

```caddyfile
estelle-hub.mooo.com {
    handle /relay/* {
        uri strip_prefix /relay
        reverse_proxy localhost:8080
    }

    handle /hub* {
        reverse_proxy localhost:8080
    }

    handle /voxel-engine/* {
        uri strip_prefix /voxel-engine
        root * /home/estelle/voxel-engine/dist
        try_files {path} /index.html
        file_server
    }

    handle /neon-grid-defense/* {
        uri strip_prefix /neon-grid-defense
        root * /home/estelle/web-td
        try_files {path} /index.html
        file_server
    }

    handle /eb-navigation/* {
        uri strip_prefix /eb-navigation
        root * /home/estelle/eb-navigation-web/dist
        try_files {path} /index.html
        file_server
    }

    handle {
        redir / /relay/ permanent
    }
}
```

#### 2. PM2 — 정적 serve 프로세스 제거

삭제 대상:
- `voxel-engine` (id: 3)
- `neon-grid-defense` (id: 14)
- `eb-navigation` (id: 0)

#### 3. Relay PWA — scope 변경

**`vite.config.ts`:**
- `id: '/'` → `id: '/relay/'`
- `start_url: '/'` → `start_url: '/relay/'`
- `scope: '/relay/'` 추가
- `navigateFallbackDenylist` 제거

**`App.tsx`:**
- `HubRedirect` 컴포넌트 삭제
- `/hub` 라우트 삭제

#### 4. Hub 임베드 — 설정 메뉴 내 프로젝트 목록

**`AccountSection.tsx`:**
- "Hub 열기" 버튼 → 프로젝트 링크 목록 (Card 형태)
- 프로젝트 데이터는 빌드 시 `hub-routes.json`에서 주입 또는 하드코딩
- 클릭 시 삼성 인터넷 Intent로 열기 (기존 방식 유지)

UI:
```
┌─────────────────────────┐
│ 📦 프로젝트              │
│  Neon Grid Defense    › │
│  EB Navigation        › │
│  Voxel Engine         › │
└─────────────────────────┘
```

#### 5. hub-routes.json — URL 통일

모든 URL을 `https://estelle-hub.mooo.com/<project>/` 형태로 변경.

#### 6. static.ts — Hub 대시보드

`generateHubDashboard`는 유지 (직접 접근 용도). URL만 갱신됨.

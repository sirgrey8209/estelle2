# Caddy 중심 Hub 라우팅 재설계 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Caddy가 정적 프로젝트를 직접 서빙하고, Relay를 `/relay/` 경로로 이동하여 PWA scope 충돌과 F5 새로고침 문제를 근본적으로 해결

**Architecture:** Caddy가 단일 도메인에서 모든 라우팅 담당. 정적 프로젝트는 `file_server` + `try_files`로 SPA fallback 포함 직접 서빙. Relay(PWA + WebSocket)는 `/relay/*` 하위 경로로 이동. PM2의 정적 serve 프로세스 3개 제거.

**Tech Stack:** Caddy, PM2, Vite + vite-plugin-pwa, React Router

---

### Task 1: hub-routes.json URL 통일

**Files:**
- Modify: `config/hub-routes.json`

**Step 1: URL을 단일 도메인 경로로 변경**

```json
{
  "projects": [
    {
      "name": "Neon Grid Defense",
      "path": "/projects/web-td",
      "port": 3004,
      "url": "https://estelle-hub.mooo.com/neon-grid-defense/",
      "description": "Three.js 기반 네온 스타일 타워 디펜스 게임"
    },
    {
      "name": "EB Navigation",
      "path": "/projects/eb-navigation-web",
      "port": 3002,
      "url": "https://estelle-hub.mooo.com/eb-navigation/",
      "description": "Flow Field 기반 군중 시뮬레이션 (1000+ 에이전트)"
    },
    {
      "name": "Voxel Engine",
      "path": "/projects/voxel-engine",
      "port": 3003,
      "url": "https://estelle-hub.mooo.com/voxel-engine/",
      "description": "WebGPU 기반 복셀 게임 엔진 (마인크래프트 스타일)"
    }
  ]
}
```

변경점: `hub.estelle-hub.mooo.com` → `estelle-hub.mooo.com`

**Step 2: Commit**

```bash
git add config/hub-routes.json
git commit -m "chore: unify hub-routes URLs to single domain"
```

---

### Task 2: Relay PWA scope를 /relay/로 변경

**Files:**
- Modify: `packages/client/vite.config.ts:28-64`
- Modify: `packages/client/src/App.tsx:191-214`

**Step 1: vite.config.ts — PWA manifest scope 변경**

`packages/client/vite.config.ts`에서:

```typescript
// 변경 전
manifest: {
  id: '/',
  // ...
  start_url: '/',
  // ...
},
workbox: {
  globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
  navigateFallbackDenylist: [/^\/hub/],
},

// 변경 후
manifest: {
  id: '/relay/',
  // ...
  scope: '/relay/',
  start_url: '/relay/',
  // ...
},
workbox: {
  globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
},
```

아이콘 경로도 변경:
- `src: '/pwa-192x192.png'` → `src: '/relay/pwa-192x192.png'`
- `src: '/pwa-512x512.png'` → `src: '/relay/pwa-512x512.png'`

**Step 2: App.tsx — HubRedirect 삭제**

`packages/client/src/App.tsx`에서 HubRedirect 컴포넌트와 /hub 라우트를 삭제:

```typescript
// 삭제할 부분 (191-200행)
// function HubRedirect() { ... }

// 변경 전
<Routes>
  <Route path="/" element={<HomePage />} />
  <Route path="/share/:shareId" element={<SharePage />} />
  <Route path="/hub" element={<HubRedirect />} />
</Routes>

// 변경 후
<Routes>
  <Route path="/" element={<HomePage />} />
  <Route path="/share/:shareId" element={<SharePage />} />
</Routes>
```

`Navigate` import도 사용하지 않으면 제거.

**Step 3: config.ts — WebSocket URL에 /relay 경로 추가 확인**

`packages/client/src/utils/config.ts`의 `deriveRelayUrl()`:

현재 `wss://{host}` 반환 → Caddy가 `/relay/*` 경로를 strip_prefix 후 localhost:8080으로 전달하므로, 클라이언트의 WS 연결은 `wss://estelle-hub.mooo.com/relay/` 경로로 연결해야 함.

하지만 Relay 서버에서 WS는 HTTP 업그레이드로 작동하므로, Caddy의 `handle /relay/*` 블록이 WebSocket 업그레이드도 자동 처리함. 따라서 클라이언트 WS URL을 변경해야 함:

```typescript
// 변경 전
return `${protocol}//${window.location.host}`;

// 변경 후
return `${protocol}//${window.location.host}/relay`;
```

localhost 개발 환경은 그대로 유지.

**Step 4: Commit**

```bash
git add packages/client/vite.config.ts packages/client/src/App.tsx packages/client/src/utils/config.ts
git commit -m "feat: move Relay PWA to /relay/ scope"
```

---

### Task 3: 설정 메뉴에 프로젝트 목록 임베드

**Files:**
- Modify: `packages/client/src/components/settings/AccountSection.tsx:101-114`

**Step 1: Hub 열기 버튼을 프로젝트 링크 목록으로 교체**

`AccountSection.tsx`의 하단 "Hub 열기" 버튼 (101-114행)을 프로젝트 목록으로 교체:

```tsx
// 프로젝트 목록 데이터
const hubProjects = [
  { name: 'Neon Grid Defense', path: '/neon-grid-defense/' },
  { name: 'EB Navigation', path: '/eb-navigation/' },
  { name: 'Voxel Engine', path: '/voxel-engine/' },
];

// "Hub 열기" 버튼 대신:
<div className="mt-3 border-t pt-3">
  <p className="text-xs text-muted-foreground mb-2">프로젝트</p>
  <div className="space-y-1">
    {hubProjects.map((project) => (
      <button
        key={project.path}
        className="w-full flex items-center justify-between px-3 py-2 text-sm rounded-md hover:bg-accent text-left"
        onClick={() => {
          const url = `https://estelle-hub.mooo.com${project.path}`;
          const intentUrl = `intent://${url.replace('https://', '')}#Intent;scheme=https;package=com.sec.android.app.sbrowser;end`;
          window.location.href = intentUrl;
        }}
      >
        <span>{project.name}</span>
        <span className="text-muted-foreground">›</span>
      </button>
    ))}
  </div>
</div>
```

**Step 2: Commit**

```bash
git add packages/client/src/components/settings/AccountSection.tsx
git commit -m "feat: embed hub project list in settings menu"
```

---

### Task 4: Relay 빌드 및 배포

**Step 1: 클라이언트 빌드**

```bash
cd /home/estelle/estelle2
pnpm build:client
```

빌드 결과가 `packages/relay/public/`에 생성됨을 확인.

**Step 2: Relay 재시작**

```bash
pm2 restart estelle-relay
```

**Step 3: Commit (빌드 결과 포함 시)**

필요한 경우만.

---

### Task 5: Caddyfile 재설정

**Files:**
- Modify: `/etc/caddy/Caddyfile`

**Step 1: Caddyfile 교체**

```caddyfile
# =============================================================================
# Estelle Hub - Caddy 중심 라우팅
# =============================================================================

estelle-hub.mooo.com {
	# Relay (PWA + WebSocket)
	handle /relay/* {
		uri strip_prefix /relay
		reverse_proxy localhost:8080
	}

	# Hub 대시보드 (Relay 서버에서 동적 생성)
	handle /hub {
		reverse_proxy localhost:8080
	}

	# Neon Grid Defense
	handle /neon-grid-defense/* {
		uri strip_prefix /neon-grid-defense
		root * /home/estelle/web-td
		try_files {path} /index.html
		file_server
	}

	# Voxel Engine
	handle /voxel-engine/* {
		uri strip_prefix /voxel-engine
		root * /home/estelle/voxel-engine/dist
		try_files {path} /index.html
		file_server
	}

	# EB Navigation
	handle /eb-navigation/* {
		uri strip_prefix /eb-navigation
		root * /home/estelle/eb-navigation-web/dist
		try_files {path} /index.html
		file_server
	}

	# 루트 → Relay로 리다이렉트
	handle {
		redir / /relay/ permanent
	}
}
```

**Step 2: Caddy 설정 검증 및 리로드**

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

**Step 3: 동작 확인**

```bash
# Relay 접근
curl -sI https://estelle-hub.mooo.com/relay/ | head -5

# 프로젝트 접근 (SPA fallback 확인)
curl -sI https://estelle-hub.mooo.com/voxel-engine/ | head -5
curl -sI https://estelle-hub.mooo.com/voxel-engine/some-route | head -5

# 루트 리다이렉트 확인
curl -sI https://estelle-hub.mooo.com/ | head -5

# Hub 대시보드 접근
curl -sI https://estelle-hub.mooo.com/hub | head -5
```

---

### Task 6: PM2 정적 serve 프로세스 제거

**Step 1: 프로세스 중지 및 삭제**

```bash
pm2 stop voxel-engine neon-grid-defense eb-navigation
pm2 delete voxel-engine neon-grid-defense eb-navigation
pm2 save
```

**Step 2: 확인**

```bash
pm2 list
```

남아야 하는 프로세스: `estelle-relay`, `estelle-pylon`, `estelle-updater`

---

### Task 7: 최종 검증

**Step 1: 전체 라우팅 테스트**

| URL | 기대 결과 |
|-----|-----------|
| `https://estelle-hub.mooo.com/` | 301 → `/relay/` |
| `https://estelle-hub.mooo.com/relay/` | Relay PWA |
| `https://estelle-hub.mooo.com/hub` | Hub 대시보드 |
| `https://estelle-hub.mooo.com/voxel-engine/` | Voxel Engine |
| `https://estelle-hub.mooo.com/voxel-engine/some-path` | Voxel Engine (SPA fallback) |
| `https://estelle-hub.mooo.com/neon-grid-defense/` | Neon Grid Defense |
| `https://estelle-hub.mooo.com/eb-navigation/` | EB Navigation |

**Step 2: F5 새로고침 테스트**

각 프로젝트 페이지에서 F5를 눌러 SPA fallback이 정상 동작하는지 확인.

**Step 3: PWA 테스트**

`/relay/`에서 PWA가 정상적으로 설치 가능하고 다른 프로젝트를 가리지 않는지 확인.

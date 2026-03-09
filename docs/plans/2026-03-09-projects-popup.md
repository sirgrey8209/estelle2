# 프로젝트 허브 팝업 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 세팅 버튼 옆에 Grid 버튼을 추가하고, 클릭 시 hub-routes.json 기반 프로젝트 목록 팝업을 표시한다.

**Architecture:** Relay에 `/api/projects` 엔드포인트 추가, 클라이언트에 ProjectsDialog 컴포넌트 추가. 기존 `/hub` 페이지와 하드코딩된 목록은 삭제.

**Tech Stack:** React, TypeScript, shadcn/ui Dialog, Lucide icons

---

### Task 1: Relay에 /api/projects 엔드포인트 추가

**Files:**
- Modify: `packages/relay/src/static.ts`

**Step 1: API 엔드포인트 추가**

`createStaticHandler` 함수 내부, Hub 대시보드 처리 전에 추가:

```typescript
// API: 프로젝트 목록
if (url.pathname === '/api/projects') {
  const routes = loadHubRoutes();
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
  });
  res.end(JSON.stringify(routes));
  return;
}
```

**Step 2: 테스트**

Run: `curl http://localhost:8080/api/projects`
Expected: hub-routes.json 내용이 JSON으로 반환

**Step 3: Commit**

```bash
git add packages/relay/src/static.ts
git commit -m "feat(relay): add /api/projects endpoint"
```

---

### Task 2: /hub 페이지 및 관련 함수 삭제

**Files:**
- Modify: `packages/relay/src/static.ts`

**Step 1: Hub 대시보드 관련 코드 삭제**

삭제 대상:
- `generateHubDashboard()` 함수 (194-309번 줄)
- `serveHubDashboard()` 함수 (315-325번 줄)
- `createStaticHandler` 내부의 `/hub` 라우트 처리 (343-346번 줄)

**Step 2: 테스트**

Run: `curl http://localhost:8080/hub`
Expected: 404 Not Found

**Step 3: Commit**

```bash
git add packages/relay/src/static.ts
git commit -m "refactor(relay): remove /hub page"
```

---

### Task 3: ProjectsDialog 컴포넌트 생성

**Files:**
- Create: `packages/client/src/components/projects/ProjectsDialog.tsx`

**Step 1: 컴포넌트 작성**

```tsx
import { useEffect, useState } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';

interface Project {
  name: string;
  path: string;
  port: number;
  url?: string;
  description?: string;
}

interface ProjectsDialogProps {
  open: boolean;
  onClose: () => void;
}

export function ProjectsDialog({ open, onClose }: ProjectsDialogProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    setLoading(true);
    setError(null);

    fetch('/api/projects')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch projects');
        return res.json();
      })
      .then((data) => {
        setProjects(data.projects || []);
      })
      .catch((err) => {
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [open]);

  const getProjectUrl = (project: Project) => {
    return project.url || `http://89.167.4.124:${project.port}`;
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-sm max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Projects</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
          {error && (
            <div className="text-center py-8 text-destructive text-sm">
              {error}
            </div>
          )}
          {!loading && !error && projects.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No projects configured
            </div>
          )}
          {!loading && !error && projects.length > 0 && (
            <div className="grid grid-cols-2 gap-3 p-1">
              {projects.map((project) => (
                <a
                  key={project.path}
                  href={getProjectUrl(project)}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="group flex flex-col p-3 rounded-lg bg-card border border-border hover:border-primary hover:bg-accent transition-colors"
                >
                  <div className="flex items-start justify-between gap-1">
                    <span className="font-semibold text-sm leading-tight">
                      {project.name}
                    </span>
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary shrink-0 mt-0.5" />
                  </div>
                  {project.description && (
                    <span className="text-xs text-muted-foreground mt-1.5 line-clamp-2">
                      {project.description}
                    </span>
                  )}
                </a>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: index.ts에 export 추가**

Create: `packages/client/src/components/projects/index.ts`

```typescript
export { ProjectsDialog } from './ProjectsDialog';
```

**Step 3: Commit**

```bash
git add packages/client/src/components/projects/
git commit -m "feat(client): add ProjectsDialog component"
```

---

### Task 4: AppHeader에 Grid 버튼 추가

**Files:**
- Modify: `packages/client/src/layouts/AppHeader.tsx`

**Step 1: import 추가**

```typescript
import { Menu, CloudOff, MonitorOff, LayoutGrid } from 'lucide-react';
import { ProjectsDialog } from '../components/projects';
```

**Step 2: state 추가**

```typescript
const [showProjects, setShowProjects] = useState(false);
```

**Step 3: Grid 버튼 추가 (설정 버튼 앞에)**

```tsx
<Button
  variant="ghost"
  size="icon"
  onClick={() => setShowProjects(true)}
>
  <LayoutGrid className="h-5 w-5" />
</Button>

<Button
  variant="ghost"
  size="icon"
  onClick={() => setShowSettings(true)}
>
  <Menu className="h-5 w-5" />
</Button>
```

**Step 4: ProjectsDialog 추가**

```tsx
<ProjectsDialog
  open={showProjects}
  onClose={() => setShowProjects(false)}
/>

<SettingsDialog
  open={showSettings}
  onClose={() => setShowSettings(false)}
/>
```

**Step 5: 테스트**

브라우저에서 Grid 버튼 클릭 → 프로젝트 목록 팝업 표시 확인

**Step 6: Commit**

```bash
git add packages/client/src/layouts/AppHeader.tsx
git commit -m "feat(client): add projects button to header"
```

---

### Task 5: AccountSection에서 프로젝트 목록 삭제

**Files:**
- Modify: `packages/client/src/components/settings/AccountSection.tsx`

**Step 1: 프로젝트 목록 섹션 삭제**

102-122번 줄 삭제 (border-t부터 마지막 div까지):

```tsx
// 삭제할 부분
<div className="mt-3 border-t pt-3">
  <p className="text-xs text-muted-foreground mb-2">프로젝트</p>
  ...
</div>
```

**Step 2: 테스트**

브라우저에서 설정 열기 → 프로젝트 목록이 없는지 확인

**Step 3: Commit**

```bash
git add packages/client/src/components/settings/AccountSection.tsx
git commit -m "refactor(client): remove hardcoded project list from settings"
```

---

### Task 6: 스킬 이름 변경 및 내용 업데이트

**Files:**
- Rename: `~/.claude/skills/hub-guide` → `~/.claude/skills/estelle-hub`
- Modify: `~/.claude/skills/estelle-hub/SKILL.md`

**Step 1: 디렉토리 이름 변경**

```bash
mv ~/.claude/skills/hub-guide ~/.claude/skills/estelle-hub
```

**Step 2: SKILL.md 내용 업데이트**

```markdown
---
name: estelle-hub
description: Use when user asks about "Estelle Hub", "hub-routes", "hub-routes.json", adding projects, or project management on the Hetzner server
version: 2.0.0
---

# Estelle Hub 가이드

Estelle Hub는 Hetzner 서버에서 실행 중인 프로젝트들을 관리하는 시스템이에요.

## 프로젝트 목록 접근

- Estelle 앱 헤더의 **Grid 버튼** 클릭
- 팝업에서 프로젝트 목록 확인 및 바로가기

## 서버 환경

- **IP**: 89.167.4.124
- **도메인**: `estelle-hub.mooo.com` (Caddy 리버스 프록시)
- **HTTPS**: Caddy 자동 인증서 관리

## 프로젝트 추가 방법

### 1. 설정 파일

`/home/estelle/estelle2/config/hub-routes.json`

### 2. 설정 형식

```json
{
  "projects": [
    {
      "name": "Voxel Engine",
      "path": "/projects/voxel-engine",
      "port": 3003,
      "url": "https://estelle-hub.mooo.com/voxel-engine/",
      "description": "WebGPU 복셀 엔진"
    }
  ]
}
```

### 3. 필드 설명

| 필드 | 필수 | 설명 |
|------|------|------|
| `name` | ✅ | 표시될 이름 |
| `path` | ✅ | 프로젝트 디렉토리 경로 |
| `port` | ✅ | 서비스 포트 번호 |
| `url` | ❌ | HTTPS URL (지정 시 port 대신 사용) |
| `description` | ❌ | 프로젝트 설명 |

### 4. URL vs Port

- `url` 지정 시: 해당 URL로 링크 (HTTPS 가능)
- `url` 미지정 시: `http://89.167.4.124:{port}`로 링크

**HTTPS가 필요한 경우** (WebGPU, 카메라 등): `url` 필드 사용 + Caddy 설정

## Caddy 리버스 프록시 설정

`/etc/caddy/Caddyfile`에 경로 추가:

```caddyfile
estelle-hub.mooo.com {
    reverse_proxy localhost:8080

    handle_path /voxel-engine/* {
        reverse_proxy localhost:3003
    }
}
```

설정 후: `sudo systemctl reload caddy`

## PM2로 프로젝트 실행

```bash
# 정적 파일 서버
pm2 start npx --name "my-app" -- serve -l tcp://0.0.0.0:3001 /path/to/dist

# Node.js 앱
pm2 start npm --name "my-app" -- start

# 저장 및 자동 시작
pm2 save
```

**중요**: 반드시 `0.0.0.0`으로 바인딩해야 외부 접근 가능!

## 문제 해결

| 증상 | 원인 | 해결 |
|------|------|------|
| ERR_CONNECTION_REFUSED | 앱 미실행 | `pm2 list`로 확인 후 실행 |
| ERR_EMPTY_RESPONSE | localhost 바인딩 | `0.0.0.0`으로 변경 |
| HTTPS 오류 | Caddy 미설정 | Caddyfile에 경로 추가 |
| 목록 안 보임 | JSON 오류 | hub-routes.json 문법 확인 |
```

**Step 3: Commit**

```bash
git -C ~/.claude add skills/estelle-hub
git -C ~/.claude commit -m "refactor: rename hub-guide to estelle-hub, update for popup UI"
```

---

### Task 7: 빌드 및 배포

**Step 1: 빌드**

```bash
cd /home/estelle/estelle2
pnpm build
```

**Step 2: 배포**

estelle-patch 스킬 사용하여 배포

**Step 3: 테스트**

- Estelle 앱에서 Grid 버튼 클릭
- 프로젝트 목록 팝업 확인
- hub-routes.json 수정 후 팝업 다시 열어 반영 확인

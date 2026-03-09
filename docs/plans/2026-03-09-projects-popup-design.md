# 프로젝트 허브 팝업 설계

## 개요

세팅 버튼 옆에 Grid 아이콘 버튼을 추가하고, 클릭 시 프로젝트 목록 팝업을 표시한다.
hub-routes.json을 실시간으로 반영하며, 기존 `/hub` 페이지와 하드코딩된 프로젝트 목록은 삭제한다.

## 요구사항

1. 세팅 버튼 옆에 Grid 아이콘 버튼 추가
2. 클릭 시 프로젝트 목록 팝업 표시
3. hub-routes.json 실시간 반영 (팝업 열 때마다 쿼리)
4. 모바일 친화적 UI
5. 기존 `/hub` 페이지 삭제
6. AccountSection의 하드코딩된 프로젝트 목록 삭제
7. 스킬 이름 `hub-guide` → `estelle-hub`로 변경

## 설계

### UI 구조

**AppHeader 변경:**
```
[Estelle v1.2.3]          [Pylon아이콘들] [Grid] [Menu]
```

**ProjectsDialog:**
- 모바일 친화적 다이얼로그 (shadcn Dialog)
- 2열 그리드 레이아웃
- 카드: 이름 + 설명 + 외부링크 아이콘

### 데이터 흐름

```
팝업 열림
    ↓
GET /api/projects (Relay)
    ↓
Relay가 hub-routes.json 읽기
    ↓
JSON 응답
    ↓
UI 렌더링
```

### API 엔드포인트

**GET /api/projects**

Response:
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

### 파일 변경

**신규:**
- `packages/client/src/components/projects/ProjectsDialog.tsx`

**수정:**
- `packages/client/src/layouts/AppHeader.tsx` - Grid 버튼 추가
- `packages/relay/src/static.ts` - `/api/projects` 엔드포인트 추가, `/hub` 삭제
- `packages/client/src/components/settings/AccountSection.tsx` - 프로젝트 목록 삭제

**삭제:**
- `static.ts`의 `generateHubDashboard()`, `serveHubDashboard()` 함수

**스킬:**
- `~/.claude/skills/hub-guide` → `~/.claude/skills/estelle-hub`로 이름 변경
- 내용 업데이트 (팝업 사용법, `/hub` 관련 내용 삭제)

### UI 디자인

```
┌─────────────────────────────┐
│  Projects              [X]  │
├─────────────────────────────┤
│ ┌───────────┐ ┌───────────┐ │
│ │ Voxel     │ │ Neon Grid │ │
│ │ Engine    │ │ Defense   │ │
│ │ WebGPU... │ │ Three.js..│ │
│ │        ↗  │ │        ↗  │ │
│ └───────────┘ └───────────┘ │
│ ┌───────────┐ ┌───────────┐ │
│ │ EB Nav    │ │ Divider   │ │
│ │           │ │ Game      │ │
│ │ Flow...   │ │ 숫자...   │ │
│ │        ↗  │ │        ↗  │ │
│ └───────────┘ └───────────┘ │
└─────────────────────────────┘
```

- 카드 배경: `bg-card` with hover effect
- 이름: `font-semibold`
- 설명: `text-muted-foreground text-sm`
- 외부링크 아이콘: `ExternalLink` (lucide-react)

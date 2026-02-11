# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 페르소나

[Persona.md](Persona.md) 참조 - 스텔라(Stella)로서 주인님을 모심

## 대화 스타일

- 항상 경어체(존댓말)로 답변할 것

## 프로젝트 개요

Claude Code를 여러 PC와 모바일에서 원격 제어하는 시스템 (estelle v2)

- **TypeScript** 기반 모노레포
- **TDD** 방법론 적용
- 기존 estelle에서 아키텍처/프로세스 개선하여 재구축

## 문서 구조

```
[작업 시작] → wip/ 에 문서 작성
     ↓
[작업 완료] → log/ 로 이동 (날짜 prefix)
```

| 폴더 | 용도 |
|------|------|
| `doc/` | 프로젝트 설계 문서 |
| `wip/` | 진행 중인 작업 계획/상황 |
| `log/` | 완료된 작업 로그 |

- **처음 대화 시작 시**: `doc/00-project-overview.md`와 `wip/` 문서 읽고 상황 파악
- **"하고 있는 일/해야 할 일"** 질문 시 → `wip/` 확인
- **구현 목표/로드맵**: `wip/ROADMAP.md` 참조

### 작업 완료 시 로그 규칙

1. **wip/ 문서를 log/로 이동** (날짜 prefix 추가: `YYYY-MM-DD-문서명.md`)
2. **ROADMAP.md에 한줄 로그 추가**

```markdown
## 작업 로그
- [YYMMDD HH:MM] 작업 내용 한줄 요약
```

## 패키지 구조

```
packages/
├── core/           # 공유 타입, 메시지 스키마
├── relay/          # Relay 서버 (순수 라우터 + 정적 파일 서빙)
├── pylon/          # Pylon 서비스 (상태 관리, Claude SDK)
├── claude-beacon/  # ClaudeBeacon (단일 SDK로 다중 Pylon 서비스)
└── client/         # React 웹 클라이언트 (Vite + shadcn/ui)
```

- `@estelle/core`: 다른 패키지에서 공유하는 타입 (Pylon ↔ App 타입 공유)
- `@estelle/relay`: 상태 없음, 순수 함수로 구성, 정적 파일 서빙 포함
- `@estelle/pylon`: PylonState 순수 데이터 클래스 중심
- `@estelle/claude-beacon`: 단일 Claude SDK 인스턴스로 여러 Pylon 서비스
- `packages/client`: Vite 웹 클라이언트 (TypeScript, Zustand, Tailwind, shadcn/ui)

### 포트 할당

| 포트 | 용도 | 환경 |
|------|------|------|
| 9875 | ClaudeBeacon TCP | 공용 |
| 9876 | MCP TCP 서버 | release |
| 9877 | MCP TCP 서버 | stage |
| 9878 | MCP TCP 서버 | dev |
| 9879 | MCP TCP 서버 | test (수동 테스트용) |

## TDD 개발 원칙

### 테스트 먼저

```
1. 실패하는 테스트 작성
2. 테스트 통과하는 최소 코드 작성
3. 리팩토링
4. 반복
```

### 테스트 실행

```bash
# 전체 테스트
pnpm test

# 특정 패키지
pnpm --filter @estelle/pylon test

# watch 모드 (개발 시)
pnpm --filter @estelle/pylon test:watch

# 단일 파일
pnpm --filter @estelle/pylon test src/state.test.ts
```

### 모킹 최소화

**모킹은 테스트의 적이다.** 모킹 없이 테스트할 수 있는 구조를 만든다.

```typescript
// ❌ 모킹 필요한 구조
class Service {
  private ws = new WebSocket('...');  // 외부 의존성 직접 생성
}

// ✅ 모킹 불필요한 구조
class PylonState {
  handlePacket(packet: Packet) { ... }  // 순수 입력
  handleClaude(event: ClaudeEvent) { ... }  // 순수 입력
}

// 테스트
const state = new PylonState();
state.handlePacket({ type: 'prompt', content: 'hello' });
expect(state.messages).toHaveLength(1);
```

### 테스트 구조

```typescript
describe('기능명', () => {
  it('should 동작 설명', () => {
    // Given - 준비
    const state = new PylonState();

    // When - 실행
    state.handlePacket({ type: 'prompt', content: 'hello' });

    // Then - 검증
    expect(state.messages).toHaveLength(1);
  });
});
```

### 코드 작성 전 확인사항

1. **테스트 파일 있는가?** - 없으면 먼저 생성
2. **테스트가 실패하는가?** - 실패하는 테스트 먼저 작성
3. **기존 테스트 깨지지 않는가?** - `pnpm test` 전체 실행

## 핵심 설계 원칙

### Pylon = Single Source of Truth

- App은 Pylon 데이터를 **무조건 신뢰**
- App은 상태 변경 안 함, **요청만**
- 모든 App은 **동일한 상태**를 봄

### 계층 분리

```
Adapters (I/O)     - WebSocket, Claude SDK, FileSystem
       ↓
PylonState (순수)   - 모킹 없이 테스트 가능
```

### Relay는 순수 함수

```typescript
// 상태 없음, 입력 → 출력
function authenticate(token, config): AuthResult { ... }
function routeMessage(msg, connections): RouteResult { ... }
```

## Shell 주의사항

- Windows 환경에서 `&&` 명령어 체이닝이 동작하지 않음
- 여러 명령어 실행 시 별도의 Bash 호출로 분리
- `cd /d C:\path` 형식 동작 안 함
- 절대경로 실패 시 상대경로로 재시도

## 환경 설정

환경별 설정은 `config/environments.json`에서 중앙 관리한다.

```json
{
  "dev": { "relay": { "url": "ws://localhost:3000" }, "client": { "title": "Estelle (dev)", "port": 5173 } },
  "stage": { "relay": { "url": "wss://estelle-relay-v2-stage.fly.dev", "flyApp": "estelle-relay-v2-stage" }, "pylon": { "pm2Name": "estelle-pylon-stage" } },
  "release": { "relay": { "url": "wss://estelle-relay-v2.fly.dev", "flyApp": "estelle-relay-v2" }, "pylon": { "pm2Name": "estelle-pylon" } }
}
```

> **Client Relay URL**: 클라이언트는 빌드 시 환경변수가 아닌 **런타임에 `window.location`으로 relay URL을 결정**한다.
> - `localhost` → `ws://localhost:3000` (dev)
> - 그 외 → `wss://${window.location.host}` (stage/release 자동 구분)
>
> 클라이언트는 항상 relay에서 서빙되므로 별도 URL 설정이 불필요하다.

## 빌드 환경 (Dev → Stage → Release)

### 환경 구조

| 환경 | Relay | Pylon (PM2) | Client | 용도 |
|------|-------|-------------|--------|------|
| dev | localhost:3000 | pnpm dev (직접) | Vite dev server | PC에서 빠른 개발 |
| stage | Fly.io stage앱 | estelle-pylon-stage | Fly.io stage에서 서빙 | 모바일에서 개발 확인 |
| release | Fly.io prod앱 | estelle-pylon | Fly.io prod에서 서빙 | 실사용 |

**배포 경로**: `dev → stage → release` 또는 `dev → release` (직행)

### 버전 체계

**포맷**: `(env)vMMDD_N` — 예: `(stage)v0207_1`, `(release)v0207_3`
- dev 환경: `(dev)` (빌드 번호 없음)
- 카운터: `config/build-counter.json`에 저장, 날짜 바뀌면 리셋

### Beacon 서버 (공용)

ClaudeBeacon은 **dev/stage 공용**으로 PM2로 별도 관리된다. 단일 Claude SDK 인스턴스로 여러 Pylon을 서비스한다.

```bash
pnpm beacon          # 시작 (PM2)
pnpm beacon:stop     # 종료
pnpm beacon:status   # 상태 확인
pnpm beacon:restart  # 재시작
pnpm beacon:logs     # 로그 보기
```

> **아키텍처**: Pylon → Beacon(9875) → Claude SDK. MCP 도구는 Beacon의 ToolContextMap을 통해 toolUseId → entityId 매핑을 조회한다.
>
> **현재 상태**: release는 Beacon 미사용 (패치 미적용)

### Dev 빌드 (개발 서버)

```bash
pnpm dev          # 시작 (Relay + Pylon + Vite) - Beacon은 별도
pnpm dev:stop     # 종료
pnpm dev:status   # 상태 확인
pnpm dev:restart  # 재시작
```

### Stage / Release 빌드

```powershell
# Stage 배포 (release pylon에 영향 없음 — 안전)
.\scripts\build-deploy.ps1 -Target stage

# Release 배포 (소스에서 직접 빌드)
.\scripts\build-deploy.ps1 -Target release

# Stage → Release 프로모트 (클라이언트 재빌드 없이 stage 빌드를 release로 승격)
.\scripts\promote-stage.ps1
```

> **Promote 시 클라이언트 재빌드 불필요**: relay URL이 런타임 결정이므로, stage 빌드 번들을 그대로 release에 사용 가능.

> **주의: Pylon(Claude) 세션에서 release 빌드/프로모트 실행 시**
> PM2 재시작이 Pylon을 종료하면 Claude SDK 세션이 끊긴다.
> 반드시 **detached 프로세스**로 실행할 것:
> ```powershell
> Start-Process powershell -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','.\scripts\build-deploy.ps1','-Target','release' -WindowStyle Hidden
> Start-Process powershell -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','.\scripts\promote-stage.ps1' -WindowStyle Hidden
> ```
> **stage 빌드는 안전** — release pylon에 영향 없음.

**MCP deploy 도구**: Claude가 대화 중 직접 배포 가능 (detached로 실행됨)

**빌드 파이프라인** (`build-deploy.ps1`):
1. Phase 0: 사전 검증 (pnpm, pm2, fly.exe, config)
2. Version: 빌드 버전 생성 (build-counter.json)
3. Phase 1: TypeScript 빌드 (VITE_BUILD_ENV, VITE_BUILD_VERSION 주입, relay URL은 런타임 결정)
4. Phase 2: 타겟 폴더 구축 (core, pylon, relay + junction)
5. Phase 3: 무결성 검증
6. Phase 4: Fly.io Relay 배포 (Start-Process 방식)
7. Phase 5: PM2 재시작 + 헬스체크

**프로모트 파이프라인** (`promote-stage.ps1`):
1. Phase 0: 사전 검증 (stage 빌드 존재 확인)
2. Phase 1: stage 빌드를 release 폴더로 복사
3. Phase 2: ecosystem.config.cjs 재생성 (release 환경변수)
4. Phase 3: Fly.io Relay 배포
5. Phase 4: PM2 재시작 + 헬스체크

### 데이터 관리

환경별 **완전 분리된 데이터** 디렉토리 사용.

| 환경 | 데이터 경로 |
|------|------------|
| Dev | `packages/pylon/data/` |
| Stage | `stage-data/data/` (실제), `release-stage/pylon/data/` (junction) |
| Release | `release-data/data/` (실제), `release/pylon/data/` (junction) |

**데이터 동기화** (임의 방향):

```powershell
.\scripts\sync-data.ps1                           # release → dev (기본)
.\scripts\sync-data.ps1 -From release -To stage   # release → stage
.\scripts\sync-data.ps1 -From stage -To dev       # stage → dev
.\scripts\sync-data.ps1 -Force                    # 확인 없이 실행
```

### 배포 스크립트 구조

```
scripts/
├── deploy-common.ps1      ← 공통 함수 모듈 (dot-source로 로드)
├── build-deploy.ps1       ← 소스에서 빌드 + 배포
├── promote-stage.ps1      ← stage → release 프로모트
├── dev-server.js          ← dev 서버 (Relay + Pylon + Vite)
├── sync-data.ps1          ← 환경 간 데이터 동기화
└── ...
```

**`deploy-common.ps1` 공통 함수:**
- `Write-Utf8File` — UTF-8 (BOM 없음) 파일 쓰기
- `Remove-Junction`, `Remove-DirectorySafe` — junction 안전 제거
- `New-EcosystemConfig` — PM2 ecosystem.config.cjs 생성 (전체 환경변수 포함)
- `New-Dockerfile`, `New-FlyToml` — Fly.io 설정 파일 생성
- `Deploy-FlyRelay` — Fly.io 배포 (Start-Process 방식)
- `Start-PylonPM2`, `Stop-PylonPM2` — PM2 라이프사이클 + 헬스체크
- `New-DataJunctions`, `Test-DataJunctions` — 데이터 junction 생성/검증

### 폴더 구조

```
config/
├── environments.json    ← dev/stage/release 설정
└── build-counter.json   ← 빌드 번호 추적 (.gitignore)

release/                 ← production
├── core/ pylon/ relay/
└── pylon/data,uploads → release-data/ (junction)

release-stage/           ← staging
├── core/ pylon/ relay/
└── pylon/data,uploads → stage-data/ (junction)

release-data/            ← release 전용 데이터
stage-data/              ← stage 전용 데이터
```

### Client 앱 (별도 실행 시)

```bash
cd packages/client

pnpm dev        # Vite dev server
pnpm build      # 빌드 (→ relay/public)
pnpm preview    # 빌드 결과 미리보기
```

## 자주 쓰는 명령어

```bash
# 의존성 설치
pnpm install

# 전체 빌드
pnpm build

# 전체 테스트
pnpm test

# 타입 체크
pnpm typecheck

# 특정 패키지 테스트 (watch)
pnpm --filter @estelle/pylon test:watch
```

## 참고

- 원본 프로젝트: `C:\WorkSpace\estelle\`
- 원본 스펙: `C:\WorkSpace\estelle\spec\`

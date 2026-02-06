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
├── core/         # 공유 타입, 메시지 스키마
├── relay/        # Relay 서버 (순수 라우터 + 정적 파일 서빙)
├── pylon/        # Pylon 서비스 (상태 관리, Claude SDK)
└── client/       # React 웹 클라이언트 (Vite + shadcn/ui)
```

- `@estelle/core`: 다른 패키지에서 공유하는 타입 (Pylon ↔ App 타입 공유)
- `@estelle/relay`: 상태 없음, 순수 함수로 구성, 정적 파일 서빙 포함
- `@estelle/pylon`: PylonState 순수 데이터 클래스 중심
- `packages/client`: Vite 웹 클라이언트 (TypeScript, Zustand, Tailwind, shadcn/ui)

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
  "dev": {
    "relay": { "port": 3000, "url": "ws://localhost:3000" },
    "client": { "relayUrl": "ws://localhost:3000", "title": "Estelle (dev)" }
  },
  "release": {
    "relay": { "url": "wss://estelle-relay-v2.fly.dev" },
    "client": { "webPort": 8080, "title": "Estelle" }
  }
}
```

- 스크립트들이 이 파일을 읽어 포트/URL 설정
- Dev 환경에서 웹 타이틀에 "(dev)" 표시됨

## 빌드 환경

### Dev 빌드 vs Release 빌드

| 구분 | Dev 빌드 | Release 빌드 |
|------|----------|--------------|
| 명령어 | `pnpm dev` | `.\scripts\build-release.ps1` |
| Relay | 로컬 (ws://localhost:3000) | Fly.io (wss://estelle-relay-v2.fly.dev) |
| Pylon | packages/pylon 직접 실행 | release/pylon (PM2) |
| Client | Vite Dev Server (5173) | Relay 내장 (Fly.io) |
| 데이터 | packages/pylon/data | release/pylon/data (분리됨) |
| 웹 타이틀 | Estelle (dev) | Estelle |
| 용도 | 개발/디버깅 | 실제 사용 |

### Dev 빌드 (개발 서버)

```bash
# 시작 (Relay + Pylon + Vite)
pnpm dev

# 종료
pnpm dev:stop

# 상태 확인
pnpm dev:status

# 재시작
pnpm dev:restart
```

### Release 빌드

```powershell
# 풀 빌드 (TypeScript + 웹 + PM2 시작 + 헬스체크)
.\scripts\build-release.ps1

# Fly.io 배포
cd release\relay
.\deploy.ps1

# Release → Dev 데이터 동기화
.\scripts\sync-data.ps1
```

**Release 빌드 과정:**
1. TypeScript 빌드
2. release/ 폴더 초기화
3. Core/Pylon/Relay 패키지 복사
4. Client 웹 빌드 (Vite → relay/public)
5. PM2 서비스 시작 (Pylon)
6. 헬스체크 (Relay 연결)

### 데이터 관리

Dev와 Release는 **별도의 데이터**를 사용한다 (대화, 워크스페이스 등).

| 환경 | 데이터 경로 |
|------|------------|
| Dev | `packages/pylon/data/` |
| Release | `release/pylon/data/` |

```powershell
# Release 데이터를 Dev로 복사 (백업 후 덮어쓰기)
.\scripts\sync-data.ps1

# 확인 없이 강제 실행
.\scripts\sync-data.ps1 -Force
```

- Release에서 실사용한 대화를 Dev에서 디버깅할 때 유용
- 기존 Dev 데이터는 `packages/pylon/data.backup/`에 백업됨

### 포트 구성

| 서비스 | Dev | Release |
|--------|-----|---------|
| Relay | 3000 | Fly.io (443) |
| Client (Vite) | 5173 | Relay 내장 |

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

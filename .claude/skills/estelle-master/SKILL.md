---
name: estelle-master
description: |
  Estelle v2 개발을 위한 코드 분석 레퍼런스.
  메시지 타입, 데이터 흐름, MCP 도구, 테스트 패턴 등 코드에서 바로 파악하기 어려운 정보를 문서화.
  다음 상황에서 호출:
  - "메시지 타입 뭐가 있지?", "데이터 흐름 어떻게 돼?"
  - "MCP 도구 스펙 알려줘", "테스트 어떻게 짜?"
  - Estelle 구조/설계 관련 질문
---

# estelle-master

> Estelle v2 개발을 위한 코드 분석 레퍼런스 스킬

이 스킬은 코드를 분석해서 정리한 핵심 정보를 제공합니다.
코드에서 바로 알기 어려운 데이터 흐름, 메시지 매핑, 테스트 패턴 등을 문서화합니다.

---

## 빠른 참조

### 패키지 구조

```
packages/
├── core/    → 공유 타입, 메시지 스키마 (601 tests)
├── relay/   → 순수 라우터, 정적 파일 서빙 (165 tests)
├── pylon/   → 상태 관리, Claude SDK, MCP 서버 (748 tests)
└── client/  → React + Vite + shadcn/ui (335 tests)
```

### 핵심 설계 원칙

| 원칙 | 설명 |
|------|------|
| **Single Source of Truth** | Pylon이 모든 상태 관리, Client는 표시만 |
| **순수 함수 우선** | Relay는 상태 없음, 입력→출력 변환 |
| **모킹 최소화** | Store는 실제 객체, I/O만 mock |
| **TDD** | 테스트 먼저 작성 → 구현 → 리팩토링 |

### ID 체계 (24비트)

```
ConversationId = envId(2) + deviceType(1) + deviceIndex(4) + workspaceIndex(7) + conversationIndex(10)
```

| 환경 | envId | Pylon ID 범위 | Client ID 범위 |
|------|-------|---------------|----------------|
| release | 0 | 1~15 | 16~31 |
| stage | 1 | 33~47 | 48~63 |
| dev | 2 | 65~79 | 80~95 |

### MCP 포트

| 환경 | 포트 |
|------|------|
| release | 9876 |
| stage | 9877 |
| dev | 9878 |

---

## 상세 레퍼런스

### [메시지 타입](reference/message-types.md)

- 전체 메시지 타입 목록 (Auth, Workspace, Conversation, Claude, Blob 등)
- 방향, Payload 구조, 용도
- Claude Event 서브타입 (text, tool_start, tool_complete, permission_request 등)

### [데이터 흐름](reference/data-flow.md)

- Pylon 메시지 처리 흐름 (handleMessage 라우팅)
- Client 메시지 라우팅 (routeMessage → Store 업데이트)
- 초기화 시퀀스
- 세션 뷰어 관리
- 페이징, TextBuffer, Tool 생명주기

### [MCP 도구](reference/mcp-tools.md)

- 11개 MCP 도구 상세 스펙
- 파라미터, 반환값, 처리 흐름
- PylonClient 통신 방식
- 환경별 배포 제약

### [테스트 패턴](reference/test-patterns.md)

- AAA 패턴, 네이밍 컨벤션
- 모킹 전략 (팩토리 함수, Spy)
- 픽스처, 헬퍼 함수
- 비동기 테스트 패턴
- Client 테스트 (jsdom)

---

## 주요 파일 위치

### Pylon

| 파일 | 역할 |
|------|------|
| `pylon/src/pylon.ts` | 메인 오케스트레이터, handleMessage |
| `pylon/src/stores/workspace-store.ts` | 워크스페이스/대화 관리 |
| `pylon/src/stores/message-store.ts` | 메시지 히스토리 (SQLite) |
| `pylon/src/claude/claude-manager.ts` | Claude SDK 세션 관리 |
| `pylon/src/mcp/server.ts` | MCP stdio 서버 |
| `pylon/src/mcp/pylon-client.ts` | MCP ↔ Pylon 통신 |

### Client

| 파일 | 역할 |
|------|------|
| `client/src/hooks/useMessageRouter.ts` | 메시지 라우팅 엔진 |
| `client/src/stores/workspaceStore.ts` | 워크스페이스 목록 |
| `client/src/stores/conversationStore.ts` | 대화별 Claude 상태 |
| `client/src/stores/syncStore.ts` | 동기화 상태 |
| `client/src/services/relaySender.ts` | 메시지 전송 |
| `client/src/services/syncOrchestrator.ts` | 동기화 조율 |

### Core

| 파일 | 역할 |
|------|------|
| `core/src/constants/message-type.ts` | 메시지 타입 상수 |
| `core/src/types/message.ts` | Message<T> 인터페이스 |
| `core/src/types/workspace.ts` | Workspace, Conversation |
| `core/src/types/claude-event.ts` | ClaudeEventPayload |
| `core/src/utils/id-system.ts` | 24비트 ID 인코딩/디코딩 |

---

## 자주 쓰는 명령어

```bash
# 개발 서버
pnpm dev          # Relay + Pylon + Vite 시작
pnpm dev:stop     # 종료

# 테스트
pnpm test                              # 전체
pnpm --filter @estelle/pylon test      # 특정 패키지
pnpm --filter @estelle/pylon test:watch

# 배포 (MCP 도구 사용)
deploy(stage)     # → stage 배포
deploy(release)   # → release 배포
deploy(promote)   # stage → release 승격

# 타입 체크
pnpm typecheck
```

---

## 문서 갱신 방법

이 스킬의 레퍼런스 문서는 코드 분석으로 생성됩니다.
코드 구조가 변경되면 다시 분석하여 갱신이 필요합니다.

```
.claude/skills/estelle-master/
├── SKILL.md              ← 인덱스 (이 파일)
└── reference/
    ├── message-types.md  ← 메시지 타입 전체 목록
    ├── data-flow.md      ← 데이터 흐름 분석
    ├── mcp-tools.md      ← MCP 도구 스펙
    └── test-patterns.md  ← 테스트 패턴
```

**최종 업데이트**: 2026-03-02

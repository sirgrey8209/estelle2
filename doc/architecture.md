# Estelle v2 아키텍처 문서

> Claude Code를 여러 PC와 모바일에서 원격 제어하는 시스템

**최종 업데이트**: 2026-03-02 (코드 기반 자동 생성)

---

## 목차

1. [시스템 개요](#1-시스템-개요)
2. [패키지 구조](#2-패키지-구조)
3. [Core 패키지](#3-core-패키지)
4. [Pylon 패키지](#4-pylon-패키지)
5. [Relay 패키지](#5-relay-패키지)
6. [Client 패키지](#6-client-패키지)
7. [데이터 흐름](#7-데이터-흐름)
8. [ID 시스템](#8-id-시스템)
9. [설계 원칙](#9-설계-원칙)

---

## 1. 시스템 개요

### 아키텍처 다이어그램

```
┌─────────────────────────────────────────────────────────────────┐
│                    Hetzner 서버 (89.167.4.124)                   │
│                                                                  │
│  ┌──────────────┐         ┌──────────────┐                      │
│  │    Pylon     │◄───────►│    Relay     │◄────────┐            │
│  │   (PM2)      │         │   (PM2)      │         │            │
│  │              │         │              │         │            │
│  │ Claude SDK   │         │  WebSocket   │     WebSocket        │
│  │ MCP Server   │         │  Router      │         │            │
│  └──────────────┘         └──────────────┘         │            │
│         │                                          │            │
│    Claude Code                                     │            │
└─────────────────────────────────────────────────────┼────────────┘
                                                     │
              ┌──────────────────────────────────────┼────────────┐
              │                                      │            │
        ┌─────┴─────┐            ┌──────┴─────┐ ┌────┴────┐
        │  Client   │            │  Client    │ │ Client  │
        │ (브라우저) │            │ (모바일)   │ │ (다른PC) │
        └───────────┘            └────────────┘ └─────────┘
```

### 컴포넌트 역할

| 컴포넌트 | 역할 | 실행 환경 |
|----------|------|----------|
| **Relay** | 순수 라우터 (인증 + 메시지 전달), 정적 파일 서빙 | Fly.io (prod/stage) |
| **Pylon** | 백그라운드 서비스, 상태 관리, Claude SDK 직접 통합, MCP 서버 | PM2 (release/stage) |
| **Client** | PWA 웹 클라이언트, React + Vite + shadcn/ui | 브라우저 (Relay에서 서빙) |
| **Core** | 공유 타입, 메시지 스키마, 유틸리티 | 모든 패키지에서 import |

### 환경 구성

| 환경 | Relay | Pylon | Client | MCP 포트 |
|------|-------|-------|--------|----------|
| **release** | estelle-relay-v2.fly.dev | estelle-pylon (PM2) | Relay 서빙 | 9876 |
| **stage** | estelle-relay-v2-stage.fly.dev | estelle-pylon-stage (PM2) | Relay 서빙 | 9877 |
| **dev** | localhost:3000 | pnpm dev | Vite dev server | 9878 |

---

## 2. 패키지 구조

```
estelle2/
├── packages/
│   ├── core/           # 공유 타입, 메시지 스키마
│   ├── relay/          # Relay 서버 (순수 라우터 + 정적 파일 서빙)
│   ├── pylon/          # Pylon 서비스 (상태 관리, Claude SDK, MCP 서버)
│   └── client/         # React 웹 클라이언트 (Vite + shadcn/ui)
│
├── config/             # 환경 설정 (environments.json, build-counter.json)
├── scripts/            # 빌드/배포 스크립트
├── doc/                # 설계 문서 (본 문서)
├── wip/                # 진행 중 작업
├── log/                # 완료된 작업
│
├── release/            # production 빌드
├── release-stage/      # staging 빌드
├── release-data/       # release 전용 데이터
├── stage-data/         # stage 전용 데이터
└── dev-data/           # dev 전용 데이터
```

### 패키지 의존성

```
@estelle/client ──► @estelle/core
@estelle/pylon  ──► @estelle/core
@estelle/relay  ──► @estelle/core
```

---

## 3. Core 패키지

> 모든 패키지에서 공유하는 타입, 상수, 헬퍼 함수

### 폴더 구조

```
packages/core/src/
├── index.ts                 # 메인 export 진입점
├── constants/               # 상수 정의
│   ├── message-type.ts      # 메시지 타입 (100+)
│   ├── conversation-status.ts
│   ├── claude-event-type.ts
│   ├── permission-mode.ts
│   └── characters.ts
├── types/                   # 타입 정의
│   ├── device.ts            # DeviceId, DeviceType, Character
│   ├── message.ts           # Message<T>
│   ├── auth.ts              # AuthPayload, AuthResultPayload
│   ├── workspace.ts         # Workspace, Conversation
│   ├── claude-event.ts      # ClaudeEventPayload (8종)
│   ├── store-message.ts     # StoreMessage (9종)
│   ├── blob.ts              # 파일 전송 타입
│   ├── usage.ts             # UsageSummary
│   └── share.ts             # ShareInfo
├── helpers/                 # 헬퍼 함수
│   ├── create-message.ts
│   ├── message-type-guards.ts
│   └── character.ts
├── utils/                   # 유틸리티
│   ├── id-system.ts         # 24비트 ID 시스템
│   └── deviceId.ts
└── network/                 # 네트워크 추상화
    ├── websocket-adapter.ts
    └── mock-websocket-adapter.ts
```

### 핵심 타입

#### Message (기본 메시지 형식)
```typescript
interface Message<T = unknown> {
  type: string;              // 메시지 타입 ('auth', 'ping' 등)
  payload: T;                // 실제 데이터
  timestamp: number;         // Unix timestamp (ms)
  from?: DeviceId | null;    // 발신자
  to?: number[] | null;      // 수신자 pylonId 배열
  requestId?: string | null; // 요청-응답 매칭 ID
}
```

#### Workspace / Conversation
```typescript
interface Workspace {
  workspaceId: string;           // UUID
  name: string;
  workingDir: string;            // Git 리포지터리 경로
  conversations: Conversation[];
  createdAt: number;
  lastUsed: number;
}

interface Conversation {
  conversationId: number;        // 24비트 ConversationId
  name: string;
  claudeSessionId: string | null;
  status: 'idle' | 'working' | 'waiting' | 'error';
  unread: boolean;
  permissionMode: 'default' | 'acceptEdits' | 'bypassPermissions';
  linkedDocuments?: LinkedDocument[];
  customSystemPrompt?: string;
}
```

#### StoreMessage (저장 메시지)
```typescript
type StoreMessageType =
  | 'text'           // 텍스트 메시지
  | 'tool_start'     // 도구 실행 시작
  | 'tool_complete'  // 도구 실행 완료
  | 'error'          // 에러
  | 'result'         // 최종 결과
  | 'aborted'        // 중단됨
  | 'file_attachment'// 파일 첨부
  | 'user_response'  // 사용자 응답
  | 'system';        // 시스템 메시지

interface BaseStoreMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  type: StoreMessageType;
  timestamp: number;
}
```

### 메시지 타입 (MessageType)

| 카테고리 | 예시 |
|----------|------|
| **Auth** | `AUTH`, `AUTH_RESULT` |
| **Connection** | `CONNECTED`, `REGISTERED`, `DEVICE_STATUS` |
| **Workspace** | `WORKSPACE_LIST`, `WORKSPACE_CREATE`, `WORKSPACE_DELETE` |
| **Conversation** | `CONVERSATION_CREATE`, `CONVERSATION_SELECT`, `CONVERSATION_STATUS` |
| **Claude** | `CLAUDE_SEND`, `CLAUDE_EVENT`, `CLAUDE_PERMISSION`, `CLAUDE_CONTROL` |
| **Blob** | `BLOB_START`, `BLOB_CHUNK`, `BLOB_END`, `BLOB_ACK` |

---

## 4. Pylon 패키지

> 백그라운드 서비스, 상태 관리, Claude SDK 직접 통합

### 폴더 구조

```
packages/pylon/src/
├── index.ts                    # 메인 export
├── pylon.ts                    # Pylon 메인 클래스 (오케스트레이터)
├── bin.ts                      # CLI 진입점
│
├── stores/                     # 데이터 저장소
│   ├── workspace-store.ts      # 워크스페이스/대화 (JSON)
│   ├── message-store.ts        # 메시지 히스토리 (SQLite)
│   └── share-store.ts          # 공유 설정 (JSON)
│
├── claude/                     # Claude SDK 연동
│   ├── claude-manager.ts       # 세션 관리 핵심
│   ├── claude-sdk-adapter.ts   # SDK 래핑
│   ├── mock-claude-adapter.ts  # 테스트용 모의 구현
│   └── permission-rules.ts     # 권한 결정 순수 함수
│
├── mcp/                        # MCP 서버
│   ├── server.ts               # MCP 서버 (stdio)
│   ├── pylon-client.ts         # Pylon ↔ MCP 통신
│   └── tools/                  # MCP 도구들
│       ├── send-file.ts        # 파일 전송
│       ├── link-document.ts    # 문서 연결
│       ├── conversation.ts     # 대화 관리
│       ├── deploy.ts           # 배포
│       ├── get-status.ts       # 상태 조회
│       ├── system-prompt.ts    # 시스템 프롬프트
│       └── continue-task.ts    # 작업 계속
│
├── managers/                   # 비즈니스 로직
│   ├── task-manager.ts         # task/ 폴더 MD 파일 관리
│   ├── worker-manager.ts       # 워커 프로세스 관리
│   └── folder-manager.ts       # 폴더 탐색
│
├── network/                    # 네트워크
│   ├── relay-client.ts         # Relay WebSocket 클라이언트
│   └── ws-websocket-adapter.ts
│
├── persistence/                # 영속성 계층
│   ├── file-system-persistence.ts
│   └── in-memory-persistence.ts
│
├── handlers/                   # 메시지 핸들러
│   └── blob-handler.ts         # 파일 청크 전송
│
├── auth/                       # 인증
│   └── credential-manager.ts   # 계정 전환 관리
│
└── utils/                      # 유틸리티
    ├── logger.ts
    ├── packet-logger.ts
    ├── session-context.ts      # 시스템 프롬프트 빌더
    ├── frontmatter.ts          # YAML 파서
    └── autorun-detector.ts
```

### 핵심 클래스

#### Pylon (메인 오케스트레이터)
```typescript
class Pylon {
  // 의존성
  workspaceStore: WorkspaceStore;
  messageStore: MessageStore;
  claudeManager: ClaudeManager;
  relayClient: RelayClient;
  blobHandler: BlobHandler;
  taskManager: TaskManager;
  workerManager: WorkerManager;

  // 메시지 처리
  handlePacket(packet: Message): void;

  // Claude 연동
  sendClaudeMessage(conversationId, text, attachments): void;
}
```

#### ClaudeManager (Claude SDK 세션 관리)
```typescript
class ClaudeManager {
  adapter: ClaudeSDKAdapter;

  // 세션 관리
  startSession(conversationId, systemPrompt): void;
  sendMessage(text, attachments): void;

  // 이벤트 발행
  on('init' | 'stateUpdate' | 'text' | 'textComplete' |
     'toolUse' | 'toolComplete' | 'toolError' | 'error' | 'done');
}
```

#### WorkspaceStore / MessageStore
```typescript
// 워크스페이스 (JSON 기반)
class WorkspaceStore {
  workspaces: Workspace[];
  createWorkspace(name, workingDir): Workspace;
  createConversation(workspaceId, name): Conversation;
  linkDocument(conversationId, path): void;
  // ...
}

// 메시지 (SQLite 기반)
class MessageStore {
  addMessage(conversationId, message): void;
  getMessages(conversationId, limit, offset): StoreMessage[];
  getMessageCount(conversationId): number;
}
```

### MCP 도구

| 도구 | 설명 |
|------|------|
| `send_file` | 사용자에게 파일 전송 |
| `link_doc` / `unlink_doc` | 문서 연결/해제 |
| `list_docs` | 연결된 문서 목록 |
| `create_conversation` | 대화 생성 |
| `delete_conversation` | 대화 삭제 |
| `rename_conversation` | 대화 이름 변경 |
| `deploy` | stage/release 배포 |
| `get_status` | 현재 상태 조회 |
| `add_prompt` | 시스템 프롬프트 추가 |
| `continue_task` | 작업 계속 |

### 외부 의존성

```json
{
  "@anthropic-ai/claude-agent-sdk": "^0.2.27",   // Claude Agent SDK
  "@modelcontextprotocol/sdk": "^1.26.0",        // MCP SDK
  "better-sqlite3": "^11.8.1",                    // SQLite
  "ws": "^8.18.0",                                // WebSocket
  "sharp": "^0.34.5"                              // 이미지 처리
}
```

---

## 5. Relay 패키지

> 순수 라우터, 상태 없음, 정적 파일 서빙

### 폴더 구조

```
packages/relay/src/
├── index.ts                    # 메인 export
├── types.ts                    # 타입 정의
├── constants.ts                # 고정 디바이스 설정
│
├── [순수 함수 계층]
├── utils.ts                    # 유틸리티
├── auth.ts                     # 인증 (IP 기반)
├── router.ts                   # 라우팅
├── device-status.ts            # 디바이스 상태
├── message-handler.ts          # 메시지 처리
├── device-id-validation.ts     # deviceIndex 할당
│
├── [I/O 어댑터]
├── server.ts                   # WebSocket 서버
├── static.ts                   # 정적 파일 서빙
│
└── [CLI]
    ├── bin.ts                  # CLI 진입점
    ├── cli.ts                  # CLI 옵션
    ├── google-auth.ts          # Google OAuth
    └── email-whitelist.ts      # 이메일 화이트리스트
```

### 핵심 설계: 순수 함수 + 액션 패턴

```typescript
// 1. 순수 함수: 입력 → 액션 반환
function handleMessage(clientId, client, data, ...): HandleResult {
  return {
    actions: [
      { type: 'send', clientId: 'target', message: {...} },
      { type: 'broadcast', clientIds: [...], message: {...} }
    ]
  };
}

// 2. 어댑터: 액션 실행
function executeAction(action, state) {
  if (action.type === 'send') {
    state.clients.get(action.clientId).ws.send(action.message);
  }
}
```

### 순수 함수 목록

| 파일 | 함수 | 역할 |
|------|------|------|
| `auth.ts` | `authenticateDevice()` | IP 기반 인증 |
| `router.ts` | `routeMessage()` | 메시지 라우팅 대상 결정 |
| `message-handler.ts` | `handleMessage()` | 메시지 처리 → 액션 반환 |
| `device-status.ts` | `getDeviceList()` | 디바이스 목록 조회 |

### 라우팅 규칙

```
1. message.to가 있으면 → 명시적 대상 라우팅
2. message.broadcast가 있으면 → 브로드캐스트
   - 'all' / true  → 모든 클라이언트
   - 'pylons'      → pylon 타입만
   - 'clients'     → pylon 제외 (app만)
   - 'viewer'      → viewer 타입만
3. 둘 다 없으면 → 라우팅 오류
```

### 인증 규칙

| 대상 | 방식 |
|------|------|
| **Pylon** | 디바이스 ID (1~15) + IP 기반 검증 |
| **App 클라이언트** | IP 기반 또는 Google OAuth |
| **Viewer** | shareId 기반 |

---

## 6. Client 패키지

> React + Vite + shadcn/ui PWA 웹 클라이언트

### 폴더 구조

```
packages/client/src/
├── components/              # React 컴포넌트
│   ├── chat/               # 채팅 관련
│   │   ├── ChatArea.tsx
│   │   ├── MessageList.tsx
│   │   ├── MessageBubble.tsx
│   │   ├── InputBar.tsx
│   │   ├── ToolCard.tsx
│   │   └── SlashAutocomplete.tsx
│   ├── sidebar/            # 사이드바
│   │   ├── WorkspaceSidebar.tsx
│   │   ├── PylonTabs.tsx
│   │   └── ConversationItem.tsx
│   ├── auth/               # 인증
│   │   ├── LoginScreen.tsx
│   │   └── GoogleLoginButton.tsx
│   ├── ui/                 # shadcn/ui 기반
│   └── common/             # 공통 컴포넌트
│
├── stores/                 # Zustand 스토어 (13개)
│   ├── authStore.ts        # Google OAuth
│   ├── relayStore.ts       # WebSocket 연결
│   ├── workspaceStore.ts   # 워크스페이스/대화 목록
│   ├── conversationStore.ts # 대화별 Claude 상태 (핵심)
│   ├── syncStore.ts        # 동기화 상태
│   ├── uploadStore.ts      # 파일 업로드
│   ├── imageUploadStore.ts # 이미지 업로드
│   ├── downloadStore.ts    # 다운로드
│   ├── settingsStore.ts    # 설정
│   └── shareStore.ts       # 공유
│
├── hooks/                  # 커스텀 훅
│   ├── useMessageRouter.ts # 메시지 라우팅 엔진
│   ├── useResponsive.ts    # 반응형 감지
│   └── useLongPress.ts     # 길게 누르기
│
├── services/               # 서비스
│   ├── relayService.ts     # Relay 통신
│   ├── relaySender.ts      # 메시지 전송
│   ├── syncOrchestrator.ts # 동기화 조율
│   └── blobService.ts      # 파일 업로드/다운로드
│
├── layouts/                # 레이아웃
│   ├── ResponsiveLayout.tsx
│   ├── DesktopLayout.tsx
│   └── MobileLayout.tsx
│
├── pages/                  # 페이지
│   ├── HomePage.tsx
│   └── SharePage.tsx
│
└── lib/                    # 유틸리티
```

### 핵심 스토어

#### conversationStore (대화별 Claude 상태)
```typescript
interface ConversationClaudeState {
  status: 'idle' | 'working' | 'permission';
  messages: StoreMessage[];
  textBuffer: string;              // 스트리밍 버퍼
  pendingRequests: PendingRequest[];
  realtimeUsage: RealtimeUsage | null;
}

interface ConversationStoreState {
  states: Map<number, ConversationClaudeState>;  // conversationId → 상태
  currentConversationId: number | null;

  // Actions
  setStatus(conversationId, status);
  addMessage(conversationId, message);
  appendTextBuffer(conversationId, text);
  flushTextBuffer(conversationId);
  // ...
}
```

#### workspaceStore (워크스페이스 목록)
```typescript
interface WorkspaceState {
  workspacesByPylon: Map<number, WorkspaceWithActive[]>;
  connectedPylons: ConnectedPylon[];
  selectedConversation: SelectedConversation | null;

  // Actions
  setWorkspaces(pylonId, workspaces);
  selectConversation(pylonId, conversationId);
  addConnectedPylon(pylon);
  // ...
}
```

#### syncStore (동기화 상태)
```typescript
interface ConversationSyncInfo {
  phase: 'idle' | 'requesting' | 'synced' | 'failed';
  syncedFrom: number;   // 로드된 가장 오래된 인덱스
  syncedTo: number;     // 로드된 가장 최신 인덱스
  totalCount: number;
}
```

### 외부 라이브러리

- **React 18** + **Vite 6**
- **Zustand 5** - 상태 관리
- **React Router 7** - 라우팅
- **Tailwind CSS 3** + **shadcn/ui** - 스타일링
- **@dnd-kit** - 드래그 앤 드롭
- **@react-oauth/google** - Google OAuth
- **Vitest 2** - 테스트

---

## 7. 데이터 흐름

### 메시지 송신 흐름 (App → Claude)

```
1. InputBar에서 메시지 입력
   ↓
2. relaySender.sendClaudeMessage()
   ↓
3. WebSocket → Relay → Pylon
   ↓
4. Pylon.handlePacket()
   ├── WorkspaceStore 상태 업데이트
   ├── MessageStore 저장
   └── ClaudeManager.sendMessage()
       ↓
5. ClaudeSDKAdapter → Claude Agent SDK
   ↓
6. Claude 응답 (stream 이벤트)
   ↓
7. ClaudeManager 이벤트 발행
   ↓
8. Pylon → Relay → WebSocket → Client
   ↓
9. useMessageRouter().routeMessage()
   ↓
10. conversationStore 상태 업데이트
    ↓
11. React 리렌더링
```

### MCP 도구 실행 흐름

```
1. Claude가 MCP 도구 호출 (예: send_file)
   ↓
2. MCP Server (stdio) 수신
   ↓
3. PylonClient를 통해 Pylon에 요청
   ↓
4. Pylon 처리 (파일 전송 등)
   ↓
5. RelayClient → Relay → Client
   ↓
6. Client에서 파일 수신
```

### 초기화 시퀀스

```
1. App 마운트
   ↓
2. WebSocket 연결 (RelayConfig.url)
   ↓
3. AUTH 메시지 전송 (idToken 포함)
   ↓
4. AUTH_RESULT → relayStore.setAuthenticated()
   ↓
5. syncOrchestrator.startInitialSync()
   ↓
6. WORKSPACE_LIST_RESULT → workspaceStore.setWorkspaces()
   ↓
7. 마지막 대화 선택 → 메시지 히스토리 로드
```

---

## 8. ID 시스템

### 24비트 통합 ID 체계

```
┌─────────┬─────┬─────────────┬───────────────┬──────────────────┐
│ envId   │ DT  │ deviceIndex │ workspaceIndex│ conversationIndex│
│ 2비트   │1bit │ 4비트       │ 7비트         │ 10비트           │
└─────────┴─────┴─────────────┴───────────────┴──────────────────┘
```

### ID 계층

| ID 타입 | 비트 수 | 구성 |
|---------|---------|------|
| **DeviceId** | 7비트 | envId(2) + deviceType(1) + deviceIndex(4) |
| **WorkspaceId** | 14비트 | pylonId(7) + workspaceIndex(7) |
| **ConversationId** | 24비트 | workspaceId(14) + conversationIndex(10) |

### 환경 ID (envId)

| 값 | 환경 |
|----|------|
| 0 | release |
| 1 | stage |
| 2 | dev |

### Device ID 범위

| 타입 | deviceType | deviceIndex | ID 범위 (예: dev) |
|------|------------|-------------|-------------------|
| **Pylon** | 0 | 1~15 | 65~79 |
| **Client** | 1 | 0~15 | 80~95 |

---

## 9. 설계 원칙

### 1. Pylon = Single Source of Truth

- App은 Pylon 데이터를 **무조건 신뢰**
- App은 상태 변경 안 함, **요청만** 함
- 모든 App은 **동일한 상태**를 봄

### 2. 순수 함수 우선

```typescript
// ❌ 모킹 필요한 구조
class Service {
  private ws = new WebSocket('...');
}

// ✅ 모킹 불필요한 구조
function handleMessage(clientId, data, clients): HandleResult {
  return { actions: [...] };  // 입력 → 출력
}
```

### 3. 계층 분리 (Adapter 패턴)

```
┌─────────────────────────────────────────────┐
│            Adapters (I/O)                    │
│  WebSocket, Claude SDK, FileSystem           │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│         Core Logic (순수)                    │
│  PylonState, WorkspaceStore, MessageStore    │
│  - 외부 의존성 없음                           │
│  - 모킹 없이 테스트 가능                      │
└─────────────────────────────────────────────┘
```

### 4. TDD 방법론

```
1. 실패하는 테스트 작성
2. 테스트 통과하는 최소 코드 작성
3. 리팩토링
4. 반복
```

### 5. Relay는 상태 없음

- 모든 비즈니스 로직은 순수 함수
- 액션 패턴으로 부작용 분리
- 테스트 시 모킹 불필요

---

## 테스트 현황

```
✓ Core:    601 tests
✓ Relay:   165 tests
✓ Pylon:   748 tests
✓ Client:  335 tests
─────────────────────
  Total: 1,849 tests passing
```

---

*문서 생성일: 2026-03-02*
*기반: 코드 분석 자동 생성*

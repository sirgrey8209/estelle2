# Phase 1: Pylon 핵심 동작

> **목표**: Claude와 대화가 가능한 상태
> **상태**: ✅ 완료 (2026-02-02)

---

## 1.1 Claude SDK Adapter 구현

**파일**: `packages/pylon/src/claude/claude-sdk-adapter.ts` (신규)

### 배경

- v2의 `ClaudeManager`는 `ClaudeAdapter` 인터페이스를 통해 SDK 호출
- 현재 adapter 구현체가 없어 실제 Claude 호출 불가
- v1은 `@anthropic-ai/claude-agent-sdk`의 `query()` 함수 직접 호출

### 구현

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';
import type { ClaudeAdapter, ClaudeQueryOptions, ClaudeMessage } from './types.js';

export class ClaudeSDKAdapter implements ClaudeAdapter {
  async *query(options: ClaudeQueryOptions): AsyncIterable<ClaudeMessage> {
    const sdkQuery = query({
      prompt: options.prompt,
      options: {
        cwd: options.cwd,
        abortController: options.abortController,
        includePartialMessages: options.includePartialMessages ?? true,
        settingSources: options.settingSources ?? ['project'],
        resume: options.resume,
        mcpServers: options.mcpServers,
        canUseTool: options.canUseTool,
      },
    });

    for await (const msg of sdkQuery) {
      yield this.convertMessage(msg);
    }
  }

  private convertMessage(sdkMsg: unknown): ClaudeMessage {
    // SDK 메시지 → v2 ClaudeMessage 변환
  }
}
```

### SDK 메시지 타입 매핑

| SDK 메시지 | v2 ClaudeMessage |
|-----------|------------------|
| `system` (init) | `{ type: 'system', subtype: 'init', session_id, model, tools }` |
| `assistant` | `{ type: 'assistant', content: [...] }` |
| `user` | `{ type: 'user', content: [...] }` |
| `stream_event` | `{ type: 'stream_event', event: {...} }` |
| `tool_progress` | `{ type: 'tool_progress', ... }` |
| `result` | `{ type: 'result', usage: {...} }` |

### 완료 조건

- [x] ClaudeSDKAdapter 클래스 구현 ✅ (2026-02-02)
- [x] 메시지 타입 변환 로직 구현 ✅ (SDK 메시지 그대로 전달)
- [x] 유닛 테스트 통과 ✅ (8 tests passed)
- [x] index.ts에서 export ✅

### 구현 파일

- `src/claude/claude-sdk-adapter.ts` - SDK 래핑 어댑터
- `tests/claude/claude-sdk-adapter.test.ts` - 테스트

---

## 1.2 bin.ts 의존성 연결 수정

**파일**: `packages/pylon/src/bin.ts`

### 현재 상태 (문제)

```typescript
const claudeManager = new ClaudeManager({
  getPermissionMode: () => 'default',  // ❌ 고정값
  loadMcpConfig: () => null,           // ❌ MCP 비활성
  onEvent: () => {},                    // ❌ 이벤트 무시
});
```

### 수정 내용

#### 1.2.1 Adapter 주입

```typescript
import { ClaudeSDKAdapter } from './claude/claude-sdk-adapter.js';

const claudeAdapter = new ClaudeSDKAdapter();

const claudeManager = new ClaudeManager({
  adapter: claudeAdapter,
  // ...
});
```

#### 1.2.2 onEvent 연결

**문제**: ClaudeManager 생성 시점에 Pylon 인스턴스가 없음 (순환 의존성)

**해결**: 지연 바인딩 패턴

```typescript
let pylonInstance: Pylon | null = null;

const claudeManager = new ClaudeManager({
  onEvent: (sessionId, event) => {
    if (pylonInstance) {
      pylonInstance.sendClaudeEvent(sessionId, event);
    }
  },
  // ...
});

// Pylon 생성 후 참조 설정
pylonInstance = new Pylon(config, deps);
```

#### 1.2.3 getPermissionMode 연결

```typescript
const claudeManager = new ClaudeManager({
  getPermissionMode: (sessionId) => {
    const workspaceId = workspaceStore.findWorkspaceByConversation(sessionId);
    if (!workspaceId) return 'default';
    const conversation = workspaceStore.getConversation(workspaceId, sessionId);
    return conversation?.permissionMode ?? 'default';
  },
  // ...
});
```

#### 1.2.4 loadMcpConfig 구현

```typescript
import * as fs from 'node:fs';
import * as path from 'node:path';

const claudeManager = new ClaudeManager({
  loadMcpConfig: (workingDir) => {
    const configPath = path.join(workingDir, '.estelle', 'mcp-config.json');
    try {
      if (fs.existsSync(configPath)) {
        const content = fs.readFileSync(configPath, 'utf-8');
        return JSON.parse(content);
      }
    } catch (err) {
      console.error(`Failed to load MCP config: ${err}`);
    }
    return null;
  },
  // ...
});
```

### 완료 조건

- [x] ClaudeSDKAdapter 주입 ✅ (2026-02-02)
- [x] onEvent → pylon.sendClaudeEvent 연결 ✅ (지연 바인딩 패턴)
- [x] getPermissionMode → workspaceStore 연결 ✅
- [x] loadMcpConfig 구현 ✅ (.estelle/mcp-config.json, .mcp.json)
- [x] 순환 의존성 해결 확인 ✅ (pylonInstance 변수 사용)

### 구현 내용

- `bin.ts`: ClaudeSDKAdapter 생성 및 주입
- `bin.ts`: loadMcpConfig 함수 구현 (두 경로 지원)
- `bin.ts`: getPermissionMode → workspaceStore.getConversation 연동
- `bin.ts`: onEvent → pylonInstance.sendClaudeEvent 지연 바인딩
- `claude-sdk-adapter.ts`: SDK 타입 호환성 수정 (wrapCanUseTool)

---

## 1.3 영속 저장소 (Persistence) 구현

**파일**: `packages/pylon/src/persistence/` (신규 디렉토리)

### 배경

- v2의 WorkspaceStore/MessageStore는 메모리만 사용
- toJSON()/fromJSON() 메서드는 구현됨
- 실제 파일 I/O 코드 없음

### 1.3.1 PersistenceAdapter 인터페이스

**파일**: `persistence/types.ts`

```typescript
export interface PersistenceAdapter {
  // WorkspaceStore
  loadWorkspaceStore(): WorkspaceStoreData | undefined;
  saveWorkspaceStore(data: WorkspaceStoreData): Promise<void>;

  // MessageStore
  loadMessageSession(sessionId: string): SessionData | undefined;
  saveMessageSession(sessionId: string, data: SessionData): Promise<void>;
  deleteMessageSession(sessionId: string): Promise<void>;
  listMessageSessions(): string[];
}
```

### 1.3.2 FileSystemPersistence 구현

**파일**: `persistence/file-system-persistence.ts`

```typescript
export class FileSystemPersistence implements PersistenceAdapter {
  constructor(baseDir: string = process.cwd()) {
    this.workspacesPath = path.join(baseDir, 'workspaces.json');
    this.messagesDir = path.join(baseDir, 'messages');
  }

  loadWorkspaceStore(): WorkspaceStoreData | undefined { /* ... */ }
  async saveWorkspaceStore(data): Promise<void> { /* ... */ }
  loadMessageSession(sessionId): SessionData | undefined { /* ... */ }
  async saveMessageSession(sessionId, data): Promise<void> { /* ... */ }
  async deleteMessageSession(sessionId): Promise<void> { /* ... */ }
  listMessageSessions(): string[] { /* ... */ }
}
```

### 1.3.3 Pylon 통합

**파일**: `pylon.ts` 수정

```typescript
// PylonDependencies에 추가
persistence?: PersistenceAdapter;

// 메서드 추가
async initialize(): Promise<void> { /* 데이터 로드 */ }
async shutdown(): Promise<void> { /* 데이터 저장 */ }
private scheduleSaveMessages(sessionId): void { /* 2초 debounce */ }
```

### 저장 시점

| 이벤트 | 저장 대상 | 방식 |
|--------|----------|------|
| 워크스페이스 CRUD | workspaces.json | 즉시 |
| 대화 CRUD | workspaces.json | 즉시 |
| 메시지 추가 | messages/{sessionId}.json | 2초 debounce |
| 프로세스 종료 | 모두 | 즉시 |

### 완료 조건

- [x] PersistenceAdapter 인터페이스 정의 ✅ (2026-02-02)
- [x] FileSystemPersistence 구현 ✅ (2026-02-02)
- [x] Pylon 초기화/종료 로직 추가 ✅ (2026-02-02)
- [x] 저장 시점 트리거 구현 ✅ (2026-02-02)
- [x] 유닛 테스트 통과 ✅ (16 tests)

### 구현 파일

- `src/persistence/types.ts` - PersistenceAdapter 인터페이스
- `src/persistence/file-system-persistence.ts` - 파일 시스템 구현
- `src/persistence/index.ts` - 모듈 export
- `tests/persistence/file-system-persistence.test.ts` - 테스트

### 구현 내용

- **PersistenceAdapter 인터페이스**: WorkspaceStore/MessageStore 영속화 추상화
- **FileSystemPersistence 클래스**: JSON 파일 기반 저장/로드
  - `{dataDir}/workspaces.json`: 워크스페이스 데이터
  - `{dataDir}/messages/{sessionId}.json`: 세션별 메시지
- **Pylon 통합**:
  - `start()`: 영속 데이터 로드
  - `stop()`: 데이터 저장
  - `scheduleSaveMessages()`: 2초 debounce로 메시지 저장
  - `loadMessageSession()`: lazy loading 지원
- **bin.ts 통합**:
  - `DATA_DIR` 환경변수 지원 (기본: ./data)
  - 시작 시 WorkspaceStore 데이터 로드
  - persistence를 Pylon에 주입

---

## 1.4 버그 리포트 핸들러 구현

### 배경

- v1: `bug_report` 메시지 → `bug-reports.txt` 저장
- v2: 메시지 타입도, 핸들러도 없음

### 1.4.1 메시지 타입 추가

**파일**: `packages/core/src/constants/message-type.ts`

```typescript
export const MESSAGE_TYPE = {
  // ...
  BUG_REPORT: 'bug_report',
} as const;
```

**파일**: `packages/core/src/types/messages.ts`

```typescript
export interface BugReportPayload {
  message: string;
  conversationId?: string;
  workspaceId?: string;
  timestamp: string;
}
```

### 1.4.2 Pylon 핸들러 추가

**파일**: `packages/pylon/src/pylon.ts`

```typescript
private handleBugReport(payload: BugReportPayload): void {
  const { message, timestamp } = payload;
  if (!message) return;

  const bugReportPath = path.join(process.cwd(), 'bug-reports.txt');
  const entry = `[${timestamp}]\n${message}\n-----\n`;

  fs.appendFileSync(bugReportPath, entry, 'utf-8');
}
```

### 1.4.3 Client 전송 로직 추가

**파일**: `packages/client/src/stores/relay-store.ts`

```typescript
sendBugReport(message: string, conversationId?: string, workspaceId?: string): void {
  this.send({
    type: 'bug_report',
    broadcast: 'pylons',
    payload: { message, conversationId, workspaceId, timestamp: new Date().toISOString() },
  });
}
```

### 완료 조건

- [x] core에 메시지 타입 추가 ✅ (2026-02-02)
- [x] Pylon 핸들러 구현 ✅ (2026-02-02)
- [ ] Client 전송 메서드 추가 (Phase 2로 이동)
- [ ] BugReportDialog와 연결 (Phase 2로 이동)

### 구현 파일

- `packages/core/src/constants/message-type.ts` - BUG_REPORT 타입 추가
- `packages/pylon/src/pylon.ts` - handleBugReport 메서드, BugReportWriter 인터페이스
- `packages/pylon/src/bin.ts` - bugReportWriter 구현

### 구현 내용

- **MessageType.BUG_REPORT** (`'bug_report'`): 새 메시지 타입
- **BugReportWriter 인터페이스**: `{ append(content: string): void }`
- **handleBugReport**: 버그 리포트를 로그 출력 및 파일 저장
- **bugReportWriter**: `{dataDir}/bug-reports.txt`에 저장

---

## Phase 1 체크리스트

- [x] **1.1** Claude SDK Adapter ✅ (2026-02-02)
- [x] **1.2** bin.ts 의존성 연결 ✅ (2026-02-02)
- [x] **1.3** 영속 저장소 ✅ (2026-02-02)
- [x] **1.4** 버그 리포트 (Pylon 측) ✅ (2026-02-02)

> **Phase 1 완료!** Client 측 버그 리포트 연동은 Phase 2에서 진행합니다.

---

*다음 단계: [Phase 2: Client 상태 동기화](./phase2-client-sync.md)*

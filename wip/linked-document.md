# 대화에 문서 연결 (Linked Document)

## 개요

대화(Conversation)에 문서를 연결하여, Claude가 해당 문서를 컨텍스트로 참고하고, 문서를 변경하면 클라이언트에 동기화하는 기능.

## 핵심 목적

1. **Claude 컨텍스트 주입** — 대화 시작/재개 시 연결된 문서를 Claude에게 자동 전달
2. **UI 참조** — 연결된 문서를 UI에서 열어볼 수 있음
3. **변경 동기화** — Claude가 문서를 수정하면 변경 내용을 클라이언트에 동기화

## 사용 시나리오

```
1. 사용자가 대화에 문서를 연결  (예: spec.md, design.md)
2. 대화에서 Claude에게 메시지 전송
3. Claude는 연결 문서를 자동으로 인식 → Read 도구로 읽고 참고
4. Claude가 문서를 Write/Edit로 수정
5. Pylon이 변경 감지 → 클라이언트에 변경된 파일 동기화
6. 클라이언트 UI에서 최신 문서 내용 확인 가능
```

## 기존 파일 보내기와의 차이

| | 파일 첨부 (기존) | 문서 연결 (신규) |
|---|---|---|
| 수명 | 일회성 (메시지에 포함) | 대화 전체에 지속 |
| Claude 인식 | 해당 메시지에서만 | 매 턴마다 컨텍스트 제공 |
| 변경 동기화 | 없음 | Claude 수정 시 자동 동기화 |
| 저장 위치 | uploads/{entityId}/ | workingDir 내 원본 파일 |

## 타입 설계

### Core (workspace.ts)

```typescript
interface LinkedDocument {
  path: string;          // workingDir 기준 상대경로
  addedAt: number;       // 연결 시점 timestamp
}

interface Conversation {
  // ... 기존 필드
  linkedDocuments?: LinkedDocument[];  // 연결된 문서 목록
}
```

### 메시지 타입 (message-payloads)

```typescript
// 문서 연결/해제 요청 (Client → Pylon)
interface LinkDocumentPayload {
  entityId: EntityId;
  path: string;           // workingDir 기준 상대경로
}

interface UnlinkDocumentPayload {
  entityId: EntityId;
  path: string;
}

// 문서 변경 알림 (Pylon → Client)
interface DocumentChangedPayload {
  entityId: EntityId;
  path: string;
  changeType: 'modified' | 'deleted';
}
```

## 구현 설계

### 1. 문서 연결/해제

**Pylon (WorkspaceStore)**
- `linkDocument(entityId, relativePath)` — 문서 연결
  - workingDir 기준 파일 존재 확인
  - Conversation.linkedDocuments에 추가
  - 영속 저장 (workspaces.json)
- `unlinkDocument(entityId, relativePath)` — 문서 해제

**Client → Pylon 메시지**: `conversation_link_document`, `conversation_unlink_document`

### 2. 세션 초기화 메시지 (Session Init Message)

문서 연결 여부와 관계없이, 모든 세션 시작 시 Claude에게 작업 컨텍스트를 알려주는 초기화 메시지를 전송한다.
Claude가 "작업 준비"를 할 수 있도록 세션 메타정보를 제공하는 것이 목적.

**전송 시점**: 세션 생성 직후, 사용자의 첫 메시지 전에 (또는 첫 메시지에 prefix로)

```
[세션 시작]
- 세션 이름: {conversation.name}
- 작업 디렉토리: {workspace.workingDir}
- 연결된 문서:
  - docs/spec.md
  - docs/design.md
```

연결 문서가 없으면 해당 항목은 생략.

```typescript
function buildSessionInitMessage(conversation: Conversation, workspace: Workspace): string {
  const lines = [
    '[세션 시작]',
    `- 세션 이름: ${conversation.name}`,
    `- 작업 디렉토리: ${workspace.workingDir}`,
  ];

  if (conversation.linkedDocuments?.length) {
    lines.push('- 연결된 문서 (Read 도구로 읽을 것):');
    for (const doc of conversation.linkedDocuments) {
      lines.push(`  - ${doc.path}`);
    }
  }

  return lines.join('\n');
}
```

> 향후 permissionMode, 이전 대화 요약 등 추가 컨텍스트도 이 메시지에 포함할 수 있음.

### 3. 대화 중 문서 추가 연결

세션 진행 중에 문서를 새로 연결하면, 그 시점에 해당 문서만 추가 주입:

```
[문서 연결됨]
- docs/api-reference.md
```

### 3. 문서 변경 감지 & 동기화

**변경 감지 (Pylon)**

Claude SDK의 tool 이벤트를 모니터링:

```typescript
// ClaudeManager에서 tool_complete 이벤트 처리 시
if (toolName === 'Write' || toolName === 'Edit') {
  const modifiedPath = extractPathFromToolResult(toolResult);
  const linked = conversation.linkedDocuments;

  if (linked?.some(doc => resolvePath(doc.path) === modifiedPath)) {
    // 연결 문서가 변경됨 → 동기화 트리거
    this.syncDocumentToClient(entityId, modifiedPath);
  }
}
```

**동기화 (Pylon → Client)**

기존 Blob 프로토콜 활용:
1. 변경된 파일을 읽어서 Blob 청크로 전송 (blob_start → blob_chunk → blob_end)
2. 또는 `document_changed` 알림만 보내고, 클라이언트가 필요 시 요청

> 텍스트 문서는 보통 작으므로, 알림 + 내용 직접 포함이 더 단순할 수 있음.
> Blob 프로토콜은 대용량 파일에 적합하니, 문서 크기에 따라 분기하는 것도 방법.

```typescript
// 소형 문서 (< 64KB): 내용 직접 전송
interface DocumentSyncPayload {
  entityId: EntityId;
  path: string;
  content: string;        // 파일 내용 (텍스트)
  changeType: 'modified';
}

// 대형 파일: 기존 Blob 프로토콜 사용
```

### 4. Client UI

**ChatHeader 또는 사이드 패널**
- 연결된 문서 목록 표시 (파일명 + 경로)
- 문서 클릭 → 내용 조회 (뷰어)
- 연결/해제 버튼
- 변경 알림 배지 (Claude가 수정한 경우)

**문서 선택 UI**
- workingDir 기반 파일 탐색기 (나중에)
- 또는 경로 직접 입력 (초기 구현)

## 미구현 (향후)

- **사용자 문서 수정** — 클라이언트에서 직접 문서 편집 → Pylon에 동기화
- **실시간 파일 워치** — fs.watch로 외부 변경 감지 (Claude 외의 변경)
- **문서 diff 표시** — 변경 전후 비교 UI
- **문서 버전 히스토리** — 변경 이력 추적

## 구현 단계

전체 기능을 단계별로 나누어 구현한다.

| 단계 | 계층 | 내용 | 상태 |
|------|------|------|------|
| **1. Store** | Pylon | `linkDocument`, `unlinkDocument`, `getLinkedDocuments` | ✅ 완료 |
| 2. Core 타입 | Core | `LinkedDocument` 인터페이스, `Conversation` 필드 추가 | ✅ 완료 |
| 3. 메시지 타입 | Core | 현재 `workspace_sync`로 동기화, 향후 경량 메시지 추가 | ⏳ 보류 |
| **4. Client UI** | Client | 연결 문서 칩 표시 + 클릭 시 뷰어 | ✅ 완료 |
| **4.5. MCP 훅** | Pylon | MCP 훅 핸들러 분리 + link/unlink 도구 | 🔴 진행중 |
| 5. Claude 주입 | Pylon | 세션 시작 시 연결 문서 경로 전달 | ⏳ 대기 |
| 6. 변경 동기화 | Pylon | Claude 수정 감지 → Client 동기화 | ⏳ 대기 |

### 다음 작업: 4.5단계 (MCP 훅)

## 4.5단계: MCP 훅 핸들러 설계

### 배경

MCP 도구는 별도 프로세스로 실행되어 `entityId`를 알 수 없다.
SDK가 MCP 호출 시 전달하는 정보:
- `request.params._meta["claudecode/toolUseId"]` — 도구 호출 ID

### 현재 send_file 동작 방식 (toolComplete 훅)

```
1. MCP send_file → 파일 정보 JSON 반환 (실제 작업 없음)
2. Pylon이 toolComplete 이벤트 수신 (entityId 포함)
3. Pylon.handleSendFileResult(entityId, event)에서 실제 처리
```

**핵심: MCP 도구는 데이터만 반환, 실제 로직은 Pylon의 toolComplete 훅에서 처리**

### 파일 구조

```
packages/pylon/src/mcp/
├── server.ts              # MCP 서버 (Claude에 도구 노출)
├── hooks/                 # ⚠️ toolComplete 훅 핸들러 (꼼수 영역)
│   ├── index.ts           # 핸들러 라우터
│   ├── send-file.ts       # send_file 훅 (pylon.ts에서 이동)
│   └── link-document.ts   # link/unlink 훅 (신규)
└── tools/                 # MCP 도구 정의 (단순 반환)
    ├── send-file.ts       # 기존
    ├── deploy.ts          # 기존
    └── link-document.ts   # 신규 (link_document, unlink_document)
```

### MCP 도구 (tools/link-document.ts)

```typescript
// link_document — 단순히 path 반환
export function executeLinkDocument(args: { path: string }) {
  return {
    content: [{ type: 'text', text: JSON.stringify({
      action: 'link',
      path: args.path
    }) }]
  };
}

// unlink_document — 단순히 path 반환
export function executeUnlinkDocument(args: { path: string }) {
  return {
    content: [{ type: 'text', text: JSON.stringify({
      action: 'unlink',
      path: args.path
    }) }]
  };
}
```

### 훅 핸들러 (hooks/link-document.ts)

```typescript
/**
 * ⚠️ MCP toolComplete 훅
 *
 * MCP 도구는 entityId를 알 수 없으므로, toolComplete 시점에
 * Pylon에서 실제 작업을 수행하는 "꼼수" 구조.
 *
 * 향후 MCP spec이 세션 정보를 전달하게 되면 리팩토링 대상.
 */
export function handleLinkDocumentComplete(
  entityId: EntityId,
  result: string,
  workspaceStore: WorkspaceStore
): void {
  const { action, path } = JSON.parse(result);

  if (action === 'link') {
    workspaceStore.linkDocument(entityId, path);
  } else if (action === 'unlink') {
    workspaceStore.unlinkDocument(entityId, path);
  }
}

---

## 의존성

- 기존 Blob 전송 프로토콜
- WorkspaceStore (Conversation 영속화)
- ClaudeManager (tool 이벤트 모니터링)
- MessageStore (프롬프트 주입 로직)

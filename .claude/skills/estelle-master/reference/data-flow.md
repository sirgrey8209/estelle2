# Estelle 데이터 흐름 레퍼런스

> 코드 기반 분석 (2026-03-02)

## 전체 아키텍처

```
┌─────────┐      ┌─────────┐      ┌─────────┐
│ Client  │◄────►│  Relay  │◄────►│  Pylon  │
│ (React) │  WS  │ (Router)│  WS  │ (State) │
└─────────┘      └─────────┘      └─────────┘
     │                                  │
     └──────── Single Source ───────────┘
                of Truth
```

---

## 1. Pylon 메시지 처리

### handleMessage() 라우팅

| 메시지 타입 | 핸들러 | 처리 |
|-------------|--------|------|
| `auth_result` | `handleAuthResult()` | 인증 완료 → `broadcastWorkspaceList()` |
| `registered` | `handleRegistered()` | 등록 완료 → `broadcastWorkspaceList()` |
| `workspace_*` | `handleWorkspace*()` | Store 업데이트 → 브로드캐스트 |
| `conversation_*` | `handleConversation*()` | Store 업데이트 → 브로드캐스트/대상 전송 |
| `claude_send` | `handleClaudeSend()` | 메시지 저장 → Claude SDK 호출 |
| `claude_control` | `handleClaudeControl()` | stop/new_session/clear/compact |
| `history_request` | `handleHistoryRequest()` | MessageStore 조회 → 100KB 페이징 |
| `blob_*` | `blobHandler.*()` | 청크 처리 → 파일 저장 |

### 응답 전송 패턴

```typescript
// 단일 대상
this.send({
  type: 'history_result',
  to: [from.deviceId],
  payload: { ... }
});

// 브로드캐스트
this.send({
  type: 'workspace_list_result',
  broadcast: 'clients',
  payload: { ... }
});
```

### Claude 이벤트 흐름

```
ClaudeManager 이벤트 발생
        ↓
sendClaudeEvent(conversationId, event)
        ↓
┌───────┴───────────────────────────────┐
│ 1. 이벤트 타입별 메시지 저장           │
│ 2. init → claudeSessionId 업데이트    │
│ 3. result → 사용량 누적               │
│ 4. 세션 뷰어에게만 전송               │
│ 5. state 이벤트 → 전체 브로드캐스트    │
│ 6. 완료 이벤트 → unread 알림          │
└───────────────────────────────────────┘
```

---

## 2. Client 메시지 라우팅

### routeMessage() 분기

```
Relay에서 메시지 수신
        ↓
routeMessage(message)
        ↓
┌───────┴───────────────────────────────────┐
│                                           │
WORKSPACE_LIST_RESULT    CONVERSATION_STATUS
│                        │
├→ workspaceStore        ├→ workspaceStore
├→ conversationStore     └→ conversationStore
├→ settingsStore
└→ syncStore

HISTORY_RESULT           CLAUDE_EVENT
│                        │
├→ conversationStore     └→ conversationStore
└→ syncStore                 ├─ state → setStatus()
                             ├─ text → appendTextBuffer()
                             ├─ textComplete → flushTextBuffer()
                             ├─ tool_* → addMessage()
                             ├─ permission → addPendingRequest()
                             ├─ result → flushTextBuffer() + addMessage()
                             └─ error/aborted → addMessage()
```

### Store별 역할

| Store | 역할 | 주요 상태 |
|-------|------|----------|
| `workspaceStore` | 워크스페이스/대화 목록 | workspacesByPylon, selectedConversation |
| `conversationStore` | 대화별 Claude 상태 | states (Map<conversationId, State>) |
| `syncStore` | 동기화 상태 | syncedFrom, syncedTo, phase |
| `settingsStore` | 계정 설정 | currentAccount |
| `authStore` | Google OAuth | idToken, user |
| `relayStore` | WebSocket 연결 | isConnected, isAuthenticated |

### conversationStore 상태 구조

```typescript
interface ConversationClaudeState {
  status: 'idle' | 'working' | 'permission';
  messages: StoreMessage[];
  textBuffer: string;              // 스트리밍 버퍼
  pendingRequests: PendingRequest[];
  realtimeUsage: RealtimeUsage | null;
}

// conversationId(number)를 키로 각 대화 독립 관리
states: Map<number, ConversationClaudeState>
```

---

## 3. 초기화 시퀀스

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
6. WORKSPACE_LIST_RESULT
   ├→ workspaceStore.setWorkspaces()
   ├→ settingsStore.setAccountStatus()
   └→ 마지막 대화 자동 선택
   ↓
7. CONVERSATION_SELECT 전송
   ↓
8. HISTORY_RESULT
   ├→ conversationStore.setMessages()
   └→ syncStore.setConversationSync()
```

---

## 4. 메시지 송신 흐름

### 사용자 메시지 전송

```
InputBar 입력
    ↓
relaySender.sendClaudeMessage()
    ↓
WebSocket → Relay → Pylon
    ↓
Pylon.handleClaudeSend()
    ├→ MessageStore 저장
    ├→ 사용자 메시지 브로드캐스트 (userMessage 이벤트)
    └→ ClaudeManager.sendMessage()
        ↓
    ClaudeSDKAdapter → Claude Agent SDK
        ↓
    Claude 응답 (stream 이벤트)
        ↓
    ClaudeManager 이벤트 발행
        ↓
    Pylon.sendClaudeEvent()
        ↓
    Relay → WebSocket → Client
        ↓
    routeMessage() → conversationStore
```

### 파일 업로드 흐름

```
이미지 선택
    ↓
blobService.uploadFile()
    ↓
BLOB_START → BLOB_CHUNK(반복) → BLOB_END
    ↓
Pylon.blobHandler
    ├→ 청크 조립
    ├→ 파일 저장 (uploads/)
    └→ 썸네일 생성 (이미지)
    ↓
BLOB_UPLOAD_COMPLETE
    ↓
attachedFileIds에 추가
    ↓
CLAUDE_SEND (첨부파일 포함)
```

---

## 5. 세션 뷰어 관리

### 개념

- 각 Client는 한 시점에 하나의 대화만 "시청"
- Claude 이벤트는 시청자에게만 전송 (대역폭 최적화)
- unread 알림은 시청하지 않는 앱에만 전송

### 흐름

```
CONVERSATION_SELECT 수신
    ↓
registerSessionViewer(deviceId, conversationId)
    ├→ 이전 시청 세션에서 제거
    └→ 새 세션에 등록
    ↓
Claude 이벤트 발생 시
    ↓
getSessionViewers(conversationId)
    ↓
시청자에게만 CLAUDE_EVENT 전송
    ↓
완료 이벤트 발생 시
    ↓
비시청자에게 unread 알림
```

---

## 6. 계정 변경 처리

```
ACCOUNT_STATUS 수신 (또는 WORKSPACE_LIST_RESULT의 account 변경)
    ↓
이전 계정 !== 현재 계정?
    ↓ (Yes)
┌─────────────────────────────────┐
│ 모든 스토어 초기화              │
│ - conversationStore.reset()    │
│ - workspaceStore.reset()       │
│ - syncStore.resetForReconnect()│
└─────────────────────────────────┘
    ↓
syncOrchestrator.startInitialSync()
    ↓
새 계정의 워크스페이스 로드
```

**주의**: 최초 로드 시(`previousAccount === null`)는 초기화하지 않음

---

## 7. 페이징 (히스토리 로드)

### syncStore 추적

```typescript
interface ConversationSyncInfo {
  phase: 'idle' | 'requesting' | 'synced' | 'failed';
  syncedFrom: number;   // 로드된 가장 오래된 인덱스
  syncedTo: number;     // 로드된 가장 최신 인덱스
  totalCount: number;   // 전체 메시지 수
}
```

### 과거 메시지 로드

```
스크롤 상단 도달
    ↓
hasMoreBefore(conversationId)?
    ↓ (Yes)
HISTORY_REQUEST { loadBefore: syncedFrom }
    ↓
Pylon: MessageStore.getMessages(maxBytes: 100KB, loadBefore)
    ↓
HISTORY_RESULT
    ↓
conversationStore.prependMessages()
syncStore.extendSyncedFrom()
```

---

## 8. TextBuffer 플러싱

### 스트리밍 처리

```
text 이벤트 수신 (반복)
    ↓
conversationStore.appendTextBuffer(text)
    ↓
textComplete 또는 result 이벤트 수신
    ↓
conversationStore.flushTextBuffer()
    ├→ textBuffer 내용으로 메시지 생성
    └→ textBuffer 초기화
```

---

## 9. Tool 생명주기

```
tool_start 수신
    ↓
addMessage({ type: 'tool_start', toolUseId, toolName, toolInput })
    ↓
(도구 실행 중...)
    ↓
tool_complete 수신
    ↓
messages에서 같은 toolUseId를 가진 tool_start 역순 검색
    ↓
찾으면 → 교체 (tool_start → tool_complete)
못 찾으면 → 새 메시지 추가
```

---

## 10. Pending Request 처리

### 권한 요청

```
permission_request 이벤트 수신
    ↓
addPendingRequest({ type: 'permission', toolUseId, toolName, toolInput })
setStatus('permission')
    ↓
UI에서 승인/거부 선택
    ↓
CLAUDE_PERMISSION { decision: 'allow'|'deny'|'allowAll' }
    ↓
Pylon → ClaudeManager.handlePermission()
```

### 질문 요청

```
ask_question 이벤트 수신
    ↓
addPendingRequest({ type: 'question', toolUseId, questions[] })
setStatus('permission')
    ↓
UI에서 답변 입력
    ↓
CLAUDE_ANSWER { answer }
    ↓
Pylon → ClaudeManager.handleAnswer()
```

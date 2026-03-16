# Estelle 데이터 흐름 레퍼런스

> 코드 기반 분석 (2026-03-16)

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
| `workspace_*` | `handleWorkspace*()` | Store 업데이트 → `broadcastWorkspaceList()` |
| `conversation_*` | `handleConversation*()` | Store 업데이트 → 브로드캐스트 |
| `claude_send` | `handleClaudeSend()` | 메시지 저장 → AgentManager 호출 |
| `claude_permission` | `handleClaudePermission()` | 권한 응답 → AgentManager |
| `claude_answer` | `handleClaudeAnswer()` | 질문 응답 → AgentManager |
| `claude_control` | `handleClaudeControl()` | stop/new_session/clear/compact |
| `history_request` | `handleHistoryRequest()` | MessageStore 조회 → 100KB 페이징 |
| `conversation_select` | `handleConversationSelect()` | 세션 시청자 등록 → 히스토리 로드 |
| `blob_*` | `blobHandler.*()` | 청크 처리 → 파일 저장 → 썸네일 생성 |
| `widget_*` | `handleWidget*()` | Widget 생명주기 관리 |

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
AgentManager 이벤트 발생
        ↓
sendClaudeEvent(conversationId, event)
        ↓
┌───────┴──────────────────────────────────┐
│ 1. saveEventToHistory() - 메시지 저장     │
│ 2. init → claudeSessionId 업데이트       │
│ 3. result → 사용량 누적 (accumulateUsage)│
│ 4. Viewer 검증 → 시청자에게만 전송       │
│ 5. state 이벤트 → 전체 브로드캐스트      │
│ 6. 완료 이벤트 → unread 알림 (비시청자)  │
└───────────────────────────────────────────┘
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

WIDGET_READY/RENDER      WIDGET_COMPLETE
│                        │
├→ setWidgetPending()    └→ setWidgetComplete()
└→ auto-claim 조건 검증
```

### Store별 역할

| Store | 역할 | 주요 상태 |
|-------|------|----------|
| `workspaceStore` | 워크스페이스/대화 목록 | workspacesByPylon, selectedConversation |
| `conversationStore` | 대화별 Claude 상태 | states (Map<conversationId, State>) |
| `syncStore` | 동기화 상태 | syncedFrom, syncedTo, phase |
| `settingsStore` | 계정 설정 | currentAccount, pylonAccounts |
| `authStore` | Google OAuth | idToken, user |
| `relayStore` | WebSocket 연결 | isConnected, isAuthenticated, deviceId |

### conversationStore 상태 구조

```typescript
interface ConversationClaudeState {
  status: 'idle' | 'working' | 'permission';
  messages: StoreMessage[];
  textBuffer: string;              // 스트리밍 버퍼
  pendingRequests: PendingRequest[];
  realtimeUsage: RealtimeUsage | null;
  widgetSession?: {               // 위젯 세션 (새로 추가)
    sessionId: string;
    toolUseId: string;
    view: ViewNode;
    status: 'pending' | 'claiming' | 'running' | 'complete';
  };
  slashCommands?: string[];
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
    ├→ requestWorkspaceList() 전송
    └→ 5초 타임아웃 설정 (최대 3회 재시도)
    ↓
 6. Pylon.broadcastWorkspaceList()
    ├→ 워크스페이스 목록 브로드캐스트
    ├→ 태스크/워커 정보 추가
    └→ 캐싱된 계정 정보 포함
    ↓
 7. WORKSPACE_LIST_RESULT 수신
    ├→ workspaceStore.setWorkspaces()
    ├→ settingsStore.setAccountStatus()
    ├→ 계정 변경 시 모든 스토어 리셋
    └→ 마지막 대화 자동 선택
    ↓
 8. syncOrchestrator.onWorkspaceListReceived(selectedConversationId)
    ↓
 9. CONVERSATION_SELECT 전송
    ↓
10. Pylon.handleConversationSelect()
    ├→ registerSessionViewer() - 시청자 등록
    └→ loadMessageSession() - 메시지 lazy loading
    ↓
11. HISTORY_RESULT 수신
    ├→ conversationStore.setMessages()
    ├→ syncStore.setConversationSync()
    └→ 활성 세션 정보 포함 (hasActiveSession, currentStatus)
```

---

## 4. 메시지 송신 흐름

### 사용자 메시지 전송

```
InputBar 입력
    ↓
relaySender.sendClaudeMessage()
    ├→ conversationId에서 pylonId 추출
    └→ WebSocket → Relay → Pylon
    ↓
Pylon.handleClaudeSend()
    ├→ 첨부 파일 처리 (pendingFiles)
    ├→ MessageStore.addUserMessage() 저장
    ├→ 사용자 메시지 브로드캐스트 (userMessage 이벤트)
    └→ AgentManager.sendMessage()
        ├→ agentType별 어댑터 선택 (Claude/Codex)
        ├→ systemPrompt 결정 (customSystemPrompt 우선)
        ├→ systemReminder 빌드 (linkedDocuments, autorun)
        └→ SDK 호출
        ↓
    SDK Adapter → Claude Agent SDK / Codex SDK
        ↓
    응답 (stream 이벤트)
        ├→ init (세션 시작)
        ├→ state (idle/working/permission)
        ├→ text (스트리밍, 반복)
        ├→ textComplete (스트림 종료)
        ├→ tool_start / tool_complete (도구)
        ├→ permission_request / ask_question
        ├→ file_attachment, usage_update
        └→ result (최종, 사용량 정산)
        ↓
    Pylon.sendClaudeEvent()
        ├→ saveEventToHistory()
        ├→ 시청자에게만 전송 (to: [viewers])
        ├→ state → CONVERSATION_STATUS 브로드캐스트
        └→ 완료 → sendUnreadToNonViewers()
        ↓
    Relay → WebSocket → Client
        ↓
    routeMessage() → conversationStore 업데이트
```

### 파일 업로드 흐름

```
이미지/파일 선택
    ↓
blobService.uploadFile()
    ↓
BLOB_START → BLOB_CHUNK(반복) → BLOB_END
    ↓
Pylon.blobHandler
    ├→ 청크 조립
    ├→ 파일 저장 (uploads/{conversationId}/)
    └→ 썸네일 생성 (이미지, 비동기)
    ↓
BLOB_UPLOAD_COMPLETE
    ↓
pendingFiles.set(conversationId, { path, filename, thumbnail })
    ↓
CLAUDE_SEND (attachedFileIds 포함)
    ├→ pendingFiles에서 첨부
    └→ 메시지와 함께 에이전트에 전송
```

---

## 5. 세션 뷰어 관리

### 개념

- 각 Client는 한 시점에 하나의 대화만 "시청"
- Claude 이벤트는 시청자에게만 전송 (대역폭 최적화)
- unread 알림은 시청하지 않는 앱에만 전송
- appUnreadSent: 이미 알림을 보낸 앱 추적 (중복 방지)

### 흐름

```
CONVERSATION_SELECT 수신
    ↓
Pylon.handleConversationSelect()
    ├→ registerSessionViewer(deviceId, conversationId)
    │  ├→ 이전 시청 세션에서 제거
    │  └→ 새 세션에 등록
    ├→ loadMessageSession() - lazy loading
    └→ hasActiveSession, currentStatus 포함 전송
    ↓
Claude 이벤트 발생 시
    ├→ getSessionViewers(conversationId) 조회
    ├→ viewers에게만 전송
    └→ 완료 이벤트 → sendUnreadToNonViewers()
        ├→ appUnreadSent 확인 (중복 방지)
        └→ CONVERSATION_STATUS (unread: true) 전송
    ↓
클라이언트 연결 해제
    ├→ unregisterSessionViewer(deviceId)
    └→ appUnreadSent에서 제거
```

---

## 6. 계정 변경 처리

### 파일런별 계정 추적

```typescript
settingsStore.pylonAccounts: Map<pylonId, AccountType>
```

### 계정 변경 감지

```
WORKSPACE_LIST_RESULT 수신 (또는 ACCOUNT_STATUS)
    ↓
account.current 추출
    ↓
settingsStore.getPylonAccount(pylonId) 조회
    ↓
이전 계정 !== 현재 계정?
    ↓ (Yes)
최초 로드가 아닌가? (previousAccount !== null)
    ├→ (Yes) 계정 전환 감지!
    │  ├→ conversationStore.reset()
    │  ├→ workspaceStore.reset()
    │  ├→ syncStore.resetForReconnect()
    │  └→ syncOrchestrator.startInitialSync()
    └→ (No) 초기 로드 - 초기화하지 않음
    ↓
settingsStore.setPylonAccount(pylonId, newAccount)
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
  loadingMore: boolean; // 페이징 중
}
```

### 과거 메시지 로드

```
스크롤 상단 도달
    ↓
hasMoreBefore(conversationId)?
    ↓ (Yes)
setLoadingMore() → UI 로딩 표시
    ↓
HISTORY_REQUEST { conversationId, loadBefore: syncedFrom }
    ↓
Pylon: MessageStore.getMessages(maxBytes: 100KB, loadBefore)
    ├→ hasMore 계산
    │  ├→ 초기 로드: messages.length < totalCount
    │  └→ 페이징: (loadBefore - messages.length) > 0
    └→ HISTORY_RESULT 응답
    ↓
Client routeMessage()
    ├→ if (loadBefore > 0) /* 추가 로드 */
    │  ├→ conversationStore.prependMessages()
    │  └→ syncStore.extendSyncedFrom()
    └→ else /* 초기 로드 */
       ├→ conversationStore.clearMessages() + setMessages()
       └→ syncStore.setConversationSync()
    ↓
setLoadingMore(false) → UI 로딩 해제
```

---

## 8. TextBuffer 플러싱

### 스트리밍 처리

```
text 이벤트 수신 (반복)
    ↓
conversationStore.appendTextBuffer(conversationId, text)
    ↓
textComplete 또는 result 이벤트 수신
    ↓
conversationStore.flushTextBuffer(conversationId)
    ├→ AssistantTextMessage 생성
    ├→ messages에 추가
    └→ textBuffer 초기화 ("")
```

---

## 9. Tool 생명주기

### tool_start → tool_complete 교체

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
    ├→ 찾으면 → 교체 (tool_start → tool_complete)
    └→ 못 찾으면 → 새 메시지 추가
```

### Compact Tool (특수)

```
compactStart → tool_start { toolName: 'Compact' } 추가
compactComplete → tool_complete로 교체 (output: formatted token count)
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
사용자 승인/거부/전체승인
    ↓
CLAUDE_PERMISSION { decision: 'allow'|'deny'|'allowAll' }
    ↓
Pylon → AgentManager.respondPermission()
```

### 질문 요청

```
ask_question 이벤트 수신
    ↓
addPendingRequest({ type: 'question', toolUseId, questions[] })
setStatus('permission')
    ↓
사용자 답변
    ↓
CLAUDE_ANSWER { answer }
    ↓
Pylon → AgentManager.respondQuestion()
```

---

## 11. Widget 생명주기

### 준비 단계

```
CLI에서 위젯 시작 (MCP 도구)
    ↓
Pylon.broadcastWidgetReady()
    ├→ lastActiveClient(conversationId) 조회
    ├→ preferredClientId 결정
    └→ WIDGET_READY 브로드캐스트 → 모든 클라이언트
    ↓
Client routeMessage()
    └→ setWidgetPending(conversationId, toolUseId, sessionId)
```

### Auto-Claim

```
WIDGET_READY 수신
    ↓
조건 검증
    ├→ myDeviceId === preferredClientId?
    ├→ 현재 선택된 대화인가?
    └→ 채팅 화면이 보이는가?
    ↓
세 조건 모두 만족
    ├→ setWidgetClaiming() → 스피너 표시
    └→ sendWidgetClaim(sessionId)
    ↓
아니면 사용자 수동 클릭 대기
```

### 실행 단계

```
WIDGET_CLAIM 수신 → Pylon에서 소유권 확인
    ↓
WIDGET_RENDER 전송 (소유자에게)
    ├→ sessionId, view(ViewNode)
    └→ WidgetRenderer 마운트
    ↓
양방향 통신
    ├→ WIDGET_INPUT (Client → Pylon → CLI)
    └→ WIDGET_EVENT (Pylon ↔ Client, v2)
```

### 완료 단계

```
CLI 완료 → Pylon.broadcastWidgetComplete()
    ├→ WIDGET_COMPLETE 브로드캐스트
    ├→ 결과 페이지(view) + result 포함
    └→ 모든 클라이언트에 전송
    ↓
Client routeMessage()
    └→ setWidgetComplete() → 완료 페이지 렌더
```

### Widget Check (유효성)

```
대화 선택 시 기존 widgetSession 발견
    ↓
sendWidgetCheck(conversationId, sessionId)
    ↓
Pylon: WidgetManager.getSession(sessionId)
    ↓
WIDGET_CHECK_RESULT { valid }
    ├→ valid=true → 유지
    └→ valid=false → clearWidgetSession()
```

---

## 12. 성능 최적화

### Debounce 저장

```typescript
WORKSPACE_SAVE_DEBOUNCE_MS = 300   // WorkspaceStore
MESSAGE_SAVE_DEBOUNCE_MS = 1000    // MessageStore
```

### Lazy Loading

- 대화 선택 시에만 메시지 로드 (loadMessageSession)
- 불필요한 대화는 메모리에서 언로드

### 100KB 페이징

- HISTORY_REQUEST 응답 시 maxBytes: 100KB 제한
- 네트워크 대역폭 + UI 렌더링 최적화

### Widget 소유권

- preferredClientId 기반 auto-claim
- 사용자 개입 최소화

---

## 주요 업데이트 (2026-03-03 이후)
- Widget 전체 생명주기 흐름 추가 (Ready → Claim → Render → Complete)
- Widget Check 유효성 검사 흐름 추가
- AgentManager로 리네이밍 (ClaudeManager → AgentManager)
- Codex SDK 어댑터 추가 (agentType별 분기)
- 초기화 시퀀스 상세화 (타임아웃, 재시도, 계정 캐시)
- 세션 뷰어의 appUnreadSent 중복 방지 메커니즘 추가
- broadcastWorkspaceList()에 태스크/워커/계정 정보 포함

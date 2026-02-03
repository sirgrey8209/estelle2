# 마이그레이션 체크리스트

> estelle (JS) → estelle2 (TS) 마이그레이션
>
> **원칙**:
> - 테스트 꼼꼼히 작성할 것
> - 주석 꼼꼼히 작성할 것
> - 존재하는 내용 전부 빼놓지 않고 마이그레이션

---

## 최종 결과 요약

| 패키지 | 테스트 수 | 상태 | 완료일 |
|--------|-----------|------|--------|
| @estelle/core | 337개 | ✅ 완료 | 2026-01-31 |
| @estelle/relay | 96개 | ✅ 완료 | 2026-01-31 |
| @estelle/pylon | 427개 | ✅ 완료 | 2026-01-31 |
| packages/app | 55개 Dart 파일 | ✅ 완료 | 2026-01-31 |

**총 860개 테스트 통과**

---

## 1. @estelle/core (estelle-shared → packages/core) ✅ 완료

> **337개 테스트 통과** (2026-01-31)

공유 타입, 상수, 헬퍼 함수

### 1.1 타입 정의

- [x] **DeviceId 타입**
  - `DeviceType`: 'pylon' | 'desktop' | 'mobile' | 'relay'
  - `DeviceId`: { pcId, deviceType }

- [x] **Message 타입**
  - `Message<T>`: { type, payload, from?, to?, timestamp, requestId? }
  - 모든 Payload 타입들

- [x] **인증 타입**
  - `AuthPayload`: { pcId, deviceType, mac? }
  - `AuthResultPayload`: { success, error?, deviceId? }

- [x] **데스크 타입**
  - `DeskStatusType`: 'idle' | 'working' | 'permission' | 'offline'
  - `DeskInfo`: { pcId, pcName, deskId, deskName, workingDir, status, isActive }
  - `DeskListResultPayload`

- [x] **Claude 이벤트 타입**
  - `ClaudeStateEvent`
  - `ClaudeTextEvent`
  - `ClaudeToolStartEvent`
  - `ClaudeToolCompleteEvent`
  - `ClaudePermissionRequestEvent`
  - `ClaudeAskQuestionEvent`
  - `ClaudeResultEvent`
  - `ClaudeErrorEvent`
  - `ClaudeEvent` (유니온)
  - `ClaudeEventPayload`

- [x] **Claude 제어 타입**
  - `ClaudeSendPayload`
  - `ClaudePermissionPayload`
  - `ClaudeAnswerPayload`
  - `ClaudeControlPayload`
  - `SetPermissionModePayload`

- [x] **Blob 전송 타입**
  - `Attachment`
  - `BlobStartPayload`
  - `BlobChunkPayload`
  - `BlobEndPayload`
  - `BlobAckPayload`
  - `BlobRequestPayload`

### 1.2 상수

- [x] **MessageType** 상수 객체
  - AUTH, AUTH_RESULT
  - CONNECTED, REGISTERED, DEVICE_STATUS
  - DESK_LIST, DESK_LIST_RESULT, DESK_SWITCH, DESK_CREATE, DESK_DELETE, DESK_RENAME, DESK_STATUS
  - CLAUDE_SEND, CLAUDE_EVENT, CLAUDE_PERMISSION, CLAUDE_ANSWER, CLAUDE_CONTROL, CLAUDE_SET_PERMISSION_MODE
  - BLOB_START, BLOB_CHUNK, BLOB_END, BLOB_ACK, BLOB_REQUEST
  - PING, PONG, ERROR

- [x] **DeskStatus** 상수
  - IDLE, WORKING, PERMISSION, OFFLINE

- [x] **ClaudeEventType** 상수
  - STATE, TEXT, TOOL_START, TOOL_COMPLETE, PERMISSION_REQUEST, ASK_QUESTION, RESULT, ERROR

- [x] **PermissionMode** 상수
  - DEFAULT, ACCEPT_EDITS, BYPASS

- [x] **BlobConfig** 상수
  - CHUNK_SIZE (65536)
  - ENCODING ('base64')

- [x] **CHARACTERS** 상수 (디바이스 캐릭터 정보)

### 1.3 헬퍼 함수

- [x] `createMessage<T>(type, payload, options?)` - 메시지 생성
- [x] `getCharacter(pcId)` - 캐릭터 정보 조회
- [x] `getDeskFullName(pcId, deskName)` - 데스크 전체 이름

### 1.4 테스트

- [x] 타입 가드 테스트 (isAuthMessage, isClaudeEvent 등)
- [x] createMessage 테스트
- [x] getCharacter 테스트
- [x] getDeskFullName 테스트

---

## 2. @estelle/relay (estelle-relay → packages/relay) ✅ 완료

> **96개 테스트 통과** (2026-01-31)

순수 라우터 (상태 없음, 순수 함수)

### 2.1 인증 모듈 (auth.ts)

- [x] **DEVICES** 상수 (고정 디바이스 정의)
  - deviceId, name, icon, role, allowedIps

- [x] **DYNAMIC_DEVICE_ID_START** 상수 (100)

- [x] `authenticateDevice(deviceId, deviceType, ip, devices)` 순수 함수

- [x] `assignDynamicDeviceId(nextId)` 순수 함수

- [x] 테스트: Pylon 인증 성공/실패, App 동적 ID 할당

### 2.2 라우팅 모듈 (router.ts)

- [x] **Client 인터페이스**
  - ws, deviceId, deviceType, ip, connectedAt, authenticated

- [x] `sendTo(client, message)` 순수 함수

- [x] `sendToDevice(deviceId, deviceType?, clients)` 순수 함수

- [x] `broadcast(message, clients, excludeClientId?)` 순수 함수

- [x] `broadcastToType(deviceType, message, clients, excludeClientId?)` 순수 함수

- [x] `broadcastExceptType(excludeType, message, clients, excludeClientId?)` 순수 함수

- [x] `getDeviceList(clients)` 순수 함수

- [x] `getDeviceInfo(deviceId)` 순수 함수

- [x] 테스트: 각 라우팅 함수 동작 검증

### 2.3 메시지 핸들러 (handler.ts)

- [x] `handleAuth(clientId, data, state)` - 인증 처리
- [x] `handleGetDevices(clientId, state)` - 디바이스 목록
- [x] `handlePing(clientId)` - Ping/Pong
- [x] `handleRouting(clientId, data, state)` - 순수 라우팅

- [x] 테스트: 각 핸들러 동작 검증

### 2.4 유틸리티 (utils.ts)

- [x] `log(message)` - 타임스탬프 로깅
- [x] `getClientIp(req)` - 클라이언트 IP 추출

### 2.5 WebSocket 서버 (server.ts) - Adapter 계층

- [x] WebSocket.Server 래핑
- [x] 연결/해제 이벤트 처리
- [x] 메시지 라우팅

- [x] 통합 테스트 (E2E)

---

## 3. @estelle/pylon (estelle-pylon → packages/pylon) ✅ 완료

> **427개 테스트 통과** (2026-01-31)

Claude SDK 실행, 상태 관리

### 3.1 PylonState (순수 데이터 클래스)

- [x] **상태 필드**
  - deviceId
  - authenticated
  - deviceInfo
  - sessionViewers: Map<sessionId, Set<clientDeviceId>>
  - appUnreadSent: Map<appId, Set<conversationId>>
  - pendingFiles: Map<conversationId, Map<fileId, FileInfo>>
  - claudeUsage: { totalCostUsd, totalInputTokens, ... }

- [x] `handlePacket(packet)` - 외부 패킷 처리
- [x] `handleClaude(event)` - Claude SDK 이벤트 처리

- [x] 테스트: 상태 변경 검증

### 3.2 WorkspaceStore (workspaceStore.ts)

- [x] **Workspace 타입**
  - workspaceId, name, workingDir, conversations[]

- [x] **Conversation 타입**
  - conversationId, name, claudeSessionId, status, unread, permissionMode

- [x] CRUD 함수
  - `getAllWorkspaces()`
  - `getWorkspace(workspaceId)`
  - `createWorkspace(name, workingDir)`
  - `updateWorkspace(workspaceId, data)`
  - `deleteWorkspace(workspaceId)`

- [x] 대화 관리
  - `getConversation(conversationId)`
  - `createConversation(workspaceId, name)`
  - `updateConversation(conversationId, data)`
  - `deleteConversation(conversationId)`

- [x] 활성 상태 관리
  - `setActiveWorkspace(workspaceId)`
  - `setActiveConversation(conversationId)`
  - `getActiveWorkspace()`
  - `getActiveConversation()`

- [x] 권한 모드 관리
  - `setConversationPermissionMode(conversationId, mode)`
  - `getConversationPermissionMode(conversationId)`

- [x] `resetActiveConversations()` - 시작 시 상태 초기화

- [x] 테스트: 모든 CRUD 및 상태 관리

### 3.3 MessageStore (messageStore.ts)

- [x] **MessageEntry 타입**
  - 다양한 메시지 형태 (text, toolStart, toolComplete, etc.)

- [x] 메모리 캐시 + Debounced 파일 저장

- [x] `addUserMessage(conversationId, content, attachments?)`
- [x] `addAssistantText(conversationId, text)`
- [x] `addToolStart(conversationId, toolName, input)`
- [x] `addToolComplete(conversationId, toolName, output, success)`
- [x] `addClaudeAborted(conversationId, reason)`
- [x] `addResult(conversationId, result)`

- [x] `getMessages(conversationId, options?)` - 페이징 지원
- [x] `getLatestMessages(conversationId, count)`
- [x] `saveAll()` - 전체 저장 (종료 시)

- [x] `summarizeToolInput(toolName, input)` - 히스토리용 요약
- [x] `summarizeOutput(output)` - 출력 요약

- [x] 테스트: 메시지 추가/조회, 페이징, 파일 저장

### 3.4 ClaudeManager (claudeManager.ts)

- [x] **Session 타입**
  - query, abortController, claudeSessionId, state, partialText

- [x] `send(sessionId, message, options)` - Claude에 메시지 전송
- [x] `stop(sessionId)` - 세션 중단
- [x] `handlePermissionDecision(sessionId, toolUseId, decision)`
- [x] `handleAnswer(sessionId, toolUseId, answer)`

- [x] 자동 허용/거부 규칙
  - autoAllowTools: Read, Glob, Grep, WebSearch, WebFetch, TodoWrite
  - autoDenyPatterns: .env, 위험한 명령어

- [x] 권한 모드 지원
  - DEFAULT, ACCEPT_EDITS, BYPASS

- [x] 이벤트 방출
  - init, stateUpdate, textComplete, toolInfo, toolComplete
  - askQuestion, permission_request, result, error, state

- [x] 로깅 (JSONL 형태)

- [x] 테스트: 메시지 전송, 권한 처리, 이벤트 방출

### 3.5 BlobHandler (blobHandler.ts)

- [x] **Transfer 타입**
  - blobId, filename, mimeType, totalSize, chunks, etc.

- [x] `handleBlobStart(message)` - 전송 시작
- [x] `handleBlobChunk(message)` - 청크 수신
- [x] `handleBlobEnd(message)` - 전송 완료
- [x] `handleBlobRequest(message)` - 파일 요청

- [x] 동일 디바이스 최적화 (localPath 직접 사용)

- [x] 테스트: 파일 전송 시나리오

### 3.6 LocalServer (localServer.ts)

- [x] 로컬 WebSocket 서버 (Desktop App 연결용)
- [x] Relay 상태 콜백
- [x] 연결/해제 이벤트

- [x] 테스트: 로컬 연결 시나리오

### 3.7 Logger & PacketLogger

- [x] `logger.ts` - 파일 로깅
- [x] `packetLogger.ts` - 패킷 로깅 (recv/send 방향)

### 3.8 기타 모듈

- [x] **RelayClient** - Relay 연결 클라이언트
  - connect, send, reconnect 로직

- [x] **PidManager** - 프로세스 ID 관리
  - initialize, cleanup

- [x] **FolderManager** - 폴더 구조 관리

- [x] **TaskManager** - 태스크 CRUD, 파일 저장

- [x] **WorkerManager** - 태스크 실행 (TaskManager 의존)

### 3.9 메시지 핸들러 (index.js에서 분리)

- [x] Workspace 메시지 핸들러
  - workspace_list, workspace_create, workspace_update, workspace_delete
  - workspace_switch

- [x] Conversation 메시지 핸들러
  - conversation_list, conversation_create, conversation_update, conversation_delete
  - conversation_switch

- [x] Claude 메시지 핸들러
  - claude_send, claude_permission, claude_answer, claude_control
  - claude_set_permission_mode

- [x] Blob 메시지 핸들러
  - blob_start, blob_chunk, blob_end, blob_request

- [x] History 메시지 핸들러
  - get_history

- [x] 기타 핸들러
  - get_status, get_devices, ping

### 3.10 Pylon 클래스 (Adapter 계층)

- [x] 초기화 로직
- [x] Relay 연결 관리
- [x] LocalServer 연결 관리
- [x] 메시지 라우팅
- [x] 종료 처리

- [x] 통합 테스트 (E2E)

---

## 4. packages/app (estelle-app → packages/app) ✅ 완료

> **55개 Dart 파일 마이그레이션** (2026-01-31)

Flutter 클라이언트 (기존 유지, 타입 동기화만)

### 4.1 타입 동기화

- [x] Dart 타입과 @estelle/core 타입 일치 확인
- [x] 메시지 구조 검증

### 4.2 코드 이전

- [x] lib/ 폴더 전체 복사 및 정리
- [x] Riverpod 상태 관리 유지

---

## 마이그레이션 순서 (완료)

```
1단계: @estelle/core ✅
 └─ 모든 타입, 상수, 헬퍼 함수 (테스트 포함)

2단계: @estelle/relay ✅
 └─ 순수 함수들 (auth, router, handler)
 └─ Adapter (WebSocket 서버)

3단계: @estelle/pylon ✅
 └─ 순수 데이터 클래스들 (WorkspaceStore, MessageStore)
 └─ ClaudeManager
 └─ BlobHandler
 └─ Adapters (LocalServer, RelayClient)

4단계: packages/app ✅
 └─ 기존 코드 복사
 └─ 타입 동기화
```

---

## 제외 항목

| 항목 | 이유 |
|------|------|
| FileSimulator | 테스트용 기능, 현재 불필요 |
| FlutterDevManager | 미완성 기능, 추후 별도 구현 |
| 자동 업데이트 (checkAndUpdate, fetchDeployJson) | 문제가 많았던 기능, 완전 제외 |

## 결정된 항목

| 항목 | 결정 |
|------|------|
| TaskManager + WorkerManager | 둘 다 유지 (WorkerManager가 TaskManager 의존) |
| CommonJS/ESM 혼용 | TypeScript로 통일하면서 해결 |

---

*작성일: 2026-01-31*
*완료일: 2026-02-01*
*검증일: 2026-02-01 (모든 테스트 통과 확인)*

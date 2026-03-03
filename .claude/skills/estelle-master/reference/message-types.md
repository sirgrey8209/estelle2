# Estelle 메시지 타입 레퍼런스

> 코드 기반 분석 (2026-03-02)

## 메시지 기본 구조

```typescript
interface Message<T = unknown> {
  type: string;              // 메시지 타입
  payload: T;                // 실제 데이터
  timestamp: number;         // Unix timestamp (ms)
  from?: DeviceId | null;    // 발신자
  to?: number[] | null;      // 수신자 pylonId 배열
  requestId?: string | null; // 요청-응답 매칭 ID
}
```

---

## 1. Auth (인증)

| 타입 | 방향 | Payload | 용도 |
|------|------|---------|------|
| `AUTH` | Client → Relay | `{ token, deviceType, deviceId?, idToken? }` | 인증 요청 |
| `AUTH_RESULT` | Relay → Client | `{ success, device?, error? }` | 인증 결과 |

---

## 2. Connection (연결)

| 타입 | 방향 | Payload | 용도 |
|------|------|---------|------|
| `CONNECTED` | Relay → Client | `{ message? }` | WebSocket 연결 완료 |
| `REGISTERED` | Pylon → Client | - | Pylon 등록 완료 |
| `DEVICE_STATUS` | Pylon → Client | `{ deviceId, status, name? }` | 디바이스 상태 변경 |
| `CLIENT_DISCONNECT` | Relay → Pylon | `{ deviceId }` | 클라이언트 연결 해제 |

---

## 3. Workspace

| 타입 | 방향 | Payload | 용도 |
|------|------|---------|------|
| `WORKSPACE_LIST` | Client → Pylon | - | 목록 요청 |
| `WORKSPACE_LIST_RESULT` | Pylon → Client | `{ deviceId, workspaces, activeWorkspaceId?, activeConversationId?, account? }` | 목록 응답 |
| `WORKSPACE_CREATE` | Client → Pylon | `{ name, workingDir }` | 생성 요청 |
| `WORKSPACE_CREATE_RESULT` | Pylon → Client | `{ success, workspace?, conversation? }` | 생성 응답 |
| `WORKSPACE_DELETE` | Client → Pylon | `{ workspaceId }` | 삭제 요청 |
| `WORKSPACE_UPDATE` | Client → Pylon | `{ workspaceId, data }` | 수정 요청 |
| `WORKSPACE_REORDER` | Client → Pylon | `{ workspaceIds }` | 순서 변경 |
| `WORKSPACE_RENAME` | Client → Pylon | `{ workspaceId, newName }` | 이름 변경 |

---

## 4. Conversation

| 타입 | 방향 | Payload | 용도 |
|------|------|---------|------|
| `CONVERSATION_CREATE` | Client → Pylon | `{ workspaceId, name? }` | 대화 생성 |
| `CONVERSATION_CREATE_RESULT` | Pylon → Client | `{ success, conversation? }` | 생성 응답 |
| `CONVERSATION_SELECT` | Client → Pylon | `{ conversationId, workspaceId? }` | 대화 선택 |
| `CONVERSATION_STATUS` | Pylon → Client | `{ deviceId, conversationId, status?, unread? }` | 상태 변경 |
| `CONVERSATION_DELETE` | Client → Pylon | `{ conversationId }` | 삭제 |
| `CONVERSATION_RENAME` | Client → Pylon | `{ conversationId, newName }` | 이름 변경 |
| `CONVERSATION_REORDER` | Client → Pylon | `{ workspaceId, conversationIds }` | 순서 변경 |
| `HISTORY_REQUEST` | Client → Pylon | `{ conversationId, loadBefore? }` | 히스토리 요청 |
| `HISTORY_RESULT` | Pylon → Client | `{ conversationId, messages, hasMore, totalCount, currentStatus? }` | 히스토리 응답 |

---

## 5. Claude

| 타입 | 방향 | Payload | 용도 |
|------|------|---------|------|
| `CLAUDE_SEND` | Client → Pylon | `{ conversationId, message, attachedFileIds?, attachments? }` | 메시지 전송 |
| `CLAUDE_EVENT` | Pylon → Client | `{ conversationId, event }` | Claude 이벤트 |
| `CLAUDE_PERMISSION` | Client → Pylon | `{ conversationId, toolUseId, decision }` | 권한 응답 |
| `CLAUDE_ANSWER` | Client → Pylon | `{ conversationId, toolUseId, answer }` | 질문 응답 |
| `CLAUDE_CONTROL` | Client → Pylon | `{ conversationId, action }` | 제어 (stop/new_session/clear/compact) |
| `CLAUDE_SET_PERMISSION_MODE` | Client → Pylon | `{ conversationId, mode }` | 권한 모드 설정 |

### Claude Event 서브타입

| event.type | Payload | 용도 |
|------------|---------|------|
| `init` | `{ session_id, tools? }` | 세션 초기화 |
| `state` | `{ state: 'idle'|'working'|'permission' }` | 상태 변경 |
| `text` | `{ text }` | 텍스트 스트리밍 |
| `textComplete` | - | 텍스트 완료 |
| `tool_start` | `{ toolUseId, toolName, toolInput, parentToolUseId? }` | 도구 시작 |
| `tool_complete` | `{ toolUseId, toolName, success, output?, error? }` | 도구 완료 |
| `permission_request` | `{ toolUseId, toolName, toolInput }` | 권한 요청 |
| `ask_question` | `{ toolUseId, questions[] }` | 질문 요청 |
| `result` | `{ usage, duration_ms }` | 작업 완료 |
| `error` | `{ message }` | 에러 |
| `aborted` | `{ reason: 'user'|'session_ended' }` | 중단 |
| `file_attachment` | `{ file }` | 파일 첨부 |
| `usage_update` | `{ usage }` | 실시간 사용량 |
| `compactStart` | - | 컴팩트 시작 |
| `compactComplete` | `{ preTokens? }` | 컴팩트 완료 |

---

## 6. Blob (파일 전송)

| 타입 | 방향 | Payload | 용도 |
|------|------|---------|------|
| `BLOB_START` | Client → Pylon | `{ blobId, filename, mimeType, size, totalChunks }` | 전송 시작 |
| `BLOB_CHUNK` | Client → Pylon | `{ blobId, chunkIndex, data(base64) }` | 청크 전송 |
| `BLOB_END` | Client → Pylon | `{ blobId }` | 전송 완료 |
| `BLOB_ACK` | Pylon → Client | `{ blobId, chunkIndex?, success, serverPath? }` | 전송 확인 |
| `BLOB_REQUEST` | Client → Pylon | `{ blobId }` | 다운로드 요청 |
| `BLOB_UPLOAD_COMPLETE` | Pylon → Client | `{ blobId, serverPath }` | 업로드 완료 |

---

## 7. Document

| 타입 | 방향 | Payload | 용도 |
|------|------|---------|------|
| `LINK_DOCUMENT` | Client → Pylon | `{ conversationId, path }` | 문서 연결 |
| `UNLINK_DOCUMENT` | Client → Pylon | `{ conversationId, path }` | 문서 해제 |

---

## 8. Folder

| 타입 | 방향 | Payload | 용도 |
|------|------|---------|------|
| `FOLDER_LIST` | Client → Pylon | `{ path }` | 폴더 목록 요청 |
| `FOLDER_LIST_RESULT` | Pylon → Client | `{ folders }` | 폴더 목록 응답 |
| `FOLDER_CREATE` | Client → Pylon | `{ parentPath, name }` | 폴더 생성 |
| `FOLDER_CREATE_RESULT` | Pylon → Client | `{ success }` | 생성 응답 |

---

## 9. Task & Worker

| 타입 | 방향 | Payload | 용도 |
|------|------|---------|------|
| `TASK_LIST` | Client → Pylon | `{ workspaceId }` | 태스크 목록 |
| `TASK_LIST_RESULT` | Pylon → Client | `{ tasks }` | 태스크 응답 |
| `TASK_GET` | Client → Pylon | `{ workspaceId, taskId }` | 태스크 조회 |
| `TASK_GET_RESULT` | Pylon → Client | `{ task }` | 태스크 응답 |
| `TASK_STATUS` | Client → Pylon | `{ workspaceId, taskId, status }` | 상태 변경 |
| `WORKER_STATUS` | Client → Pylon | `{ workspaceId }` | 워커 상태 |
| `WORKER_STATUS_RESULT` | Pylon → Client | `{ status }` | 워커 응답 |
| `WORKER_START` | Client → Pylon | `{ workspaceId }` | 워커 시작 |
| `WORKER_STOP` | Client → Pylon | `{ workspaceId }` | 워커 정지 |

---

## 10. Account & Settings

| 타입 | 방향 | Payload | 용도 |
|------|------|---------|------|
| `ACCOUNT_SWITCH` | Client → Pylon | `{ accountId }` | 계정 전환 |
| `ACCOUNT_STATUS` | Pylon → Client | `{ accountId, status }` | 계정 상태 |
| `USAGE_REQUEST` | Client → Pylon | - | 사용량 요청 |
| `USAGE_RESPONSE` | Pylon → Client | `{ usage }` | 사용량 응답 |

---

## 11. Share

| 타입 | 방향 | Payload | 용도 |
|------|------|---------|------|
| `SHARE_CREATE` | Client → Pylon | `{ conversationId }` | 공유 생성 |
| `SHARE_CREATE_RESULT` | Pylon → Client | `{ shareId, url }` | 공유 응답 |
| `SHARE_HISTORY` | Viewer → Pylon | `{ shareId }` | 공유 히스토리 |

---

## 12. Utility

| 타입 | 방향 | Payload | 용도 |
|------|------|---------|------|
| `PING` | Client → Pylon | - | 연결 확인 |
| `PONG` | Pylon → Client | `{ timestamp }` | 연결 응답 |
| `ERROR` | 양방향 | `{ code, message }` | 에러 |
| `BUG_REPORT` | Client → Pylon | `{ message, stack }` | 버그 리포트 |
| `DEBUG_LOG` | Client → Pylon | `{ ... }` | 디버그 로그 |
| `GET_STATUS` | Client → Pylon | - | 상태 조회 |
| `STATUS` | Pylon → Client | `{ ... }` | 상태 응답 |
| `PYLON_STATUS` | Pylon → Client | `{ deviceId, claudeUsage }` | Pylon 상태 |
| `SLASH_COMMANDS_REQUEST` | Client → Pylon | `{ conversationId }` | 슬래시 명령어 요청 |
| `SLASH_COMMANDS_RESULT` | Pylon → Client | `{ slashCommands }` | 슬래시 명령어 응답 |

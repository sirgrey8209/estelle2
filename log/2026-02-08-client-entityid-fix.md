# Client EntityId 대화선택 버그 수정

**날짜**: 2026-02-08

## 문제

Pylon EntityId 마이그레이션(서버) 후 클라이언트에서 대화 선택이 동작하지 않음.

### 증상
- 워크스페이스에서 어떤 대화를 클릭해도 다른 대화가 선택됨
- 모든 대화 버튼이 반쯤 하늘색(selected 상태)으로 표시됨
- React key 경고 발생 (key={conversation.entityId}가 undefined)
- 메시지가 2중으로 수신됨

## 원인 분석

### 1차 원인: workspaceStore 메서드가 conversationId(UUID)로 매칭
- Pylon은 `entityId: number`만 보내고 `conversationId: string`은 보내지 않음
- 클라이언트의 workspaceStore가 `conversationId`로 대화를 찾으려 함
- `undefined === undefined` → 모든 대화가 매칭됨

### 2차 원인 (근본): workspaces.json이 구형 UUID 포맷
- Pylon 코드는 EntityId(숫자) 체계로 마이그레이션 완료
- 하지만 디스크에 저장된 `workspaces.json`은 구형 UUID 포맷 그대로:
  ```json
  {
    "workspaceId": "7bdb5138-...",  // string (숫자여야 함)
    "conversations": [{
      "conversationId": "9896de93-...",  // entityId 필드 자체가 없음
    }]
  }
  ```
- Pylon이 이 데이터를 그대로 메모리에 올려 클라이언트에 전송
- 모든 `conversation.entityId`가 `undefined`

### 3차 원인: 구형 Pylon 프로세스 잔류
- `pnpm dev:restart` 후에도 이전 Pylon 프로세스(PID 80260)가 살아있음
- 2개의 Pylon이 동시에 Relay에 연결 → 메시지 2중 수신

## 수정 내용

### workspaceStore 메서드 4개를 entityId 기반으로 변경
**파일**: `packages/client/src/stores/workspaceStore.ts`

| 메서드 | Before | After |
|--------|--------|-------|
| `selectConversation` | `(pylonId, workspaceId, conversationId)` | `(pylonId, entityId)` |
| `updateConversationStatus` | `(pylonId, workspaceId, conversationId, ...)` | `(pylonId, entityId, ...)` |
| `updatePermissionMode` | `(conversationId, mode)` | `(entityId, mode)` |
| `getConversation` | `(pylonId, workspaceId, conversationId)` | `(pylonId, entityId)` |

### 호출부 수정
- `WorkspaceSidebar.tsx`: `selectInStore(pylonId, conversation.entityId)`
- `ChatHeader.tsx`: `updatePermissionMode(entityId, mode)`, handleDelete에서 `clearSelection()` 사용
- `useMessageRouter.ts`: conversation_status에서 `entityId` 읽기

### 테스트 수정
- `conversation-state-integration.test.ts`
- `state-sync.test.ts`
- `useMessageRouter.test.ts`

### 구형 데이터 삭제
- `packages/pylon/data/workspaces.json` 삭제 → Pylon이 새 포맷으로 재생성

### 구형 프로세스 정리
- `netstat -ano` 로 포트 3000 연결 확인하여 구형 Pylon 프로세스 종료

## 테스트 결과

- Core: 500, Relay: 162, Pylon: 554, Client: 267 → **총 1,483개 통과**

## 남은 작업

- release/stage Pylon의 `workspaces.json`도 구형 UUID 포맷 → 배포 시 데이터 삭제 또는 마이그레이션 필요
- `WorkspaceStore.fromJSON`에 구형 UUID 자동 마이그레이션 로직 추가 검토

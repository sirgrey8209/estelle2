# reconnect-state-sync

## 구현 목표
WebSocket 재연결 시 대화 상태가 올바르게 동기화되도록 수정

## 문제 상황
1. 클라이언트가 재연결 후 `conversation_select` 전송
2. 하지만 해당 entityId의 `convState`가 없으면 `CONVERSATION_STATUS` 메시지가 무시됨
3. 결과: 로컬 status가 'working'으로 고착됨

## 구현 방향

### 수정 1: CONVERSATION_STATUS 처리 강화 (Client)
`useMessageRouter.ts`에서 `convState`가 없어도 상태 업데이트가 가능하도록 수정
- `convState` 체크 없이 직접 `setStatus()` 호출

### 수정 2: history_result에 현재 status 포함 (Pylon)
`conversation_select` 응답인 `history_result`에 현재 대화 상태를 함께 전송
- `currentStatus` 필드 추가하여 working/idle/permission 상태 명시

## 테스트 케이스

### Client - useMessageRouter.test.ts
1. should set status even when convState does not exist
2. should initialize convState and set status when receiving working status
3. should set status from currentStatus in history_result
4. should set idle status when currentStatus is idle
5. should set permission status when currentStatus is permission

### Client - conversation-state-integration.test.ts
1. 재연결 후 CONVERSATION_STATUS가 convState 없이도 상태를 설정함
2. HISTORY_RESULT의 currentStatus로 정확한 상태 동기화
3. HISTORY_RESULT의 currentStatus가 working이면 working으로 설정
4. HISTORY_RESULT의 currentStatus가 permission이면 permission으로 설정

### Pylon - pylon.test.ts
1. should include currentStatus in history_result when session is idle
2. should include currentStatus in history_result when session is working
3. should include currentStatus in history_result when session is waiting for permission

## 파일
- 테스트:
  - packages/client/src/hooks/useMessageRouter.test.ts
  - packages/client/src/e2e/conversation-state-integration.test.ts
  - packages/pylon/tests/pylon.test.ts
- 구현:
  - packages/client/src/hooks/useMessageRouter.ts
  - packages/pylon/src/pylon.ts

## 진행 로그
- [250210 20:15] 1-PLAN 시작
- [250210 20:15] 문제 분석 완료: 재연결 시 convState 없으면 CONVERSATION_STATUS 무시됨
- [250210 20:55] 2-TEST 완료 (12개 테스트 케이스)
- [250210 21:00] 3-VERIFY 통과
- [250210 21:05] 4-IMPL 완료 (12개 테스트 통과)
- [250210 21:10] 5-REFACTOR 완료 (변경 없음)

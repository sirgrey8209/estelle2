# conversation_status에 workspaceId 추가

## 개요
Pylon이 `conversation_status` 메시지를 보낼 때 `workspaceId`를 포함하도록 수정.
이전에는 workspaceId가 누락되어 Client가 상태를 올바르게 업데이트하지 못하는 버그가 있었음.

## 문제
- 대화 시작 시 StatusDot이 working으로 안 바뀜
- Client의 routeMessage에서 workspaceId가 없으면 상태 업데이트 실패

## 해결

### Pylon 수정 (2곳)
1. `handleClaudeEvent()` - state 변경 시 workspaceId 포함 (Line 695-704)
2. `sendUnreadToNonViewers()` - unread 상태 전송 시 workspaceId 포함 (Line 1891-1900)

### 방어 처리
- workspaceId를 찾지 못하면 conversation_status 메시지를 보내지 않음

## 테스트 추가 (4개)
1. `should include workspaceId in conversation_status message`
2. `should not send conversation_status if workspaceId not found`
3. `should include workspaceId in unread notification`
4. `should not send unread notification if workspaceId not found`

## 수정 파일
- `packages/pylon/src/pylon.ts` - 2곳 수정
- `packages/pylon/tests/pylon.test.ts` - 4개 테스트 추가
- `packages/client/src/e2e/state-sync.test.ts` - skip 해제 및 테스트 수정

## 테스트 결과
- 전체: 861 tests passed
- Pylon: 52 tests (+4)
- Client: 267 tests

## 배포
- 2026-02-07 10:10 Release 빌드 및 배포 완료
- Pylon: PM2 online
- Relay: Fly.io deployed (version 13)

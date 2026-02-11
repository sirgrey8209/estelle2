# useCurrentConversationState Hook 구현

## 구현 목표

`getCurrentState()`가 `get()`을 사용해 Zustand selector 구독을 우회하는 문제를 해결하는 리액티브 hook 제공.

## 배경

`getCurrentState()` 함수가 내부에서 `get()`을 호출하여 Zustand의 selector 구독 메커니즘을 우회:
- 메시지 추가 시 리렌더링이 트리거되지 않을 수 있음
- `childToolsMap` useMemo가 오래된 messages로 계산됨
- Task 하위 툴이 제대로 표시되지 않음

## 구현 방향

1. `conversationStore.ts`에 `useCurrentConversationState()` hook 추가
2. 기존 `getCurrentState()` JSDoc 경고 추가
3. 5개 컴포넌트를 새 hook으로 마이그레이션

## 테스트 케이스 (14개)

### 정상 케이스
1. `should_return_current_state_when_conversation_selected`
2. `should_update_when_messages_added`
3. `should_update_when_status_changes`
4. `should_update_when_conversation_switched`
5. `should_trigger_rerender_on_pendingRequests_change`

### 엣지 케이스
6. `should_return_null_when_no_conversation_selected`
7. `should_return_null_when_conversation_deselected`
8. `should_return_initial_state_for_new_conversation`
9. `should_handle_rapid_state_changes`

### 에러 케이스
10. `should_handle_deleted_conversation_gracefully`
11. `should_handle_store_reset_gracefully`

### 리액티브 구독 검증
12. `should_subscribe_to_currentEntityId_changes`
13. `should_subscribe_to_states_map_changes`
14. `should_not_trigger_rerender_for_unrelated_conversation_changes`

## 파일

- 테스트: `packages/client/src/stores/conversationStore.test.ts`
- 구현: `packages/client/src/stores/conversationStore.ts`
- 마이그레이션:
  - `packages/client/src/components/chat/MessageList.tsx`
  - `packages/client/src/components/chat/ChatArea.tsx`
  - `packages/client/src/components/chat/InputBar.tsx`
  - `packages/client/src/components/chat/WorkingIndicator.tsx`
  - `packages/client/src/components/requests/RequestBar.tsx`

## 진행 로그

- [250209 00:10] 1-PLAN 시작
- [250209 00:12] 1-PLAN 승인, 2-TEST 진행
- [250209 00:25] 2-TEST 완료 - 14개 테스트 케이스 작성
- [250209 06:40] 3-VERIFY 통과 (테스트 실패 확인)
- [250209 06:42] 4-IMPL 완료 (44개 테스트 통과)
- [250209 06:45] 5-REFACTOR 완료 - 5개 컴포넌트 마이그레이션

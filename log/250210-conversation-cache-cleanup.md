# conversation-cache-cleanup 구현 계획

## 구현 목표
entityId 재사용 시 이전 대화 데이터가 남아있는 버그 수정 - 새 대화 생성 시와 대화 삭제 시 conversationStore 캐시 정리

## 배경
- Pylon에서 대화 삭제 후 새 대화 생성 시 동일한 entityId가 재할당될 수 있음
- 클라이언트 conversationStore에는 entityId → 상태 Map이 있어 이전 데이터가 남아있음
- 새 대화를 열면 히스토리 로드 전에 캐시된 이전 메시지가 보이는 문제 발생

## 구현 방향

### 1. CONVERSATION_CREATE_RESULT 핸들러 추가
- `useMessageRouter.ts`에 새 case 추가
- 생성된 entityId로 `conversationStore.deleteConversation()` 호출하여 기존 캐시 제거
- 이후 히스토리 로드 시 깨끗한 상태에서 시작

### 2. WORKSPACE_LIST_RESULT 핸들러 개선
- 기존 워크스페이스 목록과 새 목록 비교
- 사라진 대화의 entityId를 찾아 `conversationStore.deleteConversation()` 호출

## 영향 범위
- 수정 필요:
  - `packages/client/src/hooks/useMessageRouter.ts`
  - `packages/client/src/hooks/useMessageRouter.test.ts`

- 신규 생성: 없음

---

# conversation-cache-cleanup TDD

## 상태
✅ 완료

## 테스트 케이스
### CONVERSATION_CREATE_RESULT
1. [정상] should_call_deleteConversation_when_conversation_create_result_received
2. [엣지] should_handle_conversation_create_result_without_entityId
3. [정상] should_call_deleteConversation_even_when_no_cached_state_exists

### WORKSPACE_LIST_RESULT with deleted conversations
4. [정상] should_call_deleteConversation_for_removed_conversations
5. [정상] should_call_deleteConversation_for_multiple_removed_conversations
6. [엣지] should_not_call_deleteConversation_when_no_conversations_removed
7. [엣지] should_handle_first_workspace_list_without_previous_data
8. [정상] should_handle_workspace_deletion_with_all_conversations

## 파일
- 플랜: wip/conversation-cache-cleanup-plan.md
- 테스트: packages/client/src/hooks/useMessageRouter.test.ts
- 구현: packages/client/src/hooks/useMessageRouter.ts

## 재시도 횟수
- 2-TEST -> 3-VERIFY: 0/3
- 4-IMPL: 0/3

## 로그
- [250210 18:30] 1-PLAN 시작
- [250210 20:10] 2-TEST 시작 - 8개 테스트 케이스 작성 (5 failing, 3 passing)
- [250210 20:15] 4-IMPL 완료 - 모든 테스트 통과 (24 tests passed)
- [250210 20:17] 전체 테스트 통과 확인 - TDD 사이클 완료

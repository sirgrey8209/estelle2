# message-cleanup TDD

## 상태
✅ 완료

## 테스트 케이스
1. [기존수정] should_create_workspace_with_empty_conversations_when_called
2. [기존수정] should_set_active_conversation_to_null_when_workspace_created_empty
3. [정상] should_delete_message_files_for_all_conversations_when_workspace_deleted
4. [정상] should_clear_message_cache_when_workspace_deleted
5. [정상] should_delete_message_file_when_conversation_deleted
6. [정상] should_clear_message_cache_when_conversation_deleted
7. [정상] should_clear_existing_messages_when_conversation_created_with_reused_id
8. [정상] should_delete_message_file_for_new_conversation_id_if_exists
9. [통합] should_not_show_old_messages_when_workspace_recreated_with_same_id
10. [통합] should_not_show_old_messages_when_conversation_recreated_with_same_id
11. [엣지] should_handle_workspace_delete_without_persistence_adapter
12. [엣지] should_handle_conversation_delete_without_persistence_adapter

## 파일
- 플랜: wip/message-cleanup-plan.md
- 테스트: packages/pylon/tests/message-cleanup.test.ts
- 구현:
  - packages/pylon/src/stores/workspace-store.ts
  - packages/pylon/src/pylon.ts

## 재시도 횟수
- 2-TEST → 3-VERIFY: 0/3
- 4-IMPL: 0/3

## 로그
- [260209 16:30] 1-PLAN 시작
- [260209 16:30] 1-PLAN 완료, 사용자 승인
- [260209 20:59] 2-TEST 시작, 12개 테스트 작성
- [260209 21:00] 3-VERIFY 통과 (테스트 실패 확인)
- [260209 21:27] 4-IMPL 완료 (12개 테스트 통과)
- [260209 21:28] 5-REFACTOR 완료 (clearMessagesForEntity 헬퍼 메서드 추출)

## 리팩토링 요약
- `clearMessagesForEntity(entityId)` 헬퍼 메서드 추가
- 3곳의 중복 코드를 1개 메서드로 통합
- 전체 647개 테스트 통과

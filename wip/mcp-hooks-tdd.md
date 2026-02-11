# MCP-Pylon TCP 통신 TDD

## 상태
🔄 통합 완료 - E2E 테스트 대기

## 테스트 케이스

### 1. ToolContextMap (tool-context-map.test.ts)
1. [정상] should_store_entity_id_when_tool_use_id_provided
2. [정상] should_overwrite_existing_mapping_when_same_tool_use_id
3. [정상] should_store_multiple_mappings
4. [엣지] should_handle_empty_tool_use_id
5. [정상] should_return_entity_id_when_tool_use_id_exists
6. [에러] should_return_undefined_when_tool_use_id_not_found
7. [정상] should_remove_mapping_when_tool_use_id_exists
8. [에러] should_return_false_when_tool_use_id_not_found (delete)
9. [정상] should_remove_entries_older_than_max_age
10. [정상] should_keep_recent_entries
11. [정상] should_use_default_max_age_when_not_specified
12. [정상] should_return_number_of_entries (size)
13. [정상] should_remove_all_entries (clear)

### 2. PylonBridge (pylon-bridge.test.ts)
1. [정상] should_create_instance_with_default_options
2. [정상] should_create_instance_with_custom_options
3. [정상] should_return_false_when_not_connected
4. [정상] should_format_link_request_correctly
5. [정상] should_format_unlink_request_correctly
6. [정상] should_format_list_request_correctly
7. [정상] should_parse_success_response
8. [정상] should_parse_error_response
9. [에러] should_throw_when_not_connected
10. [에러] should_reject_invalid_action
11. [에러] should_reject_empty_tool_use_id
12. [정상] should_return_same_instance_from_getInstance (singleton)
13. [정상] should_create_new_instance_after_reset

### 3. McpTcpServer (tcp-server.test.ts)
1. [정상] should_create_instance_with_options
2. [정상] should_use_default_port_when_not_specified
3. [정상] should_link_document_when_valid_request
4. [정상] should_return_updated_docs_after_link
5. [에러] should_return_error_when_tool_use_id_not_found (link)
6. [에러] should_return_error_when_document_already_linked
7. [엣지] should_return_error_when_path_empty
8. [정상] should_unlink_document_when_valid_request
9. [에러] should_return_error_when_document_not_linked
10. [정상] should_return_docs_when_valid_request (list)
11. [정상] should_return_empty_array_when_no_docs_linked
12. [에러] should_return_error_when_action_invalid
13. [에러] should_return_error_when_tool_use_id_missing
14. [정상] should_return_false_when_not_started
15. [통합] should_handle_full_link_unlink_list_workflow

### 4. link-document.ts (link-document.test.ts)
1. [정상] should_return_success_when_document_linked
2. [정상] should_include_linked_docs_in_response
3. [에러] should_return_error_when_link_fails
4. [엣지] should_return_error_when_path_missing
5. [에러] should_return_error_when_not_connected
6. [정상] should_return_success_when_document_unlinked
7. [에러] should_return_error_when_document_not_found
8. [정상] should_return_docs_list
9. [엣지] should_return_empty_message_when_no_docs
10. [정상] should_export_link_doc_tool_definition
11. [정상] should_export_unlink_doc_tool_definition
12. [정상] should_export_list_docs_tool_definition

## 파일
- 플랜: wip/mcp-hooks-plan.md
- 테스트:
  - packages/pylon/tests/claude/tool-context-map.test.ts
  - packages/pylon/tests/mcp/pylon-bridge.test.ts
  - packages/pylon/tests/mcp/tcp-server.test.ts
  - packages/pylon/tests/mcp/tools/link-document.test.ts
- 구현:
  - packages/pylon/src/claude/tool-context-map.ts
  - packages/pylon/src/mcp/pylon-bridge.ts
  - packages/pylon/src/mcp/tcp-server.ts
  - packages/pylon/src/mcp/tools/link-document.ts

## 재시도 횟수
- 2-TEST → 3-VERIFY: 0/3
- 4-IMPL: 0/3

## 로그
- [250209 08:30] 1-PLAN 시작
- [250209 08:45] 플랜 변경: toolComplete 훅 → TCP 통신 방식
- [250209 08:50] 2-TEST 시작
- [250209 08:55] 2-TEST 완료 (4개 테스트 파일, 49개 테스트 케이스)
- [250209 08:46] 3-VERIFY 완료 - FIRST 원칙, 완성도, 구조 모두 통과, 4개 파일 모두 실패 확인 (구현 파일 없음)
- [250209 08:51] 4-IMPL 완료 - 4개 구현 파일 작성, 55개 테스트 모두 통과
- [250209 08:54] 5-REFACTOR 완료 - 코드 분석 결과 이미 품질 기준 충족, 변경 없음
- [250209 09:14] 통합 코드 작성 완료 - PylonBridge TCP 클라이언트 구현, 빌드 및 635개 단위테스트 통과
- [ ] E2E 테스트 필요 - 실제 MCP 도구 호출 시 동작 확인

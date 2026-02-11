# link_doc 마이그레이션 TDD

## 상태
🔴 3-VERIFY (PylonMcpServer 테스트 작성 완료)

## 테스트 케이스

### PylonMcpServer (packages/pylon/tests/servers/pylon-mcp-server.test.ts)

**constructor**
- `should_create_server_with_workspace_store`
- `should_use_default_port_when_not_specified` (기본: 9880)
- `should_use_custom_port_when_specified`

**listen**
- `should_start_tcp_server_on_specified_port`
- `should_reject_when_port_already_in_use`

**close**
- `should_stop_tcp_server`
- `should_not_throw_when_server_not_started`

**link action**
- `should_link_document_successfully`
- `should_link_multiple_documents`
- `should_return_error_when_linking_duplicate_document`
- `should_return_error_when_entity_id_not_found`
- `should_return_error_when_path_is_empty`

**unlink action**
- `should_unlink_document_successfully`
- `should_return_error_when_unlinking_non_existent_document`
- `should_return_error_when_entity_id_not_found`
- `should_return_error_when_path_is_empty`

**list action**
- `should_return_empty_list_when_no_documents_linked`
- `should_return_linked_documents_in_order`
- `should_return_error_when_entity_id_not_found`

**error cases**
- `should_return_error_when_action_is_missing`
- `should_return_error_when_action_is_unknown`
- `should_return_error_when_entity_id_is_missing`
- `should_return_error_when_entity_id_is_not_a_number`
- `should_return_error_when_path_is_missing_for_link`
- `should_return_error_when_path_is_missing_for_unlink`
- `should_return_error_when_request_is_invalid_json`

**concurrent connections**
- `should_handle_multiple_concurrent_requests`
- `should_handle_sequential_requests`

## 파일
- 플랜: wip/link-doc-migration-plan.md
- 테스트: packages/pylon/tests/servers/pylon-mcp-server.test.ts
- 구현: (4-IMPL에서 기록)

## 재시도 횟수
- 2-TEST → 3-VERIFY: 0/3
- 4-IMPL: 0/3

## 로그
- [260210 19:05] 1-PLAN 시작
- [260210 20:03] 2-TEST PylonMcpServer 테스트 28개 작성

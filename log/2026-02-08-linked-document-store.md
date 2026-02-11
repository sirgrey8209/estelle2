# LinkedDocument Store 구현

## 구현 목표

대화(Conversation)에 문서를 연결/해제하고 조회하는 WorkspaceStore 메서드 구현

## 구현 방향

### 1. Core 타입 추가

`packages/core/src/types/workspace.ts`에 LinkedDocument 인터페이스 추가:

```typescript
interface LinkedDocument {
  path: string;      // workingDir 기준 상대경로
  addedAt: number;   // 연결 시점 timestamp
}
```

Conversation 인터페이스에 `linkedDocuments?: LinkedDocument[]` 필드 추가

### 2. WorkspaceStore 메서드 추가

`packages/pylon/src/stores/workspace-store.ts`에 3개 메서드 추가:

- `linkDocument(entityId, path)` — 문서 연결, 중복 무시, 성공 여부 반환
- `unlinkDocument(entityId, path)` — 문서 해제, 성공 여부 반환
- `getLinkedDocuments(entityId)` — 연결된 문서 목록 반환

### 3. 설계 원칙

- 파일 존재 여부 검증은 **하지 않음** (I/O 분리 원칙)
- path 정규화: 슬래시(`/`)를 백슬래시(`\`)로 변환
- 중복 연결 시 기존 항목 유지 (addedAt 갱신 안 함)

## 테스트 케이스 (26개)

### linkDocument (10개)
1. [정상] should_link_document_when_valid_path_provided
2. [정상] should_set_addedAt_timestamp_when_linking_document
3. [정상] should_link_multiple_documents_to_same_conversation
4. [정상] should_normalize_forward_slashes_to_backslashes
5. [중복] should_ignore_duplicate_path_when_already_linked
6. [중복] should_treat_same_path_with_different_slashes_as_duplicate
7. [에러] should_return_false_when_conversation_not_found
8. [엣지] should_handle_empty_path
9. [엣지] should_handle_path_with_only_whitespace
10. [엣지] should_trim_whitespace_from_path

### unlinkDocument (7개)
1. [정상] should_unlink_document_when_path_exists
2. [정상] should_unlink_only_specified_document
3. [정상] should_normalize_forward_slashes_when_unlinking
4. [에러] should_return_false_when_path_not_found
5. [에러] should_return_false_when_conversation_not_found
6. [엣지] should_return_false_when_no_linked_documents
7. [엣지] should_handle_empty_path_on_unlink

### getLinkedDocuments (4개)
1. [정상] should_return_all_linked_documents
2. [정상] should_return_documents_in_order_of_addition
3. [빈값] should_return_empty_array_when_no_documents_linked
4. [에러] should_return_empty_array_when_conversation_not_found

### 직렬화 및 복원 (2개)
1. [정상] should_preserve_linked_documents_after_toJSON_and_fromJSON
2. [정상] should_preserve_addedAt_timestamps_after_restore

### Conversation 연동 (3개)
1. [정상] should_keep_linked_documents_when_conversation_renamed
2. [정상] should_remove_linked_documents_when_conversation_deleted
3. [정상] should_have_independent_linked_documents_per_conversation

## 파일

- 테스트: `packages/pylon/tests/stores/workspace-store-linked-document.test.ts`
- 구현: `packages/core/src/types/workspace.ts`, `packages/pylon/src/stores/workspace-store.ts`

## 진행 로그

- [260208 18:30] 1-PLAN 시작
- [260208 18:45] 2-TEST 시작 - 26개 테스트 케이스 작성
- [260208 23:01] 3-VERIFY 통과 (26개 테스트 실패 확인)
- [260208 23:05] 4-IMPL 완료 (26개 테스트 통과)
- [260208 23:06] 5-REFACTOR 완료 (변경 없음 - 코드 품질 양호)

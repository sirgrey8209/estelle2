# ConversationPath TDD

## 상태
✅ 완료 (27/27 통과)

## 테스트 케이스
1. [상수] should_define_bit_constants
2. [상수] should_define_max_value_constants
3. [정상] should_encode_minimum_values_when_all_ids_are_1
4. [정상] should_encode_maximum_values_when_all_ids_are_at_max
5. [정상] should_encode_mixed_values_correctly
6. [정상] should_produce_different_paths_for_different_inputs
7. [에러] should_throw_when_pylonId_is_0
8. [에러] should_throw_when_pylonId_exceeds_max
9. [에러] should_throw_when_pylonId_is_negative
10. [에러] should_throw_when_workspaceId_is_0
11. [에러] should_throw_when_workspaceId_exceeds_max
12. [에러] should_throw_when_workspaceId_is_negative
13. [에러] should_throw_when_conversationId_is_0
14. [에러] should_throw_when_conversationId_exceeds_max
15. [에러] should_throw_when_conversationId_is_negative
16. [정상] should_decode_and_return_original_values_for_minimum
17. [정상] should_decode_and_return_original_values_for_maximum
18. [정상] should_decode_and_return_original_values_for_mixed
19. [정상] should_roundtrip_all_boundary_combinations
20. [엣지] should_return_object_with_correct_shape
21. [정상] should_format_path_as_colon_separated_string
22. [정상] should_format_minimum_values_correctly
23. [정상] should_format_maximum_values_correctly
24. [정상] should_format_mixed_values_correctly
25. [일관성] should_maintain_consistency_across_all_valid_pylonId_values
26. [일관성] should_maintain_consistency_across_sample_workspaceId_values
27. [일관성] should_maintain_consistency_across_sample_conversationId_values

## 파일
- 플랜: wip/ConversationPath-plan.md
- 테스트: packages/core/tests/utils/conversation-path.test.ts
- 구현: packages/core/src/utils/conversation-path.ts

## 재시도 횟수
- 2-TEST → 3-VERIFY: 0/3
- 4-IMPL: 0/3

## 로그
- [250207 17:30] 1-PLAN 시작
- [250207 17:30] 1-PLAN 승인 완료
- [250207 17:57] 2-TEST 시작 - 27개 테스트 케이스 작성
- [250207 19:00] 4-IMPL 완료 - 27개 테스트 모두 통과
- [250207 19:01] 5-REFACTOR 스킵 (구현이 이미 깔끔)

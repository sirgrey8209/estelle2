# EntityId envId 확장 TDD

## 상태
✅ 완료

## 테스트 케이스

### 상수 테스트 (2개)
1. `should_define_ENV_ID_BITS_constant_as_2` - ENV_ID_BITS 상수가 2인지 확인
2. `should_define_MAX_ENV_ID_constant_as_2` - MAX_ENV_ID 상수가 2인지 확인

### encodeEntityIdWithEnv 테스트 (9개)

#### 호환성 테스트 - envId=0 (release)
3. `should_produce_same_value_as_legacy_when_envId_is_0` - envId=0일 때 기존 encodeConversationPath와 동일한 값 반환
4. `should_produce_same_value_for_all_boundary_cases_when_envId_is_0` - 모든 경계 케이스에서 envId=0이면 레거시와 동일

#### envId=1 (stage) 인코딩
5. `should_encode_envId_1_correctly` - envId=1 인코딩이 정상 동작하고 레거시보다 큰 값
6. `should_encode_envId_1_with_correct_bit_position` - envId=1이 최상위 비트에 올바르게 위치

#### envId=2 (dev) 인코딩
7. `should_encode_envId_2_correctly` - envId=2 인코딩이 정상 동작하고 stage보다 큰 값

#### envId 범위 검증
8. `should_throw_when_envId_is_negative` - envId < 0이면 에러
9. `should_throw_when_envId_is_3` - envId = 3이면 에러 (허용 범위 0~2)
10. `should_throw_when_envId_exceeds_2bit_max` - envId = 4이면 에러

### decodeEntityIdWithEnv 테스트 (5개)

#### envId 디코딩
11. `should_decode_envId_0_correctly` - envId=0 디코딩 검증
12. `should_decode_envId_1_correctly` - envId=1 디코딩 검증
13. `should_decode_envId_2_correctly` - envId=2 디코딩 검증
14. `should_roundtrip_all_envId_values` - 모든 envId 값에 대해 encode/decode 왕복 검증

#### DecodedEntityIdWithEnv 구조
15. `should_return_object_with_envId_property` - 디코딩 결과에 envId, pylonId, workspaceId, conversationId 4개 속성

### 레거시 호환 테스트 (2개)
16. `should_keep_encodeEntityId_working_without_envId` - 기존 encodeEntityId 함수 동작 유지 (통과)
17. `should_decode_legacy_entityId_as_envId_0` - 레거시 EntityId를 decodeEntityIdWithEnv로 디코딩 시 envId=0

## 파일
- 플랜: wip/entity-id-envid-plan.md
- 테스트: packages/core/tests/utils/entity-id.test.ts
- 구현: packages/core/src/utils/entity-id.ts

## 재시도 횟수
- 2-TEST → 3-VERIFY: 0/3
- 4-IMPL: 0/3

## 로그
- [260210 17:30] 1-PLAN 시작
- [260210 18:00] 2-TEST 시작 - 16개 FAILING 테스트 작성 완료
- [260210 23:08] 3-VERIFY 완료 - FIRST 원칙 충족, 16개 테스트 실패 확인 (정상)
- [260210 23:11] 4-IMPL 완료 - 69개 테스트 모두 통과
- [260210 23:12] 5-REFACTOR 완료 - 리팩토링 불필요, TDD 사이클 완료

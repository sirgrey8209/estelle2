# id-system TDD

## 상태
✅ 완료

## 테스트 케이스

### 상수 테스트 (10개)
1. should_define_ENV_ID_BITS_as_2
2. should_define_DEVICE_TYPE_BITS_as_1
3. should_define_DEVICE_INDEX_BITS_as_4
4. should_define_WORKSPACE_INDEX_BITS_as_7
5. should_define_CONVERSATION_INDEX_BITS_as_10
6. should_define_MAX_ENV_ID_as_2
7. should_define_MAX_DEVICE_INDEX_as_15
8. should_define_MAX_WORKSPACE_INDEX_as_127
9. should_define_MAX_CONVERSATION_INDEX_as_1023

### encodePylonId 테스트 (11개)
- 정상: release/stage/dev pylon 인코딩, 최대값, 다른 deviceIndex
- 에러: envId 음수/초과, deviceIndex 0/초과/음수

### encodeClientId 테스트 (8개)
- 정상: deviceIndex 0, envId 1, 최대값, pylon과 다른 값
- 에러: envId 음수/초과, deviceIndex 초과/음수

### encodeWorkspaceId 테스트 (7개)
- 정상: workspace 1, 최대값 127, 다른 workspaceIndex, 다른 pylon
- 에러: workspaceIndex 0/초과/음수

### encodeConversationId 테스트 (7개)
- 정상: conversation 1, 최대값 1023, 24비트 범위, 다른 conversationIndex
- 에러: conversationIndex 0/초과/음수

### decodePylonId 테스트 (4개)
- envId, deviceType=0, deviceIndex 디코딩, roundtrip

### decodeClientId 테스트 (4개)
- deviceType=1, envId, deviceIndex 디코딩, roundtrip

### decodeDeviceId 테스트 (3개)
- pylonId/clientId 디코딩, 결과 구조

### decodeWorkspaceId 테스트 (3개)
- pylonId, workspaceIndex 디코딩, roundtrip

### decodeConversationId 테스트 (3개)
- workspaceId, conversationIndex 디코딩, roundtrip

### decodeConversationIdFull 테스트 (4개)
- 전체 컴포넌트, 중간 ID, 결과 구조, roundtrip

### isPylonId / isClientId 테스트 (6개)
- isPylonId: true for pylon, false for client, all envs
- isClientId: true for client, false for pylon, all envs

### conversationIdToString 테스트 (4개)
- 콜론 구분 형식, stage/dev env, 최소값

### 비트 레이아웃 검증 (5개)
- PylonId 7비트 구조
- ClientId 7비트 구조 (deviceType=1)
- WorkspaceId 14비트 구조
- ConversationId 24비트 구조
- 총 비트 합계 24

### 환경별 예시값 (3개)
- release/stage/dev 환경 ID 문자열

**총 테스트 케이스: 약 82개**

## 파일
- 플랜: wip/id-system-plan.md
- 테스트: packages/core/tests/utils/id-system.test.ts
- 구현: packages/core/src/utils/id-system.ts

## 재시도 횟수
- 2-TEST → 3-VERIFY: 0/3
- 4-IMPL: 0/3

## 로그
- [260211 23:30] 1-PLAN 시작
- [260212 00:14] 2-TEST 완료 - 82개 테스트 케이스 작성
- [260212 04:17] 4-IMPL 완료 - 80개 테스트 통과
- [260212 04:20] 5-REFACTOR 완료 - index.ts export 추가, Core 598개 테스트 통과

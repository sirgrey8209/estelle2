# Relay ID 마이그레이션

## 구현 목표
Relay 서버의 클라이언트 deviceId 할당을 구체계(DYNAMIC_DEVICE_ID_START=100, 순차증가)에서 새 24비트 ID 체계(ClientIndexAllocator, 0~15 범위, 빈 번호 재활용)로 마이그레이션. 레거시 코드 완전 제거.

## 구현 방향
- `nextClientId: number` (100~) → `clientAllocator: ClientIndexAllocator` (0~15)
- `DYNAMIC_DEVICE_ID_START` 상수 완전 삭제
- `isValidClientIndex()` 기반 인증으로 전환
- 빈 번호 재활용 (allocator.assign/release)

## 테스트 케이스 (29개)

### auth.test.ts (10개)
1. [정상] should_authenticate_dynamic_device_when_deviceId_is_0
2. [정상] should_authenticate_dynamic_device_when_deviceId_is_15
3. [정상] should_authenticate_dynamic_device_when_deviceId_is_5
4. [에러] should_reject_device_when_deviceId_is_16
5. [에러] should_reject_device_when_deviceId_is_100
6. [에러] should_reject_device_when_deviceId_is_1000
7. [정상] should_return_true_when_deviceId_in_client_index_range_0_to_15
8. [엣지] should_return_false_when_deviceId_above_client_index_range
9. [엣지] should_return_false_when_deviceId_is_negative
10. [정상] should_use_isValidClientIndex_not_DYNAMIC_DEVICE_ID_START

### message-handler.test.ts (8개)
11. [정상] should_assign_deviceId_from_allocator_when_app_authenticates
12. [정상] should_not_have_increment_next_client_id_action_when_app_authenticates
13. [정상] should_assign_sequential_deviceIds_for_multiple_apps
14. [정상] should_emit_release_client_index_when_app_disconnects
15. [정상] should_not_emit_reset_next_client_id_when_all_apps_disconnect
16. [정상] should_emit_release_client_index_even_with_remaining_apps
17. [엣지] should_not_emit_release_for_pylon_disconnect
18. [정상] should_assign_valid_client_index_when_auth_via_handleMessage

### integration.test.ts (5개)
19. [정상] 9.1 should_assign_deviceId_in_0_to_15_range_when_app_connects
20. [정상] 9.2 should_assign_0_as_first_deviceId_when_no_apps_connected
21. [정상] 9.3 should_assign_sequential_deviceIds_starting_from_0
22. [정상] 9.4 should_reuse_released_deviceId_when_app_reconnects
23. [정상] 9.5 should_show_client_role_for_dynamically_assigned_device

### utils.test.ts (6개)
24. [정상] should_return_client_info_when_deviceId_is_0
25. [정상] should_return_client_info_when_deviceId_is_5
26. [정상] should_return_client_info_when_deviceId_is_15
27. [에러] should_return_unknown_when_deviceId_is_16
28. [에러] should_return_unknown_when_deviceId_is_100
29. [정상] should_still_return_registered_device_info

## 파일
- 테스트: auth.test.ts, message-handler.test.ts, integration.test.ts, utils.test.ts
- 구현: constants.ts, types.ts, auth.ts, utils.ts, message-handler.ts, server.ts, router.ts, index.ts

## 진행 로그
- [260212 00:20] 1-PLAN 시작
- [260212 00:45] 1-PLAN 승인, 2-TEST 시작
- [260212 00:50] 2-TEST 완료 (22개 failing 테스트 작성)
- [260212 00:55] 3-VERIFY 통과 (22 fail / 172 pass 확인)
- [260212 00:55] 4-IMPL 시작
- [260212 00:26] 4-IMPL 완료 (194개 테스트 통과)
- [260212 00:30] 5-REFACTOR 완료 (구체계 JSDoc 주석 정리, 194개 테스트 통과)

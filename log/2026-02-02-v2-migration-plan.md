# v1 → v2 마이그레이션 플랜

> **상태**: ✅ 마이그레이션 완료
> **작성일**: 2026-02-02
> **완료일**: 2026-02-02 (Phase 3 완료, 실행 테스트 통과)

---

## 목표

v1의 모든 기능이 v2에서 동작하는 상태를 만들고, v1을 제거합니다.

### 포함 범위
- Pylon 핵심 기능 (Claude SDK, 영속 저장, 워크스페이스/대화 관리)
- Client 상태 동기화 (PylonState ⊃ ClientState 관계 유지)
- 버그 리포트 기능

### 제외 범위
- 배포 기능 (deploy_*)
- 버전/업데이트 확인 (version_check, app_update)
- Claude 사용량 요청 (claude_usage_request)

---

## Phase 개요

| Phase | 목표 | 상세 문서 |
|-------|------|----------|
| **Phase 1** | Pylon 핵심 동작 (Claude 대화 가능) | [phase1-pylon-core.md](./phase1-pylon-core.md) |
| **Phase 2** | Client 상태 동기화 강화 | [phase2-client-sync.md](./phase2-client-sync.md) |
| **Phase 3** | 통합 테스트 및 안정화 | [phase3-integration-test.md](./phase3-integration-test.md) |

---

## 구현 순서

```
Phase 1 (Critical) ✅ 완료
├─ 1.1 Claude SDK Adapter ✅
├─ 1.2 bin.ts 의존성 연결 ✅
├─ 1.3 영속 저장소 ✅
└─ 1.4 버그 리포트 (Pylon) ✅
        │
        ▼
Phase 2 (상태 동기화) ✅ 완료
├─ 2.1 상태 관계 문서화 ✅
├─ 2.2 동기화 메시지 검증 ✅
└─ 2.3 타입 일관성 확인 ✅
        │
        ▼
Phase 3 (안정화) ✅ 완료
├─ 3.1 통합 테스트 ✅
├─ 3.2 성능 테스트 ✅
└─ 3.3 에러 핸들링 테스트 ✅
        │
        ▼
    ✅ 마이그레이션 완료!
```

---

## 파일 변경 요약

### 신규 파일
- `packages/pylon/src/claude/claude-sdk-adapter.ts`
- `packages/pylon/src/persistence/types.ts`
- `packages/pylon/src/persistence/file-system-persistence.ts`
- `packages/client/src/hooks/useMessageRouter.ts` (메시지 라우터)
- 테스트 파일들

### 수정 파일
- `packages/pylon/src/bin.ts`
- `packages/pylon/src/pylon.ts`
- `packages/core/src/constants/message-type.ts` (27 → 62 타입으로 대폭 확장)
- `packages/core/src/types/messages.ts`
- `packages/core/tests/constants/constants.test.ts`
- `packages/client/src/stores/relay-store.ts`
- `packages/client/src/stores/claudeStore.ts` (handleClaudeEvent 추가)
- `packages/client/src/hooks/index.ts`

---

## Phase 2 검증 결과 요약

Phase 2 검증에서 다수의 이슈가 발견되었습니다. 상세 내용은 [phase2-client-sync.md](./phase2-client-sync.md) 참조.

### 🔴 Critical Issues

1. **메시지 타입 명명 불일치**
   - @estelle/core: `DESK_*` (desk_list, desk_create 등)
   - Pylon 구현: `workspace_*`, `conversation_*`
   - 해결 방안: Core 타입을 실제 구현에 맞게 업데이트

2. **Client 메시지 핸들러 미완성**
   - RelayService가 메시지 타입별 라우팅 없이 단순 이벤트 발생
   - 각 Store와의 연결 고리가 불명확
   - 해결 방안: 중앙 메시지 라우터 구현

### 🟡 Important Issues

3. **메시지 인터페이스 불일치**
   - Pylon `from`: `{ type, id }` 객체
   - Client `from`: `string`
   - 해결 방안: Core에 공통 타입 정의

4. **누락된 응답 메시지 타입**
   - `*_result` 메시지 타입이 Core에 정의되지 않음
   - 폴더/태스크/워커 관련 메시지 타입 전체 누락

### 권장 후속 작업

- [x] @estelle/core MessageType 업데이트 ✅ (27 → 62 타입)
- [x] Client RelayService 메시지 라우터 구현 ✅ (routeMessage 함수)
- [ ] 메시지 인터페이스 타입 통일 (연기)

---

## 실행 테스트 결과 (2026-02-02)

### 테스트 환경
- `pnpm dev` 실행 (Relay + Pylon + Expo)
- 브라우저에서 http://localhost:10000 접속

### 발견 및 수정된 이슈

| 이슈 | 원인 | 수정 |
|------|------|------|
| "Relay 서버에 연결 중..." 멈춤 | `auth_result` 페이로드 구조 불일치 | `_layout.tsx` 수정: `payload.device.deviceId` 사용 |

### 동작 확인 항목

- [x] Relay 연결
- [x] 인증 성공 (auth_result 처리)
- [x] UI 정상 표시
- [x] 데스크 목록 (빈 목록 - 정상)

### 추가 신규/수정 파일

- `packages/client/src/services/relaySender.ts` (신규 - 메시지 전송 헬퍼)
- `packages/client/app/_layout.tsx` (수정 - routeMessage 연결, auth_result 수정)
- `packages/client/src/services/index.ts` (수정 - relaySender export)

---

## 최종 테스트 결과

```
✓ Core:   347 tests
✓ Relay:  135 tests
✓ Pylon:  455 tests
✓ Client:  98 tests
─────────────────────
  Total: 1,035 tests passing
```

---

*작성일: 2026-02-02*
*완료일: 2026-02-02*

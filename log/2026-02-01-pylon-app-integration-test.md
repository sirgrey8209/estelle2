# Pylon ↔ App 통합 테스트

> **상태**: ✅ 완료 (v2 마이그레이션에서 해결)
> **작성일**: 2026-02-01
> **완료일**: 2026-02-02

---

## 배경

Relay L2 테스트 작성 중 발견된 이슈:
- `workspace_list_result` 메시지에서 deviceId 타입 에러
- Pylon이 string으로 전송, App이 int로 기대
- **Pylon ↔ App 구간 테스트가 없어서 발견 못함**

---

## 해결 내역

v2 마이그레이션 Phase 2/3에서 해결됨:

1. **@estelle/core MessageType 확장** (27개 → 62개)
   - `workspace_*`, `conversation_*` 메시지 타입 추가
   - `*_result` 응답 메시지 타입 추가

2. **Client 메시지 라우터 구현** (`useMessageRouter.ts`)
   - 메시지 타입별 라우팅 로직
   - 각 Store와 연결

3. **통합 테스트** (1,035개)
   - Pylon 455개 테스트
   - Client 98개 테스트

상세: `log/2026-02-02-v2-migration-plan.md`

---

*작성일: 2026-02-01*
*완료일: 2026-02-02*

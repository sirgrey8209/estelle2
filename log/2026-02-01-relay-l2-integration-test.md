# Relay L2 통합 테스트 작성

> **상태**: ✅ 완료
> **작업일**: 2026-02-01

---

## 목표

Relay 서버의 연결/인증 프로세스를 검증하는 L2 통합 테스트 작성

---

## 완료 사항

### 테스트 파일
`packages/relay/tests/integration.test.ts` - 23개 테스트

### 커버리지

| 카테고리 | 테스트 수 |
|----------|----------|
| 1. 연결 | 1 |
| 2. Pylon 인증 | 4 |
| 3. App 인증 | 4 |
| 4. 인증 응답 형식 | 3 |
| 5. 인증 후 동작 | 4 |
| 6. 브로드캐스트 | 2 |
| 7. 라우팅 | 3 |
| 8. 연결 해제 | 2 |

### 수정된 버그
- `message-handler.ts`: device_status 브로드캐스트 시 빈 배열 대신 실제 디바이스 목록 전송

### 리팩토링
- `createAuthFailureResult` 헬퍼 함수 추출로 중복 제거

---

## 테스트 범위 한계

```
App ↔ Relay    ✅ 테스트함
Pylon ↔ Relay  ⚠️ 일부 (테스트 클라이언트가 Pylon 역할)
Pylon ↔ App    ❌ 테스트 안 함
```

### 발견된 미커버 이슈

`workspace_list_result` 메시지에서 deviceId 타입 에러 발생:
- Pylon이 deviceId를 string으로 전송
- App(Dart)이 int?로 기대
- **Pylon ↔ App 구간 테스트 필요**

---

## 다음 작업

Pylon ↔ App 통합 테스트 작성 필요

---

*완료: 2026-02-01*

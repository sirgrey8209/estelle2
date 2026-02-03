# 타입 통일: 인증 메시지 형식 수정 (TDD)

> **상태**: ✅ 완료
> **방식**: Option B (타입 통일) + TDD Flow
> **작성일**: 2026-01-31
> **완료일**: 2026-02-01

---

## 문제 요약

Pylon ↔ Relay 간 인증 메시지 형식 불일치로 연결 실패

```
[relay] Cannot destructure property 'deviceId' of 'payload' as it is undefined.
```

---

## TDD 사이클 계획

이 작업은 3개의 독립적인 TDD 사이클로 분해됩니다.

---

## Cycle 1: core - AuthPayload 타입 수정

### 대상
`@estelle/core` - `AuthPayload.pcId` → `deviceId` 변경

### 기능 설명
기존 `pcId` 필드를 `deviceId`로 변경하여 relay/pylon과 네이밍 통일

### TDD Flow

```
[1. TEST]     기존 테스트에서 pcId → deviceId 변경
[2. VERIFY]   FIRST 원칙 검증
[3. 실패 확인] pnpm --filter @estelle/core test (타입 에러로 실패)
[4. IMPL]     AuthPayload 타입 수정
[5. 통과 확인] pnpm --filter @estelle/core test
[6. REFACTOR] 불필요 시 생략
[7. 최종 확인] pnpm --filter @estelle/core test
```

### 변경 파일
- `packages/core/src/types/auth.ts`
- `packages/core/src/**/*.test.ts` (관련 테스트)

---

## Cycle 2: relay - core 타입 사용

### 대상
`@estelle/relay` - `AuthRequestPayload` → `AuthPayload` (from core)

### 기능 설명
자체 정의 `AuthRequestPayload` 대신 core의 `AuthPayload` 사용

### TDD Flow

```
[1. TEST]     기존 테스트에서 import를 core로 변경
[2. VERIFY]   FIRST 원칙 검증
[3. 실패 확인] pnpm --filter @estelle/relay test (import 에러로 실패)
[4. IMPL]     message-handler.ts에서 core 타입 import, types.ts 중복 제거
[5. 통과 확인] pnpm --filter @estelle/relay test
[6. REFACTOR] 불필요 시 생략
[7. 최종 확인] pnpm --filter @estelle/relay test
```

### 변경 파일
- `packages/relay/src/message-handler.ts`
- `packages/relay/src/types.ts`
- `packages/relay/src/**/*.test.ts`

---

## Cycle 3: pylon - Message<AuthPayload> 형식 사용

### 대상
`@estelle/pylon` - `RelayClient.createIdentifyMessage()`

### 기능 설명
`IdentifyMessage` 제거, `Message<AuthPayload>` 형식으로 인증 메시지 전송

### TDD Flow

```
[1. TEST]     createIdentifyMessage 테스트를 Message<AuthPayload> 형식으로 수정
[2. VERIFY]   FIRST 원칙 검증
[3. 실패 확인] pnpm --filter @estelle/pylon test (형식 불일치로 실패)
[4. IMPL]     createIdentifyMessage() 수정, IdentifyMessage 제거
[5. 통과 확인] pnpm --filter @estelle/pylon test
[6. REFACTOR] 불필요 시 생략
[7. 최종 확인] pnpm --filter @estelle/pylon test
```

### 변경 파일
- `packages/pylon/src/network/relay-client.ts`
- `packages/pylon/src/network/relay-client.test.ts`

---

## 통합 테스트

모든 TDD 사이클 완료 후:

```bash
# 전체 빌드
pnpm build

# 전체 테스트
pnpm test

# 개발 서버 실행
pnpm dev
```

### 검증 항목
- [ ] Relay 로그: 인증 성공
- [ ] Pylon 로그: Connected to Relay
- [ ] App: workspace 로딩 성공

---

## 체크리스트

### Cycle 1: core
- [ ] TEST: `pcId` → `deviceId` 테스트 수정
- [ ] 실패 확인
- [ ] IMPL: `AuthPayload` 타입 수정
- [ ] 통과 확인

### Cycle 2: relay
- [ ] TEST: core 타입 import로 변경
- [ ] 실패 확인
- [ ] IMPL: `message-handler.ts` 수정, 중복 타입 제거
- [ ] 통과 확인

### Cycle 3: pylon
- [ ] TEST: `Message<AuthPayload>` 형식 테스트
- [ ] 실패 확인
- [ ] IMPL: `createIdentifyMessage()` 수정
- [ ] 통과 확인

### 통합
- [ ] `pnpm build` 성공
- [ ] `pnpm test` 전체 통과
- [ ] `pnpm dev` 연결 성공

---

## 실행 순서

```
Cycle 1 (core) → Cycle 2 (relay) → Cycle 3 (pylon) → 통합 테스트
```

의존성: Cycle 2, 3은 Cycle 1 완료 후 진행 가능

---

## 완료 결과

### 변경된 파일
| 패키지 | 파일 | 변경 내용 |
|--------|------|-----------|
| core | `src/types/auth.ts` | `pcId` → `deviceId`, optional |
| core | `tests/types/auth.test.ts` | deviceId 테스트 추가 |
| relay | `src/message-handler.ts` | core 타입 import |
| relay | `src/types.ts` | AuthRequestPayload 제거 |
| relay | `src/index.ts` | AuthPayload re-export |
| pylon | `src/network/relay-client.ts` | Message<AuthPayload> 형식 |
| pylon | `src/network/index.ts` | IdentifyMessage export 제거 |
| pylon | `src/index.ts` | IdentifyMessage export 제거 |
| pylon | `tests/network/relay-client.test.ts` | Message<AuthPayload> 테스트 |

### 테스트 결과
- core: 342개 통과
- relay: 112개 통과
- pylon: 427개 통과
- **총 881개 테스트 통과**

### 연결 확인
```
[pylon] Connected to Relay: Estelle Relay v2
[pylon] Authenticated as Device 1
[relay] Device status: 1 authenticated
```

*작업 완료: 2026-02-01*

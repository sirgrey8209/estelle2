# v2 Pylon-Relay 인증 연동 플랜

> ✅ **완료** (2026-01-31)

## 현재 상황

### 실행 중인 시스템
| 컴포넌트 | 버전 | 포트 | 상태 |
|----------|------|------|------|
| Relay | v2 | 8081 | 실행 중 ✅ |
| Pylon | v2 | 9001 | 실행 중 ✅ |
| Flutter App | - | Chrome | v2 Relay 연결 ✅ (deviceId: 100) |

### 문제
- Pylon v2가 Relay v2에 **인증 실패**
- 에러: `"Not authenticated"`

### 원인
메시지 타입 불일치:
```
Pylon → Relay: { type: 'identify', deviceId: '1', deviceType: 'pylon' }
Relay 기대값:  { type: 'auth', deviceId: '1', deviceType: 'pylon' }
```

## 해결 방안

### 수정 대상
`packages/pylon/src/network/relay-client.ts`

### 변경 내용
1. `IdentifyMessage` 인터페이스의 `type`을 `'identify'` → `'auth'`로 변경
2. `createIdentifyMessage()` 메서드의 반환값 type을 `'auth'`로 변경

## TDD 플로우

### 1단계: 테스트 수정 ✅ (완료)
`packages/pylon/tests/network/relay-client.test.ts`
- 기대값을 `type: 'auth'`로 변경

### 2단계: 테스트 실패 확인 ✅ (완료)
```bash
pnpm --filter @estelle/pylon test tests/network/relay-client.test.ts
```

### 3단계: 구현 수정 ✅ (완료)
`packages/pylon/src/network/relay-client.ts`
- `IdentifyMessage.type`: `'identify'` → `'auth'`
- `createIdentifyMessage()` 반환값의 type: `'identify'` → `'auth'`

### 4단계: 테스트 통과 확인 ✅ (완료)
```bash
pnpm --filter @estelle/pylon test tests/network/relay-client.test.ts
```

### 5단계: 전체 테스트 확인 ✅ (완료)
```bash
pnpm --filter @estelle/pylon test
# 427개 테스트 통과
```

### 6단계: 빌드 및 재시작 ✅ (완료)
```bash
pnpm --filter @estelle/pylon build
# Pylon v2 재시작
```

### 7단계: 연결 검증 ✅ (완료)
- Pylon 로그에서 "Connected to Relay: Estelle Relay v2" 확인

## 영향 범위

| 파일 | 변경 내용 |
|------|----------|
| `packages/pylon/src/network/relay-client.ts` | 메시지 타입 변경 |
| `packages/pylon/tests/network/relay-client.test.ts` | 테스트 기대값 변경 (완료) |

## 검증 방법

1. **단위 테스트**: `pnpm --filter @estelle/pylon test`
2. **통합 테스트**:
   - Pylon v2 재시작 후 Relay v2 연결 확인
   - Flutter 앱에서 워크스페이스 로딩 확인

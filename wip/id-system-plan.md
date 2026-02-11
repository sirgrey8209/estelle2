# id-system 구현 계획

## 구현 목표

24비트 통합 ID 체계(`id-system.ts`)를 구현하여 기존 `entity-id.ts`를 대체한다.

## 구현 방향

### 비트 레이아웃

```
conversationId (24비트):
┌─────────┬─────┬─────────────┬───────────────┬──────────────────┐
│ envId   │ DT  │ deviceIndex │ workspaceIndex│ conversationIndex│
│ 2비트   │1bit │ 4비트       │ 7비트         │ 10비트           │
└─────────┴─────┴─────────────┴───────────────┴──────────────────┘
```

### 계층 구조

```
envId (2비트: 0=release, 1=stage, 2=dev)
  ├─ pylonId (7비트) = envId + DT(0) + deviceIndex
  │    └─ workspaceId (14비트) = pylonId + workspaceIndex
  │         └─ conversationId (24비트) = workspaceId + conversationIndex
  │
  └─ clientId (7비트) = envId + DT(1) + deviceIndex
```

### 상수 정의

```typescript
ENV_ID_BITS = 2           // 0~2
DEVICE_TYPE_BITS = 1      // 0=Pylon, 1=Client
DEVICE_INDEX_BITS = 4     // 1~15 (Pylon), 0~15 (Client)
WORKSPACE_INDEX_BITS = 7  // 1~127
CONVERSATION_INDEX_BITS = 10  // 1~1023
```

### 구현할 함수

**인코딩**:
1. `encodePylonId(envId, deviceIndex)` → PylonId (7비트)
2. `encodeClientId(envId, deviceIndex)` → ClientId (7비트)
3. `encodeWorkspaceId(pylonId, workspaceIndex)` → WorkspaceId (14비트)
4. `encodeConversationId(workspaceId, conversationIndex)` → ConversationId (24비트)

**디코딩**:
5. `decodePylonId(pylonId)` → { envId, deviceType: 0, deviceIndex }
6. `decodeClientId(clientId)` → { envId, deviceType: 1, deviceIndex }
7. `decodeDeviceId(deviceId)` → { envId, deviceType, deviceIndex }
8. `decodeWorkspaceId(workspaceId)` → { pylonId, workspaceIndex }
9. `decodeConversationId(conversationId)` → { workspaceId, conversationIndex }
10. `decodeConversationIdFull(conversationId)` → 전체 분해

**유틸리티**:
11. `isPylonId(id)`, `isClientId(id)` - deviceType 비트로 판별
12. `conversationIdToString(id)` - "env:dt:device:ws:conv" 형식

### 브랜드 타입

```typescript
type EnvId = 0 | 1 | 2;
type DeviceType = 0 | 1;
type PylonId = number & { readonly __brand: 'PylonId' };
type ClientId = number & { readonly __brand: 'ClientId' };
type DeviceId = PylonId | ClientId;
type WorkspaceId = number & { readonly __brand: 'WorkspaceId' };
type ConversationId = number & { readonly __brand: 'ConversationId' };
```

## 영향 범위

- **신규 생성**: `packages/core/src/utils/id-system.ts`
- **테스트 생성**: `packages/core/tests/utils/id-system.test.ts`
- **수정 필요 (Phase 2 이후)**: `entity-id.ts` deprecated 마킹

## 테스트 케이스 (예상 ~25개)

### 인코딩 테스트
- encodePylonId: 정상, 범위 초과
- encodeClientId: 정상, 범위 초과
- encodeWorkspaceId: 정상, 범위 초과
- encodeConversationId: 정상, 범위 초과

### 디코딩 테스트
- decode 각 함수: 왕복(roundtrip) 검증
- decodeConversationIdFull: 전체 분해 검증

### 타입 판별 테스트
- isPylonId / isClientId

### 비트 레이아웃 검증
- 특정 값의 비트 패턴 검증
- 환경별 예시값 검증 (release/stage/dev)

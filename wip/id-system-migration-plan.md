# ID 시스템 마이그레이션 플랜

> doc/id-system.md 설계를 반영한 24비트 통합 ID 체계 마이그레이션

---

## 결정사항 요약

| 항목 | 결정 |
|------|------|
| 배포 전략 | dev/stage 빅뱅, release는 검증 후 데이터 마이그레이션 |
| entityId 이름 | → `conversationId` (항상 Conversation 레벨이므로 명확화) |
| Relay deviceId (내부) | → `deviceIndex` (환경 내 로컬 유니크) |
| Client deviceIndex 할당 | 빈 번호 재활용 (0~15, Workspace 방식과 동일) |

---

## 현황 vs 목표

### 현재 구현 (21비트 + envId 확장 23비트)

```
기존 EntityId (21비트):
┌─────────────┬───────────────┬──────────────────┐
│ pylonId     │ workspaceId   │ conversationId   │
│ 4비트       │ 7비트         │ 10비트           │
└─────────────┴───────────────┴──────────────────┘

확장 EntityId (23비트) - 일부 사용 중:
┌─────────┬─────────────┬───────────────┬──────────────────┐
│ envId   │ pylonId     │ workspaceId   │ conversationId   │
│ 2비트   │ 4비트       │ 7비트         │ 10비트           │
└─────────┴─────────────┴───────────────┴──────────────────┘
```

### 목표 설계 (24비트)

```
새 conversationId (24비트):
┌─────────┬─────┬─────────────┬───────────────┬──────────────────┐
│ envId   │ DT  │ deviceIndex │ workspaceIndex│ conversationIndex│
│ 2비트   │1bit │ 4비트       │ 7비트         │ 10비트           │
└─────────┴─────┴─────────────┴───────────────┴──────────────────┘
           └──────────┬──────┘
              deviceId (7비트)
```

**핵심 변경점**:
1. `pylonId` 4비트 → `deviceType`(1) + `deviceIndex`(4) = 5비트
2. 총 비트: 21 → 24 (+ deviceType 1비트)
3. Index vs Id 명명 통일
4. `entityId` → `conversationId` 이름 변경

---

## 용어 정리

### Index vs Id 원칙

| 구분 | Index | Id |
|------|-------|-----|
| 의미 | **로컬 유니크** (범위 내에서만) | **전역 유니크** (envId 포함) |
| 예시 | deviceIndex, workspaceIndex | deviceId, workspaceId, conversationId |

### 이름 변경 매핑

| 기존 | 신규 | 비고 |
|------|------|------|
| `pylonId` (4비트) | `deviceIndex` | Pylon 내부 (1~15) |
| `deviceId` (Relay 내부) | `deviceIndex` | 환경 내 로컬 유니크 |
| - | `deviceType` (DT) | 0=Pylon, 1=Client |
| - | `pylonId` (7비트) | envId + DT(0) + deviceIndex |
| - | `clientId` (7비트) | envId + DT(1) + deviceIndex |
| - | `deviceId` (7비트) | pylonId \| clientId (Union, 전역 유니크) |
| `workspaceId` (7비트) | `workspaceIndex` | 로컬 유니크 (Pylon 내) |
| - | `workspaceId` (14비트) | pylonId + workspaceIndex |
| `conversationId` (10비트) | `conversationIndex` | 로컬 유니크 (Workspace 내) |
| `entityId` (21~23비트) | `conversationId` (24비트) | 전역 유니크 |

---

## 마이그레이션 전략

### 빅뱅 (dev/stage) + 지연 적용 (release)

```
┌─────────────────────────────────────────────────────────────┐
│  Phase 1: Core 패키지 재작성                                │
│  - entity-id.ts → id-system.ts (24비트)                    │
│  - 새 타입: DeviceId, PylonId, ClientId, WorkspaceId 등    │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  Phase 2: Pylon 마이그레이션                                │
│  - WorkspaceStore: pylonId → deviceIndex                   │
│  - bin.ts: envId + deviceIndex 주입                        │
│  - 내부 함수 시그니처 변경                                   │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  Phase 3: Relay 마이그레이션                                │
│  - deviceId 체계 변경 (7비트 통합)                          │
│  - device-id-validation.ts 재작성                          │
│  - 인증 시 deviceId 파싱                                    │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  Phase 4: Client 수정 (최소)                                │
│  - EntityId 디코딩만 사용                                   │
│  - 새 conversationId 타입 적용                              │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  Phase 5: dev/stage 테스트                                  │
│  - 전체 테스트 통과                                          │
│  - E2E 수동 검증                                             │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  Phase 6: Release 데이터 마이그레이션                        │
│  - 기존 entityId → 새 conversationId 변환                   │
│  - release-data/ 백업 및 마이그레이션 스크립트               │
└─────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Core 패키지 재작성

### 1.1 새 파일 생성: `packages/core/src/utils/id-system.ts`

```typescript
// 상수 정의
export const ENV_ID_BITS = 2;           // envId: 0~2
export const DEVICE_TYPE_BITS = 1;      // deviceType: 0=Pylon, 1=Client
export const DEVICE_INDEX_BITS = 4;     // deviceIndex: 1~15 (Pylon), 0~15 (Client)
export const WORKSPACE_INDEX_BITS = 7;  // workspaceIndex: 1~127
export const CONVERSATION_INDEX_BITS = 10; // conversationIndex: 1~1023

// 파생 상수
export const DEVICE_ID_BITS = ENV_ID_BITS + DEVICE_TYPE_BITS + DEVICE_INDEX_BITS; // 7비트
export const WORKSPACE_ID_BITS = DEVICE_ID_BITS + WORKSPACE_INDEX_BITS; // 14비트
export const CONVERSATION_ID_BITS = WORKSPACE_ID_BITS + CONVERSATION_INDEX_BITS; // 24비트

// 최대값
export const MAX_ENV_ID = 2;             // 0=release, 1=stage, 2=dev
export const MAX_DEVICE_INDEX = 15;      // 4비트
export const MAX_WORKSPACE_INDEX = 127;  // 7비트
export const MAX_CONVERSATION_INDEX = 1023; // 10비트

// 브랜드 타입
export type EnvId = 0 | 1 | 2;
export type DeviceType = 0 | 1; // 0=Pylon, 1=Client
export type DeviceIndex = number & { readonly __brand: 'DeviceIndex' };
export type PylonId = number & { readonly __brand: 'PylonId' };
export type ClientId = number & { readonly __brand: 'ClientId' };
export type DeviceId = PylonId | ClientId;
export type WorkspaceIndex = number & { readonly __brand: 'WorkspaceIndex' };
export type WorkspaceId = number & { readonly __brand: 'WorkspaceId' };
export type ConversationIndex = number & { readonly __brand: 'ConversationIndex' };
export type ConversationId = number & { readonly __brand: 'ConversationId' };

// 인코딩 함수
export function encodePylonId(envId: EnvId, deviceIndex: number): PylonId;
export function encodeClientId(envId: EnvId, deviceIndex: number): ClientId;
export function encodeWorkspaceId(pylonId: PylonId, workspaceIndex: number): WorkspaceId;
export function encodeConversationId(workspaceId: WorkspaceId, conversationIndex: number): ConversationId;

// 디코딩 함수
export function decodePylonId(id: PylonId): { envId: EnvId; deviceType: 0; deviceIndex: number };
export function decodeClientId(id: ClientId): { envId: EnvId; deviceType: 1; deviceIndex: number };
export function decodeDeviceId(id: DeviceId): { envId: EnvId; deviceType: DeviceType; deviceIndex: number };
export function decodeWorkspaceId(id: WorkspaceId): { pylonId: PylonId; workspaceIndex: number };
export function decodeConversationId(id: ConversationId): { workspaceId: WorkspaceId; conversationIndex: number };

// 풀 디코딩
export function decodeConversationIdFull(id: ConversationId): {
  envId: EnvId;
  deviceType: DeviceType;
  deviceIndex: number;
  workspaceIndex: number;
  conversationIndex: number;
};

// 레벨 판별
export function isPylonId(id: number): id is PylonId;
export function isClientId(id: number): id is ClientId;
export function isWorkspaceId(id: number): id is WorkspaceId;
export function isConversationId(id: number): id is ConversationId;
```

### 1.2 레거시 호환 레이어

```typescript
// entity-id.ts에 마이그레이션 헬퍼 추가
/** @deprecated 새 id-system.ts 사용 */
export function migrateEntityIdToConversationId(
  oldEntityId: EntityId,
  deviceType: DeviceType = 0
): ConversationId;

/** @deprecated 새 id-system.ts 사용 */
export function migrateConversationIdToEntityId(
  newConversationId: ConversationId
): EntityId;
```

### 1.3 Core 타입 변경

```typescript
// types/workspace.ts
export interface Conversation {
  // entityId: EntityId → conversationId: ConversationId
  conversationId: ConversationId;
  // ... 나머지 동일
}
```

---

## Phase 2: Pylon 마이그레이션

### 2.1 WorkspaceStore 변경

**현재**:
```typescript
class WorkspaceStore {
  private _pylonId: number;
  private _envId: number;

  createConversation(workspaceId: number, name: string) {
    const localId = this.allocateConversationId(workspace);
    const entityId = encodeEntityIdWithEnv(this._envId, this._pylonId, workspaceId, localId);
  }
}
```

**변경 후**:
```typescript
class WorkspaceStore {
  private _pylonId: PylonId;  // 7비트 (envId + DT + deviceIndex)

  createConversation(workspaceIndex: number, name: string) {
    const localIndex = this.allocateConversationIndex(workspace);
    const workspaceId = encodeWorkspaceId(this._pylonId, workspaceIndex);
    const conversationId = encodeConversationId(workspaceId, localIndex);
  }
}
```

### 2.2 bin.ts 변경

**현재**:
```typescript
const envId = envConfig?.envId ?? 0;
const deviceId = parseInt(envConfig?.pylon?.deviceId || '1', 10);
// WorkspaceStore에 각각 전달
```

**변경 후**:
```typescript
const envId = envConfig?.envId ?? 0 as EnvId;
const deviceIndex = parseInt(envConfig?.pylon?.deviceIndex || '1', 10);
const pylonId = encodePylonId(envId, deviceIndex);
// WorkspaceStore에 pylonId만 전달
```

### 2.3 영향받는 파일

- `stores/workspace-store.ts` - 핵심 변경
- `bin.ts` - pylonId 생성 로직
- `pylon.ts` - entityId → conversationId
- `handlers/` - entityId 참조 수정
- `servers/pylon-mcp-server.ts` - entityId 조회

---

## Phase 3: Relay 마이그레이션

### 3.1 deviceId 체계 통합

**현재 (고전 체계)**:
```typescript
// 1-9: Pylon, 10-99: Reserved, 100+: Desktop
const PYLON_ID_MIN = 1;
const PYLON_ID_MAX = 9;
const DESKTOP_ID_MIN = 100;
```

**변경 후 (7비트 통합)**:
```typescript
// deviceId = envId(2) + deviceType(1) + deviceIndex(4)
// Pylon: envId + 0 + deviceIndex
// Client: envId + 1 + deviceIndex

// 예시:
// release Pylon 1: 0b00_0_0001 = 1
// stage Pylon 1:   0b01_0_0001 = 33
// dev Pylon 1:     0b10_0_0001 = 65
// release Client 0: 0b00_1_0000 = 16
// stage Client 0:   0b01_1_0000 = 48
// dev Client 0:     0b10_1_0000 = 80
```

### 3.2 Client deviceIndex 할당

**현재 (순차 증가)**:
```typescript
class DeviceIdAssigner {
  private nextId = 100;  // 계속 증가
  assign() { return this.nextId++; }
}
```

**변경 (빈 번호 재활용, Workspace 방식)**:
```typescript
class ClientIndexAllocator {
  private usedIndices = new Set<number>();

  allocate(): number {
    // 0부터 빈 번호 찾기
    for (let i = 0; i <= 15; i++) {  // 4비트: 0~15
      if (!this.usedIndices.has(i)) {
        this.usedIndices.add(i);
        return i;
      }
    }
    throw new Error('No available client index');
  }

  release(index: number): void {
    this.usedIndices.delete(index);
  }
}
```

### 3.3 인증 (IP 기반, 변경 없음)

현재 Relay는 **토큰이 아닌 IP 기반 인증**:
```typescript
// constants.ts - 기존 유지
DEVICES: Record<number, DeviceConfig> = {
  1: { name: 'Device 1', allowedIps: ['*'] },
  2: { name: 'Device 2', allowedIps: ['*'] },
};
```

Pylon은 기존처럼 `deviceIndex` (1, 2)로 연결하고, Relay가 envId를 추가하여 `pylonId`로 변환.

### 3.4 영향받는 파일

- `device-id-validation.ts` - deviceIndex 기반 재작성
- `constants.ts` - deviceId → deviceIndex 이름 변경
- `auth.ts` - deviceId → deviceIndex
- `types.ts` - Client 인터페이스

---

## Phase 4: Client 수정

### 4.1 최소 변경

Client는 ID를 **디코딩만** 하므로 변경 최소화:

```typescript
// conversationStore.ts
interface ConversationStoreState {
  // states: Map<number, ...> → Map<ConversationId, ...>
  states: Map<ConversationId, ConversationClaudeState>;
  currentConversationId: ConversationId | null;
}
```

### 4.2 영향받는 파일

- `stores/conversationStore.ts` - 타입만 변경
- `stores/workspaceStore.ts` - entityId → conversationId
- `components/` - props 타입 변경

---

## Phase 5: dev/stage 테스트

### 5.1 테스트 체크리스트

```
□ Core 단위 테스트 통과 (id-system.test.ts)
□ Pylon 단위 테스트 통과 (workspace-store.test.ts)
□ Relay 단위 테스트 통과 (device-id-validation.test.ts)
□ Client 단위 테스트 통과
□ 전체 테스트 통과 (pnpm test)
□ dev 환경 수동 테스트
□ stage 배포 및 수동 테스트
```

### 5.2 E2E 시나리오

1. Pylon 시작 → Relay 연결
2. Client 접속 → 워크스페이스 목록 수신
3. 새 대화 생성 → conversationId 확인
4. Claude 세션 시작 → 메시지 송수신
5. 다른 Client 접속 → 동일 상태 확인

---

## Phase 6: Release 데이터 마이그레이션

### 6.1 마이그레이션 스크립트

```typescript
// scripts/migrate-entity-id.ts

interface OldWorkspaceData {
  workspaces: Array<{
    workspaceId: number;
    conversations: Array<{
      entityId: number; // 23비트 (envId + pylonId + workspaceId + convId)
    }>;
  }>;
}

interface NewWorkspaceData {
  workspaces: Array<{
    workspaceIndex: number;
    conversations: Array<{
      conversationId: number; // 24비트 (envId + DT + deviceIndex + wsIndex + convIndex)
    }>;
  }>;
}

function migrate(old: OldWorkspaceData, pylonId: PylonId): NewWorkspaceData {
  // 1. 기존 entityId 디코딩 (23비트)
  // 2. 새 conversationId 인코딩 (24비트, deviceType=0 고정)
}
```

### 6.2 백업 및 롤백

```powershell
# 백업
Copy-Item -Recurse release-data/ release-data-backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')/

# 마이그레이션
node scripts/migrate-entity-id.js --target release

# 롤백 (필요시)
Remove-Item -Recurse release-data/
Copy-Item -Recurse release-data-backup-xxx/ release-data/
```

---

## 파일별 변경 요약

### Core (11개 파일)

| 파일 | 변경 내용 |
|------|----------|
| `utils/id-system.ts` | **신규** - 24비트 ID 시스템 |
| `utils/entity-id.ts` | deprecated 마킹 + 마이그레이션 헬퍼 |
| `utils/deviceId.ts` | 삭제 또는 deprecated |
| `utils/index.ts` | export 수정 |
| `types/device.ts` | DeviceType 수정 (string → number) |
| `types/workspace.ts` | entityId → conversationId |
| `types/message.ts` | entityId 참조 수정 |
| `types/auth.ts` | deviceId 타입 수정 |
| `types/claude-control.ts` | entityId → conversationId |
| `types/claude-event.ts` | entityId → conversationId |
| `tests/` | 테스트 업데이트 |

### Pylon (15+ 파일)

| 파일 | 변경 내용 |
|------|----------|
| `stores/workspace-store.ts` | pylonId 체계 변경, entityId → conversationId |
| `bin.ts` | pylonId 생성 로직 |
| `pylon.ts` | entityId → conversationId |
| `handlers/*.ts` | entityId 참조 수정 |
| `servers/pylon-mcp-server.ts` | entityId → conversationId |
| `claude/claude-manager.ts` | entityId → conversationId |
| `tests/` | 테스트 업데이트 |

### Relay (5개 파일)

| 파일 | 변경 내용 |
|------|----------|
| `device-id-validation.ts` | 전면 재작성 (7비트 체계) |
| `auth/*.ts` | 토큰 파싱 로직 |
| `types.ts` | deviceId 타입 |
| `router.ts` | deviceId 사용처 |
| `tests/` | 테스트 업데이트 |

### Client (10+ 파일)

| 파일 | 변경 내용 |
|------|----------|
| `stores/conversationStore.ts` | entityId → conversationId |
| `stores/workspaceStore.ts` | entityId → conversationId |
| `hooks/useConversation.ts` | 타입 변경 |
| `components/*.tsx` | props 타입 변경 |
| `tests/` | 테스트 업데이트 |

### Claude Beacon (2개 파일)

| 파일 | 변경 내용 |
|------|----------|
| `tool-context-map.ts` | entityId → conversationId |
| `beacon-adapter.ts` | entityId → conversationId |

---

## 예상 작업량

| Phase | 예상 시간 | 테스트 수 (신규) |
|-------|----------|-----------------|
| Phase 1: Core | 2시간 | ~30개 |
| Phase 2: Pylon | 3시간 | ~20개 |
| Phase 3: Relay | 1.5시간 | ~15개 |
| Phase 4: Client | 1시간 | ~10개 |
| Phase 5: 테스트 | 1시간 | - |
| Phase 6: Release 마이그레이션 | 0.5시간 | - |
| **합계** | **~9시간** | **~75개** |

---

## 위험 요소 및 대응

### 1. 기존 저장 데이터 호환성
- **위험**: release-data의 entityId가 새 형식과 호환 안 됨
- **대응**: Phase 6에서 마이그레이션 스크립트 실행

### 2. 메시지 히스토리 entityId
- **위험**: 저장된 메시지에 entityId 포함
- **대응**: 메시지 로드 시 마이그레이션 또는 무시 (히스토리는 conversationId로 폴더 매핑)

### 3. MCP 도구 toolUseId → entityId 매핑
- **위험**: Beacon의 ToolContextMap 호환성
- **대응**: entityId → conversationId 일괄 변경 (동일 타입 사용)

---

## 다음 단계

1. ~~이 플랜 검토 및 승인~~ ✅
2. `wip/id-system-migration-tdd.md` 작성 (TDD 테스트 케이스)
3. Phase 1부터 순차 진행 (TDD)

---

*작성일: 2026-02-11*
*갱신일: 2026-02-11*

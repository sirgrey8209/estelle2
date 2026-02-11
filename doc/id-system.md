# ID 체계 설계

> Estelle v2의 식별자 체계 정의

## 원칙: Index vs Id

| 구분 | Index | Id |
|------|-------|-----|
| 의미 | **로컬 유니크** (범위 내에서만) | **전역 유니크** (envId 포함) |
| 예시 | deviceIndex, workspaceIndex | deviceId, workspaceId |

---

## 비트 레이아웃 (24비트)

```
conversationId (24비트):
┌─────────┬─────┬─────────────┬───────────────┬──────────────────┐
│ envId   │ DT  │ deviceIndex │ workspaceIndex│ conversationIndex│
│ 2비트   │1bit │ 4비트       │ 7비트         │ 10비트           │
└─────────┴─────┴─────────────┴───────────────┴──────────────────┘
           └──────────┬──────┘
              pylonId or clientId (7비트)
```

**DT** = deviceType (0=Pylon, 1=Client)

---

## ID 정의

### envId (2비트)

| 값 | 환경 |
|----|------|
| 0 | release |
| 1 | stage |
| 2 | dev |

---

### deviceIndex (4비트)

| | deviceIndex |
|---|-------------|
| 의미 | Relay 내 디바이스 그룹에서의 순번 |
| 범위 | Pylon: 1~15, Client: 0~15 |
| 유니크 | 환경 + deviceType 내에서만 |

---

### pylonId / clientId / deviceId (7비트)

**같은 티어, 같은 비트 구조**

```
pylonId = envId + deviceType(0) + deviceIndex
┌─────────┬─────┬─────────────┐
│ envId   │  0  │ deviceIndex │
│ 2비트   │1bit │ 4비트       │
└─────────┴─────┴─────────────┘

clientId = envId + deviceType(1) + deviceIndex
┌─────────┬─────┬─────────────┐
│ envId   │  1  │ deviceIndex │
│ 2비트   │1bit │ 4비트       │
└─────────┴─────┴─────────────┘

deviceId = pylonId | clientId (Union)
```

| 이름 | deviceType | 용도 |
|------|------------|------|
| **pylonId** | 0 | Pylon 서버 식별 |
| **clientId** | 1 | Client 앱 식별 |
| **deviceId** | 0 or 1 | Relay 라우팅 대상 (둘 중 하나) |

---

### workspaceIndex / workspaceId

| | workspaceIndex | workspaceId (14비트) |
|---|----------------|----------------------|
| 의미 | Pylon 내 워크스페이스 순번 | pylonId + workspaceIndex |
| 범위 | 1~127 | - |
| 유니크 | Pylon 내 | **전역** |

```
workspaceId (14비트) = pylonId + workspaceIndex
┌─────────┬─────┬─────────────┬───────────────┐
│ envId   │  0  │ deviceIndex │ workspaceIndex│
│ 2비트   │1bit │ 4비트       │ 7비트         │
└─────────┴─────┴─────────────┴───────────────┘
```

> **Note**: workspaceId는 pylonId 기반 (deviceType=0)

---

### conversationIndex / conversationId

| | conversationIndex | conversationId (24비트) |
|---|-------------------|-------------------------|
| 의미 | Workspace 내 대화 순번 | workspaceId + conversationIndex |
| 범위 | 1~1023 | - |
| 유니크 | Workspace 내 | **전역** |

```
conversationId (24비트) = workspaceId + conversationIndex
┌─────────┬─────┬─────────────┬───────────────┬──────────────────┐
│ envId   │  0  │ deviceIndex │ workspaceIndex│ conversationIndex│
│ 2비트   │1bit │ 4비트       │ 7비트         │ 10비트           │
└─────────┴─────┴─────────────┴───────────────┴──────────────────┘
```

---

## 계층 구조

```
envId (2비트)
  ├─ pylonId (7비트) = envId + 0 + deviceIndex
  │    └─ workspaceId (14비트) = pylonId + workspaceIndex
  │         └─ conversationId (24비트) = workspaceId + conversationIndex
  │
  └─ clientId (7비트) = envId + 1 + deviceIndex
       └─ (Client는 workspace/conversation 없음)

deviceId = pylonId | clientId (Relay 라우팅용)
```

---

## 요약 표

| 이름 | 비트 | 구성 | 유니크 범위 |
|------|------|------|-------------|
| envId | 2 | - | 전역 |
| deviceType | 1 | - | - |
| deviceIndex | 4 | - | 환경+타입 내 |
| **pylonId** | 7 | envId + 0 + deviceIndex | 전역 |
| **clientId** | 7 | envId + 1 + deviceIndex | 전역 |
| **deviceId** | 7 | pylonId \| clientId | 전역 |
| workspaceIndex | 7 | - | Pylon 내 |
| **workspaceId** | 14 | pylonId + workspaceIndex | 전역 |
| conversationIndex | 10 | - | Workspace 내 |
| **conversationId** | 24 | workspaceId + conversationIndex | 전역 |

---

## 인코딩/디코딩 예시

```typescript
// 상수
const ENV_ID_BITS = 2;
const DEVICE_TYPE_BITS = 1;
const DEVICE_INDEX_BITS = 4;
const WORKSPACE_INDEX_BITS = 7;
const CONVERSATION_INDEX_BITS = 10;

// pylonId 인코딩
const pylonId = (envId << 5) | (0 << 4) | deviceIndex;

// clientId 인코딩
const clientId = (envId << 5) | (1 << 4) | deviceIndex;

// workspaceId 인코딩
const workspaceId = (pylonId << 7) | workspaceIndex;

// conversationId 인코딩
const conversationId = (workspaceId << 10) | conversationIndex;

// conversationId 디코딩 (시프트 연산)
const conversationIndex = conversationId & 0x3FF;           // 하위 10비트
const workspaceIndex = (conversationId >> 10) & 0x7F;       // 다음 7비트
const deviceIndex = (conversationId >> 17) & 0xF;           // 다음 4비트
const deviceType = (conversationId >> 21) & 0x1;            // 다음 1비트
const envId = conversationId >> 22;                         // 상위 2비트
```

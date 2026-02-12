# MCP Beacon 마이그레이션 계획

> MCP 서버를 Beacon으로 이동하고, Pylon 주소 기반 동적 라우팅 구현

## 배경

### 현재 문제

1. **MCP 버전 불일치**: SDK는 하나의 MCP 설정만 가지는데, dev/stage/release Pylon 버전이 다름
2. **Pylon 라우팅 불가**: MCP가 환경변수(`ESTELLE_MCP_PORT`)로 고정 포트에만 연결
3. **pylonAddress 미사용**: lookup 결과의 `pylonAddress`를 받아도 활용하지 않음
4. **MCP 설정이 Pylon에 있음**: SDK에 등록하는 MCP 설정이 Pylon `bin.ts`에서 구성됨

### 목표 구조

```
Beacon (MCP 서버 실행 + SDK에 MCP 설정 제공)
    │
    │  1. SDK가 MCP 도구 호출
    │  2. Beacon의 MCP 서버 실행
    │  3. lookup으로 해당 Pylon의 host:port 획득
    │  4. 해당 Pylon에 동적 연결
    ↓
각 Pylon의 PylonMcpServer (실제 로직 구현, 버전별 독립)
```

## 설계

### 1. Pylon 등록 시 MCP 포트 전달

**변경**: Pylon → Beacon 등록 메시지에 `mcpPort` 추가

```typescript
// 현재
{ action: "register", pylonAddress: "2:1", env: "dev" }

// 변경
{ action: "register", pylonId: 65, mcpHost: "127.0.0.1", mcpPort: 9878, env: "dev" }
```

**pylonId 계산** (id-system.md 참조):
```typescript
// pylonId = (envId << 5) | (0 << 4) | deviceIndex
// dev(envId=2), deviceIndex=1 → (2 << 5) | 0 | 1 = 64 | 1 = 65
// stage(envId=1), deviceIndex=1 → (1 << 5) | 0 | 1 = 32 | 1 = 33
// release(envId=0), deviceIndex=1 → (0 << 5) | 0 | 1 = 0 | 1 = 1
```

### 2. 두 개의 매핑 분리

**ToolContextMap**: `toolUseId → ToolContext`
```typescript
interface ToolContext {
  conversationId: number;  // 여기서 pylonId 추출 가능
  raw: ToolUseRaw;
}
```

**PylonRegistry**: `pylonId → PylonConnection` (Pylon 등록 시 저장)
```typescript
interface PylonConnection {
  pylonId: number;
  mcpHost: string;
  mcpPort: number;
  // env 불필요 - pylonId에서 추출 가능 (envId = pylonId >> 5)
}
```

**lookup 흐름**:
```typescript
// 1. toolUseId → conversationId
const context = toolContextMap.get(toolUseId);
const conversationId = context.conversationId;

// 2. conversationId → pylonId (비트 추출)
const pylonId = conversationId >> 17;

// 3. pylonId → mcpHost, mcpPort
const connection = pylonRegistry.get(pylonId);
const { mcpHost, mcpPort } = connection;
```

### 3. MCP 아키텍처

**역할 분리**:
- **Beacon**: MCP 서버 실행, SDK에 MCP 설정 제공, Pylon 라우팅 정보 관리
- **Pylon PylonMcpServer**: 실제 도구 로직 구현 (link, unlink, send_file 등)

**호출 흐름**:
```
SDK가 MCP 도구 호출 (link_doc)
    ↓
Beacon의 MCP 서버 실행 (stdio)
    ↓
MCP 서버: BeaconClient.lookup(toolUseId)
    → { conversationId, mcpHost, mcpPort }
    ↓
MCP 서버: PylonClient.connect(mcpHost, mcpPort)
    → { action: "link", conversationId, path }
    ↓
해당 Pylon의 PylonMcpServer가 실제 처리
```

### 4. MCP 설정 이동 (Pylon → Beacon)

**현재** (Pylon `bin.ts`):
```typescript
// Pylon이 SDK query 시 mcpServers 설정 전달
const estelleMcp = {
  command: 'node',
  args: [mcpServerPath],  // pylon/dist/mcp/server.js
  env: { ESTELLE_MCP_PORT: '9878' }
};
```

**변경** (Beacon `bin.ts`):
```typescript
// Beacon이 SDK query 시 mcpServers 설정 전달
const estelleMcp = {
  command: 'node',
  args: [mcpServerPath],  // claude-beacon/dist/mcp/server.js
  env: {
    ESTELLE_BEACON_PORT: '9875',  // Beacon lookup용
    ESTELLE_WORKING_DIR: workingDir,
  }
};
```

### 5. 파일 구조 변경

```
packages/pylon/src/mcp/
├── pylon-mcp-server.ts   # Pylon TCP 서버 (실제 로직) - 유지
└── (나머지 삭제)

packages/claude-beacon/src/
├── beacon.ts             # PylonRegistry 추가 (pylonId → mcpHost, mcpPort)
├── tool-context-map.ts   # ToolContext 타입 변경 (conversationId + raw만)
├── pylon-registry.ts     # 신규: pylonId → PylonConnection 매핑
└── mcp/
    ├── server.ts             # MCP 서버 (SDK stdio) - 이동
    ├── beacon-client.ts      # Beacon lookup - 이동
    ├── pylon-client.ts       # Pylon TCP 연결 (동적 host:port) - 이동
    └── tools/
        ├── link-document.ts  # link/unlink/list 도구 - 이동
        ├── send-file.ts      # 파일 전송 도구 - 이동
        └── deploy.ts         # 배포 도구 - 이동
```

### 6. PylonClient 변경

**현재**: 환경변수로 고정 포트
```typescript
const DEFAULT_PORT = parseInt(process.env['ESTELLE_MCP_PORT'] || '9880', 10);
```

**변경**: lookup 결과의 host:port 사용
```typescript
class PylonClient {
  // 싱글턴 제거, 매번 새 인스턴스
  constructor(host: string, port: number) { ... }
}

// 사용
const lookup = await beaconClient.lookup(toolUseId);
// lookup 결과: { conversationId, mcpHost, mcpPort }
const pylonClient = new PylonClient(lookup.mcpHost, lookup.mcpPort);
await pylonClient.link(lookup.conversationId, path);
```

### 7. Pylon TCP 서버 (기존 유지)

Pylon의 `PylonMcpServer`는 그대로 유지. MCP 도구 요청을 받아 처리:
- `link`: 문서 연결
- `unlink`: 문서 해제
- `list`: 문서 목록
- `send_file`: 파일 전송

### 8. 환경변수 정리

**삭제**:
- `ESTELLE_MCP_PORT`: 더 이상 필요 없음 (lookup으로 동적 획득)

**신규**:
- `ESTELLE_BEACON_PORT`: MCP 서버 → Beacon lookup용 (기본값 9875)

**유지**:
- `ESTELLE_WORKING_DIR`: MCP 도구에서 사용 (deploy 등)

## 구현 단계

### Phase 1: Pylon 등록 및 매핑 구조 변경
1. `pylon-registry.ts` 신규 생성: `pylonId → PylonConnection` 매핑
2. `beacon-adapter.ts`: 등록 시 `pylonId`, `mcpHost`, `mcpPort` 전달
3. `beacon.ts`: `PylonRegistry` 사용, 등록 정보 저장
4. `tool-context-map.ts`: `ToolContext` 타입 변경 (conversationId + raw만)

### Phase 2: MCP 서버 Beacon으로 이동
1. `packages/claude-beacon/src/mcp/` 디렉토리 생성
2. 파일 이동:
   - `server.ts`, `beacon-client.ts`, `pylon-client.ts`
   - `tools/*.ts`
3. `pylon-client.ts`: 싱글턴 제거, 동적 host:port 지원
4. `beacon-client.ts`: lookup 응답에 mcpHost, mcpPort 포함
5. Beacon `bin.ts`에서 SDK에 MCP 설정 제공

### Phase 3: Pylon 정리
1. Pylon에서 MCP 서버 관련 코드 제거 (pylon-mcp-server.ts 제외)
2. `ESTELLE_MCP_PORT` 환경변수 제거
3. Pylon `bin.ts`에서 MCP 설정 제거

### Phase 4: 테스트
1. 테스트 이동 및 업데이트
2. 통합 테스트 (dev/stage/release 각각 MCP 호출 확인)

## 포트 정리

| 포트 | 용도 |
|------|------|
| 9875 | Beacon TCP (Pylon 연결 + MCP lookup) |
| 9876 | release Pylon MCP TCP |
| 9877 | stage Pylon MCP TCP |
| 9878 | dev Pylon MCP TCP |

## pylonId 매핑

| 환경 | envId | deviceIndex | pylonId | mcpPort |
|------|-------|-------------|---------|---------|
| release | 0 | 1 | 1 | 9876 |
| stage | 1 | 1 | 33 | 9877 |
| dev | 2 | 1 | 65 | 9878 |

## 마이그레이션 체크리스트

- [ ] Phase 1: Pylon 등록 및 매핑 구조 변경
  - [ ] `pylon-registry.ts` 신규 생성
  - [ ] `beacon-adapter.ts`: pylonId, mcpHost, mcpPort 전달
  - [ ] `beacon.ts`: PylonRegistry 사용
  - [ ] `tool-context-map.ts`: ToolContext 타입 변경
  - [ ] 테스트 업데이트
- [ ] Phase 2: MCP 서버 Beacon으로 이동
  - [ ] `packages/claude-beacon/src/mcp/` 생성
  - [ ] 파일 이동 (server.ts, beacon-client.ts, pylon-client.ts, tools/*)
  - [ ] `pylon-client.ts`: 싱글턴 제거, 동적 host:port
  - [ ] `beacon-client.ts`: lookup 응답 변경 (conversationId, mcpHost, mcpPort)
  - [ ] Beacon `bin.ts`: SDK에 MCP 설정 제공
- [ ] Phase 3: Pylon 정리
  - [ ] Pylon MCP 코드 제거 (pylon-mcp-server.ts 제외)
  - [ ] `ESTELLE_MCP_PORT` 환경변수 제거
  - [ ] Pylon `bin.ts` MCP 설정 제거
- [ ] Phase 4: 테스트
  - [ ] 테스트 이동 및 업데이트
  - [ ] 통합 테스트 (dev/stage/release)
  - [ ] 문서 업데이트

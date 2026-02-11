# ClaudeBeacon 아키텍처

> 단일 ClaudeBeacon이 Claude SDK를 실행하고, 다중 Pylon(dev/stage/release)에 서비스

---

## 개요

### 도입 배경

**기존 문제**:
- 각 Pylon이 Claude SDK를 직접 호출 → 인증 충돌
- 환경별(dev/stage/release) Pylon이 각자 SDK 세션 관리 → 복잡

**해결책**:
- ClaudeBeacon이 SDK를 중앙 관리
- Pylon은 ClaudeBeaconAdapter를 통해 Beacon에 요청
- MCP 도구는 Beacon에서 toolUseId 조회

### 아키텍처

```
                    ┌─────────────────────────────┐
                    │      ClaudeBeacon           │
                    │  - Claude SDK 단일 실행      │
                    │  - 단일 Credentials          │
                    │  - ToolContextMap           │
                    │  - TCP Server (:9875)       │
                    └─────────────────────────────┘
                           │
            ┌──────────────┼──────────────┐
            ▼              ▼              ▼
    ┌────────────┐  ┌────────────┐  ┌────────────┐
    │ Dev Pylon  │  │Stage Pylon │  │Release Pylon│
    └────────────┘  └────────────┘  └────────────┘
```

---

## 패키지 구조

```
packages/claude-beacon/
├── src/
│   ├── index.ts              # 패키지 진입점
│   ├── tool-context-map.ts   # toolUseId → PylonInfo 매핑
│   ├── beacon-server.ts      # TCP 서버 (MCP lookup)
│   ├── beacon-adapter.ts     # Pylon용 어댑터 (ClaudeAdapter 구현)
│   ├── beacon.ts             # ClaudeBeacon 메인 클래스
│   ├── mock-sdk.ts           # 테스트용 SDK 목업
│   └── bin.ts                # PM2 진입점
├── tests/
│   ├── tool-context-map.test.ts
│   ├── beacon-server.test.ts
│   ├── beacon-adapter.test.ts
│   ├── beacon.test.ts
│   └── mock-sdk.test.ts
└── package.json
```

---

## 핵심 컴포넌트

### 1. ToolContextMap

toolUseId → PylonInfo 매핑 관리

```typescript
interface PylonInfo {
  pylonAddress: string;   // "127.0.0.1:9878"
  entityId: number;       // 2049
  raw: ToolUseRaw;        // { type: 'tool_use', id, name, input }
}

class ToolContextMap {
  set(toolUseId: string, info: PylonInfo): void;
  get(toolUseId: string): PylonInfo | undefined;
  delete(toolUseId: string): boolean;
  cleanup(maxAge?: number): number;  // 기본 30분
}
```

**용도**: MCP 도구에서 toolUseId로 해당 도구 호출이 어느 Pylon의 어느 대화에서 발생했는지 조회

### 2. BeaconServer

TCP 서버로 MCP lookup 요청 처리 (포트 9875)

**요청/응답**:
```json
// 요청
{ "action": "lookup", "toolUseId": "toolu_01ABC123" }

// 응답 (성공)
{
  "success": true,
  "pylonAddress": "127.0.0.1:9878",
  "entityId": 2049,
  "raw": { "type": "tool_use", "id": "toolu_01ABC123", "name": "Read", "input": {} }
}

// 응답 (실패)
{ "success": false, "error": "Tool use ID not found" }
```

### 3. ClaudeBeaconAdapter

Pylon이 Beacon을 통해 SDK를 호출하기 위한 어댑터 (ClaudeAdapter 인터페이스 구현)

```typescript
class ClaudeBeaconAdapter implements ClaudeAdapter {
  constructor(options: {
    host?: string;        // 기본 127.0.0.1
    port?: number;        // 기본 9875
    pylonAddress: string; // Pylon 자신의 주소
    env: string;          // dev | stage | release
  });

  connect(): Promise<void>;
  disconnect(): Promise<void>;

  // ClaudeAdapter 인터페이스
  query(entityId: number, options: QueryOptions): AsyncIterable<Message>;
}
```

**통신 프로토콜**:
```json
// 연결 시 등록
{ "action": "register", "pylonAddress": "127.0.0.1:9878", "env": "dev" }

// 쿼리 요청
{ "action": "query", "entityId": 2049, "options": { "prompt": "...", "cwd": "..." } }

// 이벤트 스트림 (Beacon → Pylon)
{ "type": "event", "entityId": 2049, "message": { ... } }
```

### 4. ClaudeBeacon

단일 SDK 인스턴스로 여러 Pylon을 서비스하는 메인 클래스

```typescript
class ClaudeBeacon {
  constructor(options: {
    adapter: ClaudeAdapter;       // 실제 SDK 어댑터
    port?: number;                // TCP 포트 (기본 9875)
    toolContextMap?: ToolContextMap;
  });

  start(): Promise<void>;
  stop(): Promise<void>;

  registerPylon(address: string, env: string): void;
  unregisterPylon(address: string): void;

  handleQuery(entityId: number, options: QueryOptions): AsyncIterable<Message>;
}
```

---

## 포트 할당

| 포트 | 용도 | 환경 |
|------|------|------|
| 9875 | ClaudeBeacon TCP | 공용 |
| 9876 | MCP TCP 서버 | release |
| 9877 | MCP TCP 서버 | stage |
| 9878 | MCP TCP 서버 | dev |
| 9879 | MCP TCP 서버 | test (수동 테스트용) |

---

## Pylon 변경사항

### 삭제된 파일

| 파일 | 이유 |
|------|------|
| `pylon/src/claude/tool-context-map.ts` | ClaudeBeacon으로 이전 |
| `pylon/tests/claude/tool-context-map.test.ts` | ClaudeBeacon으로 이전 |
| `pylon/src/mcp/tcp-server.ts` | ClaudeBeacon으로 이전 |
| `pylon/tests/mcp/tcp-server.test.ts` | ClaudeBeacon으로 이전 |

### 수정된 파일

**claude-manager.ts**:
- import 삭제: `ToolContextMap`
- 필드 삭제: `toolContextMap`
- 메서드 삭제: `getToolContextMap()`, `cleanupToolContextMap()`
- 사용부 삭제: `toolContextMap.set()` 호출

**bin.ts**:
- import 삭제: `ToolContextMap`, `McpTcpServer`
- 환경변수 삭제: `mcpPort`, `ESTELLE_MCP_PORT`
- 코드 삭제: `McpTcpServer` 인스턴스 생성/시작/종료

---

## PM2 설정

### ClaudeBeacon

```javascript
// ecosystem.config.cjs
module.exports = {
  apps: [{
    name: 'claude-beacon',
    script: 'packages/claude-beacon/dist/bin.js',
    env: {
      BEACON_PORT: 9875,
      NODE_ENV: 'production'
    }
  }]
};
```

### Pylon (Beacon 모드)

```javascript
env: {
  BEACON_ENABLED: 'true',
  BEACON_HOST: '127.0.0.1',
  BEACON_PORT: '9875',
  BEACON_ENV: 'release'  // dev | stage | release
}
```

---

## 테스트 현황

| 파일 | 테스트 수 | 상태 |
|------|----------|------|
| tool-context-map.test.ts | 14 | ✅ |
| beacon-server.test.ts | 16 | ✅ |
| mock-sdk.test.ts | 21 | ✅ |
| beacon-adapter.test.ts | 24 | ✅ (1 skipped) |
| beacon.test.ts | 26 | ✅ |
| **Total** | **101** | ✅ |

---

## 작업 로그

- [260210 12:35] ClaudeBeacon 패키지 구현 완료 (TDD, 51개 테스트)
- [260210 15:30] ClaudeBeaconAdapter TDD 완료 (101개 테스트)
- [260210 16:15] ClaudeBeacon PM2 등록 (bin.ts, ecosystem.config.cjs)
- [260210 17:00] Pylon-Beacon 연동 완료 (통합 테스트 성공)
- [260211 17:25] Pylon ToolContextMap/McpTcpServer 삭제 (633개 테스트 통과)

---

*작성일: 2026-02-11*

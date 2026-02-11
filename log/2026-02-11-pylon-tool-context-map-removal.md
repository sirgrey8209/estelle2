# Pylon ToolContextMap 삭제 계획

## 배경

ClaudeBeacon 도입으로 SDK 관리가 Beacon으로 이전됨에 따라, Pylon의 `ToolContextMap`과 `McpTcpServer`가 더 이상 필요하지 않다.

### 기존 구조 (삭제 대상)

```
Pylon
├── ClaudeManager
│   └── ToolContextMap (toolUseId → entityId)
└── McpTcpServer (:9876/9877/9878)
    └── MCP 도구가 여기로 조회
```

### 새로운 구조 (ClaudeBeacon)

```
ClaudeBeacon (단일)
├── Claude SDK 실행
├── ToolContextMap (toolUseId → { pylonAddress, entityId, raw })
└── BeaconServer (:9875)
    └── MCP 도구가 여기로 조회

Pylon (다중: dev/stage/release)
└── ClaudeBeaconAdapter (Beacon과 통신)
```

## 삭제 대상 파일

| 파일 | 상태 |
|------|------|
| `packages/pylon/src/claude/tool-context-map.ts` | 삭제 |
| `packages/pylon/tests/claude/tool-context-map.test.ts` | 삭제 |
| `packages/pylon/src/mcp/tcp-server.ts` | 삭제 |
| `packages/pylon/tests/mcp/tcp-server.test.ts` | 삭제 |

## 수정 대상 파일

### 1. `packages/pylon/src/claude/claude-manager.ts`

**삭제할 부분:**
- import 문: `import { ToolContextMap } from './tool-context-map.js';`
- 필드: `private readonly toolContextMap: ToolContextMap`
- 메서드: `cleanupToolContextMap()`, `getToolContextMap()`
- 사용부: `this.toolContextMap.set(block.id, sessionId as EntityId)` (1144행)

### 2. `packages/pylon/src/bin.ts`

**삭제할 부분:**
- import 문:
  - `import { ToolContextMap } from './claude/tool-context-map.js';`
  - `import { McpTcpServer } from './mcp/tcp-server.js';`
- `PylonDependenciesImpl` 타입에서 `claudeManager: ClaudeManager` 주석 수정
- `McpTcpServer` 인스턴스 생성 및 사용 (473-478행)
- `mcpTcpServer.stop()` 호출 (483, 493행)
- `mcpPort` 관련 코드 (환경변수, 설정)

## 작업 순서

1. **Phase 1: 삭제**
   - [ ] `tool-context-map.ts` 삭제
   - [ ] `tool-context-map.test.ts` 삭제
   - [ ] `tcp-server.ts` 삭제
   - [ ] `tcp-server.test.ts` 삭제

2. **Phase 2: ClaudeManager 수정**
   - [ ] import 문 삭제
   - [ ] toolContextMap 필드 삭제
   - [ ] cleanupToolContextMap(), getToolContextMap() 삭제
   - [ ] toolContextMap.set() 호출 삭제

3. **Phase 3: bin.ts 수정**
   - [ ] import 문 삭제
   - [ ] McpTcpServer 관련 코드 삭제
   - [ ] mcpPort 관련 코드 삭제 (환경변수, 설정)

4. **Phase 4: 검증**
   - [ ] `pnpm --filter @estelle/pylon build` 성공
   - [ ] `pnpm --filter @estelle/pylon test` 성공
   - [ ] `pnpm typecheck` 성공

## 주의사항

- ClaudeBeacon의 `ToolContextMap`은 유지 (다른 구현)
- MCP 도구는 앞으로 ClaudeBeacon의 BeaconServer(:9875)를 통해 조회
- 현재 MCP 도구(estelle-mcp)가 Pylon TCP Server를 사용한다면 별도 마이그레이션 필요

## 관련 문서

- `wip/claude-beacon-plan.md` - ClaudeBeacon 구현 계획
- `wip/claude-beacon-tdd.md` - ClaudeBeacon TDD 진행 상황

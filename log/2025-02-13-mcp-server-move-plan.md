# MCP 서버 Beacon 이동 계획

## 구현 목표
MCP 서버 코드를 Pylon에서 Beacon으로 이동하고, 동적 Pylon 라우팅 구현

## 구현 방향
1. **파일 이동**: `packages/pylon/src/mcp/` → `packages/claude-beacon/src/mcp/`
2. **PylonClient 변경**: 싱글턴 제거, 동적 host:port 지원
3. **BeaconClient 변경**: lookup 응답에 mcpHost, mcpPort 포함
4. **MCP 설정**: Beacon `bin.ts`에서 SDK에 제공

## 파일 이동 목록
```
packages/pylon/src/mcp/
├── server.ts          → packages/claude-beacon/src/mcp/server.ts
├── beacon-client.ts   → packages/claude-beacon/src/mcp/beacon-client.ts
├── pylon-client.ts    → packages/claude-beacon/src/mcp/pylon-client.ts
└── tools/
    ├── link-document.ts → packages/claude-beacon/src/mcp/tools/link-document.ts
    ├── send-file.ts     → packages/claude-beacon/src/mcp/tools/send-file.ts
    └── deploy.ts        → packages/claude-beacon/src/mcp/tools/deploy.ts
```

## PylonClient 변경
```typescript
// 변경 전: 싱글턴 + 환경변수
const DEFAULT_PORT = parseInt(process.env['ESTELLE_MCP_PORT'] || '9880', 10);
static getInstance(): PylonClient { ... }

// 변경 후: 매번 새 인스턴스 + 동적 host:port
constructor(host: string, port: number) { ... }
```

## MCP 설정 (Beacon bin.ts)
```typescript
const estelleMcp = {
  command: 'node',
  args: [mcpServerPath],  // claude-beacon/dist/mcp/server.js
  env: {
    ESTELLE_BEACON_PORT: '9875',
    ESTELLE_WORKING_DIR: workingDir,
  }
};
```

## 영향 범위
- 이동: `packages/pylon/src/mcp/*` → `packages/claude-beacon/src/mcp/*`
- 수정 필요: `packages/claude-beacon/src/mcp/pylon-client.ts`
- 수정 필요: `packages/claude-beacon/src/mcp/beacon-client.ts`
- 수정 필요: `packages/claude-beacon/src/mcp/tools/*.ts`
- 수정 필요: `packages/claude-beacon/src/bin.ts`
- 이동: `packages/pylon/tests/mcp/*` → `packages/claude-beacon/tests/mcp/*`

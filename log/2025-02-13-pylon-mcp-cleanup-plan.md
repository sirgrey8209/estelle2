# Pylon MCP 정리 계획

## 구현 목표
Pylon에서 불필요해진 MCP 관련 코드 제거 (pylon-mcp-server.ts 제외)

## 구현 방향
1. **MCP 코드 삭제**: server.ts, beacon-client.ts, pylon-client.ts, tools/* 삭제
2. **환경변수 제거**: `ESTELLE_MCP_PORT` 관련 코드 삭제
3. **bin.ts 정리**: MCP 설정 구성 코드 제거

## 삭제 대상
```
packages/pylon/src/mcp/
├── server.ts          # 삭제 (Beacon으로 이동됨)
├── beacon-client.ts   # 삭제 (Beacon으로 이동됨)
├── pylon-client.ts    # 삭제 (Beacon으로 이동됨)
└── tools/
    ├── link-document.ts # 삭제 (Beacon으로 이동됨)
    ├── send-file.ts     # 삭제 (Beacon으로 이동됨)
    └── deploy.ts        # 삭제 (Beacon으로 이동됨)

packages/pylon/tests/mcp/
├── beacon-client.test.ts   # 삭제 (Beacon으로 이동됨)
├── pylon-client.test.ts    # 삭제 (Beacon으로 이동됨)
└── tools/
    └── link-document.test.ts # 삭제 (Beacon으로 이동됨)
```

## 유지 대상
```
packages/pylon/src/mcp/
└── pylon-mcp-server.ts   # 유지 (실제 로직 처리)

packages/pylon/tests/mcp/
└── pylon-mcp-server.test.ts  # 유지
```

## bin.ts 정리
```typescript
// 삭제할 코드
const mcpPort = envConfig?.pylon?.mcpPort || ...;
const estelleMcp = { command: 'node', args: [...], env: { ESTELLE_MCP_PORT: ... } };
// MCP 설정 병합 로직
```

## 영향 범위
- 삭제: `packages/pylon/src/mcp/*` (pylon-mcp-server.ts 제외)
- 삭제: `packages/pylon/tests/mcp/*` (pylon-mcp-server.test.ts 제외)
- 수정 필요: `packages/pylon/src/bin.ts`

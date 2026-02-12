# MCP Beacon 마이그레이션 - 총괄 플랜

> MCP 서버를 Beacon으로 이동하고, Pylon 주소 기반 동적 라우팅 구현

## 상세 플랜
- 전체 설계: [mcp-beacon-migration.md](mcp-beacon-migration.md)

## 진행 순서

| # | 대상 | plan | 상태 | 의존성 |
|---|------|------|------|--------|
| 1 | **PylonRegistry** | [plan](pylon-registry-plan.md) | ✅ | - |
| 2 | **ToolContextMap 리팩토링** | [plan](tool-context-map-refactor-plan.md) | ✅ | - |
| 3 | **Beacon 등록 확장** | [plan](beacon-register-extend-plan.md) | ✅ | 1, 2 |
| 4 | **MCP 서버 이동** | [plan](mcp-server-move-plan.md) | ✅ | 3 |
| 5 | **Pylon MCP 정리** | [plan](pylon-mcp-cleanup-plan.md) | ✅ | 4 |

## 진행 로그

- [250212 18:30] 총괄 플랜 작성
- [250212 18:30] 5개 plan 문서 생성
- [250213 00:35] PylonRegistry 구현 완료 (TDD 생략)
- [250213 00:48] ToolContextMap 리팩토링 완료 (PylonInfo → ToolContext, pylonAddress 제거)
- [250213 01:13] Beacon 등록 확장 완료 (pylonId, mcpHost, mcpPort 전달, PylonRegistry 통합)
- [250213 01:30] MCP 서버 이동 완료 (beacon-client, pylon-client, tools/, server.ts → claude-beacon)
- [250213 01:52] Pylon MCP 정리 완료 (src/mcp/, tests/mcp/ 삭제, bin.ts 수정)

## 핵심 변경 사항

### 두 개의 매핑
1. **ToolContextMap**: `toolUseId → { conversationId, raw }`
2. **PylonRegistry**: `pylonId → { mcpHost, mcpPort, env }`

### lookup 흐름
```
toolUseId → conversationId → pylonId (비트 추출) → mcpHost:mcpPort
```

### 환경변수
- 삭제: `ESTELLE_MCP_PORT`
- 신규: `ESTELLE_BEACON_PORT`

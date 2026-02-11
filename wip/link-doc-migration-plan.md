# link_doc 마이그레이션 구현 계획

## 구현 목표
link_doc, unlink_doc, list_docs MCP 도구를 BeaconClient + Pylon TCP 서버 기반으로 재구현

## 구현 방향

### 아키텍처
```
MCP 도구 (link_doc)
  → BeaconClient.lookup(toolUseId) → entityId 획득
  → PylonClient.request({ action: 'link', entityId, path }) → Pylon TCP 서버
  → PylonMcpServer가 WorkspaceStore.linkDocument() 호출
  → 결과 반환
```

### 신규 파일

1. **PylonMcpServer** (`pylon/src/servers/mcp-server.ts`)
   - Pylon 내부 TCP 서버
   - link/unlink/list 요청 처리
   - WorkspaceStore 접근

2. **PylonClient** (`pylon/src/mcp/pylon-client.ts`)
   - MCP → Pylon TCP 클라이언트
   - BeaconClient와 유사한 구조

3. **link-document.ts** (`pylon/src/mcp/tools/link-document.ts`)
   - MCP 도구 실행 함수 재구현
   - BeaconClient + PylonClient 사용

### 프로토콜

**요청:**
```json
{ "action": "link", "entityId": 2049, "path": "docs/spec.md" }
{ "action": "unlink", "entityId": 2049, "path": "docs/spec.md" }
{ "action": "list", "entityId": 2049 }
```

**응답:**
```json
{ "success": true, "docs": [{ "path": "docs/spec.md", "addedAt": 1234567890 }] }
{ "success": false, "error": "Document not found" }
```

### 포트
- 9880: PylonMcpServer (Pylon 내부)

## 영향 범위
- 신규: pylon/src/servers/mcp-server.ts
- 신규: pylon/src/mcp/pylon-client.ts
- 재구현: pylon/src/mcp/tools/link-document.ts
- 수정: pylon/src/mcp/server.ts (도구 등록)
- 수정: pylon/src/pylon.ts (MCP 서버 시작)

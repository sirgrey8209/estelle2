# send-file MCP 구현 계획

## 구현 목표
`send_file` MCP 도구를 V2 TypeScript로 마이그레이션하여 Claude가 파일을 사용자에게 전송할 수 있게 한다.

## 구현 방향
1. **`send-file.ts`**: 도구 로직 (파일 확인, MIME 판별, 결과 반환) - TDD 대상
2. **`server.ts`**: MCP 서버 진입점 (stdio transport) - 인프라
3. **`bin.ts` 수정**: `loadMcpConfig`에서 `estelle-mcp` 서버를 자동 주입

### V1 참고
- V1 도구: `C:\WorkSpace\estelle\estelle-pylon\src\mcp\tools\send_file.js`
- V1 서버: `C:\WorkSpace\estelle\estelle-pylon\src\mcp\index.js`
- MCP 서버 이름: `estelle-mcp`
- 도구 이름: `send_file` (Pylon에서 `mcp__estelle-mcp__send_file`로 감지)

### 핵심 동작
1. Claude가 `send_file(path, description)` 호출
2. MCP 서버가 파일 읽기 및 MIME 타입 판별
3. Claude SDK가 toolComplete 이벤트 발생
4. Pylon `handleSendFileResult`가 감지 → 클라이언트에 fileAttachment 이벤트 전송
5. 클라이언트 FileAttachmentCard 표시 → 클릭 시 FileViewer

### 이미 구현된 부분 (V2)
- `handleSendFileResult` (pylon.ts:1966)
- `loadMcpConfig` (bin.ts:182)
- `FileAttachmentCard` + `FileViewer` (client)
- `addFileAttachment` (MessageStore)

## 영향 범위
- 신규: `packages/pylon/src/mcp/tools/send-file.ts`, `packages/pylon/src/mcp/server.ts`
- 수정: `packages/pylon/src/bin.ts` (loadMcpConfig에 estelle-mcp 자동 주입)
- 테스트: `packages/pylon/tests/mcp/tools/send-file.test.ts`

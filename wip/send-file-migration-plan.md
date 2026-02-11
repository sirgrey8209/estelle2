# send-file-migration 구현 계획

## 구현 목표
send_file MCP 도구를 toolComplete 훅 기반에서 PylonClient 기반으로 마이그레이션하여 일관된 MCP 도구 패턴 적용

## 구현 방향

### 1. PylonMcpServer에 send_file 액션 추가
- 요청: `{ action: "send_file", entityId, path, description? }`
- 응답: `{ success: true, file: FileInfo }` 또는 `{ success: false, error }`
- 파일 존재 확인, MIME 타입 판별
- 클라이언트에 `file_attachment` 이벤트 브로드캐스트
- messageStore에 파일 첨부 저장

### 2. PylonClient에 sendFile 메서드 추가
- `sendFile(entityId, path, description?)` → 결과 반환

### 3. send-file.ts MCP 도구 수정
- BeaconClient로 entityId 조회 → Pylon 연결 안됨 = 실패 (isError: true)
- PylonClient.sendFile() 호출
- toolComplete 훅 의존 제거

### 4. Pylon에서 toolComplete 훅 제거
- `handleSendFileResult` 메서드 제거
- `sendClaudeEvent`에서 send_file 감지 코드 제거

## 영향 범위
- 수정 필요:
  - `packages/pylon/src/servers/pylon-mcp-server.ts`
  - `packages/pylon/src/mcp/pylon-client.ts`
  - `packages/pylon/src/mcp/tools/send-file.ts`
  - `packages/pylon/src/pylon.ts` (훅 제거)
- 수정 필요 (테스트):
  - `packages/pylon/tests/servers/pylon-mcp-server.test.ts`
  - `packages/pylon/tests/mcp/pylon-client.test.ts`
  - `packages/pylon/tests/mcp/tools/send-file.test.ts`

# link_doc MCP 버그 수정

## 상태
🟢 완료

## 문제 목록

### 1. 잘못된 문서 경로가 링크됨 ✅
**현상**: 존재하지 않는 파일 경로도 링크됨
**원인**: `PylonMcpServer._handleLink()`에서 파일 존재 여부 검증 없음
**해결**: `_checkFileExists()` 호출 추가

### 2. 문서 링크 해제가 클라이언트에 업데이트 안 됨 ✅
**현상**: unlink 성공해도 클라이언트 UI에서 문서 칩이 안 사라짐
**원인**: PylonMcpServer → Pylon으로 변경 알림 없음
**해결**:
- `PylonMcpServerOptions`에 `onChange` 콜백 추가
- link/unlink 성공 시 `this._onChange?.()` 호출
- `bin.ts`에서 `onChange: () => pylon.broadcastWorkspaceList()` 연결
- `Pylon.broadcastWorkspaceList()`를 public으로 변경

### 3. 문서 클릭 시 내용이 안 보임 ✅
**현상**: 연결된 문서 칩 클릭 → FileViewer 열리지만 내용 없음
**원인**: 클라이언트에서 filePath 조합 시 절대경로 미고려
**해결**: 절대경로 여부 확인 후 처리
```typescript
const isAbsolute = /^[A-Za-z]:[\\/]/.test(docPath) || docPath.startsWith('/');
const filePath = isAbsolute ? docPath : `${selectedConversation.workingDir}\\${docPath}`;
```

## 수정된 파일

1. `packages/pylon/src/servers/pylon-mcp-server.ts`
   - `PylonMcpServerOptions.onChange` 콜백 추가
   - `_handleLink`: 파일 존재 확인 + onChange 호출
   - `_handleUnlink`: onChange 호출 추가
   - `_checkFileExists`: 테스트용 `docs/` 패턴 추가

2. `packages/pylon/src/pylon.ts`
   - `broadcastWorkspaceList()`: private → public

3. `packages/pylon/src/bin.ts`
   - PylonMcpServer 생성 시 `onChange` 콜백 전달

4. `packages/client/src/components/chat/ChatHeader.tsx`
   - `handleDocumentClick`: 절대경로 처리 로직 수정

## 테스트 결과
- pylon 테스트: 748개 전체 통과
- pylon-mcp-server 테스트: 36개 전체 통과
- client 빌드: 성공

## 로그
- [260212 10:30] 문서 작성
- [260212 10:45] 수정 완료, 테스트 통과

# Command Toolbar Improvements Design

커맨드 툴바의 버그 수정, MCP 도구 보완, 대화 기반 커맨드 관리 UI로 전환.

## 1. 버그 수정: getCommands DISTINCT

`command-store.ts`의 `getCommands` SQL에 `SELECT DISTINCT` 추가. 글로벌 + 워크스페이스 동시 할당 시 중복 반환 방지.

## 2. 글로벌 마커: NULL → 0

`command_assignments.workspace_id`에서 NULL 대신 0을 글로벌 마커로 사용.

- UNIQUE 제약이 자연스럽게 동작 (COALESCE 인덱스 불필요)
- `IS NULL` / `IS ?` 대신 `= 0`, `= ?` 사용
- MCP 인터페이스에서는 여전히 `null`을 글로벌로 받되, 내부적으로 0으로 변환

## 3. assign/unassign MCP 도구 개선

현재 `assign_command`는 추가만 가능하고 제거 불가.

- `assign_command(commandId, workspaceIds: number[])` — 리스트로 받아서 추가 (기존 할당 유지)
- `unassign_command(commandId, workspaceIds: number[])` — 리스트로 받아서 제거 (MCP 도구 새로 추가)

## 4. get_command MCP 도구 추가

단일 커맨드를 ID로 상세 조회:

```
get_command(commandId) → { id, name, icon, color, content, workspaceIds }
```

`getCommandById` + `getAssignedWorkspaceIds` 조합.

## 5. MCP create_conversation 확장

MCP `create_conversation` 도구에 파라미터 추가:

- `initialMessage` — 대화 생성 후 Claude에 보낼 초기 메시지 (기존 초기 컨텍스트 뒤에 추가)
- `autoSelect` — true면 해당 대화로 자동 전환

클라이언트 WebSocket `CONVERSATION_CREATE` 메시지는 변경 없음.

## 6. COMMAND_MANAGE_CONVERSATION 메시지 타입

클라이언트 → Pylon 전용 메시지:

```typescript
{
  type: 'command_manage_conversation',
  payload: {
    workspaceId: number,
    commandId?: number   // 있으면 편집 모드, 없으면 생성 모드
  }
}
```

Pylon 처리:
1. 새 대화 생성 (기존 로직 재사용)
2. 초기 컨텍스트 전송 (`sendInitialContext`)
3. 하드코딩된 프롬프트를 `handleClaudeSend`로 전송:
   - 생성 모드: "이 워크스페이스(id: {id}, name: {name})에서 새 커맨드를 만들려고 해요..."
   - 편집 모드: "커맨드(id: {commandId})를 수정하거나 삭제하려고 해요..."
4. 해당 대화로 자동 전환

## 7. CommandToolbar UI 변경

- 인라인 폼(CommandForm) 제거
- 컨텍스트 메뉴(ContextMenu, 우클릭) 제거
- `+` 버튼 클릭 → `COMMAND_MANAGE_CONVERSATION { workspaceId }` 전송
- 커맨드 버튼 롱프레스 → `COMMAND_MANAGE_CONVERSATION { workspaceId, commandId }` 전송

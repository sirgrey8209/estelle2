# Command Toolbar Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 커맨드 툴바의 DISTINCT 버그 수정, 글로벌 마커 NULL→0 전환, MCP 도구 보완, 대화 기반 커맨드 관리 UI 전환.

**Architecture:** CommandStore의 글로벌 마커를 NULL에서 0으로 변경하여 SQL 단순화. MCP에 get_command/unassign_command 추가, create_conversation에 initialMessage/autoSelect 지원. CommandToolbar는 인라인 편집을 제거하고 대화 기반 관리로 전환.

**Tech Stack:** better-sqlite3, Zustand, React, lucide-react, vitest

---

### Task 1: CommandStore — DISTINCT 추가 + NULL→0 전환

**Files:**
- Modify: `packages/pylon/src/stores/command-store.ts`
- Modify: `packages/pylon/tests/stores/command-store.test.ts`

**변경 내용:**

1. `_initSchema()`에서 COALESCE 유니크 인덱스 제거, `workspace_id`를 `NOT NULL DEFAULT 0`으로 변경:
```sql
CREATE TABLE IF NOT EXISTS command_assignments (
  command_id INTEGER NOT NULL REFERENCES commands(id) ON DELETE CASCADE,
  workspace_id INTEGER NOT NULL DEFAULT 0,
  UNIQUE(command_id, workspace_id)
);
```
주의: 기존 DB와의 호환성을 위해 `IF NOT EXISTS`이므로 이미 테이블이 있으면 변경되지 않음. 마이그레이션이 필요할 수 있지만, 아직 릴리즈 초기이므로 DB를 재생성해도 됨.

2. `_prepareStatements()`에서:
- `stmtGetCommands`: `SELECT DISTINCT ... WHERE ca.workspace_id = 0 OR ca.workspace_id = ?`
- `stmtAssign`: 그대로 (`INSERT OR IGNORE`)
- `stmtUnassign`: `WHERE command_id = ? AND workspace_id = ?` (IS ? → = ?)

3. `assignCommand(commandId, workspaceId)`: `workspaceId ?? 0` 변환
4. `unassignCommand(commandId, workspaceId)`: `workspaceId ?? 0` 변환
5. `getAssignedWorkspaceIds()`: 반환 시 0을 null로 변환

**테스트 수정:** 기존 테스트에서 null 대신 0으로 변경되는 부분 반영. 글로벌+워크스페이스 동시 할당 시 중복 안 되는 테스트 추가.

**커밋:**
```bash
git add packages/pylon/src/stores/command-store.ts packages/pylon/tests/stores/command-store.test.ts
git commit -m "fix(pylon): use DISTINCT and change global marker from NULL to 0 in CommandStore"
```

---

### Task 2: MCP — get_command 도구 추가

**Files:**
- Modify: `packages/pylon/src/mcp/tools/command.ts`
- Modify: `packages/pylon/src/mcp/server.ts`

**변경 내용:**

1. `command.ts`에 `executeGetCommand` 함수 추가:
```typescript
export async function executeGetCommand(
  args: { commandId?: number },
): Promise<ToolResult> {
  if (args.commandId === undefined || args.commandId === null) {
    return createErrorResponse('커맨드 ID를 입력해주세요 (commandId 필수)');
  }
  try {
    const store = getCommandStore();
    const command = store.getCommandById(args.commandId);
    if (!command) {
      return createErrorResponse(`커맨드를 찾을 수 없어요 (id: ${args.commandId})`);
    }
    const workspaceIds = store.getAssignedWorkspaceIds(args.commandId);
    return createSuccessResponse({
      success: true,
      command: { ...command, workspaceIds },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return createErrorResponse(`커맨드 조회 실패: ${message}`);
  }
}
```

2. `getGetCommandToolDefinition()` 함수 추가

3. `server.ts`에 도구 등록 + 실행 케이스 추가

**커밋:**
```bash
git add packages/pylon/src/mcp/tools/command.ts packages/pylon/src/mcp/server.ts
git commit -m "feat(pylon): add get_command MCP tool"
```

---

### Task 3: MCP — assign_command 수정 + unassign_command 추가

**Files:**
- Modify: `packages/pylon/src/mcp/tools/command.ts`
- Modify: `packages/pylon/src/mcp/server.ts`

**변경 내용:**

1. `executeAssignCommand` 수정 — 기존 할당은 유지하고 새 할당만 추가 (현재 동작과 동일하지만 코드 정리):
```typescript
export async function executeAssignCommand(
  args: { commandId?: number; workspaceIds?: (number | null)[] },
): Promise<ToolResult> {
  // ... 검증 ...
  for (const wsId of args.workspaceIds) {
    store.assignCommand(args.commandId, wsId);
  }
  await notifyCommandChangedSafe(); // delta 없음 → broadcastWorkspaceList 트리거
  // ...
}
```

2. `executeUnassignCommand` 함수 추가:
```typescript
export async function executeUnassignCommand(
  args: { commandId?: number; workspaceIds?: (number | null)[] },
): Promise<ToolResult> {
  // ... 검증 ...
  for (const wsId of args.workspaceIds) {
    store.unassignCommand(args.commandId, wsId);
  }
  await notifyCommandChangedSafe(); // delta 없음 → broadcastWorkspaceList 트리거
  // ...
}
```

3. `getUnassignCommandToolDefinition()` 함수 추가

4. `server.ts`에 도구 등록 + 실행 케이스 추가

**커밋:**
```bash
git add packages/pylon/src/mcp/tools/command.ts packages/pylon/src/mcp/server.ts
git commit -m "feat(pylon): improve assign_command and add unassign_command MCP tool"
```

---

### Task 4: MCP — create_conversation에 initialMessage, autoSelect 추가

**Files:**
- Modify: `packages/pylon/src/mcp/tools/conversation.ts`
- Modify: `packages/pylon/src/mcp/pylon-client.ts`
- Modify: `packages/pylon/src/servers/pylon-mcp-server.ts`
- Modify: `packages/pylon/src/pylon.ts`

**변경 내용:**

1. `conversation.ts`의 `executeCreateConversation`에 `initialMessage`, `autoSelect` 파라미터 추가:
```typescript
export async function executeCreateConversation(
  args: { name?: string; files?: string[]; agent?: string; initialMessage?: string; autoSelect?: boolean },
  meta: ToolMeta,
): Promise<ToolResult>
```

2. `pylon-client.ts`의 `createConversationByToolUseId`에 파라미터 추가:
```typescript
async createConversationByToolUseId(
  toolUseId: string,
  name?: string,
  files?: string[],
  agent?: AgentType,
  initialMessage?: string,
  autoSelect?: boolean,
): Promise<ConversationResult>
```
TCP 요청에 `initialMessage`, `autoSelect` 포함.

3. `pylon-mcp-server.ts`의 `_handleCreateConversation`에서:
- `initialMessage`가 있으면 대화 생성 후 `_onConversationInitialMessage?.(conversationId, initialMessage)` 콜백 호출
- `autoSelect`가 true면 `_onConversationAutoSelect?.(conversationId)` 콜백 호출

4. `pylon.ts`에서 콜백 연결 (bin.ts에서):
- `onConversationInitialMessage`: `sendInitialContext(conversationId)` 후 `handleClaudeSend({ conversationId, message: initialMessage })` 호출
- `onConversationAutoSelect`: `workspaceStore.setActiveConversation(conversationId)` + `broadcastWorkspaceList()` 호출

5. 도구 정의에 `initialMessage`, `autoSelect` 파라미터 추가

**커밋:**
```bash
git add packages/pylon/src/mcp/tools/conversation.ts packages/pylon/src/mcp/pylon-client.ts packages/pylon/src/servers/pylon-mcp-server.ts packages/pylon/src/pylon.ts
git commit -m "feat(pylon): add initialMessage and autoSelect to MCP create_conversation"
```

---

### Task 5: Core + Pylon — COMMAND_MANAGE_CONVERSATION 메시지 타입

**Files:**
- Modify: `packages/core/src/constants/message-type.ts`
- Modify: `packages/pylon/src/pylon.ts`

**변경 내용:**

1. `message-type.ts`에 추가:
```typescript
/** 커맨드 관리 대화 생성 (Client → Pylon) */
COMMAND_MANAGE_CONVERSATION: 'command_manage_conversation',
```

2. `pylon.ts`의 `handleMessage`에 라우팅 추가:
```typescript
if (type === 'command_manage_conversation') {
  this.handleCommandManageConversation(payload, from);
  return;
}
```

3. `handleCommandManageConversation` 핸들러 구현:
```typescript
private handleCommandManageConversation(
  payload: Record<string, unknown> | undefined,
  from: MessageFrom | undefined
): void {
  const workspaceId = payload?.workspaceId as number;
  const commandId = payload?.commandId as number | undefined;
  if (!workspaceId) return;

  // 대화 생성
  const workspace = this.deps.workspaceStore.getWorkspace(workspaceId);
  if (!workspace) return;

  const convName = commandId ? '커맨드 수정' : '커맨드 생성';
  const result = this.deps.workspaceStore.createConversation(workspaceId, convName);
  if (!result) return;

  const { conversation } = result;

  // 초기 컨텍스트 전송
  this.sendInitialContext(conversation.conversationId);

  // 하드코딩된 프롬프트 전송
  let prompt: string;
  if (commandId) {
    prompt = `이 워크스페이스(id: ${workspaceId}, name: ${workspace.name})에서 커맨드(id: ${commandId})를 수정하거나 삭제하려고 해요.\nget_command로 현재 상태를 확인하고, update_command 또는 delete_command로 처리해 주세요.`;
  } else {
    prompt = `이 워크스페이스(id: ${workspaceId}, name: ${workspace.name})에서 새 커맨드를 만들려고 해요.\nlist_commands로 기존 커맨드를 확인하고, create_command로 새 커맨드를 만들어 주세요.\n사용자에게 어떤 커맨드를 만들고 싶은지 물어봐 주세요.`;
  }

  this.handleClaudeSend(
    { conversationId: conversation.conversationId, message: prompt },
    from
  );

  // 해당 대화로 자동 전환
  this.deps.workspaceStore.setActiveConversation(conversation.conversationId as ConversationId);
  this.broadcastWorkspaceList();
  this.saveWorkspaceStore().catch(() => {});

  // 세션 뷰어 등록
  if (from?.deviceId) {
    this.registerSessionViewer(from.deviceId, conversation.conversationId);
  }
}
```

**커밋:**
```bash
git add packages/core/src/constants/message-type.ts packages/pylon/src/pylon.ts
git commit -m "feat: add COMMAND_MANAGE_CONVERSATION message type and handler"
```

---

### Task 6: Client — relaySender에 commandManageConversation 함수 추가

**Files:**
- Modify: `packages/client/src/services/relaySender.ts`

**변경 내용:**

```typescript
export function commandManageConversation(workspaceId: number, commandId?: number): boolean {
  const pylonId = getPylonIdFromWorkspace(workspaceId);
  return sendMessage({
    type: MessageType.COMMAND_MANAGE_CONVERSATION,
    payload: { workspaceId, commandId },
    to: [pylonId],
  });
}
```

**커밋:**
```bash
git add packages/client/src/services/relaySender.ts
git commit -m "feat(client): add commandManageConversation to relaySender"
```

---

### Task 7: Client — CommandToolbar UI 변경

**Files:**
- Modify: `packages/client/src/components/chat/CommandToolbar.tsx`

**변경 내용:**

1. `CommandForm` 컴포넌트 전체 삭제 (51-159줄)
2. `ContextMenu` 컴포넌트 전체 삭제 (161-217줄)
3. 관련 state 제거: `showForm`, `editingCommand`, `contextMenu`
4. 관련 핸들러 제거: `handleCreate`, `handleUpdate`, `handleDelete`, `handleContextMenu`, `handleStartEdit`, `handleCancelForm`
5. import 정리: `createCommand`, `updateCommand`, `deleteCommand` 제거, `commandManageConversation` 추가. `Pencil`, `Trash2`, `X` 제거.

6. `+` 버튼 클릭 → `commandManageConversation(workspaceId!)` 호출

7. 커맨드 버튼에 롱프레스 핸들러 추가:
```typescript
const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

const handlePointerDown = useCallback((cmdId: number) => {
  longPressTimer.current = setTimeout(() => {
    if (workspaceId) {
      commandManageConversation(workspaceId, cmdId);
    }
    longPressTimer.current = null;
  }, 500);
}, [workspaceId]);

const handlePointerUp = useCallback(() => {
  if (longPressTimer.current) {
    clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
  }
}, []);
```

8. 커맨드 버튼에 `onPointerDown`, `onPointerUp`, `onPointerLeave` 이벤트 추가:
```tsx
<button
  key={cmd.id}
  onClick={() => handleExecute(cmd.id)}
  onPointerDown={() => handlePointerDown(cmd.id)}
  onPointerUp={handlePointerUp}
  onPointerLeave={handlePointerUp}
  className="..."
>
```

9. 우클릭 `onContextMenu` 핸들러 제거

**커밋:**
```bash
git add packages/client/src/components/chat/CommandToolbar.tsx
git commit -m "refactor(client): replace inline editing with conversation-based command management"
```

---

### Task 8: MCP tools — NULL→0 변환 적용

**Files:**
- Modify: `packages/pylon/src/mcp/tools/command.ts`

**변경 내용:**

MCP 인터페이스에서는 여전히 `null`을 글로벌로 받되, CommandStore 호출 전에 0으로 변환:

1. `executeCreateCommand`에서 `workspaceIds`의 null을 0으로 변환
2. `executeAssignCommand`에서 `workspaceIds`의 null을 0으로 변환
3. `executeUnassignCommand`에서 동일
4. `executeGetCommand`에서 응답의 workspaceIds에서 0을 null로 변환

**커밋:**
```bash
git add packages/pylon/src/mcp/tools/command.ts
git commit -m "feat(pylon): convert null↔0 in MCP command tools for global marker"
```

---

### Task 9: Pylon handleCommand* — NULL→0 변환 적용

**Files:**
- Modify: `packages/pylon/src/pylon.ts`

**변경 내용:**

Pylon의 커맨드 핸들러들에서 클라이언트로부터 받은 null을 0으로 변환:

1. `handleCommandCreate`: workspaceIds의 null → 0
2. `handleCommandAssign`: workspaceId의 null → 0

**커밋:**
```bash
git add packages/pylon/src/pylon.ts
git commit -m "feat(pylon): apply null→0 conversion in command message handlers"
```

---

### Task 10: 타입체크 및 최종 검증

**Step 1: 타입체크**
```bash
pnpm typecheck
```

**Step 2: Pylon 테스트**
```bash
pnpm --filter @estelle/pylon test
```

**Step 3: Client 테스트**
```bash
pnpm --filter @estelle/client test
```

**Step 4: 정리 커밋 (필요 시)**
```bash
git add -A
git commit -m "fix: resolve type errors from command toolbar improvements"
```

# Command Loading Restructure Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 커맨드를 WORKSPACE_LIST_RESULT에 포함하고, COMMAND_CHANGED에 delta를 포함시켜 별도 요청/응답 없이 커맨드를 관리하는 구조로 변경.

**Architecture:** Pylon이 워크스페이스 목록을 보낼 때 각 워크스페이스의 커맨드도 포함. 변경 시 COMMAND_CHANGED에 added/removed/updated delta를 포함하여 브로드캐스트. 클라이언트는 commandStore를 workspaceId 기반 Map으로 변경하여 워크스페이스 전환 시 즉시 표시.

**Tech Stack:** better-sqlite3, Zustand, React, vitest

---

### Task 1: Core — 불필요한 메시지 타입 제거

**Files:**
- Modify: `packages/core/src/constants/message-type.ts`

**Step 1: COMMAND_LIST_REQUEST, COMMAND_LIST 제거**

`message-type.ts`에서 다음 2개 항목 제거:
```
COMMAND_LIST_REQUEST: 'command_list_request',
COMMAND_LIST: 'command_list',
```

나머지 커맨드 타입(COMMAND_EXECUTE, COMMAND_CREATE, COMMAND_CREATE_RESULT, COMMAND_UPDATE, COMMAND_DELETE, COMMAND_ASSIGN, COMMAND_CHANGED)은 유지.

**Step 2: 커밋**

```bash
git add packages/core/src/constants/message-type.ts
git commit -m "refactor(core): remove COMMAND_LIST_REQUEST/COMMAND_LIST message types"
```

---

### Task 2: Pylon — CommandStore에 전체 워크스페이스별 커맨드 조회 메서드 추가

**Files:**
- Modify: `packages/pylon/src/stores/command-store.ts`
- Modify: `packages/pylon/tests/stores/command-store.test.ts`

**Step 1: 테스트 추가**

`command-store.test.ts`에 `getCommandsByWorkspaces` 테스트 추가:

```typescript
describe('getCommandsByWorkspaces', () => {
  it('should return commands grouped by workspaceId', () => {
    const globalCmd = store.createCommand('Global', 'star', null, 'g');
    store.assignCommand(globalCmd, null);
    const wsCmd = store.createCommand('WS', 'zap', null, 'w');
    store.assignCommand(wsCmd, 42);

    const result = store.getCommandsByWorkspaces([42, 99]);
    // workspaceId 42: global + ws-specific
    expect(result.get(42)).toHaveLength(2);
    // workspaceId 99: global only
    expect(result.get(99)).toHaveLength(1);
  });
});
```

**Step 2: 구현**

`command-store.ts`에 메서드 추가:

```typescript
getCommandsByWorkspaces(workspaceIds: number[]): Map<number, CommandListItem[]> {
  const result = new Map<number, CommandListItem[]>();
  for (const wsId of workspaceIds) {
    result.set(wsId, this.getCommands(wsId));
  }
  return result;
}

getAssignedWorkspaceIds(commandId: number): (number | null)[] {
  const stmt = this.db.prepare(
    'SELECT workspace_id FROM command_assignments WHERE command_id = ?'
  );
  const rows = stmt.all(commandId) as { workspace_id: number | null }[];
  return rows.map(r => r.workspace_id);
}
```

**Step 3: 테스트 실행 → 통과**

```bash
pnpm --filter @estelle/pylon test -- tests/stores/command-store.test.ts
```

**Step 4: 커밋**

```bash
git add packages/pylon/src/stores/command-store.ts packages/pylon/tests/stores/command-store.test.ts
git commit -m "feat(pylon): add getCommandsByWorkspaces and getAssignedWorkspaceIds to CommandStore"
```

---

### Task 3: Pylon — broadcastWorkspaceList에 커맨드 포함

**Files:**
- Modify: `packages/pylon/src/pylon.ts`

**Step 1: broadcastWorkspaceList 수정**

`broadcastWorkspaceList()` 메서드에서 각 워크스페이스에 커맨드 목록을 추가:

```typescript
broadcastWorkspaceList(): void {
  const workspaces = this.deps.workspaceStore.getAllWorkspaces();
  const activeState = this.deps.workspaceStore.getActiveState();

  // 커맨드 조회 (commandStore가 있을 때만)
  const workspaceIds = workspaces.map(ws => ws.workspaceId);
  const commandsByWs = this.deps.commandStore
    ? this.deps.commandStore.getCommandsByWorkspaces(workspaceIds)
    : new Map();

  const workspacesWithTasks = workspaces.map((ws) => {
    const taskResult = this.deps.taskManager.listTasks(ws.workingDir);
    const workerStatus = this.deps.workerManager.getWorkerStatus(ws.workspaceId, ws.workingDir);

    return {
      ...ws,
      tasks: taskResult.success ? taskResult.tasks : [],
      workerStatus,
      commands: commandsByWs.get(ws.workspaceId) ?? [],  // ← 추가
    };
  });

  // ... 나머지 동일
}
```

**Step 2: handleCommandListRequest 제거**

`handleMessage`에서 `command_list_request` 라우팅과 `handleCommandListRequest` 메서드를 제거.

**Step 3: 커밋**

```bash
git add packages/pylon/src/pylon.ts
git commit -m "feat(pylon): include commands per workspace in broadcastWorkspaceList"
```

---

### Task 4: Pylon — COMMAND_CHANGED에 delta 포함

**Files:**
- Modify: `packages/pylon/src/pylon.ts`

**Step 1: handleCommandCreate 수정**

COMMAND_CHANGED 브로드캐스트에 delta 포함:

```typescript
private handleCommandCreate(...): void {
  // ... 기존 생성 로직 ...

  this.send({
    type: 'command_changed',
    payload: {
      added: [{ command: { id: commandId, name, icon, color, content }, workspaceIds: ids }],
    },
    broadcast: 'clients',
  });

  // broadcastWorkspaceList는 호출하지 않음 (delta로 충분)
}
```

**Step 2: handleCommandUpdate 수정**

```typescript
private handleCommandUpdate(...): void {
  // ... 기존 수정 로직 ...
  // 수정된 커맨드 전체 데이터 조회 필요
  const updatedContent = this.deps.commandStore.getContent(commandId);
  // getCommands에서 해당 커맨드만 가져오기 어려우니, 직접 구성
  this.send({
    type: 'command_changed',
    payload: {
      updated: [{ id: commandId, ...fields, content: updatedContent }],
    },
    broadcast: 'clients',
  });
}
```

**Step 3: handleCommandDelete 수정**

```typescript
this.send({
  type: 'command_changed',
  payload: {
    removed: [commandId],
  },
  broadcast: 'clients',
});
```

**Step 4: handleCommandAssign 수정**

assign은 워크스페이스 할당 변경이므로, broadcastWorkspaceList로 전체 갱신:

```typescript
this.broadcastWorkspaceList();
```

**Step 5: 커밋**

```bash
git add packages/pylon/src/pylon.ts
git commit -m "feat(pylon): include delta in COMMAND_CHANGED broadcasts"
```

---

### Task 5: Pylon — MCP notifyCommandChanged에 delta 전달

**Files:**
- Modify: `packages/pylon/src/mcp/pylon-client.ts`
- Modify: `packages/pylon/src/servers/pylon-mcp-server.ts`
- Modify: `packages/pylon/src/mcp/tools/command.ts`

**Step 1: PylonClient.notifyCommandChanged에 delta 파라미터 추가**

```typescript
async notifyCommandChanged(delta: {
  added?: { command: any; workspaceIds: (number | null)[] }[];
  removed?: number[];
  updated?: any[];
}): Promise<PylonResponse> {
  return this._sendRequest({ action: 'notify_command_changed', ...delta });
}
```

**Step 2: PylonMcpServer에서 delta를 브로드캐스트에 포함**

`notify_command_changed` 핸들러에서 요청의 delta를 그대로 `command_changed` payload로 전달.

**Step 3: MCP tools에서 delta 전달**

각 도구에서 `notifyCommandChangedSafe()`에 delta를 전달:

```typescript
// executeCreateCommand
await notifyCommandChangedSafe({
  added: [{ command: { id: commandId, name, icon, color, content }, workspaceIds }]
});

// executeUpdateCommand
await notifyCommandChangedSafe({
  updated: [{ id: commandId, ...fields }]
});

// executeDeleteCommand
await notifyCommandChangedSafe({
  removed: [commandId]
});

// executeAssignCommand — broadcastWorkspaceList 트리거 (전체 갱신)
```

**Step 4: 테스트**

```bash
pnpm --filter @estelle/pylon test
```

**Step 5: 커밋**

```bash
git add packages/pylon/src/mcp/pylon-client.ts packages/pylon/src/servers/pylon-mcp-server.ts packages/pylon/src/mcp/tools/command.ts
git commit -m "feat(pylon): pass delta through MCP notifyCommandChanged"
```

---

### Task 6: Client — commandStore를 Map 기반으로 변경

**Files:**
- Modify: `packages/client/src/stores/commandStore.ts`
- Modify: `packages/client/src/stores/commandStore.test.ts`

**Step 1: 테스트 수정**

```typescript
describe('commandStore', () => {
  beforeEach(() => {
    useCommandStore.getState().reset();
  });

  it('초기 상태는 빈 Map', () => {
    expect(useCommandStore.getState().commandsByWorkspace.size).toBe(0);
  });

  it('setWorkspaceCommands로 워크스페이스별 커맨드 설정', () => {
    const { setWorkspaceCommands } = useCommandStore.getState();
    setWorkspaceCommands(386, [
      { id: 1, name: 'Deploy', icon: 'rocket', color: '#22c55e', content: 'deploy' },
    ]);
    expect(useCommandStore.getState().commandsByWorkspace.get(386)).toHaveLength(1);
  });

  it('getCommandsForWorkspace로 특정 워크스페이스 커맨드 조회', () => {
    const { setWorkspaceCommands, getCommandsForWorkspace } = useCommandStore.getState();
    setWorkspaceCommands(386, [{ id: 1, name: 'Cmd', icon: null, color: null, content: 'c' }]);
    expect(getCommandsForWorkspace(386)).toHaveLength(1);
    expect(getCommandsForWorkspace(999)).toHaveLength(0);
  });

  it('applyDelta — added', () => {
    const { applyDelta, getCommandsForWorkspace } = useCommandStore.getState();
    applyDelta({
      added: [{ command: { id: 1, name: 'New', icon: null, color: null, content: 'c' }, workspaceIds: [386] }],
    });
    expect(getCommandsForWorkspace(386)).toHaveLength(1);
  });

  it('applyDelta — removed', () => {
    const { setWorkspaceCommands, applyDelta, getCommandsForWorkspace } = useCommandStore.getState();
    setWorkspaceCommands(386, [{ id: 1, name: 'Cmd', icon: null, color: null, content: 'c' }]);
    applyDelta({ removed: [1] });
    expect(getCommandsForWorkspace(386)).toHaveLength(0);
  });

  it('applyDelta — updated', () => {
    const { setWorkspaceCommands, applyDelta, getCommandsForWorkspace } = useCommandStore.getState();
    setWorkspaceCommands(386, [{ id: 1, name: 'Old', icon: null, color: null, content: 'c' }]);
    applyDelta({ updated: [{ id: 1, name: 'New', icon: null, color: null, content: 'c' }] });
    expect(getCommandsForWorkspace(386)![0].name).toBe('New');
  });

  it('applyDelta — added with null workspaceId (global)', () => {
    const { setWorkspaceCommands, applyDelta, getCommandsForWorkspace } = useCommandStore.getState();
    // 워크스페이스 386, 512가 존재한다고 가정하고, 각각 빈 배열로 초기화
    setWorkspaceCommands(386, []);
    setWorkspaceCommands(512, []);
    applyDelta({
      added: [{ command: { id: 1, name: 'Global', icon: null, color: null, content: 'g' }, workspaceIds: [null] }],
    });
    // null = global → 모든 알려진 워크스페이스에 추가
    expect(getCommandsForWorkspace(386)).toHaveLength(1);
    expect(getCommandsForWorkspace(512)).toHaveLength(1);
  });
});
```

**Step 2: commandStore 구현**

```typescript
import { create } from 'zustand';

export interface CommandItem {
  id: number;
  name: string;
  icon: string | null;
  color: string | null;
  content: string;
}

export interface CommandDelta {
  added?: { command: CommandItem; workspaceIds: (number | null)[] }[];
  removed?: number[];
  updated?: CommandItem[];
}

interface CommandState {
  commandsByWorkspace: Map<number, CommandItem[]>;
  setWorkspaceCommands: (workspaceId: number, commands: CommandItem[]) => void;
  getCommandsForWorkspace: (workspaceId: number) => CommandItem[];
  applyDelta: (delta: CommandDelta) => void;
  reset: () => void;
}

export const useCommandStore = create<CommandState>((set, get) => ({
  commandsByWorkspace: new Map(),

  setWorkspaceCommands: (workspaceId, commands) => {
    set((state) => {
      const newMap = new Map(state.commandsByWorkspace);
      newMap.set(workspaceId, commands);
      return { commandsByWorkspace: newMap };
    });
  },

  getCommandsForWorkspace: (workspaceId) => {
    return get().commandsByWorkspace.get(workspaceId) ?? [];
  },

  applyDelta: (delta) => {
    set((state) => {
      const newMap = new Map(state.commandsByWorkspace);

      // removed
      if (delta.removed) {
        for (const cmdId of delta.removed) {
          for (const [wsId, cmds] of newMap) {
            newMap.set(wsId, cmds.filter((c) => c.id !== cmdId));
          }
        }
      }

      // updated
      if (delta.updated) {
        for (const updated of delta.updated) {
          for (const [wsId, cmds] of newMap) {
            newMap.set(
              wsId,
              cmds.map((c) => (c.id === updated.id ? { ...c, ...updated } : c))
            );
          }
        }
      }

      // added
      if (delta.added) {
        for (const { command, workspaceIds } of delta.added) {
          const isGlobal = workspaceIds.includes(null);
          if (isGlobal) {
            for (const [wsId, cmds] of newMap) {
              if (!cmds.some((c) => c.id === command.id)) {
                newMap.set(wsId, [...cmds, command]);
              }
            }
          } else {
            for (const wsId of workspaceIds) {
              if (wsId !== null) {
                const existing = newMap.get(wsId) ?? [];
                if (!existing.some((c) => c.id === command.id)) {
                  newMap.set(wsId, [...existing, command]);
                }
              }
            }
          }
        }
      }

      return { commandsByWorkspace: newMap };
    });
  },

  reset: () => set({ commandsByWorkspace: new Map() }),
}));
```

**Step 3: 테스트 실행 → 통과**

```bash
pnpm --filter @estelle/client test -- src/stores/commandStore.test.ts
```

**Step 4: 커밋**

```bash
git add packages/client/src/stores/commandStore.ts packages/client/src/stores/commandStore.test.ts
git commit -m "refactor(client): change commandStore to Map<workspaceId, CommandItem[]> with delta support"
```

---

### Task 7: Client — useMessageRouter 변경

**Files:**
- Modify: `packages/client/src/hooks/useMessageRouter.ts`

**Step 1: WORKSPACE_LIST_RESULT에서 커맨드 추출**

기존 `requestCommandList` 호출을 제거하고, workspace 데이터에서 직접 커맨드를 추출:

```typescript
// WORKSPACE_LIST_RESULT case 내, setWorkspaces 호출 후:
// 각 워크스페이스의 커맨드를 commandStore에 저장
if (workspaces) {
  for (const ws of workspaces) {
    if (ws.commands) {
      useCommandStore.getState().setWorkspaceCommands(ws.workspaceId, ws.commands);
    }
  }
}
```

**Step 2: COMMAND_LIST case 제거**

기존 `MessageType.COMMAND_LIST` case 전체 삭제.

**Step 3: COMMAND_CHANGED case를 delta 기반으로 변경**

```typescript
case MessageType.COMMAND_CHANGED: {
  const delta = payload as CommandDelta;
  useCommandStore.getState().applyDelta(delta);
  break;
}
```

**Step 4: import 정리**

- `requestCommandList` import 제거
- `CommandItem` → `CommandDelta` import로 변경

**Step 5: 커밋**

```bash
git add packages/client/src/hooks/useMessageRouter.ts
git commit -m "refactor(client): extract commands from workspace list, handle delta in COMMAND_CHANGED"
```

---

### Task 8: Client — relaySender에서 requestCommandList 제거

**Files:**
- Modify: `packages/client/src/services/relaySender.ts`

**Step 1: requestCommandList 함수 제거**

```typescript
// 이 함수 전체 삭제:
export function requestCommandList(workspaceId: number): boolean { ... }
```

**Step 2: 기존 테스트에서 requestCommandList mock 제거**

관련 mock이 있는 테스트 파일 확인 후 제거.

**Step 3: 커밋**

```bash
git add packages/client/src/services/relaySender.ts
git commit -m "refactor(client): remove requestCommandList from relaySender"
```

---

### Task 9: Client — CommandToolbar를 workspaceId 기반으로 변경

**Files:**
- Modify: `packages/client/src/components/chat/CommandToolbar.tsx`
- Modify: `packages/client/src/components/chat/InputBar.tsx`

**Step 1: CommandToolbar props 변경**

```typescript
interface CommandToolbarProps {
  conversationId: number | null;
  workspaceId: number | null;  // 추가
}
```

**Step 2: commandStore 구독을 workspaceId 기반으로**

```typescript
export function CommandToolbar({ conversationId, workspaceId }: CommandToolbarProps) {
  const commands = useCommandStore((state) =>
    workspaceId ? state.getCommandsForWorkspace(workspaceId) : []
  );
  // ... 나머지 동일
}
```

주의: Zustand selector에서 `getCommandsForWorkspace`를 호출하면 매번 새 배열 참조가 생길 수 있으므로, `commandsByWorkspace`를 구독하고 내부에서 get하는 패턴이 나을 수 있음. 실제 구현 시 판단.

**Step 3: InputBar에서 workspaceId 전달**

```tsx
<CommandToolbar
  conversationId={conversationId}
  workspaceId={selectedConversation?.workspaceId ? parseInt(selectedConversation.workspaceId, 10) : null}
/>
```

**Step 4: 커밋**

```bash
git add packages/client/src/components/chat/CommandToolbar.tsx packages/client/src/components/chat/InputBar.tsx
git commit -m "refactor(client): CommandToolbar reads commands by workspaceId"
```

---

### Task 10: 타입체크 및 최종 검증

**Step 1: 전체 타입체크**

```bash
pnpm typecheck
```

**Step 2: 전체 테스트**

```bash
pnpm --filter @estelle/pylon test
pnpm --filter @estelle/client test
```

**Step 3: 정리 커밋 (필요 시)**

```bash
git add -A
git commit -m "fix: resolve type errors from command loading restructure"
```

# Command Toolbar Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 입력창 위에 워크스페이스별 커맨드 버튼 툴바를 추가하고, 클릭 시 Pylon에 커맨드 ID만 전송하여 실행하는 기능 구현.

**Architecture:** Pylon SQLite에 commands/command_assignments 테이블 추가. 클라이언트는 커맨드 목록(id, name, icon, color)만 표시하고, 실행 시 ID만 전송. Pylon이 content를 조회하여 기존 CLAUDE_SEND 로직으로 처리.

**Tech Stack:** better-sqlite3, Zustand, React, Lucide icons, vitest

---

### Task 1: Core - 메시지 타입 추가

**Files:**
- Modify: `packages/core/src/constants/message-type.ts`

**Step 1: message-type.ts에 Command 메시지 타입 추가**

`message-type.ts`의 Widget 섹션과 Utility 섹션 사이에 Command 카테고리를 추가:

```typescript
  // === Command ===
  /** 커맨드 목록 요청 (Client → Pylon) */
  COMMAND_LIST_REQUEST: 'command_list_request',
  /** 커맨드 목록 응답 (Pylon → Client) */
  COMMAND_LIST: 'command_list',
  /** 커맨드 실행 (Client → Pylon) */
  COMMAND_EXECUTE: 'command_execute',
  /** 커맨드 생성 (Client → Pylon) */
  COMMAND_CREATE: 'command_create',
  /** 커맨드 생성 응답 (Pylon → Client) */
  COMMAND_CREATE_RESULT: 'command_create_result',
  /** 커맨드 수정 (Client → Pylon) */
  COMMAND_UPDATE: 'command_update',
  /** 커맨드 삭제 (Client → Pylon) */
  COMMAND_DELETE: 'command_delete',
  /** 커맨드 할당 변경 (Client → Pylon) */
  COMMAND_ASSIGN: 'command_assign',
  /** 커맨드 변경 알림 (Pylon → Client) */
  COMMAND_CHANGED: 'command_changed',
```

**Step 2: 커밋**

```bash
git add packages/core/src/constants/message-type.ts
git commit -m "feat(core): add command toolbar message types"
```

---

### Task 2: Pylon - CommandStore 테스트 작성

**Files:**
- Create: `packages/pylon/tests/stores/command-store.test.ts`

**Step 1: 테스트 파일 작성**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CommandStore } from '../../src/stores/command-store.js';

describe('CommandStore', () => {
  let store: CommandStore;

  beforeEach(() => {
    store = new CommandStore(':memory:');
  });

  afterEach(() => {
    store.close();
  });

  describe('createCommand', () => {
    it('should create a command and return its id', () => {
      const id = store.createCommand('Review', 'search', '#ff0000', 'Review this code');
      expect(id).toBe(1);
    });

    it('should create command with null icon and color', () => {
      const id = store.createCommand('Deploy', null, null, 'Deploy to production');
      expect(id).toBe(1);
    });
  });

  describe('getCommands', () => {
    it('should return global commands when workspace_id is null', () => {
      const id = store.createCommand('Global Cmd', 'star', null, 'global content');
      store.assignCommand(id, null);

      const commands = store.getCommands(999);
      expect(commands).toHaveLength(1);
      expect(commands[0]).toEqual({
        id, name: 'Global Cmd', icon: 'star', color: null,
      });
    });

    it('should return workspace-specific commands', () => {
      const id = store.createCommand('WS Cmd', 'zap', '#00ff00', 'ws content');
      store.assignCommand(id, 42);

      const commands = store.getCommands(42);
      expect(commands).toHaveLength(1);
      expect(commands[0].name).toBe('WS Cmd');
    });

    it('should return both global and workspace commands', () => {
      const globalId = store.createCommand('Global', 'star', null, 'g');
      store.assignCommand(globalId, null);
      const wsId = store.createCommand('WS Only', 'zap', null, 'w');
      store.assignCommand(wsId, 42);

      const commands = store.getCommands(42);
      expect(commands).toHaveLength(2);
    });

    it('should not return commands for other workspaces', () => {
      const id = store.createCommand('Other', 'x', null, 'other');
      store.assignCommand(id, 99);

      const commands = store.getCommands(42);
      expect(commands).toHaveLength(0);
    });

    it('should not include content in list response', () => {
      const id = store.createCommand('Cmd', null, null, 'secret content');
      store.assignCommand(id, null);

      const commands = store.getCommands(1);
      expect(commands[0]).not.toHaveProperty('content');
    });
  });

  describe('getContent', () => {
    it('should return content for a valid command id', () => {
      const id = store.createCommand('Cmd', null, null, 'the content');
      expect(store.getContent(id)).toBe('the content');
    });

    it('should return null for non-existent command id', () => {
      expect(store.getContent(999)).toBeNull();
    });
  });

  describe('updateCommand', () => {
    it('should update name', () => {
      const id = store.createCommand('Old', 'star', null, 'content');
      store.updateCommand(id, { name: 'New' });
      store.assignCommand(id, null);

      const commands = store.getCommands(1);
      expect(commands[0].name).toBe('New');
    });

    it('should update content', () => {
      const id = store.createCommand('Cmd', null, null, 'old content');
      store.updateCommand(id, { content: 'new content' });
      expect(store.getContent(id)).toBe('new content');
    });

    it('should return false for non-existent command', () => {
      const result = store.updateCommand(999, { name: 'x' });
      expect(result).toBe(false);
    });
  });

  describe('deleteCommand', () => {
    it('should delete command and its assignments', () => {
      const id = store.createCommand('Cmd', null, null, 'content');
      store.assignCommand(id, null);
      store.assignCommand(id, 42);

      store.deleteCommand(id);

      expect(store.getContent(id)).toBeNull();
      expect(store.getCommands(42)).toHaveLength(0);
    });
  });

  describe('assignCommand / unassignCommand', () => {
    it('should assign command to workspace', () => {
      const id = store.createCommand('Cmd', null, null, 'c');
      store.assignCommand(id, 42);

      expect(store.getCommands(42)).toHaveLength(1);
    });

    it('should unassign command from workspace', () => {
      const id = store.createCommand('Cmd', null, null, 'c');
      store.assignCommand(id, 42);
      store.unassignCommand(id, 42);

      expect(store.getCommands(42)).toHaveLength(0);
    });

    it('should not duplicate assignments', () => {
      const id = store.createCommand('Cmd', null, null, 'c');
      store.assignCommand(id, 42);
      store.assignCommand(id, 42); // duplicate

      expect(store.getCommands(42)).toHaveLength(1);
    });
  });
});
```

**Step 2: 테스트 실행 → 실패 확인**

```bash
pnpm --filter @estelle/pylon test -- tests/stores/command-store.test.ts
```

Expected: FAIL — `command-store.js` 모듈 없음

**Step 3: 커밋**

```bash
git add packages/pylon/tests/stores/command-store.test.ts
git commit -m "test(pylon): add command-store tests (red)"
```

---

### Task 3: Pylon - CommandStore 구현

**Files:**
- Create: `packages/pylon/src/stores/command-store.ts`

**Step 1: CommandStore 구현**

```typescript
/**
 * @file command-store.ts
 * @description CommandStore - 커맨드 툴바용 커맨드 저장소 (SQLite 기반)
 */

import Database from 'better-sqlite3';

export interface CommandListItem {
  id: number;
  name: string;
  icon: string | null;
  color: string | null;
}

export class CommandStore {
  private db: Database.Database;
  private stmtInsertCommand!: Database.Statement;
  private stmtUpdateCommand!: Database.Statement;
  private stmtDeleteCommand!: Database.Statement;
  private stmtGetContent!: Database.Statement;
  private stmtGetCommands!: Database.Statement;
  private stmtAssign!: Database.Statement;
  private stmtUnassign!: Database.Statement;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this._initSchema();
    this._prepareStatements();
  }

  private _initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS commands (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        icon TEXT,
        color TEXT,
        content TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS command_assignments (
        command_id INTEGER NOT NULL REFERENCES commands(id) ON DELETE CASCADE,
        workspace_id INTEGER,
        UNIQUE(command_id, workspace_id)
      );
    `);
  }

  private _prepareStatements(): void {
    this.stmtInsertCommand = this.db.prepare(
      'INSERT INTO commands (name, icon, color, content) VALUES (?, ?, ?, ?)'
    );
    this.stmtUpdateCommand = this.db.prepare(
      'UPDATE commands SET name = COALESCE(?, name), icon = COALESCE(?, icon), color = COALESCE(?, color), content = COALESCE(?, content) WHERE id = ?'
    );
    this.stmtDeleteCommand = this.db.prepare('DELETE FROM commands WHERE id = ?');
    this.stmtGetContent = this.db.prepare('SELECT content FROM commands WHERE id = ?');
    this.stmtGetCommands = this.db.prepare(
      'SELECT c.id, c.name, c.icon, c.color FROM commands c INNER JOIN command_assignments ca ON c.id = ca.command_id WHERE ca.workspace_id IS NULL OR ca.workspace_id = ?'
    );
    this.stmtAssign = this.db.prepare(
      'INSERT OR IGNORE INTO command_assignments (command_id, workspace_id) VALUES (?, ?)'
    );
    this.stmtUnassign = this.db.prepare(
      'DELETE FROM command_assignments WHERE command_id = ? AND workspace_id = ?'
    );
  }

  createCommand(name: string, icon: string | null, color: string | null, content: string): number {
    const result = this.stmtInsertCommand.run(name, icon, color, content);
    return Number(result.lastInsertRowid);
  }

  updateCommand(id: number, fields: { name?: string; icon?: string; color?: string; content?: string }): boolean {
    const result = this.stmtUpdateCommand.run(
      fields.name ?? null, fields.icon ?? null, fields.color ?? null, fields.content ?? null, id
    );
    return result.changes > 0;
  }

  deleteCommand(id: number): boolean {
    const result = this.stmtDeleteCommand.run(id);
    return result.changes > 0;
  }

  getContent(id: number): string | null {
    const row = this.stmtGetContent.get(id) as { content: string } | undefined;
    return row?.content ?? null;
  }

  getCommands(workspaceId: number): CommandListItem[] {
    return this.stmtGetCommands.all(workspaceId) as CommandListItem[];
  }

  assignCommand(commandId: number, workspaceId: number | null): void {
    this.stmtAssign.run(commandId, workspaceId);
  }

  unassignCommand(commandId: number, workspaceId: number | null): void {
    this.stmtUnassign.run(commandId, workspaceId);
  }

  close(): void {
    this.db.close();
  }
}
```

**Step 2: 테스트 실행 → 통과 확인**

```bash
pnpm --filter @estelle/pylon test -- tests/stores/command-store.test.ts
```

Expected: ALL PASS

**Step 3: 커밋**

```bash
git add packages/pylon/src/stores/command-store.ts
git commit -m "feat(pylon): implement CommandStore with SQLite"
```

---

### Task 4: Pylon - handleMessage 커맨드 라우팅

**Files:**
- Modify: `packages/pylon/src/pylon.ts`

**Step 1: Pylon 클래스에 CommandStore 의존성 추가**

`pylon.ts`의 deps 타입에 `commandStore` 추가. 기존 `messageStore`, `workspaceStore`와 같은 패턴.

**Step 2: handleMessage에 커맨드 메시지 라우팅 추가**

`handleMessage`의 `usage_request` 블록 근처에 커맨드 관련 라우팅 추가:

```typescript
    // ===== Command =====
    if (type === 'command_list_request') {
      this.handleCommandListRequest(payload, from);
      return;
    }

    if (type === 'command_execute') {
      this.handleCommandExecute(payload, from);
      return;
    }

    if (type === 'command_create') {
      this.handleCommandCreate(payload, from);
      return;
    }

    if (type === 'command_update') {
      this.handleCommandUpdate(payload, from);
      return;
    }

    if (type === 'command_delete') {
      this.handleCommandDelete(payload, from);
      return;
    }

    if (type === 'command_assign') {
      this.handleCommandAssign(payload, from);
      return;
    }
```

**Step 3: 핸들러 메서드 구현**

```typescript
  private handleCommandListRequest(
    payload: Record<string, unknown> | undefined,
    from: MessageFrom | undefined
  ): void {
    const workspaceId = payload?.workspaceId as number;
    if (!workspaceId || !from?.deviceId) return;

    const commands = this.deps.commandStore.getCommands(workspaceId);
    this.send({
      type: MessageType.COMMAND_LIST,
      payload: { commands },
      to: [from.deviceId],
    });
  }

  private handleCommandExecute(
    payload: Record<string, unknown> | undefined,
    from: MessageFrom | undefined
  ): void {
    const commandId = payload?.commandId as number;
    const conversationId = payload?.conversationId as number;
    if (!commandId || !conversationId) return;

    const content = this.deps.commandStore.getContent(commandId);
    if (!content) {
      this.send({
        type: MessageType.ERROR,
        payload: { message: `Command not found: ${commandId}` },
        to: from?.deviceId ? [from.deviceId] : undefined,
      });
      return;
    }

    // 기존 CLAUDE_SEND 로직과 동일하게 처리
    this.handleClaudeSend(
      { conversationId, message: content },
      from
    );
  }

  private handleCommandCreate(
    payload: Record<string, unknown> | undefined,
    from: MessageFrom | undefined
  ): void {
    const { name, icon, color, content, workspaceIds } = payload as {
      name: string; icon?: string; color?: string; content: string; workspaceIds?: (number | null)[];
    };
    if (!name || !content) return;

    const commandId = this.deps.commandStore.createCommand(name, icon ?? null, color ?? null, content);

    // 할당
    const ids = workspaceIds ?? [null]; // 기본 글로벌
    for (const wsId of ids) {
      this.deps.commandStore.assignCommand(commandId, wsId);
    }

    // 응답
    if (from?.deviceId) {
      this.send({
        type: MessageType.COMMAND_CREATE_RESULT,
        payload: { commandId },
        to: [from.deviceId],
      });
    }

    // 변경 알림 broadcast
    this.broadcast({ type: MessageType.COMMAND_CHANGED, payload: {} });
  }

  private handleCommandUpdate(
    payload: Record<string, unknown> | undefined,
    from: MessageFrom | undefined
  ): void {
    const { commandId, ...fields } = payload as {
      commandId: number; name?: string; icon?: string; color?: string; content?: string;
    };
    if (!commandId) return;

    this.deps.commandStore.updateCommand(commandId, fields);
    this.broadcast({ type: MessageType.COMMAND_CHANGED, payload: {} });
  }

  private handleCommandDelete(
    payload: Record<string, unknown> | undefined,
    _from: MessageFrom | undefined
  ): void {
    const commandId = payload?.commandId as number;
    if (!commandId) return;

    this.deps.commandStore.deleteCommand(commandId);
    this.broadcast({ type: MessageType.COMMAND_CHANGED, payload: {} });
  }

  private handleCommandAssign(
    payload: Record<string, unknown> | undefined,
    _from: MessageFrom | undefined
  ): void {
    const { commandId, workspaceId, assign } = payload as {
      commandId: number; workspaceId: number | null; assign: boolean;
    };
    if (!commandId) return;

    if (assign) {
      this.deps.commandStore.assignCommand(commandId, workspaceId);
    } else {
      this.deps.commandStore.unassignCommand(commandId, workspaceId);
    }
    this.broadcast({ type: MessageType.COMMAND_CHANGED, payload: {} });
  }
```

**Step 4: 테스트 실행**

```bash
pnpm --filter @estelle/pylon test
```

**Step 5: 커밋**

```bash
git add packages/pylon/src/pylon.ts
git commit -m "feat(pylon): add command message handling in handleMessage"
```

---

### Task 5: Pylon - MCP 도구 추가

**Files:**
- Create: `packages/pylon/src/mcp/tools/command.ts`
- Modify: `packages/pylon/src/mcp/server.ts`

**Step 1: command.ts MCP 도구 파일 생성**

기존 패턴(system-prompt.ts)과 동일한 구조로 5개 도구 정의:
- `create_command`: 커맨드 생성
- `update_command`: 커맨드 수정
- `delete_command`: 커맨드 삭제
- `list_commands`: 커맨드 목록
- `assign_command`: 워크스페이스 할당

각 도구는 `getXxxToolDefinition()`과 `executeXxx()` 함수 쌍.
PylonClient를 통해 Pylon에 요청 전송.

**Step 2: server.ts에 도구 등록**

ListToolsRequestSchema 핸들러의 tools 배열에 5개 도구 정의 추가.
CallToolRequestSchema 핸들러의 switch에 5개 케이스 추가.

**Step 3: 테스트 실행**

```bash
pnpm --filter @estelle/pylon test
```

**Step 4: 커밋**

```bash
git add packages/pylon/src/mcp/tools/command.ts packages/pylon/src/mcp/server.ts
git commit -m "feat(pylon): add command MCP tools (create, update, delete, list, assign)"
```

---

### Task 6: Client - commandStore (Zustand)

**Files:**
- Create: `packages/client/src/stores/commandStore.ts`
- Create: `packages/client/src/stores/commandStore.test.ts`

**Step 1: 테스트 작성**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useCommandStore } from './commandStore';

describe('commandStore', () => {
  beforeEach(() => {
    useCommandStore.getState().reset();
  });

  it('초기 상태는 빈 배열', () => {
    expect(useCommandStore.getState().commands).toEqual([]);
  });

  it('setCommands로 커맨드 목록 설정', () => {
    const { setCommands } = useCommandStore.getState();
    setCommands([
      { id: 1, name: 'Review', icon: 'search', color: '#ff0000' },
    ]);
    expect(useCommandStore.getState().commands).toHaveLength(1);
  });

  it('reset으로 초기화', () => {
    const { setCommands, reset } = useCommandStore.getState();
    setCommands([{ id: 1, name: 'Cmd', icon: null, color: null }]);
    reset();
    expect(useCommandStore.getState().commands).toEqual([]);
  });
});
```

**Step 2: 테스트 실행 → 실패**

```bash
pnpm --filter @estelle/client test -- src/stores/commandStore.test.ts
```

**Step 3: commandStore 구현**

```typescript
import { create } from 'zustand';

export interface CommandItem {
  id: number;
  name: string;
  icon: string | null;
  color: string | null;
}

interface CommandState {
  commands: CommandItem[];
  setCommands: (commands: CommandItem[]) => void;
  reset: () => void;
}

export const useCommandStore = create<CommandState>((set) => ({
  commands: [],
  setCommands: (commands) => set({ commands }),
  reset: () => set({ commands: [] }),
}));
```

**Step 4: 테스트 실행 → 통과**

```bash
pnpm --filter @estelle/client test -- src/stores/commandStore.test.ts
```

**Step 5: 커밋**

```bash
git add packages/client/src/stores/commandStore.ts packages/client/src/stores/commandStore.test.ts
git commit -m "feat(client): add commandStore for toolbar state"
```

---

### Task 7: Client - relaySender 커맨드 함수 추가

**Files:**
- Modify: `packages/client/src/services/relaySender.ts`

**Step 1: 커맨드 관련 전송 함수 추가**

기존 `sendClaudeMessage` 패턴을 따라:

```typescript
export function requestCommandList(workspaceId: number): boolean {
  const pylonId = getPylonIdFromWorkspace(workspaceId);
  return sendMessage({
    type: MessageType.COMMAND_LIST_REQUEST,
    payload: { workspaceId },
    to: [pylonId],
  });
}

export function executeCommand(commandId: number, conversationId: number): boolean {
  const pylonId = getPylonIdFromConversation(conversationId);
  return sendMessage({
    type: MessageType.COMMAND_EXECUTE,
    payload: { commandId, conversationId },
    to: [pylonId],
  });
}

export function createCommand(
  name: string, icon: string | null, color: string | null, content: string, workspaceIds?: (number | null)[]
): boolean {
  return sendMessage({
    type: MessageType.COMMAND_CREATE,
    payload: { name, icon, color, content, workspaceIds },
    broadcast: 'pylons',
  });
}

export function updateCommand(
  commandId: number, fields: { name?: string; icon?: string; color?: string; content?: string }
): boolean {
  return sendMessage({
    type: MessageType.COMMAND_UPDATE,
    payload: { commandId, ...fields },
    broadcast: 'pylons',
  });
}

export function deleteCommand(commandId: number): boolean {
  return sendMessage({
    type: MessageType.COMMAND_DELETE,
    payload: { commandId },
    broadcast: 'pylons',
  });
}
```

**Step 2: 커밋**

```bash
git add packages/client/src/services/relaySender.ts
git commit -m "feat(client): add command sender functions to relaySender"
```

---

### Task 8: Client - useMessageRouter 커맨드 라우팅

**Files:**
- Modify: `packages/client/src/hooks/useMessageRouter.ts`

**Step 1: COMMAND_LIST, COMMAND_CHANGED 라우팅 추가**

기존 switch 문에 케이스 추가:

```typescript
case 'command_list': {
  const { commands } = payload as { commands: CommandItem[] };
  useCommandStore.getState().setCommands(commands);
  break;
}

case 'command_changed': {
  // 커맨드가 변경됨 → 목록 재요청
  const activeWorkspaceId = useWorkspaceStore.getState().activeWorkspaceId;
  if (activeWorkspaceId) {
    requestCommandList(activeWorkspaceId);
  }
  break;
}
```

**Step 2: 워크스페이스 변경 시 커맨드 목록 재요청**

기존 `workspace_list_result` 케이스 끝에 추가:

```typescript
// 커맨드 목록 요청
if (activeWorkspaceId) {
  requestCommandList(activeWorkspaceId);
}
```

**Step 3: 커밋**

```bash
git add packages/client/src/hooks/useMessageRouter.ts
git commit -m "feat(client): add command message routing"
```

---

### Task 9: Client - CommandToolbar 컴포넌트

**Files:**
- Create: `packages/client/src/components/chat/CommandToolbar.tsx`
- Modify: `packages/client/src/components/chat/InputBar.tsx`

**Step 1: CommandToolbar 컴포넌트 생성**

```tsx
import * as LucideIcons from 'lucide-react';
import { useCommandStore } from '../../stores/commandStore';
import { executeCommand } from '../../services/relaySender';
import { useWorkspaceStore } from '../../stores/workspaceStore';

interface CommandToolbarProps {
  conversationId: number | null;
}

export function CommandToolbar({ conversationId }: CommandToolbarProps) {
  const commands = useCommandStore((s) => s.commands);

  if (commands.length === 0 || !conversationId) return null;

  return (
    <div className="flex gap-1 px-2 py-1 overflow-x-auto">
      {commands.map((cmd) => {
        // 이모지인지 Lucide 아이콘인지 판별
        const isEmoji = cmd.icon && /\p{Emoji}/u.test(cmd.icon);
        const LucideIcon = !isEmoji && cmd.icon
          ? (LucideIcons as Record<string, LucideIcons.LucideIcon>)[
              cmd.icon.charAt(0).toUpperCase() + cmd.icon.slice(1)
            ]
          : null;

        return (
          <button
            key={cmd.id}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs
                       bg-secondary/50 hover:bg-secondary transition-colors
                       whitespace-nowrap"
            onClick={() => executeCommand(cmd.id, conversationId)}
          >
            {isEmoji && <span>{cmd.icon}</span>}
            {LucideIcon && <LucideIcon size={14} color={cmd.color ?? undefined} />}
            <span>{cmd.name}</span>
          </button>
        );
      })}
    </div>
  );
}
```

**Step 2: InputBar.tsx에 CommandToolbar 배치**

SuggestionChips 위에 CommandToolbar를 추가:

```tsx
<CommandToolbar conversationId={currentConversationId} />
<SuggestionChips ... />
```

**Step 3: 수동 테스트**

```bash
pnpm dev
```

커맨드가 없으면 툴바가 보이지 않는지 확인.

**Step 4: 커밋**

```bash
git add packages/client/src/components/chat/CommandToolbar.tsx packages/client/src/components/chat/InputBar.tsx
git commit -m "feat(client): add CommandToolbar component above input"
```

---

### Task 10: Client - 인라인 편집 UI

**Files:**
- Modify: `packages/client/src/components/chat/CommandToolbar.tsx`

**Step 1: 편집 모드 상태 추가**

CommandToolbar에 편집 모드(추가/수정/삭제) UI 추가:
- `+` 버튼 → 커맨드 추가 다이얼로그 (name, icon, color, content 입력)
- 버튼 우클릭/롱프레스 → 수정/삭제 컨텍스트 메뉴
- 추가/수정 시 `createCommand()` / `updateCommand()` 호출
- 삭제 시 `deleteCommand()` 호출

**Step 2: 수동 테스트**

```bash
pnpm dev
```

커맨드 CRUD가 정상 동작하는지 확인.

**Step 3: 커밋**

```bash
git add packages/client/src/components/chat/CommandToolbar.tsx
git commit -m "feat(client): add inline command editing UI"
```

---

### Task 11: Pylon - CommandStore 초기화 연결

**Files:**
- Modify: `packages/pylon/src/pylon.ts` (또는 Pylon 초기화 파일)

**Step 1: Pylon 시작 시 CommandStore 생성**

Pylon의 초기화 로직에서 CommandStore를 생성하고 deps에 전달:

```typescript
const commandStore = new CommandStore(path.join(dataDir, 'commands.db'));
```

기존 MessageStore가 `messages.db`를 사용하는 것과 같은 패턴.

**Step 2: 종료 시 close()**

Pylon 종료 핸들러에서 `commandStore.close()` 호출.

**Step 3: 통합 테스트**

```bash
pnpm dev
```

전체 흐름 테스트: 커맨드 생성 → 툴바에 표시 → 클릭 → Claude에 메시지 전달

**Step 4: 커밋**

```bash
git add packages/pylon/src/pylon.ts
git commit -m "feat(pylon): initialize CommandStore on startup"
```

---

### Task 12: 타입체크 및 최종 검증

**Step 1: 전체 타입체크**

```bash
pnpm typecheck
```

**Step 2: 전체 테스트**

```bash
pnpm test
```

**Step 3: 최종 커밋 (필요 시)**

```bash
git add -A
git commit -m "fix: resolve type errors and test issues"
```

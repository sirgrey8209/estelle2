# Command Execute Bubble Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 커맨드 실행 시 특수 버블로 표시 (접기/펼치기), 임시 메시지 패턴으로 멀티 클라이언트 동기화.

**Architecture:** StoreMessage에 `command_execute` 타입과 `temporary` 필드 추가. Pylon handleCommandExecute가 직접 저장/브로드캐스트. Client는 임시 메시지 패턴으로 optimistic update 후 서버 이벤트로 교체. CommandBubble 컴포넌트로 접기/펼치기 렌더링.

**Tech Stack:** better-sqlite3, Zustand, React, lucide-react, vitest

---

### Task 1: Core — StoreMessage에 command_execute 타입 + temporary 필드 추가

**Files:**
- Modify: `packages/core/src/types/store-message.ts`

**변경 내용:**

1. `StoreMessageType`에 `'command_execute'` 추가:
```typescript
export type StoreMessageType =
  | 'text' | 'tool_start' | 'tool_complete' | 'error'
  | 'result' | 'aborted' | 'file_attachment' | 'user_response'
  | 'system' | 'command_execute';
```

2. `BaseStoreMessage`에 `temporary` 필드 추가:
```typescript
export interface BaseStoreMessage {
  // ... 기존 필드
  temporary?: boolean;
}
```

3. `CommandExecuteMessage` 인터페이스 추가:
```typescript
export interface CommandExecuteMessage extends BaseStoreMessage {
  role: 'user';
  type: 'command_execute';
  content: string;
  commandId: number;
  commandName: string;
  commandIcon: string | null;
  commandColor: string | null;
}
```

4. `StoreMessage` 유니온에 `CommandExecuteMessage` 추가

5. 타입 가드 함수 추가:
```typescript
export function isCommandExecuteMessage(msg: StoreMessage): msg is CommandExecuteMessage {
  return msg.role === 'user' && msg.type === 'command_execute';
}
```

**커밋:**
```bash
git add packages/core/src/types/store-message.ts
git commit -m "feat(core): add command_execute message type and temporary field to StoreMessage"
```

---

### Task 2: Pylon — messageStore에 command_execute 저장 지원

**Files:**
- Modify: `packages/pylon/src/stores/message-store.ts`

**변경 내용:**

1. `addCommandExecuteMessage` 메서드 추가:
```typescript
addCommandExecuteMessage(
  sessionId: number,
  content: string,
  commandId: number,
  commandName: string,
  commandIcon: string | null,
  commandColor: string | null,
): StoreMessage[] {
  const msg: CommandExecuteMessage = {
    id: generateMessageId(),
    timestamp: Date.now(),
    role: 'user',
    type: 'command_execute',
    content,
    commandId,
    commandName,
    commandIcon,
    commandColor,
  };

  this.stmtInsert.run(this._messageToRow(sessionId, msg));
  return this.getMessages(sessionId);
}
```

2. `_messageToRow`에 `command_execute` 케이스 추가:
```typescript
case 'command_execute': {
  const cmdMsg = message as CommandExecuteMessage;
  row.content = cmdMsg.content;
  // 커맨드 메타데이터를 tool_input에 JSON으로 저장 (기존 컬럼 재활용)
  row.tool_input = JSON.stringify({
    commandId: cmdMsg.commandId,
    commandName: cmdMsg.commandName,
    commandIcon: cmdMsg.commandIcon,
    commandColor: cmdMsg.commandColor,
  });
  break;
}
```

3. `_rowToMessage`에서 `command_execute` 타입 복원:
```typescript
case 'command_execute': {
  const meta = row.tool_input ? JSON.parse(row.tool_input) : {};
  return {
    id: row.id,
    role: 'user',
    type: 'command_execute',
    timestamp: row.timestamp,
    content: row.content || '',
    commandId: meta.commandId,
    commandName: meta.commandName,
    commandIcon: meta.commandIcon ?? null,
    commandColor: meta.commandColor ?? null,
  };
}
```

**커밋:**
```bash
git add packages/pylon/src/stores/message-store.ts
git commit -m "feat(pylon): add command_execute message type to MessageStore"
```

---

### Task 3: Pylon — handleCommandExecute 변경

**Files:**
- Modify: `packages/pylon/src/pylon.ts`

**변경 내용:**

기존 `handleCommandExecute`는 `handleClaudeSend`에 위임. 변경 후 직접 처리:

```typescript
private handleCommandExecute(
  payload: Record<string, unknown> | undefined,
  from: MessageFrom | undefined
): void {
  if (!this.deps.commandStore) return;

  const commandId = payload?.commandId as number;
  const conversationId = payload?.conversationId as number;
  if (!commandId || !conversationId) return;

  // 커맨드 전체 데이터 조회
  const command = this.deps.commandStore.getCommandById(commandId);
  if (!command) {
    if (from?.deviceId) {
      this.send({
        type: 'error',
        payload: { message: `Command not found: ${commandId}` },
        to: [from.deviceId],
      });
    }
    return;
  }

  // 1. messageStore에 command_execute 타입으로 저장
  this.deps.messageStore.addCommandExecuteMessage(
    conversationId,
    command.content,
    command.id,
    command.name,
    command.icon,
    command.color,
  );
  this.scheduleSaveMessages(conversationId);

  // 2. claude_event(commandExecute) 브로드캐스트
  this.send({
    type: 'claude_event',
    payload: {
      conversationId,
      event: {
        type: 'commandExecute',
        content: command.content,
        timestamp: Date.now(),
        commandId: command.id,
        commandName: command.name,
        commandIcon: command.icon,
        commandColor: command.color,
      },
    },
    broadcast: 'clients',
  });

  // 3. Claude에게는 일반 텍스트로 전달
  const workingDir = this.getWorkingDirForConversation(conversationId as ConversationId);
  if (workingDir) {
    this.deps.agentManager.sendMessage(conversationId, command.content, {
      workingDir,
    });
  }
}
```

**커밋:**
```bash
git add packages/pylon/src/pylon.ts
git commit -m "feat(pylon): handleCommandExecute stores as command_execute and broadcasts commandExecute event"
```

---

### Task 4: Client — handleClaudeEventForConversation에 userMessage/commandExecute 핸들러 추가

**Files:**
- Modify: `packages/client/src/hooks/useMessageRouter.ts`

**변경 내용:**

`handleClaudeEventForConversation`의 switch 문에 두 케이스 추가:

```typescript
case 'userMessage': {
  const messages = store.getState(conversationId)?.messages ?? [];
  const lastMsg = messages[messages.length - 1];

  const realMessage: StoreMessage = {
    id: (event.id as string) || `user-${Date.now()}`,
    role: 'user',
    type: 'text',
    content: (event.content as string) || '',
    timestamp: (event.timestamp as number) || Date.now(),
    ...(event.attachments ? { attachments: event.attachments } : {}),
  };

  if (lastMsg && (lastMsg as any).temporary) {
    // 임시 메시지 → 실제 메시지로 교체
    const updated = [...messages.slice(0, -1), realMessage];
    store.setMessages(conversationId, updated);
  } else {
    // 다른 클라이언트 → 새로 추가
    store.addMessage(conversationId, realMessage);
  }
  break;
}

case 'commandExecute': {
  const messages = store.getState(conversationId)?.messages ?? [];
  const lastMsg = messages[messages.length - 1];

  const realMessage: StoreMessage = {
    id: (event.id as string) || `cmd-${Date.now()}`,
    role: 'user',
    type: 'command_execute',
    content: (event.content as string) || '',
    timestamp: (event.timestamp as number) || Date.now(),
    commandId: event.commandId as number,
    commandName: (event.commandName as string) || '',
    commandIcon: (event.commandIcon as string) ?? null,
    commandColor: (event.commandColor as string) ?? null,
  } as StoreMessage;

  if (lastMsg && (lastMsg as any).temporary) {
    const updated = [...messages.slice(0, -1), realMessage];
    store.setMessages(conversationId, updated);
  } else {
    store.addMessage(conversationId, realMessage);
  }
  break;
}
```

**커밋:**
```bash
git add packages/client/src/hooks/useMessageRouter.ts
git commit -m "feat(client): handle userMessage and commandExecute events with temporary message replacement"
```

---

### Task 5: Client — ChatArea optimistic update에 temporary 추가

**Files:**
- Modify: `packages/client/src/components/chat/ChatArea.tsx`

**변경 내용:**

optimistic update로 생성하는 userMessage에 `temporary: true` 추가. 두 곳 모두:

```typescript
// 첨부파일 있을 때 (92행 근처)
const userMessage: UserTextMessage = {
  id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  role: 'user',
  type: 'text',
  content: pending.text,
  timestamp: Date.now(),
  temporary: true,  // ← 추가
  attachments: ...,
};

// 첨부파일 없을 때 (185행 근처)
const userMessage: UserTextMessage = {
  id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  role: 'user',
  type: 'text',
  content: text,
  timestamp: Date.now(),
  temporary: true,  // ← 추가
  attachments: ...,
};
```

**커밋:**
```bash
git add packages/client/src/components/chat/ChatArea.tsx
git commit -m "feat(client): add temporary flag to optimistic user messages"
```

---

### Task 6: Client — CommandToolbar에서 command_execute 임시 메시지 추가

**Files:**
- Modify: `packages/client/src/components/chat/CommandToolbar.tsx`

**변경 내용:**

`handleExecute`를 수정하여 optimistic update 추가:

```typescript
import { useConversationStore } from '../../stores/conversationStore';
import { useCommandStore } from '../../stores/commandStore';
import type { StoreMessage } from '@estelle/core';

const handleExecute = useCallback(
  (cmdId: number) => {
    if (longPressFired.current) {
      longPressFired.current = false;
      return;
    }
    if (conversationId == null) return;

    // commandStore에서 커맨드 정보 가져오기
    const cmd = commands.find(c => c.id === cmdId);
    if (cmd) {
      // optimistic update: command_execute 임시 메시지 추가
      const tempMessage: StoreMessage = {
        id: `cmd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        role: 'user',
        type: 'command_execute',
        content: cmd.content,
        timestamp: Date.now(),
        commandId: cmd.id,
        commandName: cmd.name,
        commandIcon: cmd.icon,
        commandColor: cmd.color,
        temporary: true,
      } as StoreMessage;
      useConversationStore.getState().addMessage(conversationId, tempMessage);
    }

    executeCommand(cmdId, conversationId);
  },
  [conversationId, commands]
);
```

**커밋:**
```bash
git add packages/client/src/components/chat/CommandToolbar.tsx
git commit -m "feat(client): add command_execute temporary message on button click"
```

---

### Task 7: Client — CommandBubble 컴포넌트

**Files:**
- Create: `packages/client/src/components/chat/CommandBubble.tsx`

**내용:**

```tsx
import { useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import * as LucideIcons from 'lucide-react';

interface CommandBubbleProps {
  commandName: string;
  commandIcon: string | null;
  commandColor: string | null;
  content: string;
}

function isEmoji(str: string): boolean {
  return /^\p{Emoji_Presentation}/u.test(str);
}

function CommandIcon({ icon, color }: { icon: string | null; color: string | null }) {
  if (!icon) return null;
  if (isEmoji(icon)) return <span className="text-sm leading-none">{icon}</span>;

  const pascalCase = icon.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('');
  const LucideIcon = (LucideIcons as Record<string, unknown>)[pascalCase] as LucideIcons.LucideIcon | undefined;
  if (LucideIcon) return <LucideIcon className="h-3.5 w-3.5" style={color ? { color } : undefined} />;
  return <span className="text-xs">{icon}</span>;
}

export function CommandBubble({ commandName, commandIcon, commandColor, content }: CommandBubbleProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="my-1">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
      >
        <CommandIcon icon={commandIcon} color={commandColor} />
        <span className="font-medium">{commandName}</span>
        <span className="text-muted-foreground">실행</span>
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>
      {expanded && (
        <div className="mt-1 px-3 py-2 text-xs text-muted-foreground bg-secondary/30 rounded-lg whitespace-pre-wrap">
          {content}
        </div>
      )}
    </div>
  );
}
```

**커밋:**
```bash
git add packages/client/src/components/chat/CommandBubble.tsx
git commit -m "feat(client): add CommandBubble component with expand/collapse"
```

---

### Task 8: Client — MessageBubble에서 command_execute 분기

**Files:**
- Modify: `packages/client/src/components/chat/MessageBubble.tsx`

**변경 내용:**

1. `CommandBubble` import 추가
2. 렌더링 분기 추가 (기존 tool_start/tool_complete 분기 앞에):

```typescript
// command_execute: 커맨드 실행 버블
if (message.type === 'command_execute') {
  const cmdMsg = message as CommandExecuteMessage;
  return (
    <CommandBubble
      commandName={cmdMsg.commandName}
      commandIcon={cmdMsg.commandIcon}
      commandColor={cmdMsg.commandColor}
      content={cmdMsg.content}
    />
  );
}
```

**커밋:**
```bash
git add packages/client/src/components/chat/MessageBubble.tsx
git commit -m "feat(client): render CommandBubble for command_execute messages"
```

---

### Task 9: 타입체크 및 최종 검증

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
git commit -m "fix: resolve type errors from command execute bubble implementation"
```
